"""Shared, deterministic branch skeleton for oak.py (leafy) and oak_bare.py
(winter), so both trees have the identical trunk and major limbs."""
import math
import random
from mathutils import Vector, Matrix

TRUNK_COL = (0.40, 0.36, 0.32)
TRUNK_DK = (0.29, 0.26, 0.23)
HEIGHT = 14.0


class Branch:
    def __init__(self, pts, radii, sides, level):
        self.pts = [Vector(p) for p in pts]
        self.radii = radii
        self.sides = sides
        self.level = level

    def at(self, t):
        """Point and direction at parameter t (0..1) along the polyline."""
        segs = len(self.pts) - 1
        f = min(segs - 1e-6, t * segs)
        i = int(f)
        u = f - i
        a, b = self.pts[i], self.pts[i + 1]
        return a.lerp(b, u), (b - a).normalized(), self.radii[i] + (self.radii[i + 1] - self.radii[i]) * u


def _rot_off(d, ang, rng, up_bias=0.35):
    """Rotate direction d away by ang around a random perpendicular axis,
    then bias upward."""
    perp = d.cross(Vector((0, 0, 1)))
    if perp.length < 1e-3:
        perp = Vector((1, 0, 0))
    perp.normalize()
    perp = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, d) @ perp
    nd = Matrix.Rotation(ang, 3, perp) @ d
    nd = (nd + Vector((0, 0, up_bias))).normalized()
    return nd


def _path(start, d, length, segs, bend_up, rng, wobble=0.12):
    pts = [Vector(start)]
    cur = Vector(d)
    p = Vector(start)
    for i in range(segs):
        cur = (cur + Vector((0, 0, bend_up)) + Vector((rng.uniform(-wobble, wobble),
                                                       rng.uniform(-wobble, wobble), 0))).normalized()
        p = p + cur * (length / segs)
        pts.append(p.copy())
    return pts


def skeleton(levels=4, seed=11):
    rng = random.Random(seed)
    out = []
    trunk = Branch([(0, 0, 0), (0.06, 0.02, 1.2), (0.10, 0.0, 2.4), (0.12, 0.05, 3.4)],
                   [0.62, 0.48, 0.44, 0.38], 7, 0)
    out.append(trunk)
    limb_defs = [  # azimuth, elevation, length, start z
        (20, 36, 5.6, 2.9), (115, 32, 5.5, 3.1), (205, 38, 5.4, 3.0),
        (295, 34, 5.6, 3.3)]
    limbs = []
    for az, el, L, z0 in limb_defs[:4]:
        a, e = math.radians(az), math.radians(el)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
        s = trunk.at(min(0.999, z0 / 3.4))[0]
        pts = _path(s, d, L, 3, 0.2, rng)
        b = Branch(pts, [0.30, 0.22, 0.15, 0.09], 6, 1)
        limbs.append(b)
        out.append(b)
    # central leader to fill the crown top
    lead = Branch(_path(trunk.pts[-1], Vector((0.05, -0.05, 1)).normalized(), 5.2, 3, 0.0, rng),
                  [0.26, 0.19, 0.13, 0.07], 6, 1)
    limbs.append(lead)
    out.append(lead)

    parents = limbs
    spec = {2: (5, 2, 0.62, 0.40, [0.45, 0.72, 0.97]),
            3: (3, 1, 0.55, 0.42, [0.5, 0.8, 1.0]),
            4: (3, 1, 0.5, 0.40, [0.6, 1.0])}
    for lvl in range(2, levels + 1):
        sides, segs, lscale, rscale, ts = spec[lvl]
        kids = []
        for p in parents:
            plen = sum((p.pts[i + 1] - p.pts[i]).length for i in range(len(p.pts) - 1))
            for t in ts:
                pos, d, r = p.at(t)
                ang = math.radians(rng.uniform(28, 48))
                nd = _rot_off(d, ang, rng, up_bias=0.32 if lvl < 4 else 0.12)
                hor = Vector((pos.x, pos.y, 0))
                if hor.length > 3.0:     # keep the crown round: bend far-out shoots back in
                    nd = (nd - hor.normalized() * 0.28 * (hor.length / 5.0)).normalized()
                L = plen * lscale * rng.uniform(0.85, 1.1)
                r0 = max(0.008, r * 0.8)
                pts = _path(pos, nd, L, segs, 0.08, rng, wobble=0.18)
                rr = [r0] + [max(0.006, r0 * (1 - (i + 1) / segs * 0.75)) for i in range(segs)]
                b = Branch(pts, rr, sides, lvl)
                kids.append(b)
                out.append(b)
        parents = kids
    return out


def scale_to_height(branches, h=HEIGHT, extra_top=0.0):
    top = max(p.z for b in branches for p in b.pts) + extra_top
    s = h / top
    for b in branches:
        b.pts = [p * s for p in b.pts]
        b.radii = [r * s for r in b.radii]
    return s


def bark_col(p, i=0):
    t = min(1.0, p.z / 2.5)
    return tuple(TRUNK_DK[j] + (TRUNK_COL[j] - TRUNK_DK[j]) * t for j in range(3))
