// ============================================================================
// DSI Island — Part 2: The Connection. Composition, UI and main loop.
// Reuses Part 1's engine (renderer, assets, sprites, font, audio) unchanged.
// ============================================================================
import { Assets } from '../assets.js';
import { buildMap, buildObjects, WORLD } from '../world.js';
import { AudioEngine } from '../audio.js';
import { drawText, wrap, textWidth } from '../pixelfont.js';
import { clamp, lerp, prog, ease, mulberry32 } from '../util.js';
import { Renderer2 } from './renderer2.js';
import { buildMap2, buildObjects2, ISLANDS, BYID, BRIDGES, BEACONS, PORTAL2, HUB } from './world2.js';
import { SHOTS, shotAt, charAt, buildSteps, portalBoost, hubGlowAt, packetsAt, arrivals, bridgeProgress, litAt, badgeAt,
  scheduleNarration, ambience2, END_T, WARP_T, TITLE_T, CARD_T, SEND_TO, STAND } from './director2.js';

const ROOT = '';
const Q = new URLSearchParams(location.search);
const VOICE = Q.get('voice') || 'female';
const EVENT = {   // exact invitation content (Part 2 brief)
  booth: 'DATA SHARING & INTEROPERABILITY BOOTH',
  venue: 'قاعة الجوهرة',
  date: 'WEDNESDAY, NOVEMBER 11',
  time: '9:00 AM – 2:00 PM',
  cta: 'MEET US AT DSI!',
};
const cv = document.getElementById('stage');
const ui = {
  title: document.getElementById('title'), start: document.getElementById('start'), load: document.getElementById('loadbar'),
  sound: document.getElementById('sound'), replay: document.getElementById('replay'), replayBig: document.getElementById('replay-big'), hud: document.getElementById('hud'),
};
const assets = new Assets(ROOT);
let R, OBJ1, OBJ2, PLAN, STEPS, audio, mode = 'title', perfBase = 0, titleT0 = performance.now();
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- shared drawing helpers (same look as Part 1)
function charDir(c, cam) {
  const vx = cam.x - c.x, vz = cam.z - c.z, fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  const yaw = Math.atan2(vx * -fz + vz * fx, vx * fx + vz * fz);
  return ((Math.round(yaw / (22.5 * D2R)) % 16) + 16) % 16;
}
function drawShadow(r, p, k, w, alpha = 0.32) {
  const ctx = r.ctx, s = r.s;
  const rx = w * k * s, ry = Math.max(s * 0.8, rx * clamp(r.cam.h / p.depth, 0.08, 0.6));
  ctx.globalAlpha = alpha; ctx.fillStyle = '#1a1a10';
  ctx.beginPath(); ctx.ellipse(r.offX + p.sx * s, p.sy * s, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function px(r, x, y, d, col, a = 1, add = true) {
  const ctx = r.ctx; ctx.globalAlpha = a; ctx.fillStyle = col; if (add) ctx.globalCompositeOperation = 'lighter';
  ctx.fillRect(Math.round(r.offX + x * r.s), Math.round(y * r.s), d, d);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function explorerObj(c, portalI, worldPortal) {
  return { x: c.x, z: c.z, s: 1, noNearFade: true, draw: (r, p, k) => {
    if (c.alpha <= 0.01) return;
    const dir = charDir(c, r.cam);
    drawShadow(r, p, k, 9, 0.35 * c.alpha);
    r.blit(assets.char('day', c.anim, c.frame, dir), p.sx, p.sy, k, { alpha: c.alpha });
    const dd = Math.hypot(c.x - worldPortal.x, c.z - worldPortal.z);
    const pk = portalI * clamp(1.25 - dd / 400);
    if (pk > 0.02) r.blit(assets.char('portal', c.anim, c.frame, dir), p.sx, p.sy, k, { alpha: c.alpha * clamp(pk) });
  } };
}
function portalObj(P, t, I, boost, facing) {
  return { x: P.x, z: P.z, s: P.scale, draw: (r, p, k) => {
    const vx = r.cam.x - P.x, vz = r.cam.z - P.z, vl = Math.hypot(vx, vz) || 1;
    const face = Math.max(0.2, Math.abs((vx * facing) / vl));
    const cy = p.sy - 35 * k;
    r.blit(assets.env('portal'), p.sx, p.sy, k, { sx: face });
    const ef = assets.env('portal_energy_' + (((Math.floor(t * (10 + boost * 14)) % 12) + 12) % 12));
    r.blit(ef, p.sx, cy + 0.5 * k, k * (1 + boost * 0.08), { sx: face, alpha: clamp(I * 1.5) });
    r.blit(assets.env('portal_runes'), p.sx, p.sy, k, { sx: face, alpha: clamp(I * 1.2 + boost), blend: 'lighter' });
    const g = assets.env('glow_blue');
    r.blit(g, p.sx, cy, k * (1.15 + boost * 1.2), { alpha: (0.5 + boost * 0.5) * I * (0.9 + 0.1 * Math.sin(t * 4)), blend: 'lighter' });
    r.blit(g, p.sx, cy, k * (2.6 + boost * 2.5), { alpha: (0.22 + boost * 0.4) * I, blend: 'lighter' });
    if (boost > 0.6) { // energy flare ring as it opens
      const ctx = r.ctx, s = r.s, rr = (boost - 0.6) / 0.4;
      ctx.strokeStyle = `rgba(190,246,255,${0.8 * (1 - rr * 0.6)})`; ctx.lineWidth = Math.max(1, Math.round(2 * s));
      ctx.beginPath(); ctx.arc(r.offX + p.sx * s, cy * s, (20 + rr * 45) * k * s, 0, Math.PI * 2); ctx.stroke();
    }
  } };
}
function motes(list, P, t, I, count = 70, spread = 90) {
  for (let i = 0; i < count; i++) {
    const rr = mulberry32(i * 97 + 3);
    const life = 3 + rr() * 3, ph = ((t + rr() * life) % life) / life;
    const a = rr() * Math.PI * 2, rad = 20 + rr() * spread;
    const x = P.x + Math.cos(a) * rad * 0.6, z = P.z + Math.sin(a) * rad;
    const y = 4 + ph * (60 + rr() * 70) + Math.sin(t * 2 + i) * 3;
    const sz = rr() < 0.3 ? 2 : 1.2, alpha = Math.sin(Math.PI * ph) * clamp(I * 1.6 - 0.1 * (i % 3));
    const col = rr() < 0.5 ? '#bff6ff' : '#5fd0ff';
    list.push({ x, z, y, s: 1, noNearFade: true, draw: (r, p, k) => px(r, p.sx, p.sy, Math.max(1, Math.round(sz * k * r.s)), col, alpha) });
  }
}

// ---------------------------------------------------------------- world 1 (Part 1 island) objects
function world1Objects(t) {
  const out = [];
  const c = charAt(t);
  const boost = portalBoost(t);
  const P = WORLD.portal;
  out.push(portalObj(P, t, 1, boost, -1));
  if (c.world === 1) out.push(explorerObj(c, 1, P));
  motes(out, P, t, 1 + boost, 70 + Math.round(boost * 40));
  return out;
}

// ---------------------------------------------------------------- world 2 (archipelago) objects
function world2Objects(t) {
  const out = [];
  const c = charAt(t);
  const lit = litAt(t);
  out.push(portalObj(PORTAL2, t, 0.85, 0, 1));
  motes(out, PORTAL2, t, hubGlowAt(t), 30, 60);
  if (c.world === 2) out.push(explorerObj(c, 0, PORTAL2));
  // badges + glow over each island's building
  for (const isl of ISLANDS) {
    const b = badgeAt(isl, t), L = lit[isl.id] || 0;
    out.push({ x: isl.x, z: isl.z - 1, s: isl.bs, draw: (r, p, k) => {
      if (L > 0) {
        const g = assets.env('glow_warm');
        r.blit(g, p.sx, p.sy - 34 * k, k * 1.25, { alpha: 0.35 * L * (0.85 + 0.15 * Math.sin(t * 3 + isl.id)), blend: 'lighter' });
      }
      if (!b) return;
      const bob = Math.sin(t * 2.2 + isl.id) * 2;
      const pop = b.pop < 1 ? 0.6 + 0.4 * ease.out3(b.pop) + Math.sin(b.pop * Math.PI) * 0.25 : 1;
      const kb = Math.max(k * 0.75, 0.55) * pop;
      r.blit(assets.env(b.key), p.sx, p.sy - (88 + bob) * k, kb, { alpha: clamp(b.pop * 2) });
    } });
  }
  // receiver beacons: switch on as each system comes online
  const arr = arrivals();
  for (const be of BEACONS) {
    const L = lit[be.isl] || 0;
    const recvFlash = be.isl === 2 && Math.abs(be.x - SEND_TO.x) < 1 && Math.abs(be.z - SEND_TO.z) < 1 ? arr.some((a) => t >= a && t < a + 0.25) : false;
    out.push({ x: be.x, z: be.z, s: 2.0, draw: (r, p, k) => {
      const on = L > 0.5 || recvFlash;
      r.blit(assets.env(on ? 'beacon_on' : 'beacon_off'), p.sx, p.sy, k);
      if (on) r.blit(assets.env('glow_blue'), p.sx, p.sy - 15 * k, k * 0.45, { alpha: 0.7, blend: 'lighter' });
    } });
  }
  // ripple rings where data lands at the hospital receiver
  for (const a of arr) {
    if (t < a || t > a + 0.9) continue;
    const u = (t - a) / 0.9;
    out.push({ x: SEND_TO.x, z: SEND_TO.z, s: 1, noNearFade: true, draw: (r, p, k) => {
      const ctx = r.ctx, s = r.s;
      ctx.strokeStyle = `rgba(160,240,255,${1 - u})`; ctx.lineWidth = Math.max(1, Math.round(s * 1.5));
      ctx.beginPath(); ctx.ellipse(r.offX + p.sx * s, p.sy * s, (10 + u * 50) * k * s, (10 + u * 50) * k * s * clamp(r.cam.h / p.depth, 0.15, 0.6), 0, 0, Math.PI * 2); ctx.stroke();
    } });
  }
  // a failed packet's splash in the gap
  if (t > 15.0 && t < 15.9) {
    const u = (t - 15.0) / 0.9, mx = (SEND_TO.x + 600) / 2;
    out.push({ x: 600, z: 0, s: 1, draw: (r, p, k) => {
      const ctx = r.ctx, s = r.s;
      ctx.strokeStyle = `rgba(240,252,255,${0.9 * (1 - u)})`; ctx.lineWidth = Math.max(1, Math.round(s));
      ctx.beginPath(); ctx.ellipse(r.offX + p.sx * s, p.sy * s, (6 + u * 40) * k * s, (6 + u * 40) * k * s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    } });
  }
  // data packets with light trails
  for (const pk of packetsAt(t)) {
    for (const tr of pk.trail) out.push({ x: tr.x, z: tr.z, y: tr.y, s: 1, noNearFade: true, draw: (r, p, k) => px(r, p.sx, p.sy, Math.max(1, Math.round(2.2 * k * r.s * tr.a)), '#5fd0ff', tr.a * 0.9 * pk.alpha) });
    out.push({ x: pk.x, z: pk.z, y: pk.y, s: 1, noNearFade: true, draw: (r, p, k) => {
      const ks = k * (pk.small ? 1.4 : 2.2);
      r.blit(assets.env('glow_blue'), p.sx, p.sy, ks * 0.32, { alpha: 0.75 * pk.alpha, blend: 'lighter' });
      r.blit(assets.env(pk.icon), p.sx, p.sy, ks, { alpha: pk.alpha });
    } });
  }
  return out;
}

// ---------------------------------------------------------------- frame composition
const SKY = { skyTop: [56, 118, 204], skyMid: [104, 178, 230], skyHor: [200, 234, 240] };
function renderFrame(t, opts = {}) {
  const ctx = R.ctx;
  ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, cv.width, cv.height);
  const shot = opts.shot || shotAt(t);
  const cam = shot.cam(t);
  R.setCamera(cam);
  if (shot.world === 1) {
    const st = { t, world: 1, portalI: 1, fog: 2400, ...SKY, runeGlow: 1, sunGlow: 1 };
    R.drawGround(st); R.drawPanorama(st);
    R.drawBillboards(st, OBJ1.concat(shot.type === 'portrait' ? world1Objects(t).filter((o) => !o.noNearFade || o.y) : world1Objects(t)));
  } else {
    const bp = bridgeProgress(t);
    const st = { t, world: 2, portalI: 0, fog: 5200, ...SKY, runeGlow: 0.6, sunGlow: 1, hubGlow: hubGlowAt(t),
      bridges: BRIDGES.map((b, i) => ({ ...b, p: bp[i] })), islandLit: litAt(t) };
    R.drawGround(st); R.drawPanorama(st);
    let dyn = world2Objects(t);
    if (shot.type === 'portrait') dyn = dyn.filter((o) => !(o.noNearFade && !o.y));
    R.drawBillboards(st, OBJ2.concat(dyn));
  }
  if (shot.type === 'portrait') drawPortrait(shot.portrait(t), t, shot.world);
  R.grade(shot.grade || {});
  if (shot.tunnel) drawTunnel(t);
  if (shot.flashIn) R.ditherFill(1 - prog(t, shot.flashIn[0], shot.flashIn[1]), '#e8fbff');
  if (shot.puzzle) drawInterop(t);
  const since = t - shot.t0;
  if (since < 0.12 && shot.t0 > 0 && !shot.flashIn && !opts.noCutFx) R.ditherFill(0.5 * (1 - since / 0.12));
  if (!opts.hideText) { if (shot.tag) drawTag(shot.tag, t - shot.t0); drawCaptions(t); drawFinal(t); }
}

function drawPortrait(p, t, world) {
  const ctx = R.ctx, s = R.s;
  ctx.fillStyle = 'rgba(10,18,24,0.35)'; ctx.fillRect(0, 0, cv.width, cv.height);
  const k = (Math.min(R.VH * 0.62, R.VW * 0.95) / 72) * p.zoom;
  R.blit(assets.portrait(p.a), R.VW / 2 + 6, R.VH + 4 * k, k);
  if (p.glowFront) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(40,120,220,${0.2 + 0.05 * Math.sin(t * 5)})`; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  for (let i = 0; i < 22; i++) {
    const rr = mulberry32(i * 13 + 1); const ph = (t * (0.15 + rr() * 0.2) + rr()) % 1;
    ctx.globalAlpha = Math.sin(Math.PI * ph) * (world === 1 ? 0.9 : 0.35); ctx.fillStyle = world === 1 ? '#bff6ff' : '#fff6d0';
    const d = Math.max(1, Math.round(s * (rr() < 0.3 ? 2 : 1)));
    ctx.fillRect(Math.round(R.offX + rr() * R.VW * s), Math.round(R.VH * (1 - ph) * s), d, d);
  }
  ctx.globalAlpha = 1;
}

// moving through the portal: concentric pixel rings + streaks, ending in white light
function drawTunnel(t) {
  const u = prog(t, 5.35, WARP_T);
  if (u <= 0) return;
  const ctx = R.ctx, s = R.s, W = cv.width, Hh = cv.height, cx = W / 2, cy = R.hy ? (R.hy - 50 * (R.cam.F / Math.max(20, -905 - R.cam.x + 1))) * s : Hh * 0.4;
  const ccx = cx, ccy = Math.min(Math.max(cy, Hh * 0.25), Hh * 0.6);
  ctx.globalAlpha = clamp(u * 1.6); ctx.fillStyle = '#0b2a6a'; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1;
  const maxR = Math.hypot(W, Hh);
  const cols = ['#14389a', '#1f63d6', '#3a9cf2', '#6fd2ff', '#b6f2ff'];
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const ph = ((t * 1.7 + i / 14) % 1);
    const rr = ph * ph * maxR * 0.7;
    ctx.globalAlpha = clamp(u * 1.4) * (0.25 + 0.6 * ph);
    ctx.strokeStyle = cols[i % 5]; ctx.lineWidth = Math.max(1, Math.round(s * (1 + ph * 4)));
    ctx.beginPath();
    // octagonal "pixel" rings
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; const x = ccx + Math.cos(a) * rr, y = ccy + Math.sin(a) * rr; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  const rnd = mulberry32(9);
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, sp = 0.5 + rnd();
    const ph = (t * sp * 1.3 + rnd()) % 1;
    const r0 = ph * ph * maxR * 0.6, r1 = r0 + (20 + 120 * ph) * s * u;
    ctx.globalAlpha = clamp(u * 1.5) * ph; ctx.strokeStyle = i % 3 ? '#bff6ff' : '#5fd0ff'; ctx.lineWidth = Math.max(1, Math.round(s));
    ctx.beginPath(); ctx.moveTo(ccx + Math.cos(a) * r0, ccy + Math.sin(a) * r0); ctx.lineTo(ccx + Math.cos(a) * r1, ccy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  R.ditherFill(prog(t, 5.8, WARP_T - 0.02), '#e8fbff');
}

// ---------------------------------------------------------------- interoperability close-up (shared standard)
// A data "piece" whose connector does not fit the hospital system's socket; the
// shared DSI standard reshapes both to the same format, the piece clicks in and
// the hospital system lights up: understood. (Data sharing = moving; this = understanding.)
function tabMask(shape, x, y) {   // x 0..5 (outward), y 0..9
  if (shape === 'tri') return x < 6 * (1 - Math.abs(y - 4.5) / 5);
  if (shape === 'round') return (x - 0) ** 2 / 36 + (y - 4.5) ** 2 / 25 < 1;
  if (shape === 'square') return true;
  return x < 6 - Math.max(0, Math.abs(y - 4.5) - 2.5) * 1.5;   // hex: the shared standard
}
function drawInterop(t) {
  const T0 = 21.5;
  const a = prog(t, T0, T0 + 0.35) * (1 - prog(t, 24.05, 24.4));
  if (a <= 0) return;
  const ctx = R.ctx, s = R.s, P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(R.offX + x * s), Math.round(y * s), Math.ceil(w * s), Math.ceil(h * s)); };
  ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#04101e'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = a;
  const cx = Math.round(R.VW / 2), cy = Math.round(R.VH * 0.53);
  const morph = prog(t, 22.85, 23.2), matched = t >= 23.45;
  const flick = morph > 0 && morph < 1 && Math.floor(t * 24) % 2;
  const tabShape = morph >= 1 || flick ? 'hex' : 'tri', notchShape = morph >= 1 || flick ? 'hex' : 'round';
  // card position: slide in, bounce off, wait, slide in and click
  let cardX;
  if (t < 22.2) cardX = lerp(cx - 120, cx - 44, ease.out3(prog(t, T0 + 0.1, 22.2)));
  else if (t < 22.6) { const u = prog(t, 22.2, 22.6); cardX = cx - 44 - Math.sin(u * Math.PI) * 10 + Math.sin(u * 40) * (1 - u) * 1.5; }
  else if (t < 23.2) cardX = cx - 44;
  else cardX = lerp(cx - 44, cx - 38, ease.in(prog(t, 23.2, 23.45)));
  const cardY = cy - 9;
  // receiving system (socket block) with the hospital emblem
  const sx = cx - 6, sy = cy - 15, sw = 30, sh = 30;
  P(sx - 1, sy - 1, sw + 2, sh + 2, '#0a0f1c');
  P(sx, sy, sw, sh, matched ? '#1d5a4a' : '#26385a');
  P(sx, sy, sw, 2, matched ? '#5fe07a' : '#3a5a8a');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 6; x++) if (tabMask(notchShape, x, y)) P(sx + x, cy - 5 + y, 1, 1, '#05080f');
  const badge = assets.env(matched ? 'badge_cross' : 'badge_cross');
  R.blit(badge, sx + sw / 2 + 3, sy + sh / 2, 0.75, { alpha: a });
  // incoming data card (document) with its connector tab
  const cardCol = matched ? '#e8fff0' : '#eaf8ff';
  P(cardX - 1, cardY - 1, 26, 20, '#0d2a4a'); P(cardX, cardY, 24, 18, cardCol);
  for (let i = 0; i < 4; i++) P(cardX + 4, cardY + 4 + i * 3, 14 - (i % 2) * 4, 1, matched ? '#4fc4a0' : '#3a86c0');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 6; x++) if (tabMask(tabShape, x, y)) P(cardX + 24 + x, cardY + 4 + y, 1, 1, matched ? '#8ff4c0' : '#5fd0ff');
  // mismatch: '?' and a soft red-orange edge flash
  if (t > 22.2 && t < 23.45) {
    const q = prog(t, 22.2, 22.35);
    R.blit(assets.env('badge_quest'), sx + sw + 10, sy - 2, 0.6 + 0.15 * q, { alpha: a * q });
  }
  // the shared standard (DSI emblem) and its pulse
  if (t > 22.55) {
    const q = prog(t, 22.55, 22.8);
    R.blit(assets.env('badge_dsi'), cx - 8, cy - 40, 1.0 * (0.7 + 0.3 * q), { alpha: a * q });
    const pu = prog(t, 22.75, 23.3);
    if (pu > 0 && pu < 1) {
      ctx.strokeStyle = `rgba(143,232,255,${(1 - pu) * a})`; ctx.lineWidth = Math.max(1, Math.round(s * 2));
      ctx.beginPath(); ctx.arc(R.offX + (cx - 8) * s, (cy - 40 + 13) * s, (8 + pu * 80) * s, 0, Math.PI * 2); ctx.stroke();
    }
  }
  if (matched) {
    const q = prog(t, 23.45, 23.6);
    R.blit(assets.env('badge_check'), sx + sw + 10, sy - 2, 0.7 + 0.2 * Math.sin(q * Math.PI), { alpha: a });
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - prog(t, 23.45, 23.9)) * 0.6 * a;
    P(sx - 4, sy - 4, sw + 8, sh + 8, '#5fe07a'); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
  }
  // tiny labels in the pixel font
  const fpx = Math.max(1, Math.round(s * 1.0));
  drawText(ctx, 'DATA', R.offX + (cardX + 12) * s, (cardY + 22) * s, fpx, { alpha: a, fill: ['#e6fbff', '#9fe6ff', '#5fc4f0'], outline: '#06142a' });
  drawText(ctx, 'HOSPITAL', R.offX + (sx + sw / 2) * s, (sy + sh + 4) * s, fpx, { alpha: a, fill: ['#e6fbff', '#9fe6ff', '#5fc4f0'], outline: '#06142a' });
  if (t > 22.6) drawText(ctx, 'SHARED STANDARD', R.offX + (cx - 8) * s, (cy - 62) * s, fpx, { alpha: a * prog(t, 22.6, 22.9), fill: ['#fff6d6', '#f2cf73', '#d99a3a'] });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- text
const cpx = () => Math.max(1, Math.round(R.s * 1.5));
function topBand(alpha, h) {
  const ctx = R.ctx, g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(4,8,18,${0.55 * alpha})`); g.addColorStop(1, 'rgba(4,8,18,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, h);
}
function drawCaptions(t) {
  if (!PLAN) return;
  const ctx = R.ctx, s = R.s, W = cv.width;
  for (const l of PLAN.lines) {
    if (!l.text || t < l.at - 0.05 || t > l.until) continue;
    const alpha = 1 - prog(t, l.until - 0.35, l.until);
    const y0 = Math.max(cv.height * 0.085, s * 22);
    if (l.style === 'caption') {
      const p = cpx(), lines = wrap(l.text, Math.floor(((Math.min(R.VW, 300) - 22) * s) / p));
      topBand(alpha, y0 + lines.length * 11 * p + 18 * s);
      let shown = Math.floor((t - l.at + 0.05) * 34), y = y0;
      for (const ln of lines) { drawText(ctx, ln, W / 2, y, p, { reveal: shown, alpha }); shown -= ln.length + 1; y += 11 * p; }
    } else if (l.style === 'title') {
      const big = Math.max(1, Math.floor(s * Math.min(2.6, (R.VW - 22) / textWidth(l.text))));
      const a = alpha * prog(t, l.at - 0.05, l.at + 0.25);
      topBand(a, y0 + 11 * big + 22 * s);
      R.blit(assets.env('glow_blue'), R.VW / 2, y0 / s + 5 * big / s, Math.max(1.2, textWidth(l.text) * big / s / 80), { alpha: 0.28 * a, blend: 'lighter' });
      drawText(ctx, l.text, W / 2, y0 + (1 - a) * 4 * s, big, { alpha: a, fill: ['#ffffff', '#9fe6ff', '#3fa8ea'], outline: '#06142a' });
    } else if (l.style === 'stack') {
      const parts = l.text.split('|'), p = cpx();
      topBand(alpha, y0 + parts.length * 12 * p + 18 * s);
      parts.forEach((ln, i) => {
        const ta = l.at + i * (l.dur / parts.length) * 0.92;
        if (t < ta) return;
        drawText(ctx, ln, W / 2, y0 + i * 12 * p, p, { reveal: Math.floor((t - ta) * 34), alpha, fill: i === 2 ? ['#ffffff', '#9fe6ff', '#3fa8ea'] : undefined, outline: i === 2 ? '#06142a' : undefined });
      });
    }
  }
}
function drawTag(isl, since) {
  const ctx = R.ctx, s = R.s, a = prog(since, 0, 0.12) * (1 - prog(since, 0.45, 0.55));
  if (a <= 0) return;
  const p = cpx(), w = textWidth(isl.name) * p + 34 * s, x0 = cv.width / 2 - w / 2, y0 = cv.height - 44 * s;
  ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#071226'; ctx.fillRect(Math.round(x0), Math.round(y0), Math.round(w), Math.round(22 * s));
  ctx.globalAlpha = a; ctx.fillStyle = '#f2cf73';
  ctx.fillRect(Math.round(x0), Math.round(y0), Math.round(w), Math.max(1, Math.round(s))); ctx.fillRect(Math.round(x0), Math.round(y0 + 21 * s), Math.round(w), Math.max(1, Math.round(s)));
  R.blit(assets.env(isl.badge), (x0 - R.offX) / s + 12, (y0 / s) + 11, 0.7, { alpha: a });
  drawText(ctx, isl.name, x0 + 26 * s, y0 + 11 * s - 3.5 * p, p, { align: 'left', alpha: a });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- scene 05 title + event invitation
function drawFinal(t) {
  if (t < TITLE_T) return;
  const ctx = R.ctx, s = R.s, W = cv.width, Hh = cv.height;
  const a0 = prog(t, TITLE_T, TITLE_T + 0.6), card = prog(t, CARD_T, CARD_T + 0.6);
  ctx.globalAlpha = 0.5 * a0 + 0.3 * card; ctx.fillStyle = '#030814'; ctx.fillRect(0, 0, W, Hh); ctx.globalAlpha = 1;
  const colW = Math.min(R.VW, 240) - 26;               // usable text width (virtual px)
  const fit = (str, max) => Math.max(1, Math.floor(s * Math.min(max, colW / textWidth(str)))); // device px per font px
  // ---- layout (virtual px), top to bottom
  const logo = assets.env('dsi_logo');
  const lk = Math.max(1, Math.floor(Math.min((R.VW - 40) / logo.w, 0.8) * s)) / s;
  const pB = fit('INTEROPERABILITY', 1.6), pD = fit('NOVEMBER 11', 1.5), pT = fit(EVENT.time, 1.5), pC = fit(EVENT.cta, 2.2);
  const fsV = Math.min(22, (Math.min(R.VW, 240) - 56) / 5.2);   // Arabic font size (virtual px)
  const H = {
    logo: logo.h * lk, gap1: 12, booth: 3 * 11 * pB / s, gap2: 8, venue: fsV * 1.6, gap3: 6,
    date: 2 * 11 * pD / s, time: 11 * pT / s, gap4: 10, cta: 11 * pC / s,
  };
  const total = Object.values(H).reduce((x, y) => x + y, 0) + 16;
  let y = Math.max(8, (R.VH - total) / 2);
  const yLogo = y + H.logo; y = yLogo + H.gap1;
  const yBooth = y; y += H.booth + H.gap2;
  const yVenue = y; y += H.venue + H.gap3;
  const yDate = y; y += H.date;
  const yTime = y; y += H.time + H.gap4;
  const yCta = y; y += H.cta;
  // ---- logo
  R.blit(assets.env('glow_blue'), R.VW / 2, yLogo - H.logo * 0.5, lk * 2.0, { alpha: 0.45 * a0 * (0.85 + 0.15 * Math.sin(t * 3)), blend: 'lighter' });
  R.blit({ ...logo, ax: logo.w / 2, ay: logo.h }, R.VW / 2, yLogo + (1 - a0) * 6, lk, { alpha: a0 });
  // ---- invitation panel (pixel frame)
  if (card > 0) {
    const pw = Math.min(R.VW - 12, 236), px0 = R.VW / 2 - pw / 2, py0 = yBooth - 8, ph = yCta + H.cta + 10 - py0;
    const P = (x, yy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(R.offX + x * s), Math.round(yy * s), Math.round(w * s), Math.max(1, Math.round(h * s))); };
    ctx.globalAlpha = 0.84 * card; P(px0, py0, pw, ph, '#06122a');
    ctx.globalAlpha = card; P(px0, py0, pw, 1, '#f2cf73'); P(px0, py0 + ph - 1, pw, 1, '#f2cf73'); P(px0, py0, 1, ph, '#f2cf73'); P(px0 + pw - 1, py0, 1, ph, '#f2cf73');
    P(px0 + 2, py0 + 2, pw - 4, 1, '#2f7cf0'); P(px0 + 2, py0 + ph - 3, pw - 4, 1, '#2f7cf0');
    ctx.globalAlpha = 1;
  }
  // ---- booth name: the title "DATA SHARING & INTEROPERABILITY" gains "BOOTH" when the invitation appears
  const ta = prog(t, TITLE_T + 0.3, TITLE_T + 0.8), gold = ['#fff6d6', '#f2cf73', '#d99a3a'];
  const titleY = card > 0 ? yBooth : yBooth + 8 * (1 - card);
  drawText(ctx, 'DATA SHARING &', W / 2, titleY * s, pB, { alpha: ta, fill: gold });
  drawText(ctx, 'INTEROPERABILITY', W / 2, titleY * s + 11 * pB, pB, { alpha: ta, fill: gold });
  if (card > 0) drawText(ctx, 'BOOTH', W / 2, titleY * s + 22 * pB, pB, { alpha: card, fill: gold, reveal: Math.floor((t - CARD_T) * 18) });
  if (card <= 0) return;
  // ---- venue in Arabic, right-to-left, bundled Noto Kufi Arabic subset
  const va = prog(t, CARD_T + 0.5, CARD_T + 1.0);
  ctx.save();
  ctx.globalAlpha = va; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(fsV * s)}px "DSIKufi", "Noto Kufi Arabic", "Noto Naskh Arabic", "Geeza Pro", Tahoma, sans-serif`;
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, Math.round(s * 2)); ctx.strokeStyle = '#06142a';
  ctx.shadowColor = 'rgba(95,208,255,0.6)'; ctx.shadowBlur = 8 * s;
  const vy = (yVenue + H.venue / 2) * s;
  ctx.strokeText(EVENT.venue, W / 2, vy);
  ctx.shadowBlur = 0; ctx.fillStyle = '#e8fbff'; ctx.fillText(EVENT.venue, W / 2, vy);
  ctx.restore();
  // ---- date and time (exact text; the date wraps after the comma on narrow screens)
  const da = prog(t, CARD_T + 1.0, CARD_T + 1.4), tma = prog(t, CARD_T + 1.3, CARD_T + 1.7);
  const white = ['#ffffff', '#eef4f6', '#cfd8e0'];
  const oneLine = textWidth(EVENT.date) * pD / s <= colW;
  if (oneLine) drawText(ctx, EVENT.date, W / 2, (yDate + 5.5 * pD / s) * s, pD, { alpha: da, fill: white, outline: '#06142a' });
  else { drawText(ctx, 'WEDNESDAY,', W / 2, yDate * s, pD, { alpha: da, fill: white, outline: '#06142a' }); drawText(ctx, 'NOVEMBER 11', W / 2, yDate * s + 11 * pD, pD, { alpha: da, fill: white, outline: '#06142a' }); }
  drawText(ctx, EVENT.time, W / 2, yTime * s, pT, { alpha: tma, fill: ['#e6fbff', '#9fe6ff', '#5fc4f0'], outline: '#06142a' });
  // ---- MEET US AT DSI!
  const ma = prog(t, CARD_T + 1.8, CARD_T + 2.2);
  if (ma > 0) drawText(ctx, EVENT.cta, W / 2, yCta * s + (1 - ma) * 4 * s, pC, { reveal: Math.floor((t - CARD_T - 1.8) * 30), fill: ['#ffffff', '#f6d36a', '#e0a23a'] });
}

// ---------------------------------------------------------------- sound plan
function buildPlan(narrMeta) {
  const lines = scheduleNarration(narrMeta);
  const sfx = [{ t: 3.85, key: 'open', gain: 1.0 }, { t: 4.45, key: 'warp', gain: 0.9 }, { t: 14.85, key: 'fail', gain: 0.7 },
    { t: 23.42, key: 'match', gain: 1.0 }, { t: 24.75, key: 'match', gain: 0.45 }, { t: 25.05, key: 'match', gain: 0.4 }, { t: 25.35, key: 'match', gain: 0.4 },
    { t: 25.9, key: 'bridge', gain: 0.8 }, { t: 26.8, key: 'bridge', gain: 0.6 }, { t: TITLE_T, key: 'chime', gain: 0.5 }, { t: CARD_T + 1.8, key: 'chime', gain: 0.45 },
    { t: 13.95, key: 'send', gain: 0.5 }];
  for (const l of lines) if (l.text) sfx.push({ t: l.at - 0.05, key: 'chime', gain: 0.3 });
  arrivals().forEach((a, i) => { sfx.push({ t: a - 2.2, key: 'send', gain: 0.32 }); sfx.push({ t: a, key: 'recv', gain: 0.4 }); });
  STEPS.forEach((st, i) => sfx.push({ t: st.t, key: 'step' + (i % 4), gain: st.w === 1 ? 0.45 : 0.5, pan: i % 2 ? 0.08 : -0.08 }));
  return { lines, sfx, ambEnd: 44, ambFadeAt: 40 };
}
const AUDIO = {
  music: 'part2/music/score_part2.mp3',
  ocean: 'sfx/amb_ocean.mp3', wind: 'sfx/amb_wind.mp3', jungle: 'sfx/amb_jungle.mp3', hum: 'sfx/portal_hum.mp3', digital: 'part2/sfx/amb_digital.mp3',
  step0: 'sfx/step_sand_0.mp3', step1: 'sfx/step_sand_1.mp3', step2: 'sfx/step_sand_2.mp3', step3: 'sfx/step_sand_3.mp3',
  open: 'part2/sfx/portal_open.mp3', warp: 'part2/sfx/warp.mp3', send: 'part2/sfx/data_send.mp3', recv: 'part2/sfx/data_receive.mp3',
  fail: 'part2/sfx/data_fail.mp3', match: 'part2/sfx/match.mp3', bridge: 'part2/sfx/bridge_form.mp3',
  chime: 'sfx/text_chime.mp3', click: 'sfx/ui_click.mp3',
};

// ---------------------------------------------------------------- loop & UI
function now() { const c = audio && audio.clock(); return Math.max(0, c != null ? c : (performance.now() - perfBase) / 1000); }
function loop() {
  if (mode === 'title') {
    // behind the title: Part 1's final frame, gently alive (where the story left off)
    renderFrame(0.4 + ((performance.now() - titleT0) / 1000) % 0.5 * 0, { hideText: true, noCutFx: true });
    R.ditherFill(0.5, '#05060c');
  } else if (mode === 'play') {
    const t = now();
    renderFrame(t);
    if (t > END_T && ui.replayBig.hidden) ui.replayBig.hidden = false;
  }
  requestAnimationFrame(loop);
}
async function startFilm(from = 0) {
  ui.title.classList.add('gone'); ui.hud.hidden = false; ui.replayBig.hidden = true;
  await audio.unlock();
  audio.start(from, PLAN);
  perfBase = performance.now() - from * 1000;
  mode = 'play';
}
function pixelLabel(el, text, scale = 2, fill) {
  const c = document.createElement('canvas'); const w = textWidth(text) + 4, h = 11;
  c.width = w * scale; c.height = h * scale;
  drawText(c.getContext('2d'), text, c.width / 2, scale, scale, { fill, shadow: null }); el.appendChild(c);
}
function drawTitleLogo() {
  const c = document.getElementById('title-logo'), logo = assets.env('dsi_logo');
  const W = 150, H = 92; c.width = W * 4; c.height = H * 4;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.scale(4, 4);
  x.drawImage(logo.img, logo.x, logo.y, logo.w, logo.h, Math.round((W - logo.w) / 2), 2, logo.w, logo.h);
  drawText(x, 'ISLAND', W / 2, logo.h + 6, 3, { fill: ['#e6fbff', '#9fe6ff', '#4fb4ea'], outline: '#06142a' });
  drawText(x, 'PART 2 · THE CONNECTION', W / 2, logo.h + 34, 1, { fill: ['#fff6d6', '#f2cf73', '#d99a3a'] });
}
async function boot() {
  R = new Renderer2(cv, null);
  addEventListener('resize', () => R.resize());
  buildMap(); OBJ1 = buildObjects();
  buildMap2(); OBJ2 = buildObjects2();
  STEPS = buildSteps();
  try { const f = new FontFace('DSIKufi', `url(${ROOT}assets/fonts/NotoKufiArabic-Bold-venue.woff2)`, { weight: '700' }); await f.load(); document.fonts.add(f); } catch (e) { console.warn('font', e); }
  await assets.load((p) => ui.load.style.setProperty('--p', (p * 0.6).toFixed(3)), ['part2_atlas']);
  R.A = assets;
  drawTitleLogo();
  let narrMeta = null;
  try { narrMeta = (await (await fetch(ROOT + 'assets/audio/part2/narration/narration.json')).json())[VOICE]; } catch (e) {}
  PLAN = buildPlan(narrMeta);
  window.__DSI2 = { renderFrame, PLAN, SHOTS, R };
  if (Q.has('t')) {
    const t = parseFloat(Q.get('t'));
    ui.title.style.display = 'none'; mode = 'still';
    const draw = () => renderFrame(t, { hideText: Q.has('notext') });
    draw(); addEventListener('resize', draw);
    document.body.dataset.ready = '1';
    return;
  }
  audio = new AudioEngine(VOICE, { base: ROOT + 'assets/audio/', files: AUDIO, narrDir: 'part2/narration', ambience: ambience2,
    ambKeys: ['ocean', 'wind', 'jungle', 'hum', 'digital'] });
  await audio.preload(PLAN.lines, (p) => ui.load.style.setProperty('--p', (0.6 + p * 0.4).toFixed(3)));
  ui.load.style.setProperty('--p', '1');
  document.body.classList.add('loaded'); ui.start.disabled = false; document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}
pixelLabel(document.getElementById('hint'), 'BEST WITH SOUND ON', 2, ['#c8d6e6', '#9fb3c8', '#8098b0']);
pixelLabel(ui.start, 'CONTINUE ADVENTURE', 3);
pixelLabel(ui.replayBig, 'REPLAY', 3);
ui.start.disabled = true;
ui.start.addEventListener('click', () => { if (!ui.start.disabled) startFilm(0).then(() => audio.click()); });
ui.replay.addEventListener('click', () => { audio.click(); startFilm(0); });
ui.replayBig.addEventListener('click', () => { audio.click(); startFilm(0); });
ui.sound.addEventListener('click', () => { const m = !audio.muted; audio.setMuted(m); ui.sound.classList.toggle('muted', m); ui.sound.setAttribute('aria-pressed', String(m)); });
document.addEventListener('visibilitychange', () => { if (!audio || !audio.ctx) return; if (document.hidden) audio.ctx.suspend(); else audio.ctx.resume(); });
boot().catch((e) => { console.error(e); document.getElementById('err').textContent = 'Failed to load: ' + e.message; });
