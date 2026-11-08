"""Original score + new sound effects for DSI Island Part 2 (The Connection).
Reuses the instrument/synthesis toolkit defined at the top of gen_audio.py (Part 1),
so both chapters share one sound palette. Usage: python gen_audio_part2.py ../assets/audio"""
import os, sys
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen_audio.py')).read()
exec(src.split('# ---------------------------------------------------------------- music cue')[0])  # toolkit only
import numpy as np
OUT = os.path.join(sys.argv[1], 'part2')
os.makedirs(os.path.join(OUT, 'music'), exist_ok=True); os.makedirs(os.path.join(OUT, 'sfx'), exist_ok=True)
rng = np.random.default_rng(2027)

DUR = 42.0
M = np.zeros((int(DUR * SR), 2))
B = 60 / 92
# 0-6.2 portal: low mystery pad (B minor) and a long build into the warp
place(M, pad([47, 54, 61, 66], 6.6, 0.32, 1000, a=0.4, r=1.2), 0.0)
place(M, pan(bass(35, 6.0, 0.3), 0), 0.0)
for i, n in enumerate([78, 81, 85, 86, 90, 93]):
    place(M, pan(bell(n, 2.0, 0.06), -0.6 + 0.24 * i), 0.8 + i * 0.55)
place(M, pan(riser(2.2, 0.55), 0), 3.9)
# 6.2 new world bloom: bright D major / lydian
place(M, pad([50, 57, 62, 66, 69, 76, 80], 4.5, 0.48, 2600, a=0.08, r=2.4), 6.15)
for i, n in enumerate([62, 66, 69, 74, 76, 81, 86, 88]):
    place(M, pan(kalimba(n, 2.2, 0.22), -0.6 + i * 0.17), 6.2 + i * 0.08)
place(M, pan(bell(86, 3.5, 0.14), 0.2), 6.2)
# 6.2-16 separate worlds: gentle arps, then a questioning turn at 13.6
sep = [(8.6, [43, 50, 59, 62, 66, 69], [59, 62, 66, 69, 74, 76]), (10.6, [50, 57, 62, 66, 69, 73], [62, 66, 69, 73, 76, 78]),
       (12.4, [47, 54, 59, 62, 66, 69], [59, 62, 66, 71, 74, 78]), (13.6, [40, 55, 59, 62, 66, 69], [55, 59, 62, 66, 69, 71]),
       (14.9, [45, 52, 57, 59, 64, 69], [57, 59, 64, 69, 71, 76])]
for st, pc, arp in sep:
    place(M, pad(pc[1:], 2.2, 0.24, 1500, a=0.5, r=0.9), st)
    place(M, pan(bass(pc[0] - 12 if pc[0] > 45 else pc[0], 1.9, 0.28), 0), st)
    for i in range(6):
        place(M, pan(kalimba(arp[[0, 2, 4, 5, 3, 1][i]], 1.1, 0.2 if i % 2 == 0 else 0.14), -0.3 + 0.6 * (i % 2)), st + i * B / 2)
# 16-21.5 data sharing: marimba ostinato pulse + shaker
s = 16.0; k = 0
pattern = [62, 69, 74, 69, 66, 69, 74, 76]
while s < 21.5:
    place(M, pan(marimba(pattern[k % 8] + (0 if s < 18.8 else -3 if k % 8 in (0, 3) else 0), 0.7, 0.16), -0.25 if k % 2 else 0.25), s)
    place(M, pan(shaker(0.08 if k % 2 else 0.11), 0.35), s)
    s += B / 2; k += 1
for st, pc in ((16.0, [50, 57, 62, 66]), (18.8, [47, 54, 59, 62])):
    place(M, pad(pc, 2.9, 0.26, 1700, a=0.3, r=0.8), st); place(M, pan(bass(pc[0] - 12, 2.6, 0.3), 0), st)
