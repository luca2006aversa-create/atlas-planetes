// Vue « Globes 3D » : un globe CesiumJS par corps, relief réel exagérable (LOLA, MOLA, Terrarium),
// estompage calculé « façon LOLA » pour tous les corps qui ont un relief, et carte de la couverture
// détaillée (emprises des mosaïques régionales du catalogue NASA Trek), chargeables d'un clic.
// Sites des missions (donnees/sites.json) en épingles, trajets des rovers (donnees/traces.json).
import { CORPS, GLOBES, AGENCES, CARTOGRAPHIE } from './corps.js';
import { ficheHTML } from './missions.js';

const $ = (id) => document.getElementById(id);
let viewer = null, corpsActif = null, ell = null, coucheBase = null, coucheRelief = null, coucheCouv = null;
let ETAT = { missions: [], sites: [], traces: {}, trajectoires: {} }, ACTIONS = {};
let reliefActif = null, sitesCorps = [], tracesCorps = [], anneeMax = 9999;
let couchesActives = [], filtreCouv = null;   // filtreCouv : { re, nom, n } = seulement les mosaïques d'une mission
const reliefs = {}, couvertures = {}, chargees = [];
const INSTRUMENTS = {
  'HiRISE': '#e4572e', 'LROC NAC': '#e4572e', 'CTX': '#f2b38f', 'HRSC': '#7fb6d9', 'Kaguya TC': '#7fb6d9',
  'Apollo': '#c9a227', 'THEMIS': '#9b8ec4', 'CRISM': '#2f9c95', 'LOLA': '#8fa3bf', 'LROC WAC': '#8fa3bf', 'autre': '#b8b2a4',
};
const actifs = new Set(Object.keys(INSTRUMENTS));
window.atlasGlobe = { get viewer() { return viewer; } };   // pour inspecter depuis la console

export async function initGlobe(etat, actions) {
  if (etat) ETAT = etat;
  if (actions) ACTIONS = actions;
  GLOBES.forEach(cle => {
    const b = document.createElement('button');
    b.textContent = CORPS[cle].nom; b.dataset.cle = cle; b.onclick = () => ouvrirCorps(cle);
    $('choix-corps').appendChild(b);
  });
  $('exageration').oninput = () => {
    const v = +$('exageration').value;
    $('exa-valeur').textContent = `×${v}`;
    if (viewer) viewer.scene.verticalExaggeration = v;
    majTraces();
  };
  $('sites-on').onchange = filtrerSites;
  $('sites-annee').oninput = () => {
    const a = $('sites-annee');
    anneeMax = +a.value >= +a.max ? 9999 : +a.value;
    $('sites-annee-valeur').textContent = anneeMax === 9999 ? 'tout' : a.value;
    filtrerSites();
  };
  if (!corpsActif) await ouvrirCorps('lune');
}

async function lireRelief(nom) {
  if (!reliefs[nom]) {
    const [meta, bin] = await Promise.all([fetch('donnees/relief.json').then(r => r.json()),
      fetch(`donnees/relief_${nom}.bin`).then(r => r.arrayBuffer())]);
    reliefs[nom] = { ...meta[nom], g: new Int16Array(bin) };
  }
  return reliefs[nom];
}

