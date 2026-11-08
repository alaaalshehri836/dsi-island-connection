// ============================================================================
// DSI Island — Part 2: The Connection. The film as a pure function of time.
// t = 0 is EXACTLY Part 1's final narrative frame (finalCam(1), explorer idle
// at FINAL, portal fully awake) — see docs/PART2_HANDOFF.md.
// ============================================================================
import { finalCam, FINAL } from '../director.js';
import { clamp, lerp, ease, prog } from '../util.js';
import { HUB, ISLANDS, BYID, BRIDGES, PORTAL2, beaconPos } from './world2.js';

const D2R = Math.PI / 180;
const yawTo = (cx, cz, tx, tz) => Math.atan2(tx - cx, tz - cz);
const STRIDE = 36;
export const WARP_T = 6.2;          // moment we arrive in the new world
export const END_T = 41.2;
export const MYSTERY_GRADE = { mul: '#b9c4dc', mulAmt: 1, vignette: 0.62 };
const DAY = { vignette: 0.38 };

// ---------------------------------------------------------------- explorer
const WALKS = [
  { w: 1, t0: 1.0, t1: 2.9, x0: FINAL.charX, x1: -952, z: 0, ease: true },
  { w: 1, t0: 4.9, t1: 5.6, x0: -952, x1: -905, z: 0 },
  { w: 2, t0: 6.25, t1: 7.6, x0: -38, x1: 30, z: 0, easeOut: true },
];
function walkAt(w, t) {
  let u = clamp((t - w.t0) / (w.t1 - w.t0));
  if (w.ease) u = ease.inOut(u); else if (w.easeOut) u = 1 - Math.pow(1 - u, 1.7);
  const x = lerp(w.x0, w.x1, u);
  return { x, z: w.z, dist: Math.abs(x - w.x0) };
}
export const STAND = { x: 60, z: 0 };   // where the explorer stands on the hub (world 2)
export function charAt(t) {
  for (const w of WALKS) if (t >= w.t0 && t < w.t1) {
    const p = walkAt(w, t);
    let alpha = 1;
    if (w.w === 1 && w.t0 > 4) alpha = 1 - prog(t, 5.25, 5.6);         // steps into the light
    if (w.w === 2) alpha = prog(t, 6.3, 6.55);                         // emerges from the light
    return { world: w.w, x: p.x, z: p.z, y: 0, heading: 90 * D2R, anim: 'walk', frame: Math.floor(((p.dist / STRIDE) % 1) * 8), alpha };
  }
  if (t < 1.0) return { world: 1, x: FINAL.charX, z: 0, y: 0, heading: 90 * D2R, anim: 'idle', frame: 0, alpha: 1 };
  if (t < 4.9) {
    const anim = t < 3.7 ? 'idle' : 'reach';
    return { world: 1, x: -952, z: 0, y: 0, heading: 90 * D2R, anim, frame: anim === 'reach' ? (t < 4.0 ? 0 : 1) : 0, alpha: 1 };
  }
  if (t < 6.3) return { world: 1, x: -905, z: 0, y: 0, heading: 90 * D2R, anim: 'idle', frame: 0, alpha: 0 };
  if (t < 13.6) {
    // after walking out: look around at the new world
    const x = t < 7.6 ? 30 : lerp(30, STAND.x, prog(t, 9.0, 12.6));
    const look = t > 7.7 && t < 8.8;
    return { world: 2, x, z: 0, y: 0, heading: (look ? 150 : 90) * D2R, anim: look ? 'look' : 'idle', frame: look ? Math.floor((t - 7.7) * 3.6) % 4 : Math.floor(t * 1.4) % 2, alpha: 1 };
  }
  if (t < 16.0) return { world: 2, x: STAND.x, z: 0, y: 0, heading: 90 * D2R, anim: 'shade', frame: 0, alpha: 1 };
  return { world: 2, x: STAND.x, z: 0, y: 0, heading: 90 * D2R, anim: 'idle', frame: t > 34 ? 0 : Math.floor(t * 1.4) % 2, alpha: 1 };
}
export function buildSteps() {
  const steps = [];
  for (const w of WALKS) {
    const len = Math.abs(w.x1 - w.x0);
    for (let d = STRIDE * 0.25; d < len; d += STRIDE / 2) {
      let lo = w.t0, hi = w.t1;
      for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (walkAt(w, m).dist < d) lo = m; else hi = m; }
      steps.push({ t: lo, w: w.w });
    }
  }
  return steps;
}

// ---------------------------------------------------------------- portal (world 1)
export function portalBoost(t) {          // extra brightness as the portal opens (0..1)
  return clamp(prog(t, 0.9, 3.0) * 0.35 + prog(t, 3.9, 4.9, ease.in) * 0.65);
}
export function hubGlowAt(t) { return t < WARP_T ? 0 : lerp(1, 0.35, prog(t, WARP_T, 9.5)); }

