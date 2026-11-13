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
- `controle.js` / `controle.html` : règles ✓ / ✗ (`regles.json`).
- `rayons.js` / `rayons.html` : épaisseur de régolithe par direction, points faibles (pas une dose).
- `grasshopper/epaisseurs_rayons.py` : même calcul dans Rhino 8, sur la géométrie dessinée.
Le site se relie à l'étude par `xy_km` (repère de l'étude du pôle sud).