function hauteur(R, lonDeg, latDeg) {                 // bilinéaire, longitude bouclée
  const W = R.largeur, H = R.hauteur;
  const x = ((lonDeg + 180) / 360) * W - 0.5, y = ((90 - latDeg) / 180) * H - 0.5;
  const x0 = Math.floor(x), y0 = Math.max(0, Math.min(H - 2, Math.floor(y)));
  const fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W;
  const g = R.g;
  const a = g[y0 * W + xa], b = g[y0 * W + xb], c = g[(y0 + 1) * W + xa], d = g[(y0 + 1) * W + xb];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

function terrain(R) {
  const ts = new Cesium.GeographicTilingScheme({ ellipsoid: ell });
  // 65 points par tuile : Cesium choisit la finesse des images d'après celle du relief ;
  // avec 33, les mosaïques fines plafonnaient un niveau de zoom trop bas.
  const N = 65;
  return new Cesium.CustomHeightmapTerrainProvider({
    ellipsoid: ell, tilingScheme: ts, width: N, height: N,
    callback: (x, y, level) => {
      const r = ts.tileXYToRectangle(x, y, level);
      const out = new Float32Array(N * N);
      const w = Cesium.Math.toDegrees(r.west), e = Cesium.Math.toDegrees(r.east);
      const n = Cesium.Math.toDegrees(r.north), s = Cesium.Math.toDegrees(r.south);
      for (let j = 0; j < N; j++) {
        const lat = n + (s - n) * j / (N - 1);
        for (let i = 0; i < N; i++) out[j * N + i] = hauteur(R, w + (e - w) * i / (N - 1), lat);
      }
      return out;
    },
  });
}

// Estompage coloré façon LOLA : teinte hypsométrique + ombrage, calculé dans le navigateur.
const RAMPE = [[0, [48, 24, 110]], [0.18, [40, 90, 200]], [0.35, [40, 180, 200]], [0.5, [90, 190, 90]],
  [0.65, [235, 220, 80]], [0.8, [235, 130, 50]], [0.92, [200, 50, 40]], [1, [255, 245, 240]]];
function couleur(t) {
  for (let k = 1; k < RAMPE.length; k++) if (t <= RAMPE[k][0]) {
    const [t0, c0] = RAMPE[k - 1], [t1, c1] = RAMPE[k], f = (t - t0) / (t1 - t0);
    return c0.map((v, i) => v + (c1[i] - v) * f);
  }
  return RAMPE[RAMPE.length - 1][1];
}
function estompage(R, cle) {
  const W = R.largeur, H = R.hauteur, g = R.g;
  const tri = Array.from(g.filter((_, i) => i % 97 === 0)).sort((a, b) => a - b);
  const lo = tri[Math.floor(tri.length * 0.01)], hi = tri[Math.floor(tri.length * 0.99)];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  const rayon = CORPS[cle].rayon, dy = Math.PI * rayon / H, z = 4 * W / 2880;
  for (let y = 0; y < H; y++) {
    const dx = Math.max(dy * Math.cos((90 - (y + 0.5) * 180 / H) * Math.PI / 180), dy * 0.05);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const gx = (g[y * W + (x + 1) % W] - g[y * W + (x - 1 + W) % W]) / (2 * dx);
      const gy = (g[Math.min(H - 1, y + 1) * W + x] - g[Math.max(0, y - 1) * W + x]) / (2 * dy);
      const sh = Math.max(0, Math.min(1, 0.55 + z * (-gx * 0.7 + gy * 0.7) * 2));
      const c = couleur(Math.max(0, Math.min(1, (g[i] - lo) / (hi - lo))));
      const o = i * 4;
      img.data[o] = c[0] * (0.35 + 0.75 * sh); img.data[o + 1] = c[1] * (0.35 + 0.75 * sh);
      img.data[o + 2] = c[2] * (0.35 + 0.75 * sh); img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: cv.toDataURL('image/jpeg', 0.9), lo, hi };
}

function fournisseur(l) {
  if (l.type === 'wms') return new Cesium.WebMapServiceImageryProvider({
    url: l.url, layers: l.couche, parameters: { format: 'image/png', version: '1.3.0' },
    tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid: ell }), credit: l.credit });
  return new Cesium.WebMapTileServiceImageryProvider({
    url: l.url, layer: 'x', style: 'default', format: 'image/jpeg', tileMatrixSetID: 'default028mm',
    tilingScheme: l.type === 'gibs' ? new Cesium.WebMercatorTilingScheme({ ellipsoid: ell }) : new Cesium.GeographicTilingScheme({ ellipsoid: ell }),
    tileWidth: 256, tileHeight: 256, maximumLevel: l.max, credit: l.credit });
}

