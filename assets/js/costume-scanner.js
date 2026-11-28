/* Signature detection: the same pixel robot as on every project page, now a document clerk with a cyan eyeshade.
   Routines on the dividing line at the bottom of the first screen (SH38):
     scanner   · a flatbed scanner rises from the line; the robot lays a page on it, the light bar sweeps, and the page
                 comes out on the other side with its signature boxed in cyan;
     magnifier · the robot holds up a page and goes over it with a magnifying glass until it finds the signature.
   Front view from robot.js, side view from robot-side.js; the eyeshade and the props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="scanner"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#1C7FB5', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', SHADE = '#5CC8FF', SHADE_D = '#1C7FB5', CASE = '#D9D6CE', CASE_D = '#A9A59B',
      CASE_L = '#ECEAE4', GLASS = '#2B3A44', LIGHT = '#5CC8FF', PAGE = '#FFFDF7', LINE = '#B9B5AA', BRASS = '#B8862F',
      HANDLE = '#3A3A3A';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the eyeshade, both views */
  function shadeFront(c) {
    for (var x = 3; x <= 12; x++) c.push({ x: x, y: 2, col: SHADE });
    for (var x2 = 2; x2 <= 13; x2++) c.push({ x: x2, y: 3, col: SHADE_D });
  }
  function frontCells(pose) {
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; });
    shadeFront(c);
    return c;
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; });
    var top = Math.min.apply(null, c.map(function (p) { return p.y; }));
    var xs = c.filter(function (p) { return p.y === top + 1; }).map(function (p) { return p.x; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    for (var x = x0; x <= x1; x++) c.push({ x: x, y: top + 1, col: SHADE });
    for (var x2 = x0; x2 <= x1 + 2; x2++) c.push({ x: x2, y: top + 2, col: SHADE_D });   // the brim sticks out in front
    return c;
  }
  function paint(cells, flip) {
    sctx.clearRect(0, 0, sprite.width, sprite.height);
    cells.forEach(function (c) {
      var x = flip ? 15 - c.x : c.x;
      sctx.fillStyle = c.col; sctx.fillRect((x + 1) * S, (c.y + 1) * S, S, S);
    });
  }
  function cellAt(cx, cy) {
    var x = bot.face < 0 ? 15 - cx : cx;
    return { x: bot.x + (x + 1.5 - 8.5) * S, y: ground - bot.lift + (cy + 1.5 - 18) * S };
  }

  /* ---------------------------------------------------------------- props */
  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  // a page of text: x,y top-left, w,h; sig: 0..1 how much of the signature is drawn; box: 0..1 the detection box
  function sheet(x, y, w, h, sig, box) {
    px(x, y, w, h, PAGE); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w) - 1, Math.round(h) - 1);
    for (var i = 0; i < 5; i++) px(x + w * .14, y + h * (.14 + i * .1), w * (i === 4 ? .4 : .72), Math.max(1, S * .3), LINE);
    var sx = x + w * .2, sy = y + h * .78, sw = w * .55;
    if (sig > 0) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath();
      for (var k = 0; k <= 40 * sig; k++) { var u = k / 40;
        var yy = sy - Math.sin(u * Math.PI * 5) * h * .06 * (1 - u * .4), xx = sx + u * sw;
        if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    }
    if (box > 0) {
      var bx = sx - w * .06, by = sy - h * .11, bw = (sw + w * .12) * Math.min(1, box * 1.6), bh = h * .2;
      ctx.strokeStyle = SHADE_D; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(92,200,255,.18)'; ctx.fillRect(bx, by, bw, bh);
      if (box > .7) { px(bx, by - S * 1.4, S * 4.2, S * 1.4, SHADE_D); ctx.fillStyle = '#fff'; ctx.font = '500 ' + Math.round(S * 1.1) + 'px "JetBrains Mono", monospace';
                      ctx.textBaseline = 'top'; ctx.fillText('0.99', bx + S * .4, by - S * 1.25); }
    }
  }
  // the flatbed scanner, rising k: 0..1; page: 0 none .. 1 lying on the glass; light: -1 off, else 0..1 across
  function scanner(cx, k, page, light) {
    var w = 26 * S, h = 6 * S * k, top = ground - h, x = cx - w / 2;
    px(x, top, w, h, CASE); px(x, top, w, S * .8 * k, CASE_L); px(x, ground - S * k, w, S * k, CASE_D);
    if (k < 1) return top;
    px(x + 2 * S, top + 2 * S, w - 9 * S, S * 1.2, GLASS);                                          // the window on the front
    px(x + w - 5 * S, top + 2 * S, S * .9, S * .9, light >= 0 ? '#5BD17A' : CASE_D);               // the power light
    if (page > 0) px(x + 4 * S, top - S * .5, (w - 8 * S) * Math.min(1, page), S * .5, PAGE);      // the page on the glass
    if (light >= 0) {
      var lx = x + 2 * S + (w - 10 * S) * light;
      ctx.save(); ctx.shadowColor = LIGHT; ctx.shadowBlur = 16; px(lx, top + 2 * S, S, S * 1.2, LIGHT); ctx.restore();
      ctx.globalAlpha = .45; px(lx - S, top - S * .6, 3 * S, S * .6, LIGHT); ctx.globalAlpha = 1;     // light under the page
    }
    return top;
  }
  function check(x, y, k) {                                                                         // a check mark that pops
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = '#2E8B57'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-S * 1.4, 0); ctx.lineTo(-S * .3, S * 1.1); ctx.lineTo(S * 1.8, -S * 1.5); ctx.stroke(); ctx.restore();
  }
  function lens(x, y, hx, hy) {                                                                     // a magnifying glass, handle to the hand
    ctx.strokeStyle = HANDLE; ctx.lineWidth = S * .5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(x + S * 1.6, y + S * 1.6); ctx.stroke();
    ctx.fillStyle = 'rgba(92,200,255,.16)'; ctx.beginPath(); ctx.arc(x, y, S * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = BRASS; ctx.lineWidth = S * .6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, S * 1.7, 3.6, 4.4); ctx.stroke();
  }

  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, lift: 0, tilt: 0, t: 0, back: null, front: null };
  var dust = [];
  function drawRobot() {
    if (bot.back) bot.back();
    paint(bot.view === 'side' ? sideCells(bot.side) : frontCells(bot.pose), bot.face < 0);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(bot.x, ground - bot.lift); if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S); ctx.restore();
    if (bot.front) bot.front();
  }
  function puff(x, n, col) {
    for (var i = 0; i < n; i++) dust.push({ x: x + (Math.random() - .5) * 26, y: ground - 2, vx: (Math.random() - .5) * 70,
                                             vy: -20 - Math.random() * 50, t: 0, life: .5 + Math.random() * .4, col: col });
  }
  function front(pose, back, fr) { bot.view = 'front'; bot.pose = pose; bot.back = back || null; bot.front = fr || null; }
  function side(o, back, fr) { bot.view = 'side'; bot.side = o; bot.back = back || null; bot.front = fr || null; }

  /* ---------------------------------------------------------------- routines */
  function walkTo(target, speed) {
    speed = speed || 95;
    return { dur: 1, start: function () { this.dur = Math.abs(target - bot.x) / speed + .05; }, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      var k = Math.floor(t * 5) % 2;
      side({ leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' }); bot.lift = 0; bot.tilt = 0;
    } };
  }
  function idle(sec) {
    return { dur: sec, run: function (t) { front({ blink: (t % 2.4) < .12, look: { x: bot.face, y: 0 } }); bot.lift = 0; bot.tilt = 0; } };
  }
  // the flatbed scanner
  function scanRoutine() {
    var sx, popped;
    return { dur: 7.2, start: function () { bot.face = 1; sx = bot.x + 4 * S; popped = false; }, run: function (t) {
      bot.tilt = 0; bot.lift = 0;
      var k = t < .5 ? t / .5 : t > 6.7 ? Math.max(0, (7.2 - t) / .5) : 1;
      var placing = t > .6 && t < 1.5, onGlass = t < 1.5 ? 0 : t < 4.2 ? 1 : 0;
      var light = t > 1.8 && t < 3.8 ? ((t - 1.8) / 1 % 1) : -1;
      var out = t > 4.2 && t < 6.6 ? Math.min(1, (t - 4.2) / .5) : 0;
      if (t > 1.5 && !popped) { popped = true; puff(sx, 2, CASE_D); }
      front({ armR: placing ? 'reach' : t > 4.2 && t < 6.2 ? 'reachUp' : 'down', look: { x: t > 4.2 ? 1 : 0, y: t < 4.2 && t > .6 ? 1 : 0 },
              blink: (t % 2.3) < .1 }, null, function () {
        var top = scanner(sx, k, onGlass, light);
        if (placing) { var hd = R.hand(BOT, 'reach'), p = cellAt(hd.x, hd.y), f = (t - .6) / .9;   // the page, from the hand to the glass
          px(p.x - 6 * S * f, p.y + (top - S * .5 - p.y) * f, 8 * S, S * .5, PAGE); }
        if (out > 0) {                                                                              // the page comes out, read
          var pw = 9 * S, ph = 12 * S, x = sx + 6 * S, y = top - 2 * S - ph * out;
          sheet(x, y, pw, ph, 1, t > 4.9 ? Math.min(1, (t - 4.9) / .5) : 0);
          if (t > 5.6) check(x + pw + 2.6 * S, y + ph * .3, Math.min(1, (t - 5.6) / .2) * (t > 6.4 ? Math.max(0, (6.6 - t) / .2) : 1));
        }
      });
    } };
  }
  // the magnifying glass
  function magnifyRoutine() {
    return { dur: 6.6, start: function () { bot.face = 1; }, run: function (t) {
      bot.tilt = 0; bot.lift = 0;
      var up = t > .3 && t < 6.2, k = t < .6 ? (t - .3) / .3 : t > 5.9 ? (6.2 - t) / .3 : 1;
      front({ armL: up ? 'reach' : 'down', armR: up ? 'reach' : 'down', look: { x: -1, y: 0 }, blink: (t % 2.6) < .1 }, null, function () {
        if (!up) return;
        var hl = R.hand(BOT, 'reach'), pl = cellAt(15 - hl.x, hl.y), pr = cellAt(hl.x, hl.y);
        var pw = 10 * S, ph = 13 * S * Math.max(0, Math.min(1, k)), x = pl.x - pw + S, y = pl.y - ph + S;
        var found = t > 3.9;
        sheet(x, y, pw, ph, ph > 12 * S ? 1 : 0, found ? Math.min(1, (t - 3.9) / .5) : 0);
        if (ph < 12 * S) return;
        // the lens goes down the lines, then rests on the signature
        var u = Math.min(1, Math.max(0, (t - .8) / 3)), row = Math.min(4, Math.floor(u * 5)), f = u * 5 - row;
        var lx = found ? x + pw * .45 : x + pw * (.2 + .6 * (row % 2 ? 1 - f : f)), ly = found ? y + ph * .76 : y + ph * (.14 + row * .14);
        lens(lx, ly, pr.x, pr.y);
      });
    } };
  }
  var ROUTINES = [scanRoutine, magnifyRoutine];
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.2 + Math.random() * .5);
      spot = Math.max(W * .14, Math.min(W * .72, spot));
      queue.push(walkTo(spot), idle(.5 + Math.random() * .5), r, idle(.7));
    }
    cur = queue.shift(); curT = 0; if (cur.start) cur.start();
  }
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight; ground = H - 1;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!bot.x) bot.x = W * .3;
  }
  function frame(ts) {
    now = ts / 1000; var dt = Math.min(.05, last ? now - last : 0); last = now;
    if (!cur) next();
    curT += dt; bot.t = now; cur.run(curT, dt);
    bot.x = Math.max(10 * S, Math.min(W - 10 * S, bot.x));
    if (curT >= cur.dur) next();
    ctx.clearRect(0, 0, W, H);
    dust = dust.filter(function (d) { d.t += dt; return d.t < d.life; });
    dust.forEach(function (d) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt;
      ctx.globalAlpha = .6 * (1 - d.t / d.life); ctx.fillStyle = d.col || INK; ctx.fillRect(d.x, d.y, 3, 3); ctx.globalAlpha = 1; });
    drawRobot();
    if (!reduce) requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  if (reduce) { idle(1).run(0); drawRobot(); } else requestAnimationFrame(frame);
})();
