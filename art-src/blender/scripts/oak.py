"""Mature oak/hickory hardwood, ~14 m, in leaf. Origin at trunk base.
Short trunk, 3-4 major limbs and a broad rounded crown of overlapping lumpy
masses. Crown vertex colour is a light neutral green-grey (the game tints the
'leaves' material per season); trunk is brown-grey ('bark')."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import oak_skel as S

reset()
rng = random.Random(23)
MATS = {'bark': mat('bark', rough=0.95, vcol=True),
        'leaves': mat('leaves', rough=0.85, vcol=True)}
LEAF = (0.70, 0.74, 0.63)
LEAF_DK = (0.40, 0.43, 0.36)

full = S.skeleton(levels=4)
S.scale_to_height(full)
mb = MB()
for b in full:
    if b.level > 2:
        continue
    sides = {0: 7, 1: 6, 2: 4}[b.level]
    pts, radii = b.pts, b.radii
    if b.level == 2:            # only the inner part of each branch shows under the crown
        pts, radii = pts[:2], radii[:2]
    tube(mb, pts, radii, sides, 'bark', color=S.bark_col)

limbs = [b for b in full if b.level == 1]
centres = []
for b in limbs:
    e = b.pts[-1]
    if b is limbs[-1]:          # central leader -> big dome on top
        centres.append((e + Vector((0, 0, 2.0)), 3.4))
    else:
        centres.append((e + Vector((0, 0, 0.5)), 2.95))
# fillers between neighbouring outer limbs (sorted by azimuth)
outer = sorted(limbs[:4], key=lambda b: math.atan2(b.pts[-1].y, b.pts[-1].x))
for i in range(len(outer)):
    a, b = outer[i].pts[-1], outer[(i + 1) % len(outer)].pts[-1]
    m = (a + b) * 0.5
    hor = Vector((m.x, m.y, 0))
    if hor.length > 1e-3:
        m = m + hor.normalized() * 0.6
    centres.append((m - Vector((0, 0, 0.6)), 2.7))

top_target = S.HEIGHT


def leaf_col(w, d):
    t = max(0.0, min(1.0, 0.45 + d.z * 0.65))
    v = rng.uniform(-0.02, 0.02)
    return tuple(LEAF_DK[j] + (LEAF[j] - LEAF_DK[j]) * t + v for j in range(3))


for c, r in centres:
    rz = r * 0.82
    # keep the crown top at ~14 m
    if c.z + rz > top_target - 0.1:
        c = Vector((c.x, c.y, top_target - 0.1 - rz))
    blob(mb, c, (r * rng.uniform(1.0, 1.15), r * rng.uniform(0.95, 1.1), rz), rng,
         subdiv=2, lump=0.17, freq=1.5, flat_bottom=0.25,
         rotz=rng.uniform(0, 6.28), color=leaf_col, mat='leaves')

tree = mb.build('oak', MATS, vcol=True)
save_blend('oak')
glb = export_glb('oak', [tree])
render('oak', [tree], view=(1.0, -1.2, 0.35), fill=0.8)
report('oak', [tree], glb)
