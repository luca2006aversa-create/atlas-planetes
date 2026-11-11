// Vue « Missions » : frise 1957-2040 par destination, missions par décennie et par agence,
// premières technologiques. Données : donnees/missions.json (catalogue à vérifier, voir a_verifier).
import { AGENCES, GLOBES, CORPS, CARTOGRAPHIE } from './corps.js';

const $ = (id) => document.getElementById(id);
const AN0 = 1957, AN1 = 2040;
const AUJ = new Date();
const VOIES = [
  ['Soleil', ['soleil']], ['Mercure, Vénus', ['mercure', 'venus']], ['Lune', ['lune']], ['Mars', ['mars']],
  ['Astéroïdes, comètes', ['asteroide', 'comete']], ['Jupiter', ['jupiter']], ['Saturne', ['saturne']],
  ['Uranus, Neptune, Pluton, au-delà', ['uranus', 'neptune', 'pluton', 'interstellaire']],
];
const STATUTS = ['terminée', 'en cours', 'à venir', 'échec', 'annulée'];
const TYPES = { survol: 'survol', orbiteur: 'orbiteur', atterrisseur: 'atterrisseur', rover: 'rover', 'retour-echantillons': "retour d'échantillons",
  equipage: 'équipage', impacteur: 'impacteur', ballon: 'ballon', helicoptere: 'hélicoptère' };
const GLOBE_DE = { lune: 'lune', mars: 'mars', mercure: 'mercure', venus: 'venus', terre: 'terre' };

const annee = (d) => (d ? +String(d).slice(0, 4) + ((+String(d).slice(5, 7) || 6) - 1) / 12 : null);
const agence = (m) => (AGENCES[m.agence] ? m.agence : 'privée');

