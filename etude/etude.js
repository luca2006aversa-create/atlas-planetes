// Étude « Choisir un site au pôle sud de la Lune » : carte fixe pilotée par le défilement.
// Carte en coordonnées planes (km depuis le pôle, projection polaire stéréographique du MNT LOLA) :
// x vers 90° E (droite), y vers la longitude 0 (haut). Leaflet : latLng(y, x).
import { ARTEMIS, VISITES } from './formations.js';

const R = 1737.4;
const versXY = (lat, lon) => {
  const rho = 2 * R * Math.tan(((90 + lat) * Math.PI) / 360), a = (lon * Math.PI) / 180;
  return [rho * Math.sin(a), rho * Math.cos(a)];
};
const rhoDe = (lat) => 2 * R * Math.tan(((90 + lat) * Math.PI) / 360);
const LL = ([x, y]) => L.latLng(y, x);
const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const latTxt = (la, lo) => `${fr(Math.abs(la), 2)}° S, ${fr(Math.abs(lo), 2)}° ${lo < 0 ? 'O' : 'E'}`;

const [meta, uai, large, plan, hab, prox, cplan] = await Promise.all(['etude.json', 'formations.json', 'large.json', 'plan.json', 'habitat.json', 'proximite.json', 'courbes_plan.json']
  .map((f) => fetch(`donnees/${f}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
const FORMATIONS = uai?.formations || [];
const D = meta.demi_km, BANDE = meta.bande_km;
const BORNES = L.latLngBounds([[-D, -D], [D, D]]);
const CADRES = {
  tout: BORNES,
  fiable: L.latLngBounds([[-D + BANDE, -D + BANDE], [D - BANDE, D - BANDE]]),
  large: L.latLngBounds([[-245, -245], [245, 245]]),
};

// --- chiffres dans le texte ---
const c = meta.chiffres;
const CHIFFRES = {
  ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, fr(v, Number.isInteger(v) ? 0 : 1)])),
  alt_min_km: fr(c.alt_min_m / 1000, 1).replace('-', '−'),
  alt_max_km: '+' + fr(c.alt_max_m / 1000, 1),
  denivele_km: fr((c.alt_max_m - c.alt_min_m) / 1000, 1),
  nb_lieux: fr(meta.nb_lieux),
  plus_grand_ha: fr(meta.lieux[0].ha),
};
const k = large?.comparaison;
if (k) Object.assign(CHIFFRES, {
  c_corr_sol: fr(k.correlation_soleil, 2), c_ecart_sol: fr(k.ecart_absolu_moyen_soleil_pts, 1),
  c_ombre_nous: fr(k.ombre_nous_km2), c_ombre_off: fr(k.ombre_officiel_km2), c_recouv: fr(k.ombre_recouvrement * 100),
  c_corr_ter: fr(k.correlation_terre, 2), c_max_nous: fr(k.soleil_max_nous), c_max_off: fr(k.soleil_max_officiel),
});
document.querySelectorAll('[data-chiffre]').forEach((e) => {
  if (CHIFFRES[e.dataset.chiffre] != null) e.textContent = CHIFFRES[e.dataset.chiffre];
});

// --- carte ---
// fond complet à 240 m (±457 km, tout le MNT à 120 m) sous les images fines : plus de vide ni de bord carré
const FOND = 457.44, BORNES_TOUT = L.latLngBounds([[-FOND, -FOND], [FOND, FOND]]);
const carte = L.map('carte', { crs: L.CRS.Simple, minZoom: -1.5, maxZoom: 11.5, zoomSnap: 0.25, zoomDelta: 0.5,
  maxBounds: BORNES_TOUT, maxBoundsViscosity: 1, zoomControl: false });
// on ne peut pas s'éloigner au point de voir le vide autour du fond complet
const minZoomFond = () => carte.setMinZoom(carte.getBoundsZoom(BORNES_TOUT, true));
carte.on('resize', minZoomFond);
minZoomFond();
L.control.zoom({ position: 'topright' }).addTo(carte);
carte.attributionControl.setPrefix(false)
  .addAttribution('Relief : NASA/GSFC, LRO LOLA · calculs : Atlas planètes · noms : UAI/USGS');
carte.createPane('vecteurs').style.zIndex = 450;
const svg = L.svg({ pane: 'vecteurs' });

const img = (f, o = {}) => L.imageOverlay(`donnees/${f}`, BORNES, o);
const groupe = (...cs) => { const g = L.layerGroup(cs); g._urls = cs.map((c) => c._url).filter(Boolean); return g; };
const traitCourbe = (c, fort) => L.polyline(c.pts.map(LL), { renderer: svg, color: '#5b5443', weight: c.z % fort === 0 ? 1.1 : 0.5, opacity: 0.8, interactive: false });
const courbesPlan = L.layerGroup(cplan ? cplan.courbes.map((c) => traitCourbe(c, cplan.indice_m)) : []);
// courbes de tout le MNT : chargées à la première activation (fichier de 1,8 Mo)
const courbesTout = L.layerGroup();
courbesTout.once('add', () => fetch('donnees/courbes_tout.json').then((r) => r.json())
  .then((j) => j.courbes.forEach((c) => courbesTout.addLayer(traitCourbe(c, j.indice_m)))).catch(() => {}));
const degrade = (cs) => `linear-gradient(90deg, ${cs.join(',')})`;

const lieux = L.layerGroup(meta.lieux.map((l, i) => L.circleMarker(LL([l.x, l.y]), {
  renderer: svg, radius: 3 + Math.sqrt(l.ha) * 1.2, color: '#1d2433', weight: 1.2,
  fillColor: l.terre >= 50 ? '#e4572e' : '#f2b38f', fillOpacity: 0.9,
}).bindPopup(`<b>Îlot ${i + 1}</b> · ${fr(l.ha, 1)} ha<br>pente moyenne ${fr(l.pente, 1)}°<br>
  soleil : ${l.soleil_moy} % du temps en moyenne, ${l.soleil} % au mieux<br>
  Terre visible : ${l.terre} % du temps<br>ombre permanente (&gt; 1 km²) à ${fr(l.ombre_km, 1)} km<br>
  <span style="color:#6b7280">${latTxt(l.lat, l.lon)}</span>`)));

const berges = L.layerGroup(meta.lieux.flatMap((l) => [
  L.polyline([LL(l.berge.slice(0, 2)), LL(l.berge.slice(2))], { renderer: svg, color: '#1d2433', weight: 1.4, dashArray: '4 3' }),
  L.circleMarker(LL(l.berge.slice(2)), { renderer: svg, radius: 2.5, color: '#3d6b8c', fillColor: '#7fb6d9', fillOpacity: 1, weight: 1 }),
]));

const etiquette = (pos, html, cls = '') => L.tooltip({ permanent: true, direction: 'center', className: `etiq ${cls}`, interactive: false })
  .setLatLng(LL(pos)).setContent(html);
// noms de près : tout ce qui tombe dans le cadre détaillé ; noms de loin : les grandes formations
const dansCadre = (f) => { const [x, y] = versXY(f.lat, f.lon); return Math.abs(x) < D - 3 && Math.abs(y) < D - 3; };
const noms = L.layerGroup([
  etiquette([0, 0], '+ pôle sud', 'pole'),
  ...FORMATIONS.filter((f) => dansCadre(f) && f.diam >= 4).map((f) => etiquette(versXY(f.lat, f.lon), f.nom)),
]);
const nomsLarges = L.layerGroup([
  etiquette([0, 0], '+', 'pole'),
  ...FORMATIONS.filter((f) => (f.diam >= 40 || f.type === 'Mons') && !ARTEMIS.some((a) => a.formation === f.nom))
    .map((f) => etiquette(versXY(f.lat, f.lon), f.nom, 'loin')),
]);
const visites = L.layerGroup(VISITES.flatMap((v) => [
  L.circleMarker(LL(versXY(v.lat, v.lon)), { renderer: svg, radius: 4, color: '#1d2433', weight: 1.5, fillColor: '#ffb000', fillOpacity: 1 })
    .bindPopup(`<b>${v.nom}</b><br>${latTxt(v.lat, v.lon)}<br><span style="color:#6b7280">${v.note}</span>`),
  L.tooltip({ permanent: true, direction: 'left', offset: [-6, 0], className: 'etiq visite' }).setLatLng(LL(versXY(v.lat, v.lon))).setContent(v.nom),
]));

const parFormation = {};
ARTEMIS.forEach((a) => (parFormation[a.formation] ||= []).push(a.region));
const artemis = L.layerGroup(Object.entries(parFormation).flatMap(([nom, regions]) => {
  const f = FORMATIONS.find((g) => g.nom === nom);
  if (!f || f.lat == null) return [];
  const p = versXY(f.lat, f.lon);
  return [
    L.circleMarker(LL(p), { renderer: svg, radius: 5, color: '#fff', weight: 2, fillColor: '#1d2433', fillOpacity: 1 }),
    L.tooltip({ permanent: true, direction: 'right', offset: [8, 0], className: 'etiq artemis' })
      .setLatLng(LL(p)).setContent(`${regions.join('<br>')}<br><small>sur ${nom}</small>`),
  ];
}));

const graticule = L.layerGroup([
  ...[-89, -88, -87, -86, -85, -84, -83].map((la) => L.circle(L.latLng(0, 0), { renderer: svg, radius: rhoDe(la), color: '#c9c3b4',
    weight: 0.8, fill: false, opacity: 0.7, interactive: false })),
  ...[-89, -87, -85, -83].map((la) => etiquette([0, -rhoDe(la)], `${Math.abs(la)}° S`)),
  ...Array.from({ length: 12 }, (_, k) => k * 30).map((lo) => L.polyline([LL([0, 0]), LL(versXY(-82.6, lo))],
    { renderer: svg, color: '#c9c3b4', weight: 0.6, opacity: 0.6, interactive: false })),
  ...[0, 90, 180, -90].map((lo) => etiquette(versXY(-82.3, lo),
    lo === 0 ? '0° · face visible, vers la Terre' : lo === 180 ? '180° · face cachée' : `${Math.abs(lo)}° ${lo < 0 ? 'O' : 'E'}`)),
  L.rectangle(BORNES, { renderer: svg, color: '#e4572e', weight: 1, fill: false, dashArray: '5 4', interactive: false }),
  etiquette([0, D + 6], 'cadre détaillé de l\'étude (MNT 20 m)'),
]);

// --- plan d'implantation (bord ouest de Shackleton) ---
const ficheHTML = (titre, f, plus = '') => `<b>${titre}</b><br>altitude ${fr(f.alt)} m · pente ${fr(f.pente, 1)}°<br>
  soleil : ${f.soleil} % du temps au sol, ${f.soleil_mat} % en haut d'un mât de ${plan.mat_m} m<br>
  Terre visible : ${f.terre} % au sol, ${f.terre_mat} % à ${plan.mat_m} m${plus}<br>
  <span style="color:#6b7280">${latTxt(f.lat, f.lon)}</span>`;
let planCouche = L.layerGroup(), planBornes = BORNES;
if (plan) {
  const [px0, py0, px1, py1] = plan.cadre_km;
  planBornes = L.latLngBounds([[py0, px0], [py1, px1]]);
  const elt = (f, html, style, etiq, dir = 'right') => [
    L.circleMarker(LL(f.xy), { renderer: svg, ...style }).bindPopup(html),
    ...(etiq ? [L.tooltip({ permanent: true, direction: dir, offset: [dir === 'left' ? -8 : 8, 0], className: 'etiq plan' })
      .setLatLng(LL(f.xy)).setContent(etiq)] : []),
  ];
  const ra = plan.routes.atterrissage, rg = plan.routes.glace;
  planCouche = L.layerGroup([
    L.polyline(plan.coupe.trait.map(LL), { renderer: svg, color: '#e4572e', weight: 1.2, dashArray: '6 4', interactive: false }),
    L.tooltip({ permanent: true, direction: 'center', className: 'etiq' }).setLatLng(LL(plan.coupe.trait[1])).setContent('coupe → fond de Shackleton'),
    L.circle(LL(plan.atterrissage.xy), { renderer: svg, radius: plan.distances_km.habitat_atterrissage, color: '#1d2433',
      weight: 1, dashArray: '2 5', fill: false, interactive: false }),
    L.polyline(ra.pts.map(LL), { renderer: svg, color: '#1d2433', weight: 3, opacity: 0.85 })
      .bindPopup(`<b>Route de l'aire d'atterrissage</b><br>${fr(ra.km, 1)} km · pente max ${fr(ra.pente_max, 1)}° · dénivelé ${fr(ra.denivele)} m`),
    L.polyline(rg.pts.map(LL), { renderer: svg, color: '#3d6b8c', weight: 3, opacity: 0.95 })
      .bindPopup(`<b>Route de la glace</b><br>${fr(rg.km, 1)} km · pente max ${fr(rg.pente_max, 1)}° · dénivelé ${fr(rg.denivele)} m`),
    ...plan.mats.flatMap((m, i) => elt(m, ficheHTML(`Mât solaire ${i + 1}`, m),
      { radius: 4, color: '#1d2433', weight: 1, fillColor: '#f2d98d', fillOpacity: 1 }, i === 0 ? `mâts solaires (${plan.mats.length})` : null)),
    ...elt(plan.antenne, ficheHTML('Antenne', plan.antenne), { radius: 5, color: '#1d2433', weight: 1.5, fillColor: '#fff', fillOpacity: 1 }, 'antenne', 'left'),
    ...elt(plan.atterrissage, ficheHTML('Aire d\'atterrissage', plan.atterrissage,
      `<br>à ${fr(plan.distances_km.habitat_atterrissage, 1)} km de l'habitat (cercle pointillé)`),
    { radius: 8, color: '#1d2433', weight: 2, fillColor: '#f6f4ef', fillOpacity: 1 }, 'aire d\'atterrissage'),
    ...elt(plan.glace, ficheHTML('Station glace', plan.glace, '<br>au bord d\'une ombre permanente'),
      { radius: 6, color: '#1d2433', weight: 1.5, fillColor: '#7fb6d9', fillOpacity: 1 }, 'station glace'),
    ...elt(plan.habitat, ficheHTML('Habitat', plan.habitat), { radius: 8, color: '#1d2433', weight: 2, fillColor: '#e4572e', fillOpacity: 1 }, 'habitat'),
  ]);
  // bornes de la vue du chapitre : tous les éléments + 800 m
  const pts = [plan.habitat, plan.antenne, plan.atterrissage, plan.glace, ...plan.mats].map((f) => LL(f.xy));
  CADRES.plan = L.latLngBounds(pts).pad(0.25);
  dessinerCoupe(plan);
  // valeurs dérivées pour le texte
  const sm = plan.mats.map((m) => m.soleil), hm = plan.mats.map((m) => m.soleil_mat);
  plan.d = {
    mat_sol_min: Math.min(...sm), mat_sol_max: Math.max(...sm), mat_haut_min: Math.min(...hm), mat_haut_max: Math.max(...hm),
    atterrissage_sous: Math.round((plan.habitat.alt - plan.atterrissage.alt) / 10) * 10,
    shackleton_sous_km: Math.round((plan.habitat.alt - Math.min(...plan.coupe.z_m)) / 100) / 10,
  };
  // chiffres du plan dans le texte : data-plan="habitat.soleil", "routes.glace.km"…
  document.querySelectorAll('[data-plan]').forEach((e) => {
    const v = e.dataset.plan.split('.').reduce((o, k) => o?.[k], plan);
    if (typeof v === 'number') e.textContent = fr(v, Number.isInteger(v) ? 0 : 1).replace('-', '−');
  });
}

