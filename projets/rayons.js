// Protection contre les radiations : épaisseur de régolithe traversée dans chaque direction, depuis un point de l'habitat.
// Méthode classique de « distribution d'épaisseurs » : on lance des rayons dans toutes les directions et on mesure la masse
// traversée (g/cm²). Ce n'est PAS une dose : la dose s'obtient en donnant cette distribution à un code de transport
// (OLTARIS, NASA, ou Geant4). Ici, on repère les POINTS FAIBLES de la forme : fente de la fenêtre, bords de butte, sas.
//
// Géométrie lue dans la fiche projet (FORMAT.md) : modules cylindriques horizontaux (axe x), butte de régolithe
// (couverture au-dessus des modules, talus), ouverture « fente » ; horizon lointain lu dans etude/donnees/habitat.json.
// Hypothèses simplificatrices (à garder en tête) : sol local plat sous la butte ; parois des modules ignorées (prudent) ;
// au-delà de la butte, une direction au-dessus de l'horizon du relief est « ouverte », au-dessous elle est « sol ».
//
// Node : node rayons.js fiche.json  →  écrit rayons-<fiche>.json (cartes du ciel de quelques points + plan des points faibles)

const RAD = Math.PI / 180;

export function geometrie(F, rho) {
  const mods = F.elements.filter(e => e.forme && e.forme.type === 'cylindre').map(e => {
    const R = val(e.forme.diametre_m) / 2, L = val(e.forme.longueur_m), [x, y] = e.position_m;
    return { id: e.id, x0: x - L / 2, x1: x + L / 2, y, zc: R, R, hab: !!e.pressurise };
  });
  const hab = mods.filter(m => m.hab);
  const B = F.elements.find(e => e.forme && e.forme.type === 'butte');
  const couv = val(B?.forme.couverture_m ?? F.protection.epaisseur_m), talus = val(B?.forme.talus_deg ?? 35);
  const Rm = Math.max(...hab.map(m => m.R));
  const butte = { xa: Math.min(...hab.map(m => m.x0)), xb: Math.max(...hab.map(m => m.x1)), c: Rm + couv, H: 2 * Rm + couv, tt: Math.tan(talus * RAD) };
  const ouv = F.elements.filter(e => e.type === 'ouverture');
  const fentes = ouv.filter(e => e.forme?.type === 'fente').map(e => ({ o: e.forme.oeil_m, w: e.forme.largeur_oeil_m / 2, h: e.forme.hauteur_oeil_m / 2,
    az: e.forme.az_deg.map(a => Math.tan(a * RAD)), el: e.forme.el_deg.map(a => Math.tan(a * RAD)) }));
  const boites = ouv.filter(e => e.forme?.type === 'boite').map(e => ({ c: e.forme.centre_m, d: e.forme.dim_m.map(x => x / 2) }));
  const azY = val(F.site?.azimut_y_deg) || 0;               // azimut (carte de l'étude) de l'axe +y du projet
  // chapeaux : cônes de régolithe posés sur le dessus de la butte (renfort local, ex. au-dessus d'un périscope)
  const chapeaux = F.elements.filter(e => e.forme?.type === 'chapeau').map(e => ({ c: e.forme.centre_m, r: val(e.forme.rayon_m), h: val(e.forme.hauteur_m) }));
  return { mods, butte, fentes, boites, chapeaux, azY, rho: rho ?? 1.5, couv, talus };
}
const val = x => (x && typeof x === 'object' && 'v' in x) ? x.v : x;

function zTop(G, x, y) {
  const b = G.butte, dx = x < b.xa ? b.xa - x : x > b.xb ? x - b.xb : 0, d = Math.hypot(dx, y);
  let z = d <= b.c ? b.H : Math.max(0, b.H - (d - b.c) * b.tt);
  for (const k of G.chapeaux || []) {
    const r = Math.hypot(x - k.c[0], y - k.c[1]);
    if (r < k.r) z = Math.max(z, b.H + k.h * (1 - r / k.r));
  }
  return z;
}
function dansModule(G, x, y, z) {
  for (const m of G.mods) if (x >= m.x0 && x <= m.x1 && (y - m.y) ** 2 + (z - m.zc) ** 2 <= m.R * m.R) return true;
  return false;
}
function dansFente(G, x, y, z) {            // ouvertures : coins d'air (fentes, de l'œil vers +y) et boîtes d'air (puits, chambres)
  for (const f of G.fentes) {
    const dy = y - f.o[1]; if (dy < 0) continue;
    const du = x - f.o[0], dz = z - f.o[2];
    if (du >= -f.w + dy * f.az[0] && du <= f.w + dy * f.az[1] && dz >= -f.h + dy * f.el[0] && dz <= f.h + dy * f.el[1]) return true;
  }
  for (const b of G.boites)
    if (Math.abs(x - b.c[0]) <= b.d[0] && Math.abs(y - b.c[1]) <= b.d[1] && Math.abs(z - b.c[2]) <= b.d[2]) return true;
  return false;
}

