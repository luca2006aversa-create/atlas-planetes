// Aiguillage entre les quatre vues et données partagées.
// Chaque vue ne charge que ce dont elle a besoin : les données (en parallèle), son module (three.js pour le système,
// globe.js + CesiumJS pour les globes). Rien n'est chargé tant que la vue n'est pas ouverte.
import { initMissions } from './missions.js';
import { CARTOGRAPHIE } from './corps.js';

const charger = (f) => fetch(`donnees/${f}`).then(r => (r.ok ? r.json() : null)).catch(() => null);

export const ETAT = { missions: [], planetes: null, trajectoires: {}, sites: [], traces: {} };
const pret = {};

// Formats compacts (outils/preparer.py, empaqueter) : positions en entiers 1/q UA, différences en int16/int32 base64.
function depaqueter(o) {
  if (!o || !o.s) return o;                                     // ancien format : déjà [[jour, x, y, z], ...]
  const sortie = {};
  for (const [cle, e] of Object.entries(o.s)) {
    const bin = atob(e.d), oct = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) oct[i] = bin.charCodeAt(i);
    const d = e.w === 4 ? new Int32Array(oct.buffer) : new Int16Array(oct.buffer);
    let [x, y, z] = e.x0;
    const pts = new Array(e.n);
    pts[0] = [e.j0, x / e.q, y / e.q, z / e.q];
    for (let i = 1; i < e.n; i++) {
      x += d[3 * i - 3]; y += d[3 * i - 2]; z += d[3 * i - 1];
      pts[i] = [e.j0 + e.pas * i, x / e.q, y / e.q, z / e.q];
    }
    sortie[cle] = pts;
  }
  return sortie;
}

// Chaque fichier n'est demandé qu'une fois (promesse mise en cache) ; chaque vue déclare ce qu'elle utilise.
const sources = {
  missions: () => charger('missions.json').then(d => (ETAT.missions = d || [])),
  planetes: () => charger('planetes.json').then(d => (ETAT.planetes = depaqueter(d))),
  trajectoires: () => charger('trajectoires.json').then(d => (ETAT.trajectoires = depaqueter(d) || {})),
  sites: () => charger('sites.json').then(d => (ETAT.sites = d?.sites || [])),
  traces: () => charger('traces.json').then(d => (ETAT.traces = d || {})),
};
const promesses = {};
const donnees = (...noms) => Promise.all(noms.map(n => (promesses[n] ??= sources[n]())));
const BESOINS = {
  systeme: ['missions', 'planetes', 'trajectoires', 'sites'],
  globe: ['missions', 'sites', 'traces', 'trajectoires'],
  missions: ['missions', 'trajectoires', 'sites'],
  projets: [],
};