# 21.5-28.5 interoperability: build G - A - Bm - G, resolution 'click' at 23.6, rising arps for bridges at 25.6
for st, pc in ((21.5, [43, 55, 59, 62, 66]), (23.6, [45, 57, 61, 64, 69]), (25.6, [47, 54, 59, 62, 66, 71]), (27.1, [43, 55, 59, 62, 66, 69])):
    place(M, pad(pc[1:], 2.2, 0.3, 1900, a=0.25, r=0.9), st); place(M, pan(bass(pc[0] - 12 if pc[0] > 40 else pc[0], 2.0, 0.34), 0), st)
s = 21.5; k = 0
while s < 28.5:
    place(M, pan(marimba([62, 66, 69, 74][k % 4] + (2 if s > 23.6 else 0), 0.6, 0.12), 0.2 * ((-1) ** k)), s)
    s += B / 2; k += 1
for i in range(14):
    place(M, pan(kalimba(69 + [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 24][i], 1.4, 0.16), -0.7 + i * 0.1), 25.6 + i * 0.17)
for kk in range(6): place(M, pan(soft_tom(0.25), 0), 24.0 + kk * B * 2)
# 28.5-34 climax: one connected world
place(M, pad([50, 57, 62, 66, 69, 74, 78], 6.0, 0.5, 2600, a=0.3, r=2.0), 28.5)
place(M, pan(bass(38, 5.5, 0.42), 0), 28.5)
mel = [(28.8, 0.5, 74), (29.3, 0.5, 76), (29.8, 1.1, 78), (31.0, 0.5, 81), (31.5, 0.5, 79), (32.0, 1.6, 78)]
place(M, pan(flute(mel, 0.15), 0.1), 0)
for kk in range(8): place(M, pan(soft_tom(0.3, 80), 0), 28.5 + kk * B)
place(M, pan(bell(86, 3.5, 0.14), 0.0), 32.0); place(M, pan(bell(81, 3.5, 0.1), -0.3), 32.02)
# 34-42 invitation: warm sustained resolution, sparse kalimba, long fade
place(M, pad([50, 57, 62, 66, 69, 74], 8.0, 0.4, 2000, a=0.6, r=3.5), 33.8)
place(M, pan(bass(38, 7.5, 0.3), 0), 33.8)
for i, n in enumerate([74, 78, 81, 78, 74, 76, 78, 86]):
    place(M, pan(kalimba(n, 1.8, 0.14), -0.4 + 0.1 * i), 34.2 + i * 0.66)
M = reverb(M, 0.35)
fade = int(3.0 * SR); M[-fade:] *= np.linspace(1, 0, fade)[:, None]
fi = int(0.25 * SR); M[:fi] *= np.linspace(0, 1, fi)[:, None]

def save2(name, x, br='160k', norm=0.89):
    globals()['OUT'] = OUT
    save(name, x, br, norm)
save2('music/score_part2.mp3', M, '192k', 0.85)

# ---------------------------------------------------------------- new sound effects
# portal opening: deep swell + bright bloom
po = np.zeros((int(3.5 * SR), 2))
place(po, pan(riser(1.0, 0.5), 0), 0)
t = t_(3.0); swell = np.sin(2 * np.pi * np.cumsum(55 + 40 * (t / 3)) / SR) * env(len(t), 0.4, 0.8, 0.6, 1.5) * 0.7
place(po, pan(swell, 0), 0.3)
for i, m in enumerate([74, 81, 86, 90, 93, 98]): place(po, pan(bell(m, 2.6, 0.18), -0.6 + i * 0.24), 0.95 + i * 0.04)
save2('sfx/portal_open.mp3', reverb(po, 0.45), '160k', 0.85)
# warp through the portal: rising whoosh with flutter, ends in a soft burst
t = t_(1.8); n = rng.standard_normal(len(t))
w = np.zeros(len(t)); k = t / 1.8
for j, (lo, hi) in enumerate([(150, 500), (400, 1300), (1000, 3200), (2500, 8000), (6000, 15000)]):
    w += bp(n, lo, hi) * np.clip(1 - np.abs(k * 4 - j), 0, 1)
