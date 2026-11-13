// Connexions entre les éléments d'une fiche Kibsu : portes, zones, transitions, parcours depuis l'extérieur.
// Le catalogue (portes, zones, transitions, règles et leurs sources) est dans connexions.json.
//
// Idée : chaque élément appartient à une zone (vie, travail, technique, serre, poussière…). Passer d'une zone à l'autre
// n'est pas toujours direct : entre l'extérieur et l'intérieur il faut un sas ; entre la poussière et la vie, un vestiaire ;
// entre la vie et la serre, un vestiaire propre. Ces pièces de transition sont des éléments de la fiche (type « sas » ou
// « vestiaire »), reliés par des ports comme les autres. connexions.js vérifie chaque liaison, chaque porte, et trace le
// parcours de chaque espace depuis l'extérieur.
//
// Navigateur : import { analyser } from './connexions.js'
// Node       : node connexions.js fiche.json

import { val, niveaux } from './formes.js';
import { assembler } from './assemblage.js';

// Zone d'un élément : écrite dans la fiche, sinon déduite du type
export function zoneDe(e, C) {
  if (!e) return null;
  if (e.zone) return e.zone;
  if (transitionDe(e, C)) return null;                                  // pièce de transition
  return C.zones_par_type[e.type] ?? null;
}

// Transition portée par un élément (sas, vestiaire…) ou null
export function transitionDe(e, C) {
  if (!e) return null;
  if (e.transition !== undefined) return e.transition || null;     // null écrit : l'élément n'est pas une transition
  if (e.type === 'sas') return 'sas';
  if (e.type === 'vestiaire') return 'vestiaire';
  return null;
}

// Porte d'un port : catalogue + surcharges écrites dans le port
export function porteDe(q, C) {
  const id = q.porte || (q.type === 'porte' ? C.porte_par_defaut.porte : C.porte_par_defaut.ecoutille);
  const P = C.portes[id] || {};
  const d = q.diametre_m != null && !q.porte ? val(q.diametre_m) : null;   // ancien port : seul le diamètre est écrit
  const l = q.largeur_m != null ? val(q.largeur_m) : d ?? val(P.largeur_m) ?? val(P.diametre_m);
  const h = q.hauteur_porte_m != null ? val(q.hauteur_porte_m) : d ?? val(P.hauteur_m) ?? val(P.diametre_m);
  return { id, nom: P.nom || id, forme: d != null ? 'rond' : P.forme || 'rect', largeur: l, hauteur: h,
           etanche: P.etanche ?? (q.type !== 'porte_interieure'), exterieure: !!P.exterieure, seuil: val(q.seuil_m) ?? val(P.seuil_m) ?? 0,
           statut: (P.largeur_m || P.diametre_m || {}).s || '▨', source: (P.largeur_m || P.diametre_m || {}).src };
}

// Hauteur du centre d'une porte dans le repère de l'élément : posée sur un niveau si le port le dit
export function zPorte(e, q, C) {
  const P = porteDe(q, C);
  if (q.niveau) {
    const N = niveaux(e).find(n => n.id === q.niveau);
    if (N) return N.z + P.seuil + P.hauteur / 2;
  }
  return null;
}

const cle = (a, b) => [a, b].sort().join('|');