// chiffres de la proximité dans le texte : data-prox="cable_mats_km", "d.glace"…
if (prox) {
  const el = (n) => prox.elements.find((e) => e.nom === n);
  const mats = prox.elements.filter((e) => e.nom.startsWith('mât')).map((e) => e.a_pied_km);
  prox.d = { mat_min: Math.min(...mats), mat_max: Math.max(...mats), antenne: el('antenne').a_pied_km,
    atterrissage: el("aire d'atterrissage").a_pied_km, atterrissage_oiseau: el("aire d'atterrissage").a_vol_d_oiseau_km, glace: el('station glace').a_pied_km };
  // temps de marche (retour vers l'habitat) : « 8 min », « 1 h 33 »
  const tf = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);
  const matsT = prox.elements.filter((e) => e.nom.startsWith('mât')).map((e) => e.retour_min.ref);
  const tm = { mats: `de ${Math.min(...matsT)} à ${Math.max(...matsT)} min`, antenne: tf(el('antenne').retour_min.ref),
    atterrissage: tf(el("aire d'atterrissage").retour_min.ref), glace: tf(el('station glace').retour_min.ref) };
  document.querySelectorAll('[data-tm]').forEach((e) => { e.textContent = tm[e.dataset.tm] ?? ''; });
  const lignes = [['antenne', 'Antenne'], ["aire d'atterrissage", "Aire d'atterrissage"], ['station glace', 'Station glace']];
  const loin = prox.elements.filter((e) => e.nom.startsWith('mât')).sort((a, b) => b.retour_min.ref - a.retour_min.ref)[0];
  document.querySelectorAll('[data-temps]').forEach((tb) => {
    tb.innerHTML = [[loin.nom + ' (le plus loin)', loin], ...lignes.map(([n, t]) => [t, el(n)])].map(([t, e]) =>
      `<tr><th>${t}<br><small>${fr(e.a_pied_km, 1)} km</small></th><td>${tf(e.retour_min.lent)}</td><td><b>${tf(e.retour_min.ref)}</b></td><td>${tf(e.retour_min.rapide)}</td></tr>`).join('');
  });
  document.querySelectorAll('[data-prox]').forEach((e) => {
    const v = e.dataset.prox.split('.').reduce((o, k) => o?.[k], prox);
    if (typeof v === 'number') e.textContent = fr(v, Number.isInteger(v) ? 0 : 1);
  });
}

