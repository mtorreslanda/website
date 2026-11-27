/* Autonomous FPV racing: the same pixel robot as on every project page, seen from the side, wearing black FPV goggles
   and holding a radio transmitter (minimal animation: a blink, the stick tips moving a little). Above the printed track
   a drone flies one choreographed freestyle line, the same every time, built on the page itself:
     1. a POWER LOOP round the OSD's "LAP 1/3", in from underneath, inverted over the top, out to the right;
     2. a straight run right under the OSD row;
     3. a SPLIT-S near the right edge: half roll to inverted, half loop down, now flying left at track height;
     4. down along the upper edge of the track drawing like terrain, 60 px above it, with a YAW SPIN on the way;
     5. a WALL RIDE: at the text block on the left it climbs straight up its edge, and back into the loop.
   The route is rebuilt from the layout on every resize, evenly resampled and smoothed. Which way the drone faces is
   set by the choreography, and it only changes where both pictures are the same, so it never jumps. Side view from robot-side.js. */
(function () {
  'use strict';
  var RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="fpv"]');
  if (!RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = '#DDE6E1', EYE = '#0B0E0F', AMBER = '#FFB21F', GOG = '#0E1113', STRAP = '#1B1F22';
  var SIDE_COL = { x: INK, a: AMBER, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, ctx = cv.getContext('2d'), W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = 20 * S;

  /* ---------------------------------------------------------------- the robot, in profile, goggles on, sticks in hand */
  function robotCells(blink) {
    var c = RS.cells({ leg: 2, arm: 'forward', blink: blink }).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; });
    for (var x = 5; x <= 8; x++) c.push({ x: x, y: 5, col: STRAP });                            // strap round the head
    for (var y = 4; y <= 6; y++) for (var x2 = 9; x2 <= 12; x2++) c.push({ x: x2, y: y, col: GOG }); // goggles, over the eye
    c.push({ x: 12, y: 5, col: '#2C343A' }, { x: 12, y: 4, col: '#9AA4AB' });                  // lens and its glint
    c.push({ x: 10, y: 3, col: STRAP }, { x: 10, y: 2, col: AMBER });                           // antenna
    for (var x3 = 12; x3 <= 15; x3++) for (var y3 = 10; y3 <= 11; y3++) c.push({ x: x3, y: y3, col: '#2E363B' });  // transmitter
    c.push({ x: 15, y: 9, col: '#2E363B' }, { x: 15, y: 8, col: STRAP }, { x: 15, y: 7, col: AMBER });          // its antenna
    return c;
  }
  var bot = { x: 0 };
  function drawRobot(blink, st) {
    sctx.clearRect(0, 0, sprite.width, sprite.height);
    robotCells(blink).forEach(function (c) { sctx.fillStyle = c.col; sctx.fillRect((c.x + 1) * S, (c.y + 2) * S, S, S); });
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(bot.x, ground); ctx.drawImage(sprite, -8.5 * S, -19 * S); ctx.restore();
    var tx = bot.x + (12 + 1 - 8.5) * S, ty = ground + (10 + 2 - 19) * S;        // the two stick tips, moving a little
    ctx.fillStyle = INK;
    ctx.fillRect(tx + S * .6 + st[0] * 2.5, ty - 3, 3, 3);
    ctx.fillRect(tx + S * 2.6 + st[1] * 2.5, ty - 3 + st[2] * 1.2, 3, 3);
  }

  /* ---------------------------------------------------------------- the drone, side view */
  var now = 0, last = 0;
  function drone(x, y, ang, sx, sy) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sx, sy);
    var s = 4, spin = Math.floor(now * 40) % 2;
    ctx.fillStyle = INK; ctx.fillRect(-6 * s, -.5 * s, 12 * s, 1.3 * s);               // frame
    ctx.fillStyle = '#2A3036'; ctx.fillRect(-2.2 * s, -2.3 * s, 4.4 * s, 1.9 * s);      // body
    ctx.fillStyle = AMBER; ctx.fillRect(2.2 * s, -2.1 * s, 1.3 * s, 1.3 * s);           // camera, at the front
    ctx.fillStyle = INK; ctx.fillRect(-5.6 * s, -1.1 * s, .8 * s, .7 * s); ctx.fillRect(4.8 * s, -1.1 * s, .8 * s, .7 * s);   // motors
    ctx.fillStyle = 'rgba(221,230,225,' + (spin ? .7 : .35) + ')';
    ctx.fillRect(-8 * s, -1.7 * s, 5.2 * s, .5 * s); ctx.fillRect(2.8 * s, -1.7 * s, 5.2 * s, .5 * s);       // props, a blur
    ctx.restore();
  }

  /* ---------------------------------------------------------------- the route, built from the page */
  var route = null, trail = [], SPEED = 240, CLEAR = 60;
  // the named moves: tag -> [stretch of route (px), label, does the drone hold its facing through it]
  var MOVES = { loop: [0, 'POWER LOOP'], split: [0, 'SPLIT-S'], yaw: [190, 'YAW SPIN'], wall: [0, 'WALL RIDE'], over: [0, 'PULL OVER'] };
  function rel(el, hr) { var r = el.getBoundingClientRect(); return { l: r.left - hr.left, t: r.top - hr.top, r: r.right - hr.left, b: r.bottom - hr.top }; }
  // the upper edge of the final race line in the drawing: the highest point in each of 28 columns, in page pixels
  function trackTop(hero, hr) {
    var path = hero.querySelector('.p-print path[stroke="#FFB21F"]'); if (!path || !path.getScreenCTM) return null;
    var svg = path.ownerSVGElement, m = path.getScreenCTM(), L = path.getTotalLength(), pt = svg.createSVGPoint(), P = [];
    for (var i = 0; i <= 500; i++) {
      var q = path.getPointAtLength(L * i / 500); pt.x = q.x; pt.y = q.y; var g = pt.matrixTransform(m);
      P.push({ x: g.x - hr.left, y: g.y - hr.top });
    }
    var x0 = Infinity, x1 = -Infinity; P.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); });
    var n = 28, col = [];
    for (var k = 0; k < n; k++) col.push({ x: x0 + (x1 - x0) * (k + .5) / n, y: Infinity });
    P.forEach(function (p) { var k = Math.min(n - 1, Math.floor((p.x - x0) / (x1 - x0) * n)); col[k].y = Math.min(col[k].y, p.y); });
    return col.filter(function (c) { return isFinite(c.y); });
  }
  function catmull(P, per) {             // closed Catmull-Rom spline through P, `per` samples per segment
    var out = [], n = P.length;
    for (var i = 0; i < n; i++) {
      var p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (var k = 0; k < per; k++) {
        var t = k / per, t2 = t * t, t3 = t2 * t;
        out.push({ x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                   y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
                   tag: k === 0 ? p1.tag : null, end: k === 0 ? p1.end : null });
      }
    }
    return out;
  }
  function lengths(pts) {
    var len = [0];
    for (var i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { len: len, L: len[len.length - 1] + Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) };
  }
  function build() {
    if (!W) return;
    var hero = cv.parentElement, hr = hero.getBoundingClientRect();
    var lapEl = hero.querySelector('.osd .top'), batEl = hero.querySelector('.osd .rt'), top = trackTop(hero, hr);
    // the text block on the left, measured on the text itself (the boxes that hold it can be full width)
    var textEls = [].slice.call(hero.querySelectorAll('.p-title > span, .p-lede, .p-cta a, .p-kicker'));
    if (!lapEl || !top || top.length < 4 || !textEls.length) { route = null; return; }
    var A = rel(lapEl, hr), B = batEl ? rel(batEl, hr) : { l: W - 200, t: A.t, r: W - 60, b: A.b };
    var textRight = function (e) {
      if (e.classList.contains('p-lede') || e.classList.contains('p-kicker')) {       // a paragraph: its longest line
        var rg = document.createRange(); rg.selectNodeContents(e);
        return Math.max.apply(0, [].map.call(rg.getClientRects(), function (r) { return r.right - hr.left; }));
      }
      return rel(e, hr).r;
    };
    var wallX = Math.max.apply(0, textEls.map(textRight)) + 34;
    var wallTop = Math.min.apply(0, textEls.map(function (e) { return rel(e, hr).t; }));
    var cx = (A.l + A.r) / 2, cy = (A.t + A.b) / 2, rx = (A.r - A.l) / 2 + 34, ry = (A.b - A.t) / 2 + 34, yh = cy + ry;
    var mid = (top[0].x + top[top.length - 1].x) / 2, li = 0;
    li = -1; top.forEach(function (c, i) { if (c.x > mid && (li < 0 || c.y < top[li].y)) li = i; });   // the top-right bend
    if (li < 0) li = top.length - 1;
    var lobe = top[li], P = [];
    // 1 · POWER LOOP round "LAP 1/3": in along the bottom heading right, up the right side, inverted over the top, down
    // the entry is always to the right of the wall, so the pull-over from the wall flows straight into it
    // (on a narrow window the loop starts further round its bottom; it is a full turn wherever it starts)
    var entryX = Math.min(cx + rx * .6, Math.max(cx - rx * .55, wallX + 70)), th0 = Math.acos((entryX - cx) / rx);
    P.push({ x: entryX, y: cy + ry * Math.sin(th0), tag: 'loop' });
    for (var k = 1; k <= 12; k++) { var th = th0 - k / 12 * Math.PI * 2; P.push({ x: cx + rx * Math.cos(th), y: cy + ry * Math.sin(th), end: k === 12 ? 'loop' : null }); }
    // 2 · out to the right along the OSD row
    // the split-S is measured backwards from where it must come out: just above the top-right bend, flying left,
    // CLEAR over the track; so its radius is half the drop from the OSD row to there, and it starts just past the bend
    var Rs = Math.max(26, Math.min(70, (lobe.y - CLEAR - yh) / 2)), xr = Math.min(W - 40 - Rs, lobe.x + Rs * .3 + 8);
    P.push({ x: Math.max(cx + rx * .7, entryX + 50), y: yh });
    P.push({ x: (cx + xr) / 2, y: yh + 4 });
    // 3 · SPLIT-S: half roll to inverted, then half a loop downwards; it comes out flying left, Rs*2 lower
    P.push({ x: xr - Rs * .6, y: yh, tag: 'split' });
    P.push({ x: xr + Rs * .55, y: yh + Rs * .18 }); P.push({ x: xr + Rs, y: yh + Rs }); P.push({ x: xr + Rs * .55, y: yh + Rs * 1.82 });
    P.push({ x: xr - Rs * .3, y: yh + Rs * 2, end: 'split' });
    // 4 · down the track's upper edge, right to left, CLEAR above it (a YAW SPIN half way)
    var skim = top.filter(function (c, i) { return i <= li && c.x < xr - Rs && c.x > wallX + 70; }).reverse();
    skim.forEach(function (c, i) { if (i % 2 === 0 || i === skim.length - 1) P.push({ x: c.x, y: Math.max(c.y - CLEAR, yh + Rs * 2 - 10 * (i === 0)), tag: i === Math.floor(skim.length * .45) ? 'yaw' : null }); });
    // 5 · WALL RIDE: across to the text block, then straight up its edge, and into the loop again
    var low = skim.length ? skim[skim.length - 1].y - CLEAR : yh + 160;
    P.push({ x: wallX + 40, y: low - 12 });
    P.push({ x: wallX, y: low - 30, tag: 'wall' });
    // at the top of the wall it pulls over onto its back, now heading right, and half-rolls upright before the loop
    P.push({ x: wallX, y: Math.max(yh + 40, (low + Math.max(wallTop, yh + 40)) / 2), end: 'wall', tag: 'over' });
    P.push({ x: wallX + 8, y: yh + 34 });
    P.push({ x: (wallX * .6 + entryX * .4), y: yh + 6, end: 'over' });
    // a smooth, evenly sampled closed curve; where each move starts and ends, in route length
    var pts = catmull(P, 16), a = lengths(pts), marks = {}, ends = {};
    route = { pts: pts, len: a.len, L: a.L };
    pts.forEach(function (p, j) { if (p.tag && marks[p.tag] === undefined) marks[p.tag] = a.len[j] / a.L; if (p.end && ends[p.end] === undefined) ends[p.end] = a.len[j] / a.L; });
    var STEP = 3, n = Math.floor(a.L / STEP), Q = [];
    for (var m = 0; m < n; m++) Q.push(at(m * STEP));
    for (var pass = 0; pass < 4; pass++) {
      var Z = [];
      for (var u = 0; u < n; u++) { var sx = 0, sy = 0; for (var b = -5; b <= 5; b++) { var q = Q[(u + b + n) % n]; sx += q.x; sy += q.y; } Z.push({ x: sx / 11, y: sy / 11 }); }
      Q = Z;
    }
    var c2 = lengths(Q), L2 = c2.L, moves = {};
    for (var tg in marks) {
      var s0 = marks[tg] * L2, s1 = ends[tg] !== undefined ? ends[tg] * L2 : s0 + MOVES[tg][0];
      if (s1 <= s0) s1 += L2;
      moves[tg] = [s0, s1];
    }
    route = { pts: Q, len: c2.len, L: L2, moves: moves };
  }
  function at(s) {                        // position at arc length s along the closed route
    var R = route, n = R.pts.length; s = ((s % R.L) + R.L) % R.L;
    var lo = 0, hi = n; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (R.len[m] <= s) lo = m; else hi = m; }   // the last stretch closes the curve
    var a = R.pts[lo], b = R.pts[(lo + 1) % n], seg = ((lo + 1 < n ? R.len[lo + 1] : R.L) - R.len[lo]) || 1, t = Math.min(1, (s - R.len[lo]) / seg);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function moveAt(s) {                    // the named move under way at s, and how far through it (0-1)
    var w = ((s % route.L) + route.L) % route.L;
    for (var tg in route.moves) {
      var m = route.moves[tg], x = w < m[0] ? w + route.L : w;
      if (x >= m[0] && x <= m[1]) return { tag: tg, name: MOVES[tg][1], k: (x - m[0]) / (m[1] - m[0]) };
    }
    return null;
  }

  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function within(w, m) { var x = w < m[0] ? w + route.L : w; return x >= m[0] && x <= m[1] ? (x - m[0]) / (m[1] - m[0]) : -1; }
  // the attitude is set by the choreography, not guessed from the motion: facing right from the pull-over through the
  // loop to the split-S; facing left from the split-S to the top of the wall. Each change of facing happens where the
  // picture is the same both ways (inverted facing right = upright facing left, turned half round), so it never jumps.
  function attitude(w) {
    var M = route.moves, k;
    if (M.split && (k = within(w, M.split)) >= 0) return { f: 1, roll: Math.PI * sm(k / Math.max(.3, 70 / (M.split[1] - M.split[0]))), lean: 0 };       // half roll, pull through
    if (M.over && (k = within(w, M.over)) >= 0) return { f: 1, roll: Math.PI * (1 - sm((k - .4) / .6)), lean: 0 };  // on its back, rolls upright
    var M0 = M.split ? M.split[1] : 0, M1 = M.over ? M.over[0] : 0;
    if (M.split && M.over && within(w, [M0, M1 < M0 ? M1 + route.L : M1]) >= 0) return { f: -1, roll: 0, lean: M.wall && within(w, M.wall) >= 0 ? 0 : .18 };
    return { f: 1, roll: 0, lean: M.loop && within(w, M.loop) >= 0 ? 0 : .18 };
  }
  var aCur = null, fPrev = null, leanCur = .18;
  function wrap(x) { while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return x; }
  function frame(ts) {
    now = ts / 1000; var dt = Math.min(.05, last ? now - last : 0); last = now;
    ctx.clearRect(0, 0, W, H);
    var vx = 0, vy = 0;
    if (route) {
      var s = now * SPEED, p = at(s), p1 = at(s + 9), p0 = at(s - 9);
      vx = (p1.x - p0.x) / 18 * SPEED; vy = (p1.y - p0.y) / 18 * SPEED;
      var w = ((s % route.L) + route.L) % route.L, att = attitude(w), f = att.f, mv = moveAt(s);
      if (fPrev !== null && f !== fPrev && aCur !== null) aCur = wrap(aCur + Math.PI);   // same picture, other form
      fPrev = f;
      leanCur += (att.lean - leanCur) * Math.min(1, dt * 5);                       // the forward lean fades in and out
      var phi = Math.atan2(vy, vx), aT = (f > 0 ? phi : phi - Math.PI) + leanCur * f;
      if (aCur === null) aCur = aT;
      aCur = wrap(aCur + wrap(aT - aCur) * Math.min(1, dt * 11));
      var a = aCur, sx = f, sy = Math.cos(att.roll);
      if (mv && mv.tag === 'yaw') { var e = mv.k * mv.k * (3 - 2 * mv.k); sx *= Math.cos(e * Math.PI * 2); }
      trail.push({ x: p.x, y: p.y, life: .5 }); trail = trail.filter(function (q) { q.life -= dt; return q.life > 0; });
      trail.forEach(function (q) { ctx.fillStyle = 'rgba(255,178,31,' + (q.life * .55).toFixed(2) + ')'; ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3); });
      drone(p.x, p.y, a, sx, sy);
    }
    var st = [Math.max(-1, Math.min(1, vx / SPEED)), Math.max(-1, Math.min(1, vy / SPEED)), Math.sin(now * 3) * .5];
    drawRobot((now % 3.4) < .12, st);
    if (!reduce) requestAnimationFrame(frame);
  }
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight; ground = H - 1;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bot.x = Math.max(9 * S + 20, W * .1);
    build();
  }
  resize(); window.addEventListener('resize', resize); window.addEventListener('load', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  if (reduce) { now = 2.2; frame(2200); } else requestAnimationFrame(frame);
})();
