"""Modern fibreglass bass boat (6.2 m x 2.35 m).

Blender axes: bow +X, port +Y, starboard -Y, up +Z; origin = hull centre at
the waterline. After glTF Y-up export: bow +X, up +Y.
Hierarchy: boat (empty) -> hull, motor, trolling_motor.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()

MATS = {
    'flake':  mat('hull_navy_flake', (0.06, 0.10, 0.28), rough=0.3, metal=0.6, coat=1.0),
    'stripe': mat('stripe_silver', (0.86, 0.88, 0.91), rough=0.22, metal=0.85, coat=1.0),
    'carpet': mat('deck_carpet', (0.43, 0.44, 0.45), rough=1.0, spec=0.2),
    'seam':   mat('hatch_seam', (0.13, 0.13, 0.14), rough=0.9),
    'trim':   mat('trim_grey', (0.62, 0.64, 0.66), rough=0.4),
    'black':  mat('black_gloss', (0.025, 0.025, 0.03), rough=0.22, coat=0.6),
    'dark':   mat('dark_plastic', (0.09, 0.09, 0.10), rough=0.6),
    'chrome': mat('stainless', (0.80, 0.81, 0.83), rough=0.18, metal=1.0),
    'vinyl':  mat('seat_vinyl', (0.84, 0.84, 0.82), rough=0.5),
    'vinyl2': mat('seat_vinyl_navy', (0.10, 0.13, 0.25), rough=0.5),
    'glass':  mat('windscreen', (0.16, 0.20, 0.24), rough=0.05, alpha=0.45, cull=False),
    'screen': mat('screen', (0.05, 0.08, 0.11), rough=0.1),
}

# ------------------------------------------------------------------ hull shape
BMAX = 1.175


def B(x):
    if x <= 0.3:
        return BMAX - 0.06 * ((0.3 - x) / 3.4) ** 2
    t = min(1.0, (x - 0.3) / 2.8)
    return BMAX * (1 - t ** 1.7)


def G(x):
    s = max(0.0, (x - 0.4) / 2.7)
    return 0.50 + 0.06 * s * s


def K(x):
    s = max(0.0, (x - 1.2) / 1.9)
    return -0.22 + 0.42 * s ** 2.2


def C(x):
    s = max(0.0, (x - 0.2) / 2.9)
    return -0.03 + 0.40 * s ** 1.5


def PAD(x):
    return max(0.0, 0.13 * (1 - max(0.0, (x + 0.5) / 2.8)))


D_REAR, D_COCK, D_FRONT = 0.465, 0.20, 0.47
COCK0, COCK1 = -1.55, 0.62

stations = []
for x in (-3.1, -2.75, -2.35, -1.95, COCK0):
    stations.append((x, D_REAR))
for x in (COCK0 + 0.002, -1.1, -0.6, -0.1, 0.35, COCK1):
    stations.append((x, D_COCK))
for x in (COCK1 + 0.002, 0.95, 1.3, 1.62, 1.92, 2.18, 2.42, 2.62, 2.78,
          2.91, 3.0, 3.06, 3.1):
    stations.append((x, D_FRONT))


def half_profile(x, dz):
    b, g, k, c = B(x), G(x), K(x), C(x)
    pad = min(PAD(x), 0.5 * b)
    w = min(0.09, 0.42 * b)
    pts = [
        (0.0, k),
        (pad, k),
        (0.80 * b, c),
        (0.87 * b, c + 0.006),
        (0.935 * b, c + 0.38 * (g - c)),
        (0.985 * b, c + 0.72 * (g - c)),
        (b, g - 0.115),
        (b, g - 0.07),
        (b, g - 0.025),
        (max(0.0, b - 0.022), g),
        (max(0.0, b - w), g),
        (max(0.0, b - w - 0.008), min(dz, g)),
        (0.0, min(dz, g)),
    ]
    return pts


# segment material by index (segment j joins point j and j+1)
SEG = ['flake', 'flake', 'flake', 'flake', 'flake', 'flake', 'stripe',
       'flake', 'trim', 'trim', 'WALL', 'carpet']


def rake(x, z, g, k):
    if x <= 2.3:
        return x
    f = min(1.0, max(0.0, (g - z) / max(1e-4, g - k)))
    return x - 0.30 * ((x - 2.3) / 0.8) ** 2 * f


rings = []
ring_info = []
for x, dz in stations:
    H = half_profile(x, dz)
    g, k = G(x), K(x)
    full = [(y, z) for y, z in H] + [(-y, z) for y, z in reversed(H[1:-1])]
    rings.append([Vector((rake(x, z, g, k), y, z)) for y, z in full])
    ring_info.append(dz)

nH = 13
mb = MB()


def hull_mat(i, kseg):
    # map ring segment index -> half-profile segment index
    j = kseg if kseg < nH - 1 else (2 * (nH - 1) - 1 - kseg)
    m = SEG[j]
    if m == 'WALL':
        cock = ring_info[i] == D_COCK or ring_info[i + 1] == D_COCK
        m = 'carpet' if cock else 'trim'
    if j == 11 and ring_info[i] != ring_info[i + 1]:
        m = 'trim'              # deck step risers read as a light gelcoat band
    return m


hr = loft(mb, rings, hull_mat, closed=True)
mb.face(hr[0], 'flake', False)          # transom (normals fixed by recalc)
hull_mb = mb

# ------------------------------------------------------------------ deck details
det = MB()


def frame(x0, x1, y0, y1, z, wdt=0.022, mat='seam'):
    o = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    i = [(x0 + wdt, y0 + wdt), (x1 - wdt, y0 + wdt), (x1 - wdt, y1 - wdt), (x0 + wdt, y1 - wdt)]
    O = [det.vert((a, b, z)) for a, b in o]
    I = [det.vert((a, b, z)) for a, b in i]
    for k in range(4):
        k2 = (k + 1) % 4
        det.face([O[k], O[k2], I[k2], I[k]], mat, False)


def plate(x0, x1, y0, y1, z, mat):
    q = [det.vert(p) for p in ((x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z))]
    det.face(q, mat, False)


ZD = D_FRONT + 0.005
# starboard rod locker, port storage, bow centre hatch
frame(0.80, 1.80, -0.62, -0.30, ZD)
plate(1.70, 1.76, -0.50, -0.42, ZD + 0.001, 'dark')
frame(0.80, 1.50, 0.30, 0.58, ZD)
plate(1.40, 1.46, 0.40, 0.48, ZD + 0.001, 'dark')
frame(1.98, 2.36, -0.20, 0.12, ZD)
plate(2.06, 2.12, -0.08, 0.00, ZD + 0.001, 'dark')
# rear deck hatch
frame(-2.85, -1.85, -0.45, 0.45, D_REAR + 0.005)
# pedestal sockets (front + rear deck)
tube(det, [(2.05, -0.38, D_FRONT - 0.01), (2.05, -0.38, D_FRONT + 0.02)], [0.07, 0.07], 8,
     'chrome', cap1=True)
tube(det, [(-2.2, 0.0, D_REAR - 0.01), (-2.2, 0.0, D_REAR + 0.02)], [0.07, 0.07], 8,
     'chrome', cap1=True)
# front-deck graph unit on a short ram mount
box(det, (2.44, -0.20, D_FRONT), (2.52, -0.12, D_FRONT + 0.06), 'dark')
graph_M = Matrix.Translation((2.48, -0.16, D_FRONT + 0.15)) @ Matrix.Rotation(math.radians(-70), 4, 'Z') @ Matrix.Rotation(math.radians(-15), 4, 'X')
rbox(det, (0.30, 0.07, 0.19), 0.012, graph_M, 'dark')
plate_M = graph_M @ Matrix.Translation((0, -0.036, 0.0))
q = [det.vert(xf(plate_M, p)) for p in ((-0.13, 0, -0.08), (0.13, 0, -0.08), (0.13, 0, 0.08), (-0.13, 0, 0.08))]
det.face(q, 'screen', False)
# bow navigation light
tube(det, [(3.0, 0.0, G(3.0) - 0.01), (3.0, 0.0, G(3.0) + 0.05)], [0.025, 0.02], 6, 'chrome', cap1=True)
# stern cleats
for sy in (-1, 1):
    box(det, (-3.02, sy * 1.0 - 0.07, 0.50), (-2.98, sy * 1.0 + 0.07, 0.53), 'chrome')

# ------------------------------------------------------------------ console (starboard)
y_out, y_in = -1.075, -0.45
prof = [(0.0, D_COCK), (0.55, D_COCK), (0.55, 0.90), (0.42, 0.945), (0.0, 0.85)]
prism(det, prof, y_out, y_in, 'flake',
      side_mats=['flake', 'flake', 'trim', 'dark', 'flake'])
# graph screen on the dash
dash_a, dash_b = Vector((0.40, 0, 0.942)), Vector((0.0, 0, 0.85))
u = (dash_b - dash_a).normalized()
nrm = Vector((u.z, 0, -u.x)) * -1
s0 = dash_a + u * 0.06 + nrm * 0.006
s1 = dash_a + u * 0.24 + nrm * 0.006
q = [det.vert((s0.x, -0.98, s0.z)), det.vert((s0.x, -0.66, s0.z)),
     det.vert((s1.x, -0.66, s1.z)), det.vert((s1.x, -0.98, s1.z))]
det.face(q, 'screen', False)
# steering wheel facing aft, tilted
wc = Vector((-0.05, -0.80, 0.91))
wM = Matrix.Translation(wc) @ Matrix.Rotation(math.radians(-25), 4, 'Y') @ Matrix.Rotation(math.radians(90), 4, 'Y')
ring_pts = []
for kk in range(12):
    a = 2 * math.pi * kk / 12
    ring_pts.append(xf(wM, (0.17 * math.cos(a), 0.17 * math.sin(a), 0)))
ring_pts.append(ring_pts[0])
tube(det, ring_pts, [0.018] * 13, 5, 'black')
tube(det, [xf(wM, (0, 0, 0)), xf(wM, (0, 0, -0.14))], [0.035, 0.04], 6, 'black', cap0=True)
for kk in range(3):
    a = 2 * math.pi * kk / 3 + 0.5
    tube(det, [xf(wM, (0, 0, 0)), xf(wM, (0.165 * math.cos(a), 0.165 * math.sin(a), 0))],
         [0.012, 0.012], 4, 'black')
# wrap-around windscreen
yb = [-1.07, -0.99, -0.54, -0.46]
xb = [0.36, 0.48, 0.48, 0.36]
bot = [det.vert((xb[i], yb[i], 0.93)) for i in range(4)]
top = [det.vert((xb[i] - 0.16, yb[i] * 0.98 + (0.01 if i in (0, 3) else 0), 1.17)) for i in range(4)]
for i in range(3):
    det.face([bot[i], bot[i + 1], top[i + 1], top[i]], 'glass', True)
# windscreen top trim
tube(det, [det.v[t] for t in top], [0.008] * 4, 4, 'dark')

# ------------------------------------------------------------------ pedestal seats (aft cockpit)


def seat(x, y, z0, cushion='vinyl'):
    tube(det, [(x, y, z0), (x, y, z0 + 0.025)], [0.13, 0.12], 8, 'chrome', cap1=True)
    tube(det, [(x, y, z0 + 0.02), (x, y, z0 + 0.39)], [0.035, 0.035], 6, 'chrome')
    tube(det, [(x, y, z0 + 0.38), (x, y, z0 + 0.42)], [0.09, 0.09], 6, 'dark', cap0=True)
    rbox(det, (0.50, 0.50, 0.11), 0.04, Matrix.Translation((x, y, z0 + 0.475)), cushion)
    bM = Matrix.Translation((x - 0.215, y, z0 + 0.72)) @ Matrix.Rotation(math.radians(-12), 4, 'Y')
    rbox(det, (0.10, 0.48, 0.38), 0.04, bM, cushion)
    rbox(det, (0.06, 0.50, 0.10), 0.02, bM @ Matrix.Translation((-0.01, 0, -0.22)), 'vinyl2')


seat(-0.55, -0.74, D_COCK)
seat(-0.55, 0.62, D_COCK)

# hull shell: merge the collapsed bow ring, make normals consistent
hull = hull_mb.build('hull', MATS, sharp=40, merge=0.0008, recalc=True)
details = det.build('hull_details', MATS, sharp=40)
with bpy.context.temp_override(active_object=hull, object=hull,
                               selected_objects=[hull, details],
                               selected_editable_objects=[hull, details]):
    bpy.ops.object.join()
hull.data.set_sharp_from_angle(angle=math.radians(40))

# ------------------------------------------------------------------ outboard motor
mm = MB()
# transom bracket / clamp
box(mm, (-0.15, -0.16, -0.30), (0.02, 0.16, 0.10), 'dark')
# midsection leg (streamlined section lofted down)


def foil(xc, a, b, z):
    pts = [(a, 0), (0.55 * a, 0.85 * b), (-0.1 * a, b), (-0.7 * a, 0.7 * b), (-a, 0),
           (-0.7 * a, -0.7 * b), (-0.1 * a, -b), (0.55 * a, -0.85 * b)]
    return [Vector((xc + px, py, z)) for px, py in pts]


leg = [foil(-0.34, 0.15, 0.085, 0.06), foil(-0.34, 0.13, 0.065, -0.22),
       foil(-0.35, 0.115, 0.05, -0.47), foil(-0.35, 0.12, 0.04, -0.63)]
loft(mm, leg, lambda i, k: 'black', closed=True)
# anti-ventilation plate
prism(mm, [(-0.16, -0.475), (-0.66, -0.475), (-0.66, -0.495), (-0.16, -0.495)], -0.16, 0.16, 'black')
# torpedo gearcase
tube(mm, [(-0.17, 0, -0.66), (-0.24, 0, -0.66), (-0.40, 0, -0.66), (-0.56, 0, -0.66)],
     [0.045, 0.068, 0.072, 0.055], 8, 'black', tip=Vector((-0.12, 0, -0.66)), cap1=True)
# skeg
prism(mm, [(-0.30, -0.70), (-0.40, -0.70), (-0.48, -0.88), (-0.42, -0.88)], -0.009, 0.009, 'black')
# prop hub + 3 blades
tube(mm, [(-0.56, 0, -0.66), (-0.66, 0, -0.66)], [0.048, 0.04], 8, 'chrome',
     tip=Vector((-0.72, 0, -0.66)))
for kk in range(3):
    a = 2 * math.pi * kk / 3
    bM = Matrix.Translation((-0.61, 0, -0.66)) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Rotation(math.radians(35), 4, 'Z')
    prof_b = [(0.045, -0.03), (0.045, 0.03), (0.12, 0.055), (0.175, 0.02), (0.175, -0.01), (0.12, -0.05)]
    top_b = [mm.vert(xf(bM, (0.004, r, ch))) for r, ch in prof_b]
    bot_b = [mm.vert(xf(bM, (-0.004, r, ch))) for r, ch in prof_b]
    mm.face(top_b, 'chrome', False)
    mm.face(list(reversed(bot_b)), 'chrome', False)
    for j in range(6):
        j2 = (j + 1) % 6
        mm.face([top_b[j2], top_b[j], bot_b[j], bot_b[j2]], 'chrome', False)

# cowling (superellipse rings)


def sring(xc, a, b, z, n=14, e=2.6):
    out = []
    for kk in range(n):
        t = 2 * math.pi * kk / n
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2 / e), ct)
        y = b * math.copysign(abs(st) ** (2 / e), st)
        if x < 0:
            x *= 1.08          # fuller rear
        out.append(Vector((xc + x, y, z)))
    return out


cow = [sring(-0.47, 0.30, 0.19, -0.03), sring(-0.48, 0.34, 0.23, 0.10),
       sring(-0.49, 0.37, 0.255, 0.30), sring(-0.49, 0.372, 0.258, 0.36),
       sring(-0.49, 0.372, 0.258, 0.40), sring(-0.50, 0.365, 0.25, 0.55),
       sring(-0.51, 0.33, 0.225, 0.68), sring(-0.52, 0.25, 0.175, 0.765),
       sring(-0.53, 0.13, 0.09, 0.80)]
cmat = {0: 'dark', 3: 'stripe'}
cr = loft(mm, cow, lambda i, k: cmat.get(i, 'black'), closed=True)
mm.face(list(reversed(cr[0])), 'dark', False)
mm.face(cr[-1], 'black', True)
MOTOR_PIVOT = Vector((-3.12, 0.0, 0.40))
motor = mm.build('motor', MATS, sharp=45)
motor.location = MOTOR_PIVOT

# ------------------------------------------------------------------ trolling motor (port bow, stowed)
tm = MB()
S0 = Vector((2.56, 0.155, D_FRONT + 0.11))
S1 = Vector((1.16, 0.835, D_FRONT + 0.11))
u = (S1 - S0).normalized()
w = Vector((-u.y, u.x, 0)).normalized()      # horizontal, points to port side
ang = math.atan2(u.y, u.x)
R = Matrix.Rotation(ang, 4, 'Z')
# mount base + deck bracket
mbase = Matrix.Translation(S0 + u * 0.18 - Vector((0, 0, 0.11 - 0.035))) @ R
rbox(tm, (0.34, 0.24, 0.07), 0.015, mbase, 'dark')
rbox(tm, (0.16, 0.12, 0.07), 0.015, mbase @ Matrix.Translation((0, 0, 0.06)), 'black')
# control head near the bow tip
hM = Matrix.Translation(S0 - u * 0.10 + Vector((0, 0, 0.03))) @ R
rbox(tm, (0.26, 0.14, 0.13), 0.035, hM, 'black')
rbox(tm, (0.10, 0.145, 0.03), 0.01, hM @ Matrix.Translation((0.02, 0, 0.06)), 'trim')
# steering collar + composite shaft
tube(tm, [S0 + u * 0.04, S0 + u * 0.30], [0.042, 0.042], 8, 'black', cap0=True, cap1=True)
tube(tm, [S0, S1], [0.019, 0.019], 6, 'dark')
# motor rest / cradle
cM = Matrix.Translation(S0 + u * 1.05 - Vector((0, 0, 0.07))) @ R
rbox(tm, (0.08, 0.14, 0.08), 0.015, cM, 'dark')
# lower unit pod: axis horizontal, across the shaft, prop inboard
pc = S1 + u * 0.02 - Vector((0, 0, 0.035))
tube(tm, [pc + w * 0.10, pc + w * 0.02, pc - w * 0.14, pc - w * 0.24],
     [0.045, 0.065, 0.062, 0.045], 8, 'black', tip=pc + w * 0.16, cap1=True)
tube(tm, [pc - w * 0.24, pc - w * 0.30], [0.025, 0.02], 6, 'dark', tip=pc - w * 0.33)
for sgn in (-1, 1):
    bc = pc - w * 0.28
    q0 = tm.vert(bc + Vector((0, 0, 0.02 * sgn)))
    q1 = tm.vert(bc + Vector((0, 0, 0.13 * sgn)) + u * 0.03)
    q2 = tm.vert(bc + Vector((0, 0, 0.12 * sgn)) - u * 0.03 - w * 0.01)
    tm.face([q0, q1, q2], 'dark', False)
    tm.face([q2, q1, q0], 'dark', False)
trolling = tm.build('trolling_motor', MATS, sharp=45)

# ------------------------------------------------------------------ hierarchy
root = bpy.data.objects.new('boat', None)
root.empty_display_type = 'ARROWS'
bpy.context.scene.collection.objects.link(root)
for o in (hull, motor, trolling):
    o.parent = root

objs = [hull, motor, trolling]
save_blend('boat')
glb = export_glb('boat', [root])
render('boat', objs, view=(1.0, -1.25, 0.6), fill=0.6)
render('boat_rear', objs, view=(-1.0, 0.9, 0.9), fill=0.6)
render('boat_side', objs, view=(0.0, -1.0, 0.05), fill=0.55)
render('boat_bow', objs, view=(1.0, -0.7, 0.12), target=(1.0, 0, 0.2), fill=0.5)
render('boat_deck', objs, view=(-0.4, 0.05, 0.35), target=(1.6, 0, 0.5), fill=0.38, lens=28)
report('boat', objs, glb)