w *= (k ** 1.5) * (1 + 0.4 * np.sin(2 * np.pi * (6 + 30 * k) * t))
burst = np.zeros(int(2.6 * SR)); place(burst, w * 0.9, 0)
tb = t_(0.8); place(burst, bp(rng.standard_normal(len(tb)), 300, 9000) * np.exp(-tb * 5) * 0.6, 1.75)
save2('sfx/warp.mp3', reverb(burst, 0.4), '128k', 0.85)
# data send: soft upward digital chirp
def chirp(f0, f1, d=0.22, v=0.5, sq=0.3):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) * (1 - sq) + np.sign(np.sin(ph)) * sq * 0.5) * np.exp(-t * 9) * (1 - np.exp(-t * 300))
    return lp(x, 6000) * v
s = np.zeros(int(0.7 * SR)); place(s, chirp(700, 1800), 0); place(s, chirp(1400, 2600, 0.12, 0.3), 0.09)
save2('sfx/data_send.mp3', reverb(s, 0.3), '96k', 0.7)
r = np.zeros(int(1.0 * SR)); place(r, chirp(2200, 1100, 0.16, 0.4), 0); place(r, bell(93, 0.8, 0.25), 0.05)
save2('sfx/data_receive.mp3', reverb(r, 0.35), '96k', 0.7)
f = np.zeros(int(1.0 * SR)); place(f, chirp(900, 260, 0.6, 0.5, 0.45), 0)
save2('sfx/data_fail.mp3', reverb(f, 0.3), '96k', 0.65)
# match / understood: wooden-digital click + bright two-note chime
c = np.zeros((int(1.6 * SR), 2)); tt = t_(0.06)
place(c, pan(hp(rng.standard_normal(len(tt)), 1500) * np.exp(-tt * 80) * 0.8, 0), 0)
place(c, pan(np.sin(2 * np.pi * 1200 * tt) * np.exp(-tt * 60) * 0.5, 0), 0)
place(c, pan(bell(86, 1.4, 0.3), -0.2), 0.06); place(c, pan(bell(93, 1.4, 0.25), 0.2), 0.16)
save2('sfx/match.mp3', reverb(c, 0.35), '96k', 0.8)
# bridge forming: shimmering upward sweep
bf = np.zeros((int(2.4 * SR), 2))
for i in range(16): place(bf, pan(bell(74 + i * 2 % 24 + (i // 12) * 12, 1.0, 0.07), -0.8 + i * 0.1), i * 0.08)
place(bf, pan(riser(1.4, 0.25), 0), 0)
save2('sfx/bridge_form.mp3', reverb(bf, 0.45), '128k', 0.8)
def make_loop(x, xf=1.0):
    n = int(xf * SR); a = x[:n]; b = x[-n:]
    w = np.linspace(0, 1, n)[:, None] if x.ndim > 1 else np.linspace(0, 1, n)
    y = x[n:].copy(); y[-n:] = b * (1 - w) + a * w
    return y
# soft digital ambience loop for the archipelago (gentle hum + sparse blips)
d = 10.0; nn = int(d * SR); t = np.arange(nn) / SR
hum = (np.sin(2 * np.pi * 110 * t) * 0.3 + np.sin(2 * np.pi * 165.2 * t) * 0.15) * (0.6 + 0.4 * np.sin(2 * np.pi * t / 5))
amb = np.stack([hum, hum], 1) * 0.25
for k in range(22):
    st = rng.uniform(0, d - 0.3); place(amb, pan(chirp(rng.uniform(1500, 3200), rng.uniform(1500, 3200), 0.08, 0.12), rng.uniform(-0.8, 0.8)), st)
save2('sfx/amb_digital.mp3', make_loop(reverb(amb, 0.4), 1.0), '96k', 0.5)
