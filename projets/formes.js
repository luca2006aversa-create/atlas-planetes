// Catalogue des formes d'éléments Kibsu : enveloppe, volume, coupe horizontale (surface du sol à une hauteur), niveaux.
// Chaque forme est décrite dans son propre repère : origine au centre, posée au sol (z = 0), axe des cylindres couchés selon x.
// Sur la Lune il y a une gravité : on vit sur des planchers plats. La surface utile d'un niveau dépend donc de la largeur
// de la forme à la hauteur du plancher, et de la hauteur sous plafond au-dessus.
// Ce fichier n'importe rien : controle.js, assemblage.js et atelier.html s'en servent.

export const val = x => (x && typeof x === 'object' && 'v' in x) ? x.v : x;

// Hypothèses de dessin (▨ : à sourcer, à remplacer par des valeurs lues dans les normes)
export const HYP = {
  hauteur_debout_m: { v: 2.0, s: '▨', src: "hauteur libre pour se tenir debout : hypothèse de dessin, à sourcer (NASA HIDH, chapitre architecture)" },
  epaisseur_plancher_m: { v: 0.2, s: '▨', src: 'épaisseur de plancher et réseaux : hypothèse de dessin' },
};

// Le catalogue : nom, champs de dimension (avec valeur par défaut), et ce que la forme apporte
export const CATALOGUE = {
  cylindre:  { nom: 'Cylindre', champs: { diametre_m: 4.5, longueur_m: 8 }, axe: true,
               note: "Couché : un seul plancher, l'espace dessous sert aux réseaux. Debout : plusieurs étages, plancher plein." },
  capsule:   { nom: 'Gonflable vertical', champs: { diametre_m: 6, hauteur_m: 9 },
               note: 'Cylindre debout à fonds bombés ; arrive plié, se gonfle. Plusieurs niveaux (ex. Moon Village, SOM/ESA).' },
  dome:      { nom: 'Dôme', champs: { diametre_m: 8 },
               note: 'Demi-sphère : grand sol, bords bas ; une mezzanine au centre.' },
  sphere:    { nom: 'Sphère', champs: { diametre_m: 6 },
               note: 'Forme la plus légère pour une pression donnée ; sol étroit en bas et en haut.' },
  voute:     { nom: 'Voûte en régolithe', champs: { largeur_m: 8, hauteur_m: 5, longueur_m: 12 },
               note: "Arc parabolique imprimé sur place ; pour être pressurisé, il lui faut une poche ou un revêtement étanche dedans." },
  tore:      { nom: 'Tore (anneau)', champs: { diametre_m: 3, diametre_anneau_m: 20 },
               note: "Anneau : un couloir qui fait le tour, un patio au centre. diametre_m = tube, diametre_anneau_m = ligne médiane." },
  boite:     { nom: 'Boîte', champs: { longueur_m: 6, largeur_m: 4, hauteur_m: 3 },
               note: 'Murs plats : simple à aménager, mais lourde sous pression. Plutôt pour un élément non pressurisé.' },
  noeud:     { nom: 'Nœud de jonction', champs: { diametre_m: 3, hauteur_m: 3 },
               note: "Petit cylindre debout à plusieurs ports : il fait partir les modules dans plusieurs directions." },
};

const PI = Math.PI;
const racine = x => Math.sqrt(Math.max(0, x));