// ---------------------------------------------------------------- data packets
const U = BYID[1], Hs = BYID[2];
export const SEND_FROM = beaconPos(U, Hs), SEND_TO = beaconPos(Hs, U);
const ICONS = ['pk_doc', 'pk_chart', 'pk_cube', 'pk_pulse'];
export const STREAM = Array.from({ length: 9 }, (_, i) => ({ t0: 16.1 + i * 0.46, dur: 2.2, icon: ICONS[i % 4] }));
function arc(p0, p1, u, hgt) {
  return { x: lerp(p0.x, p1.x, u), z: lerp(p0.z, p1.z, u), y: 20 + Math.sin(Math.PI * u) * hgt };
}
// all packets visible at time t: {x,y,z,icon,alpha,trail:[...]}
export function packetsAt(t) {
  const out = [];
  // a failed attempt across the gap (scene 2)
  if (t > 13.9 && t < 15.3) {
    const u = prog(t, 13.9, 14.9);
    const p = arc(SEND_FROM, SEND_TO, u * 0.5, 120);
    let y = p.y, alpha = 1;
    if (t > 14.9) { const k = prog(t, 14.9, 15.25); y = lerp(p.y, 0, k * k); alpha = (Math.floor(t * 20) % 2 ? 0.4 : 1) * (1 - k); }
    out.push({ ...p, y, icon: 'pk_doc', alpha, trail: trailOf((uu) => arc(SEND_FROM, SEND_TO, uu * 0.5, 120), u, 0.25), fail: true });
  }
  // the data-sharing stream (scene 3)
  for (const s of STREAM) {
    if (t < s.t0 || t > s.t0 + s.dur) continue;
    const u = (t - s.t0) / s.dur;
    out.push({ ...arc(SEND_FROM, SEND_TO, u, 90), icon: s.icon, alpha: 1, trail: trailOf((uu) => arc(SEND_FROM, SEND_TO, uu, 90), u, 0.22) });
  }
  // continuous traffic along the finished bridges (scenes 4-5)
  if (t > 27.0) {
    BRIDGES.forEach((br, i) => {
      const p = bridgeProgress(t)[i]; if (p < 1) return;
      for (let k = 0; k < 2; k++) {
        const dir = (i + k) % 2;
        let u = ((t * 0.32 + i * 0.37 + k * 0.5) % 1); if (dir) u = 1 - u;
        out.push({ x: lerp(br.x0, br.x1, u), z: lerp(br.z0, br.z1, u), y: 16, icon: ICONS[(i + k) % 4], alpha: Math.min(1, Math.sin(Math.PI * u) * 3), small: true, trail: [] });
      }
    });
  }
  return out;
}
function trailOf(fn, u, span) {
  const tr = [];
  for (let i = 1; i <= 8; i++) { const uu = u - (span * i) / 8; if (uu < 0) break; tr.push({ ...fn(uu), a: 1 - i / 9 }); }
  return tr;
}
// arrivals at the hospital receiver -> ripple rings + "receive" blips
export function arrivals() { return STREAM.map((s) => s.t0 + s.dur); }

// ---------------------------------------------------------------- bridges & understanding
export function bridgeProgress(t) {
  return BRIDGES.map((b, i) => (i < 4 ? prog(t, 25.9 + i * 0.25, 27.1 + i * 0.25, ease.inOut) : prog(t, 26.8 + (i - 4) * 0.22, 28.0 + (i - 4) * 0.22, ease.inOut)));
}
export const LIT_AT = { 2: 23.45, 1: 24.75, 3: 25.05, 4: 25.35 };
export function litAt(t) {
  const o = {};
  for (const [id, t0] of Object.entries(LIT_AT)) o[id] = prog(t, t0, t0 + 0.35);
  return o;
}
// badge shown above each island: identity badge, '?' (received but not understood), '✓' (understood)
export function badgeAt(isl, t) {
  if (t < 10.3) return null;
  if (isl.id === 2 && t > 20.9 && t < LIT_AT[2]) return { key: 'badge_quest', pop: prog(t, 20.9, 21.1) };
  const lt = LIT_AT[isl.id];
  if (t >= lt && t < lt + 1.6) return { key: 'badge_check', pop: prog(t, lt, lt + 0.18) };
  return { key: isl.badge, pop: t < 12.6 ? 1 : 1 };
}

