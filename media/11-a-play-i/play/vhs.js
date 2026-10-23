// VHS static for Super Easy Apply.
// A tape losing its signal: it keeps cutting, at random moments, between five looks
//   0 pink/blue picture drowning in snow (reference 3 of the first brief)
//   1 saturated rainbow streaks on black            (attachment 1)
//   2 wavy vertical colour bars under heavy grain    (attachment 2)
//   3 dark: coloured grain in big dark/bright patches (attachment 3, without the black ripples)
//   4 grey snow with ripples                         (attachment 4, without the black bars)
// and on top: sync jitter, a wandering tracking bar, head-switching noise at the bottom, dropouts,
// tape creases, flagging, vertical roll, blue/black frames.
// Nothing repeats: the schedule comes from a seeded random generator (a new seed per visit).

(function () {
const VHS_GLSL = /* glsl */`
uniform float uMode, uPrevMode, uModeT, uSeed;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(float a, float b, float c){
  uint h = pcg(uint(int(a) + 100000) + pcg(uint(int(b) + 100000) + pcg(uint(int(c + uSeed) + 100000))));
  return float(h) / 4294967295.0;
}
float lineNoise(float x, float line, float fr, float seed){
  float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(rnd(i, line, fr + seed), rnd(i + 1.0, line, fr + seed), f);
}
float sn(float x, float seed){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(rnd(i, seed, 0.0), rnd(i + 1.0, seed, 0.0), f); }
vec3 toYIQ(vec3 c){ return vec3(dot(c, vec3(0.299, 0.587, 0.114)), dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312))); }
vec3 toRGB(vec3 y){ return vec3(y.x + 0.956 * y.y + 0.621 * y.z, y.x - 0.272 * y.y - 0.647 * y.z, y.x - 1.106 * y.y + 1.703 * y.z); }
vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

// the look of each mode at tape position (x, vy) on tape line 'line', video frame 'fr'
vec3 look(float mode, float x, float vy, float line, float fr, float t){
  float snow = pow(lineNoise(x * 330.0, line, fr, 0.0) * 0.75 + rnd(floor(x * 900.0), line, fr) * 0.25, 1.35);
  vec3 grain = vec3(rnd(floor(x * 700.0), line, fr + 0.3), rnd(floor(x * 700.0), line, fr + 50.0), rnd(floor(x * 700.0), line, fr + 90.0));
  if (mode < 0.5) {                                   // 0: pink/blue picture drowning in snow
    float y = vy + sin(x * 3.0 + vy * 7.0) * 0.03;
    vec3 pic = mix(vec3(0.20, 0.25, 0.85), vec3(0.95, 0.55, 0.95), smoothstep(0.55, 0.95, y));
    pic = mix(pic, vec3(0.10, 0.55, 0.70), smoothstep(0.35, 0.15, abs(y - 0.3)) * 0.6);
    float cl = line / 6.0, cf = fract(cl); cf = cf * cf * (3.0 - 2.0 * cf);
    float cx = x * 40.0 - 0.6;
    vec2 cn = mix(vec2(lineNoise(cx, floor(cl), floor(fr / 2.0), 9.0), lineNoise(cx, floor(cl), floor(fr / 2.0), 19.0)),
                  vec2(lineNoise(cx, floor(cl) + 1.0, floor(fr / 2.0), 9.0), lineNoise(cx, floor(cl) + 1.0, floor(fr / 2.0), 19.0)), cf) - 0.5;
    vec3 yiq = toYIQ(pic);
    return toRGB(vec3(mix(yiq.x, snow, 0.7), mix(yiq.yz * 1.3, cn * 0.5, 0.5)));
  }
  if (mode < 1.5) {                                   // 1: rainbow streaks on black
    float seg = floor(x * (4.0 + 10.0 * rnd(line, 3.0, fr)) + rnd(line, 4.0, fr) * 7.0);
    vec3 c = hue(rnd(seg, floor(line / 2.0), fr + 5.0));
    float lum = pow(lineNoise(x * 60.0, line, fr, 7.0), 2.0) * 1.6 + snow * 0.5;
    vec3 col = c * lum * (0.35 + 0.9 * grain);
    col *= step(0.12, rnd(floor(x * 3.0), line, fr + 8.0));          // black gaps in the streaks
    float low = smoothstep(0.22, 0.12, vy);                           // the dark blue bands at the bottom
    vec3 blue = vec3(0.12, 0.10, 0.75) * step(0.5, fract(vy * 38.0 + sn(x * 4.0 + t, 3.0))) * (0.6 + 0.6 * snow);
    return mix(col, blue + col * 0.25, low);
  }
  if (mode < 2.5) {                                   // 2: wavy vertical colour bars
    float zz = abs(fract(vy * 1.6 + t * 0.4) - 0.5) * 2.0;                 // zig-zag like a bent test pattern
    float w = x * 3.6 + (zz - 0.5) * 0.45 + sin(vy * 17.0 - t * 4.0) * 0.05 + (sn(vy * 20.0, 11.0) - 0.5) * 0.15
            + (rnd(line, fr, 13.0) - 0.5) * 0.10 + (rnd(floor(x * 200.0), line, fr + 14.0) - 0.5) * 0.06;
    float b = floor(w);
    vec3 pal = b < 1.0 ? vec3(0.15, 0.85, 0.25) : b < 2.0 ? vec3(0.25, 0.35, 1.0) : b < 3.0 ? vec3(0.65, 0.25, 0.95) : vec3(0.95, 0.20, 0.30);
    vec3 col = pal * (0.25 + 1.1 * snow) + (grain - 0.5) * 0.9;
    return col;
  }
  if (mode < 3.5) {                                   // 3: mostly black, coloured grain, black ripples
    vec3 col = grain * grain * (0.5 + 1.2 * snow) * vec3(1.0, 0.8, 1.1);
    col *= 0.55 + 0.9 * sn(vy * 3.0 - t, 24.0);                       // big dark/bright patches
    return col;
  }
  // 4: grey snow with black bars and ripples
  float g = pow(snow, 1.1) * 1.25;
  g *= 0.85 + 0.3 * sin(vy * (70.0 + 30.0 * sn(t * 0.5, 33.0)) + sin(x * 5.0 + t * 6.0) * 1.5 + sn(vy * 8.0 + t, 34.0) * 4.0);  // ripples
  return vec3(g);
}

vec3 vhs(vec2 uv, float t){
  const float LINES = 480.0;
  float fr = floor(t * 30.0);
  // irregular accident windows: two clocks at unrelated rates
  float eA = floor(t * 3.1 + sn(t * 0.7, 40.0) * 2.0), eB = floor(t * 1.7 + 0.37);
  // vertical roll
  float rollOn = step(0.8, rnd(eB, 1.0, 1.0));
  float vy = uv.y + rollOn * fract(t * 1.7 + 0.37) * (0.5 + rnd(eB, 1.0, 2.0));
  
  vy = fract(vy);
  float line = floor(vy * LINES);
  // horizontal disturbances
  float jit = (rnd(line, fr, 1.0) - 0.5) * 0.003;
  float trackY = sn(t * 0.45, 2.0) * 1.2 - 0.1;                        // wanders, never periodic
  float trk = smoothstep(0.06 + 0.05 * sn(t, 3.0), 0.0, abs(vy - trackY));
  float trkShift = trk * (rnd(line, fr, 3.0) - 0.3) * 0.09;
  float hsw = smoothstep(0.035, 0.0, vy);
  float hswShift = hsw * (0.03 + 0.05 * rnd(fr, 4.0, 4.0));
  float creaseY = rnd(eA, 3.0, 6.0) * 0.8 + 0.1;
  float crease = step(0.6, rnd(eA, 3.0, 7.0)) * smoothstep(0.012, 0.0, abs(vy - creaseY - sin(uv.x * 9.0 + t * 3.0) * 0.004));
  float flag = step(0.7, rnd(eA, 4.0, 2.0)) * pow(smoothstep(0.82, 1.0, vy), 2.0) * (0.06 + 0.08 * rnd(eA, 4.0, 1.0));
  float ripple = step(0.75, rnd(eA, 9.0, 1.0)) * sin(vy * 40.0 + t * 12.0) * 0.012;
  float x = uv.x + jit + trkShift + hswShift + flag + crease * 0.03 + ripple;
  // organic change: a leading look holds the screen for a few seconds, then the next one creeps in
  // across it in patches while the old one dissolves; a third look ghosts through at low opacity.
  // Order and pace are irregular (every look gets its turn, never the same one twice in a row).
  float tt = t / 4.2 + 0.9 * sn(t * 0.13, 80.0);
  float ep = floor(tt), f = fract(tt);
  float mA = mod(2.0 * ep + step(0.5, rnd(ep, 70.0, 0.0)), 5.0);
  float mB = mod(2.0 * (ep + 1.0) + step(0.5, rnd(ep + 1.0, 70.0, 0.0)), 5.0);
  float mC = mod(2.0 * (ep + 2.0) + step(0.5, rnd(ep + 2.0, 70.0, 0.0)), 5.0);
  float patchN = sn(x * 2.5 + sn(vy * 3.0 + t * 0.3, 81.0) * 3.0 + vy * 1.7 + t * 0.2, 82.0);
  float blend = smoothstep(0.0, 1.0, (f - 0.5) / 0.5 * 1.7 - 0.35 + (patchN - 0.5) * 0.9);
  vec3 col = mix(look(mA, x, vy, line, fr, t), look(mB, x, vy, line, fr, t), blend);
  float ghost = 0.35 * smoothstep(0.55, 0.9, sn(t * 0.5 + vy * 2.0, 83.0));
  col = mix(col, look(mC, x, vy, line, fr, t), ghost);
  float mode = blend > 0.5 ? mB : mA;
  // tracking bar, head switch and creases are extra noisy
  float nz = clamp(trk * 0.8 + hsw * 0.7 + crease, 0.0, 1.0);
  float snow = lineNoise(x * 330.0, line, fr, 60.0);
  col = mix(col, vec3(snow) * (mode > 3.5 ? 1.0 : 0.9) + (mode > 3.5 ? 0.0 : 0.1) * col, nz);
  // dropouts
  float dLen = 8.0 + 60.0 * rnd(line, fr, 12.0);
  float dOn = step(0.9975 - trk * 0.02, rnd(floor(x * 1440.0 / dLen), line, fr + 21.0));
  col = mix(col, vec3(1.05), dOn);
  col *= 1.0 + (rnd(fr, 8.0, 8.0) - 0.5) * 0.14;                      // AGC flicker
  col *= 0.88 + 0.12 * sin(uv.y * 1440.0 * 3.14159 * 0.5);             // scanlines
  float blip = floor(t * 15.0);
  col = mix(col, vec3(0.05, 0.12, 0.85) * (0.9 + 0.1 * snow), step(0.988, rnd(blip, 30.0, 1.0)));
  col = mix(col, vec3(0.02) + snow * 0.05, step(0.985, rnd(blip, 31.0, 1.0)));
  return clamp(col, 0.0, 1.0);
}`;

// seeded schedule of looks: random durations, never the same look twice in a row
function makeSchedule(seed, length = 60) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const segs = []; let t = 0, prev = -1;
  while (t < length) {
    let m; do { m = Math.floor(r() * 5); } while (m === prev);
    const d = 0.12 + Math.pow(r(), 1.6) * 0.9;
    segs.push({ start:t, mode:m, prev: prev < 0 ? m : prev }); prev = m; t += d;
  }
  return segs;
}
// set the uniforms for time t
function applySchedule(segs, t, u) {
  let i = 0; while (i + 1 < segs.length && segs[i + 1].start <= t) i++;
  u.uMode.value = segs[i].mode; u.uPrevMode.value = segs[i].prev; u.uModeT.value = t - segs[i].start;
}
function vhsUniforms(seed) {
  return { uMode:{ value:0 }, uPrevMode:{ value:0 }, uModeT:{ value:1 }, uSeed:{ value: seed % 9973 } };
}

window.VHS = { GLSL: VHS_GLSL, makeSchedule, applySchedule, uniforms: vhsUniforms };
})();