export async function ouvrirCorps(cle) {
  const c = CORPS[cle];
  if (!c || !c.rayon) return;
  corpsActif = cle;
  filtreCouv = null;
  document.querySelectorAll('#choix-corps button').forEach(b => b.classList.toggle('actif', b.dataset.cle === cle));
  ell = new Cesium.Ellipsoid(c.rayon, c.rayon, c.rayonPolaire || c.rayon);
  if ('default' in Cesium.Ellipsoid) Cesium.Ellipsoid.default = ell;
  if (viewer) viewer.destroy();
  chargees.length = 0;
  viewer = new Cesium.Viewer('globe', {
    ellipsoid: ell, globe: new Cesium.Globe(ell), baseLayer: false,
    animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false,
    baseLayerPicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, skyAtmosphere: c.atmosphere ? new Cesium.SkyAtmosphere(ell) : false,
  });
  const sc = viewer.scene;
  sc.globe.showGroundAtmosphere = !!c.atmosphere;
  sc.globe.enableLighting = false;
  sc.globe.dynamicAtmosphereLighting = false;
  sc.globe.baseColor = Cesium.Color.fromCssColorString('#222');
  if (sc.sun) sc.sun.show = false;
  if (sc.moon) sc.moon.show = false;
  sc.screenSpaceCameraController.minimumZoomDistance = 300;
  sc.globe.maximumScreenSpaceError = 1.5;               // un peu plus net que le réglage par défaut (2)
  sc.verticalExaggeration = +$('exageration').value;

  // relief
  const R = c.relief ? await lireRelief(c.relief) : null;
  reliefActif = R;
  if (R) viewer.terrainProvider = terrain(R);
  $('exageration').disabled = !R;
  $('note-relief').textContent = R
    ? `Relief ${{ terre: 'Terrarium (SRTM, GMTED, ETOPO)', lune: 'LOLA', mars: 'MOLA' }[c.relief]} à 8 px/° (~${Math.round(Math.PI * c.rayon / 1440 / 1000 * 10) / 10} km). De ${R.min} à ${R.max} m.`
    : "Pas de modèle de relief chargé pour ce corps : globe lisse, image seule.";

  // couches
  const couches = [...(c.couches || [])];
  if (R) couches.push({ nom: 'Relief calculé (style LOLA)', type: 'calcule' });
  couchesActives = couches;
  $('choix-couche').innerHTML = '';
  couches.forEach((l, i) => {
    const b = document.createElement('button'); b.textContent = l.nom;
    b.onclick = () => poserBase(couches, i, R, cle); $('choix-couche').appendChild(b);
  });
  poserBase(couches, 0, R, cle);

  // couverture et calques chargés (vidés à chaque changement de corps)
  await poserCouverture(c);
  majCalques();
  poserSites(cle);

  // lieux et fiche
  $('choix-lieu').innerHTML = '';
  (c.lieux || []).forEach(l => {
    const b = document.createElement('button'); b.textContent = l.nom; b.onclick = () => allerA(l);
    $('choix-lieu').appendChild(b);
  });
  $('fiche-corps').innerHTML = c.fiche || '';
  $('fiche-zone').hidden = true;
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees((c.lieux?.[0]?.lon) ?? 0, 15, c.rayon * 3.2, ell) });

  const h = new Cesium.ScreenSpaceEventHandler(sc.canvas);
  h.setInputAction(m => {
    const p = viewer.camera.pickEllipsoid(m.endPosition, ell); if (!p) return;
    const g = ell.cartesianToCartographic(p), lat = Cesium.Math.toDegrees(g.latitude), lon = Cesium.Math.toDegrees(g.longitude);
    const alt = R ? ` · ${Math.round(hauteur(R, lon, lat))} m` : '';
    $('coord').textContent = `${c.nom} · ${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}${alt}`;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  h.setInputAction(m => {
    const pk = sc.pick(m.position);
    if (pk?.id?.site) { ficheSite(pk.id.site); return; }
    const p = viewer.camera.pickEllipsoid(m.position, ell); if (!p) return;
    const g = ell.cartesianToCartographic(p);
    zonesIci(Cesium.Math.toDegrees(g.longitude), Cesium.Math.toDegrees(g.latitude));
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function poserBase(couches, i, R, cle) {
  const l = couches[i];
  if (coucheBase) viewer.imageryLayers.remove(coucheBase);
  let prov;
  if (l.type === 'calcule') {
    const e = estompage(R, cle);
    prov = new Cesium.SingleTileImageryProvider({ url: e.url, tileWidth: R.largeur, tileHeight: R.hauteur,
      rectangle: Cesium.Rectangle.MAX_VALUE, ellipsoid: ell, credit: 'Estompage calculé dans l\'atlas' });
    l.credit = `Estompage calculé ici à partir du relief (${e.lo} à ${e.hi} m pour la rampe de couleurs).`;
  } else prov = fournisseur(l);
  coucheBase = viewer.imageryLayers.addImageryProvider(prov, 0);
  document.querySelectorAll('#choix-couche button').forEach((b, j) => b.classList.toggle('actif', j === i));
  const c = CORPS[corpsActif];
  $('fiche-corps').innerHTML = `${c.fiche || ''}<small>Fond : ${l.credit || ''}</small>`;
}

// ---------- couverture détaillée
function trekCorps(c) { return (c.couches?.[0]?.url.match(/tiles\/(\w+)\/EQ/) || [])[1]; }

async function poserCouverture(c) {
  const zone = $('couverture');
  coucheCouv = null;
  if (!c.couverture) { zone.innerHTML = '<div class="note-petite">Pas de catalogue de zones détaillées pour ce corps.</div>'; return; }
  if (!couvertures[c.couverture]) couvertures[c.couverture] = await fetch(`donnees/couverture_${c.couverture}.json`).then(r => r.ok ? r.json() : []).catch(() => []);
  const prods = couvertures[c.couverture];
  const compte = {};
  prods.forEach(p => (compte[p.i] = (compte[p.i] || 0) + 1));
  zone.innerHTML = `<label class="ligne"><input type="checkbox" id="couv-on" checked> afficher les ${prods.length} mosaïques régionales</label>
    <div id="filtre-couv"></div>
    <div class="legende-couv">${Object.entries(compte).sort((a, b) => b[1] - a[1]).map(([i, n]) =>
      `<label class="item"><input type="checkbox" data-i="${i}" ${actifs.has(i) ? 'checked' : ''}><span class="pastille" style="background:${INSTRUMENTS[i] || '#999'}"></span>${i} · ${n}</label>`).join('')}</div>
    <div class="note-petite">Plus c'est dense, mieux c'est cartographié. Clic sur le globe : liste des mosaïques à cet endroit, à charger.
    Ce sont les produits prêts à l'emploi du catalogue NASA Trek (mosaïques, reliefs fins, cartes de risques), pas toutes les
    images prises : HiRISE en compte des dizaines de milliers (emprises complètes : PDS / Orbital Data Explorer).</div>`;
  zone.querySelectorAll('input[data-i]').forEach(cb => (cb.onchange = () => { cb.checked ? actifs.add(cb.dataset.i) : actifs.delete(cb.dataset.i); dessinerCouverture(prods); }));
  $('couv-on').onchange = () => { if (coucheCouv) coucheCouv.show = $('couv-on').checked; };
  dessinerCouverture(prods);
}

function dessinerCouverture(prods) {
  if (coucheCouv) viewer.imageryLayers.remove(coucheCouv);
  const W = 4096, H = 2048, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  for (const p of prods) {
    if (!actifs.has(p.i) || (filtreCouv && !filtreCouv.re.test(p.t))) continue;
    const [w, s, e, n] = p.b;
    const x = (w + 180) / 360 * W, y = (90 - n) / 180 * H;
    const lw = Math.max(2, (e - w) / 360 * W), lh = Math.max(2, (n - s) / 180 * H);
    ctx.globalAlpha = 0.28; ctx.fillStyle = INSTRUMENTS[p.i] || '#999'; ctx.fillRect(x, y, lw, lh);
    ctx.globalAlpha = 0.8; ctx.strokeStyle = INSTRUMENTS[p.i] || '#999'; ctx.lineWidth = 1; ctx.strokeRect(x, y, lw, lh);
  }
  coucheCouv = viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({
    url: cv.toDataURL('image/png'), tileWidth: W, tileHeight: H, rectangle: Cesium.Rectangle.MAX_VALUE, ellipsoid: ell }));
  coucheCouv.show = !$('couv-on') || $('couv-on').checked;
}

// Nature et finesse d'un produit, lues dans sa catégorie et son nom (ex. « 25cm », « 6m », « 2.5mpp », « 20m »).
const NATURE = { Imagery: 'photo', Mosaic: 'photo', Topography: 'relief coloré', Terrain: 'pentes / terrain', Hazard: 'carte de risques', Mineralogy: 'minéralogie' };
function finesse(p) {
  const m = `${p.l} ${p.t}`.match(/(\d+(?:[.,]\d+)?)\s*(cm|mpp|m)(?![a-z])/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return m[2].toLowerCase() === 'cm' ? v / 100 : v;
}
const etiquetteFinesse = (f) => (f == null ? '' : f < 1 ? `${Math.round(f * 100)} cm/px` : `${f} m/px`);

// Produits de la couverture qui contiennent un point (tous = sans tenir compte des cases d'instruments).
function produitsIci(lon, lat, tous = false) {
  const c = CORPS[corpsActif];
  return (couvertures[c.couverture] || []).filter(p => (tous || (actifs.has(p.i) && !(filtreCouv && !filtreCouv.re.test(p.t)))) && lon >= p.b[0] && lon <= p.b[2] && lat >= p.b[1] && lat <= p.b[3])
    .map(p => ({ ...p, f: finesse(p), n: NATURE[p.c] || p.c || 'autre' }))
    .sort((a, b) => (a.n === 'photo' ? 0 : 1) - (b.n === 'photo' ? 0 : 1) || (a.f ?? 99) - (b.f ?? 99));
}
const listeProduitsHTML = (prods) => `<div class="liste" style="max-height:none">${prods.slice(0, 40).map((p, k) =>
  `<div class="item"><span class="pastille" style="background:${INSTRUMENTS[p.i]}"></span><span style="flex:1">${p.t}<br><span class="aide">${p.n}${p.f != null ? ' · ' + etiquetteFinesse(p.f) : ''}</span></span><button data-k="${k}">${chargees.some(x => x.p.l === p.l) ? 'chargée' : 'charger'}</button></div>`).join('')}</div>`;
const brancherProduits = (f, prods) => f.querySelectorAll('button[data-k]').forEach(b => (b.onclick = () => chargerMosaique(prods[+b.dataset.k], b)));
// La photo la plus fine d'une zone de taille raisonnable (< 6 degrés carrés) : celle qu'on charge en arrivant sur un site.
const meilleurProduit = (prods) => prods.filter(p => p.n === 'photo' && (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]) < 6)
  .sort((a, b) => (a.f ?? 50) - (b.f ?? 50))[0];

function zonesIci(lon, lat) {
  const c = CORPS[corpsActif];
  const prods = produitsIci(lon, lat);
  const f = $('fiche-zone');
  if (!prods.length) { f.hidden = true; return; }
  f.hidden = false;
  f.innerHTML = `<button class="fermer" title="Fermer">×</button><h3>${prods.length} produit(s) ici</h3>
    <div class="meta">${coordTxt(lat, lon)} · fond actuel : ${c.couches[0].nom}</div>
    <div class="aide">« photo » = image plus fine que le fond. « relief coloré », « pentes », « risques » = cartes de données en couleurs (ce ne sont pas des photos).</div>
    ${listeProduitsHTML(prods)}`;
  f.querySelector('.fermer').onclick = () => (f.hidden = true);
  brancherProduits(f, prods);
}

async function chargerMosaique(p, bouton, voler = true) {
  const dire = (t) => { if (bouton) bouton.textContent = t; };
  if (chargees.some(x => x.p.l === p.l)) { dire('déjà chargée'); return; }
  const corps = trekCorps(CORPS[corpsActif]);
  const base = `https://trek.nasa.gov/tiles/${corps}/EQ/${p.l}/1.0.0`;
  dire('…');
  try {
    const xml = await fetch(`${base}/WMTSCapabilities.xml`).then(r => r.text());
    const ext = /image\/png/.test(xml) ? 'png' : 'jpg';
    // niveau de zoom le plus fin : plus grand identifiant de TileMatrix dans l'ensemble « default028mm »
    const debut = xml.indexOf('<ows:Identifier>default028mm</ows:Identifier>');
    const bloc = debut >= 0 ? xml.slice(debut, xml.indexOf('</TileMatrixSet>', debut)) : xml;
    const niveaux = [...bloc.matchAll(/<TileMatrix>\s*<ows:Identifier>\s*(\d+)/g)].map(m => +m[1]);
    const max = niveaux.length ? Math.max(...niveaux) : 12;
    const couche = viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
      url: `${base}/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.${ext}`, layer: 'x', style: 'default',
      format: `image/${ext}`, tileMatrixSetID: 'default028mm', tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid: ell }),
      tileWidth: 256, tileHeight: 256, maximumLevel: max, rectangle: Cesium.Rectangle.fromDegrees(...p.b), credit: p.t }));
    if (coucheCouv) viewer.imageryLayers.raiseToTop(coucheCouv);
    chargees.push({ couche, p: { ...p, f: p.f ?? finesse(p), n: p.n || NATURE[p.c] || 'autre', max } });
    dire('chargée');
    if (voler) allerVers(p);
    if ($('couv-on') && coucheCouv) { $('couv-on').checked = false; coucheCouv.show = false; }
    majCalques();
  } catch (e) { dire('indisponible'); }
}

