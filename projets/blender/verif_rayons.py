"""Kibsu · vérification indépendante du calcul des radiations dans Blender (gratuit), en attendant Rhino.

Même méthode que grasshopper/epaisseurs_rayons.py : un solide fermé de régolithe (butte − modules − fente, fait par
booléens), des rayons lancés dans 3000 directions (même sphère de Fibonacci que le site), longueur traversée × 1,5 × 100.
Sous l'horizon lointain : la Lune. Deux tests :
  1. sphère creuse de 1 m d'épaisseur : il faut 150 g/cm² partout ;
  2. l'esquisse du pôle sud (pole-sud-esquisse.json) : comparer à rayons-pole-sud-esquisse.json (le site).

Usage : "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python verif_rayons.py
Écrit : blender/verif_rayons.json et blender/esquisse_butte.blend (pour regarder la géométrie)
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ICI = Path(__file__).resolve().parent
PROJ = ICI.parent
RHO = 1.5


def directions(n):
    g, out = math.pi * (3 - math.sqrt(5)), []
    for i in range(n):
        z = 1 - (2 * i + 1) / n
        r = math.sqrt(max(0.0, 1 - z * z))
        a = g * i
        out.append(Vector((r * math.sin(a), r * math.cos(a), z)))
    return out


def bvh_de(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    bm.transform(obj.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return BVHTree.FromBMesh(bm), len(bm.faces)


def longueur_dans(bvh, p, d):
    """Somme des segments où le rayon est dans le solide (entrée : normale opposée au rayon)."""
    total, o, entree, n = 0.0, p.copy(), None, 0
    t_cum = 0.0
    while n < 200:
        hit = bvh.ray_cast(o, d, 1000.0)
        if hit[0] is None:
            break
        loc, nor, _, dist = hit
        t_cum += dist
        if nor.dot(d) < 0:
            entree = t_cum
        elif entree is not None:
            total += t_cum - entree
            entree = None
        o = loc + d * 1e-4
        t_cum += 1e-4
        n += 1
    return total


def mesure(bvh, p, dirs, horizon=None):
    vals = []
    for d in dirs:
        elev = math.degrees(math.asin(max(-1.0, min(1.0, d.z))))
        h = 0.0
        if horizon:
            az = (math.degrees(math.atan2(d.x, d.y)) + 360) % 360
            h = horizon[int(round(az)) % 360]
        vals.append(-1 if elev < h else longueur_dans(bvh, p, d) * RHO * 100)
    c = {"faible": 0, "moyen": 0, "fort": 0, "sol": 0}
    for v in vals:
        c["sol" if v < 0 else "faible" if v < 30 else "moyen" if v < 300 else "fort"] += 1
    finis = [v for v in vals if v >= 0]
    return {"part": {k: round(100 * x / len(vals), 1) for k, x in c.items()},
            "min": round(min(finis), 1) if finis else None, "max": round(max(finis), 1) if finis else None}


def booleen(cible, outil, op="DIFFERENCE"):
    m = cible.modifiers.new("b", "BOOLEAN")
    m.operation, m.object, m.solver = op, outil, "EXACT"
    bpy.context.view_layer.objects.active = cible
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(outil, do_unlink=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
res = {}

# --- 1. sphère creuse : 1 m d'épaisseur ---
bpy.ops.mesh.primitive_uv_sphere_add(radius=5, segments=128, ring_count=64)
ext = bpy.context.object
bpy.ops.mesh.primitive_uv_sphere_add(radius=4, segments=128, ring_count=64)
booleen(ext, bpy.context.object)
bvh, nf = bvh_de(ext)
dirs = directions(3000)
res["sphere_creuse"] = {"attendu": 150.0, **mesure(bvh, Vector((0, 0, 0)), dirs), "faces": nf}
bpy.data.objects.remove(ext, do_unlink=True)

# --- 2. esquisse du pôle sud ---
F = json.loads((PROJ / "pole-sud-esquisse.json").read_text(encoding="utf-8"))
val = lambda x: x["v"] if isinstance(x, dict) and "v" in x else x
mods = [e for e in F["elements"] if e.get("forme", {}).get("type") == "cylindre"]
habs = [e for e in mods if e.get("pressurise")]
B = next(e for e in F["elements"] if e.get("forme", {}).get("type") == "butte")
couv, talus = val(B["forme"]["couverture_m"]), val(B["forme"]["talus_deg"])
Rm = max(val(e["forme"]["diametre_m"]) / 2 for e in habs)
xa = min(e["position_m"][0] - val(e["forme"]["longueur_m"]) / 2 for e in habs)
xb = max(e["position_m"][0] + val(e["forme"]["longueur_m"]) / 2 for e in habs)
c, H, tt = Rm + couv, 2 * Rm + couv, math.tan(math.radians(talus))
pied = c + H / tt                                       # demi-largeur au sol

# butte : profil trapézoïdal balayé autour du segment [xa, xb] (plan en stade), construite comme solide fermé
bm = bmesh.new()
prof = [(pied, 0.0), (c, H)]                            # (distance au segment, hauteur)
N = 48                                                  # pas angulaire des bouts arrondis
anneaux = []
for (dist, z) in prof:
    pts = []
    for k in range(N + 1):                              # bout est : demi-cercle autour de (xb, 0)
        a = -math.pi / 2 + math.pi * k / N
        pts.append((xb + dist * math.cos(a), dist * math.sin(a), z))
    for k in range(N + 1):                              # bout ouest
        a = math.pi / 2 + math.pi * k / N
        pts.append((xa + dist * math.cos(a), dist * math.sin(a), z))
    anneaux.append([bm.verts.new(p) for p in pts])
n = len(anneaux[0])
for i in range(n):
    j = (i + 1) % n
    bm.faces.new((anneaux[0][i], anneaux[0][j], anneaux[1][j], anneaux[1][i]))
bm.faces.new(list(reversed(anneaux[0])))                # dessous (z = 0)
bm.faces.new(anneaux[1])                                # dessus plat
bm.normal_update()
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("butte")
bm.to_mesh(me)
butte = bpy.data.objects.new("Butte_regolithe", me)
bpy.context.collection.objects.link(butte)

for e in mods:                                          # évider les modules et les sas (axe x, posés au sol)
    R, L = val(e["forme"]["diametre_m"]) / 2, val(e["forme"]["longueur_m"])
    x, y, _ = e["position_m"]
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=R, depth=L, location=(x, y, R), rotation=(0, math.pi / 2, 0))
    booleen(butte, bpy.context.object)

f = next(e for e in F["elements"] if e.get("type") == "ouverture")["forme"]
o, w, h = f["oeil_m"], f["largeur_oeil_m"] / 2, f["hauteur_oeil_m"] / 2
ta = [math.tan(math.radians(a)) for a in f["az_deg"]]
te = [math.tan(math.radians(a)) for a in f["el_deg"]]
bm = bmesh.new()
coins = []
for dy in (0.0, 60.0):                                  # coin d'air de l'œil jusqu'au-delà de la butte
    for (su, se) in ((0, 0), (1, 0), (1, 1), (0, 1)):
        u = (-w + dy * ta[0]) if su == 0 else (w + dy * ta[1])
        z = (-h + dy * te[0]) if se == 0 else (h + dy * te[1])
        coins.append(bm.verts.new((o[0] + u, o[1] + dy, o[2] + z)))
v = coins
for q in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
    bm.faces.new([v[i] for i in q])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("fente")
bm.to_mesh(me)
fente = bpy.data.objects.new("Fente", me)
bpy.context.collection.objects.link(fente)
booleen(butte, fente)

bvh, nf = bvh_de(butte)
hab = json.loads((PROJ.parent / "etude" / "donnees" / "habitat.json").read_text(encoding="utf-8"))
horizon = hab["horizon"]["h"]
points = [(f"centre de {e['id']}", Vector((e["position_m"][0], e["position_m"][1], 1.5))) for e in habs]
points += [("devant la fenêtre-Terre", Vector(o)), (f"bout ouest de {habs[0]['id']}", Vector((xa + 0.8, 0, 1.5)))]
res["esquisse"] = {"faces": nf, "points": {nom: mesure(bvh, p, dirs, horizon) for nom, p in points}}

# comparaison avec le site
site = json.loads((PROJ / "rayons-pole-sud-esquisse.json").read_text(encoding="utf-8"))
res["site"] = {c_["nom"]: {"part": c_["part"], "min": c_["min"]} for c_ in site["ciel"]}

bpy.ops.wm.save_as_mainfile(filepath=str(ICI / "esquisse_butte.blend"))
(ICI / "verif_rayons.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print("VERIF", json.dumps(res, ensure_ascii=False))