function dessinerCoupe(p) {
  const el = document.getElementById('coupe');
  if (!el) return;
  const { s_km: s, z_m: z, ombre } = p.coupe;
  const W = 320, Hh = 198, mg = { g: 34, d: 8, h: 22, b: 22 };
  const sx0 = s[0], sx1 = s[s.length - 1], zmin = Math.min(...z), zmax = Math.max(...z);
  const kx = (W - mg.g - mg.d) / (sx1 - sx0), kz = (Hh - mg.h - mg.b) / ((zmax - zmin) / 1000);
  const X = (v) => mg.g + (v - sx0) * kx, Z = (v) => mg.h + (zmax - v) / 1000 * kz;
  const sol = s.map((v, i) => `${X(v).toFixed(1)},${Z(z[i]).toFixed(1)}`).join(' ');
  let segs = '', debut = null;
  ombre.forEach((o, i) => {
    if (o && debut === null) debut = i;
    if ((!o || i === ombre.length - 1) && debut !== null) {
      segs += `<polyline points="${s.slice(debut, i + 1).map((v, j) => `${X(v).toFixed(1)},${Z(z[debut + j]).toFixed(1)}`).join(' ')}" fill="none" stroke="#3d6b8c" stroke-width="3.5"/>`;
      debut = null;
    }
  });
  const exa = kz / kx;
  const graduations = [];
  for (let v = Math.ceil(sx0 / 2) * 2; v <= sx1; v += 2) graduations.push(`<text x="${X(v)}" y="${Hh - 6}" text-anchor="middle">${fr(v)}</text>`);
  const zTicks = [];
  for (let v = Math.ceil(zmin / 1000); v <= zmax / 1000; v++) zTicks.push(`<text x="${mg.g - 4}" y="${Z(v * 1000) + 3}" text-anchor="end">${fr(v)}</text>
    <line x1="${mg.g}" x2="${W - mg.d}" y1="${Z(v * 1000)}" y2="${Z(v * 1000)}" stroke="#d9d4c7" stroke-width=".5"/>`);
  const i0 = s.findIndex((v) => v >= 0);
  const io = ombre.findIndex((o, i) => o && i > i0);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Coupe du terrain de l'habitat au fond de Shackleton"
    style="font:10px Inter,system-ui,sans-serif;fill:#6b7280">
    ${zTicks.join('')}
    <polygon points="${X(sx0)},${Hh - mg.b} ${sol} ${X(sx1)},${Hh - mg.b}" fill="#e8e1cf" stroke="none"/>
    <polyline points="${sol}" fill="none" stroke="#1d2433" stroke-width="1.2"/>
    ${segs}
    <circle cx="${X(0)}" cy="${Z(z[i0]) - 4}" r="4" fill="#e4572e" stroke="#1d2433"/>
    <text x="${X(0) + 6}" y="${Z(z[i0]) - 9}" fill="#1d2433" font-weight="600">habitat</text>
    ${io > 0 ? `<text x="${X(s[io]) + 4}" y="${Z(z[io]) + 14}" fill="#3d6b8c">ombre permanente</text>` : ''}
    <text x="${X(sx1) - 2}" y="${Z(z[z.length - 1]) - 6}" text-anchor="end" fill="#1d2433">fond de Shackleton</text>
    ${graduations.join('')}
    <text x="${mg.g - 4}" y="${mg.h - 4}" text-anchor="end">km</text>
  </svg>
  <p class="note">Coupe de l'habitat au centre de Shackleton (distances et altitudes en km). Exagération verticale ×${fr(exa, 1)}.</p>`;
}

