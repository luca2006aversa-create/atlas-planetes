// Vue « Système solaire » : positions réelles des planètes (JPL Horizons) et trajectoires des sondes,
// pilotées par une frise temporelle 1957-2040. Distances « comprimées » (racine carrée) par défaut,
// pour voir à la fois Mercure et Voyager ; tailles des planètes non à l'échelle.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CORPS, AGENCES } from './corps.js';
import { ficheHTML } from './missions.js';

const $ = (id) => document.getElementById(id);
const JOUR0 = Date.UTC(1957, 9, 4) / 864e5, JOUR1 = Date.UTC(2040, 0, 1) / 864e5;
const AUJ = Math.floor(Date.now() / 864e5);
let scene, camera, rendu, controles, ETAT, actions;
let jour = AUJ, lecture = false, echelle = 'racine', surligne = null;
const planetes = {}, sondes = {}, etiquettes = [];

const versScene = (x, y, z) => {                       // écliptique (UA) → scène, y vers le haut
  const r = Math.hypot(x, y, z) || 1e-9;
  const f = echelle === 'racine' ? (8 * Math.sqrt(r)) / r : 3;
  return new THREE.Vector3(x * f, z * f, -y * f);
};

function interpole(pts, j) {                           // pts : [jour, x, y, z] triés
  if (!pts || j < pts[0][0] || j > pts[pts.length - 1][0]) return null;
  let a = 0, b = pts.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; (pts[m][0] <= j ? (a = m) : (b = m)); }
  const p = pts[a], q = pts[b], f = q[0] === p[0] ? 0 : (j - p[0]) / (q[0] - p[0]);
  return [p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] + (q[3] - p[3]) * f];
}
const indexAvant = (pts, j) => { let a = 0, b = pts.length - 1; if (j < pts[0][0]) return 0; if (j >= pts[b][0]) return pts.length;
  while (b - a > 1) { const m = (a + b) >> 1; (pts[m][0] <= j ? (a = m) : (b = m)); } return a + 1; };

function ligne(pts, couleur, opacite) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pts.length * 3), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: opacite }));
  l.userData.pts = pts;
  return l;
}
function recalerLigne(l) {
  const a = l.geometry.attributes.position;
  l.userData.pts.forEach((p, i) => { const v = versScene(p[1], p[2], p[3]); a.setXYZ(i, v.x, v.y, v.z); });
  a.needsUpdate = true; l.geometry.computeBoundingSphere();
}

function etiquette(texte, classe, clic) {
  const s = document.createElement('span'); s.textContent = texte; s.className = classe || '';
  if (clic) { s.classList.add('ouvrable'); s.onclick = clic; }
  $('etiquettes').appendChild(s);
  return s;
}

