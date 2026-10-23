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
    phrase: { in: 0.12, hold: 2.6, out: 0.5 },
    phraseY: 1448, phraseSize: 100, phraseColor: '#cc0000', // under the drawn frame
    intro: 'Click on the apply button to get your next job!',
    cropX: 330,                                          // bg.jpg starts this far into the sheet (narrow stage)
    applyHit: { cx: 1185, cy: 700, rx: 235, ry: 190 },   // clickable area around the APPLY button
  };

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
  function loadImage(src) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  }
  async function loadAssets(base, bgName) {
    const man = window.CVR_MANIFEST;
    const A = { man, img: {}, press: {} };
    const jobs = [loadImage(base + 'img/' + (bgName || 'bg.jpg')).then(i => (A.bg = i))];
    for (const n of Object.keys(man.sprites)) jobs.push(loadImage(base + 'img/' + n + '.png').then(i => (A.img[n] = i)));
    for (const [n, p] of Object.entries(man.press)) {
      A.press[n] = [];
      for (let k = 1; k < p.n; k++) jobs.push(loadImage(base + `img/press_${n}_${k}.jpg`).then(i => (A.press[n][k] = i)));
    }
    await Promise.all(jobs);
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

  // ---------- scene ----------
  class Scene {
    // seed: random game; loop=true: every random choice depends only on the click number mod 20, so it repeats
    constructor(A, seed, loop) { this.A = A; this.loop = !!loop; this.reset(seed); }
    reset(seed) {
      this.seed = seed || 12345; this.r = rng(this.seed);
      this.t = 0; this.presses = { apply: [], reject: [] }; this.discs = []; this.bursts = []; this.crumbs = [];
      this.queue = []; this.nextK = 0; this.phrase = null; this.lastPhrase = -1; this.burstFlip = 0;
    }
    stream(k, salt) { return this.loop ? rng(this.seed + (k % 20) * 7919 + salt * 104729) : this.r; }
    jitter(r) { const J = CFG.pathJitter; return [lerp(-J, J, r()), lerp(-J, J, r())]; }

    // the candidate clicks APPLY at time t; the recruiter always answers
    apply(t, answer = true) {
      const k = this.nextK++, r = this.stream(k, 1), rr = (a, b) => lerp(a, b, r());
      this.presses.apply.push(t);
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
    }

    hit(R, O) {
      const t = this.t, u = clamp01((R.u + O.u) / 2), r = this.stream(Math.floor(R.k), 2), rr = (a, b) => lerp(a, b, r());
      const pr = bez(clamp01(R.u), R.j), po = bez(clamp01(O.u), O.j);
      const x = (pr[0] + po[0]) / 2, y = (pr[1] + po[1]) / 2, sc = lerp(CFG.scaleNear, CFG.scaleFar, u);
      const flip = this.loop ? R.k % 2 : (this.burstFlip ^= 1);
      this.bursts.push({ x, y, sc, born: t, name: flip ? 'burst_1' : 'burst_2', flip: r() < 0.5 ? -1 : 1 });
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
      this.drawPhrase(ctx);
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
      const alpha = a < P.in ? a / P.in : a < P.in + P.hold ? 1 : 1 - (a - P.in - P.hold) / P.out;
      ctx.save(); ctx.globalAlpha = clamp01(alpha);
      ctx.font = `${CFG.phraseSize}px Arial, Helvetica, sans-serif`; ctx.fillStyle = CFG.phraseColor; ctx.textAlign = 'center';
      ctx.fillText(this.phrase.text, CFG.cropX + this.A.bg.width / 2, CFG.phraseY, this.A.bg.width - 120);
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
    const ctx = cv.getContext('2d'), A = await loadAssets(base);
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
    cv.addEventListener('pointerdown', e => { const [x, y] = stagePoint(e); if (S.onApply(x, y)) { started = true; S.apply(now()); e.preventDefault(); } });
    cv.addEventListener('pointermove', e => { const [x, y] = stagePoint(e); cv.style.cursor = S.onApply(x, y) ? 'pointer' : 'default'; });
    if (keys) addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) { started = true; S.apply(now()); e.preventDefault(); } });
    (function frame() {
      if (started) { S.step(now()); S.draw(ctx, cv.width, cv.height); } else S.drawIntro(ctx, cv.width, cv.height);
      requestAnimationFrame(frame);
    })();
  }

  window.CVR = { CFG, PHRASES, LOOP, loadAssets, Scene, bez, loopSceneAt, mountGame };
})();
