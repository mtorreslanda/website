// Hero: real trajectories from my projects (drone race lines from our simulator, NFL player tracks
// from our tracker), drawn as ink lines. The final drawing is always reached; with reduced motion it
// is drawn at once.
(function () {
  var cv = document.getElementById('hero-canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var paths = [], W = 0, H = 0, dpr = 1, t0 = null, DRAW = 5200, raf = null;

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function layout(data) {
    var out = [];
    var drones = data.filter(function (d) { return d.k === 'drone'; });
    var nfl = data.filter(function (d) { return d.k === 'nfl'; });
    var wide = W > 760;
    // drone laps: fit their bounding box into the right half (or the top band on mobile)
    var bx = [1e9, 1e9, -1e9, -1e9];
    drones.forEach(function (d) { d.p.forEach(function (p) {
      bx[0] = Math.min(bx[0], p[0]); bx[1] = Math.min(bx[1], p[1]); bx[2] = Math.max(bx[2], p[0]); bx[3] = Math.max(bx[3], p[1]); }); });
    var box = wide ? [W * 0.58, H * 0.16, W * 0.38, H * 0.52] : [W * 0.06, H * 0.10, W * 0.88, H * 0.30];
    var s = Math.min(box[2] / (bx[2] - bx[0]), box[3] / (bx[3] - bx[1]));
    var ox = box[0] + (box[2] - (bx[2] - bx[0]) * s) / 2, oy = box[1] + (box[3] - (bx[3] - bx[1]) * s) / 2;
    drones.forEach(function (d, i) {
      var final = i === drones.length - 1;
      out.push({ pts: d.p.map(function (p) { return [ox + (p[0] - bx[0]) * s, oy + (bx[3] - p[1]) * s]; }),
                 color: final ? 'accent' : 'ink', alpha: final ? 0.85 : 0.16 + i * 0.05,
                 w: final ? 1.8 : 1.1, delay: i * 260 });
    });
    // NFL route bundles: small groups scattered on the left/top
    var groups = {};
    nfl.forEach(function (d) { (groups[d.c] = groups[d.c] || []).push(d); });
    var keys = Object.keys(groups);
    var spots = wide ? [[0.60, 0.70, 0.15], [0.79, 0.68, 0.14], [0.66, 0.10, 0.11], [0.84, 0.11, 0.10]]
                     : [[0.55, 0.40, 0.4], [0.05, 0.40, 0.36], [0.6, 0.02, 0.3], [0.04, 0.02, 0.3]];
    keys.forEach(function (k, gi) {
      var sp = spots[gi % spots.length], sc = sp[2] * W;
      groups[k].forEach(function (d, j) {
        out.push({ pts: d.p.map(function (p) { return [sp[0] * W + p[0] * sc, sp[1] * H + p[1] * sc]; }),
                   color: 'blue', alpha: 0.5, w: 1.1, delay: 900 + gi * 500 + j * 60 });
      });
    });
    out.forEach(function (o) {
      var L = 0, acc = [0];
      for (var i = 1; i < o.pts.length; i++) {
        L += Math.hypot(o.pts[i][0] - o.pts[i - 1][0], o.pts[i][1] - o.pts[i - 1][1]); acc.push(L);
      }
      o.len = L; o.acc = acc;
    });
    return out;
  }

  var raw = null;
  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (raw) { paths = layout(raw); frame(performance.now()); }
  }

  function strokeUpTo(o, frac) {
    var target = o.len * frac, pts = o.pts;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      if (o.acc[i] > target) {
        var seg = o.acc[i] - o.acc[i - 1], f = seg ? (target - o.acc[i - 1]) / seg : 0;
        ctx.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f);
        break;
      }
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  }

  function pointAt(o, frac) {
    var target = o.len * frac;
    for (var i = 1; i < o.pts.length; i++) if (o.acc[i] >= target) {
      var seg = o.acc[i] - o.acc[i - 1], f = seg ? (target - o.acc[i - 1]) / seg : 0;
      return [o.pts[i - 1][0] + (o.pts[i][0] - o.pts[i - 1][0]) * f, o.pts[i - 1][1] + (o.pts[i][1] - o.pts[i - 1][1]) * f];
    }
    return o.pts[o.pts.length - 1];
  }

  function frame(now) {
    if (t0 === null) t0 = now;
    var el = reduce ? 1e9 : now - t0;
    var col = { ink: css('--ink'), accent: css('--accent'), blue: css('--blue') };
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var done = true;
    paths.forEach(function (o) {
      var f = Math.max(0, Math.min(1, (el - o.delay) / DRAW));
      f = 1 - Math.pow(1 - f, 3);
      if (f < 1) done = false;
      if (f <= 0) return;
      ctx.globalAlpha = o.alpha; ctx.strokeStyle = col[o.color]; ctx.lineWidth = o.w;
      strokeUpTo(o, f);
    });
    // after drawing: one comet runs along the final race line
    var last = paths.filter(function (o) { return o.color === 'accent'; })[0];
    if (last && !reduce) {
      var lapT = ((el - DRAW - 600) / 9000) % 1;
      if (el > DRAW + 600) {
        for (var k = 0; k < 14; k++) {
          var p = pointAt(last, (lapT - k * 0.0035 + 1) % 1);
          ctx.globalAlpha = 0.9 * (1 - k / 14); ctx.fillStyle = col.accent;
          ctx.beginPath(); ctx.arc(p[0], p[1], 3.2 - k * 0.18, 0, 6.283); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }

  fetch(cv.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    raw = d; resize();
    if (!reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  }).catch(function () { /* the page works without the drawing */ });
  window.addEventListener('resize', function () { resize(); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !reduce && raw) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { frame(performance.now()); });
})();