function allerVers(p) {
  const dx = (p.b[2] - p.b[0]) * 0.3, dy = (p.b[3] - p.b[1]) * 0.3;
  viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(p.b[0] - dx, p.b[1] - dy, p.b[2] + dx, p.b[3] + dy), duration: 2 });
}

// Liste des calques chargés : afficher / masquer, transparence, y aller, retirer.
function majCalques() {
  const z = $('calques-charges');
  if (!chargees.length) { z.innerHTML = '<div class="note-petite">Aucun. Cliquer sur le globe dans une zone colorée pour en charger.</div>'; return; }
  z.innerHTML = chargees.map((x, k) => `<div class="calque">
      <label class="ligne"><input type="checkbox" data-voir="${k}" ${x.couche.show ? 'checked' : ''}>
        <span class="pastille" style="background:${INSTRUMENTS[x.p.i]}"></span><span class="nom">${x.p.t}</span></label>
      <div class="aide">${x.p.n}${x.p.f != null ? ' · ' + etiquetteFinesse(x.p.f) : ''} · zoom max ${x.p.max}</div>
      <div class="ligne"><input type="range" min="0" max="1" step="0.05" value="${x.couche.alpha}" data-alpha="${k}" title="transparence">
        <button data-aller="${k}" title="Y aller">↗</button><button data-retirer="${k}" title="Retirer">×</button></div></div>`).join('');
  z.querySelectorAll('[data-voir]').forEach(i => (i.onchange = () => { chargees[+i.dataset.voir].couche.show = i.checked; }));
  z.querySelectorAll('[data-alpha]').forEach(i => (i.oninput = () => { chargees[+i.dataset.alpha].couche.alpha = +i.value; }));
  z.querySelectorAll('[data-aller]').forEach(b => (b.onclick = () => allerVers(chargees[+b.dataset.aller].p)));
  z.querySelectorAll('[data-retirer]').forEach(b => (b.onclick = () => {
    const x = chargees.splice(+b.dataset.retirer, 1)[0];
    viewer.imageryLayers.remove(x.couche, true);
    majCalques();
  }));
}

