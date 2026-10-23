// Option B: the list of works, the ENGLISH / SPANISH switch and the popup
// (title + close on top, then the piece, the credits and the text, one after another).
let lang = 'es';
try { lang = localStorage.getItem('au_lang') || 'es'; } catch (e) {}

function tileHTML(w, i) {
  return `<a class="w" href="#${w.id}" data-id="${w.id}" style="--c:${w.color}; --r:${w.ratio}">
    <span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${w.title}</span>
    <span class="thumb"><video src="${w.thumb}" poster="${w.poster}" autoplay muted loop playsinline></video></span>
    <span class="k" data-k="${w.id}"></span><span class="y">2026</span>
  </a>`;
}

function buildTiles() {
  document.getElementById('works').innerHTML = WORKS.map((w, i) => tileHTML(w, i)).join('');
  document.querySelectorAll('.w').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openWork(a.dataset.id); }));
}

function setLang(l) {
  lang = l;
  try { localStorage.setItem('au_lang', l); } catch (e) {}
  document.documentElement.lang = l;
  document.querySelectorAll('[data-lang]').forEach(a => a.classList.toggle('on', a.dataset.lang === l));
  document.querySelectorAll('[data-k]').forEach(s => s.textContent = WORKS.find(w => w.id === s.dataset.k).text[l]);
  document.querySelectorAll('[data-t]').forEach(s => s.textContent = L[l][s.dataset.t]);
  if (current) fillInfo(current);
}

// ---- popup ----
let current = null;
const modal = document.createElement('div');
modal.className = 'modal';
modal.innerHTML = `<div class="panel">
  <div class="head"><h2></h2><button class="x" aria-label="close">×</button></div>
  <div class="stage"><div class="piece"></div></div>
  <div class="info"></div>
</div>`;
document.body.appendChild(modal);
const panel = modal.querySelector('.panel'), head = modal.querySelector('.head');
const stage = modal.querySelector('.stage'), piece = modal.querySelector('.piece');

function fillInfo(w) {
  const t = L[lang];
  modal.querySelector('h2').textContent = w.title;
  modal.querySelector('.info').innerHTML = `
    <table class="ced">
      <tr><th>${t.title}</th><td>${w.title}</td></tr>
      <tr><th>${t.artist}</th><td>Cali Sterium</td></tr>
      <tr><th>${t.series}</th><td>${lang === 'es' ? 'Desempleo Artificial' : 'Artificial Unemployment'}</td></tr>
      <tr><th>${t.date}</th><td>${w.date[lang]}</td></tr>
      <tr><th>${t.medium}</th><td>${w.medium[lang]}</td></tr>
    </table>`;
}

// the piece fills the first view of the panel under the title, as big as its shape allows
function fit() {
  if (!current) return;
  const W = panel.clientWidth, H = panel.clientHeight - head.offsetHeight, r = current.ratio;
  let w = W, h = W / r;
  if (h > H) { h = H; w = H * r; }
  piece.style.width = Math.floor(w) + 'px';
  piece.style.height = Math.floor(h) + 'px';
}
new ResizeObserver(fit).observe(panel);

function openWork(id) {
  const w = WORKS.find(x => x.id === id);
  current = w;
  fillInfo(w);
  const p = w.piece;
  stage.style.background = piece.style.background = p.bg || '#000';
  piece.innerHTML = p.video
    ? `<video src="${p.video}" autoplay loop playsinline ${p.sound ? '' : 'muted'}></video>`
    : `<iframe src="${p.iframe}" allow="autoplay; fullscreen" title="${w.title}"></iframe>`;
  modal.classList.add('open');
  document.body.classList.add('noscroll');
  panel.scrollTop = 0;
  history.replaceState(null, '', '#' + id);
  requestAnimationFrame(fit);
}

function closeWork() {
  modal.classList.remove('open');
  document.body.classList.remove('noscroll');
  piece.innerHTML = '';             // stops the video / game and its sound
  current = null;
  history.replaceState(null, '', location.pathname);
}
modal.querySelector('.x').addEventListener('click', closeWork);
modal.addEventListener('click', e => { if (e.target === modal) closeWork(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && current) closeWork(); });

buildTiles();
document.querySelectorAll('[data-lang]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); setLang(a.dataset.lang); }));
setLang(lang);
if (location.hash && WORKS.some(w => '#' + w.id === location.hash)) openWork(location.hash.slice(1));