// Azimut d'une direction (dx, dy) compté depuis +y (la Terre), positif vers +x, en degrés 0-360
const azDe = (dx, dy) => ((Math.atan2(dx, dy) / RAD) + 360) % 360;

// Masse surfacique (g/cm²) traversée depuis P dans la direction d ; Infinity = le sol de la Lune
export function traverse(G, P, d, horizon, pas = 0.1) {
  let reg = 0;
  const elev = Math.asin(d[2]) / RAD, h = horizon ? horizon[Math.round(azDe(d[0], d[1]) + G.azY) % 360] : 0;
  for (let t = pas / 2; t < 200; t += pas) {
    const x = P[0] + d[0] * t, y = P[1] + d[1] * t, z = P[2] + d[2] * t;
    const zt = zTop(G, x, y);
    if (zt === 0) return elev > h ? reg * G.rho * 100 : Infinity;   // sorti de la butte
    if (z < 0) return Infinity;                                       // sol sous la butte
    if (z >= zt) {                                                    // au-dessus de la butte : ciel libre
      if (d[2] >= 0) return reg * G.rho * 100;
      continue;                                                       // descend vers le talus
    }
    if (!dansModule(G, x, y, z) && !dansFente(G, x, y, z)) reg += pas;
  }
  return reg * G.rho * 100;
}

export function directions(n) {              // sphère de Fibonacci : n directions d'égal angle solide
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - z * z), a = g * i;
    out.push([r * Math.sin(a), r * Math.cos(a), z]);
  }
  return out;
}

export const CLASSES = [
  { id: 'faible', max: 30, nom: '< 30 g/cm²', note: 'moins que l\'abri éruption solaire (≈ 30 g/cm², Pham & El-Genk 2008)' },
  { id: 'moyen', max: 300, nom: '30 à 300 g/cm²', note: 'abri éruption, en dessous des ≈ 2 m visés pour une longue présence (▨)' },
  { id: 'fort', max: Infinity, nom: '> 300 g/cm²', note: 'au-delà de ≈ 2 m de régolithe à 1,5 g/cm³' },
  { id: 'sol', nom: 'sol lunaire', note: 'la Lune elle-même' },
];
export function classe(v) { return v === Infinity ? 'sol' : CLASSES.find(c => v < c.max).id; }

export function bilan(G, P, dirs, horizon) {
  const n = { faible: 0, moyen: 0, fort: 0, sol: 0 }, vals = [];
  for (const d of dirs) { const v = traverse(G, P, d, horizon); vals.push(v); n[classe(v)]++; }
  const part = Object.fromEntries(Object.entries(n).map(([k, c]) => [k, +(100 * c / dirs.length).toFixed(1)]));
  const finis = vals.filter(v => v !== Infinity);
  return { part, min: finis.length ? +Math.min(...finis).toFixed(0) : null, vals };
}

// --- Dose : de l'épaisseur traversée à des mSv ---
// courbe = regles.hypotheses.dose_gcr.pts : [[g/cm², mSv/jour], ...] pour une demi-sphère d'épaisseur uniforme (MATTHIA2024).
// Approximation par secteurs (◇) : chaque direction du ciel reçoit la dose de la courbe pour SON épaisseur ;
// la dose du point = moyenne sur les directions qui ne sont pas le sol (le sol est déjà compris dans la courbe).
export function doseCourbe(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (t <= pts[i][0]) { const [a, da] = pts[i - 1], [b, db] = pts[i]; return da + (db - da) * (t - a) / (b - a); }
  return pts[pts.length - 1][1];                          // au-delà du dernier point : palier (prudent)
}
export function dosePoint(vals, pts) {
  const ciel = vals.filter(v => v !== Infinity);
  if (!ciel.length) return { mSv_j: 0, min: null };
  const m = ciel.reduce((a, v) => a + doseCourbe(pts, v), 0) / ciel.length;
  return { mSv_j: m, min: Math.min(...ciel) };
}
// Point où l'on évalue un espace : point_m de la fonction, sinon le centre de son élément à 1,5 m du sol
export function pointEspace(F, fn) {
  if (fn.point_m) return fn.point_m;
  let e = F.elements.find(x => x.id === fn.element);
  while (e && !e.position_m && e.dans) e = F.elements.find(x => x.id === e.dans);
  if (!e || !e.position_m) return null;
  const [x, y] = e.position_m, R = e.forme?.type === 'cylindre' ? val(e.forme.diametre_m) / 2 : 0;
  return [x, y, Math.min(1.5, R ? 2 * R - 0.5 : 1.5)];
}

