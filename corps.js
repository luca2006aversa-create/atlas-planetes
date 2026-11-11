// Les corps de l'atlas : rayon, couleur dans la vue d'ensemble, couches d'images, relief, lieux.
// Images : NASA Solar System Treks (WMTS, projection géographique, 2 × 1 tuiles au niveau 0),
// NASA GIBS et GEBCO pour la Terre. Reliefs : grilles préparées par outils/preparer.py.

const trek = (corps, nom, ext, max) => ({
  type: 'trek', url: `https://trek.nasa.gov/tiles/${corps}/EQ/${nom}/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.${ext}`, max,
});

export const CORPS = {
  soleil: { nom: 'Soleil', couleur: '#f2c14e', taille: 9 },
  mercure: {
    nom: 'Mercure', rayon: 2439400, couleur: '#a39a8f', taille: 2.2, orbite: 'mercure',
    couches: [{ nom: 'MESSENGER (166 m)', ...trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m', 'jpg', 7), credit: 'NASA/JHUAPL/CIW — MESSENGER MDIS' }],
    fiche: "Rayon 2 440 km. Un jour solaire dure 176 jours terrestres. Glace probable dans les cratères polaires, comme sur la Lune.",
  },
  venus: {
    nom: 'Vénus', rayon: 6051800, couleur: '#e3c58f', taille: 3.4, orbite: 'venus',
    couches: [{ nom: 'Magellan radar', ...trek('Venus', 'Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m', 'png', 4), credit: 'NASA/JPL — Magellan' }],
    fiche: "Rayon 6 052 km. Surface à 465 °C sous 92 bar : on ne la voit qu'au radar. Les projets d'habitat visent l'atmosphère à 50 km d'altitude.",
  },
  terre: {
    nom: 'Terre', rayon: 6378137, rayonPolaire: 6356752, couleur: '#7fb6d9', taille: 3.6, orbite: 'terre', atmosphere: true,
    relief: 'terre',
    couches: [
      { nom: 'Blue Marble', type: 'gibs', url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.jpeg', max: 8, credit: 'NASA GIBS — Blue Marble' },
      { nom: 'GEBCO terre + mer', type: 'wms', url: 'https://wms.gebco.net/mapserv', couche: 'GEBCO_LATEST', credit: 'GEBCO Compilation Group — GEBCO Grid' },
    ],
    lieux: [
      { nom: 'Bãi Giữa', lon: 105.86, lat: 21.04, h: 60000, txt: "L'île du fleuve Rouge à Hanoï, site de travail de SiteScope." },
      { nom: 'Himalaya', lon: 86.9, lat: 28.0, h: 900000, txt: 'Le plus haut relief terrestre : à comparer à Olympus Mons, 2,5 fois plus haut.' },
      { nom: 'Fosse des Mariannes', lon: 142.2, lat: 11.3, h: 1500000, txt: "−10 994 m : visible avec la couche GEBCO, qui cartographie aussi les fonds marins." },
    ],
    fiche: "Rayon 6 378 km. Le relief des fonds marins est encore moins bien connu que celui de Mars : à peine un quart cartographié finement (projet Seabed 2030).",
  },
  lune: {
    nom: 'Lune', rayon: 1737400, couleur: '#c8c6be', taille: 1.6, parent: 'terre', relief: 'lune', couverture: 'lune',
    couches: [
      { nom: 'LRO WAC (100 m)', ...trek('Moon', 'LRO_WAC_Mosaic_Global_303ppd_v02', 'jpg', 8), credit: 'NASA/GSFC/Arizona State University — LROC WAC' },
      { nom: 'Relief LOLA', ...trek('Moon', 'LRO_LOLA_ClrShade_Global_128ppd_v04', 'png', 5), credit: 'NASA/GSFC — LOLA' },
    ],
    lieux: [
      { nom: 'Pôle sud (Shackleton)', lon: 0, lat: -89.6, h: 150000, txt: "Ombre permanente au fond, soleil presque permanent sur les crêtes : le site visé par Artemis (voir l'essai 2)." },
      { nom: 'Apollo 11', lon: 23.47, lat: 0.67, h: 80000, txt: 'Mer de la Tranquillité, 20 juillet 1969.' },
      { nom: 'Marius Hills', lon: -56.8, lat: 14.1, h: 100000, txt: 'Un puits ouvre sur un tube de lave : abri naturel.' },
      { nom: 'Face cachée (Chang\'e 4)', lon: 177.6, lat: -45.4, h: 400000, txt: 'Bassin Pôle Sud-Aitken, premier atterrissage sur la face cachée (2019).' },
    ],
    fiche: "Rayon 1 737 km. Jour lunaire de 29,5 jours terrestres. Relief LOLA : plus de 7 milliards de mesures laser.",
  },
  mars: {
    nom: 'Mars', rayon: 3396190, rayonPolaire: 3376200, couleur: '#d98f6c', taille: 2.6, orbite: 'mars', relief: 'mars', couverture: 'mars',
    couches: [
      { nom: 'Viking couleur (232 m)', ...trek('Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg', 7), credit: 'NASA/USGS — Viking MDIM 2.1' },
      { nom: 'Relief MOLA', ...trek('Mars', 'Mars_MGS_MOLA_ClrShade_merge_global_463m', 'jpg', 7), credit: 'NASA/GSFC — MOLA' },
    ],
    lieux: [
      { nom: 'Jezero', lon: 77.45, lat: 18.44, h: 150000, txt: 'Delta fossile, Perseverance depuis 2021.' },
      { nom: 'Olympus Mons', lon: -133.8, lat: 18.65, h: 1500000, txt: '22 km de haut : monte le relief à ×5 pour le sentir.' },
      { nom: 'Valles Marineris', lon: -70, lat: -8, h: 3000000, txt: '4 000 km de canyons.' },
      { nom: 'Arcadia Planitia', lon: -170, lat: 45, h: 1500000, txt: 'Glace sous quelques mètres : souvent proposée pour une base.' },
    ],
    fiche: "Rayon 3 396 km. Jour de 24 h 39. Relief MOLA à 463 m ; des milliers de zones couvertes à 25 cm–6 m (voir « couverture »).",
  },
  vesta: { nom: 'Vesta', rayon: 262700, couleur: '#b0a79a', taille: 1, orbite: 'vesta',
    couches: [{ nom: 'Dawn couleur', ...trek('Vesta', 'Vesta_Dawn_HAMO_TrueClr_DLR_global_74ppd_IAU', 'png', 6), credit: 'NASA/JPL/DLR — Dawn FC' }],
    fiche: "Astéroïde de 525 km, visité par Dawn (2011-2012)." },
  ceres: { nom: 'Cérès', rayon: 469700, couleur: '#9b9590', taille: 1, orbite: 'ceres',
    couches: [{ nom: 'Dawn relief ombré', ...trek('Ceres', 'Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016', 'jpg', 5), credit: 'NASA/JPL/DLR — Dawn FC' }],
    fiche: "Planète naine de 940 km, Dawn (2015-2018). Taches de sels brillants dans le cratère Occator." },
  jupiter: { nom: 'Jupiter', couleur: '#d9b48f', taille: 6, orbite: 'jupiter' },
  io: { nom: 'Io', rayon: 1821600, couleur: '#e6d36f', taille: 1, parent: 'jupiter',
    couches: [{ nom: 'Galileo + Voyager', ...trek('Io', 'Io_GalileoSSI_Voyager_Global_Mosaic_ClrMerge_1km', 'png', 4), credit: 'NASA/JPL/USGS' }],
    fiche: 'Le corps le plus volcanique du système solaire.' },
  europe: { nom: 'Europe', rayon: 1560800, couleur: '#cdbfa6', taille: 1, parent: 'jupiter',
    couches: [{ nom: 'Galileo + Voyager', ...trek('Europa', 'Europa_Voyager_Galileo_Blend_ColorMosaic', 'png', 4), credit: 'NASA/JPL/USGS' }],
    fiche: "Océan sous la glace : cible d'Europa Clipper (arrivée 2030)." },
  ganymede: { nom: 'Ganymède', rayon: 2634100, couleur: '#a89c8c', taille: 1, parent: 'jupiter',
    couches: [{ nom: 'Galileo + Voyager', ...trek('Ganymede', 'Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m', 'png', 4), credit: 'NASA/JPL/USGS' }],
    fiche: "Plus grande lune du système solaire ; cible de JUICE (arrivée 2031)." },
  saturne: { nom: 'Saturne', couleur: '#e3cf9b', taille: 5.4, orbite: 'saturne', anneau: true },
  titan: { nom: 'Titan', rayon: 2574730, couleur: '#d9a95b', taille: 1, parent: 'saturne',
    couches: [{ nom: 'Cassini ISS', ...trek('Titan', 'Titan_ISS_P19658_Mosaic_Global_4km', 'png', 3), credit: 'NASA/JPL/Space Science Institute' }],
    fiche: "Lacs de méthane, atmosphère épaisse : Dragonfly doit y voler (lancement 2028)." },
  encelade: { nom: 'Encelade', rayon: 252100, couleur: '#eef0f2', taille: 1, parent: 'saturne',
    couches: [{ nom: 'Cassini ISS', ...trek('Enceladus', 'Enceladus_Cassini_mosaic_global_110m', 'png', 5), credit: 'NASA/JPL/Space Science Institute' }],
    fiche: "Geysers d'eau au pôle sud, vus par Cassini." },
  uranus: { nom: 'Uranus', couleur: '#a9d8de', taille: 4.4, orbite: 'uranus' },
  neptune: { nom: 'Neptune', couleur: '#6f8fd9', taille: 4.3, orbite: 'neptune' },
  pluton: { nom: 'Pluton', couleur: '#cbb8a4', taille: 1.4, orbite: 'pluton' },
};

// Corps qu'on peut ouvrir en globe, dans l'ordre du menu.
export const GLOBES = ['mercure', 'venus', 'terre', 'lune', 'mars', 'vesta', 'ceres', 'io', 'europe', 'ganymede', 'titan', 'encelade'];

// Ce que chaque mission a cartographié : ses instruments (ce qu'ils mesurent), les fonds de globe qui viennent
// d'elle (noms des couches ci-dessus) et ses mosaïques régionales dans la couverture (motif sur le titre du produit).
export const CARTOGRAPHIE = {
  lro: { corps: ['lune'], fonds: ['LRO WAC (100 m)', 'Relief LOLA'], produits: /^LROC?\b/i, instruments: [
    ['LROC WAC', 'caméra grand angle : la mosaïque de toute la Lune à ~100 m/px (le fond de ce globe).'],
    ['LROC NAC', 'deux caméras à ~0,5 m/px : on y voit les modules Apollo et les traces des astronautes ; reliefs fins par stéréo.'],
    ['LOLA', 'altimètre laser : le relief de toute la Lune, les pentes, et l\'éclairement aux pôles.'],
    ['Diviner', 'radiomètre : températures de surface, jusqu\'à environ −250 °C au fond des cratères d\'ombre permanente.'],
    ['LAMP, LEND, Mini-RF', 'ultraviolet, neutrons, radar : indices de glace d\'eau aux pôles.'] ] },
  'apollo-15': { corps: ['lune'], produits: /^Apollo 15/i, instruments: [
    ['Caméras panoramique et métrique', 'photos prises depuis l\'orbite pendant la mission (1971), numérisées : reliefs de quelques mètres le long de la trace de vol.'] ] },
  mro: { corps: ['mars'], produits: /^(MRO|Mars Reconnaissance Orbiter)\b/i, instruments: [
    ['HiRISE', 'télescope : 25 à 50 cm/px, en bandes de quelques km de large ; reliefs stéréo à ~1 m.'],
    ['CTX', 'caméra de contexte : ~6 m/px, sur presque toute la planète.'],
    ['CRISM', 'spectromètre : argiles et sulfates, minéraux qui signalent de l\'eau ancienne.'],
    ['SHARAD', 'radar fourni par l\'agence spatiale italienne : glace sous la surface.'] ] },
  'mars-express': { corps: ['mars'], produits: /HRSC/i, instruments: [
    ['HRSC', 'caméra stéréo couleur (DLR) : 10 à 20 m/px, reliefs régionaux.'],
    ['OMEGA', 'spectromètre (IAS, France) : minéraux hydratés.'],
    ['MARSIS', 'radar italien : glace, et peut-être eau liquide, sous le pôle sud.'] ] },
  'mars-global-surveyor': { corps: ['mars'], fonds: ['Relief MOLA'], instruments: [
    ['MOLA', 'altimètre laser : le relief de toute la planète (le fond « Relief MOLA »).'],
    ['MOC', 'caméra : les premières images de Mars à quelques mètres.'],
    ['TES', 'spectromètre thermique : composition des roches.'] ] },
  'viking-1': { corps: ['mars'], fonds: ['Viking couleur (232 m)'], instruments: [
    ['Caméras des orbiteurs Viking', 'la première carte de toute la planète (1976-1980) : la mosaïque couleur, fond de ce globe.'] ] },
  messenger: { corps: ['mercure'], fonds: ['MESSENGER (166 m)'], instruments: [
    ['MDIS', 'caméras : la mosaïque de toute la planète (le fond de ce globe).'],
    ['MLA', 'altimètre laser : relief de l\'hémisphère nord.'],
    ['Spectromètre à neutrons', 'avec MLA, indices de glace dans les cratères polaires.'] ] },
  magellan: { corps: ['venus'], fonds: ['Magellan radar'], instruments: [
    ['Radar imageur', 'voit à travers les nuages : 98 % de la surface à ~100 à 250 m (le fond de ce globe).'],
    ['Altimètre radar', 'le relief de Vénus.'] ] },
  dawn: { corps: ['vesta', 'ceres'], fonds: ['Dawn couleur', 'Dawn relief ombré'], instruments: [
    ['Framing Camera', 'caméra (Allemagne) : mosaïques et reliefs de Vesta et Cérès.'],
    ['VIR', 'spectromètre italien : minéraux, sels brillants de Cérès.'],
    ['GRaND', 'rayons gamma et neutrons : composition, hydrogène.'] ] },
  galileo: { corps: ['io', 'europe', 'ganymede'], fonds: ['Galileo + Voyager'], instruments: [
    ['SSI', 'caméra : mosaïques des lunes de Jupiter, complétées par les images de Voyager.'],
    ['NIMS', 'spectromètre : sels et glaces.'] ] },
  'voyager-1': { corps: ['io', 'europe', 'ganymede'], fonds: ['Galileo + Voyager'], instruments: [
    ['Caméras ISS', 'premières images détaillées des lunes de Jupiter (1979), reprises dans les mosaïques avec Galileo.'] ] },
  'voyager-2': { corps: ['io', 'europe', 'ganymede'], fonds: ['Galileo + Voyager'], instruments: [
    ['Caméras ISS', 'premières images détaillées des lunes de Jupiter (1979), reprises dans les mosaïques avec Galileo.'] ] },
  'cassini-huygens': { corps: ['titan', 'encelade'], fonds: ['Cassini ISS'], instruments: [
    ['ISS', 'caméra : mosaïques de Titan (en proche infrarouge, à travers la brume) et d\'Encelade.'],
    ['RADAR', 'cartographie radar de Titan : lacs et mers de méthane.'],
    ['VIMS', 'spectromètre : glaces et composés organiques.'] ] },
};

export const AGENCES = {
  NASA: '#3f6fb5', ESA: '#2f9c95', URSS: '#c0392b', Roscosmos: '#c0392b', CNSA: '#e4572e',
  JAXA: '#8e5bb5', ISRO: '#e39b2d', EAU: '#7a8b3a', ISA: '#5a7d9a', 'privée': '#6b7280',
};
