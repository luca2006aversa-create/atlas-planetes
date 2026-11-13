# Fiche projet Kibsu — format `kibsu-projet/0.1`

Un projet = **un fichier JSON**. Rhino / Grasshopper, le site et les exports lisent le même fichier.
Les règles sont dans `regles.json`, le contrôle dans `controle.js` (navigateur et Node : `node controle.js fiche.json`).

## Valeur sourcée
Tout chiffre peut s'écrire seul (`12`) ou avec son statut :
```json
{ "v": 12, "s": "●", "src": "NASA/TP-2015-218570 rev 2, tab. 3-21" }
```
| s | Sens |
|---|---|
| ● | sourcé : lu dans un document, référence donnée |
| ◇ | calculé à partir de valeurs sourcées, ou lu dans une source secondaire (Wikipedia, extrait cité) |
| ▨ | hypothèse de projet ou valeur jouet : à remplacer |

Un chiffre écrit seul compte comme ▨.

## Structure
```json
{
  "format": "kibsu-projet/0.1",
  "nom": "…", "auteur": "…", "date": "2026-11-13",
  "site": { "corps": "lune", "etude": "etude/", "xy_km": [x, y], "alt_m": …, "gravite_ms2": 1.62 },
  "programme": {
    "equipage": 4, "duree_jours": 30,
    "fonctions": [ { "id": "dormir", "nom": "Dormir", "element": "M1" } ]
  },
  "elements": [ {
    "id": "M1", "nom": "Module de vie", "type": "module",
    "forme": { "type": "cylindre", "diametre_m": 4.5, "longueur_m": 8, "axe": "horizontal" },
    "position_m": [0, 0, 0], "rotation_deg": 0,
    "pressurise": true, "volume_habitable_m3": …,
    "materiau": "aluminium-lithium", "masse_kg": …,
    "arrivee": { "mode": "rigide", "dimensions_vol_m": [4.5, 8], "vehicule": "…" },
    "montage": { "etape": 1, "moyen": "robot", "duree_h": … },
    "sorties": 2
  } ],
  "liaisons": [ { "de": "M1", "vers": "S1", "type": "tunnel" } ],
  "protection": { "materiau": "regolithe", "epaisseur_m": 3 }
}
```

### `type` d'élément
`module` (pressurisé, habité) · `sas` · `serre` · `noeud` (jonction) · `protection` · `ouverture` · `mat` (énergie) · `antenne` · `stockage` · `autre`

`dans` : id de l'élément qui le contient (ex. une serre ou une fenêtre dans un module) : son volume n'est pas compté deux fois.
Serre : `surface_culture_m2`. Butte : `forme: { type: "butte", couverture_m, talus_deg }`.
Fente (ouverture taillée dans la butte) : `forme: { type: "fente", oeil_m: [x,y,z], largeur_oeil_m, hauteur_oeil_m, az_deg: [min,max], el_deg: [min,max], direction: "+y" }`.

### Temps passé dans chaque espace (budget de dose)
`programme.fonctions[]` : `{ id, nom, element, h_jour, abri_requis?, point_m? }`. `h_jour` = heures par jour dans l'espace (total 24).
`abri_requis: true` = l'espace doit protéger des éruptions solaires (≥ 10 g/cm² dans toutes les directions), par exemple pour dormir.
`point_m` = point où l'on calcule la dose (sinon le centre de l'élément, à 1,5 m du sol). `programme.quota_dose_mSv_jour` (facultatif)
remplace le quota calculé (limite de carrière × part acceptée ÷ durée). `node rayons.js fiche.json` calcule les µSv/h de chaque espace ;
`controle.html` montre la journée (règle RAD-3). Pavillon léger en surface : `forme: { type: "dome", diametre_m }` (parois ignorées).