// Analyse complète
export function analyser(F, C, A = assembler(F)) {
  const E = Object.fromEntries(F.elements.map(e => [e.id, e]));
  const T = C.transitions, M = C.matrice;
  const out = { liens: [], portes: [], elements: {}, parcours: {}, resume: { ok: 0, non: 0, doute: 0 } };
  const note = (cible, etat, texte, regle) => { cible.push({ etat, texte, regle }); out.resume[etat === 'ok' ? 'ok' : etat === 'non' ? 'non' : 'doute']++; };

  // Graphe : nœuds = éléments (+ « dehors »), arêtes = liaisons (pressurisées ou non)
  const voisins = {}; const arete = (a, b, l) => { (voisins[a] ||= []).push({ v: b, l }); (voisins[b] ||= []).push({ v: a, l }); };
  const coupe = s => { const i = String(s).indexOf('.'); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };
  const portsReliees = new Set();

  for (const l of F.liaisons || []) {
    const [a, pa] = coupe(l.de), [b, pb] = coupe(l.vers);
    if (!E[a] || !E[b]) continue;
    const typeL = C.liaisons[l.type] || C.liaisons.jonction;
    const pressurisee = l.pressurise ?? typeL.pressurise;
    const r = { de: l.de, vers: l.vers, type: l.type, pressurisee, msgs: [] };
    if (pa) portsReliees.add(`${a}.${pa}`); if (pb) portsReliees.add(`${b}.${pb}`);
    if (pressurisee) arete(a, b, r);
    else { arete(a, 'dehors', { ...r, cote: a }); arete(b, 'dehors', { ...r, cote: b }); }
    r.zones = [pressurisee ? zoneOuTrans(E[a]) : zoneOuTrans(E[a]) + ' → dehors', pressurisee ? zoneOuTrans(E[b]) : 'dehors ← ' + zoneOuTrans(E[b])];

    // 1. Transition : les deux zones peuvent-elles se toucher ?
    if (pressurisee) verifierPaire(E[a], E[b], r);
    else {
      for (const [x, px] of [[E[a], pa], [E[b], pb]]) {
        if (!x.pressurise && !transitionDe(x, C)) continue;                 // un élément non pressurisé dehors : rien à vérifier
        const tr = transitionDe(x, C);
        if (tr && T[tr]?.cotes.some(c => c.includes('exterieur'))) note(r.msgs, 'ok', `${x.id} (${T[tr].nom}) s'ouvre sur ${l.type}`, 'TR-1');
        else note(r.msgs, 'non', `${x.id} est pressurisé et donne sur « ${l.type} » (non pressurisé) : il lui faut un sas`, 'TR-1');
      }
    }

    // 2. Dénivelé entre les deux portes (l'assemblage garde les éléments au sol)
    const pA = pa && A.ports[a]?.find(q => q.id === pa), pB = pb && A.ports[b]?.find(q => q.id === pb);
    if (pA?.pW && pB?.pW) {
      const dz = pB.pW[2] - pA.pW[2], ec = val(l.ecart_m) || 0;
      r.denivele = dz;
      if (Math.abs(dz) <= C.regles.marche_tolerance_m.v) note(r.msgs, 'ok', 'portes au même niveau', 'CX-4');
      else if (ec <= 0) note(r.msgs, 'non', `marche de ${Math.abs(dz).toFixed(2)} m à la porte (aucun tunnel pour la rattraper)`, 'CX-4');
      else if (l.circulation) note(r.msgs, 'ok', `dénivelé ${dz.toFixed(2)} m rattrapé par ${l.circulation} dans le tunnel (${ec} m)`, 'CX-4');
      else {
        const pente = Math.abs(dz) / ec * 100;
        const max = C.regles.pente_rampe_max_pc;
        note(r.msgs, pente <= max.v ? 'ok' : 'doute', `dénivelé ${dz.toFixed(2)} m sur ${ec} m : pente ${pente.toFixed(0)} % ${pente <= max.v ? '(rampe)' : '→ escalier ou échelle dans le tunnel'}`, 'CX-4');
      }
    }

    // 3. Étanchéité : entre deux volumes pressurisés, une porte au moins doit fermer (isoler une fuite, un feu)
    if (pressurisee && E[a].pressurise && E[b].pressurise) {
      const portes = [pA && porteDe(F.elements.find(e => e.id === a).ports.find(q => q.id === pa), C), pB && porteDe(E[b].ports.find(q => q.id === pb), C)].filter(Boolean);
      if (!portes.length) note(r.msgs, 'doute', 'liaison sans port : impossible de vérifier les portes', 'CX-1');
      else if (portes.some(p => p.etanche)) note(r.msgs, 'ok', 'une porte étanche permet d\'isoler les deux volumes', 'CX-1');
      else note(r.msgs, 'non', 'aucune porte étanche : une fuite ou un feu passe d\'un volume à l\'autre', 'CX-1');
    }
    out.liens.push(r);
  }

  // Portes extérieures libres : elles donnent dehors
  for (const e of F.elements) for (const q of e.ports || []) {
    if (!portsReliees.has(`${e.id}.${q.id}`) && porteDe(q, C).exterieure) arete(e.id, 'dehors', { de: `${e.id}.${q.id}`, vers: 'dehors', type: 'porte', pressurisee: false });
  }

  function zoneOuTrans(e) { const t = transitionDe(e, C); return t ? (T[t]?.nom || t) : (zoneDe(e, C) || e.type); }

  function verifierPaire(x, y, r) {
    const tx = transitionDe(x, C), ty = transitionDe(y, C);
    if (tx || ty) {
      for (const [t, autre] of [[tx, y], [ty, x]]) {
        if (!t) continue;
        const z = transitionDe(autre, C) ? 'transition' : zoneDe(autre, C);
        const def = T[t];
        if (!def) { note(r.msgs, 'doute', `transition « ${t} » inconnue`, 'TR-0'); continue; }
        const porteur = t === tx ? x : y;
        if (z === 'transition' || def.cotes.some(c => c.includes(z))) {
          note(r.msgs, 'ok', `${def.nom} ↔ ${z}`, 'TR-0');
          if (def.conseil?.[z]) {
            if (porteur.secours) note(r.msgs, 'ok', `${porteur.id} est un sas de secours : pas de vestiaire exigé`, 'TR-4');
            else note(r.msgs, 'doute', def.conseil[z], 'TR-4');
          }
        } else note(r.msgs, 'non', `${def.nom} ne doit pas donner sur la zone « ${z} » (côtés prévus : ${def.cotes.map(c => c.join(' / ')).join(' ↔ ')})`, 'TR-0');
      }
      return;
    }
    const zx = zoneDe(x, C), zy = zoneDe(y, C);
    if (!zx || !zy) return;
    const regle = M[cle(zx, zy)] ?? (zx === zy ? 'libre' : null);
    if (regle == null || regle === 'libre') { note(r.msgs, 'ok', `${zx} ↔ ${zy} : passage direct`, 'TR-0'); return; }
    const def = T[regle];
    note(r.msgs, 'non', `${zx} ↔ ${zy} : il faut un ${def ? def.nom.toLowerCase() : regle} entre les deux (${def?.pourquoi || ''})`, def?.regle || 'TR-0');
  }

  // Portes : taille, seuil sur un plancher, porte extérieure
  for (const e of F.elements) {
    if (!e.ports) continue;
    const NV = niveaux(e);
    const tr = transitionDe(e, C);
    for (const q of e.ports) {
      const P = porteDe(q, C), msgs = [];
      const relie = portsReliees.has(`${e.id}.${q.id}`);
      const liee = (F.liaisons || []).find(l => l.de === `${e.id}.${q.id}` || l.vers === `${e.id}.${q.id}`);
      const versDehors = !relie ? P.exterieure : liee && !((C.liaisons[liee.type] || C.liaisons.jonction).pressurise ?? true);
      // qui passe ? en combinaison côté dehors et dans les sas, sinon en tenue de bord
      const voisin = liee && coupe(liee.de === `${e.id}.${q.id}` ? liee.vers : liee.de)[0];
      const cotePoussiere = voisin && E[voisin] && (transitionDe(E[voisin], C) === 'sas' || zoneDe(E[voisin], C) === 'poussiere');
      const enCombi = versDehors || tr === 'sas' || (tr === 'vestiaire' && cotePoussiere);
      const besoin = enCombi ? C.regles.passage_combinaison : C.regles.passage_personne;
      const lmin = val(besoin.largeur_m), hmin = val(besoin.hauteur_m);
      const okL = P.largeur >= lmin - 1e-6, okH = P.hauteur >= hmin - 1e-6;
      note(msgs, okL && okH ? 'ok' : 'non', `${P.nom} ${fmt(P.largeur)} × ${fmt(P.hauteur)} m pour ${enCombi ? 'une personne en combinaison' : 'une personne'} (min. ${fmt(lmin)} × ${fmt(hmin)} m ${besoin.s || ''})`, enCombi ? 'CX-2' : 'CX-3');
      if (!relie && !P.exterieure && !versDehors) note(msgs, 'doute', 'port libre : réservé pour un ajout futur ?', 'CX-6');
      if (versDehors && !tr && e.pressurise) note(msgs, 'non', 'cette porte donne dehors sans sas', 'TR-1');
      // seuil sur un plancher
      const lat = !q.face || !q.face.includes('z');
      if (lat && NV.length) {
        const z0 = zPorte(e, q, C);
        const port = A.ports[e.id]?.find(x => x.id === q.id);
        const zc = z0 ?? port?.p?.[2];
        if (zc != null) {
          const bas = zc - P.hauteur / 2, haut = zc + P.hauteur / 2;
          const n = NV.find(n => bas >= n.z - 0.02 && haut <= n.plafond + 1e-6);
          if (n) note(msgs, 'ok', `s'ouvre au niveau ${n.id}${Math.abs(bas - n.z) > 0.05 ? ` (seuil ${fmt(bas - n.z)} m)` : ''}`, 'CX-5');
          else note(msgs, 'non', `porte de ${fmt(bas)} à ${fmt(haut)} m : pas posée sur un plancher (${NV.map(n => n.id + ' ' + fmt(n.z) + ' m').join(', ')})`, 'CX-5');
        }
      }
      out.portes.push({ element: e.id, port: q.id, porte: P, msgs, relie, versDehors });
    }
  }

  // Niveaux : chaque niveau au-dessus du premier a un accès (échelle, escalier, trappe) ; socles
  for (const e of F.elements) {
    const m = () => (out.elements[e.id] ||= { msgs: [] }).msgs;
    if (e.niveaux?.length > 1) {
      const NV = niveaux(e);
      for (const n of NV.slice(1)) {
        if (n.acces) note(m(), 'ok', `${n.id} accessible par ${n.acces.type || n.acces}${n.acces.porte ? ' (' + (C.portes[n.acces.porte]?.nom || n.acces.porte).toLowerCase() + ')' : ''}`, 'CX-7');
        else note(m(), 'non', `${n.id} n'a pas d'accès depuis le niveau du dessous (échelle, escalier ou trappe)`, 'CX-7');
      }
    }
    const p = A.poses[e.id];
    if (e.socle && p) note(m(), 'ok', `posé sur un socle de ${fmt(p.pos[2])} m pour que ses portes soient à la hauteur du voisin`, 'CX-4');
  }

  // Sas : exactement une porte vers dehors
  for (const e of F.elements) {
    if (transitionDe(e, C) !== 'sas') continue;
    const n = out.portes.filter(p => p.element === e.id && p.versDehors).length;
    const m = (out.elements[e.id] ||= { msgs: [] }).msgs;
    note(m, n === 1 ? 'ok' : 'non', `${n} porte${n > 1 ? 's' : ''} vers l'extérieur (il en faut une)`, 'TR-2');
  }

  // Parcours depuis dehors : chemin le plus court vers chaque élément pressurisé
  // (le sas de secours coûte plus cher : le parcours de tous les jours passe par le sas principal)
  const prec = { dehors: null }, cout = { dehors: 0 }, ouverts = new Set(['dehors']);
  while (ouverts.size) {
    let x = null; for (const o of ouverts) if (x == null || cout[o] < cout[x]) x = o;
    ouverts.delete(x);
    for (const { v } of voisins[x] || []) {
      const c = cout[x] + (E[v]?.secours ? 5 : 1);
      if (c < (cout[v] ?? Infinity)) { cout[v] = c; prec[v] = x; ouverts.add(v); }
    }
  }
  for (const e of F.elements) {
    if (!(e.pressurise || transitionDe(e, C))) continue;
    const m = (out.elements[e.id] ||= { msgs: [] }).msgs;
    if (!(e.id in prec)) { note(m, 'non', 'injoignable depuis l\'extérieur', 'TR-3'); continue; }
    const ch = []; let x = e.id; while (x) { ch.unshift(x); x = prec[x]; }
    out.parcours[e.id] = ch;
  }
  out.zone = id => id === 'dehors' ? 'exterieur' : zoneDe(E[id], C);
  out.transition = id => transitionDe(E[id], C);
  return out;
}

