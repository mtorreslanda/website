/* Ball possession: the same pixel robot as on every project page, now a footballer in a turquoise shirt.
   Routines on the dividing line at the bottom of the first screen (SH38):
     keepy-ups · the robot juggles the ball: foot, foot, knee, head, and catches it;
     the shot  · a goal rises from the line, the robot dribbles towards it and scores; the net shakes.
   Front view from robot.js, side view from robot-side.js; the shirt and the props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="pitch"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#178A7E', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', SHIRT = '#4FD1C5', SHIRT_D = '#178A7E', NUM = '#FFFFFF', POST = '#F5F3EE',
      NET = 'rgba(26,26,26,.28)', BALL_W = '#FFFFFF', BALL_K = '#1A1A1A';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the shirt, both views */
  function frontCells(pose) {
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 3 && p.x <= 12); });
    for (var y = 9; y <= 13; y++) for (var x = 3; x <= 12; x++) c.push({ x: x, y: y, col: y === 9 && (x === 7 || x === 8) ? SHIRT_D : SHIRT });
    [[6, 10], [7, 10], [8, 10], [8, 11], [7, 12], [7, 13]].forEach(function (p) { c.push({ x: p[0], y: p[1], col: NUM }); });   // a number on the chest
    return c;
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 6 && p.x <= 10); });
    for (var y = 9; y <= 13; y++) for (var x = 6; x <= 10; x++) c.push({ x: x, y: y, col: x === 6 ? SHIRT_D : SHIRT });
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
  function ball(x, y, spin) {                                                                       // a pixel ball, 3 x 3 cells
    var r = S * 1.5;
    px(x - r, y - r, 2 * r, 2 * r, BALL_W); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(Math.round(x - r) + .5, Math.round(y - r) + .5, 2 * r - 1, 2 * r - 1);
    var k = Math.floor(((spin || 0) % 1 + 1) % 1 * 4), q = S * .5;
    var spots = [[0, 0], [-1, -1], [1, 1], [-1, 1]];
    px(x - q / 2 + spots[k][0] * q, y - q / 2 + spots[k][1] * q, q * 1.3, q * 1.3, BALL_K);
  }
  function goal(cx, k, shake) {                                                                     // facing the robot (left side open)
    var h = 13 * S * k, top = ground - h, w = 9 * S, x = cx;
    ctx.strokeStyle = NET; ctx.lineWidth = 1;
    for (var i = 1; i < 6; i++) { var off = shake ? Math.sin(i * 1.7 + shake * 20) * 2 : 0;
      ctx.beginPath(); ctx.moveTo(x + i * w / 6 + off, top); ctx.lineTo(x + i * w / 6 - off, ground); ctx.stroke(); }
    for (var j = 1; j < 8; j++) { var yy = top + j * h / 8; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w + (shake ? Math.sin(j + shake * 30) * 2 : 0), yy); ctx.stroke(); }
    px(x - S * .2, top, S, h, POST); px(x - S * .2, top, w, S, POST); px(x + w - S, top, S, h, '#D8D5CB');
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x - S * .2) + .5, Math.round(top) + .5, Math.round(S) - 1, Math.round(h) - 1);
    return top;
  }

  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, lift: 0, tilt: 0, t: 0, back: null, front: null };
  var dust = [], carry = null;                                                                      // carry: the ball at the feet while walking
  function drawRobot() {
    if (bot.back) bot.back();
    paint(bot.view === 'side' ? sideCells(bot.side) : frontCells(bot.pose), bot.face < 0);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(bot.x, ground - bot.lift); if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S); ctx.restore();
    if (bot.front) bot.front();
    if (carry) carry();
  }
  function puff(x, n, col) {
    for (var i = 0; i < n; i++) dust.push({ x: x + (Math.random() - .5) * 26, y: ground - 2, vx: (Math.random() - .5) * 70,
                                             vy: -20 - Math.random() * 50, t: 0, life: .5 + Math.random() * .4, col: col });
  }
  function front(pose, back, fr) { bot.view = 'front'; bot.pose = pose; bot.back = back || null; bot.front = fr || null; }
  function side(o, back, fr) { bot.view = 'side'; bot.side = o; bot.back = back || null; bot.front = fr || null; }

  /* ---------------------------------------------------------------- routines */
  function walkTo(target, speed, dribble) {
    speed = speed || 95;
    return { dur: 1, start: function () { this.dur = Math.abs(target - bot.x) / speed + .05; }, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      var k = Math.floor(t * 5) % 2;
      side({ leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' }); bot.lift = 0; bot.tilt = 0;
      carry = dribble ? function () { var push = (t * 5) % 1; ball(bot.x + bot.face * (5 + 2 * push) * S, ground - 1.5 * S, t * 3 * bot.face); } : null;
    } };
  }
  function idle(sec) {
    return { dur: sec, run: function (t) { carry = null; front({ blink: (t % 2.4) < .12, look: { x: bot.face, y: 0 } }); bot.lift = 0; bot.tilt = 0; } };
  }
  // keepy-ups: foot, foot, knee, foot, head, head, then caught
  function keepyRoutine() {
    var touches = [['foot', 1], ['foot', -1], ['knee', 1], ['foot', 1], ['head', 0], ['head', 0], ['foot', -1]], T = .62;
    return { dur: touches.length * T + 1.1, start: function () { bot.face = 1; carry = null; }, run: function (t) {
      bot.tilt = 0;
      var n = Math.min(touches.length - 1, Math.floor(t / T)), f = (t - n * T) / T, tc = touches[n];
      var done = t > touches.length * T;
      var yTouch = { foot: ground - 2 * S, knee: ground - 5 * S, head: ground - 19.5 * S };
      // the ball goes up from this touch and comes down onto the next
      var nx = touches[Math.min(n + 1, touches.length - 1)];
      var y0 = yTouch[tc[0]], y1 = done ? ground - 8 * S : yTouch[nx[0]], peak = Math.min(y0, y1) - 7 * S;
      var x0 = bot.x + tc[1] * 2.5 * S, x1 = bot.x + nx[1] * 2.5 * S;
      var by = done ? ground - 8 * S : (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * peak + f * f * y1, bx = done ? bot.x : x0 + (x1 - x0) * f;
      var hit = f < .15 && !done;
      bot.lift = tc[0] === 'head' && hit ? S * .5 : 0;
      front({ armL: done ? 'reach' : 'down', armR: done ? 'reach' : 'down', look: { x: 0, y: by < ground - 18 * S ? -1 : by > ground - 9 * S ? 1 : 0 },
              step: hit && tc[0] !== 'head' ? 1 : 0, blink: (t % 2.2) < .08 }, null, function () { ball(bx, by, t * 2); });
      if (hit && f < .02) puff(bx, 1, '#B9B5AA');
    } };
  }
  // the shot: a goal rises, a dribble towards it, a kick, the net shakes
  function shotRoutine() {
    var gx, kickT, start;
    return { dur: 1, start: function () {
      gx = Math.min(W - 16 * S, bot.x + 30 * S); start = bot.x;
      var dist = gx - 9 * S - start; kickT = .7 + Math.max(.6, dist / 110); this.dur = kickT + 2.6;
    }, run: function (t, dt) {
      var k = t < .6 ? t / .6 : t > this.dur - .5 ? Math.max(0, (this.dur - t) / .5) : 1;
      var shake = 0;
      if (t < .7) { carry = function () { ball(bot.x + 5 * S, ground - 1.5 * S, 0); }; front({ look: { x: 1, y: 0 } }); }
      else if (t < kickT) {                                                                         // dribbling
        bot.face = 1; bot.x = Math.min(gx - 9 * S, bot.x + 110 * dt);
        var s = Math.floor(t * 5) % 2; side({ leg: s ? 0 : 2, arm: s ? 'swing0' : 'swing1' });
        carry = function () { var p = (t * 5) % 1; ball(bot.x + (5 + 2 * p) * S, ground - 1.5 * S, t * 3); };
      } else {                                                                                      // the kick and the goal
        var f = t - kickT, fl = Math.min(1, f / .45);
        side({ leg: f < .25 ? 1 : 2, arm: 'swing0' });
        var bx = bot.x + 5 * S + (gx + 5 * S - (bot.x + 5 * S)) * fl, by = ground - 1.5 * S - Math.sin(fl * Math.PI) * 5 * S - fl * 3 * S;
        if (f > .45) { shake = f; bx = gx + 5 * S; by = ground - 4.5 * S + Math.min(3 * S, (f - .45) * 30); }
        carry = function () { ball(bx, by, f * 4); };
        if (f > .45 && f < .47) puff(gx + 5 * S, 3, '#B9B5AA');
        if (f > 1.6) { carry = null; front({ armL: 'up', armR: 'up', look: { x: 0, y: -1 }, step: Math.floor(f * 6) % 2 }); bot.lift = Math.abs(Math.sin(f * 9)) * S; }
      }
      bot.front = (function (old) { return function () { if (old) old(); goal(gx, k, shake); }; })(bot.front);
    } };
  }
  var ROUTINES = [keepyRoutine, shotRoutine];
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.15 + Math.random() * .4);
      spot = Math.max(W * .12, Math.min(W * .6, spot));
      queue.push(walkTo(spot, 95, true), idle(.4 + Math.random() * .4), r, idle(.6));
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
