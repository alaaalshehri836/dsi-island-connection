// ============================================================================
// DSI Island — Part 2 world: the archipelago beyond the portal.
// Same units and conventions as Part 1 (1 unit = 1 sprite px; +X east, +Z north).
// A hub island (where the explorer arrives) sits in the middle of four
// separate islands — four independent "systems".
// ============================================================================
import { mulberry32 } from '../util.js';

export const HUB = { id: 0, x: 0, z: 0, r: 250, name: 'HUB' };
export const ISLANDS = [
  { id: 1, key: 'univ', name: 'UNIVERSITY', badge: 'badge_cap', x: 600, z: 600, r: 300, bs: 3.0, ground: 'grass' },
  { id: 2, key: 'hosp', name: 'HOSPITAL', badge: 'badge_cross', x: 600, z: -600, r: 300, bs: 3.0, ground: 'pave' },
  { id: 3, key: 'lib', name: 'LIBRARY', badge: 'badge_book', x: -600, z: -600, r: 300, bs: 3.0, ground: 'sandstone' },
  { id: 4, key: 'datac', name: 'DATA CENTER', badge: 'badge_db', x: -600, z: 600, r: 300, bs: 3.0, ground: 'tech', anim: true },
];
export const ALL = [HUB, ...ISLANDS];
export const PORTAL2 = { x: -70, z: 0, scale: 1.5 };   // exit side of the same portal, faces EAST
export const BYID = Object.fromEntries(ALL.map((i) => [i.id, i]));

// receiver beacons: on each island's shore, facing a neighbour
export function beaconPos(isl, toward) {
  const dx = toward.x - isl.x, dz = toward.z - isl.z, d = Math.hypot(dx, dz);
  return { x: isl.x + (dx / d) * (isl.r - 70), z: isl.z + (dz / d) * (isl.r - 70) };
}
// bridges: hub spokes first, then the outer ring
export const BRIDGES = [
  [0, 2], [0, 1], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1],
].map(([a, b]) => {
  const A = BYID[a], Bb = BYID[b];
  const pa = beaconPos(A, Bb), pb = beaconPos(Bb, A);
  return { a, b, x0: pa.x, z0: pa.z, x1: pb.x, z1: pb.z, len: Math.hypot(pb.x - pa.x, pb.z - pa.z) };
});

function islandRadius(isl, th) {
  return isl.r + 22 * Math.sin(3 * th + isl.id) + 14 * Math.sin(7 * th + isl.id * 2) + 8 * Math.sin(13 * th);
}
export function islandDist(x, z) {
  let best = -1e9, id = -1;
  for (const isl of ALL) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = islandRadius(isl, Math.atan2(dz, dx)) - Math.hypot(dx, dz);
    if (d > best) { best = d; id = isl.id; }
  }
  return { d: best, id };
}

export const MAP2 = { min: -1700, cell: 4, n: 850, d: null, id: null };
export function buildMap2() {
  const { min, cell, n } = MAP2;
  const d = new Float32Array(n * n), id = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = min + (j + 0.5) * cell;
    for (let i = 0; i < n; i++) {
      const r = islandDist(min + (i + 0.5) * cell, z);
      d[j * n + i] = r.d; id[j * n + i] = r.id;
    }
  }
  MAP2.d = d; MAP2.id = id;
}

export function buildObjects2() {
  const rnd = mulberry32(2027);
  const objs = [];
  // palms + plants around each island rim (keeping the building area & beacons clear)
  for (const isl of ALL) {
    const n = isl.id === 0 ? 34 : 30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.15;
      const rr = islandRadius(isl, a) - 70 - rnd() * 50;
      const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
      // keep beacons / bridge landings and the arrival line clear
      let clear = true;
      for (const b of BRIDGES) for (const [bx, bz] of [[b.x0, b.z0], [b.x1, b.z1]]) if (Math.hypot(x - bx, z - bz) < 70) clear = false;
      if (isl.id === 0 && Math.abs(z) < 120 && x > -120) clear = false;
      if (isl.id === 0 && a > Math.PI * 0.8 && a < Math.PI * 1.85) clear = false;     // keep the rising establishing camera clear
      if (isl.id !== 0) {                                                             // keep the reveal cameras' view of each building clear
        const camA = Math.atan2(-isl.z, -isl.x) + 0.35;
        let dA = Math.abs(((a - camA) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (dA < 0.55) clear = false;
      }
      if (!clear) continue;
      if (rnd() < 0.62) objs.push({ spr: 'palm' + Math.floor(rnd() * 4), anim: { frames: 6, fps: 4 + rnd() * 2, off: rnd() * 6 }, x, z, s: 1.0 + rnd() * 0.35, flip: rnd() < 0.5, kind: 'palm' });
      else objs.push({ spr: ['bush0', 'bush1', 'fern1', 'fernflower', 'monstera0', 'rock0'][Math.floor(rnd() * 6)], x, z, s: 1.0 + rnd() * 0.5, flip: rnd() < 0.5, kind: 'plant' });
    }
  }
  // buildings, badges, beacons
  for (const isl of ISLANDS) {
    objs.push({ spr: isl.key, anim: isl.anim ? { frames: 2, fps: 3, off: 0 } : null, x: isl.x, z: isl.z, s: isl.bs, kind: 'building', isl: isl.id });
  }
  // hub: ruins + rune stones around the plaza (same ancient style as Part 1)
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.5 + i * (Math.PI / 3) + 0.3;
    objs.push({ spr: i % 2 ? 'pillar1' : 'pillar0', x: Math.cos(a) * 118, z: Math.sin(a) * 118, s: 1.3, kind: 'prop', flip: i % 2 === 0 });
  }
  return objs;
}
export const BEACONS = (() => {
  const list = [];
  for (const br of BRIDGES) { list.push({ x: br.x0, z: br.z0, isl: br.a, br }); list.push({ x: br.x1, z: br.z1, isl: br.b, br }); }
  // de-duplicate per island/position
  const seen = new Set();
  return list.filter((b) => { const k = Math.round(b.x) + ',' + Math.round(b.z); if (seen.has(k)) return false; seen.add(k); return b.isl !== 0; });
})();