// CesiumJS (1,3 Mo compressé) : chargé à la première ouverture d'un globe, ou dès que la souris approche du bouton.
let promesseCesium = null;
const CESIUM = 'https://cdn.jsdelivr.net/npm/cesium@1.122.0/Build/Cesium/';
export function chargerCesium() {
  if (window.Cesium) return Promise.resolve();
  return (promesseCesium ??= new Promise((ok, ko) => {
    window.CESIUM_BASE_URL = CESIUM;
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${CESIUM}Widgets/widgets.css`;
    document.head.insertBefore(css, document.querySelector('link[href="style.css"]'));   // avant style.css : garde l'ordre d'origine
    const s = document.createElement('script'); s.src = `${CESIUM}Cesium.js`;
    s.onload = ok; s.onerror = () => { promesseCesium = null; ko(new Error('CesiumJS indisponible')); };
    document.head.appendChild(s);
  }));
}

// three.js est demandé en même temps que systeme.js (au lieu d'attendre que systeme.js l'importe) : un aller-retour de moins.
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const precharges = new Set();
function precharger(...urls) {
  for (const u of urls) {
    if (precharges.has(u)) continue;
    precharges.add(u);
    const l = document.createElement('link'); l.rel = 'modulepreload'; l.href = u; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
}
const modules = {
  systeme: () => (precharger(`${THREE}build/three.module.js`, `${THREE}examples/jsm/controls/OrbitControls.js`), import('./systeme.js')),
  globe: () => import('./globe.js'),
  projets: () => import('./projets.js'),
};

// opts.corps : globe à ouvrir en premier (évite d'ouvrir la Lune pour la remplacer aussitôt) ;
// opts.suffit : l'ouvrir ainsi suffit, `apres` n'est pas rappelé à la première ouverture.
async function vue(nom, apres, opts = {}) {
  document.querySelectorAll('header nav button').forEach(b => b.classList.toggle('actif', b.dataset.vue === nom));
  document.querySelectorAll('.vue').forEach(v => v.classList.toggle('actif', v.id === `vue-${nom}`));
  window.dispatchEvent(new CustomEvent('atlas-vue', { detail: nom }));
  const premiere = !pret[nom];
  if (premiere) {
    pret[nom] = (async () => {
      const [mod] = await Promise.all([modules[nom]?.(), donnees(...BESOINS[nom]), nom === 'globe' ? chargerCesium() : null]);
      if (nom === 'systeme') await mod.initSysteme(ETAT, { ouvrirGlobe, voirSite, voirCarto });
      if (nom === 'globe') await mod.initGlobe(ETAT, { voirTrajectoire }, opts.corps);
      if (nom === 'projets') mod.initProjets(document.getElementById('vue-projets'));
      if (nom === 'missions') initMissions(ETAT, { voirTrajectoire, ouvrirGlobe, voirSite, voirCarto });
    })();
    pret[nom].catch(() => { pret[nom] = null; });                 // échec de chargement : on pourra réessayer
  }
  await pret[nom];
  if (premiere) performance.mark(`atlas-${nom}-prete`);          // mesure : performance.getEntriesByType('mark')
  window.dispatchEvent(new Event('resize'));
  if (apres && !(premiere && opts.suffit)) await apres(await modules[nom]?.());
  try { localStorage.setItem('atlas-vue', nom); } catch (e) { /* pas de stockage : sans importance */ }
}

export function ouvrirGlobe(corps) { return vue('globe', g => g.ouvrirCorps(corps), { corps, suffit: true }); }
export function voirTrajectoire(id) { return vue('systeme', s => s.montrerMission(id)); }
export function voirSite(id) {
  return donnees('sites').then(() => vue('globe', g => g.montrerSite(id), { corps: ETAT.sites.find(x => x.mission === id)?.corps }));
}
export function voirCarto(id, corps) { return vue('globe', g => g.montrerCartographie(id, corps), { corps: corps || CARTOGRAPHIE[id]?.corps[0] }); }

document.querySelectorAll('header nav button').forEach(b => (b.onclick = () => vue(b.dataset.vue)));
// anticipation : Cesium commence à se charger quand on approche du bouton « Globes 3D »
const bg = document.querySelector('header nav button[data-vue="globe"]');
['pointerenter', 'focus', 'touchstart'].forEach(ev => bg.addEventListener(ev, () => chargerCesium().catch(() => {}), { once: true, passive: true }));
// ... et aussi en survolant tout ce qui ouvre un globe : « voir le site », « globe », « cartographié », planète ouvrable
const OUVRE_GLOBE = '[data-site], [data-globe], [data-carto], #etiquettes .ouvrable';
const approche = (e) => {
  if (!window.Cesium && e.target.closest?.(OUVRE_GLOBE)) chargerCesium().catch(() => {});
};
document.addEventListener('pointerover', approche, { passive: true });
document.addEventListener('touchstart', approche, { passive: true });

const params = new URLSearchParams(location.search);
let depart = params.get('vue');
try { depart = depart || localStorage.getItem('atlas-vue'); } catch (e) { /* idem */ }
depart = ['systeme', 'globe', 'missions', 'projets'].includes(depart) ? depart : 'systeme';
const corpsUrl = params.get('corps');
if (corpsUrl) vue('globe', null, { corps: corpsUrl });         // ?corps=mars ouvre directement ce globe
else vue(depart);

// Thème clair (planche) / sombre : mémorisé, sans effet sur la scène (toujours sombre).
document.getElementById('theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'sombre' ? 'clair' : 'sombre';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('atlas-theme', t); } catch (e) { /* sans importance */ }
};