// ---------------------------------------------------------------- shots
function islandCam(isl, t, t0, t1) {
  const u = prog(t, t0, t1, ease.out);
  const a = Math.atan2(HUB.z - isl.z, HUB.x - isl.x) + 0.35;
  const dist = lerp(600, 520, u);
  const x = isl.x + Math.cos(a) * dist, z = isl.z + Math.sin(a) * dist;
  return { x, z, h: 92, yaw: yawTo(x, z, isl.x, isl.z), hor: 0.42, F: 260 };
}
function orbitCam(ang, r, h, hor, F, tx = 0, tz = 0) {
  const x = tx + Math.cos(ang) * r, z = tz + Math.sin(ang) * r;
  return { x, z, h, yaw: yawTo(x, z, tx, tz), hor, F };
}
export const SHOTS = [
  { id: 'part1-final-ots', t0: 0, t1: 2.9, world: 1, grade: MYSTERY_GRADE,
    cam: (t) => { const a = finalCam(1), u = prog(t, 0.8, 2.9, ease.inOut);
      return { x: lerp(a.x, -1112, u), z: lerp(a.z, -34, u), h: lerp(a.h, 56, u), yaw: lerp(a.yaw, 83 * D2R, u), hor: 0.4, F: lerp(a.F, 310, u) }; } },
  { id: 'approach-closeup', t0: 2.9, t1: 3.7, world: 1, type: 'portrait', grade: { ...MYSTERY_GRADE, vignette: 0.6 },
    portrait: (t) => ({ a: t > 3.3 && t < 3.38 ? 'surprised_blink' : 'awe', mix: 0, zoom: lerp(1.0, 1.1, prog(t, 2.9, 3.7, ease.out)), glowFront: 1 }),
    cam: () => ({ x: -952 + 70, z: 10, h: 44, yaw: -90 * D2R, hor: 0.5, F: 480 }) },
  { id: 'reach-ots', t0: 3.7, t1: 5.0, world: 1, grade: MYSTERY_GRADE,
    cam: (t) => { const u = prog(t, 3.7, 5.0, ease.inOut); return { x: lerp(-1052, -1035, u), z: lerp(-22, -16, u), h: 54, yaw: 86 * D2R, hor: 0.42, F: lerp(300, 320, u) }; } },
  { id: 'through-portal', t0: 5.0, t1: WARP_T, world: 1, grade: MYSTERY_GRADE, tunnel: true,
    cam: (t) => { const u = prog(t, 5.0, 6.0, ease.in); return { x: lerp(-1035, -905, u), z: lerp(-16, 0, u), h: lerp(54, 51, u), yaw: 90 * D2R, hor: 0.42, F: lerp(320, 420, u) }; } },
  { id: 'new-world', t0: WARP_T, t1: 8.8, world: 2, grade: DAY, flashIn: [WARP_T, 6.9],
    cam: (t) => { const u = prog(t, WARP_T, 8.8, ease.inOut);
      const x = lerp(-62, -330, u), z = lerp(-4, -1150, u);
      return { x, z, h: lerp(50, 700, u), yaw: yawTo(x, z, lerp(420, 120, u), lerp(10, 520, u)), hor: lerp(0.47, 0.16, u), F: lerp(270, 245, u) }; } },
  { id: 'aerial', t0: 8.8, t1: 10.4, world: 2, grade: DAY,
    cam: (t) => orbitCam(lerp(-2.55, -2.2, prog(t, 8.8, 10.4)), 1750, 880, 0.11, 235) },
  ...ISLANDS.map((isl, i) => ({ id: 'island-' + isl.key, t0: 10.4 + i * 0.55, t1: 10.95 + i * 0.55, world: 2, grade: DAY, tag: isl,
    cam: (t) => islandCam(isl, t, 10.4 + i * 0.55, 10.95 + i * 0.55) })),
  { id: 'observe-closeup', t0: 12.6, t1: 13.6, world: 2, type: 'portrait', grade: { vignette: 0.5 },
    portrait: (t) => ({ a: t > 13.05 && t < 13.14 ? 'blink' : 'lookR', mix: 0, zoom: lerp(1.0, 1.05, prog(t, 12.6, 13.6)) }),
    cam: () => ({ x: 120, z: -60, h: 44, yaw: 62 * D2R, hor: 0.5, F: 420 }) },
  { id: 'the-gap', t0: 13.6, t1: 16.0, world: 2, grade: DAY,
    cam: (t) => ({ x: lerp(-40, -20, prog(t, 13.6, 16)), z: -8, h: 92, yaw: 90 * D2R, hor: 0.42, F: 128 }) },
  { id: 'share-follow', t0: 16.0, t1: 17.9, world: 2, grade: DAY,
    cam: (t) => { const s = STREAM[0], u = clamp((t - s.t0) / s.dur);
      const p = arc(SEND_FROM, SEND_TO, u, 90);
      const x = p.x - 250, z = p.z + 110;
      return { x, z, h: 80, yaw: yawTo(x, z, p.x, p.z - 70), hor: 0.46, F: 260 }; } },
  { id: 'share-receive', t0: 17.9, t1: 19.3, world: 2, grade: DAY,
    cam: (t) => { const u = prog(t, 17.9, 19.3); const x = 540, z = lerp(220, 160, u);
      return { x, z, h: lerp(170, 150, u), yaw: yawTo(x, z, Hs.x, Hs.z), hor: 0.3, F: 270 }; } },
  { id: 'share-close', t0: 19.3, t1: 21.5, world: 2, grade: DAY,
    cam: (t) => { const u = prog(t, 19.3, 21.5, ease.out); const x = lerp(470, 490, u), z = lerp(-215, -240, u);
      return { x, z, h: 62, yaw: yawTo(x, z, SEND_TO.x + 20, SEND_TO.z - 40), hor: 0.44, F: 280 }; } },
  { id: 'interop-close', t0: 21.5, t1: 24.4, world: 2, grade: { vignette: 0.5 }, puzzle: true,
    cam: (t) => ({ x: 490, z: -240, h: 62, yaw: yawTo(490, -240, SEND_TO.x + 20, SEND_TO.z - 40), hor: 0.44, F: 290 }) },
  { id: 'interop-wide', t0: 24.4, t1: 25.85, world: 2, grade: DAY,
    cam: (t) => orbitCam(lerp(-1.95, -1.75, prog(t, 24.4, 25.85)), 1500, 760, 0.13, 240) },
  { id: 'bridges', t0: 25.85, t1: 28.5, world: 2, grade: DAY,
    cam: (t) => { const u = prog(t, 25.85, 28.5, ease.inOut); return orbitCam(lerp(-2.45, -2.3, u), lerp(1300, 1900, u), lerp(620, 1000, u), lerp(0.16, 0.1, u), 235); } },
  { id: 'one-world', t0: 28.5, t1: 99, world: 2, grade: { vignette: 0.42 }, final: true,
    cam: (t) => {
      const u = prog(t, 28.5, 32.4, ease.inOut3);
      const a = orbitCam(-2.36 + 0.03 * Math.sin(t * 0.15), 2100, 1250, 0.09, 230);
      const sx = STAND.x - 95, sz = STAND.z - 4;
      const x = lerp(sx, a.x, u), z = lerp(sz, a.z, u);
      return { x, z, h: lerp(62, a.h, u), yaw: lerp(90 * D2R, yawTo(a.x, a.z, 0, 0) , u), hor: lerp(0.47, 0.09, u), F: lerp(270, 230, u) };
    } },
];
export function shotAt(t) { for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return SHOTS[i]; return SHOTS[0]; }

