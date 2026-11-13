// Assemblage d'une fiche Kibsu par ports d'amarrage (voir FORMAT.md, « Ports et assemblage »).
// Chaque élément est dessiné dans son propre repère (centre posé au sol, axe des cylindres selon x).
// Ses ports sont des points d'amarrage : une face de l'enveloppe, une hauteur, un diamètre, un type.
// Une liaison relie deux ports (« M1.B » → « M2.A ») : l'assemblage tourne et pose chaque élément
// pour que les deux ports se fassent face, à l'écart demandé (longueur du tunnel ou du couloir).
// Navigateur : import { assembler } from './assemblage.js'
// Node       : node assemblage.js fiche.json   (positions écrites contre positions assemblées)

import { val } from './controle.js';
import { enveloppe, niveaux } from './formes.js';

const RAD = Math.PI / 180;
const TOL = 0.01;                                         // m : au-delà, la position écrite ne suit pas les ports

// Enveloppe d'une forme : voir formes.js (catalogue)
export { enveloppe };

const FACES = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

// Ports d'un élément dans son repère : { id, p: [x,y,z], n: [nx,ny,nz], diametre, type, statut }
// C (facultatif) : catalogue de connexions.json, pour poser une porte sur un niveau (q.niveau) avec sa vraie hauteur
export function ports(e, C = null) {
  const env = enveloppe(e.forme);
  const NV = (e.ports || []).some(q => q.niveau) ? niveaux(e) : [];
  return (e.ports || []).map(q => {
    let p = q.p, n = q.n;
    if (!p && q.face && env) {
      n = FACES[q.face];
      let z = q.face === '+z' ? env.h : q.face === '-z' ? 0 : (q.hauteur_m != null ? val(q.hauteur_m) : env.h / 2);
      const N = q.niveau && NV.find(x => x.id === q.niveau);
      if (N && !q.face.includes('z')) {
        const P = C?.portes?.[q.porte] || {};
        const h = val(q.hauteur_porte_m) ?? val(q.diametre_m) ?? val(P.hauteur_m) ?? val(P.diametre_m) ?? 1;
        z = N.z + (val(q.seuil_m) ?? val(P.seuil_m) ?? 0) + h / 2;
      }
      p = [n[0] * env.x, n[1] * env.y, z];
    }
    return { id: q.id, p, n, diametre: val(q.diametre_m), type: q.type || 'ecoutille', porte: q.porte, niveau: q.niveau,
             statut: q.diametre_m && typeof q.diametre_m === 'object' ? q.diametre_m.s : '▨', nom: q.nom };
  });
}

const rot = (v, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, k) => a.map(x => x * k);
const dist = (a, b) => Math.hypot(...sub(a, b));
const angle = v => Math.atan2(v[1], v[0]) / RAD;
const norm360 = a => ((a % 360) + 360) % 360;
export const versMonde = (pose, p) => add(pose.pos, rot(p, pose.rot));

const coupe = s => { const i = String(s).indexOf('.'); return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)]; };

