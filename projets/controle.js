// Contrôle d'une fiche projet Kibsu (format kibsu-projet/0.1, voir FORMAT.md) contre regles.json.
// Navigateur : import { controler } from './projets/controle.js'
// Node       : node controle.js fiche.json [regles.json]
// Chaque résultat : { id, nom, domaine, etat: 'ok'|'non'|'info'|'?', valeur, seuil, detail, source, statut }
// statut = le plus faible des statuts utilisés (● > ◇ > ▨) : un ✓ calculé sur des ▨ reste une hypothèse.

const RANG = { '●': 3, '◇': 2, '▨': 1 };
export const val = x => (x && typeof x === 'object' && 'v' in x) ? x.v : x;
export const stat = x => (x && typeof x === 'object' && 'v' in x) ? (x.s || '▨') : (x == null ? null : '▨');
const pire = (...s) => s.filter(Boolean).reduce((a, b) => (RANG[b] < RANG[a] ? b : a), '●');

// Volume intérieur d'une forme (m³)
export function volumeForme(f) {
  if (!f) return null;
  const d = val(f.diametre_m), L = val(f.longueur_m), h = val(f.hauteur_m);
  switch (f.type) {
    case 'cylindre': return Math.PI * (d / 2) ** 2 * L;
    case 'sphere': return Math.PI * d ** 3 / 6;
    case 'dome': return Math.PI * d ** 3 / 12;                       // demi-sphère
    case 'boite': return val(f.largeur_m) * val(f.longueur_m) * h;
    default: return null;
  }
}

function volumeHabitable(e, R) {
  if (e.volume_habitable_m3 != null) return { v: val(e.volume_habitable_m3), s: stat(e.volume_habitable_m3) };
  const vp = volumeForme(e.forme);
  if (vp == null) return null;
  const k = R.hypotheses.fraction_nette;                              // volume net / volume pressurisé
  return { v: vp * val(k), s: pire('◇', stat(k), stat(e.forme.diametre_m)) };
}

