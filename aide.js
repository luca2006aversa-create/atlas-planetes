// Aide de Kibsu : chargé par nav.js sur toutes les pages. Les textes sont dans aide.json (un seul endroit).
//  1. bouton « Comprendre » dans la barre : l'intro de la page (à quoi elle sert, comment la lire, ce qu'on en tire).
//     Elle s'ouvre toute seule à la première visite de chaque page, puis reste fermée.
//  2. petit « ? » à côté de chaque titre connu du lexique (« termes ») : ouvre l'explication sous le titre.
(function () {
  var s = document.currentScript, BASE = new URL('.', s.src);
  var barre = document.querySelector('header.kb'); if (!barre) return;
  var css = document.createElement('style');
  css.textContent =
    '.kb-aide{font:600 12px Inter,"Segoe UI",system-ui,sans-serif;border:1px solid currentColor;background:none;color:inherit;border-radius:999px;padding:4px 10px;cursor:pointer;opacity:.8;white-space:nowrap}' +
    '.kb-aide:hover,.kb-aide[aria-expanded=true]{opacity:1;border-color:#e4572e}' +
    '.kb-intro{position:fixed;right:10px;top:calc(var(--kb-h,78px) + 8px);z-index:1000;width:min(380px,calc(100vw - 20px));max-height:calc(100vh - var(--kb-h,78px) - 24px);overflow:auto;' +
    'background:#161616;color:#f2ede4;border:1px solid #4d4d4d;border-radius:12px;padding:14px 16px;font:13.5px/1.5 Inter,"Segoe UI",system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)}' +
    '.kb-intro h2{margin:0 0 8px;font-size:16px;color:#f2ede4;padding-right:24px}.kb-intro h3{margin:10px 0 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#e4572e}' +
    '.kb-intro p{margin:0}.kb-intro .x{position:absolute;right:8px;top:8px;border:0;background:none;color:#a8a8a8;font-size:18px;cursor:pointer;line-height:1}' +
    '.kb-intro .pied{margin-top:12px;color:#a8a8a8;font-size:12px}' +
    '.kb-q{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:6px;border-radius:50%;border:1px solid currentColor;background:none;color:inherit;font:600 11px/1 Inter,system-ui,sans-serif;cursor:pointer;opacity:.6;vertical-align:middle;padding:0;text-transform:none;letter-spacing:0}' +
    '.kb-q:hover,.kb-q[aria-expanded=true]{opacity:1;color:#e4572e}' +
    '.kb-r{display:block;margin:6px 0;padding:8px 10px;border-left:3px solid #e4572e;border-radius:0 6px 6px 0;background:rgba(128,128,128,.14);font:400 13px/1.5 Inter,"Segoe UI",system-ui,sans-serif;text-transform:none;letter-spacing:0;color:inherit;white-space:normal;grid-column:1/-1}';
  document.head.appendChild(css);

  fetch(new URL('aide.json', BASE)).then(function (r) { return r.json(); }).then(function (A) {
    // --- 1. intro de la page ---
    var rel = location.pathname.slice(BASE.pathname.length).replace(/index\.html$/, '');
    var vue = new URLSearchParams(location.search).get('vue');
    if (!vue && rel === '') { try { vue = localStorage.getItem('atlas-vue'); } catch (e) { /* idem */ } vue = vue || 'systeme'; }
    var cle = function () { return rel === '' ? '?vue=' + vue : rel; };
    var bouton = document.createElement('button');
    bouton.className = 'kb-aide'; bouton.type = 'button'; bouton.textContent = '? Comprendre'; bouton.title = 'À quoi sert cette page, comment la lire';
    bouton.setAttribute('aria-expanded', 'false');
    barre.querySelector('.kb-droite').prepend(bouton);
    var panneau = null;
    function fermer() { if (panneau) { panneau.remove(); panneau = null; bouton.setAttribute('aria-expanded', 'false'); } }
    function ouvrir() {
      fermer();
      var P = A.pages[cle()]; if (!P) return;
      panneau = document.createElement('aside'); panneau.className = 'kb-intro'; panneau.setAttribute('aria-label', 'Comprendre cette page');
      panneau.innerHTML = '<button class="x" aria-label="Fermer">×</button><h2>' + P.titre + '</h2>' +
        '<h3>À quoi ça sert</h3><p>' + P.sert + '</p><h3>Comment lire</h3><p>' + P.lire + '</p><h3>Ce qu\'on en tire</h3><p>' + P.tire + '</p>' +
        '<p class="pied">Un petit « ? » à côté d\'un titre explique ce titre. Ce panneau se rouvre avec « ? Comprendre ».</p>';
      panneau.querySelector('.x').onclick = fermer;
      document.body.appendChild(panneau); bouton.setAttribute('aria-expanded', 'true');
    }
    function etat() {   // bouton visible seulement si la page a un texte ; première visite : ouvert
      var k = cle(), P = A.pages[k];
      bouton.hidden = !P; fermer();
      if (!P) return;
      try { if (!localStorage.getItem('kibsu-vu:' + k)) { localStorage.setItem('kibsu-vu:' + k, '1'); ouvrir(); } } catch (e) { /* pas de mémoire : reste fermé */ }
    }
    bouton.onclick = function () { if (panneau) fermer(); else ouvrir(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
    window.addEventListener('atlas-vue', function (e) { if (e.detail !== vue) { vue = e.detail; etat(); } });
    etat();

    // --- 2. « ? » à côté des titres connus ---
    var CLES = Object.keys(A.termes).sort(function (a, b) { return b.length - a.length; });
    var norme = function (t) { return t.replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); };
    function poser() {
      document.querySelectorAll('h2, h3, .carte .nom').forEach(function (el) {
        if (el.dataset.kbq || el.closest('.kb-intro, header.kb')) return;
        el.dataset.kbq = '1';
        var t = norme(el.textContent), k = CLES.find(function (c) { return t.indexOf(norme(c)) === 0; });
        if (!k) return;
        var b = document.createElement('button'); b.className = 'kb-q'; b.type = 'button'; b.textContent = '?';
        b.title = 'Expliquer'; b.setAttribute('aria-expanded', 'false');
        b.onclick = function (ev) {
          ev.stopPropagation(); ev.preventDefault();
          var r = el.nextElementSibling && el.nextElementSibling.classList.contains('kb-r') ? el.nextElementSibling : null;
          if (r) { r.remove(); b.setAttribute('aria-expanded', 'false'); return; }
          r = document.createElement('span'); r.className = 'kb-r'; r.textContent = A.termes[k];
          el.after(r); b.setAttribute('aria-expanded', 'true');
        };
        el.appendChild(b);
      });
    }
    poser();
    var attente = 0;
    new MutationObserver(function () { clearTimeout(attente); attente = setTimeout(poser, 150); }).observe(document.body, { childList: true, subtree: true });
  }).catch(function () { /* pas d'aide : le site marche sans */ });
})();