export async function initSysteme(etat, act) {
  ETAT = etat; actions = act;
  const zone = $('scene');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(0, 70, 95);
  rendu = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  rendu.setPixelRatio(Math.min(2, devicePixelRatio));
  rendu.setClearColor('#0b0f17');
  zone.appendChild(rendu.domElement);
  controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = true;

  // étoiles de fond
  const et = new Float32Array(3000);
  for (let i = 0; i < et.length; i++) et[i] = (Math.random() - 0.5) * 3000;
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(et, 3));
  scene.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0x8892a6, size: 1.2, sizeAttenuation: false })));

  // soleil
  const soleil = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 16), new THREE.MeshBasicMaterial({ color: CORPS.soleil.couleur }));
  scene.add(soleil);
  etiquettes.push({ el: etiquette('Soleil'), pos: () => new THREE.Vector3() });

  // planètes
  const P = ETAT.planetes || {};
  for (const [cle, pts] of Object.entries(P)) {
    if (!pts || !CORPS[cle]) continue;
    const c = CORPS[cle];
    const orbite = ligne(pts, 0x8a94a8, 0.35); scene.add(orbite);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22 * c.taille, 24, 12), new THREE.MeshBasicMaterial({ color: c.couleur }));
    scene.add(m);
    if (c.anneau) {
      const an = new THREE.Mesh(new THREE.RingGeometry(0.22 * c.taille * 1.4, 0.22 * c.taille * 2.2, 48),
        new THREE.MeshBasicMaterial({ color: c.couleur, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      an.rotation.x = -Math.PI / 2 + 0.47; m.add(an);
    }
    planetes[cle] = { pts, m, orbite };
    const ouvrable = c.rayon ? () => actions.ouvrirGlobe(cle) : null;
    etiquettes.push({ el: etiquette(c.nom, '', ouvrable), pos: () => m.position });
    // lunes ouvrables, posées autour de leur planète (pas à l'échelle)
    Object.entries(CORPS).filter(([, l]) => l.parent === cle).forEach(([lc, l], k, tab) => {
      const lm = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: l.couleur }));
      scene.add(lm);
      const ang = (k / tab.length) * Math.PI * 2 + 0.6, d = 0.22 * c.taille + 0.9;
      const pos = () => lm.position.copy(m.position).add(new THREE.Vector3(Math.cos(ang) * d, 0.4, Math.sin(ang) * d));
      etiquettes.push({ el: etiquette(l.nom, 'lune', () => actions.ouvrirGlobe(lc)), pos, petit: true });
    });
  }

  // sondes
  for (const m of ETAT.missions) {
    const pts = ETAT.trajectoires[m.id];
    if (!pts || pts.length < 2) continue;
    const coul = new THREE.Color(AGENCES[m.agence] || '#9aa3b2');
    const trace = ligne(pts, coul, 0.13), parcours = ligne(pts, coul.clone().lerp(new THREE.Color('#ffffff'), 0.25), 0.95);
    scene.add(trace); scene.add(parcours);              // trace = tout le trajet, parcours = jusqu'à la date
    const pt = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6), new THREE.MeshBasicMaterial({ color: coul }));
    scene.add(pt);
    sondes[m.id] = { m, pts, trace, parcours, pt, el: etiquette(m.nom, 'sonde') };
    sondes[m.id].el.onclick = () => montrerMission(m.id);
    sondes[m.id].el.style.pointerEvents = 'auto'; sondes[m.id].el.style.cursor = 'pointer';
  }
  Object.values(planetes).forEach(p => recalerLigne(p.orbite));
  Object.values(sondes).forEach(s => { recalerLigne(s.trace); recalerLigne(s.parcours); });

  // commandes
  const cur = $('curseur-date'); cur.min = JOUR0; cur.max = JOUR1; cur.value = jour;
  cur.oninput = () => { jour = +cur.value; majDate(); };
  $('lecture').onclick = () => { lecture = !lecture; $('lecture').textContent = lecture ? '❚❚ Pause' : '▶ Lecture'; };
  $('aujourdhui').onclick = () => { jour = AUJ; majDate(); };
  document.querySelectorAll('[data-echelle]').forEach(b => (b.onclick = () => {
    echelle = b.dataset.echelle;
    document.querySelectorAll('[data-echelle]').forEach(x => x.classList.toggle('actif', x === b));
    Object.values(planetes).forEach(p => recalerLigne(p.orbite));
    Object.values(sondes).forEach(s => { recalerLigne(s.trace); recalerLigne(s.parcours); });
    majDate();
    camera.position.multiplyScalar(echelle === 'racine' ? 0.35 : 2.8);
  }));
  if (!ETAT.planetes) $('sondes-actives').innerHTML = '<div class="note-petite">Données des orbites absentes : lancer outils/preparer.py planetes.</div>';

  window.addEventListener('resize', taille);
  taille(); majDate();
  let t0 = performance.now();
  rendu.setAnimationLoop(t => {
    const dt = (t - t0) / 1000; t0 = t;
    if (lecture) { jour = Math.min(JOUR1, jour + dt * +$('vitesse').value); if (jour >= JOUR1) lecture = false; majDate(true); }
    controles.update();
    rendu.render(scene, camera);
    placerEtiquettes();
  });
}

function taille() {
  const z = $('scene'); if (!z.clientWidth) return;
  camera.aspect = z.clientWidth / z.clientHeight; camera.updateProjectionMatrix();
  rendu.setSize(z.clientWidth, z.clientHeight);
}

