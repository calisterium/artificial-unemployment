// MATCH CATCH (work 07) - stage 2: the interaction. Needs mc.js (scene, symbols, papers).
// The game is a small deterministic machine: MCG.step(dt) advances it, MCG.draw(ctx) paints it with MC.drawScene.
// Every number Carlos may want to tune lives in T (see DEFAULTS); game.html shows them in a bar.
(function (root) {
  'use strict';
  const MC = root.MC, CFG = MC.CFG, g = CFG.glass, C = CFG.candidate;

  // ---------------------------------------------------------------- tuning
  // "0" = first job description, "1" = the last one (the 10th); the jobs in between are interpolated in a straight line.
  const DEFAULTS = {
    speed0: 150, speed1: 500,      // fall speed, sketch pixels per second (the glass is 2372 high)
    spawn0: 1.5, spawn1: 0.55,     // average seconds between two new candidates
    max0: 3, max1: 9,              // most candidates on screen
    match: 30,                     // % of candidates that match the paper
    press: 0.22,                   // seconds the arm takes to press and come back
    hitFlash: 0.25, reach: 0.4, drag: 0.5, merge: 0.45,   // the catch, step by step (seconds)
    paper: 1.4,                    // the whole paper change (seconds)
    faultFlash: 0.6,               // seconds of purple after a fault
    wave: 4,                       // degrees the alien hands sway while waiting
    botError: 0                    // auto-play only: % of catches where it presses the wrong button
  };
  const T = Object.assign({}, DEFAULTS);

  const SPAWN_Y = g.y + CFG.hudH - C.h;   // a new candidate starts hidden behind the score strip
  const EXIT_Y = 2360;                    // top of the head goes behind the buttons: the candidate has left
  const GAP = 640;                        // least distance between two candidates of the same column
  const JOBS = 10;                        // catches needed to win (mc.js has 20 papers; the first 10 are used)

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (t, a, b) => Math.max(a, Math.min(b, t));
  const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
  const part = (t, d) => (d > 0 ? clamp(t / d, 0, 1) : 1);    // how far into a stretch of d seconds (a stretch of 0 is over at once)
  const same = (a, b) => a.length === b.length && a.every((s, k) => s === b[k]);

  // ---------------------------------------------------------------- hand poses
  const POSE_KEYS = ['x', 'y', 's', 'elbow', 'wrist', 'grip', 'wave', 'phase', 'stretch'];
  const POSE_DEF = { s: 1, stretch: 1 };
  function lerpPose(a, b, t) {
    const o = { flip: a.flip };
    POSE_KEYS.forEach(k => { const d = POSE_DEF[k] || 0, va = a[k] == null ? d : a[k], vb = b[k] == null ? d : b[k]; o[k] = lerp(va, vb, t); });
    const a0 = a.a0 == null ? -36 : a.a0, b0 = b.a0 == null ? -36 : b.a0;
    o.a0 = a0 + (((b0 - a0) % 360 + 540) % 360 - 180) * t;     // the short way round
    return o;
  }
  const PALM = 1090;                       // place along the arm where things are held
  const palm = p => MC.handPoint(p, PALM, 0);
  // how much the arm must lengthen for the palm to get d away from the shoulder
  const stretchFor = (d, s) => clamp((d / 0.93 - 190 * s) / (900 * s), 1, 2.4);
  function reachTo(base, tx, ty, extra) {
    const d = Math.hypot(tx - base.x, ty - base.y);
    return reachPose(Object.assign({}, base, { stretch: stretchFor(d, base.s || 1) }), tx, ty, extra);
  }
  // same search as MC.reachPose (direction of the arm + elbow bend that put the palm on the target), coarse first and
  // then fine around the best, so that a catch does not make the game stutter
  function reachPose(base, tx, ty, extra) {
    let best = null;
    const tryIt = (a0, elbow) => {
      const p = Object.assign({}, base, extra, { a0, elbow }), q = MC.handPoint(p, PALM, 0);
      const d = Math.hypot(q.x - tx, q.y - ty) + Math.abs(elbow) * 0.4;
      if (!best || d < best.d) best = { d, p };
    };
    for (let a0 = -180; a0 < 180; a0 += 12) for (let elbow = -100; elbow <= 100; elbow += 25) tryIt(a0, elbow);
    const c = best.p;
    for (let a0 = c.a0 - 10; a0 <= c.a0 + 10; a0 += 2) for (let elbow = c.elbow - 20; elbow <= c.elbow + 20; elbow += 5) tryIt(a0, clamp(elbow, -100, 100));
    return best.p;
  }
  const shifted = (p, dx, more) => Object.assign({}, p, { x: p.x + dx }, more);

  let REST, PAPER0, R1, R2, L1, LOUT, WIN_HANDS;
  const GRAB_R = { x: 60, y: -30 }, GRAB_L = { x: -150, y: 20 };   // palm relative to the centre of the sheet
  function prepare() {
    REST = MC.HANDS_REST;
    PAPER0 = MC.paperCentre(null);
    R1 = reachTo(REST[1], PAPER0.x + GRAB_R.x, PAPER0.y + GRAB_R.y, { wrist: 10, grip: 38 });
    R2 = shifted(R1, 1900);
    L1 = reachTo(REST[0], PAPER0.x + GRAB_L.x, PAPER0.y + GRAB_L.y, { wrist: -8, grip: 38 });
    LOUT = shifted(L1, -1900);
    WIN_HANDS = [shifted(REST[0], -80), shifted(REST[1], 80)];
  }

  // ---------------------------------------------------------------- state
  let S = null;
  const START = { top: 620, title: 'MATCH CATCH', titleSize: 380, titleColor: '#ff5468', lineSize: 150,
                  lines: ['PRESS 1, 2 OR 3 TO CATCH', 'THE CANDIDATE WHO MATCHES', 'THE JOB DESCRIPTION!'], button: 'START' };
  const OVER = { title: 'YOU LOST', titleColor: '#ff5468', lines: ['SCORE 00'], button: 'RESTART' };
  const WIN = { title: 'YOU WON', below: 'YOU ROCK', button: 'RESTART' };

  function reset(seed) {
    seed = seed == null ? (Date.now() & 0xffffff) : seed;
    S = { mode: 'start', seed, rnd: MC.rng(seed), botRnd: MC.rng(seed ^ 0x5bd1e995), time: 0, idle: 0,
          job: 0, code: MC.PAPERS[0], score: 0, faults: 0,
          open: false,            // true while the paper on the desk is waiting for its candidate
          cands: [], absorbed: [], spawnIn: 0, press: null, flash: 0, overIn: 0, seq: null,
          hands: [REST[0], REST[1]], sway: [0, 0], held: null, paperPose: null, showPaper: true,
          auto: S ? S.auto : false, botIn: 0, events: [] };
  }
  const emit = name => { S.events.push(name); if (S.events.length > 64) S.events.shift(); if (MCG.onEvent) MCG.onEvent(name, S); };
  const level = () => (JOBS > 1 ? S.job / (JOBS - 1) : 0);
  const speed = () => lerp(T.speed0, T.speed1, level());
  const maxOn = () => clamp(Math.round(lerp(T.max0, T.max1, level())) || 0, 1, 3 * CFG.lanes);
  const laneX = c => g.x + (c.lane + 0.5) * g.w / CFG.lanes + (c.dx || 0);

  function start() {
    if (S.mode !== 'start') reset();
    S.mode = 'play'; S.open = true; S.spawnIn = 0.4; S.idle = 0; emit('start');
  }
  // for tuning: go straight to a job (0-9) as if the earlier ones had been caught
  function jumpTo(job) {
    const auto = S.auto; reset(); S.auto = auto;
    S.job = clamp(job | 0, 0, JOBS - 1); S.code = MC.PAPERS[S.job]; S.score = S.job;
    S.absorbed = MC.PAPERS.slice(0, S.job).map(code => ({ code }));
    start();
  }

  // ---------------------------------------------------------------- rules
  function trySpawn() {
    if (S.cands.length >= maxOn()) return;
    const free = [];
    for (let l = 0; l < CFG.lanes; l++) {
      const mine = S.cands.filter(c => c.lane === l);
      if (mine.length < 3 && mine.every(c => c.y - SPAWN_Y >= GAP)) free.push(l);
    }
    if (!free.length) return;
    const lane = free[Math.floor(S.rnd() * free.length)], match = S.rnd() * 100 < T.match;
    S.cands.push({ lane, dx: Math.round((S.rnd() * 2 - 1) * 55), y: SPAWN_Y, match,
                   code: match ? S.code.slice() : MC.decoy(S.code, S.rnd) });
  }
  // "match" always means: the same five symbols as the paper that is on the desk NOW. A candidate left over from the
  // paper before is never a match of the new one (any two papers differ in at least 3 places).
  const isMatch = c => same(c.code, S.code);
  const rematch = () => S.cands.forEach(c => { c.match = isMatch(c); });
  const lowest = k => S.cands.filter(c => c.lane === k && !c.frozen).sort((a, b) => b.y - a.y)[0];

  function press(k) {
    if (S.mode !== 'play' || k < 0 || k > 2) return;
    S.press = { k, t: 0 }; emit('press');
    if (!S.open) return;                       // between two papers the buttons catch nothing
    const c = lowest(k);
    if (!c) return;                            // empty column: nothing happens
    if (isMatch(c)) catchIt(c); else { c.state = 'miss'; c.frozen = true; c.gone = T.faultFlash; fault('wrong'); }
  }
  function fault(why) {
    S.faults++; S.flash = T.faultFlash; emit(why === 'wrong' ? 'faultWrong' : 'faultLost');
    if (S.faults >= 3) { S.open = false; S.overIn = Math.max(T.faultFlash, 1e-6); }   // (never 0: 0 would mean "no game over is coming")
  }
  function catchIt(c) {
    S.open = false; S.score++; c.state = 'hit'; c.k = 0; c.frozen = true; emit('hit');
    const cx = laneX(c), side = cx >= g.x + g.w / 2 ? 1 : -1, hand = side > 0 ? 1 : 0;
    const base = { x: side > 0 ? 2900 : MC.W - 2900, y: c.y + 590, s: 0.86, flip: side > 0 };
    const p1 = reachTo(base, cx + side * 60, c.y + 340, { wrist: 8 });
    const p2 = shifted(p1, (side > 0 ? 2390 : MC.W - 2390) - (cx + side * 60), { wrist: 14, grip: 62 });
    const pm = palm(p1), centre = { x: cx, y: c.y + C.h / 2 };
    // from: where the two hands are now (one may still be on its way home from laying the paper down)
    S.seq = { type: 'catch', t: 0, c, side, hand, p1, p2, off: { x: centre.x - pm.x, y: centre.y - pm.y }, phase: 0, from: S.hands.slice() };
  }
  // the caught candidate in the palm of a hand in pose p; u = 0..1 how far it has been dragged
  function carried(q, p, u) { const pm = palm(p); return { x: pm.x + q.off.x, y: pm.y + q.off.y, rot: 14 * q.side * u, s: 1, state: 'hit', k: 1, code: q.c.code }; }

  // In both sequences every stage begins once and in order, also when a long step (or a time of 0 in the bar) jumps over one.
  function stepCatch(q, dt) {
    q.t += dt;
    const a = T.hitFlash + T.reach, b = a + T.drag, d = b + T.merge, rest = REST[q.hand], o = 1 - q.hand;
    if (q.t >= a && q.phase < 1) { q.phase = 1; S.cands.splice(S.cands.indexOf(q.c), 1); emit('grab'); }
    if (q.t >= b && q.phase < 2) { q.phase = 2; q.from1 = S.held ? Object.assign({}, S.held) : carried(q, q.p2, 1); q.slot = S.absorbed.length; S.absorbed.push({ code: q.c.code, k: 0 }); emit('merge'); }
    // the other hand finishes going home if the catch came while it was still away
    if (q.from[o] !== REST[o]) S.hands[o] = q.t < 0.3 ? lerpPose(q.from[o], REST[o], ease(q.t / 0.3)) : (q.from[o] = REST[o]);
    if (q.t < a) {                                         // the candidate lights up, the hand reaches in
      q.c.k = part(q.t, T.hitFlash);
      S.hands[q.hand] = lerpPose(q.from[q.hand], q.p1, ease(q.t / a));
    } else if (q.t < b) {                                  // it is dragged out of the TV
      const u = ease((q.t - a) / T.drag), p = lerpPose(q.p1, q.p2, u);
      S.hands[q.hand] = p; S.held = carried(q, p, u);
    } else if (q.t < d) {                                  // it becomes part of the mass
      const u = ease((q.t - b) / T.merge), sl = MC.SLOTS[q.slot % MC.SLOTS.length], f = q.from1;
      S.hands[q.hand] = lerpPose(q.p2, rest, u);
      S.held = { x: lerp(f.x, sl[0], u), y: lerp(f.y, sl[1], u), rot: lerp(f.rot, sl[2], u), s: lerp(1, 0.5, u),
                 state: 'hit', k: 1, code: q.c.code, alpha: 1 - u };
      S.absorbed[q.slot].k = u;
    } else {
      S.hands = [REST[0], REST[1]]; S.held = null; S.absorbed[q.slot].k = 1;
      S.seq = { type: 'paper', t: 0, phase: 0, last: S.score >= JOBS };
    }
  }
  function stepPaper(q, dt) {
    q.t += dt;
    const u = part(q.t, T.paper);
    if (u >= 0.2 && q.phase < 1) { q.phase = 1; emit('paperOut'); }
    if (u >= 0.45 && q.phase < 2) { q.phase = 2; S.showPaper = false; S.paperPose = null; if (q.last) { win(); return; } }
    if (u >= 0.45 && q.phase < 3) { q.phase = 3; S.job++; S.code = MC.PAPERS[S.job]; rematch(); S.showPaper = true; }
    if (u >= 0.8 && q.phase < 4) { q.phase = 4; S.paperPose = null; S.open = true; S.spawnIn = 0.15; emit('paperIn'); }
    if (u >= 1) { S.hands = [REST[0], REST[1]]; S.seq = null; return; }
    // right hand: reaches the sheet, carries it out, comes back
    let r;
    if (u < 0.2) r = lerpPose(REST[1], R1, ease(u / 0.2));
    else if (u < 0.45) r = lerpPose(R1, R2, ease(seg(u, 0.2, 0.45)));
    else r = lerpPose(R2, REST[1], ease(seg(u, 0.45, 0.9)));
    S.hands[1] = r;
    if (q.phase === 1) { const pm = palm(r); S.paperPose = { dx: pm.x - GRAB_R.x - PAPER0.x, dy: pm.y - GRAB_R.y - PAPER0.y, rot: 11 * ease(seg(u, 0.2, 0.45)) }; }
    if (q.last) return;
    // left hand: goes out for the next sheet, lays it on the desk, comes back
    let l;
    if (u < 0.3) l = lerpPose(REST[0], LOUT, ease(u / 0.3));
    else if (u < 0.45) l = LOUT;
    else if (u < 0.8) l = lerpPose(LOUT, L1, ease(seg(u, 0.45, 0.8)));
    else l = lerpPose(L1, REST[0], ease(seg(u, 0.8, 1)));
    S.hands[0] = l;
    if (q.phase === 3) { const pm = palm(l); S.paperPose = { dx: pm.x - GRAB_L.x - PAPER0.x, dy: pm.y - GRAB_L.y - PAPER0.y, rot: -9 * (1 - ease(seg(u, 0.45, 0.8))) }; }
  }
  function win() { S.mode = 'win'; S.seq = null; S.cands = []; S.held = null; S.press = null; S.flash = 0; S.idle = 0; S.hands = [REST[0], REST[1]]; emit('win'); }

  // auto-play: presses when the lowest candidate of a column matches (used for watching the tuning and for the preview loop)
  function bot(dt) {
    S.botIn -= dt;
    if (!S.open || S.botIn > 0) return;
    for (let k = 0; k < 3; k++) {
      const c = lowest(k);
      if (c && isMatch(c) && c.y > g.y + 260) {
        const wrong = S.botRnd() * 100 < T.botError;
        press(wrong ? (k + 1 + Math.floor(S.botRnd() * 2)) % 3 : k);
        S.botIn = 0.35 + S.botRnd() * 0.5; return;
      }
    }
  }

  function step(dt) {
    S.time += dt;
    if (S.press) { S.press.t += dt; if (S.press.t >= T.press) S.press = null; }
    if (S.mode !== 'play') {
      S.idle += dt;
      if (S.auto && S.idle > (S.mode === 'start' ? 1.5 : S.mode === 'over' ? 3 : 5)) start();
      return;
    }
    const v = speed() * dt;
    for (let i = S.cands.length - 1; i >= 0; i--) {
      const c = S.cands[i];
      if (c.gone != null) { c.gone -= dt; c.alpha = S.overIn > 0 ? 1 : clamp(c.gone / 0.15, 0, 1); if (c.gone <= 0 && S.overIn <= 0) S.cands.splice(i, 1); continue; }
      if (c.frozen) continue;
      c.y += v;
      if (c.y > EXIT_Y) { S.cands.splice(i, 1); if (S.open && isMatch(c)) fault('lost'); }
    }
    if (S.open) { S.spawnIn -= dt; if (S.spawnIn <= 0) { trySpawn(); S.spawnIn = lerp(T.spawn0, T.spawn1, level()) * (0.5 + S.rnd()); } }
    if (S.flash > 0) S.flash -= dt;
    if (S.overIn > 0) { S.overIn -= dt; if (S.overIn <= 0) { S.mode = 'over'; S.idle = 0; S.seq = null; S.held = null; S.paperPose = null; S.hands = [REST[0], REST[1]]; emit('gameOver'); return; } }
    if (S.seq) (S.seq.type === 'catch' ? stepCatch : stepPaper)(S.seq, dt);
    // the sway of a hand fades in while it rests and out when it leaves, so that it never jumps
    for (let i = 0; i < 2; i++) S.sway[i] = clamp(S.sway[i] + (S.hands[i] === REST[i] ? dt / 0.6 : -dt / 0.2), 0, 1);
    if (S.auto && S.mode === 'play') bot(dt);
  }

  // ---------------------------------------------------------------- drawing
  // the alien hands sway only while the game is being played: start, game over and win are still pictures (see still())
  function swaying(p, i) { const k = S.mode === 'play' ? T.wave * ease(S.sway[i]) : 0; return k ? Object.assign({}, p, { wave: k, phase: S.time * 1.6 + i * 2.1 }) : p; }
  function scene() {
    if (S.mode === 'win')
      return { greenHands: WIN_HANDS, paper: JOBS - 1, jobs: JOBS, showPaper: false, showRecruiter: false,
               score: S.score, faults: S.faults, absorbed: S.absorbed, win: WIN };
    const st = { paper: S.job, jobs: JOBS, code: S.code, score: S.score, faults: S.faults, candidates: S.cands, absorbed: S.absorbed,
                 greenHands: S.hands.map(swaying), held: S.held, paperPose: S.paperPose, showPaper: S.showPaper,
                 bg: S.flash > 0 || S.mode === 'over' ? 'purple' : 'green' };
    if (S.press) {
      const u = part(S.press.t, T.press), reach = u < 0.3 ? lerp(0.6, 1, u / 0.3) : u < 0.7 ? 1 : lerp(1, 0.6, (u - 0.7) / 0.3);
      st.arm = MC.armTo(S.press.k, reach); if (u > 0.2 && u < 0.8) st.pressed = S.press.k;
    }
    if (S.mode === 'start') st.overlay = START;
    if (S.mode === 'over') { OVER.lines = ['SCORE ' + String(S.score).padStart(2, '0')]; st.overlay = OVER; }
    return st;
  }
  function draw(ctx) { MC.drawScene(ctx, scene()); }
  // '' while something moves; otherwise a word for the still picture on screen (start, game over, win), which only has to be
  // painted once: the page does no drawing at all while the player waits there, however long that is
  function still() { return S.mode === 'play' || S.press ? '' : [S.mode, S.score, S.faults, S.job, S.absorbed.length, S.cands.length].join(' '); }

  // ---------------------------------------------------------------- pointer (sketch coordinates)
  const inRect = (r, x, y, pad) => r && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
  function buttonAt(x, y) {
    const b = CFG.buttons;
    if (y < b.y - 30 || y > b.y + b.rowH * b.s + 40) return -1;
    for (let k = 0; k < 3; k++) if (x >= b.x + b.cuts[k] * b.s && x < b.x + b.cuts[k + 1] * b.s) return k;
    return -1;
  }
  // what a click at (x, y) would do: 'start' | 'restart' | 0 | 1 | 2 | null
  function target(x, y) {
    if (S.mode === 'play') { const k = buttonAt(x, y); return k < 0 ? null : k; }
    // START / RESTART answer at once on the button; after two seconds a click anywhere on the picture does the same, so
    // that these screens can never be left without a way on (the wait keeps a last hurried click from skipping the score)
    const o = S.mode === 'start' ? START : S.mode === 'over' ? OVER : WIN;
    return inRect(o.rect, x, y, S.mode === 'win' ? 40 : 80) || S.idle >= 2 ? (S.mode === 'start' ? 'start' : 'restart') : null;
  }
  function click(x, y) {
    const t = target(x, y);
    if (t === 'start') start();
    else if (t === 'restart') { const auto = S.auto; reset(); S.auto = auto; start(); emit('restart'); }
    else if (t != null) press(t);
    return t;
  }

  const MCG = { T, DEFAULTS, JOBS, load: base => MC.load(base).then(() => { prepare(); reset(); }), reset, start, jumpTo, press, step, draw, scene, still, click, target,
                state: () => S, speed, maxOn, onEvent: null };
  root.MCG = MCG;
})(window);