// --- Ligne de commande ---
if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url === new URL('file:///' + process.argv[1].replace(/\\/g, '/')).href) {
  const fs = await import('node:fs'), path = await import('node:path');
  const ici = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const fic = process.argv[2], F = JSON.parse(fs.readFileSync(fic, 'utf8'));
  const R = JSON.parse(fs.readFileSync(path.join(ici, 'regles.json'), 'utf8'));
  const G = geometrie(F, val(R.hypotheses.masse_volumique_regolithe));
  const hab = JSON.parse(fs.readFileSync(path.join(ici, '..', 'etude', 'donnees', 'habitat.json'), 'utf8'));
  const horizon = hab.horizon.h;
  const t0 = Date.now();

  // 1) cartes du ciel de quelques points
  const f = F.elements.find(e => e.type === 'ouverture' && e.forme?.type === 'fente')?.forme;
  const P1 = F.elements.find(e => e.id === 'P1')?.forme;
  const points = [
    ...(P1 ? [{ nom: 'sous le périscope', P: [P1.centre_m[0], P1.centre_m[1], 1.7] }] : []),
    ...G.mods.filter(m => m.hab).map(m => ({ nom: `centre de ${m.id}`, P: [(m.x0 + m.x1) / 2, m.y, 1.5] })),
    ...(f && !P1 ? [{ nom: 'devant la fenêtre-Terre', P: f.oeil_m }] : []),
    ...G.mods.filter(m => m.hab).slice(0, 1).map(m => ({ nom: `bout ouest de ${m.id}`, P: [m.x0 + 0.8, m.y, 1.5] })),
  ];
  const D = directions(3000);
  const ciel = points.map(p => {
    const b = bilan(G, p.P, D, horizon);
    return { nom: p.nom, P: p.P, part: b.part, min: b.min,
      v: b.vals.map(v => v === Infinity ? -1 : Math.round(v)) };
  });

  // 2) plan : part du ciel « faible » en chaque point à 1,5 m du sol, maille de 1 m
  const d2 = directions(600), plan = [];
  for (const m of G.mods.filter(m => m.hab))
    for (let x = m.x0 + 0.5; x < m.x1; x += 1)
      for (let y = m.y - m.R + 0.5; y < m.y + m.R; y += 1) {
        if ((y - m.y) ** 2 + (1.5 - m.zc) ** 2 > m.R ** 2) continue;
        const b = bilan(G, [x, y, 1.5], d2, horizon);
        plan.push([+x.toFixed(1), +y.toFixed(1), b.part.faible, b.part.moyen, b.min]);
      }

  // 3) dose de chaque espace du programme (fonctions) : mSv/jour si l'on y restait 24 h, et mSv/heure
  const pts = R.hypotheses.dose_gcr.pts, abri = val(R.hypotheses.abri_eruption_g_cm2);
  const zones = (F.programme.fonctions || []).map(fn => {
    const P = pointEspace(F, fn);
    if (!P) return { id: fn.id, nom: fn.nom, element: fn.element, erreur: 'pas de position' };
    const b = bilan(G, P, D, horizon), d = dosePoint(b.vals, pts);
    return { id: fn.id, nom: fn.nom, element: fn.element, P, mSv_j: +d.mSv_j.toFixed(3), mSv_h: +(d.mSv_j / 24).toFixed(4),
      min_g_cm2: d.min == null ? null : Math.round(d.min), abri_eruption: d.min != null && d.min >= abri };
  });
  for (const z of zones) console.log(`${(z.nom || z.id).padEnd(34)} ${z.mSv_h} mSv/h  (${z.mSv_j} mSv/j)  min ${z.min_g_cm2} g/cm²  abri ${z.abri_eruption ? 'oui' : 'non'}`);

  const out = { fiche: path.basename(fic), date: new Date().toISOString().slice(0, 10), zones,
    methode: 'distribution d\'épaisseurs par lancer de rayons (pas de 10 cm), masse volumique ' + G.rho + ' g/cm³ ; parois ignorées ; pas une dose',
    butte: G.butte, couverture_m: G.couv, talus_deg: G.talus, classes: CLASSES.map(({ max, ...c }) => c),
    directions: D.map(d => d.map(x => +x.toFixed(4))), ciel, plan, colonnes_plan: ['x', 'y', '% faible', '% moyen', 'min g/cm²'] };
  const sortie = path.join(path.dirname(fic), 'rayons-' + path.basename(fic));
  fs.writeFileSync(sortie, JSON.stringify(out));
  for (const c of ciel) console.log(`${c.nom.padEnd(26)} faible ${c.part.faible}%  moyen ${c.part.moyen}%  fort ${c.part.fort}%  sol ${c.part.sol}%  min ${c.min} g/cm²`);
  const pires = plan.slice().sort((a, b) => b[2] - a[2]).slice(0, 3);
  console.log('plan :', plan.length, 'points ; pires (x, y, % faible) :', pires.map(p => p.slice(0, 3).join(' ')).join(' | '));
  console.log('écrit', sortie, ((Date.now() - t0) / 1000).toFixed(1), 's');
}