// --- l'habitat : esquisse posée sur la crête ---
// Dimensions d'esquisse (hypothèses de dessin, à dimensionner) : 3 modules de 12 × 8 m en ligne,
// 3 m de régolithe au-dessus, talus à 35°, sas au bout est, fenêtre-Terre taillée vers la longitude 0.
const ESQ = { mod: 12, diam: 8, couv: 3, talus: 35, oeil: 2.1 };
let habCouche = L.layerGroup(), courbesCouche = L.layerGroup();
if (plan && hab) {
  const [hx, hy] = hab.xy;
  const th = (hab.terrain.crete_az * Math.PI) / 180;
  const ax = [Math.sin(th), Math.cos(th)], nv = [Math.sin(th - Math.PI / 2), Math.cos(th - Math.PI / 2)];   // nv : côté Terre (azimut ≈ 14°)
  const P = (u, v) => L.latLng(hy + (u * ax[1] + v * nv[1]) / 1000, hx + (u * ax[0] + v * nv[0]) / 1000);
  const rect = (u0, u1, v0, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
  const demiL = (3 * ESQ.mod + 2) / 2, demiB = ESQ.diam / 2 + ESQ.couv + (ESQ.diam + ESQ.couv) / Math.tan((ESQ.talus * Math.PI) / 180);
  const butte = [];
  for (let k = 0; k <= 36; k++) {                                   // butte : rectangle aux bouts arrondis
    const a = (k / 36) * 2 * Math.PI, cx = Math.cos(a) >= 0 ? demiL : -demiL;
    butte.push(P(cx + demiB * Math.cos(a), demiB * Math.sin(a)));
  }
  const fen = P(0, demiB), rayon = 0.45;                            // fenêtre au bord de la butte, côté Terre
  const cone = [fen, ...[-8, -4, 0, 4, 8].map((d) => L.latLng(fen.lat + rayon * Math.cos((d * Math.PI) / 180), fen.lng + rayon * Math.sin((d * Math.PI) / 180)))];
  const lab = (pos, txt, dir = 'right') => L.tooltip({ permanent: true, direction: dir, offset: [dir === 'left' ? -6 : 6, 0], className: 'etiq plan' }).setLatLng(pos).setContent(txt);
  const mastsProches = plan.mats.map((m) => [m, Math.hypot(m.xy[0] - hx, m.xy[1] - hy) * 1000]);
  habCouche = L.layerGroup([
    L.polygon(cone, { renderer: svg, color: '#e4572e', weight: 1, dashArray: '4 3', fillColor: '#e4572e', fillOpacity: 0.12, interactive: false }),
    lab(cone[3], 'vers la Terre (±8°)', 'top'),
    L.polygon(butte, { renderer: svg, color: '#1d2433', weight: 1.2, fillColor: '#e8e1cf', fillOpacity: 0.95 })
      .bindPopup(`<b>Habitat sous régolithe (esquisse)</b><br>3 modules de ${ESQ.mod} × ${ESQ.diam} m alignés sur la crête,<br>
        ${ESQ.couv} m de régolithe au-dessus, talus à ${ESQ.talus}° : butte d'environ ${Math.round(2 * demiL + 2 * demiB)} × ${Math.round(2 * demiB)} m.`),
    ...[-1, 0, 1].map((i) => L.polygon(rect(i * (ESQ.mod + 1) - ESQ.mod / 2, i * (ESQ.mod + 1) + ESQ.mod / 2, -ESQ.diam / 2, ESQ.diam / 2),
      { renderer: svg, color: '#1d2433', weight: 1, dashArray: '3 2', fill: false, interactive: false })),
    L.polygon([P(-1.5, ESQ.diam / 2), P(1.5, ESQ.diam / 2), fen], { renderer: svg, color: '#e4572e', weight: 1.2, fillColor: '#151b28', fillOpacity: 1, interactive: false }),
    L.polygon(rect(demiL - 2, demiL + 6, -2.5, 2.5), { renderer: svg, color: '#1d2433', weight: 1.2, fillColor: '#fff', fillOpacity: 1, interactive: false }),
    lab(P(demiL + demiB, 0), 'sas → route'),
    lab(P(-demiL - demiB, 0), 'habitat sous régolithe', 'left'),
    lab(fen, 'fenêtre-Terre'),
    ...mastsProches.map(([m]) => L.circleMarker(LL(m.xy), { renderer: svg, radius: 5, color: '#1d2433', weight: 1, fillColor: '#f2d98d', fillOpacity: 1 })
      .bindPopup(ficheHTML('Mât solaire', m))),
    lab(LL(mastsProches.sort((a, b) => a[1] - b[1])[0][0].xy), 'mât de 20 m'),
    ...Object.values(plan.routes).map((r) => L.polyline(r.pts.map(LL), { renderer: svg, color: '#1d2433', weight: 2.5, opacity: 0.7, interactive: false })),
  ]);
  courbesCouche = L.layerGroup(hab.terrain.courbes.map((c) => L.polyline(c.pts.map(LL),
    { renderer: svg, color: '#5b5443', weight: c.z % 25 === 0 ? 1.1 : 0.5, opacity: 0.75, interactive: false })));
  CADRES.habitat = L.latLngBounds([[hy - 0.09, hx - 0.13], [hy + 0.17, hx + 0.13]]);
  hab.d = { mat_min_m: Math.round(mastsProches[0][1] / 10) * 10, butte_h: ESQ.diam + ESQ.couv,
    ombre_butte_m: Math.round((ESQ.diam + ESQ.couv) / Math.tan((2 * Math.PI) / 180) / 10) * 10,
    jours_axe: fr((16 / 360) * 29.53, 1), fois_lune: fr(hab.terre.diametre_deg / 0.52, 1) };
  document.querySelectorAll('[data-hab]').forEach((e) => {
    const v = e.dataset.hab.split('.').reduce((o, k) => o?.[k], hab);
    if (v != null) e.textContent = typeof v === 'number' ? fr(v, Number.isInteger(v) ? 0 : 1).replace('-', '−') : v;
  });
  dessinerPanorama(hab);
  dessinerFenetre(hab);
  dessinerCoupeHabitat(hab);
}

function svgEl(id, W, H, contenu, legende, label) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${label}" style="font:10px Inter,system-ui,sans-serif;fill:#6b7280">${contenu}</svg>
    <p class="note">${legende}</p>`;
}

function dessinerPanorama(h) {
  const W = 320, H = 172, g = 24, d = 6, top = 8, bas = 38, e0 = -8, e1 = 8;
  const rel = (a) => ((a + 180) % 360) - 180;
  const X = (a) => g + ((rel(a) + 180) / 360) * (W - g - d), Y = (e) => top + ((e1 - e) / (e1 - e0)) * (H - top - bas);
  const pts = h.horizon.az.map((a, i) => [rel(a), h.horizon.h[i]]).sort((p, q) => p[0] - q[0]);
  const sol = `${g},${H - bas} ${pts.map(([a, e]) => `${X(a).toFixed(1)},${Y(e).toFixed(1)}`).join(' ')} ${W - d},${H - bas}`;
  const courbe = (dl) => pts.map(([a]) => `${X(a).toFixed(1)},${Y(dl + h.soleil.colat * Math.cos(((a - h.lon) * Math.PI) / 180)).toFixed(1)}`);
  const bande = [...courbe(h.soleil.decl), ...courbe(-h.soleil.decl).reverse()].join(' ');
  const t = h.terre;
  const reperes = [[0, 'Terre'], [h.directions.pole, 'pôle'], [h.directions.Shackleton, 'Shackleton'], [h.directions['de Gerlache'], 'de Gerlache']]
    .map(([a, n], i) => `<line x1="${X(a)}" x2="${X(a)}" y1="${top}" y2="${H - bas + (i % 2 ? 12 : 2)}" stroke="#c9c3b4" stroke-width=".6"/>
      <text x="${X(a)}" y="${H - bas + (i % 2 ? 21 : 11)}" text-anchor="middle" fill="#1d2433">${n}</text>`).join('');
  const contenu = `<rect x="${g}" y="${top}" width="${W - g - d}" height="${H - top - bas}" fill="#f6f4ef"/>
    ${reperes}
    <rect x="${X(-7.9)}" y="${Y(t.h_max)}" width="${X(7.9) - X(-7.9)}" height="${Y(t.h_min) - Y(t.h_max)}" fill="#cfe3c4" stroke="#3d6b8c" stroke-dasharray="2 2"/>
    <polygon points="${bande}" fill="#f2d98d" opacity=".9"/>
    <line x1="${g}" x2="${W - d}" y1="${Y(0)}" y2="${Y(0)}" stroke="#6b7280" stroke-dasharray="3 3" stroke-width=".6"/>
    <polygon points="${sol}" fill="#1d2433"/>
    <text x="${X(-150)}" y="${Y(1.9)}" fill="#8a6d1f">soleil</text>
    <text x="${X(12)}" y="${Y(5.6)}" fill="#3d6b8c">ciel de la Terre</text>
    <text x="${X(-175)}" y="${Y(-5.2)}" fill="#f6f4ef">horizon (sol)</text>
    ${[-5, 0, 5].map((e) => `<text x="${g - 3}" y="${Y(e) + 3}" text-anchor="end">${e > 0 ? '+' : ''}${e}°</text>`).join('')}
    <text x="${g}" y="${H - 3}">azimut : tour complet, la Terre au centre</text>`;
  svgEl('panorama', W, H, contenu, `Panorama vu depuis l'habitat, à ${h.oeil_m} m du sol. Les hauteurs sont très exagérées : tout le ciel utile tient entre −8° et +8°.`,
    'Panorama de l\'horizon, de la course du soleil et du ciel de la Terre');
}