const TESTS = {
  // Volume habitable net par personne, seuil selon la durée de mission
  volume_par_personne(F, r, R) {
    const mods = F.elements.filter(e => e.pressurise);
    const vols = mods.map(e => volumeHabitable(e, R)).filter(Boolean);
    const tot = vols.reduce((a, b) => a + b.v, 0), n = val(F.programme.equipage);
    const j = val(F.programme.duree_jours), P = r.params;
    let seuil = Math.max(0, P.formule.a * Math.log(j) + P.formule.b), sS = P.formule.s, d = `tendance HIDH pour ${j} j`;
    if (P.long && j >= P.long.jours_min) { seuil = val(P.long.min_m3); sS = stat(P.long.min_m3); d = 'mission longue (rapport NASA 2014)'; }
    const parP = tot / n;
    return { etat: parP >= seuil ? 'ok' : 'non', valeur: +parP.toFixed(1), seuil: +seuil.toFixed(1), unite: 'm³/pers.',
      detail: `${tot.toFixed(0)} m³ pour ${n} pers. ; seuil = ${d}`,
      statut: pire(...vols.map(x => x.s), sS) };
  },
  // Chaque module pressurisé doit avoir au moins N chemins de sortie (liaisons + sorties propres)
  sorties(F, r) {
    const mauvais = [];
    for (const e of F.elements.filter(e => e.pressurise)) {
      const n = (F.liaisons || []).filter(l => l.de === e.id || l.vers === e.id).length + (val(e.sorties) || 0);
      if (n < r.params.min) mauvais.push(`${e.id} (${n})`);
    }
    return { etat: mauvais.length ? 'non' : 'ok', valeur: mauvais.length, seuil: 0, unite: 'module(s) en défaut',
      detail: mauvais.length ? 'moins de ' + r.params.min + ' sorties : ' + mauvais.join(', ') : 'chaque module a ' + r.params.min + ' sorties ou plus', statut: '◇' };
  },
  // Ce qui voyage doit tenir dans la soute du véhicule choisi
  gabarit_vol(F, r, R) {
    const pb = [], st = [];
    for (const e of F.elements.filter(e => e.arrivee && e.arrivee.mode !== 'in_situ')) {
      const V = R.vehicules[e.arrivee.vehicule];
      if (!V || V.diametre_utile_m == null) { pb.push(`${e.id} : véhicule sans gabarit connu`); continue; }
      const [d, h] = (e.arrivee.dimensions_vol_m || []).map(val);
      st.push(stat(V.diametre_utile_m));
      if (d > val(V.diametre_utile_m)) pb.push(`${e.id} : Ø ${d} m > ${val(V.diametre_utile_m)} m`);
      if (V.hauteur_utile_m != null && h > val(V.hauteur_utile_m)) pb.push(`${e.id} : ${h} m > ${val(V.hauteur_utile_m)} m de haut`);
    }
    return { etat: pb.length ? 'non' : 'ok', valeur: pb.length, seuil: 0, unite: 'élément(s) hors gabarit',
      detail: pb.join(' ; ') || 'tout tient dans les soutes', statut: pire('◇', ...st) };
  },
  // Masse de chaque envoi (avec marge) ≤ masse posable par le véhicule
  masse_lancement(F, r, R) {
    const marge = val(R.hypotheses.marge_masse), pb = [], lots = {};
    for (const e of F.elements.filter(e => e.arrivee && e.arrivee.mode !== 'in_situ')) {
      if (e.masse_kg == null) { pb.push(`${e.id} : masse non renseignée`); continue; }
      const lot = e.arrivee.lot || e.id;
      (lots[lot] = lots[lot] || { veh: e.arrivee.vehicule, m: 0, s: [] }).m += val(e.masse_kg) || 0;
      lots[lot].s.push(stat(e.masse_kg));
    }
    const st = [stat(R.hypotheses.marge_masse)];
    for (const [lot, L] of Object.entries(lots)) {
      const V = R.vehicules[L.veh], mm = L.m * (1 + marge);
      st.push(...L.s);
      if (!V || V.masse_posee_kg == null) { pb.push(`${lot} : masse posée inconnue pour ${L.veh}`); continue; }
      st.push(stat(V.masse_posee_kg));
      if (mm > val(V.masse_posee_kg)) pb.push(`${lot} : ${Math.round(mm)} kg > ${val(V.masse_posee_kg)} kg`);
    }
    const inconnu = pb.some(p => p.includes('non renseignée') || p.includes('inconnue'));
    return { etat: pb.some(p => p.includes(' > ')) ? 'non' : inconnu ? '?' : 'ok', valeur: Object.keys(lots).length, seuil: null, unite: 'envoi(s)',
      detail: pb.join(' ; ') || `${Object.keys(lots).length} envois, marge ${Math.round(marge * 100)} % incluse`, statut: pire(...st) };
  },
  // Épaisseur de protection (régolithe) au-dessus des modules habités
  protection(F, r) {
    const e = val(F.protection && F.protection.epaisseur_m);
    if (e == null) return { etat: '?', detail: 'pas de protection décrite', statut: '▨' };
    return { etat: e >= val(r.params.min_m) ? 'ok' : 'non', valeur: e, seuil: val(r.params.min_m), unite: 'm',
      detail: r.params.vise || '', statut: pire(stat(F.protection.epaisseur_m), stat(r.params.min_m)) };
  },
  // Valeur de la fiche dans une plage [min, max]
  plage(F, r) {
    const P = r.params, x = P.chemin.split('.').reduce((o, k) => o && o[k], F);
    if (x == null) return { etat: '?', detail: `non renseigné (${P.chemin})`, statut: '▨' };
    const v = val(x);
    return { etat: v >= P.min && v <= P.max ? 'ok' : 'non', valeur: v, seuil: `${P.min}-${P.max}`, unite: P.unite,
      detail: `plage admise ${P.min} à ${P.max} ${P.unite}`, statut: pire(stat(x), P.s) };
  },
  // Serre : surface de culture selon le régime visé, et puissance électrique
  serre(F, r) {
    const regime = F.programme.regime_serre, S = r.params.regimes[regime];
    const serres = F.elements.filter(e => e.type === 'serre');
    const surf = serres.reduce((a, e) => a + (val(e.surface_culture_m2) || 0), 0);
    if (!regime || !S) return { etat: '?', detail: 'programme.regime_serre absent (salade, salade+feculents, tout)', statut: '▨' };
    const besoin = val(S) * val(F.programme.equipage), kW = surf * val(r.params.puissance_kW_m2);
    return { etat: surf >= besoin ? 'ok' : 'non', valeur: +surf.toFixed(1), seuil: +besoin.toFixed(1), unite: 'm² de culture',
      detail: `régime « ${regime} » ; puissance de la serre ≈ ${kW.toFixed(0)} kW`,
      statut: pire(stat(S), ...serres.map(e => stat(e.surface_culture_m2))) };
  },
  // Consommables à apporter (information, pas un seuil)
  consommables(F, r) {
    const n = val(F.programme.equipage), j = val(F.programme.duree_jours), out = [];
    let st = [];
    for (const [k, c] of Object.entries(r.params.par_personne_jour)) {
      out.push(`${k} ${Math.round(val(c.v ?? c) * n * j)} ${c.unite || 'kg'}`);
      st.push(stat(c));
    }
    return { etat: 'info', detail: out.join(' · ') + ` (${n} pers. × ${j} j)`, statut: pire(...st) };
  },
};

export function controler(F, R) {
  return R.regles.map(r => {
    const t = TESTS[r.test];
    let res;
    try { res = t ? t(F, r, R) : { etat: '?', detail: 'test inconnu : ' + r.test }; }
    catch (err) { res = { etat: '?', detail: 'fiche incomplète : ' + err.message }; }
    return { id: r.id, nom: r.nom, domaine: r.domaine, source: r.source, ...res };
  });
}

// --- Ligne de commande ---
if (typeof process !== 'undefined' && process.argv && import.meta.url === new URL('file:///' + process.argv[1].replace(/\\/g, '/')).href) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const ici = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const F = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const R = JSON.parse(fs.readFileSync(process.argv[3] || path.join(ici, 'regles.json'), 'utf8'));
  const sym = { ok: '✓', non: '✗', info: 'i', '?': '?' };
  console.log(`${F.nom}\n`);
  for (const x of controler(F, R)) {
    console.log(`${sym[x.etat]} ${x.statut || ''} ${x.nom}` + (x.valeur != null && x.seuil != null ? ` : ${x.valeur} / ${x.seuil} ${x.unite}` : '') + `\n    ${x.detail}`);
  }
}
