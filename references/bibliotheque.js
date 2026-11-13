// Bibliothèque de projets : lit les fichiers JSON des agents de recherche (bibliotheque/*.json) et les affiche avec des filtres.
const FICHIERS = ['01-iss', '02-stations', '03-vehicules-gateway', '04-gonflables', '05-bases-lunaires-agences', '06-impression-3d-isru', '07-analogues', '08-milieux-extremes', '09-historique', '10-architectes', '11-films', '12-cyberpunk-utopies', '13-enterre-tubes-de-lave', '14-modeles-3d', '15-sas-portes-interieurs', '16-serres-mars'];
const NOMS = { '01-iss': 'ISS', '02-stations': 'Stations', '03-vehicules-gateway': 'Véhicules, Gateway', '04-gonflables': 'Gonflables', '05-bases-lunaires-agences': 'Bases lunaires', '06-impression-3d-isru': 'Impression 3D', '07-analogues': 'Analogues', '08-milieux-extremes': 'Milieux extrêmes', '09-historique': 'Historique', '10-architectes': 'Architectes', '11-films': 'Films', '12-cyberpunk-utopies': 'Cyberpunk, utopies', '13-enterre-tubes-de-lave': 'Enterré', '14-modeles-3d': 'Modèles 3D', '15-sas-portes-interieurs': 'Sas, portes, intérieurs', '16-serres-mars': 'Serres, Mars' };
const FORTS = ['plan', 'coupe', 'axonometrie', '3d'];
const ACCENTS = new RegExp('[\\u0300-\\u036f]', 'g');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const url = u => /^https?:\/\//.test(u || '') ? u : null;
const norm = s => String(s || '?').toLowerCase().split(/[|,/(]/)[0].trim().normalize('NFD').replace(ACCENTS, '') || '?';
const tab = x => Array.isArray(x) ? x : [];
const P = [], etat = { theme: null, doc: null, lieu: null, forme: null, q: '' };

function filtre(id, cle, valeurs, nom = v => v) {
  const el = document.getElementById(id);
  for (const [v, n] of valeurs) {
    const b = document.createElement('button');
    b.innerHTML = esc(nom(v)) + '<i>' + n + '</i>';
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      etat[cle] = etat[cle] === v ? null : v;
      for (const x of el.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b && etat[cle] === v));
      dessiner();
    };
    el.append(b);
  }
}
const compter = f => { const m = new Map(); for (const p of P) for (const v of new Set([].concat(f(p)))) m.set(v, (m.get(v) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };

function ligneDoc(d) {
  const u = url(d.url) || url(d.page_source), t = norm(d.type);
  const lien = u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(d.titre || u)}</a>` : esc(d.titre);
  const lic = d.licence && d.licence !== '?' ? ' · ' + esc(d.licence) : '';
  return `<li><span class="ty ${FORTS.includes(t) ? 'fort' : ''}">${esc(t)}</span><span>${lien} <span class="${d.verifie ? 'v' : 'nv'}">${d.verifie ? '✓' : '?'}</span><small>${esc(d.note || '')}${lic}</small></span></li>`;
}
function carte(p) {
  const docs = tab(p.documents).slice().sort((a, b) => FORTS.includes(norm(b.type)) - FORTS.includes(norm(a.type)));
  const dims = tab(p.dimensions).map(d => `<span><b>${esc(d.valeur)}</b> ${esc(d.quoi)}${url(d.source) ? ` <a href="${esc(d.source)}" target="_blank" rel="noopener">src</a>` : ''}</span>`).join('');
  const reste = docs.length > 6 ? `<details><summary>${docs.length - 6} autres documents</summary><ul class="docs">${docs.slice(6).map(ligneDoc).join('')}</ul></details>` : '';
  const av = tab(p.a_verifier);
  return `<article class="pr"><div class="haut"><h3>${esc(p.nom)}</h3><span class="an">${esc(p.annee || '')}</span></div>
  <div class="puces"><span class="puce t">${esc(NOMS[p._t] || p._t)}</span><span class="puce">${esc(norm(p.lieu))}</span><span class="puce">${esc(norm(p.statut))}</span><span class="puce">${esc(norm(p.forme))}</span></div>
  ${p.auteurs ? `<p class="aut">${esc(p.auteurs)}</p>` : ''}<p>${esc(p.resume || '')}</p>
  ${dims ? `<div class="dims">${dims}</div>` : ''}
  ${docs.length ? `<ul class="docs">${docs.slice(0, 6).map(ligneDoc).join('')}</ul>${reste}` : ''}
  ${p.pour_kibsu ? `<p class="kib">${esc(p.pour_kibsu)}</p>` : ''}
  ${av.length ? `<details><summary>À vérifier (${av.length})</summary><p>${av.map(esc).join('<br>')}</p></details>` : ''}</article>`;
}
function dessiner() {
  const q = etat.q.toLowerCase();
  const L = P.filter(p => (!etat.theme || p._t === etat.theme) && (!etat.lieu || norm(p.lieu) === etat.lieu) && (!etat.forme || norm(p.forme) === etat.forme)
    && (!etat.doc || p._types.has(etat.doc)) && (!q || p._txt.includes(q)));
  document.getElementById('liste').innerHTML = L.length ? L.map(carte).join('') : '<p class="vide">Rien ne correspond.</p>';
  document.getElementById('compte').textContent = L.length + ' / ' + P.length + ' projets';
}

const lus = await Promise.all(FICHIERS.map(f => fetch('bibliotheque/' + f + '.json').then(r => r.ok ? r.json() : null).catch(() => null)));
lus.forEach((J, i) => {
  for (const p of tab(J?.projets)) {
    p._txt = JSON.stringify(p).toLowerCase();
    p._t = FICHIERS[i];
    p._types = new Set(tab(p.documents).map(d => norm(d.type)));
    P.push(p);
  }
});
const D = P.flatMap(p => tab(p.documents)), n = t => D.filter(d => norm(d.type) === t).length;
document.getElementById('chiffres').innerHTML = [[P.length, 'projets'], [D.length, 'documents'], [n('plan'), 'plans'], [n('coupe'), 'coupes'], [n('3d'), 'modèles 3D'],
  [D.filter(d => d.verifie).length, 'liens vérifiés ✓'], [lus.filter(Boolean).length + ' / ' + FICHIERS.length, 'thèmes chargés']]
  .map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('');
filtre('f-theme', 'theme', compter(p => p._t), v => NOMS[v] || v);
filtre('f-doc', 'doc', compter(p => [...p._types]));
filtre('f-lieu', 'lieu', compter(p => norm(p.lieu)));
filtre('f-forme', 'forme', compter(p => norm(p.forme)));
document.getElementById('q').oninput = e => { etat.q = e.target.value; dessiner(); };
dessiner();
window.KIBSU_BIBLIO = { P, D };
