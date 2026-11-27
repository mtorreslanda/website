/* Searchable case law: the same pixel robot as on every project page, now working in court. It alternates
   between two outfits (decision of MA, 27-nov): a JUDGE in a black gown with white bands, and a LAWYER in a dark
   suit with a violet tie and a briefcase. It changes off-screen: it walks out one side and comes back dressed.
   Routines on the dividing line at the bottom of the first screen (SH38):
     judge  · the gavel: a bench rises from the line and the robot strikes three times;
     lawyer · at the desk: a desk and a chair, reading glasses on, files taken from a pile that goes down.
   (The seal and the objection routines were dropped by MA, 27-nov.)
   Front view from robot.js, side view from robot-side.js; outfits and props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="court"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#5B45B0', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', GOWN = '#22202B', GOWN_L = '#34313F', WHITE = '#F5F3EE', SUIT = '#3A4150',
      SUIT_L = '#4C5466', TIE = '#5B45B0', RIM = '#BFC4D1', SEAL = '#5B45B0', WOOD = '#7A4E2D', WOOD_L = '#9C6A3E',
      WOOD_D = '#5A3920', PAGE = '#FFFDF7', LEATHER = '#6B4226', FOLDERS = ['#C9A86A', '#B88A4A', '#D8C08A', '#A9864F'];
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- outfits, both views */
  function outfitFront(c, who) {
    if (who === 'judge') {
      for (var y = 9; y <= 15; y++) { var w = y < 12 ? 0 : y < 14 ? 1 : 1;
        for (var x = 3 - w + (y < 12 ? 0 : 0); x <= 12 + w; x++) if (!(y >= 14 && (x < 3 || x > 12))) c.push({ x: x, y: y, col: (x === 7 || x === 8) && y > 10 ? GOWN_L : GOWN }); }
      c.push({ x: 7, y: 9, col: WHITE }, { x: 8, y: 9, col: WHITE }, { x: 7, y: 10, col: WHITE }, { x: 8, y: 10, col: WHITE });
    } else {
      for (var yy = 9; yy <= 13; yy++) for (var xx = 3; xx <= 12; xx++) c.push({ x: xx, y: yy, col: (xx === 6 || xx === 9) && yy < 12 ? SUIT_L : SUIT });
      c.push({ x: 7, y: 9, col: WHITE }, { x: 8, y: 9, col: WHITE }, { x: 7, y: 10, col: TIE }, { x: 8, y: 10, col: TIE },
             { x: 7, y: 11, col: TIE }, { x: 8, y: 11, col: TIE }, { x: 7, y: 12, col: TIE });
    }
  }
  function glassesFront(c) {
    [[4, 4], [5, 4], [6, 4], [9, 4], [10, 4], [11, 4], [4, 5], [6, 5], [9, 5], [11, 5], [7, 5], [8, 5], [4, 6], [6, 6], [9, 6], [11, 6]]
      .forEach(function (p) { c.push({ x: p[0], y: p[1], col: RIM }); });
  }
  function frontCells(pose) {
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 3 && p.x <= 12); });  // the outfit covers the body
    outfitFront(c, who);
    if (pose.glasses) glassesFront(c);
    return c;
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 6 && p.x <= 10); });
    if (who === 'judge') {
      for (var y = 9; y <= 15; y++) { var back = y < 12 ? 6 : 5, swing = (o.leg === 0 && y >= 14) ? 1 : 0;
        for (var x = back - swing; x <= 10 + (y >= 14 ? 1 : 0); x++) c.push({ x: x, y: y, col: GOWN }); }
      c.push({ x: 10, y: 9, col: WHITE }, { x: 10, y: 10, col: WHITE });
    } else {
      for (var yy = 9; yy <= 13; yy++) for (var xx = 6; xx <= 10; xx++) c.push({ x: xx, y: yy, col: SUIT });
      c.push({ x: 10, y: 9, col: WHITE }, { x: 10, y: 10, col: TIE }, { x: 10, y: 11, col: TIE });
    }
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
  // the bench (estrado), rising k: 0..1; shake in px
  function bench(cx, k, shake) {
    var w = 30 * S, h = 8 * S * k, top = ground - h, x = cx - w / 2 + (shake || 0);
    px(x, top, w, h, WOOD); px(x - S, top - S * k, w + 2 * S, S * k, WOOD_D);                     // body and top board
    for (var i = 1; i < 4; i++) px(x + i * w / 4 - S / 2, top + S * 1.5, S * .6, Math.max(0, h - S * 2.5), WOOD_L);  // panels
    if (k > .6) {                                                                                 // the emblem: a seal on the front
      ctx.strokeStyle = SEAL; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + (shake || 0), top + h * .5, S * 1.6, 0, Math.PI * 2); ctx.stroke();
      px(cx - S * .4 + (shake || 0), top + h * .5 - S * .4, S * .8, S * .8, SEAL);
    }
    return top - S * k;                                                                           // y of the bench top
  }
  function block(x, y) { px(x - 2 * S, y - S, 4 * S, S, WOOD_D); px(x - 1.5 * S, y - 1.6 * S, 3 * S, .7 * S, WOOD_L); }  // the sound block
  function gavel(hx, hy, ang) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(bot.face, 1); ctx.rotate(ang);
    px(-S * .4, -S * .4, S * 4.2, S * .8, WOOD_L);                                                // handle
    px(S * 3.6, -S * 1.4, S * 1.8, S * 2.8, WOOD_D); px(S * 3.6, -S * .3, S * 1.8, S * .5, WOOD_L); // head with a band
    ctx.restore();
  }
  function impact(x, y, k) {                                                                      // three short lines and a flash
    ctx.strokeStyle = 'rgba(26,26,26,' + (.7 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 2;
    [[-1, -.5], [0, -1], [1, -.5]].forEach(function (d) {
      ctx.beginPath(); ctx.moveTo(x + d[0] * S * (2 + 2 * k), y + d[1] * S * (2 + 2 * k));
      ctx.lineTo(x + d[0] * S * (3.5 + 2 * k), y + d[1] * S * (3.5 + 2 * k)); ctx.stroke(); });
  }
  function desk(cx, k, pile, open) {
    var w = 26 * S, h = 7 * S * k, top = ground - h, x = cx - w / 2;
    px(x, top, w, S * k, WOOD_D); px(x + S, top + S * k, S * 1.2, h - S * k, WOOD); px(x + w - 2.2 * S, top + S * k, S * 1.2, h - S * k, WOOD);
    px(x + w * .62, top + S * k, w * .34, h * .55, WOOD_L);                                       // a drawer unit
    if (k < 1) return top;
    for (var i = 0; i < pile; i++) px(x + w * .72, top - (i + 1) * S * .7, 5 * S, S * .6, FOLDERS[i % FOLDERS.length]);  // the pile
    if (open) {                                                                                    // the open file in front of the robot
      var fx = cx - 4.5 * S + bot.face * 1.5 * S, fy = top - S * .6;
      px(fx, fy, 9 * S, S * .6, FOLDERS[1]); px(fx + S * .4, fy - S * .3, 3.9 * S, S * .4, PAGE); px(fx + 4.7 * S, fy - S * .3 - (open > 1 ? S * .5 : 0), 3.9 * S, S * .4, PAGE);
    }
    return top;
  }
  function chair(cx) {                                                                            // a backrest behind the robot
    px(cx - 5 * S, ground - 12 * S, 10 * S, 6 * S, LEATHER); px(cx - 5.5 * S, ground - 12.5 * S, 11 * S, S, '#4E3019');
    px(cx - 4.5 * S, ground - 6 * S, S, 6 * S, '#4E3019'); px(cx + 3.5 * S, ground - 6 * S, S, 6 * S, '#4E3019');
  }
  function briefcase(x, y) {                                                                      // x,y = bottom centre
    px(x - 2.6 * S, y - 3.4 * S, 5.2 * S, 3.4 * S, LEATHER); px(x - 2.6 * S, y - 2.2 * S, 5.2 * S, S * .4, '#4E3019');
    px(x - S, y - 4.2 * S, 2 * S, S * .5, '#4E3019'); px(x - S, y - 4.2 * S, S * .5, S, '#4E3019'); px(x + S * .5, y - 4.2 * S, S * .5, S, '#4E3019');
    px(x - S * .3, y - 2.3 * S, S * .6, S * .6, '#C9A23A');                                       // the clasp
  }
  /* ---------------------------------------------------------------- the robot on the line */
  var who = 'judge';
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, lift: 0, tilt: 0, t: 0, back: null, front: null, carry: false };
  var dust = [];
  function drawRobot() {
    if (bot.back) bot.back();                                                                     // props behind (chair)
    paint(bot.view === 'side' ? sideCells(bot.side) : frontCells(bot.pose), bot.face < 0);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(bot.x, ground - bot.lift); if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S); ctx.restore();
    if (bot.front) bot.front();                                                                   // props in front (bench, desk, gavel)
    if (bot.carry && who === 'lawyer') { var h = cellAt(bot.view === 'side' ? 12 : 13, 12); briefcase(h.x, h.y + 4 * S); }
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
    // the duration is measured when the walk starts, not when it is queued (the robot may be off-screen by then)
    return { dur: 1, start: function () { this.dur = Math.abs(target - bot.x) / speed + .05; bot.carry = true; }, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      var k = Math.floor(t * 5) % 2;
      side({ leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' }); bot.lift = 0; bot.tilt = 0;
    } };
  }
  function dress(next) { return { dur: .01, run: function () { who = next; } }; }
  function idle(sec) {
    return { dur: sec, run: function (t) { front({ blink: (t % 2.4) < .12, look: { x: bot.face, y: 0 } }); bot.lift = 0; bot.tilt = 0; } };
  }
  // judge · the gavel
  function gavelRoutine() {
    var bx, hits;
    return { dur: 4.6, who: 'judge', start: function () { bot.face = 1; bx = bot.x; hits = 0; bot.carry = false; }, run: function (t) {
      bot.tilt = 0; bot.lift = 0;
      var k = t < .5 ? t / .5 : t > 4.1 ? Math.max(0, (4.6 - t) / .5) : 1, top = ground - 9 * S * k;
      var blockX = bx + 9 * S, phase = (t - .8) / .55, n = Math.floor(phase), f = phase - n;
      var striking = t > .8 && n < 3 && f > .55, shake = striking && f < .75 ? (n % 2 ? 2 : -2) : 0;
      if (striking && n >= hits) { hits = n + 1; puff(blockX, 2, WOOD_D); }
      front({ armR: t > .6 && t < 2.6 ? (striking ? 'reach' : 'up') : 'down', look: { x: 1, y: striking ? 1 : 0 } }, null, function () {
        var top2 = bench(bx, k, shake);
        if (k > .95) block(blockX + shake, top2);
        if (t > .6 && t < 2.6) {
          var hd = R.hand(BOT, striking ? 'reach' : 'up'), p = cellAt(hd.x, hd.y);
          gavel(p.x, p.y, striking ? .25 : -1.1);
          if (striking) impact(blockX + 2 * S, top2 - S, (f - .55) / .45);
        }
      });
    } };
  }
  // lawyer · at the desk
  function deskRoutine() {
    var dx, pile;
    return { dur: 7.4, who: 'lawyer', start: function () { bot.face = 1; dx = bot.x; pile = 5; bot.carry = false; }, run: function (t) {
      bot.tilt = 0;
      var k = t < .5 ? t / .5 : t > 6.9 ? Math.max(0, (7.4 - t) / .5) : 1;
      var seated = t > .7 && t < 6.7, reading = t > 1.2 && t < 6.4;
      var cycle = reading ? (t - 1.2) % 1.7 : 0, take = reading && cycle < .35;
      if (reading && cycle < .02) pile = Math.max(1, 5 - Math.floor((t - 1.2) / 1.7) - 1);
      bot.lift = seated ? -2 * S : 0;
      front({ glasses: reading, armR: take ? 'reachUp' : seated ? 'reach' : 'down', armL: seated ? 'reach' : 'down',
              look: { x: take ? 1 : 0, y: reading && !take ? 1 : 0 }, blink: (t % 2.1) < .1 },
            function () { if (k > .3) chair(dx); },
            function () { desk(dx, k, pile, reading ? (cycle > 1.2 ? 2 : 1) : 0); });
    } };
  }
  var ROUTINES = [gavelRoutine, deskRoutine];
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.2 + Math.random() * .5);
      spot = Math.max(W * .14, Math.min(W * .8, spot));
      if (r.who !== who) {                                                                         // change outfit off-screen
        var edge = bot.x < W / 2 ? -12 * S : W + 12 * S;
        queue.push(walkTo(edge, 150), dress(r.who), walkTo(spot, 120));
      } else queue.push(walkTo(spot));
      queue.push(idle(.5 + Math.random() * .5), r, idle(.7));
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
    bot.x = Math.max(-14 * S, Math.min(W + 14 * S, bot.x));     // it may leave the screen only to change outfit
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
