// Le ciel vu depuis un point de la Lune : Soleil, Terre, planètes (et étoiles si un catalogue est fourni).
// Directions en azimut / hauteur locales. Azimut compté depuis le haut de la carte de l'étude (direction de la
// longitude 0, donc de la Terre en moyenne), positif vers la droite de la carte (90° E).
//
// Sources des formules (précision visée : quelques dixièmes de degré, assez pour voir où sont les astres) :
//  - orientation de la Lune : modèle IAU/WGCCRE (pôle α0, δ0 et méridien W, termes périodiques principaux) ;
//  - position de la Lune autour de la Terre : série tronquée (Meeus, Astronomical Algorithms, ch. 47, termes principaux) ;
//  - planètes et Terre : positions héliocentriques écliptiques J2000 de l'atlas (donnees/planetes.json).
// Les libration et nutation fines ne sont pas toutes modélisées : ◇ calcul simplifié.

const RAD = Math.PI / 180, UA_KM = 149597870.7, OBL = 23.4392911 * RAD;
const s = x => Math.sin(x * RAD), c = x => Math.cos(x * RAD);

export const jourJ2000 = date => (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;

// Lune géocentrique, écliptique J2000 (UA)
export function luneGeo(d) {
  const T = d / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T, F = 93.2720950 + 483202.0175233 * T;
  let lon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp)
    - 0.185116 * s(M) - 0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp)
    + 0.053322 * s(2 * D + Mp) + 0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.034720 * s(D) - 0.030383 * s(M + Mp);
  const lat = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) + 0.173237 * s(2 * D - F)
    + 0.055413 * s(2 * D - Mp + F) + 0.046271 * s(2 * D - Mp - F) + 0.032573 * s(2 * D + F);
  const dist = 385000.56 - 20905.355 * c(Mp) - 3699.111 * c(2 * D - Mp) - 2955.968 * c(2 * D) - 569.925 * c(2 * Mp);
  lon -= 1.3969713 * T;                                    // de l'équinoxe de la date vers J2000 (précession)
  const r = dist / UA_KM;
  return [r * c(lat) * c(lon), r * c(lat) * s(lon), r * s(lat)];
}

// Écliptique J2000 → équatorial J2000 (ICRF)
const versEq = ([x, y, z]) => [x, y * Math.cos(OBL) - z * Math.sin(OBL), y * Math.sin(OBL) + z * Math.cos(OBL)];

