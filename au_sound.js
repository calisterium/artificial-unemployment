// Sound for the works of Artificial Unemployment (4 Nov 2026). One small module shared by every game page:
//   AU.load('media/<work>/sound/', ['apply', 'round_1', ...])   fetches + decodes the .m4a files (only when the work opens)
//   AU.unlock()                                                 call inside a click/tap (browsers need a gesture)
//   AU.play('apply', { group:'round', gain:1 })                 plays a sound; a sound of the same group cuts the one playing (60 ms fade)
//   AU.on / AU.set(on)                                          the switch; kept in localStorage 'au_sound' (shared by every work)
// The page that embeds the work (artificialunemployment.html) finds window.AU_SOUND and shows its [ sound: on/off ] in the caption.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, gain = null, on = true;
  try { on = localStorage.getItem('au_sound') !== 'off'; } catch (e) {}
  const bufs = {}, playing = {}, last = [];
  function ensure() {
    if (!ctx && AC) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = on ? 1 : 0; gain.connect(ctx.destination); }
    return ctx;
  }
  function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
  function load(dir, names) {
    const c = ensure(); if (!c) return;
    names.forEach(n => fetch(dir + n + '.m4a').then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(d => { bufs[n] = d; }).catch(() => {}));
  }
  function play(name, o = {}) {
    const c = ensure(); if (!c || !bufs[name]) return null;
    last.push(name); if (last.length > 20) last.shift();
    if (o.group && playing[o.group]) {                       // the previous sound of the group fades out in 60 ms
      const p = playing[o.group], t = c.currentTime; p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(p.g.gain.value, t);
      p.g.gain.linearRampToValueAtTime(0, t + 0.06); try { p.s.stop(t + 0.07); } catch (e) {}
    }
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = bufs[name]; g.gain.value = o.gain == null ? 1 : o.gain;
    s.connect(g); g.connect(gain); s.start();
    if (o.group) { playing[o.group] = { s, g }; s.onended = () => { if (playing[o.group] && playing[o.group].s === s) delete playing[o.group]; }; }
    return s;
  }
  function set(v) { on = !!v; try { localStorage.setItem('au_sound', on ? 'on' : 'off'); } catch (e) {} if (gain) gain.gain.value = on ? 1 : 0; }
  window.AU = { load, unlock, play, set, get on() { return on; }, get last() { return last.slice(); }, get ready() { return Object.keys(bufs); } };
  window.AU_SOUND = { set, get on() { return on; } };
})();
