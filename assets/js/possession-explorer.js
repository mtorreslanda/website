/* «Who has the ball?»: real output of the submitted model (10 networks + Viterbi) on SoccerTrack v2 match 128057,
   a held-out public match (assets/data/mtah-m7.json, made by tools/mtah/datos_m7.py).
   - whole match: the model's labels against the truth, run-length encoded every 5 frames;
   - three minutes from minute 10 at 5 Hz: the degraded tracking the model read, the real (annotated) positions,
     the three probabilities and both labels.
   Pitch coordinates are metres from a corner; y = 0 is the near touchline, drawn at the bottom as in the video.
   Safeguard: with reduced motion nothing plays by itself; the first instant is drawn and everything stays usable. */
(function () {
  'use strict';
  var root = document.querySelector('.po');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return root.querySelector(s); };
  var strips = $('.po-strips'), scores = $('.po-scores'), pitch = $('.po-pitch'), win = $('.po-window'),
      range = $('.po-time input'), clock = $('.po-clock'), playB = $('.po-play'), mEl = $('.po-m'), tEl = $('.po-t');
  var COL = { H: '#E9E6DC', A: '#2D6AA8', D: '#A3A3A3', X: '#F1EFE9' };
  var NAME = { H: 'White (home)', A: 'Blue (away)', D: 'Dead ball', X: '—' };
  var INK = '#1A1A1A', GRASS = '#3E7D4A', LINE = 'rgba(255,255,255,.75)', BALL = '#FFD640';
  var D = null, i = 0, view = 's', playing = false, acc = 0, last = 0;

  function fit(cv) {
    var dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { c: c, w: w, h: h };
  }
  function mmss(f) { var s = Math.floor(f / 25), m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }

  // whole match: two rows of run-length labels, the halves, and the three minutes of the window marked
  function drawStrips() {
    var g = fit(strips), c = g.c, n = 0, x0 = 64, w = g.w - x0;
    D.model.forEach(function (r) { n += r[1]; });
    function row(rle, y, label) {
      c.fillStyle = '#6B6B6B'; c.font = '500 11px "JetBrains Mono", monospace'; c.textBaseline = 'middle'; c.fillText(label, 0, y + 11);
      var k = 0;
      rle.forEach(function (r) { c.fillStyle = COL[r[0]]; c.fillRect(x0 + k / n * w, y, r[1] / n * w + .6, 22); k += r[1]; });
      c.strokeStyle = 'rgba(26,26,26,.35)'; c.strokeRect(x0 + .5, y + .5, w - 1, 21);
    }
    row(D.model, 8, 'MODEL'); row(D.truth, 38, 'TRUTH');
    var a = D.start / D.step / n, b = (D.start + D.window.length * D.step) / D.step / n;
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x0 + a * w, 3, Math.max(3, (b - a) * w), 62);
    c.fillStyle = INK; c.fillText('the 3 minutes below', x0 + a * w, 76);
    var h2 = D.halves[1][0] / D.step / n; c.fillStyle = '#6B6B6B'; c.fillText('2nd half', x0 + h2 * w + 4, 76);
    c.fillRect(x0 + h2 * w, 4, 1, 60);
  }
  // the three minutes: model and truth at 5 Hz with the playhead
  function drawWindow() {
    var g = fit(win), c = g.c, x0 = 64, w = g.w - x0, n = D.window.length;
    c.font = '500 11px "JetBrains Mono", monospace'; c.textBaseline = 'middle'; c.fillStyle = '#6B6B6B';
    c.fillText('MODEL', 0, 10); c.fillText('TRUTH', 0, 34);
    D.window.forEach(function (s, k) {
      c.fillStyle = COL[s.m]; c.fillRect(x0 + k / n * w, 2, w / n + .6, 16);
      c.fillStyle = COL[s.t]; c.fillRect(x0 + k / n * w, 26, w / n + .6, 16);
    });
    c.strokeStyle = 'rgba(26,26,26,.35)'; c.strokeRect(x0 + .5, 2.5, w - 1, 15); c.strokeRect(x0 + .5, 26.5, w - 1, 15);
    c.fillStyle = INK; c.fillRect(x0 + i / n * w - 1, 0, 2, 46);
  }
  function drawPitch() {
    var g = fit(pitch), c = g.c, W = g.w, H = g.h, L = D.pitch[0], Wd = D.pitch[1], s = Math.min(W / L, H / Wd);
    function X(x) { return x * s; } function Y(y) { return (Wd - y) * s; }
    c.fillStyle = GRASS; c.fillRect(0, 0, L * s, Wd * s);
    c.strokeStyle = LINE; c.lineWidth = 1.5;
    c.strokeRect(1, 1, L * s - 2, Wd * s - 2);
    c.beginPath(); c.moveTo(X(L / 2), 0); c.lineTo(X(L / 2), Wd * s); c.stroke();
    c.beginPath(); c.arc(X(L / 2), Y(Wd / 2), 9.15 * s, 0, Math.PI * 2); c.stroke();
    c.strokeRect(0, Y(Wd / 2 + 20.16), 16.5 * s, 40.32 * s); c.strokeRect(X(L - 16.5), Y(Wd / 2 + 20.16), 16.5 * s, 40.32 * s);
    var st = D.window[i], pl = view === 's' ? st.s : st.c, b = view === 's' ? st.sb : st.cb, r = Math.max(5, 1.05 * s);
    pl.forEach(function (p, j) {
      if (p[0] === null || p[1] === null) return;
      c.beginPath(); c.arc(X(p[0]), Y(p[1]), r, 0, Math.PI * 2);
      c.fillStyle = D.team[j] === 0 ? COL.H : COL.A; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    });
    if (b[0] !== null && b[1] !== null) {
      c.beginPath(); c.arc(X(b[0]), Y(b[1]), r * .72, 0, Math.PI * 2); c.fillStyle = BALL; c.fill(); c.strokeStyle = INK; c.stroke();
    } else {
      c.fillStyle = 'rgba(26,26,26,.55)'; c.fillRect(8, Wd * s - 30, 150, 22);
      c.fillStyle = '#fff'; c.font = '500 12px "JetBrains Mono", monospace'; c.textBaseline = 'middle'; c.fillText('ball not tracked', 16, Wd * s - 19);
    }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '500 11px "JetBrains Mono", monospace'; c.textBaseline = 'top';
    c.fillText(view === 's' ? 'DEGRADED TRACKING · WHAT THE MODEL READS' : 'REAL POSITIONS · ANNOTATED', 8, 8);
  }
  function drawSide() {
    var st = D.window[i];
    mEl.textContent = NAME[st.m]; mEl.className = 'po-m ' + st.m + (st.m !== st.t ? ' off' : '');
    tEl.textContent = NAME[st.t]; tEl.className = 'po-t ' + st.t;
    [['.po-ph', st.p[0]], ['.po-pa', st.p[1]], ['.po-pd', st.p[2]]].forEach(function (q) {
      var e = root.querySelector(q[0]); e.style.setProperty('--w', (q[1] * 100).toFixed(1) + '%');
      e.nextElementSibling.textContent = Math.round(q[1] * 100) + '%';
    });
    clock.textContent = mmss(D.start + i * D.step);
    range.value = i;
  }
  function draw() { drawPitch(); drawSide(); drawWindow(); }
  function setPlay(on) {
    playing = on; playB.textContent = on ? '❚❚' : '▶'; playB.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (on) { last = 0; requestAnimationFrame(tick); }
  }
  function tick(ts) {
    if (!playing) return;
    var dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts; acc += dt * 10;     // 2x real time (5 Hz samples)
    while (acc >= 1) { acc -= 1; i = (i + 1) % D.window.length; }
    draw(); requestAnimationFrame(tick);
  }
  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    range.max = D.window.length - 1;
    var sc = D.scores;
    scores.innerHTML = 'Whole match · <b>' + Math.round(D.agree * 100) + '%</b> of frames agree<br>spellF1 <b>' + sc.noisy.spell.toFixed(3) +
      '</b> · ' + sc.noisy.pred + ' possessions found, ' + sc.noisy.true + ' true<br>with clean tracking: spellF1 <b>' + sc.clean.spell.toFixed(3) + '</b>';
    var bs = document.querySelector('[data-k="ball_seen"]'); if (bs) bs.textContent = Math.round(D.ball_seen * 100) + '%';
    drawStrips(); draw();
    range.addEventListener('input', function () { i = +range.value; draw(); });
    playB.addEventListener('click', function () { setPlay(!playing); });
    root.querySelectorAll('.po-view button').forEach(function (b) {
      b.addEventListener('click', function () {
        view = b.dataset.v; root.querySelectorAll('.po-view button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw();
      });
    });
    window.addEventListener('resize', function () { drawStrips(); draw(); });
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); setPlay(true); } }, { threshold: .5 });
      io.observe(pitch);
    }
  }).catch(function () { scores.textContent = 'The demo data could not be loaded.'; });
})();