// Demi-tailles de l'enveloppe : x, y (plan) et h (hauteur)
export function enveloppe(f) {
  if (!f) return null;
  const d = val(f.diametre_m), L = val(f.longueur_m), h = val(f.hauteur_m), l = val(f.largeur_m);
  switch (f.type) {
    case 'cylindre': return f.axe === 'vertical' ? { x: d / 2, y: d / 2, h: L } : { x: L / 2, y: d / 2, h: d };
    case 'capsule': case 'noeud': return { x: d / 2, y: d / 2, h };
    case 'dome': return { x: d / 2, y: d / 2, h: d / 2 };
    case 'sphere': return { x: d / 2, y: d / 2, h: d };
    case 'voute': return { x: L / 2, y: l / 2, h };
    case 'tore': { const R = val(f.diametre_anneau_m) / 2; return { x: R + d / 2, y: R + d / 2, h: d }; }
    case 'boite': return f.dim_m ? { x: f.dim_m[0] / 2, y: f.dim_m[1] / 2, h: f.dim_m[2] } : { x: L / 2, y: l / 2, h };
    case 'chapeau': return { x: val(f.rayon_m), y: val(f.rayon_m), h };
    default: return null;
  }
}

// Coupe horizontale à la hauteur z : { aire (m²), forme: 'rect' | 'disque' | 'anneau', a, b } (a, b : demi-tailles ou rayons)
export function coupe(f, z) {
  if (!f) return null;
  const d = val(f.diametre_m), L = val(f.longueur_m), h = val(f.hauteur_m), l = val(f.largeur_m), r = d / 2;
  const vide = { aire: 0, forme: 'rect', a: 0, b: 0 };
  switch (f.type) {
    case 'cylindre':
      if (f.axe === 'vertical') return z < 0 || z > L ? vide : { aire: PI * r * r, forme: 'disque', a: r };
      { const w = racine(r * r - (z - r) ** 2); return { aire: L * 2 * w, forme: 'rect', a: L / 2, b: w }; }
    case 'noeud': return z < 0 || z > h ? vide : { aire: PI * r * r, forme: 'disque', a: r };
    case 'capsule': {
      if (z < 0 || z > h) return vide;
      const rr = z < r ? racine(r * r - (r - z) ** 2) : z > h - r ? racine(r * r - (z - (h - r)) ** 2) : r;
      return { aire: PI * rr * rr, forme: 'disque', a: rr };
    }
    case 'dome': { const rr = racine(r * r - z * z); return { aire: PI * rr * rr, forme: 'disque', a: rr }; }
    case 'sphere': { const rr = racine(r * r - (z - r) ** 2); return { aire: PI * rr * rr, forme: 'disque', a: rr }; }
    case 'voute': { if (z < 0 || z > h) return vide; const w = l / 2 * racine(1 - z / h); return { aire: L * 2 * w, forme: 'rect', a: L / 2, b: w }; }
    case 'tore': {
      const R = val(f.diametre_anneau_m) / 2, w = racine(r * r - (z - r) ** 2);
      return { aire: 4 * PI * R * w, forme: 'anneau', a: R - w, b: R + w };
    }
    case 'boite': { const e = enveloppe(f); return z < 0 || z > e.h ? vide : { aire: 4 * e.x * e.y, forme: 'rect', a: e.x, b: e.y }; }
    default: return null;
  }
}

// Volume : formule exacte quand elle est simple, sinon somme des coupes
export function volume(f) {
  if (!f) return null;
  const d = val(f.diametre_m), L = val(f.longueur_m), h = val(f.hauteur_m), l = val(f.largeur_m), r = d / 2;
  switch (f.type) {
    case 'cylindre': return PI * r * r * L;
    case 'noeud': return PI * r * r * h;
    case 'capsule': return PI * r * r * Math.max(0, h - d) + 4 / 3 * PI * r ** 3;
    case 'sphere': return PI * d ** 3 / 6;
    case 'dome': return PI * d ** 3 / 12;
    case 'voute': return 2 / 3 * l * h * L;                          // aire d'un arc parabolique = 2/3 × base × hauteur
    case 'tore': return 2 * PI * PI * (val(f.diametre_anneau_m) / 2) * r * r;
    case 'boite': { const e = enveloppe(f); return e ? 4 * e.x * e.y * e.h : null; }
    default: return null;
  }
}

