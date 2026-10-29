"""Three novaculite/shale rocks (rock0, rock1, rock2), ~1 m across, flattish,
irregular but not spiky, light grey with warmer tones (vertex colour on one
'rock' material). Each object's origin is at its base centre; the flat base
sits ~6 cm below the origin so the rock beds into the ground.
In the GLB all three sit at the origin; the .blend/preview spaces them out."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
MATS = {'rock': mat('rock', rough=0.85, vcol=True)}
GREY = (0.66, 0.65, 0.63)
WARM = (0.71, 0.61, 0.50)
DARK = (0.44, 0.42, 0.40)

SPECS = [  # seed, half extents (x, y, z), cleave planes
    (3, (0.55, 0.42, 0.26), 5),
    (8, (0.50, 0.46, 0.32), 4),
    (21, (0.60, 0.38, 0.22), 6),
]


def make_rock(name, seed, ext, n_planes):
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    off = Vector((rng.uniform(-40, 40), rng.uniform(-40, 40), rng.uniform(-40, 40)))
    planes = []
    for _ in range(n_planes):
        nrm = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 0.9))).normalized()
        planes.append((nrm, rng.uniform(0.5, 0.72)))
    for v in bm.verts:
        d = v.co.normalized()
        s = 1.0 + 0.24 * noise.noise(d * 1.3 + off) + 0.07 * noise.noise(d * 3.3 + off * 2)
        p = d * s
        # cleaved faces: clamp to a few planes (the flat facets of novaculite)
        for nrm, dist in planes:
            h = p.dot(nrm)
            if h > dist:
                p = p - nrm * (h - dist)
        p = Vector((p.x * ext[0], p.y * ext[1], p.z * ext[2]))
        # flat base, bedded slightly below the origin
        base = -0.06
        if p.z < 0:
            p.z = max(base, p.z * 0.35 + base * 0.2)
        else:
            p.z = p.z + base * 0.0
        v.co = p
    # lift so the base is at -0.06
    zmin = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z += (-0.06 - zmin)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(MATS['rock'])
    # decimate to the triangle budget
    dec = o.modifiers.new('dec', 'DECIMATE')
    dec.ratio = 0.56
    dec.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier='dec')
    # vertex colour: grey with warm patches, darker toward the base
    col = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, v in enumerate(me.vertices):
        p = v.co
        w = max(0.0, min(1.0, 0.5 + 0.9 * noise.noise(p * 2.2 + off)))
        c = [GREY[j] + (WARM[j] - GREY[j]) * w for j in range(3)]
        t = max(0.0, min(1.0, (p.z + 0.06) / 0.18))
        c = [DARK[j] + (c[j] - DARK[j]) * (0.35 + 0.65 * t) for j in range(3)]
        c = [x + rng.uniform(-0.02, 0.02) for x in c]
        col.data[i].color_srgb = (*c, 1.0)
    me.color_attributes.active_color = col
    for poly in me.polygons:
        poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(30))
    me.update()
    return o


rocks = [make_rock('rock%d' % i, *SPECS[i]) for i in range(3)]
save_blend('rocks')
for i, r in enumerate(rocks):
    r.location = ((i - 1) * 1.5, 0, 0)
render('rocks', rocks, view=(0.9, -1.3, 0.7), fill=0.62)
for r in rocks:
    r.location = (0, 0, 0)
glb = export_glb('rock', rocks)
save_blend('rocks')
for r in rocks:
    print('@@ROCK %s tris=%d' % (r.name, tri_count([r])))
report('rock', rocks, glb)