function allerA(l) {
  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(l.lon, l.lat, l.h, ell), duration: 3 });
  $('fiche-corps').innerHTML = `<b>${l.nom}</b> — ${l.txt}`;
}

// ---------- sites des missions et trajets des rovers
const JAUNE = '#ffb000';
const TYPES_SITE = { atterrissage: 'posé', impact: 'impact voulu', ecrasement: 'écrasé', visee: 'zone visée' };
const anneeDe = (d) => +String(d || '').slice(0, 4) || 0;
const coordTxt = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`;
const courtDe = (s) => s.nom.split(' — ')[0].replace(/\s*\(.*?\)/g, '');
const missionDe = (s) => ETAT.missions.find(m => m.id === s.mission) || { id: s.mission, nom: courtDe(s), agence: 'privée', corps: [s.corps], type: [], statut: '', lancement: s.date };
const couleurDe = (m) => AGENCES[m.agence] || AGENCES['privée'];
const posé = (s) => s.type === 'atterrissage' || s.type === 'impact';
const kmTxt = (km) => String(km).replace('.', ',');

function poserSites(cle) {
  const c = CORPS[cle], zone = $('sites-corps');
  sitesCorps = ETAT.sites.filter(s => s.corps === cle).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  tracesCorps = [];
  if (!sitesCorps.length) { zone.innerHTML = '<div class="note-petite">Aucune mission posée sur ce corps dans le catalogue.</div>'; return; }
  // Sans test de profondeur : l'épingle ne s'enfonce jamais dans le relief. La face cachée est masquée à part
  // (masquerFaceCachee), le test de profondeur de Cesium laissant passer les étiquettes à travers le globe.
  const pres = Number.POSITIVE_INFINITY;
  const etiquette = (texte, taille) => ({ text: texte, font: `500 ${taille}px Inter, system-ui, sans-serif`, fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.fromCssColorString('#1d2433'), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    horizontalOrigin: Cesium.HorizontalOrigin.LEFT, pixelOffset: new Cesium.Cartesian2(10, -6),
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: pres });
  sitesCorps.forEach((s, k) => {
    const col = Cesium.Color.fromCssColorString(couleurDe(missionDe(s)));
    // sites presque confondus (Perseverance et Ingenuity) : étiquettes décalées vers le bas
    const voisins = sitesCorps.slice(0, k).filter(o => Math.abs(o.lat - s.lat) < 0.05 && Math.abs(o.lon - s.lon) < 0.05).length;
    const lab = etiquette(courtDe(s), 12);
    lab.pixelOffset = new Cesium.Cartesian2(10, -6 + 15 * voisins);
    const e = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0, ell),
      point: { pixelSize: s.type === 'visee' ? 18 : 10, color: posé(s) ? col : col.withAlpha(s.type === 'visee' ? 0.2 : 0.08),
        outlineColor: posé(s) ? Cesium.Color.WHITE : col, outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: pres },
      label: lab,
    });
    e.site = s;
    const t = s.trace && ETAT.traces?.[s.trace];
    if (t) {
      const ligne = viewer.entities.add({ polyline: { positions: [], width: 3, material: Cesium.Color.fromCssColorString(JAUNE),
        depthFailMaterial: Cesium.Color.fromCssColorString(JAUNE).withAlpha(0.45) } });
      ligne.site = s;
      const [lon, lat, sol] = t.pts[t.pts.length - 1];
      const fin = viewer.entities.add({ position: Cesium.Cartesian3.fromDegrees(lon, lat, 0, ell),
        point: { pixelSize: 7, color: Cesium.Color.fromCssColorString(JAUNE), outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: pres },
        label: { ...etiquette(`${courtDe(s)} aujourd'hui · sol ${sol}`, 11), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000) } });
      fin.site = s;
      tracesCorps.push({ s, t, ligne, fin, e });
    } else tracesCorps.push({ s, e });
  });
  majTraces();
  zone.innerHTML = sitesCorps.map((s, k) => {
    const t = s.trace && ETAT.traces?.[s.trace];
    return `<div class="item" data-k="${k}"><span class="pastille" style="background:${couleurDe(missionDe(s))};${posé(s) ? '' : 'opacity:.4'}"></span>
      <span style="flex:1">${courtDe(s)} <span class="aide">${anneeDe(s.date)} · ${TYPES_SITE[s.type]}${t ? ` · trajet ${kmTxt(t.km)} km` : ''}</span></span></div>`;
  }).join('');
  zone.querySelectorAll('.item').forEach(el => (el.onclick = () => allerSite(sitesCorps[+el.dataset.k])));
  filtrerSites();
  viewer.scene.preRender.addEventListener(masquerFaceCachee);
}