// ---------------------------------------------------------------- narration & captions
export const LINES = [
  { id: 'p01', at: 6.65, text: 'EVERY ISLAND HAS ITS OWN WORLD…', style: 'caption', until: 9.2 },
  { id: 'p02', at: 13.75, text: 'BUT WHAT IF THESE WORLDS COULD SHARE WHAT THEY KNOW?', style: 'caption', until: 16.0 },
  { id: 'p03', at: 16.35, text: 'DATA SHARING', style: 'title', until: 21.3 },
  { id: 'p04', at: 21.75, text: 'INTEROPERABILITY', style: 'title', until: 28.3 },
  { id: 'p05', at: 28.85, text: 'DIFFERENT SYSTEMS.|SHARED DATA.|ONE CONNECTED WORLD.', style: 'stack', until: 32.6, hardUntil: 32.6 },
  { id: 'p06', at: 34.5, text: null, style: 'final' },
];
export function scheduleNarration(meta) {
  let prevEnd = 0;
  return LINES.map((l) => {
    const dur = meta?.lines?.[l.id]?.speech ?? 2.5;
    const at = Math.max(l.at, prevEnd + 0.25);
    prevEnd = at + dur;
    return { ...l, at, dur, until: l.hardUntil ? l.hardUntil : Math.max(l.until || 0, at + dur + 0.2) };
  });
}
export const TITLE_T = 32.6, CARD_T = 34.2;

// ---------------------------------------------------------------- ambience levels per time
export function ambience2(t) {
  const w1 = t < WARP_T;
  return {
    hum: w1 ? lerp(0.6, 0.95, prog(t, 0, 5)) : lerp(0.5, 0.08, prog(t, WARP_T, 9)),
    jungle: w1 ? 0.25 : 0,
    ocean: w1 ? 0.12 : lerp(0.8, 0.45, prog(t, 9, 14)),
    wind: w1 ? 0.2 : t < 13 ? 0.45 : 0.3,
    digital: t < 15.8 ? 0 : t < 28.5 ? 0.55 : 0.4,
  };
}