const fmt = x => x == null || Number.isNaN(x) ? '?' : (+(+x).toFixed(2)).toString().replace('.', ',');

// Ligne de commande
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('connexions.js')) {
  const fs = await import('node:fs'), path = await import('node:path'), url = await import('node:url');
  const ici = path.dirname(url.fileURLToPath(import.meta.url));
  const F = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const C = JSON.parse(fs.readFileSync(path.join(ici, 'connexions.json'), 'utf8'));
  const X = analyser(F, C);
  const s = { ok: '✓', non: '✗', doute: '?' };
  for (const l of X.liens) { console.log(`${l.de} → ${l.vers} (${l.type})`); for (const m of l.msgs) console.log(`   ${s[m.etat]} ${m.texte}`); }
  for (const p of X.portes) for (const m of p.msgs) if (m.etat !== 'ok') console.log(`${p.element}.${p.port} ${s[m.etat]} ${m.texte}`);
  for (const [id, o] of Object.entries(X.elements)) for (const m of o.msgs) console.log(`${id} ${s[m.etat]} ${m.texte}`);
  for (const [id, ch] of Object.entries(X.parcours)) console.log(`parcours ${id} : ${ch.join(' → ')}`);
  console.log(`\n${X.resume.ok} ✓ · ${X.resume.non} ✗ · ${X.resume.doute} ?`);
}