const coordTxt = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`;

// opts : voirTraj (bouton trajectoire), sites (ceux de donnees/sites.json pour cette mission),
// voirSite (false : pas de bouton « voir le site »), globes (false : pas de bouton « globe »),
// carto (false : pas de bouton « ce qu'elle a cartographié »).
export function ficheHTML(m, opts = {}) {
  const fin = m.fin ? ` → ${m.fin}` : (m.statut === 'en cours' ? ' → en cours' : '');
  const sites = opts.sites || [];
  const boutonSite = sites.length && opts.voirSite !== false;
  const carto = opts.carto === false ? [] : (CARTOGRAPHIE[m.id]?.corps || []);
  const globes = opts.globes === false ? []
    : (m.corps || []).map(c => GLOBE_DE[c]).filter(g => g && !(boutonSite && sites.some(s => s.corps === g)) && !carto.includes(g));
  return `<button class="fermer" title="Fermer">×</button>
  <h3>${m.nom}</h3>
  <div class="meta"><span class="pastille" style="background:${AGENCES[agence(m)]}"></span> ${m.agence}${m.operateur ? ` · ${m.operateur}` : ''} · ${m.lancement}${fin} · <b>${m.statut}</b></div>
  <div><b>Cible :</b> ${m.cible}. <b>Type :</b> ${(m.type || []).map(t => TYPES[t] || t).join(', ')}.</div>
  ${sites.map(s => `<div><b>${s.type === 'visee' ? 'Zone visée' : 'Site'} :</b> ${s.nom.split(' — ')[1] || s.nom} · ${coordTxt(s.lat, s.lon)}${s.approx ? ' (approximatif)' : ''}</div>`).join('')}
  <p>${m.resultats || ''}</p>
  ${m.premieres?.length ? `<b>Premières</b><ul>${m.premieres.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
  ${m.techno ? `<div><b>Technologie clé :</b> ${m.techno}</div>` : ''}
  ${m.a_verifier ? '<p class="aide">⚠ Fiche à vérifier : catalogue rédigé sans contrôle en ligne pour cette mission.</p>' : ''}
  <div class="actions">
    ${boutonSite ? `<button data-site class="principal">voir le site sur le globe (${CORPS[sites[0].corps].nom})</button>` : ''}
    ${carto.map(c => `<button data-carto="${c}" class="principal">ce qu'elle a cartographié${carto.length > 1 || boutonSite ? ` : ${CORPS[c].nom}` : ''}</button>`).join('')}
    ${m.lien ? `<a href="${m.lien}" target="_blank" rel="noopener">page officielle</a>` : ''}
    ${opts.voirTraj ? '<button data-traj>voir la trajectoire</button>' : ''}
    ${[...new Set(globes)].map(g => `<button data-globe="${g}">globe : ${CORPS[g].nom}</button>`).join('')}
  </div>`;
}

export function initMissions(ETAT, actions) {
  const missions = ETAT.missions;
  const filtres = { agences: new Set(Object.keys(AGENCES).filter(a => a !== 'Roscosmos')), statuts: new Set(STATUTS) };
  const ag = $('filtres-agence'), st = $('filtres-statut');
  ag.innerHTML = Object.keys(AGENCES).filter(a => a !== 'Roscosmos').map(a =>
    `<button class="actif" data-a="${a}"><span class="pastille" style="background:${AGENCES[a]}"></span> ${a === 'URSS' ? 'URSS / Russie' : a}</button>`).join('');
  st.innerHTML = STATUTS.map(s => `<button class="actif" data-s="${s}">${s}</button>`).join('');
  const bascule = (set, v, b) => { set.has(v) ? set.delete(v) : set.add(v); b.classList.toggle('actif'); dessiner(); };
  ag.querySelectorAll('button').forEach(b => (b.onclick = () => bascule(filtres.agences, b.dataset.a, b)));
  st.querySelectorAll('button').forEach(b => (b.onclick = () => bascule(filtres.statuts, b.dataset.s, b)));

  const ouvrir = (m) => {
    const f = $('fiche-mission'); f.hidden = false;
    f.innerHTML = ficheHTML(m, { voirTraj: !!ETAT.trajectoires[m.id], sites: (ETAT.sites || []).filter(s => s.mission === m.id) });
    f.querySelector('.fermer').onclick = () => (f.hidden = true);
    f.querySelector('[data-site]')?.addEventListener('click', () => actions.voirSite(m.id));
    f.querySelectorAll('[data-carto]').forEach(b => (b.onclick = () => actions.voirCarto(m.id, b.dataset.carto)));
    f.querySelector('[data-traj]')?.addEventListener('click', () => actions.voirTrajectoire(m.id));
    f.querySelectorAll('[data-globe]').forEach(b => (b.onclick = () => actions.ouvrirGlobe(b.dataset.globe)));
  };

  function dessiner() {
    const vis = missions.filter(m => filtres.agences.has(agence(m) === 'privée' ? 'privée' : (m.agence === 'Roscosmos' ? 'URSS' : agence(m))) && filtres.statuts.has(m.statut));
    frise(vis, ouvrir);
    histogramme(vis);
    premieres(vis, ouvrir);
  }
  dessiner();
  window.addEventListener('resize', () => { if ($('vue-missions').classList.contains('actif')) dessiner(); });
}

function frise(vis, ouvrir) {
  const W = Math.max(700, $('frise').clientWidth - 32 || 1100), G = 190, D = 16;
  const x = (a) => G + (a - AN0) / (AN1 - AN0) * (W - G - D);
  const auj = AUJ.getFullYear() + AUJ.getMonth() / 12;
  let y = 30, svg = '';
  for (const [nom, corps] of VOIES) {
    const ms = vis.filter(m => corps.includes((m.corps || []).find(c => VOIES.some(v => v[1].includes(c)))))
      .sort((a, b) => annee(a.lancement) - annee(b.lancement));
    const rangs = [];
    const barres = ms.map(m => {
      const a0 = annee(m.lancement);
      let a1 = m.fin ? annee(m.fin) + (String(m.fin).length === 4 ? 0.9 : 0) : (m.statut === 'en cours' ? auj : a0 + 0.4);
      if (m.statut === 'échec') a1 = Math.max(a0 + 0.15, Math.min(a1, a0 + 1));
      const x0 = x(a0), x1 = Math.max(x(a1), x0 + 4), lx = x1 + 4 + m.nom.length * 5.6;
      let r = rangs.findIndex(fin => fin < x0 - 4);
      if (r < 0) { rangs.push(0); r = rangs.length - 1; }
      rangs[r] = lx;
      return { m, x0, x1, r };
    });
    const h = Math.max(1, rangs.length) * 15 + 14;
    svg += `<rect x="0" y="${y - 6}" width="${W}" height="${h}" fill="${VOIES.findIndex(v => v[0] === nom) % 2 ? '#f6f4ef' : '#efece4'}"/>`;
    svg += `<text x="8" y="${y + 8}" font-size="12" font-weight="600" fill="#1d2433">${nom}</text><text x="8" y="${y + 22}" font-size="11" fill="#6b7280">${ms.length} mission(s)</text>`;
    for (const b of barres) {
      const yy = y + b.r * 15, c = AGENCES[agence(b.m)] || '#999';
      const avenir = b.m.statut === 'à venir' || b.m.statut === 'annulée', echec = b.m.statut === 'échec' || b.m.statut === 'annulée';
      svg += `<g class="barre" data-id="${b.m.id}" style="cursor:pointer"><title>${b.m.nom} — ${b.m.lancement} · ${b.m.statut}</title>
        <rect x="${b.x0}" y="${yy}" width="${b.x1 - b.x0}" height="9" rx="2" fill="${avenir || echec ? 'none' : c}" stroke="${c}" stroke-width="1.3" ${avenir ? 'stroke-dasharray="3 2"' : ''}/>
        ${echec ? `<line x1="${b.x0}" y1="${yy}" x2="${b.x1}" y2="${yy + 9}" stroke="${c}" stroke-width="1.3"/>` : ''}
        <text x="${b.x1 + 4}" y="${yy + 8}" font-size="10" fill="#1d2433">${b.m.nom}</text></g>`;
    }
    y += h + 4;
  }
  let axe = '';
  for (let a = 1960; a <= AN1; a += 10) axe += `<line x1="${x(a)}" y1="18" x2="${x(a)}" y2="${y}" stroke="#d9d4c7"/><text x="${x(a)}" y="13" font-size="11" text-anchor="middle" fill="#6b7280">${a}</text>`;
  axe += `<line x1="${x(auj)}" y1="18" x2="${x(auj)}" y2="${y}" stroke="#e4572e" stroke-width="1.5"/><text x="${x(auj) - 4}" y="13" font-size="11" text-anchor="end" fill="#e4572e" stroke="#f6f4ef" stroke-width="3" paint-order="stroke">aujourd'hui</text>`;
  const leg = `<text x="${W - 16}" y="${y + 16}" font-size="11" fill="#6b7280" text-anchor="end">plein : terminée ou en cours · pointillé : à venir · barré : échec · clic : fiche</text>`;
  $('frise').innerHTML = `<svg width="${W}" height="${y + 24}" font-family="Inter, system-ui, sans-serif">${svg}${axe}${leg}</svg>`;
  $('frise').querySelectorAll('.barre').forEach(g => (g.onclick = () => ouvrir(vis.find(m => m.id === g.dataset.id))));
}

