"""Eastern redcedar (Juniperus virginiana), ~8 m: dense, narrow
columnar-conical evergreen. Origin at trunk base. Vertex colours on
'bark' and 'foliage' materials (darker low down and in the recesses)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
rng = random.Random(5)
MATS = {'bark': mat('bark', rough=0.95, vcol=True),
        'foliage': mat('foliage', rough=0.85, vcol=True)}
FOL = (0.16, 0.26, 0.14)
FOL_DK = (0.07, 0.12, 0.07)
BARK = (0.42, 0.30, 0.24)

H = 8.0
mb = MB()
tube(mb, [(0, 0, 0), (0, 0, 0.6), (0.02, 0, 1.4)], [0.17, 0.13, 0.10], 6, 'bark',
     color=lambda p, i: BARK)

SIDES = 13
z0 = 0.45
levels = [0.45, 0.75, 1.2, 1.75, 2.35, 2.95, 3.55, 4.15, 4.75, 5.3, 5.85, 6.35, 6.85, 7.3, 7.65]


def radius(z):
    u = (z - z0) / (H - z0)
    body = 1.22 * (1 - u) ** 0.68
    base = min(1.0, (z - z0 + 0.12) / 0.55) ** 0.6
    return max(0.05, body * base)


off = Vector((rng.uniform(0, 9), rng.uniform(0, 9), rng.uniform(0, 9)))
rings = []
for li, z in enumerate(levels):
    ring = []
    R = radius(z)
    tuft = 1.0 if li % 2 == 0 else 0.82     # alternate full / tucked rings -> tufted outline
    ph = (li % 2) * math.pi / SIDES + rng.uniform(-0.12, 0.12)
    lean = Vector((0.03 * z, 0.015 * z, 0))
    for k in range(SIDES):
        a = 2 * math.pi * k / SIDES + ph
        d = Vector((math.cos(a), math.sin(a), 0))
        n = noise.noise(d * 1.3 + Vector((0, 0, z * 0.6)) + off)
        r = R * tuft * (1 + 0.22 * n + rng.uniform(-0.06, 0.06))
        p = d * r + Vector((0, 0, z + rng.uniform(-0.06, 0.06))) + lean
        t = min(1.0, (z - z0) / 3.0) * (0.75 + 0.25 * tuft) * (0.85 + 0.15 * n)
        col = tuple(FOL_DK[j] + (FOL[j] - FOL_DK[j]) * max(0, min(1, t)) for j in range(3))
        ring.append(mb.vert(p, col))
    rings.append(ring)
for i in range(len(rings) - 1):
    A, B = rings[i], rings[i + 1]
    for k in range(SIDES):
        mb.face([A[k], A[(k + 1) % SIDES], B[(k + 1) % SIDES], B[k]], 'foliage', True)
tip = mb.vert((0.03 * H + 0.02, 0.015 * H, H), FOL)
for k in range(SIDES):
    mb.face([rings[-1][k], rings[-1][(k + 1) % SIDES], tip], 'foliage', True)
# underside cap (slightly domed up so it is not seen as a flat disc)
under = mb.vert((0, 0, z0 + 0.25), FOL_DK)
for k in range(SIDES):
    mb.face([rings[0][(k + 1) % SIDES], rings[0][k], under], 'foliage', True)

tree = mb.build('cedar', MATS, vcol=True)
save_blend('cedar')
glb = export_glb('cedar', [tree])
render('cedar', [tree], view=(1.0, -1.2, 0.3), fill=1.0)
report('cedar', [tree], glb)
