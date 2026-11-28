/* Ball possession: the same pixel robot as on every project page, now a footballer in a full kit
   (red shirt with a white V-neck collar, crest, red sleeves, navy shorts, red socks, a 7 on the back; SH63).
   Routines on the dividing line at the bottom of the first screen (SH38), with the ball from the home page:
     keepy-ups  · real gravity, as on the home page: feet, knee and head, running under the ball, then a catch;
     the shot   · a goal rises, a dribble, a shot, the net shakes, and the celebration: a run, a jump with a half
                  turn in the air (the 7 on the back) and the landing with legs apart and arms down (no speech bubble, SH63);
     the header · a cross from the left, a jump, a header into the goal and a knee slide;
     the flick  · a rainbow flick while dribbling: the ball rolls up the back of the leg, over the head, and on.
   Front view from robot.js, side view from robot-side.js; the kit and the props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="pitch"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#178A7E', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', SHIRT = '#D0202E', SHIRT_D = '#9C1622', TRIM = '#FFFFFF', SHORTS = '#1F2B47',
      SOCK = '#D0202E', CREST = '#F2C230', POST = '#F5F3EE', NET = 'rgba(26,26,26,.28)', DUST = '#B9B5AA';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18, G = 1500;                                      // px per cell; gravity in px/s²
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the kit */
  function kitLegs(c) {                                                // shorts, socks and boots by row
    c.forEach(function (p) { if (p.y === 14) p.col = SHORTS; else if (p.y === 15) p.col = SOCK; else if (p.y === 16) p.col = INK; });
    return c;
  }
  function sleeves(c, cols) {                                          // the top cell of each arm takes the shirt colour
    cols.forEach(function (x) {
      var top = null;
      c.forEach(function (p) { if (p.x === x && p.y >= 8 && p.y <= 12 && (!top || p.y < top.y)) top = p; });
      if (top) top.col = SHIRT;
    });
    return c;
  }
  // front view; opt.back: the back of the shirt with the 7; opt.legs 'wide': the celebration stance
  function frontCells(pose, opt) {
    opt = opt || {};
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 3 && p.x <= 12); });
    if (opt.back) c.forEach(function (p) { if (p.y >= 3 && p.y <= 7) p.col = INK; });          // no face from behind
    if (opt.legs === 'wide') {
      c = c.filter(function (p) { return p.y < 14; });
      [[5, 14], [6, 14], [9, 14], [10, 14], [4, 15], [5, 15], [10, 15], [11, 15], [2, 16], [3, 16], [4, 16], [11, 16], [12, 16], [13, 16]]
        .forEach(function (q) { c.push({ x: q[0], y: q[1], col: INK }); });
    }
    var rows = { 9: [4, 11], 10: [3, 12], 11: [3, 12], 12: [3, 12], 13: [4, 11] };
    for (var y = 9; y <= 13; y++) for (var x = rows[y][0]; x <= rows[y][1]; x++)
      c.push({ x: x, y: y, col: x === rows[y][0] || x === rows[y][1] ? SHIRT_D : SHIRT });
    var put = function (q, col) { c.push({ x: q[0], y: q[1], col: col }); };
    if (opt.back) {
      [[6, 9], [7, 9], [8, 9], [9, 9]].forEach(function (q) { put(q, TRIM); });                // collar
      [[6, 10], [7, 10], [8, 10], [9, 10], [9, 11], [8, 12], [8, 13], [7, 13]].forEach(function (q) { put(q, TRIM); });   // the 7
    } else {
      [[5, 9], [6, 9], [9, 9], [10, 9], [6, 10], [9, 10]].forEach(function (q) { put(q, TRIM); });   // V-neck collar
      put([7, 9], INK); put([8, 9], INK); put([7, 10], INK); put([8, 10], INK);                       // the neck inside the V
      put([5, 11], CREST); put([10, 11], TRIM);                                                        // crest and maker's mark
    }
    c = sleeves(c, [2, 13]);
    var lo = opt.legs === 'wide' ? 5 : 4, hi = opt.legs === 'wide' ? 10 : 11;
    for (var x2 = lo; x2 <= hi; x2++) put([x2, 14], SHORTS);
    return kitLegs(c);
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 6 && p.x <= 10); });
    for (var y = 9; y <= 13; y++) for (var x = 6; x <= 10; x++) c.push({ x: x, y: y, col: x === 6 ? SHIRT_D : SHIRT });
    c.push({ x: 9, y: 9, col: TRIM }); c.push({ x: 10, y: 9, col: TRIM });                       // collar, at the front
    c = sleeves(c, [11, 5]);
    for (var x2 = 6; x2 <= 10; x2++) c.push({ x: x2, y: 14, col: SHORTS });
    return kitLegs(c);
  }
  function paint(cells, flip) {
    sctx.clearRect(0, 0, sprite.width, sprite.height);
    cells.forEach(function (c) {
      var x = flip ? 15 - c.x : c.x;
      sctx.fillStyle = c.col; sctx.fillRect((x + 1) * S, (c.y + 1) * S, S, S);
    });
  }

  /* ---------------------------------------------------------------- props */
  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  var BALL = ['.kkk.', 'kwkwk', 'kkwkk', 'kwkwk', '.kkk.'], BS = 4, BR = 2.5 * BS;                  // the home-page ball
  function ball(x, y) {
    for (var r = 0; r < 5; r++) for (var q = 0; q < 5; q++) {
      var ch = BALL[r][q]; if (ch === '.') continue;
      px(x - BR + q * BS, y - BR + r * BS, BS, BS, ch === 'k' ? INK : '#FFFFFF');
    }
  }
  function goal(cx, k, shake) {                                                                     // facing the robot (left side open)
    if (k <= 0) return;
    var h = 13 * S * k, top = ground - h, w = 9 * S, x = cx;
    ctx.strokeStyle = NET; ctx.lineWidth = 1;
    for (var i = 1; i < 6; i++) { var off = shake ? Math.sin(i * 1.7 + shake * 20) * 2 : 0;
      ctx.beginPath(); ctx.moveTo(x + i * w / 6 + off, top); ctx.lineTo(x + i * w / 6 - off, ground); ctx.stroke(); }
    for (var j = 1; j < 8; j++) { var yy = top + j * h / 8; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w + (shake ? Math.sin(j + shake * 30) * 2 : 0), yy); ctx.stroke(); }
    px(x - S * .2, top, S, h, POST); px(x - S * .2, top, w, S, POST); px(x + w - S, top, S, h, '#D8D5CB');
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x - S * .2) + .5, Math.round(top) + .5, Math.round(S) - 1, Math.round(h) - 1);
  }
  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, cells: null, lift: 0, tilt: 0, front: null };
  var dust = [], carry = null;                                                                      // carry: draws the ball each frame
  function show(cells, fr) { bot.cells = cells; bot.front = fr || null; }
  function front(pose, fr, opt) { show(frontCells(pose, opt), fr); }
  function side(o, fr) { show(sideCells(o), fr); }
  function drawRobot() {
    paint(bot.cells || frontCells({}), bot.face < 0);
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
  function run(t, speed) { var k = Math.floor(t * (speed || 5)) % 2; return { leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' }; }
  function atFeet(t) { var p = (t * 5) % 1; return { x: bot.x + bot.face * (5 + 2 * p) * S, y: ground - BR }; }

  /* ---------------------------------------------------------------- routines */
  function walkTo(target, speed, dribble) {
    speed = speed || 95;
    return { dur: 1, start: function () { this.dur = Math.abs(target - bot.x) / speed + .05; }, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      side(run(t)); bot.lift = 0; bot.tilt = 0;
      carry = dribble ? function () { var b = atFeet(t); ball(b.x, b.y); } : null;
    } };
  }
  function idle(sec, withBall) {
    return { dur: sec, run: function (t) {
      carry = withBall ? function () { ball(bot.x + bot.face * 5 * S, ground - BR); } : null;
      front({ blink: (t % 2.4) < .12, look: { x: bot.face, y: 0 } }); bot.lift = 0; bot.tilt = 0;
    } };
  }

  // keepy-ups with real gravity (as on the home page): the robot runs under the ball; after eight touches it catches it
  function keepyRoutine() {
    var b, x0, touches, touch, caught;
    return { dur: 30, start: function () {
      x0 = bot.x; touches = 0; touch = null; caught = null;
      b = { x: bot.x + 5 * S, y: ground - BR, vx: -1.5 * S, vy: -Math.sqrt(2 * G * 9 * S), next: 'foot', foot: false };
    }, run: function (t, dt) {
      bot.tilt = 0; bot.lift = 0;
      var ys = { foot: ground - 2.4 * S, knee: ground - 5.6 * S, head: ground - 15.4 * S, catch: ground - 8.6 * S };
      if (caught !== null) {                                                       // holding the ball
        front({ armL: 'reach', armR: 'reach', look: { x: 0, y: 1 } });
        carry = function () { ball(bot.x, ground - 8.2 * S); };
        if (t - caught > .9) this.dur = t;
        return;
      }
      b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      var ty = ys[b.next];
      // where will it come down? the robot goes there
      var tFall = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * G * (ty - b.y)))) / G;
      var land = b.x + b.vx * tFall, off = b.next === 'foot' ? (b.foot ? 1 : -1) * 2.5 * S : b.next === 'knee' ? 1.5 * S : 0;
      var d = land - off - bot.x, step = Math.min(Math.abs(d), 240 * dt);
      bot.x += Math.sign(d) * step;
      var pose = { look: { x: 0, y: b.y < ground - 20 * S ? -1 : b.y > ground - 9 * S ? 1 : 0 }, step: step > 20 * dt ? Math.floor(t * 8) % 2 : 0 };
      if (b.vy > 0 && b.y >= ty) {                                                 // the touch
        b.y = ty;
        if (b.next === 'catch') { caught = t; return; }
        touches++;
        touch = { kind: b.next, t: t };
        if (b.next === 'foot') { b.foot = !b.foot; puff(b.x, 1, DUST); }
        var r = Math.random(), hgt = (8 + Math.random() * 8) * S;
        b.next = touches >= 8 ? 'catch' : r < .5 ? 'foot' : r < .75 ? 'knee' : 'head';
        if (b.next === 'head' || touch.kind === 'head') hgt += 3 * S;
        var rise = Math.max(0, ty - ys[b.next]), up = Math.sqrt(2 * G * (hgt + rise)), air = (up + Math.sqrt(up * up - 2 * G * rise)) / G;
        var target = x0 + (Math.random() - .5) * 24 * S;
        b.vy = -up; b.vx = Math.max(-96, Math.min(96, (target - b.x) / air));
      }
      if (touch && t - touch.t < .14) {
        if (touch.kind === 'foot') pose.step = 1;
        if (touch.kind === 'knee') { pose.step = 1; pose.armL = 'up'; }
        if (touch.kind === 'head') { pose.armL = 'reach'; pose.armR = 'reach'; bot.lift = S * .8; }
      }
      if (b.next === 'catch' && b.vy > 0 && b.y > ground - 16 * S) { pose.armL = 'reach'; pose.armR = 'reach'; }
      bot.face = b.x >= bot.x ? 1 : -1;
      front(pose);
      var bx = b.x, by = b.y;
      carry = function () { ball(bx, by); };
    } };
  }

  // the celebration after a goal: a run, a jump with a half turn, the landing with legs apart and arms down
  function siuu(f, dt, away) {                                                     // f: seconds since it started
    var RUN = .9, UP = .62;
    if (f < RUN) { bot.face = away; bot.x += away * 150 * dt; side(run(f, 7)); bot.lift = 0; return; }
    var j = f - RUN;
    if (j < UP) {                                                                  // in the air, turning: side, back, side, front
      var q = j / UP; bot.lift = Math.sin(q * Math.PI) * 9 * S;
      if (q < .22) { bot.face = away; side({ leg: 1, arm: 'up0' }); }
      else if (q < .5) show(frontCells({ armL: 'up', armR: 'up' }, { back: true }));
      else if (q < .72) { bot.face = -away; side({ leg: 1, arm: 'up1' }); }
      else front({ armL: 'reachDown', armR: 'reachDown' }, null, { legs: 'wide' });
      return;
    }
    var l = j - UP;
    if (l < .03) puff(bot.x, 6, DUST);
    bot.lift = 0;
    front({ armL: 'reachDown', armR: 'reachDown' }, null, { legs: 'wide' });
  }

  // the shot: a goal rises, a dribble towards it, a kick, the net shakes, and the celebration
  function shotRoutine() {
    var gx, kickT, goalAt;
    return { dur: 1, start: function () {
      gx = Math.min(W - 16 * S, bot.x + 32 * S);
      kickT = .7 + Math.max(.6, (gx - 11 * S - bot.x) / 110); goalAt = kickT + .45; this.dur = goalAt + 4.4;
    }, run: function (t, dt) {
      var k = t < .6 ? t / .6 : t > this.dur - .5 ? Math.max(0, (this.dur - t) / .5) : 1, shake = 0;
      bot.tilt = 0;
      if (t < .7) { bot.face = 1; carry = function () { ball(bot.x + 5 * S, ground - BR); }; front({ look: { x: 1, y: 0 } }); }
      else if (t < kickT) {                                                         // dribbling
        bot.face = 1; bot.x = Math.min(gx - 11 * S, bot.x + 110 * dt);
        side(run(t)); carry = function () { var b = atFeet(t); ball(b.x, b.y); };
      } else if (t < goalAt + .5) {                                                 // the kick and the ball in the net
        var f = t - kickT, fl = Math.min(1, f / .45);
        side({ leg: f < .25 ? 1 : 2, arm: 'swing0' });
        var sx = bot.x + 5 * S, bx = sx + (gx + 5 * S - sx) * fl, by = ground - BR - Math.sin(fl * Math.PI) * 4 * S - fl * 4 * S;
        if (f > .45) { bx = gx + 6 * S; by = Math.min(ground - BR, ground - 5 * S + (f - .45) * 60); }
        carry = function () { ball(bx, by); };
        if (f > .45 && f - dt <= .45) puff(gx + 5 * S, 3, DUST);
      } else {                                                                      // the celebration
        carry = function () { ball(gx + 6 * S, ground - BR); };
        siuu(t - goalAt - .5, dt, -1);
      }
      if (t > goalAt) shake = Math.max(0, 1.2 - (t - goalAt));
      var fr = bot.front;
      bot.front = function () { goal(gx, k, shake); if (fr) fr(); };
    } };
  }

  // the header: a cross from the left, a jump, the ball into the goal, a knee slide
  function headerRoutine() {
    var gx, hx, T0 = 1.2, CROSS = 1.25, hitAt, inAt;
    return { dur: 1, start: function () {
      gx = Math.min(W - 16 * S, bot.x + 22 * S); hx = gx - 9 * S; hitAt = T0 + CROSS; inAt = hitAt + .32; this.dur = inAt + 3.6;
      carry = null;
    }, run: function (t, dt) {
      var k = t < .6 ? t / .6 : t > this.dur - .5 ? Math.max(0, (this.dur - t) / .5) : 1, shake = 0;
      bot.tilt = 0; bot.lift = 0;
      var hy = ground - 19 * S;                                                     // ball height at the header, robot in the air
      if (t < T0) {                                                                 // walking into position
        var d = hx - bot.x; bot.x += Math.sign(d) * Math.min(Math.abs(d), 120 * dt);
        if (Math.abs(d) > 2) { bot.face = d < 0 ? -1 : 1; side(run(t)); } else { bot.face = -1; front({ look: { x: -1, y: -1 } }); }
        carry = null;
      } else if (t < hitAt) {                                                       // the cross comes in from the left edge
        var q = (t - T0) / CROSS, sx = -2 * S, sy = ground - 12 * S;
        var bx = sx + (bot.x - S - sx) * q, by = sy + (hy - sy) * q - Math.sin(q * Math.PI) * 14 * S;
        carry = function () { ball(bx, by); };
        bot.face = -1;
        var jump = Math.max(0, (q - .72) / .28);
        bot.lift = Math.sin(jump * Math.PI / 2) * 3.5 * S;
        if (jump > 0) side({ leg: 1, arm: 'up0' }); else front({ look: { x: -1, y: -1 } });
      } else if (t < inAt + .4) {                                                   // the header, to the goal
        var g = Math.min(1, (t - hitAt) / (inAt - hitAt)), ex = gx + 5 * S, ey = ground - 7 * S;
        var bx2 = bot.x + (ex - bot.x) * g, by2 = hy + (ey - hy) * g;
        if (t > inAt) by2 = Math.min(ground - BR, ey + (t - inAt) * 70);
        carry = function () { ball(bx2, by2); };
        bot.face = 1; bot.lift = Math.max(0, 3.5 * S * (1 - (t - hitAt) / .35));
        side({ leg: 1, arm: 'up0' });
        if (t > inAt && t - dt <= inAt) puff(ex, 3, DUST);
      } else {                                                                      // the knee slide, away from the goal
        var f = t - inAt - .4;
        carry = function () { ball(gx + 6 * S, ground - BR); };
        if (f < .5) { bot.face = -1; bot.x -= 160 * dt; side(run(f, 7)); }
        else if (f < 1.5) {
          var v = 220 * (1 - (f - .5)); bot.face = -1; bot.x -= Math.max(0, v) * dt;
          bot.tilt = -.08; bot.lift = -S * 2.4;
          side({ leg: 1, arm: Math.floor(f * 6) % 2 ? 'up0' : 'up1' });
          if (Math.random() < .5 && v > 30) puff(bot.x + 2 * S, 1, DUST);
        } else { bot.face = 1; front({ armL: 'up', armR: 'up', look: { x: 0, y: -1 }, step: Math.floor(f * 4) % 2 }); }
      }
      if (t > inAt) shake = Math.max(0, 1.2 - (t - inAt));
      var fr = bot.front;
      bot.front = function () { goal(gx, k, shake); if (fr) fr(); };
    } };
  }

  // the rainbow flick: dribbling, the ball goes up the back of the leg, over the head, and lands ahead
  function flickRoutine() {
    var FL = 1.2, F0 = 1.1;
    return { dur: F0 + FL + 2.0, start: function () { bot.face = W - bot.x > W * .4 ? 1 : -1; }, run: function (t, dt) {
      bot.tilt = 0; bot.lift = 0;
      var fc = bot.face;
      bot.x += fc * 85 * dt;
      if (t < F0) { side(run(t)); carry = function () { var b = atFeet(t); ball(b.x, b.y); }; return; }
      var q = (t - F0) / FL;
      if (q < 1) {
        // up the heel, then a curve over the head to nine cells ahead of the robot
        var p0 = { x: bot.x - fc * 2 * S, y: ground - 4 * S }, p1 = { x: bot.x + fc * S, y: ground - 36 * S }, p2 = { x: bot.x + fc * 9 * S, y: ground - BR };
        var bx = (1 - q) * (1 - q) * p0.x + 2 * (1 - q) * q * p1.x + q * q * p2.x, by = (1 - q) * (1 - q) * p0.y + 2 * (1 - q) * q * p1.y + q * q * p2.y;
        if (q < .2) { var l = q / .2; bx = bot.x + fc * (3 - 5 * l) * S; by = ground - BR - l * 2 * S; }
        side(q < .25 ? { leg: 1, arm: 'swing1' } : run(t));
        carry = function () { ball(bx, by); };
        return;
      }
      var f = t - F0 - FL;
      if (f < .9) { side(run(t)); carry = function () { var b = atFeet(t); ball(b.x, b.y); }; }
      else { bot.x -= fc * 85 * dt; carry = function () { ball(bot.x + fc * 5 * S, ground - BR); };
             front({ armL: 'up', armR: 'wave', look: { x: fc, y: 0 }, step: Math.floor(f * 4) % 2 }); }
    } };
  }

  var ROUTINES = [keepyRoutine, shotRoutine, headerRoutine, flickRoutine];
  var only = /[?&]costume=(\w+)/.exec(location.search);                             // for screenshots: one routine only
  if (only) { var pick = { keepy: keepyRoutine, shot: shotRoutine, header: headerRoutine, flick: flickRoutine }[only[1]]; if (pick) ROUTINES = [pick]; }
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.15 + Math.random() * .4), withBall = make !== headerRoutine;
      spot = Math.max(W * .12, Math.min(W * .55, spot));
      queue.push(walkTo(spot, 95, withBall), idle(.4 + Math.random() * .4, withBall), r, idle(.6));
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