// Une épingle derrière l'horizon (vue depuis la caméra) est cachée ; on ne touche aux entités que si ça change.
function masquerFaceCachee() {
  const occ = new Cesium.EllipsoidalOccluder(ell, viewer.camera.positionWC);
  for (const x of tracesCorps) {
    for (const [ent, lon, lat] of [[x.e, x.s.lon, x.s.lat], ...(x.fin ? [[x.fin, ...x.t.pts[x.t.pts.length - 1]]] : [])]) {
      ent._pos ??= Cesium.Cartesian3.fromDegrees(lon, lat, 0, ell);
      const vu = occ.isPointVisible(ent._pos);
      if (ent._vu !== vu) { ent._vu = vu; ent.point.show = vu; ent.label.show = vu; }
    }
  }
}

// Les trajets suivent le relief : hauteur lue dans la grille, multipliée par l'exagération (comme le terrain affiché).
function majTraces() {
  const exa = +$('exageration').value;
  for (const x of tracesCorps) {
    if (!x.ligne) continue;
    x.ligne.polyline.positions = x.t.pts.map(([lon, lat]) =>
      Cesium.Cartesian3.fromDegrees(lon, lat, (reliefActif ? hauteur(reliefActif, lon, lat) : 0) * exa + 10 * exa, ell));
  }
}

