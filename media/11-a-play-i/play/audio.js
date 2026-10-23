// A-play-I sound: everything synthesised with Web Audio, no files.
// Music on the chords C - Am - F - G (one bar each).
//   lobby  (screens 1-6): calm, 96 BPM, pad + arpeggio + soft beat
//   dance  (screen 7):    fanfare, then a club groove at the Tempo of the dance sliders
// The whole mix goes through a "degradation" chain (bit crusher + low pass + rising TV hiss),
// driven by APA.setDegrade(0..1) together with the picture.
// Browsers start audio only after a click: APA.init() is called from the first click (START).

(function () {
const A = { ctx:null, on:false };
const CHORDS = [                       // bar % 4: bass (MIDI), pad, arpeggio tones
  { bass:36, pad:[60, 64, 67], arp:[60, 64, 67, 72] },   // C
  { bass:45, pad:[57, 60, 64], arp:[57, 60, 64, 69] },   // Am
  { bass:41, pad:[57, 60, 65], arp:[53, 57, 60, 65] },   // F
  { bass:43, pad:[55, 59, 62], arp:[55, 59, 62, 67] },   // G
];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

let mode = 'off', bpm = 96, t0 = 0, b0 = 0, nextStep = 0, chaos = 0, deg = 0, crushBits = 0, timer = null;
let musicGain, sfxGain, pre, crusher, lowpass, master, hissGain, noiseBuf;

function init() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  const ctx = A.ctx = new C();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 20000; lowpass.Q.value = 0.7; lowpass.connect(master);
  crusher = ctx.createWaveShaper(); crusher.connect(lowpass);
  pre = ctx.createGain(); pre.connect(crusher);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(pre);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(pre);
  // white noise, used for drums, whooshes and the TV hiss
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
  const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 900;
  hissGain = ctx.createGain(); hissGain.gain.value = 0;
  hiss.connect(hf); hf.connect(hissGain); hissGain.connect(master); hiss.start();
  A.on = true;
  timer = setInterval(schedule, 25);
}

// ---------- clock shared with the picture ----------
function beatAt(time) { return b0 + (time - t0) * bpm / 60; }
function timeOf(beat) { return t0 + (beat - b0) * 60 / bpm; }
function setBpm(v) {
  if (!A.ctx) { bpm = v; return; }
  const now = A.ctx.currentTime; b0 = beatAt(now); t0 = now; bpm = v;
}
function beatNow() { return A.ctx && mode === 'dance' ? beatAt(A.ctx.currentTime) : null; }

// ---------- instruments ----------
function env(g, t, a, peak, dec, sus, rel, len) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(peak * sus, 0.0001), t + a + dec);
  g.gain.setValueAtTime(Math.max(peak * sus, 0.0001), t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + rel);
}
function wobble() { return (Math.random() - 0.5) * deg * 90; }    // detune in cents: the tape gets wobbly
function tone(type, m, t, len, vol, opt = {}) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz(m); o.detune.value = (opt.detune || 0) + wobble();
  let out = o;
  if (opt.cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opt.cut, t);
    if (opt.cutEnd) f.frequency.exponentialRampToValueAtTime(opt.cutEnd, t + len); f.Q.value = opt.q || 1; o.connect(f); out = f; }
  out.connect(g); g.connect(opt.bus || musicGain);
  env(g, t, opt.a || 0.005, vol, opt.d || 0.08, opt.s ?? 0.6, opt.r || 0.08, len);
  o.start(t); o.stop(t + len + (opt.r || 0.08) + 0.05);
}
function noise(t, len, vol, type, freq, q, bus) {
  const ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  s.connect(f); f.connect(g); g.connect(bus || musicGain);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.start(t, Math.random() * 1.5); s.stop(t + len + 0.02);
}
function kick(t, vol = 0.9) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.35);
}
const hat = (t, vol = 0.12, len = 0.04) => noise(t, len, vol, 'highpass', 8000, 0.7);
const clap = (t, vol = 0.35) => { noise(t, 0.12, vol, 'bandpass', 1600, 1.2); noise(t + 0.012, 0.1, vol * 0.7, 'bandpass', 1200, 1.2); };
function pad(chord, t, len, vol) {
  for (const m of chord.pad) for (const dt of [-7, 7]) tone('sawtooth', m, t, len, vol, { a:0.35, d:0.4, s:0.7, r:0.6, cut:1300, detune:dt });
}

