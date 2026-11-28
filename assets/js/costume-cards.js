/* Pokémon TCG agent: the same pixel robot as on every project page, now a card player with a gold sash.
   No game artwork: the cards are plain backs and a blank face with a question mark (the hidden information).
   Routines on the dividing line at the bottom of the first screen (SH38):
     shuffle · the robot riffles a deck from hand to hand, draws the top card and turns it over: a question mark;
     coin    · it flips a coin, which spins up and lands in its hand: heads or tails pops above.
   Front view from robot.js, side view from robot-side.js; the sash and the props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="cards"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#A07800', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', SASH = '#FFD447', BACK = '#3B5BA9', BACK_L = '#5C7BC6', EDGE = '#FFD447',
      FACE = '#FFFDF7', COIN = '#E0B000', COIN_L = '#FFE37A';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18;
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the sash, both views */
  function frontCells(pose) {
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; });
    [[4, 9], [5, 10], [6, 11], [7, 11], [8, 12], [9, 12], [10, 13], [11, 13]].forEach(function (p) { c.push({ x: p[0], y: p[1], col: SASH }); });
    return c;
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; });
    [[7, 9], [8, 10], [8, 11], [9, 12]].forEach(function (p) { c.push({ x: p[0], y: p[1], col: SASH }); });
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
  // one card centred at x,y; flip: 1 back .. -1 face (scaleX goes through 0); ang in radians
  function card(x, y, flip, ang) {
    var w = 3.2 * S, h = 4.4 * S;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0); ctx.scale(Math.max(.06, Math.abs(flip)), 1);
    if (flip >= 0) {
      ctx.fillStyle = EDGE; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = BACK; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
      ctx.fillStyle = BACK_L; ctx.beginPath(); ctx.arc(0, 0, w * .22, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = EDGE; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = FACE; ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
      ctx.fillStyle = INK; ctx.font = '700 ' + Math.round(S * 2.4) + 'px "Playfair Display", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, S * .2);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + .5, -h / 2 + .5, w - 1, h - 1);
    ctx.restore();
  }
  function deck(x, y, n) { for (var i = 0; i < n; i++) card(x - i * .6, y - i * 1.2, 1, 0); }
  function coin(x, y, spin) {
    var sx = Math.cos(spin * Math.PI * 2);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(.12, Math.abs(sx)), 1);
    ctx.fillStyle = sx > 0 ? COIN : COIN_L; ctx.beginPath(); ctx.arc(0, 0, S * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  }
  function pop(x, y, text, k) {
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(x, y - k * 2 * S);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    var w = S * (text.length * 1.05 + 1.6), h = S * 2.4;
    ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2 + .5, -h / 2 + .5, w - 1, h - 1);
    ctx.fillStyle = INK; ctx.font = '500 ' + Math.round(S * 1.5) + 'px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1); ctx.restore();
  }

  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, view: 'front', pose: {}, side: {}, lift: 0, tilt: 0, t: 0, front: null };
  function drawRobot() {
    paint(bot.view === 'side' ? sideCells(bot.side) : frontCells(bot.pose), bot.face < 0);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.translate(bot.x, ground - bot.lift); if (bot.tilt) ctx.rotate(bot.tilt * bot.face);
    ctx.drawImage(sprite, -8.5 * S, -18 * S); ctx.restore();
    if (bot.front) bot.front();
  }
  function front(pose, fr) { bot.view = 'front'; bot.pose = pose; bot.front = fr || null; }
  function side(o) { bot.view = 'side'; bot.side = o; bot.front = null; }

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
  // riffle, draw, turn over
  function shuffleRoutine() {
    return { dur: 6.2, start: function () { bot.face = 1; }, run: function (t) {
      bot.lift = 0; bot.tilt = 0;
      var hd = R.hand(BOT, 'reach'), pr = cellAt(hd.x, hd.y), pl = cellAt(15 - hd.x, hd.y);
      var riffle = t > .4 && t < 3.0, drawing = t >= 3.0 && t < 3.8, shown = t >= 3.8 && t < 5.8;
      front({ armL: t < 3.0 ? 'reach' : 'down', armR: drawing || shown ? 'reachUp' : 'reach', look: { x: 0, y: riffle ? 1 : shown ? -1 : 0 },
              blink: (t % 2.5) < .1 }, function () {
        if (t < 3.0) {
          deck(pl.x, pl.y - S, riffle ? 5 - Math.floor(((t - .4) * 6) % 5) : 5);
          deck(pr.x, pr.y - S, riffle ? 1 + Math.floor(((t - .4) * 6) % 5) : 1);
          if (riffle) for (var i = 0; i < 2; i++) {                                   // cards in flight, left hand to right
            var f = ((t - .4) * 3 + i * .5) % 1;
            card(pl.x + (pr.x - pl.x) * f, pl.y - S - Math.sin(f * Math.PI) * 6 * S, 1, (f - .5) * 1.2);
          }
        } else {
          var up = cellAt(hd.x, 6), f2 = drawing ? (t - 3.0) / .8 : 1;
          var turn = shown ? Math.cos(Math.min(1, (t - 3.8) / .5) * Math.PI) : 1;    // 1 back .. -1 face
          card(pr.x + (up.x - pr.x) * f2, pr.y + (up.y - 2 * S - pr.y) * f2, turn, 0);
          if (t > 4.4 && shown) pop(up.x, up.y - 7 * S, 'hidden card', (t - 4.4) / 1.4);
        }
      });
    } };
  }
  // the coin flip
  function coinRoutine() {
    var res;
    return { dur: 4.6, start: function () { bot.face = 1; res = Math.random() < .5 ? 'HEADS' : 'TAILS'; }, run: function (t) {
      bot.lift = 0; bot.tilt = 0;
      var hd = R.hand(BOT, 'reach'), p = cellAt(hd.x, hd.y);
      var fly = t > .6 && t < 2.2, f = (t - .6) / 1.6;
      front({ armR: t > .3 && t < 3.6 ? 'reach' : 'down', look: { x: 0, y: fly && f < .5 ? -1 : 0 }, blink: (t % 2.3) < .1 }, function () {
        if (t < .3 || t > 3.6) return;
        var y = fly ? p.y - S - Math.sin(f * Math.PI) * 15 * S : p.y - S;
        coin(p.x, y, fly ? f * 5 : 0);
        if (t > 2.3) pop(p.x, p.y - 5 * S, res, (t - 2.3) / 1.3);
      });
    } };
  }
  var ROUTINES = [shuffleRoutine, coinRoutine];
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.15 + Math.random() * .55);
      spot = Math.max(W * .12, Math.min(W * .78, spot));
      queue.push(walkTo(spot), idle(.4 + Math.random() * .5), r, idle(.6));
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
    drawRobot();
    if (!reduce) requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener('resize', resize);
  if (reduce) { idle(1).run(0); drawRobot(); } else requestAnimationFrame(frame);
})();
