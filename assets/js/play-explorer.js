/* NFLVision play explorer: the published tracking of one play, drawn as a playbook diagram you can scrub.
   Layers (pocket, pressure, routes, space control) are computed in the browser from the CSV, frame by frame.
   <div class="px" data-csv="..." data-los="60.64" data-dir="1"> with the markup in the page. */
(function () {
  'use strict';
  var root = document.querySelector('.px');
  if (!root) return;
  var cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  var slider = root.querySelector('.px-time input'), playBtn = root.querySelector('.px-play');
  var out = {}; root.querySelectorAll('[data-out]').forEach(function (e) { out[e.dataset.out] = e; });
  var LOS = parseFloat(root.dataset.los), DIR = parseFloat(root.dataset.dir) || 1;
  var OFF = '#C0522A', DEF = '#2D6AA8', INK = '#1A1A1A', PRINT = 'rgba(111, 143, 122, .55)';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var frames = [], players = {}, T0 = 0, T1 = 0, t = 0, playing = false, hover = null, W = 0, H = 0, SC = 1;
  var D_MIN = -14, D_MAX = 26;
  var vor = document.createElement('canvas'), vctx = vor.getContext('2d');   // space-control layer                       // yards shown behind and beyond the line of scrimmage

  function layer(name) { var c = root.querySelector('input[name="' + name + '"]'); return !c || c.checked; }
  function toPx(x, y) {                               // offense attacks upwards; near sideline on the right
    var depth = (x - LOS) * DIR;
    return [(DIR > 0 ? 53.33 - y : y) * SC, H - (depth - D_MIN) * SC];
  }

  function parse(txt) {
    var rows = txt.trim().split('\n'), head = rows.shift().split(','), by = {};
    rows.forEach(function (r) {
      var v = r.split(','), o = {};
      head.forEach(function (h, i) { o[h] = v[i]; });
      var k = (+o.time_from_snap_s).toFixed(1);
      (by[k] = by[k] || []).push({ id: o.player, team: o.team, side: o.side, role: o.role_at_snap,
                                   x: +o.x_yd, y: +o.y_yd, v: +o.speed_yd_s, dir: +o.dir_deg });
      if (!players[o.player]) players[o.player] = { id: o.player, role: o.role_at_snap, side: o.side, trail: [], top: 0 };
      players[o.player].top = Math.max(players[o.player].top, +o.speed_yd_s);
    });
    frames = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { t: k, p: by[k.toFixed(1)] }; });
    frames.forEach(function (f) { f.p.forEach(function (p) { players[p.id].trail.push({ t: f.t, x: p.x, y: p.y }); }); });
    T0 = frames[0].t; T1 = frames[frames.length - 1].t; t = T0;
    slider.min = T0; slider.max = T1; slider.step = .1; slider.value = T0;
  }
  function at(tt) {                                   // positions interpolated between the 10 Hz frames
    var i = Math.max(0, Math.min(frames.length - 2, Math.floor((tt - T0) * 10 + 1e-6))), a = frames[i], b = frames[i + 1];
    var k = Math.max(0, Math.min(1, (tt - a.t) / (b.t - a.t))), bm = {};
    b.p.forEach(function (p) { bm[p.id] = p; });
    return a.p.map(function (p) {
      var q = bm[p.id] || p;
      return { id: p.id, side: p.side, role: p.role, x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, v: p.v + (q.v - p.v) * k };
    });
  }
  function hull(pts) {                                 // monotone chain
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function area(poly) { var s = 0; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }

  function draw() {
    var P = at(t);
    ctx.clearRect(0, 0, W, H);
    // space control: a coarse Voronoi, 1-yard cells
    if (layer('space')) {                         // solid cells at 2 px per yard, then scaled up smoothly: no seams
      var gw = 107, gh = (D_MAX - D_MIN) * 2, img = vctx.createImageData(gw, gh);
      for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
        var depth = D_MAX - (j + .5) / 2, fx = LOS + depth * DIR, fy = DIR > 0 ? 53.33 - (i + .5) / 2 : (i + .5) / 2;
        var best = 1e9, side = null;
        for (var q = 0; q < P.length; q++) { var p = P[q], d = (p.x - fx) * (p.x - fx) + (p.y - fy) * (p.y - fy); if (d < best) { best = d; side = p.side; } }
        var o = (j * gw + i) * 4, off = side === 'offense';
        img.data[o] = off ? 192 : 45; img.data[o + 1] = off ? 82 : 106; img.data[o + 2] = off ? 42 : 168; img.data[o + 3] = 255;
      }
      vor.width = gw; vor.height = gh; vctx.putImageData(img, 0, 0);
      ctx.save(); ctx.globalAlpha = .09; ctx.imageSmoothingEnabled = true; ctx.drawImage(vor, 0, 0, W, H); ctx.restore();
    }
    // the printed field: yard lines, hash marks, line of scrimmage
    ctx.strokeStyle = PRINT; ctx.lineWidth = 1;
    for (var x = Math.ceil((LOS + D_MIN * DIR) / 5) * 5; (x - LOS) * DIR <= D_MAX; x += 5 * DIR) {
      var a0 = toPx(x, 0), a1 = toPx(x, 53.33);
      ctx.lineWidth = x % 10 ? 1 : 1.6; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      if (x % 10 === 0) { var yl = x <= 60 ? x - 10 : 110 - x; if (yl > 0 && yl <= 50) { ctx.fillStyle = PRINT; ctx.font = '600 13px "DM Sans", sans-serif';
        ctx.fillText(String(yl), 6, a0[1] - 4); } }
    }
    [23.36, 29.97].forEach(function (hy) {
      for (var hx = LOS + D_MIN * DIR; (hx - LOS) * DIR <= D_MAX; hx += DIR) { var h0 = toPx(hx, hy); ctx.beginPath(); ctx.moveTo(h0[0] - 3, h0[1]); ctx.lineTo(h0[0] + 3, h0[1]); ctx.stroke(); }
    });
    var l0 = toPx(LOS, 0), l1 = toPx(LOS, 53.33);
    ctx.setLineDash([7, 6]); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(l0[0], l0[1]); ctx.lineTo(l1[0], l1[1]); ctx.stroke(); ctx.setLineDash([]);
    // routes: receivers' paths since the snap
    if (layer('routes') && t > 0) {
      Object.keys(players).forEach(function (id) {
        var pl = players[id]; if (['WR', 'TE', 'RB'].indexOf(pl.role) < 0) return;
        var pts = pl.trail.filter(function (s) { return s.t >= 0 && s.t <= t; });
        if (pts.length < 2) return;
        ctx.strokeStyle = OFF; ctx.lineWidth = 2; ctx.beginPath();
        pts.forEach(function (s, i) { var c = toPx(s.x, s.y); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }); ctx.stroke();
      });
    }
    var qb = P.filter(function (p) { return p.role === 'QB'; })[0];
    var ol = P.filter(function (p) { return p.role === 'OL'; });
    var pocket = null, rush = null;
    if (qb && ol.length > 2) {
      pocket = hull(ol.concat([qb]).map(function (p) { return [p.x, p.y]; }));
      if (layer('pocket')) {
        ctx.fillStyle = 'rgba(192, 82, 42, .16)'; ctx.strokeStyle = OFF; ctx.lineWidth = 1.5; ctx.beginPath();
        pocket.forEach(function (q, i) { var c = toPx(q[0], q[1]); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      P.forEach(function (p) { if (p.side !== 'defense') return; var d = Math.hypot(p.x - qb.x, p.y - qb.y); if (!rush || d < rush.d) rush = { p: p, d: d }; });
      if (layer('pressure') && rush && rush.d < 6 && t >= 0) {
        var r0 = toPx(rush.p.x, rush.p.y), r1 = toPx(qb.x, qb.y);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // players: O offense, X defense
    P.forEach(function (p) {
      var c = toPx(p.x, p.y), hov = hover === p.id, r = hov ? 10 : 7.5;
      ctx.lineWidth = hov ? 3 : 2.4;
      if (p.side === 'offense') {
        ctx.strokeStyle = OFF; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 2 * Math.PI);
        if (p.role === 'QB') { ctx.fillStyle = OFF; ctx.fill(); }
        ctx.stroke();
      } else {
        ctx.strokeStyle = DEF; ctx.beginPath();
        ctx.moveTo(c[0] - r, c[1] - r); ctx.lineTo(c[0] + r, c[1] + r); ctx.moveTo(c[0] - r, c[1] + r); ctx.lineTo(c[0] + r, c[1] - r); ctx.stroke();
      }
    });
    // readouts
    out.clock.textContent = (t >= 0 ? '+' : '') + t.toFixed(1) + ' s';
    out.pocket.textContent = pocket && t >= -0.2 ? area(pocket).toFixed(1) : '–';
    out.rush.textContent = rush && t >= 0 ? rush.d.toFixed(1) : '–';
    out.rush.classList.toggle('hot', !!(rush && rush.d < 3 && t >= 0));
    var fast = P.reduce(function (m, p) { return p.v > m.v ? p : m; }, P[0]);
    out.fast.textContent = (fast.v * 2.0455).toFixed(1);
    out.fastwho.textContent = fast.role;
    if (hover) {
      var hp = P.filter(function (p) { return p.id === hover; })[0];
      out.card.innerHTML = hp ? '<b>' + hp.role + '</b> ' + (hp.side === 'offense' ? 'Kansas City' : 'Baltimore') +
        '<br>' + (hp.v * 2.0455).toFixed(1) + ' mph now · top ' + (players[hp.id].top * 2.0455).toFixed(1) + ' mph' : '';
    } else out.card.textContent = window.matchMedia('(hover: none)').matches ? 'Tap a player' : 'Point at a player';
    slider.value = t;
    var pct = (t - T0) / (T1 - T0) * 100;
    slider.style.setProperty('--p', pct + '%');
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; SC = W / 53.33; H = SC * (D_MAX - D_MIN); cv.style.height = H + 'px';
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frames.length) draw();
  }
  var lastTs = 0;
  function loop(ts) {
    if (!playing) return;
    var dt = lastTs ? (ts - lastTs) / 1000 : 0; lastTs = ts;
    t += dt;
    if (t >= T1) { t = T1; playing = false; playBtn.textContent = '↻ Replay'; }
    draw();
    if (playing) requestAnimationFrame(loop);
  }
  function play() {
    if (t >= T1) t = T0;
    playing = true; lastTs = 0; playBtn.textContent = '❚❚ Pause'; requestAnimationFrame(loop);
  }
  playBtn.addEventListener('click', function () { if (playing) { playing = false; playBtn.textContent = '▶ Play'; } else play(); });
  slider.addEventListener('input', function () { playing = false; playBtn.textContent = '▶ Play'; t = parseFloat(slider.value); draw(); });
  root.querySelectorAll('.px-layers input').forEach(function (c) { c.addEventListener('change', draw); });
  root.querySelectorAll('[data-jump]').forEach(function (b) {
    b.addEventListener('click', function () { playing = false; playBtn.textContent = '▶ Play'; t = parseFloat(b.dataset.jump); draw(); });
  });
  function pick(e) {
    var r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, reach = e.pointerType === 'mouse' ? 16 : 26;
    at(t).forEach(function (p) { var c = toPx(p.x, p.y), d = Math.hypot(c[0] - mx, c[1] - my); if (d < reach && (!best || d < best.d)) best = { id: p.id, d: d }; });
    var h = best ? best.id : null;
    if (h !== hover) { hover = h; cv.style.cursor = h ? 'pointer' : 'default'; if (!playing) draw(); }
  }
  cv.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') pick(e); });
  cv.addEventListener('pointerdown', pick);                       // a tap on a phone
  cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = null; if (!playing) draw(); } });

  fetch(root.dataset.csv).then(function (r) { return r.text(); }).then(function (txt) {
    parse(txt); resize();
    window.addEventListener('resize', resize);
    // starts playing the first time it comes into view
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); play(); } }, { threshold: .5 });
      io.observe(cv);
    }
  });
})();
