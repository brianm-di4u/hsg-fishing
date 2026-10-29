"""Shared helpers for the procedural fishing-game models.

Every model script does:
    import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from common import *
and is run with:
    blender.exe -b --python art-src/blender/scripts/<model>.py
"""
import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                      # art-src/blender
EXPORT_DIR = os.path.join(ROOT, 'export')
RENDER_DIR = os.path.join(ROOT, 'renders')
for _d in (EXPORT_DIR, RENDER_DIR):
    os.makedirs(_d, exist_ok=True)

SKY = (0.62, 0.77, 0.93)


# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    bpy.context.preferences.filepaths.save_version = 0   # no .blend1 backups


def lin(c):
    """sRGB (0-1) -> linear, for Principled inputs."""
    def f(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(f(v) for v in c[:3])


def _principled(m):
    if m.node_tree is None:
        try:
            m.use_nodes = True
        except Exception:
            pass
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            return n
    out = m.node_tree.nodes.get('Material Output') or m.node_tree.nodes.new('ShaderNodeOutputMaterial')
    b = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    m.node_tree.links.new(b.outputs[0], out.inputs[0])
    return b


def mat(name, rgb=(1, 1, 1), rough=0.6, metal=0.0, coat=0.0, alpha=1.0,
        vcol=False, cull=True, spec=0.5):
    """Principled material from an sRGB colour. vcol=True drives Base Color
    from the 'Col' colour attribute (exported as COLOR_0)."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = _principled(m)
    b.inputs['Base Color'].default_value = (*lin(rgb), 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in b.inputs:
        b.inputs['Specular IOR Level'].default_value = spec
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    if vcol:
        n = m.node_tree.nodes.new('ShaderNodeVertexColor')
        n.layer_name = 'Col'
        m.node_tree.links.new(n.outputs['Color'], b.inputs['Base Color'])
    m.use_backface_culling = cull
    m.diffuse_color = (*lin(rgb), alpha)
    return m


# ---------------------------------------------------------------- mesh builder
class MB:
    """Collects verts/faces with a material key and per-vertex colour."""

    def __init__(self):
        self.v, self.c, self.f, self.m, self.s = [], [], [], [], []

    def vert(self, p, c=None):
        self.v.append(Vector(p))
        self.c.append(tuple(c) if c is not None else (1.0, 1.0, 1.0))
        return len(self.v) - 1

    def face(self, ids, mat='default', smooth=True):
        self.f.append(list(ids))
        self.m.append(mat)
        self.s.append(smooth)

    def build(self, name, mats, sharp=None, vcol=False, merge=0.0,
              recalc=False, link=True):
        keys = []
        for k in self.m:
            if k not in keys:
                keys.append(k)
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.v], [], self.f)
        for k in keys:
            me.materials.append(mats[k])
        me.polygons.foreach_set('material_index', [keys.index(k) for k in self.m])
        me.polygons.foreach_set('use_smooth', self.s)
        if vcol:
            a = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
            for i, c in enumerate(self.c):
                a.data[i].color_srgb = (c[0], c[1], c[2], 1.0)
            me.color_attributes.active_color = a
            try:
                me.color_attributes.render_color_index = 0
            except Exception:
                pass
        if merge or recalc:
            bm = bmesh.new()
            bm.from_mesh(me)
            if merge:
                bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=merge)
                bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=merge * 0.5)
            if recalc:
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            bm.to_mesh(me)
            bm.free()
        if sharp is not None:
            me.set_sharp_from_angle(angle=math.radians(sharp))
        me.validate()
        me.update()
        o = bpy.data.objects.new(name, me)
        if link:
            bpy.context.scene.collection.objects.link(o)
        return o


def xf(M, p):
    return M @ Vector(p) if M is not None else Vector(p)


def add_bm(mb, bm, M=None, mat='default', color=None, smooth=True):
    idx = {}
    for v in bm.verts:
        p = xf(M, v.co)
        idx[v] = mb.vert(p, color(p) if color else None)
    for f in bm.faces:
        mb.face([idx[v] for v in f.verts], mat, smooth)


def box(mb, lo, hi, mat='default', M=None, smooth=False):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    P = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    i = [mb.vert(xf(M, p)) for p in P]
    for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        mb.face([i[k] for k in q], mat, smooth)


def rbox(mb, size, bevel, M=None, mat='default', segments=1):
    """Bevelled box centred on the origin of M."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=bevel,
                    segments=segments, affect='EDGES', profile=0.5)
    add_bm(mb, bm, M, mat)
    bm.free()


def prism(mb, poly, y0, y1, mat='default', M=None, side_mats=None, smooth=False):
    """Extrude a convex XZ polygon (CCW seen from -Y) between y0 and y1."""
    a = [mb.vert(xf(M, (x, y0, z))) for x, z in poly]
    b = [mb.vert(xf(M, (x, y1, z))) for x, z in poly]
    n = len(poly)
    mb.face(a, mat, smooth)
    mb.face(list(reversed(b)), mat, smooth)
    for k in range(n):
        k2 = (k + 1) % n
        mk = side_mats[k] if side_mats else mat
        mb.face([a[k], b[k], b[k2], a[k2]], mk, smooth)


def frames_along(pts):
    pts = [Vector(p) for p in pts]
    n = len(pts)
    T = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        T.append(t.normalized())
    up = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = T[0].cross(up).normalized()
    out = []
    for i in range(n):
        N = (N - T[i] * N.dot(T[i])).normalized()
        out.append((pts[i], T[i], N, T[i].cross(N)))
    return out


