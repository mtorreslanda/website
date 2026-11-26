/* TennisVision: the same pixel robot as on every project page, with a headband and a racket. It lives on the
   dividing line at the bottom of the first screen and plays there (SH38): a serve, a forehand rally against
   a ball that comes back from off-screen, a sprint for a wide ball, and the championship point celebration
   (racket down, flat on its back). Front view from robot.js, side view from robot-side.js; the racket is
   drawn on top, pivoting on the hand. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="tennis"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#C0522A', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: true,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', BAND = '#C0522A', FELT = '#C9D43A', FELT_D = '#8E9A1E', GRIP = '#C0522A';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- headband, both views */
  var BAND_FRONT = [];
  for (var bx = 3; bx <= 12; bx++) BAND_FRONT.push({ x: bx, y: 4, col: BAND });
  function frontCells(pose) {
    return R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .concat(BAND_FRONT);
  }
  function sideCells(o, t) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; });
    for (var x = 5; x <= 11; x++) c.push({ x: x, y: 4, col: BAND });
    var flap = Math.floor((t || 0) * 8) % 2;             // the two tails of the band, flapping behind
    c.push({ x: 4, y: 4, col: BAND }, { x: 3, y: 4 + flap, col: BAND }, { x: 2, y: 5, col: BAND });
    return c;
  }
  function paint(cells, flip) {
    sctx.clearRect(0, 0, sprite.width, sprite.height);
    cells.forEach(function (c) {
      var x = flip ? 15 - c.x : c.x;
      sctx.fillStyle = c.col; sctx.fillRect((x + 1) * S, (c.y + 1) * S, S, S);
    });
  }
  // world position of the centre of a cell of the sprite (for the racket's pivot)
  function cellAt(cx, cy) {
    var x = bot.face < 0 ? 15 - cx : cx;
    return { x: bot.x + (x + 1.5 - 8.5) * S, y: ground - bot.lift + (cy + 1.5 - 18) * S };
  }

  /* ---------------------------------------------------------------- racket and ball */
  // ang: 0 = pointing forward (the way the robot faces), negative = up
  function racket(hand, ang) {
    var s = S * .8;
    ctx.save();
    ctx.translate(hand.x, hand.y); ctx.scale(bot.face, 1); ctx.rotate(ang);
    ctx.fillStyle = GRIP; ctx.fillRect(-s * .5, -s * .5, s * 2, s);                    // grip
    ctx.fillStyle = INK; ctx.fillRect(s * 1.5, -s * .5, s * 1.5, s);                   // throat
    var cx = s * 6, rx = s * 3, ry = s * 2.4;                                           // head: a pixel oval
    for (var i = -3; i <= 3; i++) for (var j = -2; j <= 2; j++) {
      var d = (i * i) / 9 + (j * j) / 5.8;
      if (d > 1.12) continue;
      ctx.fillStyle = d > .55 ? INK : ((i + j) % 2 ? 'rgba(26,26,26,.18)' : 'rgba(245,243,238,.75)');
      ctx.fillRect(cx + i * s - s / 2, j * s - s / 2, s, s);
    }
    ctx.restore();
  }
  function ball(x, y) {
    var s = S * .8;
    ctx.fillStyle = FELT; ctx.fillRect(x - s, y - s, s * 2, s * 2);
    ctx.fillStyle = FELT_D; ctx.fillRect(x, y - s, s, s * .5); ctx.fillRect(x - s, y + s * .5, s, s * .5);
  }
  function shadow(x) { ctx.fillStyle = 'rgba(26,26,26,.18)'; ctx.fillRect(x - S, ground - 2, S * 2, 2); }

  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, lift: 0, tilt: 0, rk: null, t: 0 };
  var balls = [], dust = [], dropped = null;
  function drawRobot() {
    paint(bot.view === 'side' ? sideCells(bot.side, bot.t) : frontCells(bot.pose), bot.face < 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(bot.x, ground - bot.lift);
    if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S);
    ctx.restore();
    if (bot.rk) racket(cellAt(bot.rk[0], bot.rk[1]), bot.rk[2]);
  }
  function puff(x, n) {
    for (var i = 0; i < n; i++) dust.push({ x: x + (Math.random() - .5) * 20, y: ground - 2, vx: (Math.random() - .5) * 60,
                                             vy: -20 - Math.random() * 40, t: 0, life: .5 + Math.random() * .4 });
  }
  function front(pose, rk) { bot.view = 'front'; bot.pose = pose; bot.rk = rk || null; }
  function side(o, rk) { bot.view = 'side'; bot.side = o; bot.rk = rk || null; }
  // a ball in flight from (x0, y0) to (x1, y1) in dur seconds, apex h above the straight line; bounce: where it lands first
  function fly(x0, y0, x1, y1, dur, h, out) { var b = { x0: x0, y0: y0, x1: x1, y1: y1, t0: now, dur: dur, h: h, out: out }; balls.push(b); return b; }
  function ballPos(b, k) { return { x: b.x0 + (b.x1 - b.x0) * k, y: b.y0 + (b.y1 - b.y0) * k - b.h * 4 * k * (1 - k) }; }

  // rest: side view, racket in the front hand pointing forward and down
  var READY = [12, 12, .5], BACK = [3, 12, -2.4], HIT = [14, 10, -.15], FINISH = [13, 3, -2.2];

  /* ---------------------------------------------------------------- routines */
  function walkTo(target) {
    var speed = 110;
    return { dur: Math.abs(target - bot.x) / speed + .05, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      var k = Math.floor(t * 5) % 2;
      side({ leg: k ? 0 : 2, arm: 'swing0' }, READY);
      bot.lift = 0; bot.tilt = 0;
    } };
  }
  function idle(sec) {
    return { dur: sec, run: function (t) {          // split-step bounce on the toes, waiting for the ball
      side({ leg: 2, arm: 'swing0', blink: (t % 2.2) < .12 }, READY);
      bot.lift = Math.abs(Math.sin(t * 7)) * 3; bot.tilt = 0;
    } };
  }
  // the serve: toss, trophy pose, hit up and out to the right; a hop on landing
  function serve() {
    var tossed;
    return { dur: 3.0, start: function () { bot.face = 1; tossed = null; }, run: function (t) {
      bot.tilt = 0; bot.lift = 0;
      if (t < .5) front({ armL: 'down', armR: 'down', look: { x: 1, y: 0 } }, [13, 12, .9]);
      else if (t < 1.25) {
        if (!tossed) tossed = fly(bot.x - 3 * S, ground - 13 * S, bot.x + 2 * S, ground - 15 * S, 1.1, 18 * S);
        front({ armL: 'up', armR: 'down', look: { x: 0, y: -1 } }, [13, 11, -2.6 + (t - .5) * .6]);
      }
      else if (t < 1.55) {
        if (tossed) { balls.splice(balls.indexOf(tossed), 1); tossed = null;
          fly(bot.x + 6 * S, ground - 24 * S, W + 80, ground - 8 * S, .55, 2 * S, true); }
        bot.lift = 8; front({ armL: 'down', armR: 'up', look: { x: 1, y: -1 } }, [14, 4, -1.2 + (t - 1.25) * 6]);
      }
      else if (t < 2.0) { bot.lift = 0; side({ leg: 0, arm: 'forward' }, [14, 10, .9]); if (t < 1.6) puff(bot.x, 3); }
      else idle(1).run(t - 2);
    } };
  }
  // the rally: three forehands against a ball that comes back from the right, a bounce in front of the robot
  function rally() {
    var hits = 0, incoming = null, tNext = 0;
    return { dur: 7.2, start: function () { bot.face = 1; hits = 0; incoming = null; tNext = .3; }, run: function (t, dt) {
      bot.tilt = 0;
      if (!incoming && hits < 3 && t > tNext) {     // the ball arrives: a bounce on the line, then up to the hip
        var land = bot.x + 9 * S;
        incoming = { a: fly(W + 60, ground - 20 * S, land, ground - 1, .75, 4 * S), land: land, phase: 0 };
      }
      if (incoming) {
        var k = (now - incoming.a.t0) / incoming.a.dur;
        if (incoming.phase === 0 && k >= 1) {       // the bounce, then up to the hitting point
          balls.splice(balls.indexOf(incoming.a), 1); puff(incoming.land, 2);
          incoming.a = fly(incoming.land, ground - 1, bot.x + 4 * S, ground - 9 * S, .35, 4 * S); incoming.phase = 1;
        } else if (incoming.phase === 1 && k >= 1) {  // contact: back over the net, off to the right
          balls.splice(balls.indexOf(incoming.a), 1);
          fly(bot.x + 4 * S, ground - 9 * S, W + 60, ground - 16 * S, .7, 10 * S, true);
          incoming = null; hits++; tNext = t + .9; bot._hitAt = t;
        }
      }
      var since = t - (bot._hitAt || -9), pre = incoming && incoming.phase === 1;
      var shuffle = Math.floor(t * 6) % 2;
      if (pre || (incoming && (now - incoming.a.t0) / incoming.a.dur > .5)) side({ leg: 0, arm: 'swing1' }, BACK);
      else if (since < .18) side({ leg: 0, arm: 'forward' }, HIT);
      else if (since < .5) side({ leg: 2, arm: 'up0' }, FINISH);
      else { side({ leg: shuffle ? 2 : 1, arm: 'swing0' }, READY); bot.lift = shuffle ? 2 : 0; return; }
      bot.lift = 0;
    } };
  }
  // a wide ball to the left: sprint, stretch, slide, and back to the middle
  function sprintWide() {
    var target, b = null, hit = false;
    return { dur: 3.4, start: function () {
      target = Math.max(W * .12, bot.x - 260); hit = false;
      b = fly(W + 60, ground - 22 * S, target - 10 * S, ground - 7 * S, 1.6, 6 * S);
    }, run: function (t, dt) {
      bot.tilt = 0; bot.lift = 0;
      if (t < 1.45) { bot.face = -1; bot.x = Math.max(target, bot.x - 240 * dt);
        var k = Math.floor(t * 10) % 2; side({ leg: k, arm: k ? 'swing0' : 'swing1' }, READY);
        if (Math.random() < .3) puff(bot.x + 14, 1); }
      else if (t < 1.75) {                            // stretched out, sliding on the clay
        side({ leg: 0, arm: 'forward' }, HIT); bot.x -= 60 * dt; if (Math.random() < .7) puff(bot.x - 10, 1);
        if (!hit && t > 1.58) { hit = true; var i = balls.indexOf(b); if (i >= 0) balls.splice(i, 1);
          var p = cellAt(14, 10); fly(p.x, p.y, W + 60, ground - 14 * S, 1.2, 16 * S, true); }
      }
      else if (t < 2.1) side({ leg: 2, arm: 'up0' }, FINISH);
      else { bot.face = 1; bot.x += 140 * dt; var k2 = Math.floor(t * 6) % 2; side({ leg: k2 ? 0 : 2, arm: 'swing0' }, READY); }
    } };
  }
  // championship point: racket down, flat on the back, arms up; then up again and pick the racket up
  function celebrate() {
    return { dur: 4.2, start: function () { bot.face = 1; }, run: function (t) {
      if (t < .4) { front({ armR: 'up', armL: 'up', look: { x: 0, y: -1 } }); bot.lift = 0; bot.tilt = 0;
        if (!dropped) dropped = { x: bot.x + 10 * S }; }
      else if (t < 1.0) { var k = (t - .4) / .6; bot.tilt = -k * 1.5; bot.lift = Math.sin(k * Math.PI) * 6;
        front({ armR: 'up', armL: 'up', look: { x: 0, y: -1 } }); if (k > .9 && !bot._down) { puff(bot.x - 40, 8); bot._down = true; } }
      else if (t < 2.8) { bot.tilt = -1.5; bot.lift = 0; front({ armR: Math.floor(t * 4) % 2 ? 'up' : 'wave', armL: 'up', blink: true }); }
      else if (t < 3.4) { bot.tilt = -1.5 * (1 - (t - 2.8) / .6); front({ armR: 'down', armL: 'down', look: { x: 1, y: 1 } }); }
      else { bot.tilt = 0; bot._down = false; if (t > 3.8) dropped = null;
        front({ armR: t > 3.8 ? 'down' : 'reachDown', look: { x: 1, y: 1 } }, t > 3.8 ? [13, 12, .9] : null); }
    } };
  }

  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = [serve, rally, sprintWide, celebrate].sort(function () { return Math.random() - .5; });
      var make = bag.pop();
      var spot = make === sprintWide ? W * (.55 + Math.random() * .25) : W * (.2 + Math.random() * .45);
      if (make === serve) spot = W * (.15 + Math.random() * .2);
      queue.push(walkTo(Math.max(W * .12, Math.min(W * .8, spot))), idle(.5 + Math.random() * .5), make(), idle(.7));
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
    bot.x = Math.max(9 * S, Math.min(W - 9 * S, bot.x));
    if (curT >= cur.dur) next();
    ctx.clearRect(0, 0, W, H);
    dust = dust.filter(function (d) { d.t += dt; return d.t < d.life; });
    dust.forEach(function (d) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt;
      ctx.fillStyle = 'rgba(176, 92, 52, ' + (0.55 * (1 - d.t / d.life)).toFixed(2) + ')'; ctx.fillRect(d.x, d.y, 3, 3); });
    if (dropped) { var d0 = { x: dropped.x, y: ground - S * .4 }; ctx.save(); ctx.translate(d0.x, d0.y); ctx.restore();
      var f = bot.face; bot.face = 1; racket({ x: dropped.x, y: ground - S * .5 }, 0); bot.face = f; }
    drawRobot();
    balls = balls.filter(function (b) {
      var k = (now - b.t0) / b.dur;
      if (k >= 1 && b.out) return false;
      var p = ballPos(b, Math.min(k, 1)); shadow(p.x); ball(p.x, p.y); return true;
    });
    if (!reduce) requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  if (reduce) { idle(1).run(0); drawRobot(); } else requestAnimationFrame(frame);
})();
