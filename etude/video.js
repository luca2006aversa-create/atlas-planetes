// Mode vidéo de l'étude (?video) : carte plein écran, un « plan » par chapitre, sous-titres ingénieur | architecte.
// Tout est piloté par le temps : window.videoAller(t) pose l'image exacte de l'instant t (en secondes),
// ce qui permet de filmer image par image (outils/video_etude.mjs) sans saccade.

const facile = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const borne = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export function lancer(ctx) {
  const { carte, poser, CADRES, chapitres, C, plan, hab, large } = ctx;
  document.body.classList.add('video');
  carte.options.zoomSnap = 0;
  carte.invalidateSize();

  // --- scénario (≈ 2 min) : chap = indice de la section dont on reprend les calques et le cadre ---
  const P = [
    { d: 6.5, chap: 0, carton: 'titre' },
    { d: 9, chap: 1, titre: 'Le relief',
      ing: `150 × 150 km autour du pôle, mesurés au laser par la sonde LRO.`,
      arc: `Une topographie de cratères : ce sont les crêtes qui feront le site.` },
    { d: 10, chap: 2, titre: 'La lumière',
      ing: `L'axe de la Lune n'est incliné que de 1,5° : le soleil rase l'horizon.`,
      arc: `Ni midi ni façade sud : la lumière tourne autour de vous en un mois.` },
    { d: 9, chap: 3, titre: 'L\'ombre et la glace',
      ing: `${C.ombre_permanente_part} % du terrain ne voit jamais le soleil. Le froid y piège l'eau.`,
      arc: `La ressource est dans l'ombre, l'énergie au soleil : on habite la berge.` },
    { d: 8, chap: 4, titre: 'Les pentes',
      ing: `Pour se poser, il faut moins de 8° de pente.`,
      arc: `Les replats éclairés sont rares : c'est eux qui dictent la forme.` },
    { d: 8.5, chap: 5, titre: 'La Terre',
      ing: `Pour communiquer sans relais, il faut voir la Terre.`,
      arc: `Elle reste presque au même endroit du ciel : une orientation fixe.` },
    { d: 10, chap: 6, titre: 'Croiser les critères', grand: `${C.fav60_km2} km²`,
      ing: `Plat, et au soleil plus de 60 % du temps : ${C.fav60_km2} km² en ${C.nb_lieux} îlots.`,
      arc: `Ce n'est pas une ville qu'on implante, c'est un archipel de parcelles.` },
    { d: 8.5, chap: 7, titre: 'De la lumière à la glace',
      ing: `Chaque îlot est relié à la grande zone d'ombre la plus proche.`,
      arc: `La distance à la glace devient la mesure du projet.` },
    plan && { d: 13, chap: 8, titre: 'Un plan d\'implantation', encart: 'coupe',
      ing: `Des règles écrites placent l'habitat, ${plan.mats.length} mâts solaires, l'aire d'atterrissage et les routes.`,
      arc: `Un plan de crête. Le fond de Shackleton, ${plan.d.shackleton_sous_km.toLocaleString('fr-FR')} km plus bas, n'a pas de route.` },
    hab && { d: 14, chap: 9, titre: 'L\'habitat', encart: 'fenetre',
      ing: `Depuis l'habitat, la Terre se promène dans un cadre de 16°, visible ${hab.terre.part} % du temps.`,
      arc: `Une seule fenêtre, taillée à la forme exacte du ciel de la Terre.` },
    large && { d: 10, chap: 11, titre: 'Les régions d\'Artemis III',
      ing: `En 2024, la NASA a gardé 9 régions candidates pour Artemis III.`,
      arc: `Toutes sur des hauteurs éclairées, là où notre carte trouve la lumière.` },
    large && { d: 10.5, chap: 12, titre: 'Vérifier le calcul', grand: `r = ${C.c_corr_sol}`,
      ing: `Face aux cartes officielles de LOLA : corrélation ${C.c_corr_sol}, ombres communes à ${C.c_recouv} %.`,
      arc: `Une méthode simple, à refaire sur n'importe quel site, à l'échelle d'un projet.` },
    { d: 7.5, chap: 1, carton: 'fin' },
  ].filter(Boolean);
  let t0 = 0;
  P.forEach((p) => { p.t0 = t0; t0 += p.d; });
  const DUREE = t0;

  // --- vues cibles (centre et zoom), en laissant la place aux titres (haut) et aux sous-titres (bas) ---
  const S = carte.getSize(), HAUT = 130, BAS = 210;
  const vue = (i) => {
    const v = JSON.parse(chapitres[i].dataset.vue);
    const b = Array.isArray(v.cadre) ? L.latLngBounds([[v.cadre[1], v.cadre[0]], [v.cadre[3], v.cadre[2]]]) : CADRES[v.cadre];
    const z = carte.getBoundsZoom(b, false, L.point(160, HAUT + BAS + 40));
    const c = carte.unproject(carte.project(b.getCenter(), z).add([0, (BAS - HAUT) / 2]), z);
    return { calques: v.calques, c, z };
  };
  P.forEach((p) => Object.assign(p, vue(p.chap)));
  P[P.length - 1].z -= 0.6;                                       // carton de fin : léger recul

  // --- interface ---
  const ui = document.createElement('div');
  ui.id = 'video-ui';
  ui.innerHTML = `<div id="v-titre"><span id="v-num"></span><b></b></div>
    <div id="v-grand"></div><div id="v-encart"></div>
    <div id="v-sous"><div class="v-ing"><i>L'ingénieur</i><p></p></div><div class="v-arc"><i>L'architecte</i><p></p></div></div>
    <div id="v-carton"></div><div id="v-marque">Atlas planètes · étude de site</div><div id="v-barre"><i></i></div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const auteur = 'Luca Aversa · ENSA Normandie · Hanoi Architectural University';
  const CARTONS = {
    titre: `<p class="v-sur">Étude de site</p><h1>Choisir un site au pôle sud de la Lune</h1>
      <p class="v-roles"><span class="r-ing">lecture d'ingénieur</span> · <span class="r-arc">lecture d'architecte</span></p><p class="v-auteur">${auteur}</p>`,
    fin: `<h1 class="v-citation">« Choisir un site d'atterrissage,<br>c'est déjà une analyse de site. »</h1>
      <p class="v-auteur">${auteur}</p>
      <p class="v-sources">Données publiques : NASA/GSFC, LRO LOLA (relief, éclairage) · UAI/USGS (noms) · NASA (régions Artemis III). Calculs et dessins : Atlas planètes.</p>`,
  };

  let courant = -1;
  function plan_(t) { let i = 0; while (i < P.length - 1 && t >= P[i + 1].t0) i++; return i; }

  function changer(i) {
    courant = i;
    const p = P[i];
    poser(p.calques);
    const num = p.carton ? '' : String(P.slice(0, i + 1).filter((q) => !q.carton).length);
    $('#v-num').textContent = num;
    $('#v-titre b').textContent = p.titre || '';
    $('.v-ing p').textContent = p.ing || '';
    $('.v-arc p').textContent = p.arc || '';
    $('#v-grand').textContent = p.grand || '';
    $('#v-carton').innerHTML = p.carton ? CARTONS[p.carton] : '';
    $('#v-carton').className = p.carton || '';
    const src = p.encart === 'coupe' ? '#coupe' : p.encart === 'fenetre' ? '#fenetre' : null;
    // copie du dessin ; ses identifiants (clipPath) sont renommés, l'original étant dans une partie masquée
    $('#v-encart').innerHTML = src ? (document.querySelector(`${src} svg`)?.outerHTML || '').replace(/id="([^"]+)"/g, 'id="v-$1"').replace(/url\(#([^)]+)\)/g, 'url(#v-$1)') : '';
    $('#v-encart').className = p.encart || '';
  }

  function aller(t) {
    t = borne(t, 0, DUREE - 1e-6);
    const i = plan_(t), p = P[i], q = P[Math.max(0, i - 1)];
    if (i !== courant) changer(i);
    const u = t - p.t0, VOL = i === 0 ? 0.001 : 2.2;
    // vol : centre et zoom interpolés, avec un recul quand le saut est grand ; puis lente dérive
    const e = facile(borne(u / VOL));
    const a = carte.project(q.c, 0), b = carte.project(p.c, 0);
    const d = a.distanceTo(b) * 2 ** Math.min(q.z, p.z) / S.x;
    const recul = i === 0 ? 0 : borne(Math.log2(1 + d), 0, 3) * Math.sin(Math.PI * e);
    const zv = (i === 0 ? p.z : q.z + (p.z - q.z) * e) - recul + 0.18 * borne((u - VOL) / (p.d - VOL));
    const c = i === 0 ? p.c : carte.unproject(a.add(b.subtract(a).multiplyBy(e)), 0);
    carte.setView(c, zv, { animate: false });
    // fondus du texte
    const fondu = borne((u - 0.5) / 0.6) * borne((p.d - u - 0.1) / 0.5);
    ['#v-titre', '#v-sous', '#v-grand', '#v-encart', '#v-carton'].forEach((s) => ($(s).style.opacity = fondu));
    $('#v-barre i').style.width = `${(t / DUREE) * 100}%`;
  }

  // préchargement des images de calques, puis prêt
  const urls = [...document.querySelectorAll('img')].map((im) => im.src);
  Object.values(ctx.CALQUES).forEach((cl) => { if (cl.couche._url) urls.push(cl.couche._url); (cl.couche._urls || []).forEach((u) => urls.push(u)); });
  Promise.all([document.fonts.ready, ...urls.map((u) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = u; }))])
    .then(() => { aller(0); window.videoPret = true; });

  window.videoInfo = { duree: DUREE, plans: P.map((p) => ({ t0: p.t0, d: p.d, titre: p.titre || p.carton })) };
  window.videoAller = async (t) => {
    aller(t);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return true;
  };
  // lecture en direct dans un navigateur (pour regarder sans filmer) : ?video&lire
  if (new URLSearchParams(location.search).has('lire')) {
    const debut = performance.now() + 800;
    const boucle = (now) => { aller(Math.max(0, (now - debut) / 1000)); if ((now - debut) / 1000 < DUREE) requestAnimationFrame(boucle); };
    const attendre = () => (window.videoPret ? requestAnimationFrame(boucle) : setTimeout(attendre, 100));
    attendre();
  }
}