function dessinerFenetre(h) {
  const W = 320, H = 230, a0 = -13, a1 = 13, e0 = -8.5, e1 = 9;
  const k = W / (a1 - a0);                                           // même échelle en largeur et en hauteur
  const X = (a) => (a - a0) * k, Y = (e) => (e1 - e) * k;
  const Hh = (e1 - e0) * k;
  const hz = (a) => h.horizon.h[Math.round(((a % 360) + 360) % 360) % 360];
  const r = h.terre.diametre_deg / 2;
  const f = { a0: -7.9 - r, a1: 7.9 + r, e0: h.terre.horizon_axe, e1: h.terre.h_max + r };
  const horizon = [];
  for (let a = a0; a <= a1; a += 0.5) horizon.push(`${X(a).toFixed(1)},${Y(hz(a)).toFixed(1)}`);
  const chemin = h.terre.az.map((a, i) => (h.terre.vis[i] ? `<circle cx="${X(a).toFixed(1)}" cy="${Y(h.terre.h[i]).toFixed(1)}" r="1.1" fill="#7fb6d9"/>` : '')).join('');
  const contenu = `<defs><clipPath id="baie"><rect x="${X(f.a0)}" y="${Y(f.e1)}" width="${X(f.a1) - X(f.a0)}" height="${Y(f.e0) - Y(f.e1)}"/></clipPath></defs>
    <rect width="${W}" height="${Hh}" fill="#e8e1cf"/>
    <g clip-path="url(#baie)">
      <rect width="${W}" height="${Hh}" fill="#151b28"/>
      ${chemin}
      <polygon points="${X(a0)},${Hh} ${horizon.join(' ')} ${X(a1)},${Hh}" fill="#6b7280"/>
      <circle cx="${X(3)}" cy="${Y(2.5)}" r="${r * k}" fill="#cfe3f2" stroke="#fff" stroke-width=".8"/>
    </g>
    <rect x="${X(f.a0)}" y="${Y(f.e1)}" width="${X(f.a1) - X(f.a0)}" height="${Y(f.e0) - Y(f.e1)}" fill="none" stroke="#1d2433" stroke-width="2"/>
    <text x="${X(3) + r * k + 4}" y="${Y(2.5) + 3}" fill="#fff">la Terre, à l'échelle</text>
    <text x="${X(f.a0)}" y="${Y(f.e1) - 5}" fill="#1d2433" font-weight="600">la fenêtre-Terre</text>
    <text x="${X(f.a1)}" y="${Y(f.e0) + 12}" text-anchor="end">${fr(f.a1 - f.a0, 0)}° de large, disque compris · de ${fr(f.e0, 1)}° à +${fr(f.e1, 1)}°</text>`;
  svgEl('fenetre', W, Hh, contenu, 'Vue de l\'intérieur. Les points bleus : la Terre jour après jour pendant 6 ans, le temps que le motif de la libration (approchée) se répète. Le cadre suit exactement le ciel où elle se promène ; sous la ligne grise, elle est cachée par le relief.',
    'La fenêtre-Terre et le chemin de la Terre dans le ciel');
}