### Ports et assemblage
Chaque élément se dessine **dans son propre repère** : centre posé au sol, axe des cylindres horizontaux selon x.
`ports` : les points d'amarrage (écoutille, porte), comme sur une station spatiale :
```json
"ports": [ { "id": "A", "face": "-x", "hauteur_m": 1, "diametre_m": { "v": 1, "s": "▨" }, "type": "ecoutille", "nom": "bout ouest" } ]
```
`face` : `+x -x +y -y` (sur l'enveloppe, à `hauteur_m` du sol), `+z` (dessus) ou `-z` (dessous). Pour un port ailleurs : `p: [x,y,z]` et `n: [nx,ny,nz]` (direction vers l'extérieur).
`type` : `ecoutille` (entre volumes pressurisés) ou `porte` (vers l'extérieur ou un couloir).

Une liaison entre ports s'écrit `{ "de": "M1.B", "vers": "M2.A", "type": "jonction", "ecart_m": 1 }` (`ecart_m` = longueur du tunnel ou du couloir, 0 par défaut).
`assemblage.ancre` : l'élément qui garde sa `position_m` ; `assemblage.js` place les autres de proche en proche pour que les ports reliés se fassent face.
`node assemblage.js fiche.json` compare les positions écrites et celles des ports, et signale les ports libres, les écoutilles de tailles ou de types différents.
Une liaison sans port (`"de": "M1"`) reste permise : elle compte pour le parcours mais ne place rien.
`atelier.html?fiche=…&el=M2` montre un élément seul, ses ports et ses contrôles ; on peut changer ses dimensions et voir l'assemblage suivre.

### Formes et niveaux
Catalogue dans `formes.js` (enveloppe, volume, coupe horizontale à une hauteur z) :
| `forme.type` | champs | idée |
|---|---|---|
| `cylindre` | `diametre_m`, `longueur_m`, `axe` (`horizontal` / `vertical`) | couché : un plancher, réseaux dessous ; debout : étages |
| `capsule` | `diametre_m`, `hauteur_m` | gonflable vertical à fonds bombés, plusieurs niveaux |
| `dome` | `diametre_m` | demi-sphère : grand sol, mezzanine |
| `sphere` | `diametre_m` | la plus légère sous pression, sol étroit |
| `voute` | `largeur_m`, `hauteur_m`, `longueur_m` | arc parabolique en régolithe imprimé (poche étanche dedans) |
| `tore` | `diametre_m` (tube), `diametre_anneau_m` (ligne médiane) | anneau autour d'un patio |
| `noeud` | `diametre_m`, `hauteur_m` | petit cylindre debout à plusieurs ports |
| `boite` | `longueur_m`, `largeur_m`, `hauteur_m` ou `dim_m` | murs plats : plutôt non pressurisé |

Sur la Lune on vit sur des **planchers plats** : `niveaux: [ { "id": "N1", "z_m": { "v": 2.3, "s": "▨" }, "fonction": "nuit, abri" } ]`
(z = hauteur du plancher depuis le bas de la forme). Pour chaque niveau, `formes.js` calcule la surface du plancher (coupe à z),
la surface où l'on tient debout (coupe à z et à z + hauteur debout) et la hauteur sous plafond (jusqu'au niveau suivant moins l'épaisseur
du plancher, ou jusqu'au haut de la forme). Sans `niveaux` : un seul plancher, placé par défaut là où il est le plus utile (cylindre couché :
centré sur l'axe). Hypothèses de dessin (▨, à sourcer) : hauteur debout 2 m, plancher 0,2 m (`HYP` dans `formes.js`).
L'atelier signale une écoutille latérale qui ne s'ouvre au-dessus d'aucun plancher.

### Connexions : portes, zones, transitions
Catalogue et règles dans `connexions.json` (portes réelles et leurs sources, zones, transitions, matrice), moteur dans `connexions.js`
(`node connexions.js fiche.json`), vue « Parcours » et cartes « Portes et ports » / « Connexions » dans l'atelier.
- **Porte d'un port** : `"porte": "porte_etanche"` (voir `connexions.json` : écoutille ronde Ø 0,8 m ◇ IDSS, écoutille carrée 1,27 m ◇ CBM,
  porte étanche, porte de sas, porte intérieure, porte extérieure, trappe, suitport). `"niveau": "N1"` pose la porte sur ce plancher
  (avec son seuil) au lieu d'une hauteur écrite.
- **Zone d'un élément** : `"zone": "vie" | "nuit" | "travail" | "technique" | "serre" | "poussiere"` (par défaut selon le type).
- **Pièce de transition** : un élément de type `sas` ou `vestiaire`, avec `"transition": "sas" | "vestiaire" | "vestiaire_bio"`.
  Entre deux zones qui ne peuvent pas se toucher (matrice), il faut la bonne pièce : sas entre dehors et dedans, vestiaire entre la
  poussière et la vie, vestiaire propre avant la serre. `"secours": true` : sas de secours (pas de vestiaire exigé, parcours évité).
- **Liaison** : `type` (`jonction`, `tunnel`, `couloir` pressurisés ; `couloir couvert`, `chemin` non pressurisés), `ecart_m`,
  `circulation` (« un escalier », « une rampe ») pour rattraper un dénivelé dans le tunnel.
- **Socle** : `"socle": true` pose l'élément sur un socle de régolithe pour que ses portes soient à la hauteur du voisin ; sinon
  l'élément reste au sol et l'écart de hauteur entre portes devient une marche (✗) ou une pente à rattraper.
- **Accès entre niveaux** : `niveaux[i].acces: { "type": "échelle" | "escalier", "porte": "trappe" }` pour chaque niveau au-dessus du premier.
Règles vérifiées : TR-0 à TR-5 (zones et transitions), CX-1 (porte étanche entre volumes pressurisés), CX-2 / CX-3 (taille du passage
en combinaison ou non), CX-4 (marches, pentes), CX-5 (porte sur un plancher), CX-6 (port libre), CX-7 (accès aux niveaux).
Exemple complet : `pole-sud-connexions.json` (86 ✓, 0 ✗).

### `arrivee.mode`
| mode | Sens | Conséquence |
|---|---|---|
| `rigide` | arrive tel quel | doit tenir dans la soute du véhicule |
| `pliable` | arrive plié, se déploie | `dimensions_vol_m` (plié) ≠ `forme` (déployé) |
| `gonflable` | arrive compacté, se gonfle | idem, plus `pression_kPa` |
| `in_situ` | fabriqué sur place (régolithe) | pas de transport, mais machines et énergie |

### Repères
`position_m` : mètres, centre de l'élément posé au sol (z = bas de l'élément). Repère local du projet : pour le pôle sud,
x = le long de la crête, y = vers la Terre, z = haut. Les modules cylindriques horizontaux ont leur axe selon x.

## Outils qui lisent la fiche
- `assemblage.js` / `atelier.html` : ports, assemblage, un élément à la fois.
- `controle.js` / `controle.html` : règles ✓ / ✗ (`regles.json`).
- `rayons.js` / `rayons.html` : épaisseur de régolithe par direction, points faibles (pas une dose).
- `grasshopper/epaisseurs_rayons.py` : même calcul dans Rhino 8, sur la géométrie dessinée.
Le site se relie à l'étude par `xy_km` (repère de l'étude du pôle sud).