// Hauteur du plafond au-dessus d'un point du plancher central (pour un niveau à z)
function plafondCentre(f, z) {
  const e = enveloppe(f); if (!e) return null;
  if (f.type === 'tore') return val(f.diametre_m);
  return e.h;
}

// Niveaux d'un élément : surface de plancher, surface où l'on tient debout, hauteur sous plafond
// niveaux : [{ id, z_m, fonction?, nom? }] ; sans niveaux : un seul plancher à z = 0 (ou au plancher par défaut du cylindre couché)
export function niveaux(e, H = HYP) {
  const f = e.forme; if (!f || !enveloppe(f)) return [];
  const debout = val(H.hauteur_debout_m), ep = val(H.epaisseur_plancher_m);
  let N = (e.niveaux || []).map(n => ({ ...n, z: val(n.z_m) })).sort((a, b) => a.z - b.z);
  if (!N.length) N = [{ id: 'N1', z: plancherParDefaut(f), implicite: true }];
  const haut = plafondCentre(f, 0);
  return N.map((n, i) => {
    const plafond = i + 1 < N.length ? N[i + 1].z - ep : haut;
    const libre = plafond - n.z;
    const c = coupe(f, n.z), cd = coupe(f, Math.min(n.z + debout, plafond));
    const deboutAire = libre >= debout ? Math.min(c.aire, cd.aire) : 0;
    return { ...n, plafond, hauteur_libre: libre, aire: c.aire, aire_debout: deboutAire, coupe: c };
  });
}

// Plancher d'un cylindre couché : là où sa largeur est la plus utile avec une hauteur debout au-dessus
export function plancherParDefaut(f) {
  if (f.type === 'cylindre' && f.axe !== 'vertical') {
    const r = val(f.diametre_m) / 2, deb = val(HYP.hauteur_debout_m);
    return Math.max(0, +(r - deb / 2).toFixed(2));                 // plancher et plafond symétriques autour de l'axe
  }
  if (f.type === 'capsule') { const r = val(f.diametre_m) / 2; return +(r * (1 - Math.sqrt(1 - 0.81))).toFixed(2); }   // sol à 90 % du diamètre
  if (f.type === 'sphere') { const r = val(f.diametre_m) / 2; return Math.max(0, +(r - val(HYP.hauteur_debout_m) / 2).toFixed(2)); }
  if (f.type === 'tore') { const r = val(f.diametre_m) / 2; return Math.max(0, +(r - val(HYP.hauteur_debout_m) / 2).toFixed(2)); }
  return 0;
}

// Forme par défaut quand on change de type, en gardant à peu près la taille de l'ancienne
export function changerType(f, type) {
  const C = CATALOGUE[type]; if (!C) return f;
  const e = enveloppe(f) || { x: 3, y: 3, h: 3 };
  const g = { type };
  for (const [k, def] of Object.entries(C.champs)) g[k] = { v: def, s: '▨', src: "valeur de départ de l'atelier" };
  const big = Math.max(e.x, e.y) * 2;
  const set = (k, v) => { if (g[k]) g[k].v = +v.toFixed(1); };
  if (type === 'cylindre') { set('diametre_m', Math.min(2 * e.y, 8)); set('longueur_m', 2 * e.x); g.axe = 'horizontal'; }
  if (type === 'capsule') { const d = Math.min(big, 8); set('diametre_m', d); set('hauteur_m', Math.max(e.h, d * 1.5)); }
  if (type === 'noeud') { set('diametre_m', Math.min(big, 4)); set('hauteur_m', Math.max(e.h, 3)); }
  if (type === 'dome' || type === 'sphere') set('diametre_m', big);
  if (type === 'voute') { set('largeur_m', 2 * e.y); set('longueur_m', 2 * e.x); set('hauteur_m', Math.max(3, e.h)); }
  if (type === 'boite') { set('longueur_m', 2 * e.x); set('largeur_m', 2 * e.y); set('hauteur_m', Math.max(2.5, e.h)); }
  return g;
}