function dessinerCoupeHabitat(h) {
  const W = 320, s0 = -27, s1 = 33, z0 = -4, z1 = 15, k = W / (s1 - s0), H = (z1 - z0) * k + 14;
  const X = (s) => (s - s0) * k, Y = (z) => (z1 - z) * k;
  const prof = h.profil_terre.s_m.map((s, i) => [s, h.profil_terre.dz_m[i]]).filter(([s]) => s >= s0 && s <= s1);
  const sol = prof.map(([s, z]) => `${X(s).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');
  const R = ESQ.diam / 2, haut = ESQ.diam + ESQ.couv, run = haut / Math.tan((ESQ.talus * Math.PI) / 180), c = R + ESQ.couv;
  const butte = `${X(-c - run)},${Y(0)} ${X(-c)},${Y(haut)} ${X(c)},${Y(haut)} ${X(c + run)},${Y(0)}`;
  const oe = [R - 0.5, ESQ.oeil];
  const ray = (deg, s) => [s, oe[1] + (s - oe[0]) * Math.tan((deg * Math.PI) / 180)];
  // sortie de chaque rayon par le talus côté Terre : z = haut − (s − c)·tan(talus)
  const tt = Math.tan((ESQ.talus * Math.PI) / 180);
  const sortie = (deg) => { const tr = Math.tan((deg * Math.PI) / 180); return ray(deg, (haut + c * tt - oe[1] + oe[0] * tr) / (tr + tt)); };
  const [bh, bb] = [sortie(h.terre.h_max), sortie(h.terre.horizon_axe)];
  const fente = `${X(oe[0])},${Y(oe[1] + 0.8)} ${X(bh[0])},${Y(bh[1])} ${X(bb[0])},${Y(bb[1])} ${X(oe[0])},${Y(oe[1] - 0.8)}`;
  const loin = [ray(h.terre.h_max, s1), ray(h.terre.horizon_axe, s1)];
  const contenu = `<polygon points="${X(oe[0])},${Y(oe[1])} ${X(loin[0][0])},${Y(loin[0][1])} ${X(loin[1][0])},${Y(loin[1][1])}" fill="#e4572e" opacity=".12"/>
    <polygon points="${X(s0)},${H} ${sol} ${X(s1)},${H}" fill="#cfc6b0"/>
    <polygon points="${butte}" fill="#e8e1cf" stroke="#1d2433" stroke-width="1"/>
    <polygon points="${fente}" fill="#f6f4ef" stroke="#e4572e" stroke-width="1"/>
    <circle cx="${X(0)}" cy="${Y(R)}" r="${R * k}" fill="#fff" stroke="#1d2433" stroke-width="1.2"/>
    <line x1="${X(-R + 0.6)}" x2="${X(R - 0.6)}" y1="${Y(0.6)}" y2="${Y(0.6)}" stroke="#1d2433"/>
    <circle cx="${X(oe[0])}" cy="${Y(oe[1])}" r="1.8" fill="#e4572e"/>
    <line x1="${X(oe[0])}" y1="${Y(oe[1])}" x2="${X(loin[0][0])}" y2="${Y(loin[0][1])}" stroke="#e4572e" stroke-width=".8" stroke-dasharray="3 2"/>
    <line x1="${X(oe[0])}" y1="${Y(oe[1])}" x2="${X(loin[1][0])}" y2="${Y(loin[1][1])}" stroke="#e4572e" stroke-width=".8" stroke-dasharray="3 2"/>
    <text x="${X(s1) - 2}" y="${Y(loin[0][1]) - 4}" text-anchor="end" fill="#e4572e">Terre : +${fr(h.terre.h_max, 1)}° au plus haut</text>
    <text x="${X(s1) - 2}" y="${Y(loin[1][1]) + 11}" text-anchor="end" fill="#e4572e">${fr(h.terre.horizon_axe, 1)}° : horizon</text>
    <text x="${X(0)}" y="${Y(haut) - 5}" text-anchor="middle" fill="#1d2433">régolithe, ${ESQ.couv} m (à dimensionner)</text>
    <line x1="${X(-R * 0.7)}" y1="${Y(R * 1.7)}" x2="${X(-14)}" y2="${Y(13)}" stroke="#1d2433" stroke-width=".5"/>
    <text x="${X(-14) - 2}" y="${Y(13) - 2}" text-anchor="end" fill="#1d2433">module Ø ${ESQ.diam} m</text>
    <line x1="${X(oe[0] + 3)}" y1="${Y(oe[1] + 0.5)}" x2="${X(14)}" y2="${Y(12)}" stroke="#e4572e" stroke-width=".5"/>
    <text x="${X(14) + 2}" y="${Y(12) - 2}" fill="#e4572e">fenêtre-Terre</text>
    <text x="${X(s0) + 2}" y="${H - 4}">← vers la crête</text>
    <text x="${X(s1) - 2}" y="${H - 4}" text-anchor="end">vers la Terre →</text>
    <line x1="${X(s0) + 4}" x2="${X(s0) + 4 + 5 * k}" y1="${Y(z0) - 3}" y2="${Y(z0) - 3}" stroke="#1d2433" stroke-width="2"/>
    <text x="${X(s0) + 4 + 5 * k + 4}" y="${Y(z0)}" fill="#1d2433">5 m</text>`;
  svgEl('coupe-hab', W, H, contenu, 'Coupe vers la Terre, sans exagération : la fente taillée dans la butte suit exactement les deux rayons extrêmes de la Terre.',
    'Coupe de l\'habitat sous régolithe et de la fenêtre-Terre');
}

const DL = large?.demi_km || D;
const imgL = (f, o = {}) => L.imageOverlay(`donnees/${f}`, L.latLngBounds([[-DL, -DL], [DL, DL]]), o);
const CLE_SOLEIL = { degrade: ['#151b28', '#3c4a66', '#a39a86', '#f2d98d', '#fff6d5'], bornes: ['jamais', 'part du temps au soleil', '90 %'] };
const CLE_TERRE = { degrade: ['#1d2433', '#3d5a6c', '#7fa7a0', '#cfe3c4', '#f6f4ef'], bornes: ['jamais', 'part du temps', 'toujours'] };
const CALQUES = {
  ombrage_large: { nom: 'Relief ombré élargi (120 m)', couche: imgL('ombrage_large.jpg') },
  soleil_off: { nom: 'Ensoleillement officiel LOLA', couche: imgL('soleil_off.webp', { className: 'multiplier' }), cle: CLE_SOLEIL },
  terre_off: { nom: 'Terre visible, carte officielle', couche: imgL('terre_off.webp', { className: 'multiplier' }), cle: CLE_TERRE },
  ombre_off: { nom: 'Ombre permanente officielle', couche: imgL('ombre_off.png'), cle: { cases: [['#7fb6d9', 'jamais de soleil']] } },
  relief: { nom: 'Relief (altitude)', fond: true, couche: groupe(L.imageOverlay('donnees/relief_tout.jpg', BORNES_TOUT), img('relief.webp')),
    cle: { degrade: ['#2b3a55', '#8fa3bf', '#e8e1cf', '#d9a88a', '#b5654a'], bornes: ['−5 km', '+3,5 km'] } },
  ombrage: { nom: 'Relief ombré', fond: true, couche: groupe(L.imageOverlay('donnees/ombrage_tout.jpg', BORNES_TOUT), img('ombrage.webp')) },
  soleil: { nom: 'Ensoleillement (calcul de l\'atlas)', couche: img('soleil.webp', { className: 'multiplier' }), cle: CLE_SOLEIL },
  ombre: { nom: 'Ombre permanente', couche: img('ombre.png'), cle: { cases: [['#7fb6d9', 'jamais de soleil']] } },
  pentes: { nom: 'Pentes', couche: img('pentes.webp', { className: 'multiplier' }),
    cle: { cases: [['#e9efe4', '< 5°'], ['#c9dcc0', '5–8°'], ['#f2dfa7', '8–15°'], ['#e9a77f', '15–25°'], ['#b5654a', '> 25°']] } },
  terre: { nom: 'Terre visible', couche: img('terre.webp', { className: 'multiplier' }), cle: CLE_TERRE },
  zonage: { nom: 'Zonage', couche: img('zonage.png'),
    cle: { cases: [['#e4572e', 'pente < 8°, soleil ≥ 60 %'], ['#f2b38f', 'pente < 8°, soleil 50–60 %'], ['#7fb6d9', 'ombre permanente, pente < 15°']] } },
  plan_ombrage: { nom: 'Relief ombré du site (20 m)', couche: L.imageOverlay('donnees/plan_ombrage.webp', planBornes) },
  plan_soleil: { nom: 'Ensoleillement du site (40 m)', couche: L.imageOverlay('donnees/plan_soleil.webp', planBornes, { className: 'multiplier' }), cle: CLE_SOLEIL },
  proximite: { nom: "Distance à pied depuis l'habitat", couche: L.imageOverlay('donnees/proximite.png', planBornes),
    cle: { cases: [['#ffb000', 'moins de 1 km (≈ 22 min à plat)'], ['#ff7828', '1 à 2 km (22 à 44 min)'], ['#c83c3c', '2 à 5 km (44 min à 1 h 50)']] } },
  courbes_plan: { nom: 'Courbes de niveau (100 m)', couche: courbesPlan, cle: { cases: [['#5b5443', 'courbe tous les 100 m, trait épais tous les 500 m', 'trait']] } },
  courbes_tout: { nom: 'Courbes de niveau, toute la carte (1 000 m)', couche: courbesTout, cle: { cases: [['#5b5443', 'courbe tous les 1 000 m, trait épais tous les 2 000 m', 'trait']] } },
  plan: { nom: 'Plan d\'implantation (clic)', couche: planCouche, cle: { cases: [
    ['#e4572e', 'habitat', true], ['#f2d98d', 'mât solaire', true], ['#fff', 'antenne', true], ['#f6f4ef', 'aire d\'atterrissage', true],
    ['#7fb6d9', 'station glace', true], ['#1d2433', 'route', 'trait'], ['#3d6b8c', 'route de la glace', 'trait']] } },
  courbes: { nom: 'Courbes de niveau (5 m)', couche: courbesCouche },
  habitat: { nom: 'Habitat (esquisse)', couche: habCouche, cle: { cases: [['#e8e1cf', 'butte de régolithe'], ['#e4572e', 'cône de vue vers la Terre'],
    ['#f2d98d', 'mât solaire', true], ['#1d2433', 'route', 'trait']] } },
  lieux: { nom: 'Îlots (clic)', couche: lieux,
    cle: { cases: [['#e4572e', 'îlot qui voit la Terre > 50 % du temps', true], ['#f2b38f', 'îlot qui la voit moins', true]] } },
  berges: { nom: 'Vers la glace', couche: berges, cle: { cases: [['#1d2433', 'chemin le plus court vers une ombre permanente > 1 km²', 'trait']] } },
  artemis: { nom: 'Régions Artemis III', couche: artemis, cle: { cases: [['#1d2433', 'région placée sur sa formation', true]] } },
  graticule: { nom: 'Latitudes', couche: graticule },
  visites: { nom: 'Sites déjà visités', couche: visites, cle: { cases: [['#ffb000', 'atterrissage ou impact', true]] } },
  noms_large: { nom: 'Noms (grandes formations)', couche: nomsLarges },
  noms: { nom: 'Noms', couche: noms },
};
delete CALQUES.ombrage_large;                       // remplacé par le fond complet (ombrage_tout)
if (!large) ['soleil_off', 'terre_off', 'ombre_off'].forEach((k) => delete CALQUES[k]);
if (!cplan) delete CALQUES.courbes_plan;
if (!plan || !prox) delete CALQUES.proximite;
if (!plan) ['plan_ombrage', 'plan_soleil', 'plan'].forEach((k) => delete CALQUES[k]);
if (!plan || !hab) ['courbes', 'habitat'].forEach((k) => delete CALQUES[k]);
const ORDRE = Object.keys(CALQUES);
let actifs = new Set();

function poser(liste) {
  actifs = new Set(liste);
  // tout retirer puis remettre dans l'ordre : le fond d'abord, pour que « multiplier » s'applique dessus
  ORDRE.forEach((k) => carte.removeLayer(CALQUES[k].couche));
  ORDRE.filter((k) => actifs.has(k)).forEach((k) => CALQUES[k].couche.addTo(carte));
  legende();
}

const legendeEl = document.getElementById('legende');
let libre = false;
let replie = matchMedia('(max-width: 900px)').matches;   // sur téléphone, la légende démarre pliée
function legende() {
  const ligne = (k) => {
    const cl = CALQUES[k], on = actifs.has(k);
    let h = `<label class="ligne"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}> ${cl.nom}</label>`;
    if (on && cl.cle?.degrade) {
      const b = cl.cle.bornes;
      h += `<div class="degrade" style="background:${degrade(cl.cle.degrade)}"></div><div class="bornes">${b.map((t) => `<span>${t}</span>`).join('')}</div>`;
    }
    if (on && cl.cle?.cases) {
      h += cl.cle.cases.map(([col, t, forme]) => {
        const st = forme === 'trait' ? `height:0;border-top:2px dashed ${col};border-radius:0`
          : forme ? `background:${col};border-radius:50%;border:1px solid #1d2433` : `background:${col}`;
        return `<div class="ligne"><span class="case" style="${st}"></span>${t}</div>`;
      }).join('');
    }
    return h;
  };
  const montres = libre ? ORDRE : ORDRE.filter((k) => actifs.has(k) && !['noms', 'noms_large', 'graticule'].includes(k));
  legendeEl.innerHTML = `<button class="plier">Légende ${replie ? '▸' : '▾'}</button>`
    + (replie ? '' : montres.map(ligne).join('')
      + (libre ? '' : '<div class="ligne" style="color:#6b7280">↑ longitude 0 : côté Terre</div>'))
    + '<div class="echelle"><i></i><span></span></div>';
  legendeEl.querySelector('.plier').onclick = () => { replie = !replie; legende(); };
  legendeEl.querySelectorAll('input').forEach((i) => (i.onchange = () => {
    const k = i.dataset.k;
    if (i.checked) {
      if (CALQUES[k].fond) ORDRE.filter((j) => CALQUES[j].fond).forEach((j) => actifs.delete(j));
      actifs.add(k);
    } else actifs.delete(k);
    poser([...actifs]);
  }));
  echelle();
}

