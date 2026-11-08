"""Part 2 (The Connection) - new pixel-art assets for the archipelago world.
Same pipeline + palette family as Part 1 (sdf.py toon renderer, environment.py helpers)."""
import json, os, sys, math, numpy as np
from PIL import Image
from sdf import Prim, render, rot_y, rot_z, rot_x, hexc
import environment as E   # reuse helpers (outline, put, blank, pack, BAYER) - Part 1 atlas is not modified

R = {k: [hexc(c) for c in v] for k, v in {
    'wall':   ['#6b5e4c', '#a8977a', '#e2d3b2', '#fff3d6'],
    'white':  ['#7a8590', '#b8c4cc', '#eef4f6', '#ffffff'],
    'terra':  ['#4e1e14', '#8a3a24', '#c25a34', '#e8865a'],
    'slate':  ['#1e2430', '#323c4e', '#4c5a72', '#6c7c96'],
    'glass':  ['#123050', '#1d5080', '#3a86c0', '#8fd0f0'],
    'teal':   ['#0b4552', '#147f8a', '#2cbdb7', '#86eedb'],
    'stone':  ['#2e2f3d', '#4d5063', '#767b8f', '#a2a8b8'],
    'sand':   ['#4f4436', '#776a52', '#a39476', '#cfc29e'],
    'navy':   ['#0c1424', '#18243c', '#26385a', '#38507c'],
    'metal':  ['#2a2e36', '#4a505c', '#767e8c', '#a8b0bc'],
    'led':    ['#1a8a9a', '#3cd0e0', '#8ff4ff', '#e8ffff'],
    'ledoff': ['#0e2a34', '#123844', '#184a58', '#1e5a6a'],
    'gold':   ['#5e3f0e', '#a87822', '#ecc355', '#fff1a6'],
    'wood':   ['#3a2414', '#5e3c20', '#8a5e34', '#b4844a'],
    'book1':  ['#4a1410', '#7a2418', '#b03a28', '#d86848'],
    'book2':  ['#10304a', '#1a4c72', '#2a72a6', '#5aa0d0'],
    'moss':   ['#1c3a22', '#2d5a2e', '#4b8040', '#78a854'],
    'crys':   ['#1a4a8a', '#2f7cf0', '#6fd0ff', '#e4fbff'],
    'crysoff':['#1c2436', '#2a3650', '#3c4c6c', '#566a8c'],
}.items()}

def prism(w, h, d):
    """gable roof along local x: triangle in y-z, half width d, height h, half length w"""
    def fn(q):
        x, y, z = q[:, 0], q[:, 1], q[:, 2]
        tri = np.maximum(y + np.abs(z) * (h / d) - h, -y) * (d / math.hypot(h, d))
        return np.maximum(tri, np.abs(x) - w)
    return fn

def win_paint(base, cols=4, rows=2, w=10, h=6, y0=0.0, face='z', thr=0.45):
    def paint(q):
        out = []
        for x, y, z in q:
            u, v, n = (x, y, z) if face == 'z' else (z, y, x)
            m = None
            if n > (thr * 0 + 0.6) * 1 and abs(n) > 0:
                fu = (u + w) / (2 * w) * cols; fv = (v - y0 + h) / (2 * h) * rows
                if 0 < fu < cols and 0 < fv < rows and (fu % 1) > 0.3 and (fu % 1) < 0.75 and (fv % 1) > 0.25 and (fv % 1) < 0.8:
                    m = 'glass'
            out.append(m)
        return out
    return paint

def rend(prims, w, h, oy, yaw=0.5, pitch=16):
    img, _ = render(prims, R, w, h, origin=(0, oy), yaw=yaw, pitch=np.radians(pitch), outline='#141320',
                    lights={'key': (-0.55, 0.72, 0.5)})
    return img

