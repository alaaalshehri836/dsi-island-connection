// Part 2 renderer: Part 1's renderer + a ground shader for the archipelago
// (island styles, shared-bridge network glowing on the water).
import { Renderer } from '../renderer.js';
import { MAP2, BYID, BRIDGES, PORTAL2 } from './world2.js';
import { hash2, BAYER4, angDiff, lerp } from '../util.js';
import { WORLD } from '../world.js';

const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const C = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// identical palette family to Part 1
const WATER = ['#0a4170', '#0d5f8f', '#127fa4', '#1aa4b0', '#36c6bf', '#6fe2d0'].map(C);
const FOAM = C('#f2fbf6'), FOAM2 = C('#c4f2e8'), WAVEHI = C('#b9f3ec'), GLINT = C('#fff3c2');
const WET = [C('#ad8d5e'), C('#9c7e52')], SAND = [C('#f2dcaa'), C('#e9cd95'), C('#dcbd82')], SPECK = C('#c7a46c');
const GRASS = [C('#6aa244'), C('#558e38'), C('#43772f')];
const STONE = [C('#9696a6'), C('#80809a'), C('#6a6a84'), C('#45455c')], RUNE = C('#6ed6ff');
const PAVE = [C('#d8dde0'), C('#c4cacf'), C('#aab2b8')], SANDST = [C('#cdb68a'), C('#bca278'), C('#a88e66')];
const TECH = [C('#1c2a44'), C('#22324f'), C('#2a3c5c')], TECHLINE = C('#3cd0e0'), TECHDIM = C('#1d5a6a');
const BR_CORE = C('#c8fbff'), BR_MID = C('#5fd0ff'), BR_EDGE = C('#2f7cf0');