// Orientation IAU de la Lune : matrice ICRF → repère lunaire (z = pôle nord, x = longitude 0)
export function iauLune(d) {
  const T = d / 36525;
  const E1 = 125.045 - 0.0529921 * d, E2 = 250.089 - 0.1059842 * d, E3 = 260.008 + 13.0120009 * d,
    E4 = 176.625 + 13.3407154 * d, E5 = 357.529 + 0.9856003 * d, E6 = 311.589 + 26.4057084 * d,
    E7 = 134.963 + 13.0649930 * d, E8 = 276.617 + 0.3287146 * d, E9 = 34.226 + 1.7484877 * d,
    E10 = 15.134 - 0.1589763 * d, E11 = 119.743 + 0.0036096 * d, E12 = 239.961 + 0.1643573 * d, E13 = 25.053 + 12.9590088 * d;
  const a0 = 269.9949 + 0.0031 * T - 3.8787 * s(E1) - 0.1204 * s(E2) + 0.0700 * s(E3) - 0.0172 * s(E4)
    + 0.0072 * s(E6) - 0.0052 * s(E10) + 0.0043 * s(E13);
  const d0 = 66.5392 + 0.0130 * T + 1.5419 * c(E1) + 0.0239 * c(E2) - 0.0278 * c(E3) + 0.0068 * c(E4)
    - 0.0029 * c(E6) + 0.0009 * c(E7) + 0.0008 * c(E10) - 0.0009 * c(E13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * s(E1) + 0.1208 * s(E2) - 0.0642 * s(E3)
    + 0.0158 * s(E4) + 0.0252 * s(E5) - 0.0066 * s(E6) - 0.0047 * s(E7) - 0.0046 * s(E8) + 0.0028 * s(E9)
    + 0.0052 * s(E10) + 0.0040 * s(E11) + 0.0019 * s(E12) - 0.0044 * s(E13);
  // M = Rz(W) · Rx(90° − δ0) · Rz(90° + α0)
  const rz = (t) => [[c(t), s(t), 0], [-s(t), c(t), 0], [0, 0, 1]];
  const rx = (t) => [[1, 0, 0], [0, c(t), s(t)], [0, -s(t), c(t)]];
  const mul = (A, B) => A.map(l => [0, 1, 2].map(j => l[0] * B[0][j] + l[1] * B[1][j] + l[2] * B[2][j]));
  return mul(rz(W), mul(rx(90 - d0), rz(90 + a0)));
}
const app = (M, v) => M.map(l => l[0] * v[0] + l[1] * v[1] + l[2] * v[2]);

// Repère local au point (lat, lon) : droite de la carte (R), haut de la carte (T), vertical (U), dans le repère lunaire
export function repereLocal(lat, lon) {
  const U = [c(lat) * c(lon), c(lat) * s(lon), s(lat)];
  const proj = v => { const k = v[0] * U[0] + v[1] * U[1] + v[2] * U[2]; const w = v.map((x, i) => x - k * U[i]); const n = Math.hypot(...w); return w.map(x => x / n); };
  const T = proj([1, 0, 0]);                               // vers la longitude 0 (haut de la carte au pôle sud)
  const R = [T[1] * U[2] - T[2] * U[1], T[2] * U[0] - T[0] * U[2], T[0] * U[1] - T[1] * U[0]];   // T × U = droite
  return { R, T, U };
}

export function azHaut(v, L) {
  const n = Math.hypot(...v), d = v.map(x => x / n);
  const r = d[0] * L.R[0] + d[1] * L.R[1] + d[2] * L.R[2], t = d[0] * L.T[0] + d[1] * L.T[1] + d[2] * L.T[2];
  const u = d[0] * L.U[0] + d[1] * L.U[1] + d[2] * L.U[2];
  return { az: ((Math.atan2(r, t) / RAD) + 360) % 360, h: Math.asin(Math.max(-1, Math.min(1, u))) / RAD };
}

// Position héliocentrique (UA, écliptique J2000) interpolée dans une série [[jour, x, y, z], ...]
export function interp(pts, d) {
  const p0 = pts[0][0], pas = pts[1][0] - p0, i = Math.max(0, Math.min(pts.length - 2, Math.floor((d - p0) / pas)));
  const f = (d - pts[i][0]) / pas;
  return [1, 2, 3].map(k => pts[i][k] + f * (pts[i + 1][k] - pts[i][k]));
}

// Tous les astres à la date d (jours depuis J2000) vus du point (lat, lon). planetes = { terre: pts, mars: pts, ... }
export function astres(d, lat, lon, planetes) {
  const M = iauLune(d), L = repereLocal(lat, lon);
  const terre = interp(planetes.terre, d), lune = luneGeo(d);
  const ici = terre.map((x, i) => x + lune[i]);            // la Lune, héliocentrique
  const vu = v => azHaut(app(M, versEq(v)), L);
  const out = { soleil: { ...vu(ici.map(x => -x)), dist_ua: Math.hypot(...ici) },
                terre: { ...vu(lune.map(x => -x)), dist_ua: Math.hypot(...lune) } };
  for (const [k, pts] of Object.entries(planetes)) {
    if (k === 'terre') continue;
    const p = interp(pts, d), v = p.map((x, i) => x - ici[i]);
    out[k] = { ...vu(v), dist_ua: Math.hypot(...v) };
  }
  return out;
}

// Étoile (ascension droite, déclinaison en degrés, ICRF) → az / hauteur
export function etoile(ra, dec, d, lat, lon, M = iauLune(d), L = repereLocal(lat, lon)) {
  return azHaut(app(M, [c(dec) * c(ra), c(dec) * s(ra), s(dec)]), L);
}

// Décodage du format compact de planetes.json (identique à app.js)
export function depaqueter(o) {
  if (!o || !o.s) return o;
  const sortie = {};
  for (const [cle, e] of Object.entries(o.s)) {
    const bin = atob(e.d), oct = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) oct[i] = bin.charCodeAt(i);
    const dd = e.w === 4 ? new Int32Array(oct.buffer) : new Int16Array(oct.buffer);
    let [x, y, z] = e.x0;
    const pts = new Array(e.n);
    pts[0] = [e.j0, x / e.q, y / e.q, z / e.q];
    for (let i = 1; i < e.n; i++) { x += dd[3 * i - 3]; y += dd[3 * i - 2]; z += dd[3 * i - 1]; pts[i] = [e.j0 + e.pas * i, x / e.q, y / e.q, z / e.q]; }
    sortie[cle] = pts;
  }
  return sortie;
}
