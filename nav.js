// Barre commune à toutes les pages de Kibsu. Une seule liste de pages, ici : ajouter une page = ajouter une ligne.
// Inclusion : <script src="(chemin)/nav.js" defer></script> dans le <head>.
// Options sur la balise script : data-fixe (la page gère déjà la place du haut, pas de marge ajoutée),
// data-ton="sombre" (barre sombre), data-theme (bouton ◐ de l'accueil).
// Un élément [data-kb-droite] de la page est rangé à droite dans la barre.
(function () {
  if (window.self !== window.top || new URLSearchParams(location.search).get('embed') === '1') return;   // vue incrustée : pas de barre
  var s = document.currentScript, BASE = new URL('.', s.src);
  var GROUPES = [
    { nom: 'Explorer', pages: [['Système', '?vue=systeme', 'systeme'], ['Planètes', '?vue=globe', 'globe'], ['Missions', '?vue=missions', 'missions']] },
    { nom: 'La Lune', pages: [['Étude', 'etude/'], ['Habitat 3D', 'projets/site3d.html']] },
    { nom: 'Projet', pages: [['Fiches', '?vue=projets', 'projets'], ['Atelier', 'projets/atelier.html'], ['Contrôles', 'projets/controle.html'], ['Radiations', 'projets/rayons.html']] },
    { nom: 'Références', pages: [['Références', 'references/']] }
  ];
  var chemin = function (p) { return p.replace(/index\.html$/, ''); };
  var ICI = chemin(location.pathname), ACCUEIL = ICI === chemin(BASE.pathname);

  var css = document.createElement('style');
  css.textContent =
    '.kb{position:fixed;top:0;left:0;right:0;height:46px;z-index:1500;display:flex;align-items:center;gap:6px;padding:0 12px;box-sizing:border-box;' +
    'background:#fbfaf7;color:#1d2433;border-bottom:1px solid #e2ddd2;font:13px/1.2 Inter,system-ui,sans-serif}' +
    '.kb.sombre,[data-theme=sombre] .kb{background:#12151c;color:#e8e4dc;border-color:#2a2f3a}' +
    '.kb .kb-marque{display:flex;align-items:center;gap:7px;font-weight:600;color:inherit;text-decoration:none;margin-right:6px;flex:none}' +
    '.kb .kb-marque img{width:28px;height:28px;border-radius:7px;display:block}' +
    '.kb nav{display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none;min-width:0;margin:0}' +
    '.kb nav a,.kb nav button{font:inherit;border:0;background:none;padding:6px 10px;border-radius:6px;cursor:pointer;color:inherit;text-decoration:none;white-space:nowrap;opacity:.72}' +
    '.kb nav a:hover,.kb nav button:hover{opacity:1;background:rgba(127,127,127,.14)}' +
    '.kb nav .kb-g.on{opacity:1;font-weight:600;background:rgba(127,127,127,.16)}' +
    '.kb nav .kb-p.on,.kb nav .kb-p.actif{opacity:1;background:#1d2433;color:#fbfaf7}' +
    '.kb.sombre nav .kb-p.on,[data-theme=sombre] .kb nav .kb-p.on,[data-theme=sombre] .kb nav .kb-p.actif{background:#e8e4dc;color:#12151c}' +
    '.kb .kb-sep{flex:none;width:1px;height:20px;background:currentColor;opacity:.25;margin:0 6px}' +
    '.kb .kb-droite{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none;opacity:.8}' +
    '.kb #theme{font:inherit;border:0;background:none;color:inherit;cursor:pointer;padding:6px;font-size:16px}' +
    '@media(max-width:700px){.kb .kb-marque b,.kb .kb-droite>*:not(#theme){display:none}}';
  document.head.appendChild(css);

  var lien = function (p, g) {
    if (ACCUEIL && p[2]) return '<button class="kb-p" data-g="' + g + '" data-vue="' + p[2] + '">' + p[0] + '</button>';   // l'accueil change de vue sans recharger (app.js)
    var href = new URL(p[1], BASE).href, on = !p[2] && chemin(new URL(href).pathname) === ICI;
    return '<a class="kb-p' + (on ? ' on' : '') + '" data-g="' + g + '" href="' + href + '"' + (on ? ' aria-current="page"' : '') + '>' + p[0] + '</a>';
  };
  var h = document.createElement('header');
  h.className = 'kb' + (s.dataset.ton === 'sombre' ? ' sombre' : '');
  h.innerHTML = '<a class="kb-marque" href="' + BASE.href + '"><img src="' + new URL('logo-d.png', BASE).href + '" alt=""><b>Kibsu</b></a>' +
    '<nav aria-label="Pages de Kibsu">' +
    GROUPES.map(function (g, i) { return '<a class="kb-g" data-groupe="' + i + '" href="' + new URL(g.pages[0][1], BASE).href + '">' + g.nom + '</a>'; }).join('') +
    '<span class="kb-sep"></span>' +
    GROUPES.map(function (g, i) { return g.pages.length > 1 ? g.pages.map(function (p) { return lien(p, i); }).join('') : ''; }).join('') +
    '</nav><span class="kb-droite"></span>';
  if (s.hasAttribute('data-theme')) h.querySelector('.kb-droite').innerHTML = '<button id="theme" type="button" aria-label="Thème clair ou sombre" title="Thème clair / sombre">◐</button>';

  // Le groupe actif : celui de la page ouverte (ou de la vue, sur l'accueil). Seules ses pages sont montrées.
  function groupe(i) {
    h.querySelectorAll('.kb-g').forEach(function (a) { a.classList.toggle('on', +a.dataset.groupe === i); });
    h.querySelectorAll('.kb-p').forEach(function (a) { a.hidden = +a.dataset.g !== i; });
    h.querySelector('.kb-sep').hidden = !GROUPES[i] || GROUPES[i].pages.length < 2;
  }
  var trouve = -1;
  GROUPES.forEach(function (g, i) { g.pages.forEach(function (p) { if (!p[2] && chemin(new URL(p[1], BASE).pathname) === ICI) trouve = i; }); });
  if (ACCUEIL) {
    var vueGroupe = function (v) { var r = 0; GROUPES.forEach(function (g, i) { g.pages.forEach(function (p) { if (p[2] === v) r = i; }); }); return r; };
    window.addEventListener('atlas-vue', function (e) {
      groupe(vueGroupe(e.detail));
      h.querySelectorAll('.kb-p[data-vue]').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === e.detail); });
    });
    h.querySelectorAll('.kb-g').forEach(function (a) {   // un groupe qui commence par une vue de l'accueil : on change de vue sur place
      var v = GROUPES[a.dataset.groupe].pages[0][2];
      if (v) a.onclick = function (ev) { ev.preventDefault(); h.querySelector('[data-vue="' + v + '"]').click(); };
    });
    trouve = 0;
  }
  groupe(trouve);

  var ancien = document.querySelector('body > header');   // l'accueil avait sa propre barre : remplacée
  if (ancien) ancien.replaceWith(h); else document.body.prepend(h);
  document.querySelectorAll('[data-kb-droite]').forEach(function (el) { h.querySelector('.kb-droite').prepend(el); });
  if (!s.hasAttribute('data-fixe')) document.body.style.paddingTop = '46px';
  var cur = h.querySelector('.kb-p.on'), nv = h.querySelector('nav');   // téléphone : la barre défile jusqu'à la page ouverte
  if (cur && nv.scrollWidth > nv.clientWidth) nv.scrollLeft = cur.offsetLeft - nv.clientWidth / 2;
})();