// ---------- the sequencer: one call per 16th note ----------
function step(beat, t) {
  const s = Math.round(beat * 4), bar = Math.floor(s / 16), i = ((s % 16) + 16) % 16, ch = CHORDS[((bar % 4) + 4) % 4];
  if (mode === 'lobby') {
    if (i === 0) { pad(ch, t, timeOf(beat + 4) - t, 0.045); tone('sine', ch.bass, t, 1.6, 0.25, { a:0.02, s:0.5 }); }
    if (i % 2 === 0) { const m = ch.arp[(i / 2) % 4] + 12; tone('triangle', m, t, 0.18, 0.09, { r:0.25 }); }
    if (i === 0 || i === 8) kick(t, 0.45);
    if (i % 4 === 2) hat(t, 0.05);
  } else if (mode === 'dance') {
    if (i % 4 === 0) kick(t, 0.95);
    if (i === 4 || i === 12) clap(t);
    if (i % 4 === 2) hat(t, 0.16, 0.06);
    else if (chaos > 0.3 && i % 2 === 1) hat(t, 0.06);
    if (i % 2 === 0) tone('sawtooth', ch.bass + (i % 4 === 2 ? 12 : 0), t, 0.12, 0.22, { cut:900, cutEnd:250, q:4, s:0.4 });
    if (i % 4 === 2) for (const m of ch.pad) tone('square', m + 12, t, 0.08, 0.035, { cut:3000, s:0.3 });
    if (i % 2 === 1 || chaos > 0.5) {
      let m = ch.arp[(i * 3) % 4] + 24;
      if (Math.random() < chaos * 0.6) m += [0, 3, 5, 7, 10, 12, -12][Math.floor(Math.random() * 7)];
      tone('square', m, t, 0.05, 0.03 + chaos * 0.02, { cut:4000, s:0.2 });
    }
    if (i === 0) pad(ch, t, timeOf(beat + 4) - t, 0.02);
    // chaos: stutters and laser zaps
    if (Math.random() < chaos * 0.12) for (let k = 0; k < 4; k++) kick(t + k * 0.03, 0.4);
    if (Math.random() < chaos * 0.08) { const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.25);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.3); }
  }
}
function schedule() {
  if (!A.ctx || mode === 'off') return;
  const now = A.ctx.currentTime;
  if (timeOf(nextStep) < now - 0.05) nextStep = Math.ceil(beatAt(now) * 4) / 4;   // fell behind (tab hidden): skip ahead
  while (timeOf(nextStep) < now + 0.12) { step(nextStep, timeOf(nextStep)); nextStep += 0.25; }
}
function start(m, newBpm, delay = 0.05) {
  mode = m; if (!A.ctx) { bpm = newBpm; return; }
  const now = A.ctx.currentTime + delay; t0 = now; b0 = 0; bpm = newBpm; nextStep = 0;
}

// ---------- screens ----------
function lobby() { start('lobby', 96); }
function dance(newBpm) {
  if (!A.ctx) { mode = 'dance'; bpm = newBpm; return; }
  const t = A.ctx.currentTime + 0.03;
  // fanfare: C E G C, then the chord
  [60, 64, 67, 72].forEach((m, k) => { tone('square', m, t + k * 0.09, 0.12, 0.09, { cut:2800, bus:sfxGain }); tone('sawtooth', m - 12, t + k * 0.09, 0.12, 0.06, { cut:1800, bus:sfxGain }); });
  for (const m of [60, 64, 67, 72]) tone('sawtooth', m, t + 0.38, 0.55, 0.06, { cut:3200, cutEnd:900, bus:sfxGain, r:0.3 });
  noise(t + 0.38, 0.9, 0.08, 'bandpass', 3000, 0.5, sfxGain);
  start('dance', newBpm, 1.05);
}
function stop() { mode = 'off'; }
function pause() { if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); }      // the game left the view
function resume() { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); }

// ---------- degradation ----------
function crushCurve(bits) {
  const n = 2048, c = new Float32Array(n), q = Math.pow(2, bits - 1);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.round(x * q) / q; }
  return c;
}
function setDegrade(v) {
  deg = Math.max(0, Math.min(1, v));
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  const bits = deg < 0.08 ? 0 : Math.max(2, Math.round(12 - deg * 10));
  if (bits !== crushBits) { crushBits = bits; crusher.curve = bits ? crushCurve(bits) : null; }
  lowpass.frequency.setTargetAtTime(20000 * Math.pow(0.04, Math.pow(deg, 1.2)), t, 0.2);   // 20 kHz -> 800 Hz
  const s = Math.max(0, Math.min(1, (deg - 0.3) / 0.7));
  hissGain.gain.setTargetAtTime(0.32 * s * s * (3 - 2 * s), t, 0.3);
  musicGain.gain.setTargetAtTime(0.55 * (1 - 0.85 * Math.max(0, (deg - 0.5) / 0.5)), t, 0.3);
}
function setChaos(v) { chaos = v; }

// ---------- interface sounds ----------
const sfx = {
  click() { if (!A.on) return; const t = A.ctx.currentTime; tone('square', 79, t, 0.03, 0.08, { bus:sfxGain, cut:4000 }); tone('square', 86, t + 0.035, 0.04, 0.07, { bus:sfxGain, cut:4000 }); },
  select(on) { if (!A.on) return; const t = A.ctx.currentTime, [a, b] = on ? [72, 79] : [79, 72];
    tone('triangle', a, t, 0.05, 0.12, { bus:sfxGain }); tone('triangle', b, t + 0.05, 0.07, 0.12, { bus:sfxGain }); },
  tick(k) { if (!A.on) return; tone('triangle', 64 + k * 2, A.ctx.currentTime, 0.025, 0.09, { bus:sfxGain, s:0.3 }); },
  key() { if (!A.on) return; noise(A.ctx.currentTime, 0.03, 0.15, 'bandpass', 3500, 2, sfxGain); },
  whoosh() { if (!A.on) return; const ctx = A.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + 0.4); },
  sparkle() { if (!A.on) return; const t = A.ctx.currentTime; for (let k = 0; k < 7; k++) tone('sine', 84 + [0, 4, 7, 11, 12, 16, 19][k], t + k * 0.04, 0.06, 0.06, { bus:sfxGain, r:0.3 }); },
};

window.APA = { init, lobby, dance, stop, pause, resume, setBpm, beatNow, setDegrade, setChaos, sfx, get running() { return A.on; } };
})();