function echelle() {
  const e = legendeEl.querySelector('.echelle');
  if (!e) return;
  const pxKm = carte.getZoomScale(carte.getZoom(), 0);
  const km = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((v) => v * pxKm >= 60) || 100;
  e.querySelector('i').style.width = `${Math.round(km * pxKm)}px`;
  e.querySelector('span').textContent = km < 1 ? `${fr(km * 1000)} m` : `${fr(km)} km`;
}
carte.on('zoomend', echelle);

// --- chapitres ---
const titreEl = document.getElementById('carte-titre');
let courant = null;
function activer(sec, anime = true) {
  if (sec === courant) return;
  courant = sec;
  const v = JSON.parse(sec.dataset.vue);
  libre = !!v.libre;
  titreEl.textContent = sec.dataset.titre || '';
  poser(v.calques);
  const b = Array.isArray(v.cadre) ? L.latLngBounds([[v.cadre[1], v.cadre[0]], [v.cadre[3], v.cadre[2]]]) : CADRES[v.cadre];
  // marges : le titre en haut, la légende en bas à gauche → on remonte le cadrage au-dessus d'elle
  const marges = () => ({ paddingTopLeft: L.point(16, 52),
    paddingBottomRight: L.point(16, Math.min(legendeEl.offsetHeight * 0.6 + 16, carte.getSize().y * 0.4)) });
  if (anime) carte.flyToBounds(b, { ...marges(), duration: 1.1 });
  else {
    carte.fitBounds(b, { ...marges(), animate: false });
    // au premier affichage, la taille de la carte n'est pas toujours connue : on recadre une fois la page posée
    const recadrer = () => { carte.invalidateSize(); carte.fitBounds(b, { ...marges(), animate: false }); };
    if (document.readyState === 'complete') requestAnimationFrame(recadrer);
    else addEventListener('load', recadrer, { once: true });
  }
}

const chapitres = [...document.querySelectorAll('.chap')];
activer(chapitres[0], false);
const mobile = matchMedia('(max-width: 900px)');
let obs;
function observer() {
  obs?.disconnect();
  obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && activer(e.target)),
    { rootMargin: mobile.matches ? '-72% 0px -26% 0px' : '-50% 0px -49% 0px' });
  chapitres.forEach((s) => obs.observe(s));
}
observer();
mobile.addEventListener('change', () => { carte.invalidateSize(); observer(); });

window.etude = { carte, meta, activer, CALQUES };   // pour vérifier depuis la console

// mode vidéo : ?video (filmé par outils/video_etude.mjs), ?video&lire pour le regarder dans le navigateur
if (new URLSearchParams(location.search).has('video')) {
  import('./video.js').then((m) => m.lancer({ carte, poser, CADRES, chapitres, C: CHIFFRES, plan, hab, large, CALQUES }));
}
