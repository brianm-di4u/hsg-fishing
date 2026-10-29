"""Shortleaf pine (Pinus echinata), ~18 m. Origin at trunk base, up +Z (glTF +Y).
Tall straight bare trunk (~70 % of height) and an open, irregular,
rounded-conical crown of clumped needle masses. Vertex colours on two
materials: 'bark' and 'needles' (clumps darker underneath)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

reset()
rng = random.Random(7)
MATS = {'bark': mat('bark', rough=0.95, vcol=True),
        'needles': mat('needles', rough=0.85, vcol=True)}

H = 18.0
BARK = (0.42, 0.36, 0.31)
BARK_DK = (0.30, 0.25, 0.21)
NEED_TOP = (0.17, 0.29, 0.13)
NEED_BOT = (0.07, 0.13, 0.06)


def bark_col(p, i=0):
    t = min(1.0, p.z / 3.0)
    return tuple(BARK_DK[j] + (BARK[j] - BARK_DK[j]) * t for j in range(3))


mb = MB()
# trunk: straight, slight wobble, tapering into the crown
tz = [0.0, 0.5, 4.0, 8.0, 11.5, 14.5, 17.0]
trunk_pts = [(0.0 + (0.06 * math.sin(z * 0.7) if z > 1 else 0), 0.04 * math.cos(z * 0.5), z) for z in tz]
trunk_r = [0.36, 0.27, 0.235, 0.20, 0.16, 0.11, 0.05]
tube(mb, trunk_pts, trunk_r, 6, 'bark', color=bark_col, tip=Vector((0.05, 0.02, 17.6)))


def trunk_at(z):
    for a, b in zip(trunk_pts, trunk_pts[1:]):
        if a[2] <= z <= b[2]:
            t = (z - a[2]) / (b[2] - a[2])
            return Vector(a).lerp(Vector(b), t)
    return Vector(trunk_pts[-1])


CROWN0 = 12.3          # crown base (~68 % of height)
clumps = [
    # height, azimuth deg, distance, size
    (12.8, 20, 2.3, 1.45),
    (13.2, 150, 2.1, 1.40),
    (13.8, 265, 2.2, 1.45),
    (14.5, 85, 1.75, 1.35),
    (15.0, 205, 1.6, 1.30),
    (15.6, 325, 1.4, 1.25),
    (16.3, 125, 0.95, 1.15),
    (16.9, 30, 0.55, 1.05),
    (17.35, 0, 0.0, 0.95),
]


def needle_col_fn(cz, sz):
    def f(w, d):
        t = max(0.0, min(1.0, 0.5 + d.z * 0.6))
        v = rng.uniform(-0.015, 0.015)
        return tuple(NEED_BOT[j] + (NEED_TOP[j] - NEED_BOT[j]) * t + v for j in range(3))
    return f


for h, az, dist, s in clumps:
    a = math.radians(az + rng.uniform(-15, 15))
    base = trunk_at(min(h - 0.7, 16.8))
    c = base + Vector((math.cos(a) * dist, math.sin(a) * dist, 0.7))
    rx = s * rng.uniform(1.0, 1.25)
    ry = s * rng.uniform(0.9, 1.1)
    rz = s * (0.72 if dist > 0 else 0.9)
    blob(mb, c, (rx, ry, rz), rng, subdiv=2, lump=0.2, freq=1.4, flat_bottom=0.3,
         rotz=a, color=needle_col_fn(c.z, rz), mat='needles')
    if dist > 0.3:
        # bare branch from trunk out to the clump (visible under the open crown)
        tube(mb, [base - Vector((0, 0, 0.2)), base.lerp(c, 0.55) + Vector((0, 0, 0.1)), c - Vector((0, 0, 0.2))],
             [0.08, 0.05, 0.03], 3, 'bark', color=bark_col)

tree = mb.build('pine', MATS, sharp=None, vcol=True)
save_blend('pine')
glb = export_glb('pine', [tree])
render('pine', [tree], view=(1.0, -1.2, 0.35), fill=1.0)
report('pine', [tree], glb)
