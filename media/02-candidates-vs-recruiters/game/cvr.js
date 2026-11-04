// Candidates VS Recruiters: a game built only from pieces of Cali Sterium's pen sketch.
// Stage coordinates = pixels of the scanned sheet (a 2648 x 1490 band of the page); bg.jpg starts at CFG.cropX.
// Needs manifest.js (window.CVR_MANIFEST) loaded first, so it also runs from file://.
(function () {
  'use strict';

  const CFG = {
    press: { down: 0.07, hold: 0.04, up: 0.11 },        // seconds
    launchAt: 0.07,                                      // disc leaves when the button bottoms out
    reaction: [0.16, 0.42],                              // recruiter answers each APPLY after this long
    // flight path: quadratic bezier APPLY face -> REJECT face (stage coords)
    P0: [1190, 590], P1: [1350, 230], P2: [1890, 255],
    pathJitter: 45,                                      // each disc bends its arc a little differently
    scaleNear: 1.3, scaleFar: 0.6,                       // disc size at APPLY / at REJECT
    tApply: [1.4, 1.65], tReject: [0.95, 1.15],          // seconds to cross the whole path
    dropTime: 0.16,                                      // the drop shape right after launch
    boilFps: 8,                                          // cycle through the three drawn discs
    wobbleDeg: 6,
    hitDist: 0.035,                                      // discs touch when this close along the path
    burst: { pop: 0.07, hold: 0.30, fade: 0.28 },
    crumbs: [5, 8], crumbLife: [0.9, 1.5], gravity: 700,
    phrase: { in: 0.12, hold: 2.6, out: 0 },               // out 0 (Carlos, 4 Nov): the phrase cuts to nothing, no fade
    cloud: { hold: 0.5, end: 0.7 },                        // the pixel cloud around the phrase: shown 0.5 s, gone at 0.7 s
    frame: { l: 98, r: 2013, t: 26, b: 1325 },             // outer hull of the hand-drawn frame in bg.jpg (bg px, measured 4 Nov): the margin bands lie outside
    sparks: 260, glitchPx: [42, 78], glitchLife: 3, glitchSize: 2,   // margin dots per hit; coloured 2-px glitch pixels per hit (x3, Carlos), fading out over 3 s
    phraseY: 1448, phraseSize: 100, phraseColor: '#cc0000', // under the drawn frame
    intro: 'Click on the apply button to get your next job!',
    cropX: 330,                                          // bg.jpg starts this far into the sheet (narrow stage)
    applyHit: { cx: 1185, cy: 700, rx: 235, ry: 190 },   // clickable area around the APPLY button
  };

  const SND_GAIN = 0.7;                                  // Carlos, 4 Nov 2026: every sound of this work 30 % quieter
  const PHRASES = [
    'Thank you for your interest.',
    'The position has been filled.',
    "We're moving forward with other candidates.",
    'You were not selected this time.',
    'We will keep your CV on file.',
    'It was a very competitive process.',
    "Your profile doesn't match our needs.",
    "We're looking for a better fit.",
    "You're overqualified for this role.",
    "Unfortunately, we won't be proceeding.",
    'After careful consideration…',
    'This was a difficult decision.',
    'The role has been put on hold.',
    'Your application was reviewed with interest.',
    'We received an overwhelming number of applications.',
    "Please don't hesitate to apply again.",
    'We wish you success in your search.',
    'Best of luck in your future endeavours.',
    'Please do not reply to this email.',
    'This is an automated message.',
  ];

  // self-playing loop for the video: 20 clicks (one per phrase) in a human rhythm, 18 s
  const LOOP = {
    gaps: [1.0, 1.1, 0.45, 0.45, 1.3, 1.0, 0.9, 1.4, 0.5, 0.5, 0.5, 1.2, 1.0, 1.1, 0.9, 1.3, 0.6, 0.6, 1.2, 1.0],
    order: [4, 0, 16, 9, 6, 13, 1, 19, 7, 11, 3, 15, 8, 17, 2, 12, 5, 18, 10, 14],
  };
  LOOP.length = LOOP.gaps.reduce((a, b) => a + b, 0);

  // ---------- assets ----------
  // 3 Nov 2026: every picture also exists as WebP (same pixels, 2.5x lighter): try it first, fall back to the PNG/JPG
  function loadImage(src) {
    const webp = src.replace(/\.(png|jpg)$/, '.webp');
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im);
      im.onerror = () => { if (im.src.endsWith('.webp')) { im.src = src; } else rej(new Error(src)); }; im.src = webp; });
  }
  // the rejection phrase is drawn by hand + machine (4 Nov 2026): two fonts, loaded with the pictures
  function loadFonts(base) {
    if (!window.FontFace || !document.fonts) return Promise.resolve();
    const fs = [new FontFace('CVRHand', `url(${base}fonts/NothingYouCouldDo.woff2)`), new FontFace('CVRPix', `url(${base}fonts/WebPlus_IBM_VGA_8x16.woff)`)];
    return Promise.all(fs.map(f => f.load().then(l => document.fonts.add(l)).catch(() => {})));
  }
  async function loadAssets(base, bgName) {
    const man = window.CVR_MANIFEST;
    const fontsReady = loadFonts(base);
    const A = { man, img: {}, press: {} };
    const jobs = [loadImage(base + 'img/' + (bgName || 'bg.jpg')).then(i => (A.bg = i))];
    for (const n of Object.keys(man.sprites)) jobs.push(loadImage(base + 'img/' + n + '.png').then(i => (A.img[n] = i)));
    for (const [n, p] of Object.entries(man.press)) {
      A.press[n] = [];
      for (let k = 1; k < p.n; k++) jobs.push(loadImage(base + `img/press_${n}_${k}.jpg`).then(i => (A.press[n][k] = i)));
    }
    await Promise.all(jobs); await fontsReady;
    return A;
  }

  // ---------- helpers ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function bez(u, j) {
    const a = CFG.P0, c = CFG.P2, b = [CFG.P1[0] + j[0], CFG.P1[1] + j[1]], v = 1 - u;
    return [v * v * a[0] + 2 * v * u * b[0] + u * u * c[0], v * v * a[1] + 2 * v * u * b[1] + u * u * c[1]];
  }
  function pressAmount(dt) {
    const p = CFG.press;
    if (dt < 0) return 0;
    if (dt < p.down) return dt / p.down;
    if (dt < p.down + p.hold) return 1;
    if (dt < p.down + p.hold + p.up) return 1 - (dt - p.down - p.hold) / p.up;
    return 0;
  }

  // ---------- the rejection phrase, style N (Carlos, 4 Nov 2026) ----------
  // Every letter is drawn on its own: half of them by hand (CVRHand, with tilt, wobble, a double pass, scratches and a pencil
  // texture), the other half by the machine (CVRPix at hard pixels, flat gray); then each letter gets its own contrast:
  // soft, base gray, dark or plain black. The phrase is rendered once per hit, at the pixels it is shown with (PhraseArt.make).
  const PhraseArt = (() => {
    const gray = (k, a = 1) => `rgba(${Math.round(151 + (k - 158) * .97)},${Math.round(158 + (k - 158))},${Math.round(164 + (k - 158) * 1.03)},${a})`;
    const R = Math.random;
    let tile = null, tileScale = 0;
    function hatchTile(sc) {                      // pencil texture, one tile reused with random offsets
      if (tile && Math.abs(tileScale - sc) < .01) return tile;
      const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = gray(160); g.fillRect(0, 0, w, h); g.lineCap = 'round';
      for (let i = 0; i < 1400; i++) { const x = R() * w, y = R() * h, len = 70 * sc * (.5 + R()), a = -0.95 + (R() - .5) * .35;
        g.strokeStyle = gray(108 + R() * 70, .5); g.lineWidth = 2.2 * sc * (.6 + R() * .8);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke(); }
      const id = g.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const v = (R() - .5) * 18; d[i] += v; d[i + 1] += v; d[i + 2] += v; if (R() < .05) d[i + 3] = 0; }
      g.putImageData(id, 0, 0); tile = c; tileScale = sc; return c;
    }
    const pix = {};
    function pixelGlyph(ch, scale) {              // a machine letter: 16 px VGA enlarged with hard pixels
      const key = ch + '@' + scale; if (pix[key]) return pix[key];
      const t = document.createElement('canvas'); t.width = 32; t.height = 32; const g = t.getContext('2d');
      g.font = '16px CVRPix'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(ch, 16, 16);
      const adv = Math.ceil(g.measureText(ch).width);
      const o = document.createElement('canvas'); o.width = 32 * scale; o.height = 32 * scale; const og = o.getContext('2d');
      og.imageSmoothingEnabled = false; og.drawImage(t, 0, 0, o.width, o.height);
      return (pix[key] = { cv: o, adv: adv * scale });
    }
    function tone() { const r = R(); if (r < .15) return [1, true]; if (r < .5) return [.3 + R() * .45, true]; if (r < .75) return [.2 + R() * .35, false]; return [0, false]; }
    function make(text, width, height) {
      // 4 Nov (Carlos): letters 10 % bigger and allowed past the margins: the canvas is 25 % wider than the box and the text
      // may use 110 % of the box width before shrinking
      const box = width; width = Math.ceil(box * 1.25);
      const o = document.createElement('canvas'); o.width = width; o.height = Math.ceil(height); const g = o.getContext('2d');
      const sc = box / 1560, size0 = 123 * sc, tex = hatchTile(sc);
      const chars = [...text].map(ch => ({ ch, bot: ch !== ' ' && R() < .5 }));
      const m = document.createElement('canvas').getContext('2d');
      const pscale = k => Math.max(1, Math.round(6 * sc * k));
      const measure = k => { m.font = `${size0 * k}px CVRHand`; return chars.reduce((a, c) => a + (c.bot ? pixelGlyph(c.ch, pscale(k)).adv + 4 * sc : m.measureText(c.ch).width * .96), 0); };
      let k = 1, total = measure(1); const room = box * 1.1;
      if (total > room) k = room / total;
      for (let i = 0; i < 24 && (total = measure(k)) > room; i++) k *= .97;   // the pixel letters shrink in whole steps
      const size = size0 * k, ps = pscale(k); m.font = `${size}px CVRHand`;
      let x = (width - total) / 2, cy = height / 2;
      for (const c of chars) {
        let adv, L;
        if (c.bot) {
          const gl = pixelGlyph(c.ch, ps); adv = gl.adv + 4 * sc;
          L = document.createElement('canvas'); L.width = gl.cv.width + 4; L.height = gl.cv.height + 4; const lg = L.getContext('2d');
          lg.drawImage(gl.cv, 2, 2); lg.globalCompositeOperation = 'source-in'; lg.fillStyle = gray(140); lg.fillRect(0, 0, L.width, L.height); lg.globalCompositeOperation = 'source-over';
          const [tk, dark] = tone(); if (tk) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = dark ? `rgba(0,0,0,${tk})` : `rgba(255,255,255,${tk})`; lg.fillRect(0, 0, L.width, L.height); }
          g.drawImage(L, x + adv / 2 - L.width / 2, cy - L.height / 2);
        } else {
          adv = m.measureText(c.ch).width * .96;
          const bw = Math.ceil(adv + size * 1.2), bh = Math.ceil(size * 1.6);
          L = document.createElement('canvas'); L.width = bw; L.height = bh; const lg = L.getContext('2d');
          lg.font = m.font; lg.textBaseline = 'middle'; lg.textAlign = 'center';
          const rot = (R() - .5) * .16, dy = (R() - .5) * 14 * sc, s2 = 1 + (R() - .5) * .26;
          for (let p = 0; p < 3; p++) { lg.save(); lg.translate(bw / 2 + (R() - .5) * 3.5 * sc, bh / 2 + dy + (R() - .5) * 3.5 * sc); lg.rotate(rot); lg.scale(s2, s2);
            lg.globalAlpha = p ? .6 : 1; lg.fillStyle = '#000'; lg.fillText(c.ch, 0, 0); lg.restore(); }
          lg.globalCompositeOperation = 'destination-out'; lg.lineCap = 'round';
          for (let i = 0; i < 3; i++) { const sx = R() * bw, sy = bh * (.25 + R() * .5), a = -0.3 + (R() - .5) * 1.2, l = (15 + R() * 50) * sc;
            lg.lineWidth = (.8 + R() * 1.8) * sc; lg.beginPath(); lg.moveTo(sx, sy); lg.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); lg.stroke(); }
          lg.globalCompositeOperation = 'source-in';
          const ox = -Math.floor(R() * (tex.width - bw)), oy = -Math.floor(R() * Math.max(1, tex.height - bh));
          lg.drawImage(tex, ox, oy); if (bw > tex.width + ox) lg.drawImage(tex, ox + tex.width, oy);
          lg.globalCompositeOperation = 'source-over';
          const [tk, dark] = tone(); if (tk) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = dark ? `rgba(0,0,0,${tk})` : `rgba(255,255,255,${tk})`; lg.fillRect(0, 0, bw, bh); }
          g.drawImage(L, x + adv / 2 - bw / 2, cy - bh / 2);
        }
        x += adv;
      }
      return o;
    }
    // 4 Nov 2026 (Carlos): a cloud of broken pixels sprinkled around the letters, in the letters' own colours, shown with the
    // phrase for CLOUD_HOLD s and gone by CLOUD_END s. Blocks and short glitch dashes placed near random letter pixels.
    function cloud(art, box) {
      const sc = box / 1560, w = art.width, h = art.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      const d = art.getContext('2d').getImageData(0, 0, w, h).data, pts = [];
      for (let i = 0; i < d.length; i += 4 * 7) if (d[i + 3] > 120) pts.push(i >> 2);
      if (!pts.length) return c;
      const N = 170, spread = 46 * sc;
      for (let n = 0; n < N; n++) {
        const i = pts[(R() * pts.length) | 0], px = i % w, py = (i / w) | 0;
        const ang = R() * Math.PI * 2, dist = (0.25 + R() * .75) * spread * (R() < .15 ? 1.8 : 1);
        const x = px + Math.cos(ang) * dist, y = py + Math.sin(ang) * dist * .55;
        const sz = Math.max(1, Math.round((2 + R() * 4) * sc)), dash = R() < .22;
        const k = i * 4, a = .55 + R() * .45;
        g.fillStyle = `rgba(${d[k]},${d[k + 1]},${d[k + 2]},${a})`;
        g.fillRect(Math.round(x), Math.round(y), dash ? sz * (3 + (R() * 5 | 0)) : sz, dash ? Math.max(1, sz >> 1) : sz);
      }
      return c;
    }
    return { make, cloud };
  })();

  // ---------- scene ----------
  class Scene {
    // seed: random game; loop=true: every random choice depends only on the click number mod 20, so it repeats
    constructor(A, seed, loop) { this.A = A; this.loop = !!loop; this.reset(seed); }
    reset(seed) {
      this.seed = seed || 12345; this.r = rng(this.seed);
      this.t = 0; this.presses = { apply: [], reject: [] }; this.discs = []; this.bursts = []; this.crumbs = [];
      this.queue = []; this.nextK = 0; this.phrase = null; this.lastPhrase = -1; this.burstFlip = 0;
      this.sparks = []; this.glitch = [];                    // 4 Nov 2026: margin explosion + screen-glitch pixels (Carlos)
    }
    stream(k, salt) { return this.loop ? rng(this.seed + (k % 20) * 7919 + salt * 104729) : this.r; }
    jitter(r) { const J = CFG.pathJitter; return [lerp(-J, J, r()), lerp(-J, J, r())]; }

    // the candidate clicks APPLY at time t; the recruiter always answers
    apply(t, answer = true) {
      const k = this.nextK++, r = this.stream(k, 1), rr = (a, b) => lerp(a, b, r());
      this.presses.apply.push(t);
      if (!this.loop && window.AU) AU.play('apply', { gain: SND_GAIN });   // sound (4 Nov 2026): the red button is pressed
      if (!this.loop) this.glitch = [];                      // the glitch pixels live until the next APPLY
      const tA = rr(...CFG.tApply), j = this.jitter(r);
      this.at(t + CFG.launchAt, () => this.discs.push({ k, side: 'apply', born: t + CFG.launchAt, dur: tA, j }));
      if (!answer) return;
      const tr = t + rr(...CFG.reaction), tR = rr(...CFG.tReject), j2 = this.jitter(r);
      this.at(tr, () => this.presses.reject.push(tr));
      this.at(tr + CFG.launchAt, () => this.discs.push({ k: k + 0.5, side: 'reject', born: tr + CFG.launchAt, dur: tR, j: j2 }));
    }
    at(time, fn) { this.queue.push({ at: time, fn }); this.queue.sort((a, b) => a.at - b.at); }

    step(t) {
      while (this.queue.length && this.queue[0].at <= t) this.queue.shift().fn();
      this.t = t;
      for (const d of this.discs) {
        const age = t - d.born;
        d.u = d.side === 'apply' ? age / d.dur : 1 - age / d.dur;
      }
      // collisions: the leading red disc meets the leading orange disc on the path
      for (;;) {
        const reds = this.discs.filter(d => d.side === 'apply' && !d.dead);
        const oranges = this.discs.filter(d => d.side === 'reject' && !d.dead);
        if (!reds.length || !oranges.length) break;
        const R = reds.reduce((a, b) => (b.u > a.u ? b : a)), O = oranges.reduce((a, b) => (b.u < a.u ? b : a));
        if (R.u + CFG.hitDist < O.u) break;
        R.dead = O.dead = true;
        this.hit(R, O);
      }
      this.discs = this.discs.filter(d => !d.dead && d.u >= -0.05 && d.u <= 1.05);
      const B = CFG.burst;
      this.bursts = this.bursts.filter(b => t - b.born < B.pop + B.hold + B.fade);
      for (const c of this.crumbs) {
        const a = t - c.born;
        c.x = c.x0 + c.vx * a; c.y = c.y0 + c.vy * a + 0.5 * CFG.gravity * a * a;
      }
      this.crumbs = this.crumbs.filter(c => t - c.born < c.life);
      if (this.phrase && t - this.phrase.born > CFG.phrase.in + CFG.phrase.hold + CFG.phrase.out) this.phrase = null;
      if (this.sparks.length && t - this.sparks[0].born > CFG.cloud.end) this.sparks = [];
      if (this.glitch.length && t - this.glitch[0].born > CFG.glitchLife) this.glitch = [];
    }

    hit(R, O) {
      const t = this.t, u = clamp01((R.u + O.u) / 2), r = this.stream(Math.floor(R.k), 2), rr = (a, b) => lerp(a, b, r());
      const pr = bez(clamp01(R.u), R.j), po = bez(clamp01(O.u), O.j);
      const x = (pr[0] + po[0]) / 2, y = (pr[1] + po[1]) / 2, sc = lerp(CFG.scaleNear, CFG.scaleFar, u);
      const flip = this.loop ? R.k % 2 : (this.burstFlip ^= 1);
      this.bursts.push({ x, y, sc, born: t, name: flip ? 'burst_1' : 'burst_2', flip: r() < 0.5 ? -1 : 1 });
      // sound (4 Nov 2026, Carlos): the discs clash -> the next of the four pieces of Round1, then round again; a new piece cuts the last
      if (!this.loop && window.AU) { this.round = (this.round || 0) % 4 + 1; AU.play('round_' + this.round, { group: 'round', gain: SND_GAIN }); }
      const names = this.A.man.crumbs, n = Math.round(rr(...CFG.crumbs));
      for (let i = 0; i < n; i++) {
        const ang = rr(-Math.PI * 0.95, -Math.PI * 0.05), sp = rr(160, 520) * sc;
        this.crumbs.push({ name: names[Math.floor(r() * names.length)], x0: x + rr(-30, 30) * sc, y0: y + rr(-30, 30) * sc,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, born: t, life: rr(...CFG.crumbLife), sc: sc * rr(0.8, 1.15),
          rot: rr(-3, 3) });
      }
      let k;
      if (this.loop) k = LOOP.order[R.k % 20];
      else do { k = Math.floor(r() * PHRASES.length); } while (k === this.lastPhrase);
      this.lastPhrase = k; this.phrase = { text: PHRASES[k], born: t };
      if (!this.loop) this.spawnGlitch(t);
    }
    // 4 Nov 2026 (Carlos): the white margin around the drawing fills with dots of the letters' grays for the phrase's first
    // 0.5 s (gone at 0.7 s), and a few pixels in primary / secondary colours land anywhere on the picture and twinkle there
    // until the next APPLY, like a screen glitch
    spawnGlitch(t) {
      const F = CFG.frame, W = this.A.bg.width, H = this.A.bg.height, R = Math.random;
      const GRAYS = ['#111111', '#2a2a2a', '#5c6166', '#8c949a', '#a4abb0', '#c0c5c9'];
      const bands = [[0, 0, W, F.t], [0, F.b, W, H - F.b], [0, F.t, F.l, F.b - F.t], [F.r, F.t, W - F.r, F.b - F.t]];
      const area = bands.map(b => b[2] * b[3]), tot = area.reduce((a, b) => a + b, 0);
      this.sparks = [];
      for (let i = 0; i < CFG.sparks; i++) {
        let u = R() * tot, j = 0; while (u > area[j]) { u -= area[j]; j++; }
        const b = bands[j], sz = 4 + R() * 9, dash = R() < .2;
        this.sparks.push({ x: CFG.cropX + b[0] + R() * b[2], y: b[1] + R() * b[3], w: dash ? sz * (3 + R() * 4) : sz, h: dash ? sz * .5 : sz,
          c: GRAYS[(R() * GRAYS.length) | 0], a: .5 + R() * .5, born: t });
      }
      const COL = ['#ff0000', '#0000ff', '#ffff00', '#00ff00', '#ff7f00', '#8000ff', '#00ffff', '#ff00ff'];
      const n = CFG.glitchPx[0] + Math.floor(R() * (CFG.glitchPx[1] - CFG.glitchPx[0] + 1));
      for (let i = 0; i < n; i++) {                            // 4 Nov, later (Carlos): only in the white margin, 1 screen pixel, 3 s fading
        let u = R() * tot, j = 0; while (u > area[j]) { u -= area[j]; j++; }
        const b = bands[j];
        this.glitch.push({ x: CFG.cropX + b[0] + R() * b[2], y: b[1] + R() * b[3], c: COL[(R() * COL.length) | 0],
          rate: 4 + R() * 9, phase: R() * Math.PI * 2, duty: .35 + R() * .45, born: t });
      }
    }

    pressFrame(side) {
      let amt = 0;
      for (const p of this.presses[side]) amt = Math.max(amt, pressAmount(this.t - p));
      const keep = this.t - (CFG.press.down + CFG.press.hold + CFG.press.up);
      this.presses[side] = this.presses[side].filter(p => p > keep - 0.01);
      return amt;
    }

    // ---------- drawing ----------
    draw(ctx, W, H) {
      const A = this.A, s = W / A.bg.width;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(A.bg, 0, 0, W, H);
      ctx.setTransform(s, 0, 0, s, -CFG.cropX * s, 0);
      for (const side of ['reject', 'apply']) {
        const p = A.man.press[side], n = p.n - 1, k = Math.round(this.pressFrame(side) * n);
        if (k > 0) ctx.drawImage(A.press[side][k], p.x, p.y, p.w, p.h);
      }
      for (const d of [...this.discs].sort((a, b) => b.u - a.u)) this.drawDisc(ctx, d);
      for (const c of this.crumbs) this.drawCrumb(ctx, c);
      for (const b of this.bursts) this.drawBurst(ctx, b);
      this.drawSparks(ctx);
      this.drawPhrase(ctx);
      this.drawGlitch(ctx);
    }
    drawSparks(ctx) {
      if (!this.sparks.length) return;
      const C = CFG.cloud, a = this.t - this.sparks[0].born, k = a < C.hold ? 1 : a < C.end ? 1 - (a - C.hold) / (C.end - C.hold) : 0;
      if (k <= 0) return;
      for (const s of this.sparks) { ctx.globalAlpha = s.a * k; ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.w, s.h); }
      ctx.globalAlpha = 1;
    }
    drawGlitch(ctx) {
      if (!this.glitch.length) return;
      const px = CFG.glitchSize / (ctx.getTransform().a || 1);              // glitchSize screen pixels in scene units
      for (const g of this.glitch) {
        const age = this.t - g.born, fade = 1 - age / CFG.glitchLife; if (fade <= 0) continue;
        const ph = (this.t * g.rate + g.phase) % 1, on = ph < g.duty;        // blinking: on for `duty` of each cycle
        ctx.globalAlpha = (on ? 1 : .2) * fade; ctx.fillStyle = g.c; ctx.fillRect(g.x, g.y, px, px);
      }
      ctx.globalAlpha = 1;
    }
    drawDisc(ctx, d) {
      const A = this.A, age = this.t - d.born, pre = d.side === 'apply' ? '' : 'o', id = d.k % 20;
      const name = age < CFG.dropTime ? pre + 'disc_drop'
        : pre + ['disc_a', 'disc_b', 'disc_c'][(Math.floor(age * CFG.boilFps) + Math.floor(id * 7)) % 3];
      const im = A.img[name], [x, y] = bez(clamp01(d.u), d.j), sc = lerp(CFG.scaleNear, CFG.scaleFar, clamp01(d.u));
      const rot = Math.sin(age * 9 + id * 3) * CFG.wobbleDeg * Math.PI / 180;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
    }
    drawBurst(ctx, b) {
      const B = CFG.burst, a = this.t - b.born, im = this.A.img[b.name];
      const grow = a < B.pop ? lerp(0.55, 1.08, a / B.pop) : a < B.pop + 0.06 ? lerp(1.08, 1, (a - B.pop) / 0.06) : 1;
      const alpha = a < B.pop + B.hold ? 1 : 1 - (a - B.pop - B.hold) / B.fade;
      ctx.save(); ctx.globalAlpha = clamp01(alpha); ctx.translate(b.x, b.y); ctx.scale(b.sc * grow * b.flip, b.sc * grow);
      ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); ctx.globalAlpha = 1;
    }
    drawCrumb(ctx, c) {
      const a = this.t - c.born, im = this.A.img[c.name], f = a / c.life;
      ctx.save(); ctx.globalAlpha = f < 0.4 ? 1 : clamp01(1 - (f - 0.4) / 0.6);
      ctx.translate(c.x, c.y); ctx.rotate(c.rot * a); ctx.scale(c.sc, c.sc);
      ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); ctx.globalAlpha = 1;
    }
    drawPhrase(ctx) {
      if (!this.phrase) return;
      const P = CFG.phrase, a = this.t - this.phrase.born;
      const alpha = a < P.in ? a / P.in : a < P.in + P.hold ? 1 : P.out > 0 ? 1 - (a - P.in - P.hold) / P.out : 0;
      const s = ctx.getTransform().a || 1, ph = this.phrase, W0 = this.A.bg.width - 120, H0 = W0 * 150 / 1560, wpx = W0 * s;
      if (!ph.art || Math.abs(ph.artW - wpx) > 1) { ph.art = PhraseArt.make(ph.text, wpx, H0 * s); ph.cloud = PhraseArt.cloud(ph.art, wpx); ph.artW = wpx; }
      const x0 = CFG.cropX + 60 - W0 * 0.125, y0 = CFG.phraseY - 40 - H0 / 2, Wd = W0 * 1.25;   // the art canvas is 25 % wider than the box
      ctx.save();
      const C = CFG.cloud, ca = a < C.hold ? 1 : a < C.end ? 1 - (a - C.hold) / (C.end - C.hold) : 0;
      if (ca > 0) { ctx.globalAlpha = ca; ctx.drawImage(ph.cloud, x0, y0, Wd, H0); }
      ctx.globalAlpha = clamp01(alpha);
      ctx.drawImage(ph.art, x0, y0, Wd, H0);
      ctx.restore();
    }

    // start screen: the drawing under a white veil, APPLY left clear, the invitation on top
    drawIntro(ctx, W, H) {
      const A = this.A, s = W / A.bg.width, h = CFG.applyHit;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(A.bg, 0, 0, W, H);
      ctx.setTransform(s, 0, 0, s, -CFG.cropX * s, 0);
      ctx.save();
      ctx.beginPath(); ctx.rect(CFG.cropX, 0, A.bg.width, A.bg.height);
      ctx.ellipse(h.cx, h.cy - 20, h.rx + 20, h.ry, 0, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.fill('evenodd');
      ctx.restore();
      ctx.save();
      ctx.font = 'bold 92px Arial, Helvetica, sans-serif'; ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.fillText(CFG.intro, CFG.cropX + A.bg.width / 2, 250, A.bg.width - 160);
      ctx.restore();
    }

    // is a stage point (bg.jpg pixels) on the APPLY button?
    onApply(x, y) {
      const h = CFG.applyHit; x += CFG.cropX;
      return ((x - h.cx) / h.rx) ** 2 + ((y - h.cy) / h.ry) ** 2 <= 1;
    }
  }

  // scripted scene at time t of the loop (after one full warm-up loop, so it starts mid-stream and repeats exactly)
  function loopSceneAt(A, t) {
    const S = new Scene(A, 777, true), T = LOOP.length + t;
    const offsets = []; let o = 0;
    for (const g of LOOP.gaps) { offsets.push(o); o += g; }          // clicks at 0, 1.0, 2.1, ... in each loop
    for (let n = 0; n < 3; n++) for (const off of offsets) S.apply(n * LOOP.length + off);
    for (let x = 0; x < T; x += 1 / 120) S.step(x);
    S.step(T);
    return S;
  }

  // playable game on a canvas; keys=true also lets the space bar apply
  async function mountGame(cv, base, keys) {
    const ctx = cv.getContext('2d');
    if (window.AU) AU.load(base + '../sound/', ['apply', 'round_1', 'round_2', 'round_3', 'round_4']);   // media/<work>/sound/, ~65 KB, fetched when the work opens
    const A = await loadAssets(base);
    function fit() {
      const w = Math.min(Math.round(cv.getBoundingClientRect().width * (window.devicePixelRatio || 1)), A.bg.width);
      if (w > 0 && cv.width !== w) { cv.width = w; cv.height = Math.round(w * A.bg.height / A.bg.width); }
    }
    fit(); addEventListener('resize', fit);
    const S = new Scene(A, (Math.random() * 1e9) | 0);
    let started = false;
    const t0 = performance.now(), now = () => (performance.now() - t0) / 1000;
    function stagePoint(e) {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * A.bg.width, (e.clientY - r.top) / r.height * A.bg.height];
    }
    cv.addEventListener('pointerdown', e => { if (window.AU) AU.unlock(); const [x, y] = stagePoint(e); if (S.onApply(x, y)) { started = true; S.apply(now()); e.preventDefault(); } });
    window.__cvr = { S, now };                                            // for tests
    cv.addEventListener('pointermove', e => { const [x, y] = stagePoint(e); cv.style.cursor = S.onApply(x, y) ? 'pointer' : 'default'; });
    if (keys) addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) { started = true; S.apply(now()); e.preventDefault(); } });
    (function frame() {
      if (started) { S.step(now()); S.draw(ctx, cv.width, cv.height); } else S.drawIntro(ctx, cv.width, cv.height);
      requestAnimationFrame(frame);
    })();
  }

  window.CVR = { CFG, PHRASES, LOOP, loadAssets, Scene, bez, loopSceneAt, mountGame };
})();
