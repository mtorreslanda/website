/* Ghost race (LiftoffAgent page): every flight in the data file races at once over the track seen from above, started
   together at its first pass of the finish gate. Real game telemetry only (assets/data/liftoff-race.json). The gates
   are abstract ticks. Play / pause, a scrubber, a speed switch, and a card per flight with its live speed, throttle and
   battery; a flight can be soloed by clicking its card. Usage: <div class="gr" data-src="..."></div> */
(function () {
  'use strict';
  var root = document.querySelector('.gr[data-src]');
  if (!root) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(start).catch(function () {
    root.innerHTML = '<p class="gr-err">The race data could not be loaded.</p>';
  });

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function start(D) {
    var F = D.flights, G = D.gates, T = 0;
    F.forEach(function (f) { f.T = (f.x.length - 1) * f.dt; T = Math.max(T, f.T); });
    // ---- layout
    var screen = el('div', 'gr-screen'), cv = el('canvas', 'gr-cv'), osd = el('div', 'gr-osd');
    osd.innerHTML = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>' +
      '<span class="gr-clock">00:00.00</span><span class="gr-tag">GHOST RACE · REAL GAME TELEMETRY</span>';
    screen.appendChild(cv); screen.appendChild(osd);
    var bar = el('div', 'gr-bar'), play = el('button', 'gr-play', '▶ Play'), range = el('input', 'gr-range'), spd = el('button', 'gr-speed', '1×');
    range.type = 'range'; range.min = 0; range.max = 1000; range.value = 0; range.setAttribute('aria-label', 'Race time');
    play.type = spd.type = 'button';
    bar.appendChild(play); bar.appendChild(range); bar.appendChild(spd);
    var cards = el('div', 'gr-cards');
    F.forEach(function (f) {
      var c = el('button', 'gr-card'); c.type = 'button'; c.style.setProperty('--c', f.color);
      c.innerHTML = '<span class="gr-name"><i></i>' + f.label + '</span>' +
        '<span class="gr-lap">' + (f.laps.length ? f.laps.map(function (l) { return l.toFixed(2); }).join(' · ') + ' s' : 'crash at ' + f.crash.v + ' km/h') + '</span>' +
        '<span class="gr-read"><b data-k="v">0</b><small>km/h</small><b data-k="thr">0</b><small>% throttle</small><b data-k="bat">0</b><small>% battery</small></span>' +
        '<span class="gr-batt"><u></u></span>';
      c.addEventListener('click', function () { solo = solo === f ? null : f; cards.querySelectorAll('.gr-card').forEach(function (k, i) { k.classList.toggle('dim', !!solo && F[i] !== solo); }); draw(); });
      f.card = c; cards.appendChild(c);
    });
    root.appendChild(screen); root.appendChild(bar); root.appendChild(cards);

    // ---- geometry: fit the track (gates + all flights) into the canvas, north up
    var xs = [], zs = [];
    G.forEach(function (g) { xs.push(g.x); zs.push(g.z); });
    F.forEach(function (f) { for (var i = 0; i < f.x.length; i += 10) { xs.push(f.x[i]); zs.push(f.z[i]); } });
    var x0 = Math.min.apply(0, xs) - 12, x1 = Math.max.apply(0, xs) + 12, z0 = Math.min.apply(0, zs) - 12, z1 = Math.max.apply(0, zs) + 12;
    var ctx = cv.getContext('2d'), W = 0, H = 0, k = 1, ox = 0, oy = 0, dpr = 1;
    function fit() {
      dpr = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      k = Math.min((W - 40) / (x1 - x0), (H - 70) / (z1 - z0));
      ox = (W - k * (x1 - x0)) / 2; oy = (H - k * (z1 - z0)) / 2 + 10;
      draw();
    }
    function P(x, z) { return [ox + (x - x0) * k, oy + (z1 - z) * k]; }

    var t = 0, playing = false, rate = 1, solo = null, last = 0;
    function idx(f, tt) { return Math.max(0, Math.min(f.x.length - 1, Math.floor(tt / f.dt))); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      // gates: abstract ticks
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(234,242,238,.75)'; ctx.lineWidth = 2.4;
      G.forEach(function (g) { var a = P(g.x - g.dx * g.w * 1.6, g.z - g.dz * g.w * 1.6), b = P(g.x + g.dx * g.w * 1.6, g.z + g.dz * g.w * 1.6);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
      F.forEach(function (f) {
        if (solo && solo !== f) return;
        var n = idx(f, t), i;
        ctx.strokeStyle = f.color; ctx.globalAlpha = .22; ctx.lineWidth = 1.6; ctx.beginPath();     // the whole flight, faint
        for (i = 0; i < f.x.length; i += 2) { var q = P(f.x[i], f.z[i]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
        ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.beginPath();                                        // the last 2.5 s, bright
        for (i = Math.max(0, n - 50); i <= n; i++) { var p = P(f.x[i], f.z[i]); i > n - 50 && i > 0 ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
        var h = P(f.x[n], f.z[n]);
        if (f.crash && t >= f.T) {
          ctx.strokeStyle = '#FF4B3A'; ctx.lineWidth = 4; var r = 9;
          ctx.beginPath(); ctx.moveTo(h[0] - r, h[1] - r); ctx.lineTo(h[0] + r, h[1] + r); ctx.moveTo(h[0] + r, h[1] - r); ctx.lineTo(h[0] - r, h[1] + r); ctx.stroke();
        } else {
          ctx.fillStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(h[0], h[1], t >= f.T ? 4 : 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        }
        // the card
        var c = f.card, done = t >= f.T;
        c.querySelector('[data-k="v"]').textContent = done ? '–' : f.v[n];
        c.querySelector('[data-k="thr"]').textContent = done ? '–' : Math.round(f.thr[n] * 100);
        c.querySelector('[data-k="bat"]').textContent = f.bat[n];
        c.querySelector('.gr-batt u').style.width = f.bat[n] + '%';
        c.classList.toggle('done', done);
      });
      var m = Math.floor(t / 60), s = t - m * 60;
      osd.querySelector('.gr-clock').textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
      range.value = Math.round(t / T * 1000); range.style.setProperty('--p', (t / T * 100) + '%');
    }
    function loop(ts) {
      if (!playing) return;
      var dt = last ? Math.min(.1, (ts - last) / 1000) : 0; last = ts;
      t = Math.min(T, t + dt * rate); draw();
      if (t >= T) { playing = false; play.textContent = '↺ Again'; return; }
      requestAnimationFrame(loop);
    }
    play.addEventListener('click', function () {
      if (t >= T) t = 0;
      playing = !playing; play.textContent = playing ? '❚❚ Pause' : '▶ Play'; last = 0;
      if (playing) requestAnimationFrame(loop);
    });
    range.addEventListener('input', function () { t = range.value / 1000 * T; draw(); });
    spd.addEventListener('click', function () { rate = rate === 1 ? 2 : rate === 2 ? 4 : 1; spd.textContent = rate + '×'; });
    window.addEventListener('resize', fit);
    fit();
    // start on its own when it comes into view (not with reduced motion)
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); if (!playing && t === 0) play.click(); } }, { threshold: .5 });
      io.observe(screen);
    } else { t = T; draw(); }
  }
})();