function filtrerSites() {
  const on = $('sites-on').checked;
  tracesCorps.forEach((x, k) => {
    const vis = on && anneeDe(x.s.date) <= anneeMax;
    x.e.show = vis;
    if (x.ligne) { x.ligne.show = vis; x.fin.show = vis; }
    $('sites-corps').querySelector(`[data-k="${sitesCorps.indexOf(x.s)}"]`)?.classList.toggle('estompe', !vis);
  });
}

function allerSite(s, charger = true) {
  if (anneeDe(s.date) > anneeMax) { $('sites-annee').value = $('sites-annee').max; $('sites-annee').oninput(); }
  if (!$('sites-on').checked) { $('sites-on').checked = true; filtrerSites(); }
  const exa = +$('exageration').value;
  const sol = reliefActif ? hauteur(reliefActif, s.lon, s.lat) * exa : 0;
  const t = s.trace && ETAT.traces?.[s.trace];
  if (t) {   // rover : cadrer tout le trajet
    const lons = t.pts.map(p => p[0]), lats = t.pts.map(p => p[1]);
    const w = Math.min(...lons), e = Math.max(...lons), so = Math.min(...lats), n = Math.max(...lats);
    const mx = (e - w) * 0.9 + 0.01, my = (n - so) * 0.3 + 0.01;   // large à gauche et à droite : les panneaux couvrent les bords
    viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(w - mx, so - my, e + mx, n + my), duration: 2.5 });
  } else {
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, sol + (s.h || 30000), ell), duration: 2.5 });
  }
  ficheSite(s, charger);
}

// Fiche d'un site : la mission, le lieu, le trajet éventuel, et les données disponibles à cet endroit.
function ficheSite(s, charger = false) {
  const m = missionDe(s), t = s.trace && ETAT.traces?.[s.trace];
  const prods = produitsIci(s.lon, s.lat, true);
  const f = $('fiche-zone'); f.hidden = false;
  f.innerHTML = ficheHTML(m, { voirTraj: !!ETAT.trajectoires?.[m.id], sites: [s], voirSite: false, globes: false })
    + (t ? `<p class="aide"><span class="pastille" style="background:${JAUNE}"></span> Trajet du rover : ${kmTxt(t.km)} km, du sol ${t.pts[0][2]} au sol ${t.pts[t.pts.length - 1][2]}
       (${t.pts.length} étapes publiées par la NASA, cartes MMGIS, relevées le ${t.maj}).</p>` : '')
    + (prods.length
      ? `<h3 style="margin-top:12px">Données à cet endroit (${prods.length})</h3>
         <div class="aide">Images et reliefs plus fins que le fond global, produits par les orbiteurs (LRO, MRO, Mars Express…).
         ${charger && meilleurProduit(prods) ? 'La photo la plus fine est chargée automatiquement.' : ''}</div>${listeProduitsHTML(prods)}`
      : '<p class="aide">Pas de mosaïque détaillée du catalogue NASA Trek à cet endroit : seul le fond global est disponible.</p>');
  f.querySelector('.fermer').onclick = () => (f.hidden = true);
  f.querySelector('[data-traj]')?.addEventListener('click', () => ACTIONS.voirTrajectoire?.(m.id));
  f.querySelectorAll('[data-carto]').forEach(b => (b.onclick = () => montrerCartographie(m.id, b.dataset.carto)));
  brancherProduits(f, prods);
  const p = charger && meilleurProduit(prods);
  if (p) chargerMosaique(p, f.querySelector(`button[data-k="${prods.indexOf(p)}"]`), false);
}