A = {}
def add(name, img, anchor=None):
    h, w = img.shape[:2]; A[name] = (img, anchor if anchor is not None else (w // 2, h - 1))

def ground_row(img):
    a = img[..., 3] > 0; ys = np.where(a.any(1))[0]; return int(ys.max())

# ---------------------------------------------------------------- university (classical hall + portico + bell tower)
def university():
    P = []
    P.append(Prim('rbox', 'wall', (0, 9, 0), b=(18, 9, 9), round=0.6,
                  paint=lambda q: [('glass' if (z > 8.4 and abs(y - 11) < 2.5 and (abs(x) % 5) < 2.2 and abs(x) > 5) or (abs(x) > 17.4 and abs(y - 11) < 2.5 and (abs(z) % 5) < 2.2) else None) for x, y, z in q]))
    P.append(Prim('custom', 'terra', (0, 18, 0), fn=prism(19, 7, 10)))
    # portico: steps, columns, pediment
    P.append(Prim('rbox', 'sand', (0, 1.2, 12), b=(12, 1.2, 4), round=0.3))
    for cx in (-9, -3, 3, 9):
        P.append(Prim('cyl', 'white', (cx, 9, 13.5), r=1.3, h=7.6, round=0.2))
    P.append(Prim('rbox', 'white', (0, 17.4, 13), b=(11.5, 1.0, 2.6), round=0.2))
    P.append(Prim('custom', 'white', (0, 18.3, 13), R=rot_y(np.pi / 2), fn=prism(2.6, 4.5, 11.5),
                  paint=lambda q: [('gold' if (abs(q_[2]) < 2.2 and 0.8 < q_[1] < 3.0) else None) for q_ in q]))
    # bell tower with dome
    P.append(Prim('rbox', 'wall', (-12, 25, -2), b=(3.4, 7, 3.4), round=0.3,
                  paint=lambda q: [('glass' if (abs(y - 3) < 1.6 and (abs(x) < 1.0 or abs(z) < 1.0)) else None) for x, y, z in q]))
    P.append(Prim('sphere', 'teal', (-12, 32, -2), r=3.6, clip=lambda q: -q[:, 1]))
    P.append(Prim('cyl', 'gold', (-12, 36.5, -2), r=0.35, h=1.6))
    img = rend(P, 76, 70, 16)
    # flag
    gx, gy = 58, 10
    for y in range(gy, gy + 14): E.put(img, gx, y, E.H('#5e3c20'))
    for y in range(gy, gy + 5):
        for x in range(gx + 1, gx + 8 - (y - gy) // 2): E.put(img, x, y, E.H('#2cbdb7' if (y - gy) < 2 else '#147f8a'))
    return img

# ---------------------------------------------------------------- hospital (white blocks + teal cross)
def hospital():
    P = []
    def front(q):
        out = []
        for x, y, z in q:
            m = None
            if z > 7.4 and (x % 4.4 + 4.4) % 4.4 < 2.2 and ((y - 3) % 5.0) < 2.4 and y > 2.5 and abs(x) > 3.5:
                m = 'glass'
            if z > 7.4 and abs(x) < 3.2 and y < 6:
                m = 'glass'  # entrance
            if abs(x) > 12.4 and ((z + 20) % 4.4) < 2.2 and ((y - 3) % 5.0) < 2.4 and y > 2.5:
                m = 'glass'
            out.append(m)
        return out
    P.append(Prim('rbox', 'white', (0, 10, 0), b=(13, 10, 8), round=0.5, paint=front))
    P.append(Prim('rbox', 'white', (-17, 6.5, 2), b=(5, 6.5, 6), round=0.5,
                  paint=lambda q: [('glass' if (z > 5.4 and ((y - 2.5) % 4.5) < 2.2 and y > 2 and (x % 3.4 + 3.4) % 3.4 < 1.8) else None) for x, y, z in q]))
    P.append(Prim('rbox', 'teal', (0, 20.6, 0), b=(13.4, 0.8, 8.4), round=0.3))
    # cross sign on the roof (teal, not red)
    P.append(Prim('rbox', 'white', (0, 26, 1), b=(4.6, 4.6, 0.9), round=0.6,
                  paint=lambda q: [('teal' if (z > 0.3 and ((abs(x) < 1.2 and abs(y) < 3.4) or (abs(y) < 1.2 and abs(x) < 3.4))) else None) for x, y, z in q]))
    P.append(Prim('cyl', 'metal', (0, 21.8, 1), r=0.5, h=1.4))
    return rend(P, 72, 66, 13)

# ---------------------------------------------------------------- library (sandstone, arched windows, open book relief)
def library():
    P = []
    def facade(q):
        out = []
        for x, y, z in q:
            m = None
            if z > 7.4:
                for cx in (-11, -5.5, 5.5, 11):
                    if abs(x - cx) < 1.6 and 3 < y < 11 and ((x - cx) ** 2 + (y - 9.6) ** 2 < 2.6 or y < 9.6):
                        m = 'glass'
                if abs(x) < 2.6 and y < 7.5 and (x ** 2 + (y - 6) ** 2 < 6.8 or y < 6):
                    m = 'wood'
                # open book relief above the door
                if 10.5 < y < 15 and abs(x) < 6:
                    page = abs(x) < 5.6 and (y - 10.5) < 3.6 + 0.25 * abs(x)
                    if page: m = 'white' if abs(x) > 0.5 else 'wood'
                    if page and abs(((y - 11.3) % 1.2)) < 0.3 and 1.2 < abs(x) < 4.8: m = 'slate'
            out.append(m)
        return out
    P.append(Prim('rbox', 'sand', (0, 9, 0), b=(16, 9, 8), round=0.5, paint=facade))
    P.append(Prim('rbox', 'sand', (0, 18.6, 0), b=(17, 1.0, 9), round=0.3))
    P.append(Prim('custom', 'slate', (0, 19.4, 0), fn=prism(16, 5, 8.6)))
    # giant open book sculpture on the roof (library identity)
    for sgn in (1, -1):
        P.append(Prim('rbox', 'white', (sgn * 4.6, 28.5, 2), R=rot_z(sgn * 0.32), b=(4.6, 0.45, 3.4), round=0.2,
                      paint=lambda q: [('slate' if (abs(q_[2]) < 2.6 and (abs(q_[0]) % 1.4) < 0.35 and q_[1] > 0.2) else None) for q_ in q]))
        P.append(Prim('rbox', 'book1', (sgn * 4.6, 28.0, 2), R=rot_z(sgn * 0.32), b=(4.9, 0.3, 3.7), round=0.1))
    P.append(Prim('rbox', 'wood', (0, 25.5, 2), b=(1.0, 2.6, 1.0), round=0.2))
    # book stacks next to the entrance
    for i, (bx, col) in enumerate(((-14, 'book1'), (-12.6, 'book2'), (13, 'book1'), (14.4, 'book2'))):
        P.append(Prim('rbox', col, (bx, 1.6 + (i % 2) * 0.2, 10.5), b=(0.6, 1.6 + (i % 2) * 0.4, 1.4), round=0.1))
    return rend(P, 70, 74, 18)

# ---------------------------------------------------------------- data / information center (server towers + dish)
def datacenter(frame):
    P = []
    rnd = np.random.default_rng(5)
    leds = rnd.random((40, 40))
    def rack(q):
        out = []
        for x, y, z in q:
            m = None
            if z > 5.4 or abs(x) > 5.4:
                u = x if z > 5.4 else z
                if (y % 2.4) < 1.0 and y > 1.5 and y < 27:
                    m = 'navy'
                    if (u % 1.6 + 1.6) % 1.6 < 0.7:
                        k = leds[int(y / 2.4) % 40, int((u + 20) / 1.6) % 40]
                        on = (k + frame * 0.37) % 1 > 0.45
                        m = 'led' if on else 'ledoff'
            out.append(m)
        return out
    P.append(Prim('rbox', 'metal', (-8, 14, 0), b=(6, 14, 6), round=0.5, paint=rack))
    P.append(Prim('rbox', 'metal', (8, 10, 2), b=(6, 10, 6), round=0.5, paint=rack))
    P.append(Prim('rbox', 'navy', (0, 3, 7), b=(17, 3, 2), round=0.4,
                  paint=lambda q: [('led' if (z > 1.5 and abs(y - 3) < 0.4 and ((x + frame * 3) % 4) < 1.2) else None) for x, y, z in q]))
    # satellite dish
    P.append(Prim('cyl', 'metal', (8, 22, 2), r=0.6, h=2.4))
    P.append(Prim('custom', 'white', (8, 26, 3.5), R=rot_x(-0.7), fn=lambda q: np.maximum(np.abs(np.linalg.norm(q - np.array([0, 6, 0]), axis=1) - 7.0) - 0.45, q[:, 1] - 1.6)))
    P.append(Prim('cyl', 'metal', (-8, 30, 0), r=0.4, h=2.2))
    P.append(Prim('sphere', 'led' if frame % 2 == 0 else 'ledoff', (-8, 32.6, 0), r=0.9))
    return rend(P, 64, 70, 16)

# ---------------------------------------------------------------- receiver beacon (stone pylon + crystal)
def beacon(lit):
    P = [Prim('rbox', 'stone', (0, 4, 0), b=(3.2, 4, 3.2), round=0.6,
              paint=lambda q: [('moss' if (y < 1.8 and math.sin(x * 2 + z) > 0.3) else None) for x, y, z in q]),
         Prim('rbox', 'stone', (0, 9, 0), b=(2.2, 1.6, 2.2), round=0.4),
         Prim('custom', 'crys' if lit else 'crysoff', (0, 15.5, 0), fn=lambda q: (np.abs(q[:, 0]) + np.abs(q[:, 2]) + np.abs(q[:, 1]) * 0.55 - 3.0) * 0.6)]
    return rend(P, 22, 30, 10, yaw=0.6, pitch=12)

# ---------------------------------------------------------------- tiny pixel icons (data packets, badges)
ICONS = {
    'cube': ["....##....", "..##cc##..", "##cccccc##", "#Ccccccc##", "#CCcccc###", "#CCC##.###", "#CCC#.####", ".#CC#.###.", "..#C####..", "....##...."],
    'doc':  ["#######...", "#wwwww##..", "#w---w#w#.", "#wwwwww##.", "#w----ww#.", "#wwwwwww#.", "#w-----w#.", "#wwwwwww#.", "#w---www#.", "#########."],
    'chart':["##########", "#wwwwwwww#", "#wwwwwgw##", "#wwwwwgw##", "#wwwbwgw##", "#wwwbwgw##", "#wcwbwgw##", "#wcwbwgw##", "#wwwwwwww#", "##########"],
    'pulse':["..........", ".##...##..", "#rr#.#rr#.", "#rrr#rrr#.", "#rrrrrrr#.", ".#rrrrr#..", "..#rrr#...", "...#r#....", "....#.....", ".........."],
}
ICOL = {'#': '#0d2a4a', 'c': '#5fd0ff', 'C': '#2f7cf0', 'w': '#eaf8ff', '-': '#3a86c0', 'g': '#4fc4a0', 'b': '#2f7cf0', 'r': '#ff8a9a'}
def icon(name, scale=1):
    g = ICONS[name]; h = len(g); w = len(g[0]); img = E.blank(w, h)
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.': E.put(img, x, y, E.H(ICOL[ch]))
    return img

# badge emblems (24x24): ring + symbol
SYM = {
    'cap':  ["......##......", "....##YY##....", "..##YYYYYY##..", "##YYYYYYYYYY##", "..##YYYYYY##Y.", "....##YY##..Y.", "....#yyyy#..Y.", "....#yyyy#.YY.", ".....####....."],
    'cross':["....####....", "....#TT#....", "....#TT#....", "#####TT#####", "#TTTTTTTTTT#", "#TTTTTTTTTT#", "#####TT#####", "....#TT#....", "....#TT#....", "....####...."],
    'book': ["##.......##.", "#W##...##W#.", "#WWW#.#WWW#.", "#WWWW#WWWW#.", "#WWWW#WWWW#.", "#WWWW#WWWW#.", "#WWWW#WWWW#.", "##WWW#WWW##.", "..###B###...", ".....#......"],
    'db':   ["..######..", ".#CCCCCC#.", "#cCCCCCCc#", "#ccccccc c#".replace(' ', 'c'), "#cCCCCCCc#", "#cccccccc#", "#cCCCCCCc#", "#cccccccc#", ".#cccccc#.", "..######.."],
    'check':[".........##", "........#G#", ".......#GG#", "##....#GG#.", "#G#..#GG#..", "#GG##GG#...", ".#GGGG#....", "..#GG#.....", "...##......"],
    'quest':["..####..", ".#OOOO#.", "#OO##OO#", ".##.#OO#", "...#OO#.", "...#OO#.", "....##..", "...#OO#.", "....##.."],
    'dsi':  ["...#####...", "..#CCCCC#..", ".#CC###CC#.", "#CC#ccc#CC#", "#C#ccccc#C#", "#C#ccccc#C#", "#CC#ccc#CC#", ".#CC###CC#.", "..#CCCCC#..", "...#####..."],
}
SCOL = {'#': '#1a1020', 'Y': '#f2c14e', 'y': '#c98a1f', 'T': '#2cbdb7', 'W': '#f4ead2', 'B': '#c25a34', 'C': '#2f7cf0', 'c': '#8fe8ff',
        'G': '#5fe07a', 'O': '#ffb347'}
def badge(sym, ring='#f2cf73', fill='#10284a'):
    s = 26; img = E.blank(s, s); c = (s - 1) / 2
    for y in range(s):
        for x in range(s):
            r = math.hypot(x - c, y - c)
            if r < 12.5: E.put(img, x, y, E.H('#1a1020'))
            if r < 11.5: E.put(img, x, y, E.H(ring))
            if r < 10.0: E.put(img, x, y, E.H(fill if (x + y) % 7 else '#163a66'))
    g = SYM[sym]; h = len(g); w = max(len(r) for r in g)
    ox = (s - w) // 2; oy = (s - h) // 2
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.' and ch in SCOL: E.put(img, ox + x, oy + y, E.H(SCOL[ch]))
    return img

# ---------------------------------------------------------------- build
add('univ', university()); add('hosp', hospital()); add('lib', library())
for f in range(2): add(f'datac_{f}', datacenter(f))
add('beacon_off', beacon(False)); add('beacon_on', beacon(True))
for k in ICONS: add('pk_' + k, icon(k), (5, 5))
for k, ring in (('cap', '#f2cf73'), ('cross', '#e8f4f6'), ('book', '#c8955a'), ('db', '#5fd0ff')): add('badge_' + k, badge(k, ring), (13, 13))
add('badge_check', badge('check', '#5fe07a', '#0e2e1a'), (13, 13)); add('badge_quest', badge('quest', '#ffb347', '#2e1e0a'), (13, 13))
add('badge_dsi', badge('dsi', '#f2cf73', '#0a1a3a'), (13, 13))
# fix bottom anchors to the actual lowest opaque row
for k in ('univ', 'hosp', 'lib', 'datac_0', 'datac_1', 'beacon_off', 'beacon_on'):
    img, a = A[k]; A[k] = (img, (img.shape[1] // 2, ground_row(img) - 1))

if __name__ == '__main__':
    out = sys.argv[1]
    atlas, meta = E.pack(A, 512)
    Image.fromarray(atlas).save(os.path.join(out, 'part2_atlas.png'))
    json.dump(meta, open(os.path.join(out, 'part2_atlas.json'), 'w'), indent=0)
    print('part2 atlas', atlas.shape, len(meta))
