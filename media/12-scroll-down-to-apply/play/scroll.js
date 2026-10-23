// Scroll Down to Apply, v2.
// As you scroll down, words come loose from the posting: they tremble, lift off, fly, spin and flip, split into
// letters that tumble apart, and the letters disintegrate into dots. The dots join a field of tens of thousands of
// moving particles that fills the whole screen and slowly organises itself into two huge machine eyes watching you.
// - The scroll position decides how much of the text has broken (scroll back up and it comes back together).
// - The scroll speed is wind: particles are blown, flying words spin faster, the screen tears.
// - The pointer: the eyes follow it, and it pushes particles and flying words away like a hand in sand.
// - A click: a ripple through the particles; the eyes smile (^ ^), their pupils bounce and they look at the spot.
// The DOM text stays for layout and scrolling (transparent, body.cv); canvas 1 (2D) draws the letters,
// canvas 2 (WebGL) the particles. ?s=0..1 fixes the progress (for stills).
(() => {
'use strict';
const Q = new URLSearchParams(location.search);
const FIXED_S = Q.has('s') ? parseFloat(Q.get('s')) : null;
// ?rec=1: no animation loop; window.__rec(i) draws video frame i (30 fps) with a scripted scroll, for the grid video
const REC = Q.has('rec');
let simNow = null;
const nowMs = () => simNow !== null ? simNow : performance.now();

// ---------- tuning ----------
const START = 0.01, END = 0.96, CURVE = 1.6;  // progress -> break level
const WINDOW = 0.3;                            // share of the break level a word takes from loose to dust
const TAU = Math.PI * 2;

// ---------- canvases ----------
const P0 = 'position:fixed; inset:0; width:100vw; height:100vh; pointer-events:none;';
const gcv = document.createElement('canvas'); gcv.style.cssText = P0 + 'z-index:3;';
const tcv = document.createElement('canvas');
tcv.style.cssText = P0 + 'z-index:4; filter: drop-shadow(0 0 calc(100vw / 650 * 3) rgba(110,255,200,.5));';
document.body.append(gcv, tcv);
const ctx = tcv.getContext('2d');
let W = 0, H = 0, DPR = 1, P = 1;

const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const seg = (a, a0, a1) => smooth((a - a0) / (a1 - a0));

// =====================================================================================================
// 1. WORDS: measured once (positions in document coordinates), drawn every frame on the 2D canvas
// =====================================================================================================
let words = [], styles = [];
function measure() {
  document.body.classList.remove('cv');
  const sx = scrollX, sy = scrollY;
  words = []; styles = [];
  const styleKey = new Map(), range = document.createRange();
  const mctx = document.createElement('canvas').getContext('2d');
  const walker = document.createTreeWalker(document.querySelector('.wrap'), NodeFilter.SHOW_TEXT);
  let wi = 0;
  for (let node; (node = walker.nextNode());) {
    const t = node.nodeValue;
    if (!/\S/.test(t)) continue;
    const el = node.parentElement;
    if (el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const key = font + '|' + cs.color;
    let st = styleKey.get(key);
    if (st === undefined) {
      mctx.font = font;
      const m = mctx.measureText('Mg'), size = parseFloat(cs.fontSize);
      st = styles.length; styleKey.set(key, st);
      styles.push({ font, color: cs.color, size, asc: m.fontBoundingBoxAscent || size * .8, desc: m.fontBoundingBoxDescent || size * .25, dots: new Map() });
    }
    const S = styles[st], upper = cs.textTransform === 'uppercase';
    const re = /\S+/g;
    for (let m; (m = re.exec(t));) {
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const text = upper ? m[0].toUpperCase() : m[0];
      const rects = range.getClientRects();
      let total = 0; for (const r of rects) total += r.width;
      let k = 0;
      for (let ri = 0; ri < rects.length; ri++) {          // a word wrapped at a hyphen becomes two words
        const r = rects[ri];
        const n = ri === rects.length - 1 ? text.length - k : Math.round(text.length * r.width / total);
        if (n <= 0) continue;
        const top = r.top + sy;
        words.push({ x: r.left + sx, y: top, b: top + (r.height - S.asc - S.desc) / 2 + S.asc, w: r.width, cw: r.width / n,
                     s: text.slice(k, k + n), st, i: wi, h: hash(wi * 2654435761 + 7) });
        k += n; wi++;
      }
    }
  }
  words.sort((a, b) => a.y - b.y);
  document.body.classList.add('cv');
}

// dithered dots of one character, offsets from its pen position (CSS px)
const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d', { willReadFrequently: true });
function dotsOf(S, ch) {
  let d = S.dots.get(ch);
  if (d) return d;
  const K = 3, w = Math.ceil(S.size * 1.2 * K) + 4, h = Math.ceil((S.asc + S.desc) * K) + 4;
  tmp.width = w; tmp.height = h;
  tctx.fillStyle = '#fff'; tctx.font = S.font;
  tctx.setTransform(K, 0, 0, K, 2, 2); tctx.fillText(ch, 0, S.asc); tctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = tctx.getImageData(0, 0, w, h).data, step = Math.max(1, Math.round(S.size * K / 8));
  d = []; let n = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const a = img[(y * w + x) * 4 + 3] / 255, r = hash(++n * 977 + ch.charCodeAt(0) * 31);
    if (a > .2 + r * .5 && r > .06) d.push((x - 2) / K, (y - 2) / K - S.asc);
  }
  S.dots.set(ch, d);
  return d;
}

// =====================================================================================================
// 2. THE EYES: a small picture redrawn every frame; its brightness is the density the particles fill
// =====================================================================================================
const GW = 176; let GH = 235;
const ecv = document.createElement('canvas'), ectx = ecv.getContext('2d', { willReadFrequently: true });
let dens = null, rowCdf = null, cellCdf = null, colR = null, colG = null, colB = null;
const eye = { lx: 0, ly: 0, tx: 0, ty: 0, open: 1, dil: .4, flash: 0, blinkAt: 2, happy: 0, happyUntil: 0, boing: 0, dizzy: 0 };
// the ending, at the very bottom of the page: the eyes close, then a sentence, then the verdict (all made of particles)
const end = { t: 0, close: 0, eyes: 1, a: 0, b: 0 };
const IRIS = [205, 228, 140];   // a pale yellow-green, close to the phosphor green
const LILAC = [184, 164, 240];  // the soft accent (no red anywhere: nothing should read as alarm)
const mix = (c, d, k) => `rgb(${c.map((v, i) => Math.round(v + (d[i] - v) * k)).join(',')})`;

function drawEyes(t) {
  const sx = GW / W, sy = GH / H;
  ectx.setTransform(1, 0, 0, 1, 0, 0);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, GW, GH);
  ectx.setTransform(sx, 0, 0, sy, 0, 0);
  // round eyes that slowly breathe between a circle and an oval (never pointed)
  const re = Math.min(W * .215, H * .3), cy = H * .5 + Math.sin(t * .4) * H * .01;
  ectx.globalAlpha = end.eyes;
  if (end.eyes > .01) for (const side of [-1, 1]) {
    const cx = W / 2 + side * W * .245;
    const rx = re * (1 - .06 * (.5 + .5 * Math.sin(t * .21 + side))), ry = re * (.84 + .16 * (.5 + .5 * Math.sin(t * .17 + side * 2)));
    const ryo = Math.max(ry * eye.open, re * .015);   // blink / close: the ellipse flattens to a line with round ends
    const shape = () => { ectx.beginPath(); ectx.ellipse(cx, cy, rx, ryo, 0, 0, TAU); };
    ectx.save();
    shape(); ectx.clip();
    // white of the eye: dim phosphor, brighter toward the centre
    const g = ectx.createRadialGradient(cx, cy, 0, cx, cy, re);
    g.addColorStop(0, 'rgb(70,150,120)'); g.addColorStop(1, 'rgb(25,60,50)');
    ectx.fillStyle = g; ectx.fillRect(cx - re, cy - re, re * 2, re * 2);
    // a friendly cartoon iris: soft rings, a big round pupil, big sparkles
    const ri = re * .64;
    // when you scroll fast the pupils go dizzy, spinning in little circles
    const dz = eye.dizzy, da = t * 11 + side;
    const ix = cx + (eye.lx + Math.cos(da) * dz * .45) * (rx - ri) * .85, iy = cy + (eye.ly + Math.sin(da) * dz * .45) * (ry - ri) * .85;
    ectx.fillStyle = mix(IRIS, LILAC, eye.flash * .6); ectx.beginPath(); ectx.arc(ix, iy, ri, 0, TAU); ectx.fill();
    ectx.strokeStyle = 'rgb(236,248,206)'; ectx.lineWidth = ri * .06;
    ectx.beginPath(); ectx.arc(ix, iy, ri * .97, 0, TAU); ectx.stroke();
    ectx.strokeStyle = 'rgb(170,200,110)'; ectx.lineWidth = ri * .04;
    ectx.beginPath(); ectx.arc(ix, iy, ri * .78, 0, TAU); ectx.stroke();
    const rp = ri * (.4 + eye.dil * .2) * (1 + eye.boing * .25 * Math.sin(eye.boing * 14));
    ectx.fillStyle = '#000'; ectx.beginPath(); ectx.arc(ix, iy, rp, 0, TAU); ectx.fill();
    // sparkles: a big round one, a small one, and a twinkling star
    ectx.fillStyle = '#fff';
    ectx.beginPath(); ectx.arc(ix - ri * .34, iy - ri * .36, ri * .24, 0, TAU); ectx.fill();
    ectx.beginPath(); ectx.arc(ix + ri * .32, iy + ri * .3, ri * .1, 0, TAU); ectx.fill();
    const tw = .6 + .4 * Math.sin(t * 3 + side * 2), sr = ri * .16 * tw, sxp = ix + ri * .26, syp = iy - ri * .5;
    ectx.beginPath(); ectx.moveTo(sxp, syp - sr); ectx.quadraticCurveTo(sxp, syp, sxp + sr, syp); ectx.quadraticCurveTo(sxp, syp, sxp, syp + sr);
    ectx.quadraticCurveTo(sxp, syp, sxp - sr, syp); ectx.quadraticCurveTo(sxp, syp, sxp, syp - sr); ectx.fill();
    ectx.restore();
    // rim
    shape(); ectx.strokeStyle = 'rgb(196,243,223)'; ectx.lineWidth = re * .06; ectx.stroke();
    // happy eyes: a soft arch, like ^ ^
    if (eye.happy > .01) {
      ectx.save(); ectx.globalAlpha = end.eyes * eye.happy; ectx.lineCap = 'round';
      ectx.strokeStyle = 'rgb(225,245,200)'; ectx.lineWidth = re * .16;
      ectx.beginPath(); ectx.arc(cx, cy + re * .45, re * .72, Math.PI * 1.18, Math.PI * 1.82); ectx.stroke();
      ectx.restore();
    }
  }
  ectx.globalAlpha = 1;
  // the ending sentences, in the terminal lettering
  const say = (lines, alpha, colour, maxW, dy) => {
    if (alpha <= .01) return;
    ectx.globalAlpha = alpha; ectx.fillStyle = colour; ectx.textAlign = 'center'; ectx.textBaseline = 'middle';
    let size = 100; ectx.font = `${size}px VT323`;
    const widest = Math.max(...lines.map(l => ectx.measureText(l).width));
    size = Math.min(size * maxW * W / widest, H * .7 / lines.length / 1.05);
    ectx.font = `${size}px VT323`;
    lines.forEach((l, i) => ectx.fillText(l, W / 2, H / 2 + dy * H + (i - (lines.length - 1) / 2) * size * 1.05));
    ectx.globalAlpha = 1;
  };
  say(['I see that you', 'don’t like', 'this position.'], end.a, 'rgb(225,250,235)', .9, 0);
  say(['FIT:'], end.b, 'rgb(225,250,235)', .5, -.17);
  say(['0%'], end.b, 'rgb(184,164,240)', .62, .12);
  // brightness -> density, colour; plus a faint moving interference pattern so particles fill the whole screen
  const img = ectx.getImageData(0, 0, GW, GH).data;
  const n = GW * GH;
  if (!dens || dens.length !== n) {
    dens = new Float32Array(n); cellCdf = new Float32Array(n); rowCdf = new Float32Array(GH);
    colR = new Uint8Array(n); colG = new Uint8Array(n); colB = new Uint8Array(n);
  }
  let acc = 0;
  for (let y = 0; y < GH; y++) {
    let racc = 0;
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x, r = img[i * 4], g = img[i * 4 + 1], b = img[i * 4 + 2];
      const lum = (r * .3 + g * .6 + b * .1) / 255;
      const bg = .045 * (1 + .9 * Math.sin(x * .17 + t * .7) * Math.sin(y * .13 - t * .5) + .5 * Math.sin((x + y) * .07 + t * .3));
      const d = lum * lum * 1.4 + Math.max(bg, 0);
      dens[i] = d; racc += d; cellCdf[i] = racc;
      if (lum > .02) { colR[i] = r; colG[i] = g; colB[i] = b; } else { colR[i] = 70; colG[i] = 150; colB[i] = 120; }
    }
    acc += racc; rowCdf[y] = acc;
  }
}
function bsearch(arr, lo, hi, v) { while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; }