def tube(mb, pts, radii, sides, mat='default', cap0=False, cap1=False,
         tip=None, color=None, smooth=True, M=None, jitter=0.0, rng=None,
         phase=0.0):
    """Tapered tube along a polyline. tip=Vector closes the end with a cone."""
    rings = []
    for i, (p, T, N, B) in enumerate(frames_along(pts)):
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides + phase
            r = radii[i] * (1 + (rng.uniform(-jitter, jitter) if jitter else 0))
            q = xf(M, p + (N * math.cos(a) + B * math.sin(a)) * r)
            ring.append(mb.vert(q, color(q, i) if color else None))
        rings.append(ring)
    s = sides
    for i in range(len(rings) - 1):
        A, Bn = rings[i], rings[i + 1]
        for k in range(s):
            mb.face([A[k], A[(k + 1) % s], Bn[(k + 1) % s], Bn[k]], mat, smooth)
    if cap0:
        mb.face(list(reversed(rings[0])), mat, False)
    if tip is not None:
        q = xf(M, tip)
        t = mb.vert(q, color(q, len(rings)) if color else None)
        R = rings[-1]
        for k in range(s):
            mb.face([R[k], R[(k + 1) % s], t], mat, smooth)
    elif cap1:
        mb.face(rings[-1], mat, False)
    return rings


def loft(mb, rings_pts, matfn, closed=True, smooth=True, color=None):
    """Connect rings of equal length. matfn(i, k) -> material key."""
    rings = [[mb.vert(p, color(p) if color else None) for p in r] for r in rings_pts]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(n if closed else n - 1):
            k2 = (k + 1) % n
            mb.face([A[k], A[k2], B[k2], B[k]], matfn(i, k), smooth)
    return rings


def blob(mb, center, radii, rng, subdiv=2, lump=0.18, freq=1.6,
         flat_bottom=0.0, rotz=0.0, color=None, mat='default'):
    """Lumpy icosphere mass (subdiv 2 = 80 tris)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))
    cz, sz = math.cos(rotz), math.sin(rotz)
    c = Vector(center)
    idx = {}
    for v in bm.verts:
        d = v.co.normalized()
        s = 1.0 + lump * noise.noise(d * freq + off) * 1.6 + rng.uniform(-lump, lump) * 0.12
        p = Vector((d.x * radii[0], d.y * radii[1], d.z * radii[2])) * s
        if p.z < 0:
            p.z *= (1.0 - flat_bottom)
        p = Vector((p.x * cz - p.y * sz, p.x * sz + p.y * cz, p.z))
        w = c + p
        idx[v] = mb.vert(w, color(w, d) if color else None)
    for f in bm.faces:
        mb.face([idx[v] for v in f.verts], mat, True)
    bm.free()


# ---------------------------------------------------------------- stats / io
def tri_count(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in objs:
        if o.type != 'MESH':
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


def descendants(o):
    out = [o]
    for c in o.children:
        out += descendants(c)
    return out


def save_blend(name):
    path = os.path.join(ROOT, name + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=path, check_existing=False)
    return path


def export_glb(name, roots):
    path = os.path.join(EXPORT_DIR, name + '.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for r in roots:
        for o in descendants(r):
            o.select_set(True)
    bpy.context.view_layer.objects.active = roots[0]
    kw = dict(filepath=path, export_format='GLB', export_apply=True,
              export_yup=True, use_selection=True, export_texcoords=False,
              export_normals=True, export_materials='EXPORT',
              export_animations=False, export_vertex_color='MATERIAL',
              export_extras=False, export_cameras=False, export_lights=False)
    while True:
        try:
            bpy.ops.export_scene.gltf(**kw)
            break
        except TypeError as e:
            bad = [k for k in kw if k in str(e) and k != 'filepath']
            if not bad:
                raise
            kw.pop(bad[0])
    return path


def render(name, objs, view=(1.0, -1.3, 0.55), lens=50, fill=1.0,
           target=None, sun_rot=(50, 0, 35)):
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            continue
    sc.render.resolution_x, sc.render.resolution_y = 800, 500
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = 'Standard'
    except Exception:
        pass
    w = bpy.data.worlds.get('preview_sky') or bpy.data.worlds.new('preview_sky')
    try:
        w.use_nodes = True
    except Exception:
        pass
    bg = [n for n in w.node_tree.nodes if n.type == 'BACKGROUND'][0]
    bg.inputs[0].default_value = (*lin(SKY), 1.0)
    bg.inputs[1].default_value = 0.9
    sc.world = w

    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = Vector(target) if target else (mn + mx) / 2
    r = max((p - c).length for p in pts)

    cd = bpy.data.cameras.new('pcam')
    cd.lens = lens
    cd.clip_end = 1000
    cam = bpy.data.objects.new('pcam', cd)
    sc.collection.objects.link(cam)
    hfov = 2 * math.atan(cd.sensor_width / (2 * lens))
    vfov = 2 * math.atan(math.tan(hfov / 2) * 500 / 800)
    d = r / math.sin(vfov / 2) * fill
    v = Vector(view).normalized()
    cam.location = c + v * d
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam

    ld = bpy.data.lights.new('psun', 'SUN')
    ld.energy = 3.2
    ld.angle = math.radians(3)
    sun = bpy.data.objects.new('psun', ld)
    sun.rotation_euler = tuple(math.radians(a) for a in sun_rot)
    sc.collection.objects.link(sun)

    path = os.path.join(RENDER_DIR, name + '.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(sun)
    return path


def report(name, objs, glb):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    dims = [max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3)]
    print('@@REPORT %s tris=%d size=%d objects=%s dims=%.2f x %.2f x %.2f zmin=%.2f' % (
        name, tri_count(objs), os.path.getsize(glb),
        ','.join(o.name for o in objs), dims[0], dims[1], dims[2],
        min(p.z for p in pts)))
