// MATCH CATCH (work 07) - scene, symbols and papers. Plain canvas 2D, no build step.
// All coordinates are in the units of Carlos' sketches: a 2690 x 3626 canvas.
(function (root) {
  'use strict';

  const W = 2690, H = 3626;

  // ---------------------------------------------------------------- config
  const CFG = {
    fontHand: 'MCHand',          // paper + buttons
    fontScreen: 'MCScreen',      // score / faults inside the TV
    // black glass of the TV: candidates only travel here
    glass: { x: 468, y: 250, w: 1876, h: 2372 },
    lanes: 3,
    buttons: { x: 557, y: 2414, s: 0.75, rowH: 545,
               cuts: [0, 748, 1530, 2297],
               // pressed drawing moved so that its blue base sits exactly on the base of the unpressed one
               onShift: [{ x: -12, y: -515 }, { x: -6, y: -481 }, { x: -5, y: -480 }],
               // centre of the red front face of each button (strip coordinates), off state
               face: [{ x: 395, y: 262, w: 470 }, { x: 1135, y: 262, w: 520 }, { x: 1868, y: 228, w: 450 }] },
    paper: { x: 1020, y: 2822, s: 0.98 },
    recruiter: { x: 1131, y: 3094, s: 0.47 },
    shoulder: { x: 1690, y: 3640 },      // the sleeve starts at the bottom margin
    armReach: { w: 0.85, y: 215, dx: [0, 0, 0] },   // where the fingertips land on a button (strip coordinates)
    armIdle: { img: 'arm_supersmall', rot: 7, s: 0.85 },
    candidate: { w: 497, h: 549, torsoY: 432, symSize: 74, symGap: 14 },
    field: '#6e9d79',            // flat green behind everything
    hudBand: '#08071c', hudH: 186,
    titleInk: '#474747',         // JOB DESCRIPTION, slightly grey
    ink: '#111111'
  };

  // ---------------------------------------------------------------- symbols
  // 12 marks, each drawn inside a box of side 1 centred on (0,0), thick round strokes.
  const P = Math.PI;
  const SYMBOLS = [
    { id: 'ring',     draw: c => { c.arc(0, 0, 0.40, 0, 2 * P); } },
    { id: 'square',   draw: c => { c.rect(-0.37, -0.37, 0.74, 0.74); } },
    { id: 'rhombus',  draw: c => { poly(c, [[0, -0.46], [0.40, 0], [0, 0.46], [-0.40, 0]], true); } },
    { id: 'triangle', draw: c => { poly(c, [[0, -0.42], [0.44, 0.36], [-0.44, 0.36]], true); } },
    { id: 'plus',     draw: c => { line(c, 0, -0.44, 0, 0.44); line(c, -0.44, 0, 0.44, 0); } },
    { id: 'cross',    draw: c => { line(c, -0.36, -0.36, 0.36, 0.36); line(c, 0.36, -0.36, -0.36, 0.36); } },
    { id: 'asterisk', draw: c => { for (let i = 0; i < 3; i++) { const a = i * P / 3 + P / 2; line(c, Math.cos(a) * 0.44, Math.sin(a) * 0.44, -Math.cos(a) * 0.44, -Math.sin(a) * 0.44); } } },
    { id: 'hash',     draw: c => { line(c, -0.16, -0.44, -0.24, 0.44); line(c, 0.24, -0.44, 0.16, 0.44); line(c, -0.44, -0.17, 0.44, -0.17); line(c, -0.44, 0.19, 0.44, 0.19); } },
    { id: 'zigzag',   draw: c => { poly(c, [[-0.44, 0.22], [-0.22, -0.26], [0, 0.22], [0.22, -0.26], [0.44, 0.22]], false); } },
    { id: 'spiral',   draw: c => { for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * 3.6 * P, r = 0.05 + t * 0.39; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? c.lineTo(x, y) : c.moveTo(x, y); } } },
    { id: 'moon',     draw: c => { c.arc(0.02, 0, 0.42, 0.28 * P, 1.72 * P); c.quadraticCurveTo(-0.16, 0, 0.02 + Math.cos(0.28 * P) * 0.42, Math.sin(0.28 * P) * 0.42); } },
    { id: 'bars',     draw: c => { line(c, -0.42, -0.30, 0.42, -0.30); line(c, -0.42, 0, 0.42, 0); line(c, -0.42, 0.30, 0.42, 0.30); } }
  ];
  function line(c, x0, y0, x1, y1) { c.moveTo(x0, y0); c.lineTo(x1, y1); }
  function poly(c, pts, close) { pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (close) c.closePath(); }

  function drawSymbol(ctx, i, cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(size, size);
    ctx.beginPath(); SYMBOLS[i].draw(ctx);
    ctx.lineWidth = 0.15; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color || CFG.ink; ctx.stroke();
    ctx.restore();
  }
  function drawSymbolRow(ctx, code, cx, cy, size, gap, color) {
    const total = code.length * size + (code.length - 1) * gap;
    code.forEach((s, k) => drawSymbol(ctx, s, cx - total / 2 + size / 2 + k * (size + gap), cy, size, color));
  }

  // ---------------------------------------------------------------- papers
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // 20 papers of 5 different symbols; any two papers differ in at least 3 places.
  function makePapers(seed) {
    const r = rng(seed), out = [];
    let guard = 0;
    while (out.length < 20 && guard++ < 100000) {
      const pool = SYMBOLS.map((_, i) => i), code = [];
      for (let k = 0; k < 5; k++) code.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
      if (out.every(o => o.filter((s, k) => s !== code[k]).length >= 3)) out.push(code);
    }
    return out;
  }
  const PAPERS = makePapers(7);
  // a wrong candidate: the paper's code with one or two symbols changed
  function decoy(code, r) {
    const d = code.slice(), n = r() < 0.5 ? 1 : 2, places = [0, 1, 2, 3, 4];
    for (let k = 0; k < n; k++) {
      const at = places.splice(Math.floor(r() * places.length), 1)[0];
      let s; do { s = Math.floor(r() * SYMBOLS.length); } while (s === code[at] || d.includes(s));
      d[at] = s;
    }
    return d;
  }

  // ---------------------------------------------------------------- assets
  const NAMES = ['mass_green', 'mass_purple', 'art_top', 'art_top_inv', 'recruiter_front', 'tv', 'buttons', 'candidate', 'paper', 'hand_green', 'recruiter_back',
                 'arm_long', 'arm_middle', 'arm_small', 'arm_supersmall'];
  const IMG = {};
  function load(base) {
    const imgs = NAMES.map(n => new Promise((ok, no) => { const i = new Image(); i.onload = () => { IMG[n] = i; ok(); }; i.onerror = () => no(new Error('missing ' + n)); i.src = (base || 'img/') + n + (root.MC_IMG_EXT || '.png'); }));
    // a font that fails or is slow must not stop the game: wait for it 4 seconds at most
    const soon = p => Promise.race([Promise.resolve(p).catch(() => {}), new Promise(ok => setTimeout(ok, 4000))]);
    const fonts = document.fonts ? [soon(document.fonts.load('100px ' + CFG.fontHand)), soon(document.fonts.load('100px ' + CFG.fontScreen))] : [];
    return Promise.all(imgs.concat(fonts));
  }

  // image drawn so that its pixel (ax, ay) lands on (x, y), scaled, rotated (degrees), optionally mirrored
  function sprite(ctx, img, ax, ay, x, y, s, rot, flip, sy) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((rot || 0) * P / 180); ctx.scale(flip ? -s : s, sy || s);
    ctx.drawImage(img, -ax, -ay); ctx.restore();
  }

  // The five pictures as big as the whole sketch (tv, mass and the lines on top, green and purple) are kept ready at the
  // size they are shown: scaling a 2690 x 3626 picture down on every frame was most of the work of a paint. The copy is
  // made with the same scale on the same pixel grid, so the picture is the same. (Canvases drawn 1:1, as frame5.html, skip this.)
  const fitted = {};
  function whole(ctx, name) {
    const m = ctx.getTransform ? ctx.getTransform() : null, k = m ? m.a : 1;
    if (!(k > 0 && k < 0.9) || m.d !== k || m.b || m.c || m.e || m.f) { ctx.drawImage(IMG[name], 0, 0); return; }
    const f = fitted[name] || (fitted[name] = { cv: document.createElement('canvas'), k: 0 });
    if (f.k !== k) {                                        // first use, or the window has changed size
      f.cv.width = Math.ceil(W * k); f.cv.height = Math.ceil(H * k); f.k = k;
      const t = f.cv.getContext('2d'); t.setTransform(k, 0, 0, k, 0, 0); t.drawImage(IMG[name], 0, 0);
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(f.cv, 0, 0); ctx.restore();
  }
  // makes all five ready for the scale of ctx (any small spare canvas will do). The page calls it while nothing is
  // happening, so that the first purple frame (the first fault) does not make the game wait
  function warm(ctx) { ['tv', 'mass_green', 'art_top', 'mass_purple', 'art_top_inv'].forEach(n => whole(ctx, n)); }

  // ---------------------------------------------------------------- parts
  // state: undefined | 'hit' (right one: green inside, yellow burst of light) | 'miss' (wrong one: red inside, red burst)
  // k = 0..1 strength of the effect (for fading it in and out)
  // colours taken from the art: the flat green of the background, the crayon red of the buttons
  const FX = { hit: { fill: '#6e9d79', glow: '110,157,121' }, miss: { fill: '#cd3c4e', glow: '205,60,78' } };
  const tintCache = {};
  function tinted(color) {
    if (tintCache[color]) return tintCache[color];
    const im = IMG.candidate, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const t = cv.getContext('2d'); t.drawImage(im, 0, 0);
    t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, im.width, im.height);
    return (tintCache[color] = cv);
  }
  // a burst of light: a soft halo spreading outwards, no rays
  function drawBurst(ctx, cx, cy, rgb, k) {
    const R = 620 * (0.7 + 0.3 * k);
    const g = ctx.createRadialGradient(cx, cy, 90, cx, cy, R);
    g.addColorStop(0, 'rgba(' + rgb + ',' + 0.72 * k + ')'); g.addColorStop(0.45, 'rgba(' + rgb + ',' + 0.42 * k + ')');
    g.addColorStop(0.78, 'rgba(' + rgb + ',' + 0.13 * k + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * P); ctx.fill(); ctx.restore();
  }
  function drawCandidate(ctx, cx, top, code, state, k, noBurst) {
    const c = CFG.candidate, fx = FX[state];
    if (fx) {
      k = k == null ? 1 : k;
      if (!noBurst) drawBurst(ctx, cx, top + c.h * 0.52, fx.glow, k);
      if (k < 1) ctx.drawImage(IMG.candidate, cx - c.w / 2, top);
      ctx.save(); ctx.globalAlpha = k; ctx.drawImage(tinted(fx.fill), cx - c.w / 2, top); ctx.restore();
    } else ctx.drawImage(IMG.candidate, cx - c.w / 2, top);
    if (code) drawSymbolRow(ctx, code, cx, top + c.torsoY, c.symSize, c.symGap);
  }

  // a candidate out of its lane: h = { x, y: centre of the figure, rot (degrees), s, state, k, code }
  function drawHeld(ctx, h) {
    const c = CFG.candidate;
    ctx.save(); if (h.alpha != null) ctx.globalAlpha = h.alpha;
    ctx.translate(h.x, h.y); ctx.rotate((h.rot || 0) * P / 180); ctx.scale(h.s || 1, h.s || 1);
    drawCandidate(ctx, 0, -c.h / 2, h.code, h.state, h.k, true); ctx.restore();
  }
  // a candidate that is now part of the alien mass: same pale green and black line as the mass
  // places around the frame where the caught ones end up, in order (20 of them)
  const SLOTS = [[150, 1930, -10], [1290, 118, 6], [2545, 2050, 9], [150, 620, 12], [2550, 1010, -8], [560, 3470, -6], [2130, 3480, 8],
                 [820, 110, -9], [150, 2560, 7], [2550, 1530, 5], [1790, 105, 10], [2540, 520, -12], [150, 1280, -5], [840, 3545, 9],
                 [2545, 2560, -7], [340, 105, 11], [2420, 3530, -8], [150, 3100, 6], [2550, 3050, -10], [2250, 100, 7]];
  function drawAbsorbed(ctx, i, code, k, inv) {   // inv: colours inverted, for the purple state
    const c = CFG.candidate, sl = SLOTS[i % SLOTS.length], s = 0.5;
    ctx.save(); ctx.globalAlpha = k == null ? 1 : k; ctx.translate(sl[0], sl[1]); ctx.rotate(sl[2] * P / 180); ctx.scale(s, s);
    // the outlined silhouette is built once per code and colour (the game draws up to 20 of them every frame)
    const key = (inv ? 'i' : 'n') + (code ? code.join('.') : ''), m = 20;
    let cv = absorbedCache[key];
    if (!cv) {
      cv = absorbedCache[key] = document.createElement('canvas'); cv.width = c.w + 2 * m; cv.height = c.h + 2 * m;
      const t = cv.getContext('2d'); t.translate(m + c.w / 2, m + c.h / 2);
      const line = tinted(inv ? '#eeeeee' : '#111111');
      for (let a = 0; a < 16; a++) t.drawImage(line, -c.w / 2 + Math.cos(a * P / 8) * 16, -c.h / 2 + Math.sin(a * P / 8) * 16);
      t.drawImage(tinted(inv ? '#261122' : '#d9eedd'), -c.w / 2, -c.h / 2);
      if (code) drawSymbolRow(t, code, 0, -c.h / 2 + c.torsoY, c.symSize, c.symGap, inv ? '#d394c3' : '#2c6b3c');
    }
    ctx.drawImage(cv, -c.w / 2 - m, -c.h / 2 - m);
    ctx.restore();
  }
  const absorbedCache = {};

  function drawButtons(ctx, pressed) {
    const b = CFG.buttons;
    for (let k = 0; k < 3; k++) {
      const on = pressed === k, sx = b.cuts[k], sw = b.cuts[k + 1] - sx;
      if (on) { const o = b.onShift[k], sh = IMG.buttons.height - b.rowH;
        ctx.drawImage(IMG.buttons, sx, b.rowH, sw, sh, b.x + (sx + o.x) * b.s, b.y + (b.rowH + o.y) * b.s, sw * b.s, sh * b.s); }
      else ctx.drawImage(IMG.buttons, sx, 0, sw, b.rowH, b.x + sx * b.s, b.y, sw * b.s, b.rowH * b.s);
      if (!on) {
        const f = b.face[k];
        number(ctx, String(k + 1), b.x + f.x * b.s, b.y + (f.y + 8) * b.s, 184 * b.s);
      }
    }
  }
  function number(ctx, t, cx, cy, size) {
    ctx.save(); ctx.font = size + 'px ' + CFG.fontHand; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = CFG.ink; ctx.fillText(t, cx, cy); ctx.restore();
  }
  function label(ctx, lines, cx, cy, size) {
    ctx.save();
    ctx.font = size + 'px ' + CFG.fontHand; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.min(size * 0.26, 34); ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff';
    lines.forEach((t, i) => { const y = cy + (i - (lines.length - 1) / 2) * size * 0.98; ctx.strokeText(t, cx, y); ctx.fillText(t, cx, y); });
    ctx.restore();
  }

  // pose: { dx, dy, rot } moves and turns the sheet about its centre (for the hands taking it away / bringing it)
  function paperCentre(pose) { const p = CFG.paper; return { x: p.x + 412 * p.s + ((pose && pose.dx) || 0), y: p.y + 288 * p.s + ((pose && pose.dy) || 0) }; }
  function drawPaper(ctx, code, pose) {
    const p = CFG.paper, c = paperCentre(pose);
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(((pose && pose.rot) || 0) * P / 180); ctx.translate(-(p.x + 412 * p.s), -(p.y + 288 * p.s));
    const x = p.x, y = p.y;
    ctx.drawImage(IMG.paper, x, y, IMG.paper.width * p.s, IMG.paper.height * p.s);
    const cx = x + 412 * p.s, top = y + 18 * p.s;
    ctx.font = 66 + 'px ' + CFG.fontHand; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = CFG.titleInk;
    ctx.fillText('JOB DESCRIPTION', cx, top + 92);
    if (code) drawSymbolRow(ctx, code, cx, top + 198, 104, 26);
    ctx.restore();
  }

  function drawHud(ctx, st) {
    // kept to the left: the top right corner of the glass is covered by a hand of the mass
    const g = CFG.glass, y = g.y + 92;
    ctx.save();
    // a dark strip so the score stays readable while white candidates come in behind it
    ctx.fillStyle = CFG.hudBand; ctx.fillRect(g.x, g.y, g.w, CFG.hudH);
    ctx.fillStyle = 'rgba(127,208,143,0.35)'; ctx.fillRect(g.x, g.y + CFG.hudH, g.w, 5);
    ctx.font = '116px ' + CFG.fontScreen; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#e9ffe9'; ctx.fillText('SCORE ' + String(st.score || 0).padStart(2, '0'), g.x + 56, y);
    ctx.fillStyle = '#7fd08f'; ctx.fillText('JOB ' + String((st.paper || 0) + 1).padStart(2, '0') + '/' + (st.jobs || 20), g.x + 500, y);
    for (let k = 0; k < 3; k++) {            // three fault marks
      const cx = g.x + 1010 + k * 104, used = k < (st.faults || 0);
      ctx.strokeStyle = used ? '#ff3b3b' : '#3d5a45'; ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 30, y - 30); ctx.lineTo(cx + 30, y + 30); ctx.moveTo(cx + 30, y - 30); ctx.lineTo(cx - 30, y + 30); ctx.stroke();
    }
    ctx.restore();
  }

  // the recruiter's arm reaching button k: the long arm, tilted from the shoulder and stretched to length
  function armTo(k, reach) {
    const b = CFG.buttons, f = b.face[k], sh = CFG.shoulder, a = CFG.armReach;
    const tx = b.x + (f.x + a.dx[k]) * b.s, ty = b.y + a.y * b.s;
    const dx = tx - sh.x, dy = ty - sh.y, len = Math.hypot(dx, dy) * (reach == null ? 1 : reach);
    return { img: 'arm_long', rot: Math.atan2(dx, -dy) * 180 / P, s: a.w, sy: len / (IMG.arm_long.height - 12) };
  }

  // ---------------------------------------------------------------- the green hand, bent
  // Carlos' drawing is first laid out straight (shoulder at u=0, elbow near u=300, wrist near u=960, fingertips
  // near u=1270), then redrawn in thin slices along a curved spine, so it can flex without being redrawn.
  const GH = { base: { x: 100, y: 840 }, tip: { x: 1235, y: 15 }, ox: 80, oy: 400, w: 1500, h: 800, elbow: 300, wrist: 960, knuckle: 1085, len: 1275 };
  let ghStraight = null, ghMid = null; const ghLo = [], ghHi = [];
  function straightHand() {
    if (ghStraight) return ghStraight;
    const c = document.createElement('canvas'); c.width = GH.w; c.height = GH.h;
    const x = c.getContext('2d'), a = Math.atan2(GH.tip.y - GH.base.y, GH.tip.x - GH.base.x);
    x.translate(GH.ox, GH.oy); x.rotate(-a); x.drawImage(IMG.hand_green, -GH.base.x, -GH.base.y);
    // centre line of the arm (v for every u), so that bending pivots on the arm itself and not on a far axis.
    // hand_data.js carries it ready-made: a page opened from the disk (file://) may not read the pixels of an image
    if (root.MC_HAND) { ghMid = root.MC_HAND.mid; ghLo.push.apply(ghLo, root.MC_HAND.lo); ghHi.push.apply(ghHi, root.MC_HAND.hi); return (ghStraight = c); }
    const d = x.getImageData(0, 0, GH.w, GH.h).data, raw = [];
    for (let u = 0; u <= GH.len; u++) {
      let m = 0, n = 0; const col = GH.ox + u;
      for (let v = 0; v < GH.h; v += 2) { const al = d[(v * GH.w + col) * 4 + 3]; if (al > 60) { m += v * al; n += al; } }
      raw.push(n ? m / n - GH.oy : (raw.length ? raw[raw.length - 1] : 0));
    }
    // where the drawing begins and ends in every column, so that only that part of a slice is painted
    for (let col = 0; col < GH.w; col++) {
      let lo = GH.h, hi = 0;
      for (let v = 0; v < GH.h; v++) if (d[(v * GH.w + col) * 4 + 3] > 4) { if (v < lo) lo = v; hi = v; }
      ghLo.push(lo); ghHi.push(hi);
    }
    const hold = raw[GH.wrist - 40];                      // the hand stays rigid: constant centre from the wrist on
    for (let u = GH.wrist - 40; u <= GH.len; u++) raw[u] = hold;
    ghMid = raw.map((_, u) => { let m = 0, n = 0; for (let k = -45; k <= 45; k++) { const q = raw[Math.max(0, Math.min(GH.len, u + k))]; m += q; n++; } return m / n; });
    return (ghStraight = c);
  }
  const mid = u => ghMid[Math.max(0, Math.min(GH.len, Math.round(u)))];
  const sstep = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  // pose: { x, y: shoulder position, s: scale, a0: direction of the whole arm in degrees (-36 = as drawn, 0 = pointing
  //         right, -90 = up), elbow, wrist, grip: bends in degrees (positive = clockwise), wave: degrees of tentacle
  //         wobble, phase, flip }
  function handBend(p, u) {
    let a = (p.a0 == null ? -36 : p.a0);
    a += (p.elbow || 0) * sstep((u - GH.elbow + 170) / 340);
    a += (p.wrist || 0) * sstep((u - GH.wrist + 80) / 160);
    a += (p.grip || 0) * sstep((u - GH.knuckle + 45) / 150);
    if (p.wave) a += p.wave * Math.sin(u / 210 + (p.phase || 0)) * Math.min(1, u / 300);
    return a * P / 180;
  }
  // walks along the arm; calls f(u, x, y, rot) for every slice (x, y relative to the shoulder, unflipped)
  // p.stretch (1 = as drawn) lengthens the arm between shoulder and wrist only: the hand itself keeps its size
  function walkHand(p, f, upTo) {
    const s = p.s || 1, sv = p.stretch || 1, end = upTo == null ? GH.len + 30 : upTo, tol = 0.009; let x = 0, y = 0;
    const slope = u => (mid(u + 3) - mid(u)) / 3;
    for (let u = 0; u < end;) {
      const st = sv === 1 ? 1 : 1 + (sv - 1) * (1 - sstep((u - (GH.wrist - 180)) / 130));
      const rot = handBend(p, u), sl = slope(u);
      // slices are 3 wide where the arm bends and up to 24 wide where it runs straight
      let step = 3;
      while (step < 24 && Math.abs(handBend(p, u + step * 2) - rot) < tol && Math.abs(slope(u + step * 2) - sl) < tol) step *= 2;
      if (u + step > end) step = end - u;
      const dm = mid(u + step) - mid(u), nat = Math.atan2(dm, step * st), dl = Math.hypot(step * st, dm) * s;
      f(u, x, y, rot, step, st);
      x += Math.cos(rot + nat) * dl; y += Math.sin(rot + nat) * dl;
      u += step;
    }
    return { x, y };
  }
  function drawGreenHand(ctx, p) {
    const src = straightHand(), s = p.s || 1;
    ctx.save(); ctx.translate(p.x, p.y); if (p.flip) ctx.scale(-1, 1);
    // the torn end behind the shoulder, rigid
    const r0 = handBend(p, 0);
    ctx.save(); ctx.rotate(r0); ctx.scale(s, s); ctx.drawImage(src, 0, 0, GH.ox + 2, GH.h, -GH.ox, -(GH.oy + mid(0)), GH.ox + 2, GH.h); ctx.restore();
    walkHand(p, (u, x, y, rot, step, st) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * st, s);
      let lo = GH.h, hi = 0;
      for (let c = GH.ox + u, e = Math.min(GH.w, c + step + 3); c < e; c++) { if (ghLo[c] < lo) lo = ghLo[c]; if (ghHi[c] > hi) hi = ghHi[c]; }
      if (hi < lo) { ctx.restore(); return; }
      lo = Math.max(0, lo - 2); hi = Math.min(GH.h, hi + 3);
      ctx.drawImage(src, GH.ox + u, lo, step + 3, hi - lo, 0, lo - (GH.oy + mid(u)), step + 3, hi - lo);
      ctx.restore();
    });
    ctx.restore();
  }
  // where a point of the arm (u along it, v across, from its centre line) ends up for a pose
  function handPoint(p, u0, v0) {
    straightHand();
    const e = walkHand(p, () => {}, u0), rot = handBend(p, u0), s = p.s || 1;
    const x = e.x - Math.sin(rot) * (v0 || 0) * s, y = e.y + Math.cos(rot) * (v0 || 0) * s;
    return { x: p.x + (p.flip ? -x : x), y: p.y + y, angle: p.flip ? P - rot : rot };
  }

  // a message on the TV glass (start, game over): o = { title, titleColor, lines: [..], button }
  function drawOverlay(ctx, o) {
    const g = CFG.glass, cx = g.x + g.w / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(8,7,28,' + (o.dim == null ? 0.86 : o.dim) + ')'; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let y = g.y + (o.top || 760);
    if (o.title) { ctx.font = (o.titleSize || 400) + 'px ' + CFG.fontScreen; ctx.fillStyle = o.titleColor || '#e9ffe9'; ctx.fillText(o.title, cx, y); y += (o.titleSize || 400) * 0.82; }
    const ls = o.lineSize || 170;
    (o.lines || []).forEach(t => { ctx.font = ls + 'px ' + CFG.fontScreen; ctx.fillStyle = '#e9ffe9'; ctx.fillText(t, cx, y); y += ls * 1.12; });
    if (o.button) {
      y += 150; ctx.font = '230px ' + CFG.fontScreen;
      const w = ctx.measureText(o.button).width + 190, h = 300;
      ctx.fillStyle = '#7fd08f'; ctx.fillRect(cx - w / 2, y - h / 2, w, h);
      ctx.fillStyle = '#08071c'; ctx.fillText(o.button, cx, y + 6);
      o.rect = { x: cx - w / 2, y: y - h / 2, w, h };
    }
    ctx.restore();
  }

  // the win: the TV shows the recruiter himself, from the front (3D render), wearing I [heart] AI
  function drawWin(ctx, w) {
    const g = CFG.glass, cx = g.x + g.w / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
    ctx.fillStyle = CFG.hudBand; ctx.fillRect(g.x, g.y, g.w, g.h);
    const gr = ctx.createRadialGradient(cx, g.y + 1250, 150, cx, g.y + 1250, 1500);
    gr.addColorStop(0, 'rgba(110,157,121,0.95)'); gr.addColorStop(0.55, 'rgba(110,157,121,0.35)'); gr.addColorStop(1, 'rgba(110,157,121,0)');
    ctx.fillStyle = gr; ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.drawImage(IMG.recruiter_front, g.x, g.y + (w.dy || 0), g.w, g.h);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '330px ' + CFG.fontScreen; ctx.fillStyle = '#e9ffe9'; ctx.fillText(w.title || 'YOU WON', cx, g.y + 372);
    ctx.restore();
  }

  // RESTART as a real push button (black marker outline, a side that gives it depth, a shine, a yellow glow),
  // drawn in front of the three red buttons so that it is obvious where to click
  function drawBigButton(ctx, label, cx, cy, k) {
    k = k || 1;
    ctx.save(); ctx.font = (340 * k) + 'px ' + CFG.fontScreen; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + 300 * k, h = 390 * k, d = 58 * k, r = 70 * k, x = cx - w / 2, y = cy - h / 2;
    const rr = (yy, hh) => { ctx.beginPath(); ctx.roundRect(x, yy, w, hh, r); };
    ctx.save(); ctx.shadowColor = 'rgba(255,214,40,1)'; ctx.fillStyle = '#ffd628';
    for (const blur of [170, 110, 60]) { ctx.shadowBlur = blur; rr(y, h + d); ctx.fill(); }
    ctx.restore();
    ctx.lineJoin = 'round'; ctx.lineWidth = 18 * k; ctx.strokeStyle = '#111';
    rr(y, h + d); ctx.fillStyle = '#3f8a57'; ctx.fill(); ctx.stroke();          // the side
    rr(y, h); ctx.fillStyle = '#7fd08f'; ctx.fill(); ctx.stroke();              // the top face
    ctx.save(); rr(y, h); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fillRect(x, y, w, h * 0.3); ctx.restore();   // shine
    ctx.fillStyle = '#08071c'; ctx.fillText(label, cx, cy + 10 * k);
    ctx.restore();
    return { x, y, w, h: h + d };
  }

  // the two alien hands at rest, as in the look and feel (left one, and the right one mirrored)
  const HANDS_REST = [{ x: -183, y: 3532, s: 0.936, a0: -28 }, { x: 2781, y: 2633, s: 0.76, a0: 25.7, flip: true }];
  // bend a hand so that its palm lands on a target point: tries directions and elbow bends, keeps the closest
  function reachPose(base, tx, ty, extra) {
    let best = null;
    for (let a0 = -180; a0 < 180; a0 += 4) for (let elbow = -100; elbow <= 100; elbow += 10) {
      const p = Object.assign({}, base, extra, { a0, elbow }), q = handPoint(p, 1090, 0);
      const d = Math.hypot(q.x - tx, q.y - ty) + Math.abs(elbow) * 0.4;
      if (!best || d < best.d) best = { d, p };
    }
    return best.p;
  }

  // ---------------------------------------------------------------- scene
  // st: { paper, score, faults, bg:'green'|'purple', pressed:-1|0|1|2, arm:{img,rot}, candidates:[{lane|x, y, code}], hud:true }
  function drawScene(ctx, st) {
    st = st || {};
    const g = CFG.glass;
    ctx.fillStyle = CFG.field; ctx.fillRect(0, 0, W, H);
    whole(ctx, 'tv');
    // candidates: only on the black glass
    ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
    (st.candidates || []).slice().sort((a, b) => (a.state ? 1 : 0) - (b.state ? 1 : 0)).forEach(c => {
      const cx = c.x != null ? c.x : g.x + (c.lane + 0.5) * g.w / CFG.lanes + (c.dx || 0);
      if (c.alpha != null) { ctx.save(); ctx.globalAlpha = c.alpha; }
      drawCandidate(ctx, cx, c.y, c.code, c.state, c.k);
      if (c.alpha != null) ctx.restore();
    });
    ctx.restore();
    if (st.win) drawWin(ctx, st.win);
    if (st.overlay) drawOverlay(ctx, st.overlay);
    if (st.hud !== false) drawHud(ctx, st);
    // the alien mass lies over the TV: its hands overlap the frame
    whole(ctx, st.bg === 'purple' ? 'mass_purple' : 'mass_green');
    drawButtons(ctx, st.pressed == null ? -1 : st.pressed);
    if (st.win && st.win.button) st.win.rect = drawBigButton(ctx, st.win.button, CFG.glass.x + CFG.glass.w / 2, 2450, 1.3);
    // layer order, bottom to top (Carlos, 7 Oct): paper + text + symbols < recruiter arm and alien hands
    // < recruiter < Game_Art (lines, eyes, letters) on top of everything
    if (st.win && st.win.below) {   // words on the empty green under the buttons, same lettering and size as the title
      ctx.save(); ctx.font = '330px ' + CFG.fontScreen; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3a3a3a';
      ctx.fillText(st.win.below, CFG.glass.x + CFG.glass.w / 2 + 10, 3020); ctx.restore();
    }
    if (st.paper !== null && st.showPaper !== false) drawPaper(ctx, st.code || PAPERS[st.paper || 0], st.paperPose);
    const arm = st.showRecruiter === false ? {} : (st.arm || CFG.armIdle);
    if (arm.img) { const a = IMG[arm.img]; sprite(ctx, a, a.width / 2, a.height - 12, CFG.shoulder.x + (arm.dx || 0), CFG.shoulder.y + (arm.dy || 0), arm.s || 0.75, arm.rot || 0, false, arm.sy); }
    if (st.held) drawHeld(ctx, st.held);
    (st.greenHands || HANDS_REST).forEach(h => drawGreenHand(ctx, h));
    const r = CFG.recruiter;
    if (st.showRecruiter !== false) ctx.drawImage(IMG.recruiter_back, r.x, r.y, IMG.recruiter_back.width * r.s, IMG.recruiter_back.height * r.s);
    if (st.art !== false) whole(ctx, st.bg === 'purple' ? 'art_top_inv' : 'art_top');
    (st.absorbed || []).forEach((a, i) => drawAbsorbed(ctx, i, a.code, a.k, st.bg === 'purple'));
  }

  // (only used to write hand_data.js again if the drawing of the hand changes; needs the page served over http)
  function _handData() { straightHand(); return { mid: ghMid.map(v => Math.round(v * 100) / 100), lo: ghLo, hi: ghHi }; }
  root.MC = { _handData, warm, W, H, CFG, SYMBOLS, PAPERS, IMG, load, rng, decoy, drawSymbol, drawSymbolRow, drawCandidate, drawPaper, drawButtons, drawHud, drawScene, sprite, label, armTo, drawGreenHand, handPoint, GH, HANDS_REST, reachPose, paperCentre, drawHeld, drawAbsorbed, drawOverlay, SLOTS };
})(window);