let derniereListe = '';
function majDate(enLecture) {
  const d = new Date(jour * 864e5);
  $('date-affichee').textContent = d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: enLecture ? undefined : 'numeric' });
  if (!enLecture) $('curseur-date').value = jour; else $('curseur-date').value = Math.round(jour);
  for (const p of Object.values(planetes)) { const q = interpole(p.pts, jour); if (q) p.m.position.copy(versScene(...q)); }
  for (const s of Object.values(sondes)) {
    const q = interpole(s.pts, jour);
    s.pt.visible = !!q; s.el.style.display = q ? '' : 'none';
    if (q) s.pt.position.copy(versScene(...q));
    s.parcours.geometry.setDrawRange(0, indexAvant(s.pts, jour));
    const mis = surligne === s.m.id;
    s.trace.material.opacity = surligne ? (mis ? 0.5 : 0.04) : 0.13;
    s.parcours.material.opacity = surligne ? (mis ? 1 : 0.15) : 0.95;
  }
  // liste des missions en vol
  const actives = ETAT.missions.filter(m => {
    const deb = Date.parse(m.lancement) / 864e5, fin = m.fin ? Date.parse(String(m.fin).length === 4 ? `${m.fin}-12-31` : `${m.fin}-28`) / 864e5 : (m.statut === 'en cours' ? Infinity : deb + 30);
    return deb <= jour && jour <= fin && m.statut !== 'à venir';
  });
  const cle = actives.map(m => m.id).join();
  if (cle !== derniereListe) {
    derniereListe = cle;
    $('sondes-actives').innerHTML = actives.length ? actives.map(m =>
      `<div class="item" data-id="${m.id}"><span class="pastille" style="background:${AGENCES[m.agence] || '#999'}"></span><span>${m.nom}</span><span class="aide" style="margin-left:auto">${m.cible.split(',')[0]}</span></div>`).join('')
      : '<div class="note-petite">Aucune sonde en vol.</div>';
    $('sondes-actives').querySelectorAll('.item').forEach(e => (e.onclick = () => montrerMission(e.dataset.id)));
  }
}

function placerEtiquettes() {
  const z = $('scene'), w = z.clientWidth, h = z.clientHeight, v = new THREE.Vector3();
  for (const e of etiquettes) {
    v.copy(e.pos()).project(camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    e.el.style.display = vis ? '' : 'none';
    if (vis) { e.el.style.left = `${(v.x + 1) / 2 * w}px`; e.el.style.top = `${(1 - v.y) / 2 * h}px`; }
  }
  for (const s of Object.values(sondes)) {
    if (!s.pt.visible) continue;
    v.copy(s.pt.position).project(camera);
    s.el.style.left = `${(v.x + 1) / 2 * w}px`; s.el.style.top = `${(1 - v.y) / 2 * h}px`;
    s.el.style.display = v.z < 1 && (!surligne || surligne === s.m.id || derniereListe.split(',').length < 12) ? '' : 'none';
  }
}

export function montrerMission(id) {
  const m = ETAT.missions.find(x => x.id === id); if (!m) return;
  surligne = id;
  const s = sondes[id];
  if (s) {
    const fin = s.pts[s.pts.length - 1][0];
    if (jour < s.pts[0][0] || jour > fin) jour = Math.min(fin, s.pts[0][0] + (fin - s.pts[0][0]) * 0.6);
  } else if (m.lancement) jour = Math.max(JOUR0, Math.min(JOUR1, Date.parse(m.lancement) / 864e5 + 60));
  majDate();
  const f = $('fiche-systeme');
  f.hidden = false;
  f.innerHTML = ficheHTML(m, { trajectoire: !!s, sites: (ETAT.sites || []).filter(x => x.mission === id) })
    + '<div class="actions"><button id="fs-voir-tout">Voir toutes les sondes</button></div>';
  f.querySelector('[data-site]')?.addEventListener('click', () => actions.voirSite?.(id));
  f.querySelectorAll('[data-carto]').forEach(b => (b.onclick = () => actions.voirCarto?.(id, b.dataset.carto)));
  f.querySelector('.fermer').onclick = () => { f.hidden = true; surligne = null; majDate(); };
  f.querySelector('#fs-voir-tout').onclick = () => { surligne = null; majDate(); };
  f.querySelectorAll('[data-globe]').forEach(b => (b.onclick = () => actions.ouvrirGlobe(b.dataset.globe)));
}