// =====================================================================================================
// 3. PARTICLES: CPU physics, WebGL points
// =====================================================================================================
let N = 0, px, py, vx, vy, life, pu, pv, pj, pos, col, wasActive;
const gl = gcv.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: REC });
let prog, bufP, bufC, locRes, locSize, locOff, locTint;
function glInit() {
  const vs = `attribute vec2 p; attribute vec4 c; uniform vec2 res; uniform float size; uniform vec2 off; uniform vec3 tint; varying vec4 vc;
    void main(){ vec2 q = (p + off) / res * 2.0 - 1.0; gl_Position = vec4(q.x, -q.y, 0.0, 1.0); gl_PointSize = size * (0.7 + c.a * 0.9); vc = vec4(c.rgb * tint, c.a); }`;
  const fs = `precision mediump float; varying vec4 vc;
    void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = (smoothstep(1.0, 0.0, d) * 0.55 + smoothstep(0.45, 0.0, d) * 0.6) * vc.a;
      gl_FragColor = vec4(vc.rgb * a, a); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  gl.useProgram(prog);
  bufP = gl.createBuffer(); bufC = gl.createBuffer();
  const lp = gl.getAttribLocation(prog, 'p'), lc = gl.getAttribLocation(prog, 'c');
  gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufC); gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 4, gl.UNSIGNED_BYTE, true, 0, 0);
  locRes = gl.getUniformLocation(prog, 'res'); locSize = gl.getUniformLocation(prog, 'size');
  locOff = gl.getUniformLocation(prog, 'off'); locTint = gl.getUniformLocation(prog, 'tint');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
}
function particlesInit() {
  N = Math.round(Math.min(45000, Math.max(26000, W * H / 24)));
  px = new Float32Array(N); py = new Float32Array(N); vx = new Float32Array(N); vy = new Float32Array(N);
  life = new Float32Array(N); pu = new Float32Array(N); pv = new Float32Array(N); pj = new Float32Array(N * 2);
  wasActive = new Uint8Array(N); pos = new Float32Array(N * 2); col = new Uint8Array(N * 4);
  for (let k = 0; k < N; k++) {
    pu[k] = hash(k * 3 + 11); pv[k] = hash(k * 3 + 12); pj[k * 2] = hash(k * 5 + 13); pj[k * 2 + 1] = hash(k * 5 + 14);
    px[k] = hash(k * 7 + 1) * W; py[k] = hash(k * 7 + 2) * H;
  }
}

// spawn points collected while drawing disintegrating letters this frame
const spawnX = new Float32Array(600), spawnY = new Float32Array(600); let spawnN = 0;

// =====================================================================================================
// 4. INPUT
// =====================================================================================================
let pointer = null, pointerTime = -1e9, lastScrollTime = -1e9, scrollVel = 0, lastSY = 0, wind = 0, spinAcc = 0;
const waves = [];
addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; pointerTime = nowMs(); }, { passive: true });
addEventListener('pointerleave', () => { pointer = null; });
addEventListener('pointerdown', e => {
  waves.push({ x: e.clientX, y: e.clientY, t: nowMs() / 1000 });
  eye.flash = 1; eye.boing = 1; eye.happyUntil = nowMs() / 1000 + 1.1; eye.tx = (e.clientX / W - .5) * 2; eye.ty = (e.clientY / H - .5) * 2;
  pointer = { x: e.clientX, y: e.clientY }; pointerTime = nowMs();
});

// =====================================================================================================
// 5. FRAME
// =====================================================================================================
function progress() {
  if (FIXED_S !== null) return FIXED_S;
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? clamp01(scrollY / max) : 0;
}
const breakLevel = s => Math.pow(clamp01((s - START) / (END - START)), CURVE);

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight; P = W / 650;
  tcv.width = gcv.width = Math.round(W * DPR); tcv.height = gcv.height = Math.round(H * DPR);
  GH = Math.round(GW * H / W); ecv.width = GW; ecv.height = GH; dens = null;
  gl.viewport(0, 0, gcv.width, gcv.height);
  measure(); particlesInit();
}

let lastT = 0;
function frame(now) {
  const t = now / 1000, dt = Math.min(.05, lastT ? t - lastT : 1 / 60); lastT = t;
  const s = progress(), L = breakLevel(s);
  // scroll speed (px per second), smoothed; it is the wind
  const sy = scrollY, sx = scrollX;
  const v = (sy - lastSY) / dt; lastSY = sy;
  if (Math.abs(v) > 1) lastScrollTime = now;
  scrollVel += (v - scrollVel) * .2;
  wind = Math.max(-1, Math.min(1, scrollVel / (2200 * P))) * (REC ? .15 : 1);   // the self-scrolling video scrolls fast: calm its wind
  spinAcc += wind * dt * 3;
  document.documentElement.style.setProperty('--keep', (1 - smooth(L / .5)).toFixed(3));

  // ---------------- eyes state ----------------
  if (pointer && now - pointerTime < 3000) { eye.tx = (pointer.x / W - .5) * 2.2; eye.ty = (pointer.y / H - .5) * 2.2; }
  else if (now - lastScrollTime < 600) { eye.ty = Math.max(-1, Math.min(1, scrollVel / (900 * P))); eye.tx *= .9; }
  else { const k = Math.floor(t / 1.9); eye.tx = hash(k * 13 + 5) < .4 ? 0 : (hash(k * 17 + 3) * 2 - 1) * .8; eye.ty = hash(k * 13 + 5) < .4 ? 0 : (hash(k * 19 + 1) * 2 - 1) * .5; }
  eye.tx = Math.max(-1, Math.min(1, eye.tx)); eye.ty = Math.max(-1, Math.min(1, eye.ty));
  eye.lx += (eye.tx - eye.lx) * Math.min(1, dt * 9); eye.ly += (eye.ty - eye.ly) * Math.min(1, dt * 9);
  if (t > eye.blinkAt + 4 + hash(Math.floor(eye.blinkAt)) * 4) eye.blinkAt = t;
  const bt = (t - eye.blinkAt) / .22;
  // fast scrolling makes the pupils dizzy; now and then, when you rest, the eyes smile at you
  eye.dizzy += (Math.min(1, Math.max(0, Math.abs(wind) * 2.5 - .3)) - eye.dizzy) * Math.min(1, dt * 4);
  if (now - Math.max(pointerTime, lastScrollTime) > 2500 && hash(Math.floor(t / 2.5) * 7 + 3) < .22 && t > eye.happyUntil + 2) eye.happyUntil = t + 1.2;
  eye.happy += ((t < eye.happyUntil ? 1 : 0) - eye.happy) * Math.min(1, dt * 10);
  eye.boing = Math.max(0, eye.boing - dt * 1.4);
  eye.open = (bt >= 0 && bt < 1 ? 1 - Math.sin(bt * Math.PI) * .95 : 1) * (1 - eye.happy);
  const idle = now - Math.max(pointerTime, lastScrollTime);
  eye.dil += ((idle > 4000 ? .9 : .45) - eye.dil) * Math.min(1, dt * 2);   // big soft pupils when you stop
  eye.flash = Math.max(0, eye.flash - dt * 1.6);
  // ending: at the bottom the clock runs forward, anywhere else it rewinds fast
  end.t = s >= .992 ? end.t + dt : Math.max(0, end.t - dt * 4);
  end.close = seg(end.t, .2, 1.1); end.eyes = 1 - seg(end.t, 1.3, 2.0);
  end.a = seg(end.t, 1.6, 2.4) * (1 - seg(end.t, 6.2, 6.9)); end.b = seg(end.t, 6.9, 7.7);
  eye.open *= 1 - end.close;
  const T0 = performance.now();
  drawEyes(t);
  const T1 = performance.now();

  // ---------------- letters ----------------
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  spawnN = 0;
  const yMin = sy - 120, yMax = sy + H * 2;
  let lo = 0, hi = words.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (words[m].y < yMin) lo = m + 1; else hi = m; }
  let cur = -1, font = '';
  ctx.textBaseline = 'alphabetic';
  for (let wi = lo; wi < words.length; wi++) {
    const w = words[wi];
    if (w.y > yMax) break;
    const S = styles[w.st];
    const a = clamp01((L - w.h * (1 - WINDOW)) / WINDOW);
    const x0 = w.x - sx, b0 = w.b - sy;
    if (a <= 0) {                                  // intact
      if (w.y - sy > H + 20) continue;
      if (cur !== w.st) { if (font !== S.font) ctx.font = font = S.font; ctx.fillStyle = S.color; cur = w.st; }
      ctx.globalAlpha = 1;
      ctx.fillText(w.s, x0, b0);                   // monospaced: one call per word lands every letter in place
      continue;
    }
    if (a >= 1) continue;                          // dust already
    cur = -1;
    if (font !== S.font) ctx.font = font = S.font;
    ctx.fillStyle = S.color;
    const i = w.i, h1 = hash(i * 11 + 1), h2 = hash(i * 11 + 2), h3 = hash(i * 11 + 3), h4 = hash(i * 11 + 4), h5 = hash(i * 11 + 5), h6 = hash(i * 11 + 6);
    const tr = seg(a, 0, .1), f = seg(a, .06, .7), sep = seg(a, .32, .7), dis = seg(a, .55, .97);
    // the word's flight: lift, drift sideways, float, spin, flip, sometimes rush toward you
    let cx = x0 + w.w / 2, cyy = b0 - S.size * .3;
    cx += (h1 - .5) * W * .9 * f + Math.sin(t * (.4 + h2 * .5) + h3 * 20) * 30 * P * f + wind * h4 * 120 * P * f;
    cyy += -(.15 + h3 * .75) * H * f * (.5 + .5 * f) + Math.cos(t * (.3 + h4 * .4) + h5 * 20) * 22 * P * f - wind * 60 * P * f;
    cyy += Math.sin(t * 31 + h1 * 50) * tr * (1 - f) * 1.2 * P;          // trembling before it lets go
    let rot = (h5 - .5) * 2 * (1 + 5 * h6) * f + Math.sin(t * (.8 + h2) + h3 * 9) * .35 * f + spinAcc * (h4 - .5) * 4 * f;
    rot += Math.sin(t * 23 + h2 * 40) * tr * (1 - f) * .05;
    const toward = h6 > .78 ? (h6 - .78) * 14 : 0;                       // about one word in five flies at you
    let scl = 1 + f * (toward + .35 * h2);
    let flip = Math.cos(f * Math.PI * Math.floor(h4 * 4 + 1) + t * (h1 > .7 ? 1.5 : 0) * f);
    flip = (flip < 0 ? -1 : 1) * Math.max(.06, Math.abs(flip));
    let alpha = 1 - smooth((scl - 2.2) / 2.5);
    // the pointer pushes flying words away
    if (pointer && f > 0) {
      const dx = cx - pointer.x, dy = cyy - pointer.y, d = Math.hypot(dx, dy), R = 140 * P;
      if (d < R && d > 0) { const k = (1 - d / R) ** 2 * 90 * P * f; cx += dx / d * k; cyy += dy / d * k; rot += (1 - d / R) * f; }
    }
    if (alpha <= .01) continue;
    const n = w.s.length;
    const cR = Math.cos(rot), sR = Math.sin(rot);
    for (let j = 0; j < n; j++) {
      const ch = w.s[j], hj = hash(i * 97 + j * 13 + 3), hk = hash(i * 89 + j * 7 + 5);
      // letters drift apart and tumble
      let lx = (j - (n - 1) / 2) * w.cw, ly = 0;
      const ang = hj * TAU, dist = sep * (25 + hk * 160) * P;
      lx += Math.cos(ang) * dist; ly += Math.sin(ang) * dist - sep * sep * hk * 90 * P;
      const crot = sep * ((hj - .5) * 14 + t * (hk - .5) * 6);
      // letter -> word space -> screen
      const qx = lx * scl * flip, qy = ly * scl;
      const X = cx + qx * cR - qy * sR, Y = cyy + qx * sR + qy * cR;
      if (X < -200 || X > W + 200 || Y < -200 || Y > H + 200) continue;
      const lr = rot + crot, cl = Math.cos(lr), sl = Math.sin(lr), lsx = scl * flip, lsy = scl;
      if (dis < 1) {
        ctx.globalAlpha = alpha * (1 - dis) * (1 - dis);
        ctx.setTransform(DPR * cl * lsx, DPR * sl * lsx, -DPR * sl * lsy, DPR * cl * lsy, DPR * X, DPR * Y);
        ctx.fillText(ch, -w.cw / 2, S.size * .3);
      }
      if (dis > 0) {                               // disintegration: its dots scatter and feed the particle field
        const d = dotsOf(S, ch), da = alpha * Math.min(1, dis * 4) * (1 - dis);
        if (da <= .01) continue;
        ctx.globalAlpha = da;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        const dsz = Math.max(1, 1.1 * P);
        const qs = d.length > 60 ? 4 : 2;            // big letters: every other dot is enough
        for (let q = 0, k = 0; q < d.length; q += qs, k++) {
          const hq = hash(i * 131 + j * 17 + k * 7);
          const ox = (d[q] - w.cw / 2) * lsx, oy = (d[q + 1] + S.size * .3) * lsy;
          let DX = X + ox * cl - oy * sl, DY = Y + ox * sl + oy * cl;
          const sa = hq * TAU + t * .5, sd = dis * dis * (20 + hq * 150) * P;
          DX += Math.cos(sa) * sd + wind * dis * 200 * P * hq; DY += Math.sin(sa) * sd - dis * 40 * P * hq;
          ctx.fillRect(DX - dsz / 2, DY - dsz / 2, dsz, dsz);
          if (spawnN < 600 && hq < .15) { spawnX[spawnN] = DX; spawnY[spawnN] = DY; spawnN++; }
        }
      }
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  ctx.globalAlpha = 1;
  // tearing: when you scroll fast, horizontal bands of the letters slip sideways
  const tear = Math.abs(wind);
  if (tear > .12) {
    const bands = 3 + Math.floor(tear * 8);
    for (let b = 0; b < bands; b++) {
      const hb = hash(b * 31 + Math.floor(t * 20)), y = hb * H, h = (6 + hash(b * 17 + Math.floor(t * 20)) * 40) * P;
      const dx = (hash(b * 7 + Math.floor(t * 20)) - .5) * 80 * P * tear;
      ctx.drawImage(tcv, 0, y * DPR, W * DPR, h * DPR, dx, y, W, h);
    }
  }

  const T2 = performance.now();
  // ---------------- particles ----------------
  const active = Math.floor(N * Math.pow(clamp01(L * 1.08), .8));
  const att = seg(L, .04, .62);                  // how strongly the dots obey the eyes
  const total = rowCdf[GH - 1];
  const cw = W / GW, ch = H / GH;
  const ptrOn = pointer && now - pointerTime < 4000;
  const R = 120 * P, R2 = R * R;
  const noiseAmp = (.08 + .55 * (1 - att) + Math.abs(wind) * 1.2) * P;
  const k1 = .035 * att, damp = .86 - Math.abs(wind) * .06;
  // shockwaves
  for (let q = waves.length - 1; q >= 0; q--) if (t - waves[q].t > 1.6) waves.splice(q, 1);
  let nAlive = 0;
  for (let k = 0; k < N; k++) {
    if (k >= active) {
      if (life[k] <= 0) { wasActive[k] = 0; continue; }
      life[k] = Math.max(0, life[k] - dt * 1.5);
    } else {
      if (!wasActive[k]) {                       // born: out of a disintegrating letter if one is on screen
        wasActive[k] = 1; life[k] = 0;
        if (spawnN) { const q = Math.floor(hash(k * 3 + Math.floor(t * 60)) * spawnN); px[k] = spawnX[q]; py[k] = spawnY[q]; }
        else { px[k] = pu[k] * W; py[k] = H + 10; }
        vx[k] = (hash(k + 1) - .5) * 4 * P; vy[k] = -hash(k + 2) * 4 * P;
      }
      life[k] = Math.min(1, life[k] + dt * 1.2);
    }
    // target from the eyes picture (inverse cumulative distribution: stable as the picture moves)
    const r = bsearch(rowCdf, 0, GH - 1, pv[k] * total);
    const r0 = r > 0 ? rowCdf[r - 1] : 0, rowSum = rowCdf[r] - r0;
    const base = r * GW;
    const c = bsearch(cellCdf, base, base + GW - 1, pu[k] * rowSum) - base;
    const tx = (c + pj[k * 2]) * cw, ty = (r + pj[k * 2 + 1]) * ch;
    let x = px[k], y = py[k], ax = (tx - x) * k1, ay = (ty - y) * k1;
    // flow field
    const fa = (Math.sin(x * .0061 / P + t * .31) + Math.sin(y * .0047 / P - t * .23) + Math.sin((x + y) * .0033 / P + t * .17)) * 2.1;
    ax += Math.cos(fa) * noiseAmp; ay += Math.sin(fa) * noiseAmp;
    ay -= wind * 1.4 * P * (.5 + pj[k * 2]);
    if (ptrOn) {                                  // a hand in the sand: push out and swirl
      const dx = x - pointer.x, dy = y - pointer.y, d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / R) ** 2 * 5 * P; ax += (dx / d) * f - (dy / d) * f * .7; ay += (dy / d) * f + (dx / d) * f * .7; }
    }
    for (const wv of waves) {
      const age = t - wv.t, rr = age * 950 * P, dx = x - wv.x, dy = y - wv.y, d = Math.hypot(dx, dy);
      const g = 1 - Math.abs(d - rr) / (70 * P);
      if (g > 0 && d > 0) { const f = g * 9 * P * (1 - age / 1.6); ax += dx / d * f; ay += dy / d * f; }
    }
    vx[k] = vx[k] * damp + ax; vy[k] = vy[k] * damp + ay;
    x += vx[k]; y += vy[k];
    px[k] = x; py[k] = y;
    const li = life[k];
    if (li <= 0) continue;
    // colour: the picture's colour where the dot sits, brighter when it is home
    const gx = Math.min(GW - 1, Math.max(0, Math.floor(x / cw))), gy = Math.min(GH - 1, Math.max(0, Math.floor(y / ch))), gi = gy * GW + gx;
    const home = 1 - Math.min(1, Math.hypot(tx - x, ty - y) / (60 * P));
    const m = .35 + .65 * home * att;
    const o = nAlive * 4;
    pos[nAlive * 2] = x; pos[nAlive * 2 + 1] = y;
    col[o] = colR[gi] * m + 40 * (1 - m); col[o + 1] = colG[gi] * m + 120 * (1 - m); col[o + 2] = colB[gi] * m + 95 * (1 - m);
    col[o + 3] = Math.min(255, li * (170 + 85 * Math.min(1, dens[gi] * 3)));
    nAlive++;
  }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  if (nAlive) {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufP); gl.bufferData(gl.ARRAY_BUFFER, pos.subarray(0, nAlive * 2), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufC); gl.bufferData(gl.ARRAY_BUFFER, col.subarray(0, nAlive * 4), gl.DYNAMIC_DRAW);
    gl.uniform2f(locRes, W, H); gl.uniform1f(locSize, Math.max(2.2, 2.4 * P) * DPR);
    const split = Math.min(1, Math.abs(wind) * 2.5 + eye.flash * .6) * 7 * P;
    if (split > .5) {                              // chromatic split while the wind blows (or after a click)
      gl.uniform2f(locOff, split, 0); gl.uniform3f(locTint, .72, .64, .94); gl.drawArrays(gl.POINTS, 0, nAlive);
      gl.uniform2f(locOff, -split, 0); gl.uniform3f(locTint, .1, .9, 1); gl.drawArrays(gl.POINTS, 0, nAlive);
      gl.uniform3f(locTint, .55, .55, .55);
    } else gl.uniform3f(locTint, 1, 1, 1);
    gl.uniform2f(locOff, 0, 0); gl.drawArrays(gl.POINTS, 0, nAlive);
  }
  const T3 = performance.now();
  const pr = window.__prof || (window.__prof = { eyes: 0, text: 0, parts: 0 });
  pr.eyes += (T1 - T0 - pr.eyes) * .1; pr.text += (T2 - T1 - pr.text) * .1; pr.parts += (T3 - T2 - pr.parts) * .1; pr.n = N;
  if (!REC) requestAnimationFrame(frame);
}

let rt = 0;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
// wait for the page's own fonts (over file:// they can arrive after fonts.ready), then measure;
// measure again whenever the layout height changes (a late font, a zoom)
const fontsLoaded = Promise.all(['12px "Space Mono"', 'bold 12px "Space Mono"', '12px VT323'].map(f => document.fonts.load(f).catch(() => {})))
  .then(() => document.fonts.ready);
let laidOutH = 0;
new ResizeObserver(() => {
  const h = document.documentElement.scrollHeight;
  if (W && Math.abs(h - laidOutH) > 2) { laidOutH = h; clearTimeout(rt); rt = setTimeout(measure, 100); }
}).observe(document.body);
fontsLoaded.then(() => {
  glInit(); resize(); lastSY = scrollY; laidOutH = document.documentElement.scrollHeight;
  if (!REC) { requestAnimationFrame(frame); return; }
  // the video: 2 s at the top, 13 s down to the bottom, then the ending (eyes close, the sentence, FIT: 0%); 24 s = 720 frames
  // ?rec=radar: the grid video, the cover standing still while the radar turns (4 s = one turn, 120 frames, seamless)
  const radar = Q.get('rec') === 'radar';
  const sOf = tt => radar || tt < 2 ? 0 : tt > 15 ? 1 : smooth((tt - 2) / 13);
  const clicks = radar ? [] : [[12.6, .3, .45], [13.9, .7, .55]];   // two clicks (x, y as parts of the screen): the eyes smile
  window.__rec = i => {
    for (let k = 0; k < 2; k++) {                              // two 60 fps steps per 30 fps frame
      const tt = (i * 2 + k) / 60;
      simNow = tt * 1000;
      scrollTo(0, Math.round(sOf(tt) * (document.documentElement.scrollHeight - innerHeight)));
      for (const c of clicks) if (Math.abs(tt - c[0]) < 1 / 120)
        dispatchEvent(new PointerEvent('pointerdown', { clientX: c[1] * W, clientY: c[2] * H }));
      frame(simNow);
    }
    // CSS animations (radar sweep, blinking cursor) follow the simulated clock too
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = simNow; }
    return true;
  };
  window.__ready = true;
});
})();