function histogramme(vis) {
  const decs = []; for (let d = 1950; d <= 2030; d += 10) decs.push(d);
  const ags = Object.keys(AGENCES).filter(a => a !== 'Roscosmos');
  const cpt = decs.map(d => {
    const o = {}; vis.forEach(m => { const a = Math.floor(annee(m.lancement) / 10) * 10; if (a === d) { const k = m.agence === 'Roscosmos' ? 'URSS' : agence(m); o[k] = (o[k] || 0) + 1; } }); return o;
  });
  const max = Math.max(1, ...cpt.map(o => Object.values(o).reduce((s, v) => s + v, 0)));
  const W = 460, H = 220, bw = (W - 40) / decs.length;
  let s = '';
  decs.forEach((d, i) => {
    let y = H - 20;
    ags.forEach(a => {
      const n = cpt[i][a] || 0; if (!n) return;
      const h = n / max * (H - 40);
      s += `<rect x="${30 + i * bw + 3}" y="${y - h}" width="${bw - 6}" height="${h}" fill="${AGENCES[a]}"><title>${a} : ${n}</title></rect>`;
      y -= h;
    });
    s += `<text x="${30 + i * bw + bw / 2}" y="${H - 5}" font-size="10.5" text-anchor="middle" fill="#6b7280">${d}s</text>`;
  });
  $('histogramme').innerHTML = `<svg width="${W}" height="${H}" font-family="Inter, system-ui, sans-serif">${s}</svg>
    <div class="aide">Des deux puissances de la guerre froide à une dizaine d'acteurs : agences chinoise, indienne, japonaise, émiratie, et entreprises privées depuis les années 2020.</div>`;
}

function premieres(vis, ouvrir) {
  const lignes = [];
  vis.forEach(m => (m.premieres || []).forEach(p => {
    const an = (p.match(/\b(19|20)\d\d\b/) || [])[0] || String(m.lancement).slice(0, 4);
    lignes.push({ an: +an, p, m });
  }));
  lignes.sort((a, b) => a.an - b.an);
  $('premieres').innerHTML = lignes.map((l, i) => `<div class="item" data-i="${i}"><b>${l.an}</b><span>${l.p} <span class="aide">— ${l.m.nom}</span></span></div>`).join('');
  $('premieres').querySelectorAll('.item').forEach(e => (e.onclick = () => ouvrir(lignes[+e.dataset.i].m)));
}
