"""Kibsu · épaisseurs de protection par lancer de rayons — composant Script Python 3 de Grasshopper (Rhino 8).

Même méthode que atlas/projets/rayons.js (le site), mais sur TA géométrie Rhino : tu dessines la butte, les modules,
la fenêtre, et tu vois tout de suite où la protection est faible.

ENTRÉES du composant (clic droit sur chaque entrée pour régler « Type hint » et « Item / List Access ») :
  bouclier : Mesh, item  — le régolithe en solide FERMÉ, déjà évidé (butte − modules − fentes). Booléen fait dans Rhino.
  points   : Point3d, list — points d'évaluation (ex. lit, poste de travail, siège devant la fenêtre), en mètres.
  n        : int, item    — nombre de directions (ex. 800 ; 3000 pour une carte fine)
  rho      : float, item  — masse volumique du régolithe en g/cm³ (1,5 par défaut, voir regles.json)
  horizon  : float, item  — élévation de l'horizon lointain en degrés (0 par défaut ; pôle sud : −0,1 à −3,8°) :
                            sous cet angle, le rayon finit dans la Lune (protection totale)
  rayon_vue: float, item  — rayon des sphères de visualisation (2 m par défaut)

SORTIES :
  g_cm2    : valeurs par point et par direction (arbre : une branche par point ; −1 = sol lunaire)
  bilan    : texte, par point : % du ciel < 30 g/cm², 30-300, > 300, sol, et le minimum
  vue      : Mesh coloré (une petite sphère par point, couleur = protection dans chaque direction)
  json     : texte au format du site (à coller dans un fichier pour comparer avec rayons-*.json)

Classes (identiques au site) : < 30 g/cm² ≈ moins que l'abri éruption solaire (Pham & El-Genk 2008) ;
30-300 ; > 300 ≈ plus de 2 m de régolithe à 1,5 g/cm³ (repère ▨ à confirmer) ; sol.
Ce n'est PAS une dose : la dose demande un code de transport (OLTARIS, NASA) qui prend cette distribution d'épaisseurs.
Non testé dans Rhino à la date d'écriture (13/11/2026) : à essayer sur un cas simple d'abord (une sphère creuse
d'épaisseur connue doit donner partout épaisseur × rho × 100 g/cm²).
"""
import json
import math

import Rhino.Geometry as rg
from Rhino.Geometry.Intersect import Intersection
import System.Drawing as sd
import Grasshopper as gh
from Grasshopper.Kernel.Data import GH_Path

n = int(n) if n else 800
rho = float(rho) if rho else 1.5
horizon = float(horizon) if horizon is not None else 0.0
rayon_vue = float(rayon_vue) if rayon_vue else 2.0
LONG = 500.0                                   # longueur des rayons (m), bien plus grande que la butte

COUL = {"faible": sd.Color.FromArgb(228, 87, 46), "moyen": sd.Color.FromArgb(242, 193, 78),
        "fort": sd.Color.FromArgb(159, 180, 199), "sol": sd.Color.FromArgb(91, 84, 67)}


def classe(v):
    if v < 0:
        return "sol"
    return "faible" if v < 30 else ("moyen" if v < 300 else "fort")


def directions(k):
    """Sphère de Fibonacci : k directions d'égal angle solide (même suite que le site)."""
    g, out = math.pi * (3 - math.sqrt(5)), []
    for i in range(k):
        z = 1 - (2 * i + 1) / float(k)
        r = math.sqrt(max(0.0, 1 - z * z))
        a = g * i
        out.append(rg.Vector3d(r * math.sin(a), r * math.cos(a), z))
    return out


def longueur_dans(mesh, p, d):
    """Longueur (m) du rayon p + t·d (t > 0) à l'intérieur du solide fermé."""
    ligne = rg.Line(p, p + d * LONG)
    res = Intersection.MeshLine(mesh, ligne)
    pts = res[0] if isinstance(res, tuple) else res
    if not pts:
        return 0.0
    ts = sorted(ligne.ClosestParameter(q) * LONG for q in pts)
    dedans = mesh.IsPointInside(p, 0.001, False)  # le point est-il déjà dans le régolithe ?
    total, debut = 0.0, (0.0 if dedans else None)
    for t in ts:
        if debut is None:
            debut = t
        else:
            total += t - debut
            debut = None
    return total


def traverse(p, d):
    """Sous l'horizon lointain : la Lune (−1). Au-dessus : masse de régolithe traversée dans le bouclier.
    Simplification : le sol local n'arrête que les rayons sous l'horizon (comme le site)."""
    elev = math.degrees(math.asin(max(-1.0, min(1.0, d.Z))))
    if elev < horizon:
        return -1.0
    return longueur_dans(bouclier, p, d) * rho * 100.0


dirs = directions(n)
arbre, lignes, vue, export = gh.DataTree[float](), [], rg.Mesh(), []
for i, p in enumerate(points or []):
    vals = [traverse(p, d) for d in dirs]
    arbre.AddRange(vals, GH_Path(i))
    compte = {"faible": 0, "moyen": 0, "fort": 0, "sol": 0}
    for v in vals:
        compte[classe(v)] += 1
    part = {k: round(100.0 * c / len(vals), 1) for k, c in compte.items()}
    finis = [v for v in vals if v >= 0]
    mini = round(min(finis)) if finis else None
    lignes.append("point {} : < 30 : {} % | 30-300 : {} % | > 300 : {} % | sol : {} % | min {} g/cm²".format(
        i, part["faible"], part["moyen"], part["fort"], part["sol"], mini))
    # petite sphère colorée : un sommet par direction
    s = rg.Mesh.CreateFromSphere(rg.Sphere(p, rayon_vue), 48, 24)
    for j in range(s.Vertices.Count):
        v = rg.Vector3d(s.Vertices[j]) - rg.Vector3d(p)
        v.Unitize()
        k = max(range(len(dirs)), key=lambda m: dirs[m] * v)   # direction la plus proche
        s.VertexColors.Add(COUL[classe(vals[k])])
    vue.Append(s)
    export.append({"nom": "point {}".format(i), "P": [p.X, p.Y, p.Z], "part": part, "min": mini,
                   "v": [int(round(v)) if v >= 0 else -1 for v in vals]})

g_cm2 = arbre
bilan = "\n".join(lignes)
json_txt = json.dumps({"source": "grasshopper", "rho": rho,
                       "directions": [[round(d.X, 4), round(d.Y, 4), round(d.Z, 4)] for d in dirs],
                       "ciel": export})
json = json_txt  # noqa: sortie du composant (le nom « json » masque le module, volontairement en dernier)