// « Ce que la mission a cartographié » : son fond de globe, ses seules mosaïques régionales, ses instruments.
export async function montrerCartographie(id, corps) {
  const k = CARTOGRAPHIE[id], m = ETAT.missions.find(x => x.id === id);
  if (!k || !m) return;
  corps = corps || k.corps[0];
  if (corpsActif !== corps || !viewer) await ouvrirCorps(corps);
  const c = CORPS[corps];
  const iFond = couchesActives.findIndex(l => (k.fonds || []).includes(l.nom));
  if (iFond >= 0) poserBase(couchesActives, iFond, reliefActif, corps);
  const prods = couvertures[c.couverture] || [];
  const n = k.produits ? prods.filter(p => k.produits.test(p.t)).length : 0;
  filtreCouv = n ? { re: k.produits, nom: m.nom, n } : null;
  if (c.couverture) {
    dessinerCouverture(prods);
    if ($('couv-on') && coucheCouv) { $('couv-on').checked = true; coucheCouv.show = true; }
    majFiltreCouv();
  }
  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(c.lieux?.[0]?.lon ?? 0, 15, c.rayon * 3.2, ell), duration: 2 });

  const fonds = couchesActives.map((l, j) => [l, j]).filter(([l]) => (k.fonds || []).includes(l.nom));
  const f = $('fiche-zone'); f.hidden = false;
  f.innerHTML = ficheHTML(m, { voirTraj: !!ETAT.trajectoires?.[m.id], globes: false, voirSite: false, carto: false })
    + `<h3 style="margin-top:12px">Ce que ${m.nom} a cartographié</h3>
    <ul>${k.instruments.map(([nom, txt]) => `<li><b>${nom}</b> : ${txt}</li>`).join('')}</ul>
    ${fonds.length ? `<div class="actions"><span class="aide">Fond${fonds.length > 1 ? 's' : ''} de ce globe venant de la mission :</span>
      ${fonds.map(([l, j]) => `<button data-fond="${j}">${l.nom}</button>`).join('')}</div>` : ''}
    ${n ? `<p class="aide">Ses ${n} mosaïques régionales sont en couleur sur le globe, les autres sont masquées
      (« tout afficher » dans « Couverture détaillée »). Clic sur une zone colorée : la liste, à charger.</p>`
      : (c.couverture ? '<p class="aide">Aucune mosaïque régionale de cette mission dans le catalogue NASA Trek.</p>' : '')}`;
  f.querySelector('.fermer').onclick = () => (f.hidden = true);
  f.querySelector('[data-traj]')?.addEventListener('click', () => ACTIONS.voirTrajectoire?.(m.id));
  f.querySelectorAll('[data-fond]').forEach(b => (b.onclick = () => poserBase(couchesActives, +b.dataset.fond, reliefActif, corpsActif)));
}

function majFiltreCouv() {
  const z = $('filtre-couv'); if (!z) return;
  if (!filtreCouv) { z.innerHTML = ''; return; }
  const de = /^[aeiouyhâéèêîô]/i.test(filtreCouv.nom) ? "d'" : 'de ';
  z.innerHTML = `<div class="filtre-actif">Seulement les ${filtreCouv.n} mosaïques ${de}${filtreCouv.nom} · <button id="couv-tout">tout afficher</button></div>`;
  $('couv-tout').onclick = () => { filtreCouv = null; dessinerCouverture(couvertures[CORPS[corpsActif].couverture] || []); majFiltreCouv(); };
}

// Ouvre le globe du corps du site (si besoin) puis y va.
export async function montrerSite(id) {
  const s = ETAT.sites.find(x => x.mission === id); if (!s) return;
  if (corpsActif !== s.corps || !viewer) await ouvrirCorps(s.corps);
  allerSite(s);
}
