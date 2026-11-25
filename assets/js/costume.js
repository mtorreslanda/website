/* The same pixel robot on every project page. It lives on the dividing line at the bottom of the first
   screen and plays there; only the costume and the routine change from project to project
   (data-costume on the canvas). Front view from robot.js, side view from robot-side.js.
   Every pose is drawn first into a small sprite canvas and then placed (or rotated) as one image, so a
   rotated robot has no seams between its cells. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#C0522A', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: true,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', SHELL = BOT.accent, SHD = '#8E3B1E', MASK = '#8A8A8A', LEATHER = '#7A4524';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: MASK, s: SHELL, d: SHD, h: INK, b: LEATHER, l: EYE };
  var S = 6, GRID = 18;                             // px per cell; sprite canvas of 18 x 18 cells (room for hands)
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the two views, with the helmet */
  var HELMET = (function () {                       // front view
    var c = [];
    function px(x, y, col) { c.push({ x: x, y: y, col: col }); }
    for (var x = 5; x <= 10; x++) px(x, 1, SHELL);
    for (x = 4; x <= 11; x++) px(x, 2, SHELL);
    for (x = 3; x <= 12; x++) px(x, 3, SHELL);
    [4, 5, 6].forEach(function (y) { px(2, y, SHELL); px(3, y, SHELL); px(12, y, SHELL); px(13, y, SHELL); });
    px(2, 5, INK); px(13, 5, INK); px(2, 6, SHD); px(13, 6, SHD); px(6, 1, SHD); px(9, 1, SHD);
    for (x = 4; x <= 11; x++) px(x, 7, MASK);
    px(4, 6, MASK); px(11, 6, MASK);
    for (x = 6; x <= 9; x++) px(x, 8, MASK);
    return c;
  })();
  function frontCells(pose) {
    return R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .concat(HELMET);
  }
  function sideCells(o) {
    o.helmet = true;
    return RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; });
  }
  // draw a list of cells into the sprite canvas (1 cell of margin left and top), mirrored if facing left
  function paint(cells, flip) {
    sctx.clearRect(0, 0, sprite.width, sprite.height);
    cells.forEach(function (c) {
      var x = flip ? 15 - c.x : c.x;
      sctx.fillStyle = c.col; sctx.fillRect((x + 1) * S, (c.y + 1) * S, S, S);
    });
  }
  function ball(x, y, spin) {                       // a football in the air, laces turning
    var s = S * .9, f = Math.floor(spin || 0) % 2;
    ctx.fillStyle = LEATHER;
    ctx.fillRect(x + s, y, s * 2, s); ctx.fillRect(x, y + s, s * 4, s); ctx.fillRect(x + s, y + 2 * s, s * 2, s);
    ctx.fillStyle = EYE; ctx.fillRect(x + s * (1 + f), y + s, s, s * .5);
  }

  /* ---------------------------------------------------------------- the robot on the line */
  // view 'front' (pose for robot.js, ball 'up' | 'hand' | null) or 'side' (options for robot-side.js)
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, ball: 'hand', lift: 0, tilt: 0 };
  var flying = null, dust = [];
  function drawRobot() {
    var cells;
    if (bot.view === 'side') cells = sideCells(bot.side);
    else {
      cells = frontCells(bot.pose);
      if (bot.ball) {                               // the ball in a front pose, as cells
        var bx = bot.ball === 'up' ? 13 : 12, by = bot.ball === 'up' ? 1 : 11;
        [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2]].forEach(function (d) {
          cells.push({ x: bx + d[0], y: by + d[1], col: d[0] === 1 && d[1] === 1 ? EYE : LEATHER });
        });
      }
    }
    paint(cells, bot.face < 0);
    // feet (row 16, centre of the grid) on the line; rotation about the feet
    var fx = bot.x, fy = ground - bot.lift;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(fx, fy);
    if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S);
    ctx.restore();
  }
  function puff(x, n) {
    for (var i = 0; i < n; i++) dust.push({ x: x + (Math.random() - .5) * 20, y: ground - 2, vx: (Math.random() - .5) * 60,
                                             vy: -20 - Math.random() * 40, t: 0, life: .5 + Math.random() * .4 });
  }
  function front(pose, ballAt) { bot.view = 'front'; bot.pose = pose; bot.ball = ballAt === undefined ? null : ballAt; }
  function side(o) { bot.view = 'side'; bot.side = o; }

  /* ---------------------------------------------------------------- routines */
  function walkTo(target) {
    var speed = 110;
    return { dur: Math.abs(target - bot.x) / speed + .05, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      var k = Math.floor(t * 5) % 2;
      side({ leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' });
      bot.lift = 0; bot.tilt = 0;
    } };
  }
  function idle(sec) {
    return { dur: sec, run: function (t) {
      var l = Math.sin(t * 1.3);
      front({ blink: (t % 2.2) < .12, look: { x: l > .3 ? 1 : (l < -.3 ? -1 : 0), y: 0 } }, 'hand');
      bot.lift = 0; bot.tilt = 0;
    } };
  }
  // near the right edge: throw off to the right, run back to the left waving for it, the pass comes from the right
  function throwAndCatch() {
    var catchAt;
    return { dur: 5.6, start: function () { bot.face = 1; catchAt = null; }, run: function (t, dt) {
      bot.tilt = 0;
      if (t < .7) { front({ armR: 'up', look: { x: 1, y: -1 } }, 'up'); bot.lift = 0; }
      else if (t < 1.3) {
        if (bot.ball) {
          flying = { x0: bot.x + 6 * S, y0: ground - 17 * S, x1: W + 90, y1: ground - 30 * S, t0: now, dur: .8, h: 14 * S, out: true };
        }
        front({ armR: 'reach', look: { x: 1, y: 0 } }, null);
      }
      else if (t < 3.5) {                           // go: run left, looking back, both arms waving
        if (catchAt === null) catchAt = Math.max(W * .12, bot.x - 2.2 * 220);
        bot.face = -1;
        bot.x = Math.max(catchAt, bot.x - 220 * dt);
        var k = Math.floor(t * 9) % 2;
        side({ leg: k, arm: Math.floor(t * 6) % 2 ? 'up0' : 'up1', lookBack: true });
        if (!flying && t > 2.3) {                   // the pass, from the same side (off-screen right)
          flying = { x0: W + 60, y0: ground - 34 * S, x1: catchAt - 2 * S, y1: ground - 19 * S, t0: now, dur: 1.2, h: 18 * S };
        }
      }
      else if (t < 3.7) { flying = null; bot.face = 1; front({ armR: 'up', armL: 'up', look: { x: 0, y: -1 } }, 'up'); }
      else {                                        // two hops
        var h = (t - 3.7) / .45; bot.lift = Math.abs(Math.sin(h * Math.PI)) * 10;
        if (bot.lift < 1 && Math.floor(h) !== bot._k) { puff(bot.x, 4); bot._k = Math.floor(h); }
        front({ armR: Math.floor(h * 2) % 2 ? 'up' : 'wave', armL: 'up', step: Math.floor(h * 2) % 2 }, Math.floor(h * 2) % 2 ? 'up' : null);
      }
    } };
  }
  // ball carrier, side view: burst, a hurdle, a stiff arm, slow down
  function carry() {
    var dir, v0;
    return { dur: 4.4, start: function () {
      dir = bot.x < W / 2 ? 1 : -1; bot.face = dir;
      var room = dir > 0 ? W * .9 - bot.x : bot.x - W * .1;
      v0 = Math.min(230, room / 3.6);
    }, run: function (t, dt) {
      var v = t < .25 ? 0 : (t < 3.4 ? v0 : v0 * Math.max(0, 1 - (t - 3.4)));
      bot.x += dir * v * dt; bot.face = dir; bot.tilt = 0;
      var k = Math.floor(t * 10) % 2, arm = 'tuck', leg = k;
      bot.lift = k ? 2 : 0;
      if (t > 1.3 && t < 1.95) {                    // hurdle: up and over, lead leg out
        var h = (t - 1.3) / .65; bot.lift = Math.sin(h * Math.PI) * 34; leg = 3;
        if (h > .95 && !bot._landed) { puff(bot.x, 6); bot._landed = true; }
      } else bot._landed = false;
      if (t > 2.4 && t < 3.0) arm = 'stiff';
      if (t >= 3.9) { leg = 2; bot.lift = 0; }
      side({ leg: leg, arm: arm });
      if (v > 60 && Math.random() < .3) puff(bot.x - dir * 14, 1);
    } };
  }
  // tackle: stance, burst, dive, slide, get up
  function tackle() {
    var dir;
    return { dur: 4.0, start: function () {
      dir = bot.x < W / 2 ? 1 : -1; bot.face = dir;
    }, run: function (t, dt) {
      if (t < .7) { side({ leg: 2, arm: 'swing0' }); bot.lift = -2; bot.tilt = .35; }                       // three-point stance
      else if (t < 1.4) { bot.x += dir * 300 * dt; var k = Math.floor(t * 12) % 2; side({ leg: k, arm: k ? 'swing0' : 'swing1' }); bot.lift = k ? 2 : 0; bot.tilt = .12; }
      else if (t < 1.9) {                           // in the air, flat out
        var h = (t - 1.4) / .5; bot.x += dir * 300 * dt; bot.tilt = .12 + h * 1.3; bot.lift = Math.sin(h * Math.PI) * 16;
        side({ leg: 0, arm: 'forward' });
      }
      else if (t < 2.4) { var s = 1 - (t - 1.9) / .5; bot.x += dir * 200 * s * dt; bot.lift = 0; bot.tilt = 1.42; side({ leg: 0, arm: 'forward' });
                          if (Math.random() < .6) puff(bot.x + dir * 30, 1); }
      else if (t < 3.0) { bot.tilt = 1.42 * (1 - (t - 2.4) / .6); side({ leg: 2, arm: 'swing1' }); }
      else { bot.tilt = 0; front({ armR: Math.floor(t * 8) % 2 ? 'wave' : 'down', look: { x: 0, y: 1 } }, t > 3.6 ? 'hand' : null); }   // brush off, pick up the ball
    } };
  }

  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = [throwAndCatch, carry, tackle].sort(function () { return Math.random() - .5; });
      var make = bag.pop();
      var spot = make === throwAndCatch ? W * (.8 + Math.random() * .06)          // the pass play starts near the right edge
                                        : bot.x + (Math.random() < .5 ? -1 : 1) * (80 + Math.random() * 160);
      spot = Math.max(W * .12, Math.min(W * .88, spot));
      queue.push(walkTo(spot), idle(.5 + Math.random() * .6), make(), idle(.8));
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
    curT += dt; cur.run(curT, dt);
    bot.x = Math.max(9 * S, Math.min(W - 9 * S, bot.x));         // never leaves the screen
    if (curT >= cur.dur) next();
    ctx.clearRect(0, 0, W, H);
    dust = dust.filter(function (d) { d.t += dt; return d.t < d.life; });
    dust.forEach(function (d) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt;
      ctx.fillStyle = 'rgba(120, 110, 95, ' + (0.5 * (1 - d.t / d.life)).toFixed(2) + ')'; ctx.fillRect(d.x, d.y, 3, 3); });
    drawRobot();
    if (flying) {
      var k = (now - flying.t0) / flying.dur;
      if (k >= 1 && flying.out) flying = null;
      else {
        k = Math.min(k, 1);
        ball(flying.x0 + (flying.x1 - flying.x0) * k, flying.y0 + (flying.y1 - flying.y0) * k - flying.h * 4 * k * (1 - k), now * 14);
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  if (reduce) { idle(1).run(0); drawRobot(); } else requestAnimationFrame(frame);
})();
