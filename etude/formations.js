// Régions candidates d'Artemis III gardées en octobre 2024 (NASA) → formation UAI qui leur donne leur nom.
// La NASA n'a publié ni coordonnées ni contours : on place chaque région sur sa formation
// (donnees/formations.json, tiré du Gazetteer of Planetary Nomenclature de l'USGS).
export const ARTEMIS = [
  { region: 'Peak near Cabeus B', formation: 'Cabeus B' },
  { region: 'Haworth', formation: 'Haworth' },
  { region: 'Malapert Massif', formation: 'Mons Malapert' },
  { region: 'Mons Mouton Plateau', formation: 'Mons Mouton' },
  { region: 'Mons Mouton', formation: 'Mons Mouton' },
  { region: 'Nobile Rim 1', formation: 'Nobile' },
  { region: 'Nobile Rim 2', formation: 'Nobile' },
  { region: 'de Gerlache Rim 2', formation: 'de Gerlache' },
  { region: 'Slater Plain', formation: 'Slater' },
];

// Sites déjà visités près du pôle sud (pour situer les régions).
export const VISITES = [
  { nom: 'IM-2 Athena (2025)', lat: -84.78, lon: 29.13, note: 'site visé ; LROC, image 1401' },
  { nom: 'impact LCROSS (2009)', lat: -84.6796, lon: -48.7093, note: 'Centaur ; Marshall et al., arXiv 1103.1687' },
];