export class Renderer2 extends Renderer {
  drawGround(st) {
    if (st.world !== 2) return super.drawGround(st);
    const { VW, VH, buf } = this; const c = this.cam; const t = st.t;
    const hy = this.hy, F = c.F;
    const map = MAP2.d, idm = MAP2.id, mn = MAP2.min, cell = MAP2.cell, N = MAP2.n;
    const fogD = st.fog || 5200, haze = st.haze || [190, 226, 236];
    const sunAz = WORLD.sun.az, sunEl = WORLD.sun.el;
    const skyTop = [56, 118, 204], skyMid = [104, 178, 230], skyHor = [200, 234, 240], sunCol = [255, 230, 170];
    const bridges = st.bridges || [];      // [{...BRIDGES[i], p: 0..1}]
    const lit = st.islandLit || {};        // id -> 0..1 (systems understood / online)
    const hubGlow = st.hubGlow || 0;
    const colAz = new Float32Array(VW);
    for (let x = 0; x < VW; x++) colAz[x] = c.yaw + Math.atan((x + 0.5 - VW / 2) / F);
    for (let y = 0; y < VH; y++) {
      const row = y * VW, by = (y & 3) * 4;
      if (y + 0.5 < hy + 0.5) {
        const el = (hy - y - 0.5) / F;
        for (let x = 0; x < VW; x++) {
          const b = BAYER4[by + (x & 3)], e = el + (b - 0.5) * 0.035;
          let r, g, bl;
          if (e < 0.12) { const k = e / 0.12; r = lerp(skyHor[0], skyMid[0], k); g = lerp(skyHor[1], skyMid[1], k); bl = lerp(skyHor[2], skyMid[2], k); }
          else { const k = Math.min(1, (e - 0.12) / 0.6); r = lerp(skyMid[0], skyTop[0], k); g = lerp(skyMid[1], skyTop[1], k); bl = lerp(skyMid[2], skyTop[2], k); }
          const da = angDiff(colAz[x], sunAz), de = el - sunEl, sd = da * da + de * de;
          if (sd < 0.5) { const k = 1 - sd / 0.5, kk = k * k * 0.55; r = lerp(r, sunCol[0], kk); g = lerp(g, sunCol[1], kk); bl = lerp(bl, sunCol[2], kk); }
          buf[row + x] = pack((r >> 3) << 3, (g >> 3) << 3, (bl >> 3) << 3);
        }
        continue;
      }
      const depth = (c.h * F) / (y + 0.5 - hy);
      const wx0 = c.x + this.fx * depth, wz0 = c.z + this.fz * depth, step = depth / F;
      let fog = depth / (depth + fogD); fog = fog * fog;
      const far = depth > 2600;
      for (let x = 0; x < VW; x++) {
        const lat = (x + 0.5 - VW / 2) * step;
        const X = wx0 + this.rx * lat, Z = wz0 + this.rz * lat;
        const ix = Math.floor(X), iz = Math.floor(Z), hsh = hash2(ix, iz);
        const mi = Math.floor((X - mn) / cell), mj = Math.floor((Z - mn) / cell);
        const inMap = mi >= 0 && mj >= 0 && mi < N && mj < N;
        let d = inMap ? map[mj * N + mi] : -3000;
        const iid = inMap ? idm[mj * N + mi] : 0;
        d += (hsh - 0.5) * 6;
        const b = BAYER4[by + (x & 3)];
        let col;
        if (d < 0) {
          const dd = -d, wv = Math.sin(X * 0.021 + Z * 0.006 + t * 0.9) * 18;
          const q = dd + wv * 0.4 + (b - 0.5) * 22;
          col = WATER[q < 14 ? 5 : q < 45 ? 4 : q < 140 ? 3 : q < 380 ? 2 : q < 900 ? 1 : 0];
          const run = -14 + 11 * Math.sin(t * 1.4 + (X + Z) * 0.004);
          if (d > run - 4) col = FOAM;
          else if (d > run - 8 && hsh > 0.35) col = FOAM2;
          else if (!far) {
            const w = Math.sin(X * 0.05 + Z * 0.013 + t * 1.25) + 0.75 * Math.sin(Z * 0.093 - X * 0.021 - t * 0.85) + 0.4 * Math.sin((X + Z) * 0.2 + t * 2.2);
            if (w > 1.62 && hsh > 0.3) col = WAVEHI;
            const da = angDiff(colAz[x], sunAz);
            if (da * da < 0.08 && depth > 120) { const gg = hash2(Math.floor(X / 3), Math.floor(Z / 3) + Math.floor(t * 7) * 7919); if (gg > 0.86 + da * da * 1.2) col = GLINT; }
          }
        } else {
          const isl = BYID[iid];
          if (d < 12) col = WET[hsh > 0.5 ? 1 : 0];
          else if (d < 58 + (hsh - 0.5) * 16) { col = SAND[(hsh * 3) | 0]; if (hsh > 0.985) col = SPECK; }
          else {
            col = GRASS[(hsh * 3) | 0];
            const lx = X - isl.x, lz = Z - isl.z, lr = Math.sqrt(lx * lx + lz * lz);
            if (isl.id === 0) {
              if (lr < 92) {
                if (lr > 88) col = STONE[3];
                else if (Math.abs(lr - 70) < 2.2) col = (Math.sin(Math.atan2(lz, lx) * 24) > 0.2) ? RUNE : STONE[2];
                else {
                  const gx = ((X + 2000) % 16), gz = ((Z + 2000) % 16);
                  col = (gx < 1.2 || gz < 1.2) ? STONE[3] : STONE[(hash2(Math.floor((X + 2000) / 16), Math.floor((Z + 2000) / 16)) * 3) | 0];
                }
              }
            } else if (lr < 165) {
              const L = lit[isl.id] || 0;
              if (isl.ground === 'pave') { const gx = (X + 2000) % 12, gz = (Z + 2000) % 12; col = (gx < 1 || gz < 1) ? PAVE[2] : PAVE[(hsh * 2) | 0]; }
              else if (isl.ground === 'sandstone') { const gx = (X + 2000) % 14, gz = (Z + 2000 + (Math.floor((X + 2000) / 14) % 2) * 7) % 14; col = (gx < 1.2 || gz < 1.2) ? SANDST[2] : SANDST[(hsh * 2) | 0]; }
              else if (isl.ground === 'tech') {
                const gx = (X + 2000) % 20, gz = (Z + 2000) % 20;
                col = (gx < 1.3 || gz < 1.3) ? (((Math.floor((X + Z) * 0.05 - t * 3)) & 7) === 0 || L > 0.5 ? TECHLINE : TECHDIM) : TECH[(hsh * 3) | 0];
              } else {
                // university lawn with stone walkways forming a cross
                if (Math.abs(lx) < 9 || Math.abs(lz) < 9) col = PAVE[(hsh * 3) | 0];
              }
            }
          }
        }
        let r = col[0], g = col[1], bb = col[2];
        // shared-network bridges glowing on the water
        if (bridges.length && d < 40) {
          for (let k = 0; k < bridges.length; k++) {
            const br = bridges[k]; if (br.p <= 0) continue;
            const ux = (br.x1 - br.x0) / br.len, uz = (br.z1 - br.z0) / br.len;
            const px = X - br.x0, pz = Z - br.z0;
            const s = px * ux + pz * uz;
            if (s < 0 || s > br.len * br.p) continue;
            const off = Math.abs(px * -uz + pz * ux);
            if (off > 16) continue;
            const pulse = ((s * 0.02 - t * 1.6) % 1 + 1) % 1;
            const head = br.len * br.p - s < 18 && br.p < 1;
            const cc = head ? BR_CORE : off < 4 ? (pulse < 0.18 ? BR_CORE : BR_MID) : off < 10 ? (((s + 2000) % 14) < 3 ? BR_MID : BR_EDGE) : null;
            if (cc) { r = cc[0]; g = cc[1]; bb = cc[2]; }
            else { r = lerp(r, 95, 0.45); g = lerp(g, 200, 0.45); bb = lerp(bb, 255, 0.45); }
            break;
          }
        }
        // portal light on the hub plaza
        if (hubGlow > 0) {
          const qx = X - PORTAL2.x, qz = Z - PORTAL2.z, pd = Math.sqrt(qx * qx + qz * qz);
          if (pd < 260) { let k = (1 - pd / 260) ** 2 * hubGlow + (b - 0.5) * 0.1; if (k > 0.02) { r = lerp(r, 120, k * 0.7); g = lerp(g, 214, k * 0.75); bb = lerp(bb, 255, k * 0.85); } }
        }
        const f = fog + (b - 0.5) * 0.06;
        if (f > 0.01) { r = lerp(r, haze[0], f); g = lerp(g, haze[1], f); bb = lerp(bb, haze[2], f); }
        buf[row + x] = pack(r | 0, g | 0, bb | 0);
      }
    }
    this.lctx.putImageData(this.img, 0, 0);
    this.ctx.drawImage(this.low, 0, 0, this.VW, this.VH, this.offX, this.offY, this.VW * this.s, this.VH * this.s);
  }
}
