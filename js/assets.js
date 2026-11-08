// Asset loading (sprite atlases + audio). Everything is preloaded before START.
// base: path prefix to the site root (Part 1 = '', Part 2 lives in /part2/ and passes '../')
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + src)); i.src = src; });
}
const loadJSON = (src) => fetch(src).then((r) => { if (!r.ok) throw new Error(src); return r.json(); });

export class Assets {
  constructor(base = '') { this.base = base; }
  // extras: names of additional atlases in assets/sprites/ (e.g. 'part2_atlas'), merged into env()
  async load(onProgress = () => {}, extras = []) {
    const SPR = this.base + 'assets/sprites/';
    const jobs = [
      loadImage(SPR + 'environment_atlas.png'), loadJSON(SPR + 'environment_atlas.json'),
      loadImage(SPR + 'explorer_sheet.png'), loadJSON(SPR + 'explorer_sheet.json'),
      loadImage(SPR + 'explorer_portraits.png'), loadJSON(SPR + 'explorer_portraits.json'),
    ];
    for (const x of extras) jobs.push(loadImage(SPR + x + '.png'), loadJSON(SPR + x + '.json'));
    let done = 0;
    jobs.forEach((p) => p.then(() => onProgress(++done / jobs.length)));
    const [envImg, envMeta, chImg, chMeta, pImg, pMeta, ...ex] = await Promise.all(jobs);
    this.envImg = envImg; this.envMeta = envMeta; this.chImg = chImg; this.chMeta = chMeta; this.pImg = pImg; this.pMeta = pMeta;
    this._env = {};
    for (const [k, m] of Object.entries(envMeta)) this._env[k] = { img: envImg, x: m.x, y: m.y, w: m.w, h: m.h, ax: m.ax, ay: m.ay };
    for (let i = 0; i < ex.length; i += 2)
      for (const [k, m] of Object.entries(ex[i + 1])) this._env[k] = { img: ex[i], x: m.x, y: m.y, w: m.w, h: m.h, ax: m.ax, ay: m.ay };
    // explicit anchors
    if (this._env.portal) { this._env.portal.ay = 87; this._env.portal_runes.ay = 87; }
  }
  env(k) { return this._env[k]; }
  // explorer frame from the unified sprite sheet
  char(variant, anim, frame, dir) {
    const m = this.chMeta, a = m.variants[variant][anim];
    const f = ((frame % a.frames) + a.frames) % a.frames;
    const [cw, ch] = m.cell;
    return { img: this.chImg, x: dir * cw, y: (a.row + f) * ch, w: cw, h: ch, ax: m.anchor[0], ay: m.anchor[1] };
  }
  portrait(name) {
    const [w, h] = this.pMeta.cell, i = this.pMeta.frames[name];
    return { img: this.pImg, x: i * w, y: 0, w, h, ax: w / 2, ay: h };
  }
}