// Résultat : { poses: { id: { pos, rot, ecrit: {pos, rot}, ecart_m, assemble } }, liens: [...], ports: { id: [...] }, erreurs, avertissements }
export function assembler(F, C = null) {
  const E = Object.fromEntries(F.elements.map(e => [e.id, e]));
  const P = Object.fromEntries(F.elements.map(e => [e.id, ports(e, C)]));
  const erreurs = [], avertissements = [];
  const liens = [];
  for (const l of F.liaisons || []) {
    const [a, pa] = coupe(l.de), [b, pb] = coupe(l.vers);
    const lien = { de: a, port_de: pa, vers: b, port_vers: pb, type: l.type, ecart: val(l.ecart_m) || 0, brut: l };
    if (!E[a] || !E[b]) { erreurs.push(`liaison ${l.de} → ${l.vers} : élément inconnu`); continue; }
    if (pa && !P[a].find(q => q.id === pa)) { erreurs.push(`${a} n'a pas de port ${pa}`); continue; }
    if (pb && !P[b].find(q => q.id === pb)) { erreurs.push(`${b} n'a pas de port ${pb}`); continue; }
    liens.push(lien);
  }

  // Pose écrite (position_m, rotation_deg) ; les éléments sans position_m n'ont pas de pose
  const poses = {};
  for (const e of F.elements) {
    if (!e.position_m) continue;
    const ecrit = { pos: e.position_m.map(Number), rot: val(e.rotation_deg) || 0 };
    poses[e.id] = { ...ecrit, ecrit, assemble: false };
  }

  // Ancre : garde sa pose écrite ; le reste suit les ports de proche en proche
  const relies = liens.filter(l => l.port_de && l.port_vers);
  const ancre = F.assemblage?.ancre || relies[0]?.de;
  if (ancre && poses[ancre]) {
    poses[ancre].assemble = true; poses[ancre].ancre = true;
    const file = [ancre];
    while (file.length) {
      const id = file.shift();
      for (const l of relies) {
        const sens = l.de === id ? 1 : l.vers === id ? -1 : 0;
        if (!sens) continue;
        const [pid, pport, cid, cport] = sens > 0 ? [l.de, l.port_de, l.vers, l.port_vers] : [l.vers, l.port_vers, l.de, l.port_de];
        const qp = P[pid].find(q => q.id === pport), qc = P[cid].find(q => q.id === cport);
        const pp = poses[pid];
        const nW = rot(qp.n, pp.rot), pW = versMonde(pp, qp.p);
        let r;
        const horizontal = Math.abs(nW[2]) < 0.9 && Math.abs(qc.n[2]) < 0.9;
        if (horizontal) r = norm360(angle(nW) + 180 - angle(qc.n));
        else r = poses[cid]?.ecrit?.rot ?? 0;
        const pos = sub(add(pW, mul(nW, l.ecart)), rot(qc.p, r));
        const ecrit = poses[cid]?.ecrit || null;
        // Liaison horizontale : l'élément reste posé au sol (sa hauteur écrite, sinon 0) ;
        // l'écart de hauteur entre les deux portes devient un dénivelé à rattraper (connexions.js)
        // (sauf « socle » : l'élément est posé sur un socle de régolithe à la hauteur de la porte du voisin)
        if (horizontal && !E[cid].socle) pos[2] = ecrit ? ecrit.pos[2] : 0;
        if (poses[cid]?.assemble) {
          if (dist(poses[cid].pos, pos) > TOL) erreurs.push(`boucle ${pid}.${pport} → ${cid}.${cport} : les ports ne se rejoignent pas (${dist(poses[cid].pos, pos).toFixed(2)} m)`);
          continue;
        }
        poses[cid] = { pos, rot: r, ecrit, assemble: true };
        file.push(cid);
      }
    }
  } else if (relies.length) erreurs.push(`ancre ${ancre} sans position_m : rien n'est assemblé`);

  // Écart entre ce qui est écrit et ce que donnent les ports
  for (const [id, p] of Object.entries(poses)) {
    if (!p.ecrit) { p.ecart_m = null; continue; }
    p.ecart_m = dist(p.pos, p.ecrit.pos);
    p.ecart_rot = Math.abs(((p.rot - p.ecrit.rot + 540) % 360) - 180);
    if (p.assemble && (p.ecart_m > TOL || p.ecart_rot > 0.5))
      avertissements.push(`${id} : écrit en [${p.ecrit.pos.join(', ')}], les ports le placent en [${p.pos.map(x => +x.toFixed(2)).join(', ')}]`);
  }

  // Ports : libres ou reliés ; compatibilité des écoutilles reliées
  const occupe = {};
  for (const l of relies) {
    occupe[`${l.de}.${l.port_de}`] = `${l.vers}.${l.port_vers}`;
    occupe[`${l.vers}.${l.port_vers}`] = `${l.de}.${l.port_de}`;
    const a = P[l.de].find(q => q.id === l.port_de), b = P[l.vers].find(q => q.id === l.port_vers);
    if (a.diametre != null && b.diametre != null && Math.abs(a.diametre - b.diametre) > 1e-6)
      avertissements.push(`${l.de}.${l.port_de} (Ø ${a.diametre} m) et ${l.vers}.${l.port_vers} (Ø ${b.diametre} m) : écoutilles de tailles différentes`);
    if (a.type !== b.type) avertissements.push(`${l.de}.${l.port_de} (${a.type}) relié à ${l.vers}.${l.port_vers} (${b.type})`);
  }
  for (const id in P) for (const q of P[id]) {
    q.relie_a = occupe[`${id}.${q.id}`] || null;
    if (poses[id]) { q.pW = versMonde(poses[id], q.p); q.nW = rot(q.n, poses[id].rot); }
  }
  const nonRelies = liens.filter(l => !(l.port_de && l.port_vers)).map(l => `${l.de} → ${l.vers}`);
  return { ancre, poses, liens, ports: P, erreurs, avertissements, nonRelies };
}

// Copie de la fiche avec les positions données par les ports (pour les outils qui lisent position_m)
export function ficheAssemblee(F) {
  const A = assembler(F);
  const G = structuredClone(F);
  for (const e of G.elements) {
    const p = A.poses[e.id];
    if (p?.assemble) { e.position_m = p.pos.map(x => +x.toFixed(3)); if (p.rot) e.rotation_deg = +p.rot.toFixed(3); }
  }
  return G;
}

// Ligne de commande
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('assemblage.js')) {
  const fs = await import('node:fs');
  const F = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const A = assembler(F);
  console.log(`Ancre : ${A.ancre}`);
  for (const [id, p] of Object.entries(A.poses)) {
    const etat = !p.assemble ? 'hors ports' : p.ancre ? 'ancre' : (p.ecart_m ?? 0) <= TOL && (p.ecart_rot ?? 0) <= 0.5 ? '✓ suit les ports' : `✗ décalé de ${p.ecart_m.toFixed(2)} m`;
    console.log(`${id.padEnd(4)} [${p.pos.map(x => x.toFixed(2)).join(', ')}] rot ${p.rot.toFixed(0)}°  ${etat}`);
  }
  for (const [id, qs] of Object.entries(A.ports)) for (const q of qs) console.log(`  port ${id}.${q.id} ${q.porte || q.type}${q.diametre != null ? ' Ø ' + q.diametre : ''} → ${q.relie_a || 'libre'}`);
  for (const x of A.nonRelies) console.log(`  liaison sans ports : ${x}`);
  for (const x of A.erreurs) console.log('ERREUR', x);
  for (const x of A.avertissements) console.log('!', x);
}
