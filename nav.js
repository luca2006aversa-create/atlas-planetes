// Barre commune à toutes les pages de Kibsu, sur le modèle d'Ašru : une rangée de groupes, dessous les onglets du groupe ouvert.
// Une seule liste de pages, ici : ajouter une page = ajouter une ligne.
// Inclusion : <script src="(chemin)/nav.js" defer></script> dans le <head>. Hauteur de la barre : 78 px (variable CSS --kb-h).
// Options sur la balise script : data-fixe (la page gère déjà la place du haut, pas de marge ajoutée),
// data-ton="sombre" (barre sombre), data-theme (bouton ◐ de l'accueil).
// Un élément [data-kb-droite] de la page est rangé à droite dans la barre.
(function () {
  if (window.self !== window.top || new URLSearchParams(location.search).get('embed') === '1') return;   // vue incrustée : pas de barre
  var s = document.currentScript, BASE = new URL('.', s.src);
  // [nom, adresse depuis atlas/, vue de l'accueil]. La première page d'un groupe est celle qui s'ouvre.
  var GROUPES = [
    { nom: 'Explorer', pages: [['Système', '?vue=systeme', 'systeme'], ['Planètes', '?vue=globe', 'globe'], ['Missions', '?vue=missions', 'missions']] },
    { nom: 'Études', pages: [['Étude du pôle sud de la Lune', 'etude/']] },
    { nom: 'Projet', pages: [['3D', 'projets/site3d.html'], ['Résumé', 'projets/resume.html'], ['Fichier', '?vue=projets', 'projets'], ['Atelier', 'projets/atelier.html'], ['Contrôles', 'projets/controle.html'], ['Radiations', 'projets/rayons.html']] },
    { nom: 'Références', pages: [['Références', 'references/']] }
  ];
  var chemin = function (p) { return p.replace(/index\.html$/, ''); };
  var ICI = chemin(location.pathname), ACCUEIL = ICI === chemin(BASE.pathname);
  document.documentElement.style.setProperty('--kb-h', '78px');

  var css = document.createElement('style');
  css.textContent =
    '.kb{position:fixed;top:0;left:0;right:0;z-index:1500;box-sizing:border-box;display:block;height:auto;padding:0;gap:0;font:13px/1.2 Inter,system-ui,sans-serif;' +
    '--kb-fond:#fbfaf7;--kb-texte:#1d2433;--kb-doux:#6b7280;--kb-creux:#efece5;--kb-bord:#e2ddd2;--kb-vif:#e4572e;' +
    'background:var(--kb-fond);color:var(--kb-texte);border-bottom:1px solid var(--kb-bord)}' +
    '.kb.sombre,[data-theme=sombre] .kb{--kb-fond:#12151c;--kb-texte:#e8e4dc;--kb-doux:#9aa0aa;--kb-creux:#1d212a;--kb-bord:#2a2f3a}' +
    '.kb-r1{height:46px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:10px;padding:0 12px}' +
    '.kb-marque{display:flex;align-items:center;gap:8px;font-weight:600;color:inherit;text-decoration:none;justify-self:start}' +
    '.kb-marque img{width:28px;height:28px;border-radius:7px;display:block}' +
    '.kb-groupes{display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--kb-creux)}' +
    '.kb-groupes a{position:relative;padding:6px 14px;border-radius:9px;color:var(--kb-texte);text-decoration:none;font-weight:500;white-space:nowrap}' +
    '.kb-groupes a:hover{background:var(--kb-fond)}' +
    '.kb-groupes a.on{background:var(--kb-texte);color:var(--kb-fond)}' +
    '.kb-groupes a.on::after{content:"";position:absolute;right:6px;top:6px;width:4px;height:4px;border-radius:50%;background:var(--kb-vif)}' +
    '.kb-droite{justify-self:end;display:flex;align-items:center;gap:8px;color:var(--kb-doux)}' +
    '.kb #theme{font:inherit;border:0;background:none;color:inherit;cursor:pointer;padding:6px;font-size:16px}' +
    '.kb-r2{height:32px;display:flex;justify-content:center;align-items:stretch;gap:4px;padding:0 12px;overflow-x:auto;scrollbar-width:none}' +
    '.kb-r2 a,.kb-r2 button{display:flex;align-items:center;font:inherit;border:0;background:none;padding:0 12px;cursor:pointer;color:var(--kb-doux);text-decoration:none;white-space:nowrap}' +
    '.kb-r2 a:hover,.kb-r2 button:hover{color:var(--kb-texte)}' +
    '.kb-r2 .on,.kb-r2 .actif{color:var(--kb-texte);background:none;font-weight:600;box-shadow:inset 0 -2px 0 var(--kb-vif)}' +
    '.kb [hidden]{display:none!important}.kb nav{margin:0}' +
    '@media(max-width:700px){.kb-r1{grid-template-columns:auto minmax(0,1fr) auto}.kb-marque b,.kb-droite>*:not(#theme){display:none}' +
    '.kb-groupes{overflow-x:auto;scrollbar-width:none;justify-self:start;max-width:100%}.kb-groupes a{padding:6px 10px}.kb-r2{justify-content:flex-start}}';
  document.head.appendChild(css);

  var url = function (p) { return new URL(p, BASE).href; };
  var estIci = function (p) { return !p[2] && chemin(new URL(p[1], BASE).pathname) === ICI; };
  var onglet = function (p, g) {
    if (ACCUEIL && p[2]) return '<button class="kb-p" data-g="' + g + '" data-vue="' + p[2] + '">' + p[0] + '</button>';   // l'accueil change de vue sans recharger (app.js)
    var on = estIci(p);
    return '<a class="kb-p' + (on ? ' on' : '') + '" data-g="' + g + '" href="' + url(p[1]) + '"' + (on ? ' aria-current="page"' : '') + '>' + p[0] + '</a>';
  };
  var h = document.createElement('header');
  h.className = 'kb' + (s.dataset.ton === 'sombre' ? ' sombre' : '');
  h.innerHTML = '<div class="kb-r1"><a class="kb-marque" href="' + url('accueil/') + '" title="Accueil"><img src="' + url('logo-d.png') + '" alt=""><b>Kibsu</b></a>' +
    '<nav class="kb-groupes" aria-label="Parties de Kibsu">' +
    GROUPES.map(function (g, i) { return '<a class="kb-g" data-groupe="' + i + '" href="' + url(g.pages[0][1]) + '">' + g.nom + '</a>'; }).join('') +
    '</nav><span class="kb-droite"></span></div>' +
    '<nav class="kb-r2" aria-label="Onglets">' + GROUPES.map(function (g, i) { return g.pages.map(function (p) { return onglet(p, i); }).join(''); }).join('') + '</nav>';
  if (s.hasAttribute('data-theme')) h.querySelector('.kb-droite').innerHTML = '<button id="theme" type="button" aria-label="Thème clair ou sombre" title="Thème clair / sombre">◐</button>';

  // Le groupe ouvert : celui de la page (ou de la vue, sur l'accueil). Seuls ses onglets sont montrés.
  function groupe(i) {
    h.querySelectorAll('.kb-g').forEach(function (a) { a.classList.toggle('on', +a.dataset.groupe === i); });
    h.querySelectorAll('.kb-p').forEach(function (a) { a.hidden = +a.dataset.g !== i; });
  }
  var trouve = -1;
  GROUPES.forEach(function (g, i) { g.pages.forEach(function (p) { if (estIci(p)) trouve = i; }); });
  if (ACCUEIL) {
    var vueGroupe = function (v) { var r = 0; GROUPES.forEach(function (g, i) { g.pages.forEach(function (p) { if (p[2] === v) r = i; }); }); return r; };
    window.addEventListener('atlas-vue', function (e) {
      groupe(vueGroupe(e.detail));
      h.querySelectorAll('.kb-p[data-vue]').forEach(function (b) { b.classList.toggle('on', b.dataset.vue === e.detail); });
    });
    h.querySelectorAll('.kb-g').forEach(function (a) {   // un groupe qui s'ouvre sur une vue de l'accueil : on change de vue sur place
      var v = GROUPES[a.dataset.groupe].pages[0][2];
      if (v) a.onclick = function (ev) { ev.preventDefault(); h.querySelector('[data-vue="' + v + '"]').click(); };
    });
    trouve = 0;
  }
  groupe(trouve);
  if (trouve < 0) h.querySelector('.kb-r2').style.display = 'none';   // page d'accueil : aucun groupe ouvert, pas de rangée vide

  var ancien = document.querySelector('body > header');   // l'accueil avait sa propre barre : remplacée
  if (ancien) ancien.replaceWith(h); else document.body.prepend(h);
  document.querySelectorAll('[data-kb-droite]').forEach(function (el) { h.querySelector('.kb-droite').prepend(el); });
  if (!s.hasAttribute('data-fixe')) document.body.style.paddingTop = '78px';
  [h.querySelector('.kb-groupes'), h.querySelector('.kb-r2')].forEach(function (nv) {   // téléphone : chaque rangée défile jusqu'à l'élément ouvert
    var cur = nv.querySelector('.on');
    if (cur && nv.scrollWidth > nv.clientWidth) nv.scrollLeft = cur.offsetLeft - nv.clientWidth / 2;
  });
  var aide = document.createElement('script'); aide.src = url('aide.js'); document.head.appendChild(aide);   // intros de page et « ? » (textes : aide.json)
})();
