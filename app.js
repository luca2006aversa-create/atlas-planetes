// Aiguillage entre les trois vues et données partagées.
import { initSysteme, montrerMission } from './systeme.js';
import { initGlobe, ouvrirCorps, montrerSite, montrerCartographie } from './globe.js';
import { initMissions } from './missions.js';

const charger = (f) => fetch(`donnees/${f}`).then(r => (r.ok ? r.json() : null)).catch(() => null);

export const ETAT = { missions: [], planetes: null, trajectoires: {}, sites: [], traces: {} };
const pret = {};

async function vue(nom, apres) {
  document.querySelectorAll('header nav button').forEach(b => b.classList.toggle('actif', b.dataset.vue === nom));
  document.querySelectorAll('.vue').forEach(v => v.classList.toggle('actif', v.id === `vue-${nom}`));
  if (!pret[nom]) {
    pret[nom] = true;
    if (nom === 'systeme') await initSysteme(ETAT, { ouvrirGlobe, voirSite, voirCarto });
    if (nom === 'globe') await initGlobe(ETAT, { voirTrajectoire });
    if (nom === 'missions') initMissions(ETAT, { voirTrajectoire, ouvrirGlobe, voirSite, voirCarto });
  }
  window.dispatchEvent(new Event('resize'));
  if (apres) apres();
  try { localStorage.setItem('atlas-vue', nom); } catch (e) { /* pas de stockage : sans importance */ }
}

export function ouvrirGlobe(corps) { vue('globe', () => ouvrirCorps(corps)); }
export function voirTrajectoire(id) { vue('systeme', () => montrerMission(id)); }
export function voirSite(id) { vue('globe', () => montrerSite(id)); }
export function voirCarto(id, corps) { vue('globe', () => montrerCartographie(id, corps)); }

document.querySelectorAll('header nav button').forEach(b => (b.onclick = () => vue(b.dataset.vue)));

const [missions, planetes, trajectoires, sites, traces] = await Promise.all([charger('missions.json'), charger('planetes.json'),
  charger('trajectoires.json'), charger('sites.json'), charger('traces.json')]);
ETAT.missions = missions || [];
ETAT.planetes = planetes;
ETAT.trajectoires = trajectoires || {};
ETAT.sites = sites?.sites || [];
ETAT.traces = traces || {};

const params = new URLSearchParams(location.search);
let depart = params.get('vue');
try { depart = depart || localStorage.getItem('atlas-vue'); } catch (e) { /* idem */ }
vue(['systeme', 'globe', 'missions'].includes(depart) ? depart : 'systeme',
  params.get('corps') ? () => ouvrirCorps(params.get('corps')) : null);
