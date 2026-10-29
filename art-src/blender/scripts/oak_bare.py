"""The oak from oak.py in winter: same trunk and limbs plus three further
levels of tapered branches, no leaves. Origin at trunk base, ~14 m."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
import oak_skel as S

reset()
MATS = {'bark': mat('bark', rough=0.95, vcol=True)}

full = S.skeleton(levels=4)
S.scale_to_height(full)
mb = MB()
SIDES = {0: 7, 1: 6, 2: 5, 3: 3, 4: 3}
for b in full:
    tube(mb, b.pts, b.radii, SIDES[b.level], 'bark', color=S.bark_col)

tree = mb.build('oak_bare', MATS, vcol=True)
save_blend('oak_bare')
glb = export_glb('oak_bare', [tree])
render('oak_bare', [tree], view=(1.0, -1.2, 0.35), fill=0.8)
report('oak_bare', [tree], glb)
