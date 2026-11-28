/* Pokémon TCG agent: the same pixel robot as on every project page, now a trainer: a red cap with a white front,
   a blue jacket, red trainers (SH63). No game artwork: the capture ball and the three creatures are our own
   (Embit, a fire kit; Driblet, a water drop; Pixmo, a glitchy ghost), cameos, not copies.
   Routines on the dividing line at the bottom of the first screen (SH38):
     encounter · the tall grass rustles, a creature hops out, the robot throws the ball, three wobbles, caught (stars);
     partner   · the robot sends a creature out, they walk together, and it is called back.
   Kept simple on purpose: no text and no attacks (SH63).
   Front view from robot.js, side view from robot-side.js; the cap, the jacket and the props are drawn on top. */
(function () {
  'use strict';
  var R = window.Robot, RS = window.RobotSide;
  var cv = document.querySelector('canvas[data-costume="cards"]');
  if (!R || !RS || !cv) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BOT = { seed: 0, accent: '#E3350D', antenna: 'none', head: 'rounded', eyes: 'dots', mouth: 'smile', bolts: false,
              body: 'barrel', chest: 'panel', arms: 'short', legs: 'legs' };
  var INK = '#1A1A1A', EYE = '#F5F3EE', CAP = '#E3350D', CAP_D = '#A3240A', WHITE = '#FFFFFF', JACKET = '#2A75BB', JACKET_D = '#1D5690',
      GOLD = '#FFCB05', PANTS = '#2B2F3A', SHOE = '#E3350D', GRASS = '#3C8D5A', GRASS_L = '#5DA66E';
  var SIDE_COL = { x: INK, a: BOT.accent, e: EYE, k: INK, s: INK, d: INK, h: INK, b: INK, l: EYE };
  var S = 6, GRID = 18, P = 4;                                         // P: px per pixel of the props and creatures
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, ground = 0;
  var sprite = document.createElement('canvas'), sctx = sprite.getContext('2d');
  sprite.width = sprite.height = GRID * S;

  /* ---------------------------------------------------------------- the trainer's kit */
  function put(c, x, y, col) { c.push({ x: x, y: y, col: col }); }
  function legs(c) {
    c.forEach(function (p) { if (p.y === 14 || p.y === 15) p.col = PANTS; else if (p.y === 16) p.col = SHOE; });
    return c;
  }
  function frontCells(pose) {
    var c = R.cells(BOT, pose).map(function (p) { return { x: p.x, y: p.y, col: R.color(p.c, BOT, { ink: INK, eye: EYE }) }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 3 && p.x <= 12) && !(p.y === 3); });
    for (var x = 5; x <= 10; x++) put(c, x, 1, CAP);                                    // the cap
    for (x = 4; x <= 11; x++) put(c, x, 2, x === 7 || x === 8 ? WHITE : CAP);
    for (x = 3; x <= 12; x++) put(c, x, 3, CAP_D);                                      // the brim, over the forehead
    put(c, 6, 2, WHITE); put(c, 9, 2, WHITE); put(c, 7, 1, WHITE); put(c, 8, 1, WHITE);  // the white front panel
    var rows = { 9: [4, 11], 10: [3, 12], 11: [3, 12], 12: [3, 12], 13: [4, 11] };       // the jacket, open over a white tee
    for (var y = 9; y <= 13; y++) for (x = rows[y][0]; x <= rows[y][1]; x++)
      put(c, x, y, x >= 6 && x <= 9 ? (y === 13 ? JACKET_D : WHITE) : x === rows[y][0] || x === rows[y][1] ? JACKET_D : JACKET);
    put(c, 5, 9, GOLD); put(c, 10, 9, GOLD);                                            // the collar
    [2, 13].forEach(function (ax) {                                                      // sleeves
      var top = null; c.forEach(function (p) { if (p.x === ax && p.y >= 8 && p.y <= 12 && (!top || p.y < top.y)) top = p; });
      if (top) top.col = JACKET;
    });
    return legs(c);
  }
  function sideCells(o) {
    var c = RS.cells(o).map(function (p) { return { x: p.x, y: p.y, col: SIDE_COL[p.c] }; })
      .filter(function (p) { return !(p.y >= 9 && p.y <= 13 && p.x >= 6 && p.x <= 10) && !(p.y === 3 && p.x >= 5 && p.x <= 10); });
    for (var x = 6; x <= 9; x++) put(c, x, 1, CAP);
    for (x = 5; x <= 10; x++) put(c, x, 2, x >= 9 ? WHITE : CAP);
    for (x = 5; x <= 12; x++) put(c, x, 3, x >= 11 ? CAP_D : CAP);                      // the brim sticks out in front
    for (var y = 9; y <= 13; y++) for (x = 6; x <= 10; x++) put(c, x, y, x === 10 && y < 13 ? WHITE : x === 6 ? JACKET_D : JACKET);
    [11, 5].forEach(function (ax) {
      var top = null; c.forEach(function (p) { if (p.x === ax && p.y >= 8 && p.y <= 12 && (!top || p.y < top.y)) top = p; });
      if (top) top.col = JACKET;
    });
    return legs(c);
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

  /* ---------------------------------------------------------------- pixel sprites */
  function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  // rows of characters -> pixels; (x, y) is the bottom centre; flip mirrors; k scales; white: 0..1 turns it white
  function art(rows, pal, x, y, o) {
    o = o || {};
    var h = rows.length, w = 0, k = o.k === undefined ? 1 : o.k, p = P * k;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    if (p <= .3) return;
    ctx.save(); ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    for (var r = 0; r < h; r++) for (var q = 0; q < rows[r].length; q++) {
      var ch = rows[r][q], col = pal[ch]; if (!col) continue;
      if (o.white) col = o.white >= 1 ? WHITE : mix(col, WHITE, o.white);
      var qx = o.flip ? w - 1 - q : q;
      ctx.fillStyle = col; ctx.fillRect(Math.round(x + (qx - w / 2) * p), Math.round(y - (h - r) * p), Math.ceil(p), Math.ceil(p));
    }
    ctx.restore();
  }
  function mix(a, b, t) {
    var A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    var r = Math.round((A >> 16) * (1 - t) + (B >> 16) * t), g = Math.round((A >> 8 & 255) * (1 - t) + (B >> 8 & 255) * t), bl = Math.round((A & 255) * (1 - t) + (B & 255) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  // our capture ball: blue top with a highlight, a black band, a gold button, a white bottom
  var BALL_TOP = ['..kkkk..', '.kblbbk.', 'kbbbbbbk', 'kkkyykkk'], BALL_BOT = ['kwwyywwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'];
  var BALL_PAL = { k: INK, b: JACKET, l: '#8FC3EE', y: GOLD, w: WHITE };
  function ball(x, y, o) {                                             // x, y: centre; o.open lifts the top; o.rot tilts
    o = o || {};
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
    art(BALL_TOP, BALL_PAL, 0, -(o.open || 0), {});
    art(BALL_BOT, BALL_PAL, 0, 4 * P, {});
    ctx.restore();
  }
  // the three creatures, facing right
  var MONS = [
    { name: 'Embit', pal: { o: '#F08A24', y: '#FFE08A', c: '#FFF1D0', k: INK, f: '#E3350D', g: GOLD },
      rows: ['.....o...o..', '....oyo.oyo.', '....ooooooo.', '...ookoooko.', '...ooooooooo', 'f..occcccoo.', 'gf.occccco..', 'fgfoooooooo.', '.f..oo...oo.'] },
    { name: 'Driblet', pal: { b: '#3D8FD6', l: '#9FD3F5', k: INK, w: WHITE },
      rows: ['.....b......', '....bbb.....', '...bbbbb....', '..blbbbbb...', '..lbbbbbbb..', '.bbbkbbkbbb.', '.bbbbbbbbbb.', '.bbbbkkbbbb.', '..bbbbbbbb..', '...bbbbbb...'] },
    { name: 'Pixmo', pal: { p: '#8E5BC4', q: '#C9A7F0', k: INK, w: WHITE },
      rows: ['...pppppp...', '..pqqppppp..', '.pqpppppppp.', '.ppwkpppwkp.', '.pppppppppp.', '.ppppkkkppp.', '.pppppppppp.', '.pppppppppp.', '.p.pp.pp.pp.', 'p..p..p..p..'],
      alt: ['...pppppp...', '..pqqppppp..', '.pqpppppppp.', '.ppwkpppwkp.', '.pppppppppp.', '.ppppkkkppp.', '.pppppppppp.', '.pppppppppp.', 'pp.pp.pp.pp.', '..p..p..p..p'] }
  ];
  var monBag = [];
  function nextMon() { if (!monBag.length) monBag = MONS.slice().sort(function () { return Math.random() - .5; }); return monBag.pop(); }
  function mon(m, x, y, o) {                                           // x, y: bottom centre
    o = o || {};
    var rows = m.alt && Math.floor((o.t || 0) * 4) % 2 ? m.alt : m.rows;
    art(rows, m.pal, x, y, { flip: o.face < 0, k: o.k, white: o.white, alpha: o.alpha });
  }
  // tall grass: blades that sway, and shake when something moves inside
  function grass(x, k, shake, t) {
    if (k <= 0) return;
    var blades = [-7, -5, -4, -2, -1, 1, 2, 4, 5, 7, 8, -8];
    blades.forEach(function (b, i) {
      var hh = Math.round((3 + (i * 7) % 4) * k), sw = Math.round(Math.sin(t * 2 + i) * .6 + (shake ? Math.sin(t * 40 + i * 2) * 1.4 : 0));
      for (var j = 0; j < hh; j++) px(x + b * P + (j === hh - 1 ? sw * P * .5 : 0), ground - (j + 1) * P * 1.4, P, P * 1.4, j > hh - 2 ? GRASS_L : GRASS);
    });
  }
  function star(x, y, r) {
    ctx.fillStyle = GOLD; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function flash(x, y, k) {                                            // a ring of light
    if (k <= 0 || k >= 1) return;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, 4 + k * 26, 0, Math.PI * 2); ctx.stroke();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; px(x + Math.cos(a) * (8 + k * 30) - 2, y + Math.sin(a) * (8 + k * 30) - 2, 4, 4, i % 2 ? WHITE : GOLD); }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- the robot on the line */
  var bot = { x: 0, face: 1, cells: null, lift: 0, front: null };
  function drawRobot() {
    paint(bot.cells || frontCells({}), bot.face < 0);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(bot.x, ground - bot.lift);
    ctx.drawImage(sprite, -8.5 * S, -18 * S); ctx.restore();
    if (bot.front) bot.front();
  }
  function front(pose, fr) { bot.cells = frontCells(pose); bot.front = fr || null; }
  function side(o, fr) { bot.cells = sideCells(o); bot.front = fr || null; }
  function run(t) { var k = Math.floor(t * 5) % 2; return { leg: k ? 0 : 2, arm: k ? 'swing0' : 'swing1' }; }
  function arc(a, b, q, hgt) { return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q - Math.sin(q * Math.PI) * hgt }; }

  /* ---------------------------------------------------------------- routines */
  function walkTo(target, speed) {
    speed = speed || 95;
    return { dur: 1, start: function () { this.dur = Math.abs(target - bot.x) / speed + .05; }, run: function (t, dt) {
      var d = Math.sign(target - bot.x); if (d) bot.face = d;
      bot.x += d * Math.min(Math.abs(target - bot.x), speed * dt);
      side(run(t)); bot.lift = 0;
    } };
  }
  function idle(sec) {
    return { dur: sec, run: function (t) { front({ blink: (t % 2.4) < .12, look: { x: bot.face, y: 0 } }); bot.lift = 0; } };
  }
  // a wild encounter in the tall grass
  function encounterRoutine() {
    var m, gx, cx, hand0;
    return { dur: 10.4, start: function () {
      m = nextMon(); bot.face = W - bot.x > W * .4 ? 1 : -1;
      gx = bot.x + bot.face * 28 * S; cx = gx - bot.face * 6 * S; hand0 = null;
    }, run: function (t, dt) {
      bot.lift = 0;
      var f = bot.face, gk = t < .5 ? t / .5 : t > 9.8 ? Math.max(0, (10.4 - t) / .6) : 1;
      var draws = [], self = this;
      draws.push(function () { grass(gx, gk, t > .4 && t < 2.1, t); });
      // the robot
      if (t < 1.7) front({ look: { x: f, y: 0 }, blink: (t % 2) < .1 });
      else if (t < 3.2) { bot.lift = t < 1.9 ? Math.sin((t - 1.7) / .2 * Math.PI) * S : 0; front({ armR: 'reach', look: { x: f, y: 0 } }); }
      else if (t < 3.7) side({ leg: 2, arm: 'up0' });
      else if (t < 4.3) side({ leg: 0, arm: 'forward' });
      else if (t < 7.2) front({ look: { x: f, y: 1 }, blink: false });
      else if (t < 8.6) front({ armL: 'up', armR: 'up', look: { x: 0, y: -1 }, step: Math.floor(t * 4) % 2 });
      else if (t < 9.6) { var d = cx - f * 5 * S - bot.x; bot.x += Math.sign(d) * Math.min(Math.abs(d), 120 * dt); bot.face = f; side(run(t)); }
      else front({ look: { x: f, y: 0 }, armR: 'reach' });
            // the creature: out of the grass, waiting, then into the ball
      var my = ground, mk = 1, mw = 0, mxp = cx, show = false, mface = -f;
      if (t >= 2.0 && t < 4.6) {
        show = true;
        if (t < 2.4) { var q = (t - 2) / .4, p = arc({ x: gx, y: ground + 3 * P }, { x: cx, y: ground }, q, 6 * S); mxp = p.x; my = p.y; }
        else my = ground - Math.abs(Math.sin(t * 5)) * P;
      }
      var target = { x: cx, y: ground - 5 * P };
      var hand = cellAt(14, 10);
      if (t >= 3.7 && !hand0) hand0 = { x: hand.x, y: hand.y };
      if (t >= 4.6 && t < 5.0) { show = true; var s2 = (t - 4.6) / .4; mk = 1 - s2; mw = Math.min(1, s2 * 3); my = target.y + 2 * P - s2 * 2 * P; }
      // the ball
      var bx = null, by = null, bo = {};
      if (t >= 3.2 && t < 3.9) { bx = bot.face > 0 ? hand.x : hand.x; by = hand.y - (t < 3.7 ? 6 * S : 0); }
      if (t >= 3.9 && t < 4.6) { var b1 = arc(hand0 || hand, target, (t - 3.9) / .7, 10 * S); bx = b1.x; by = b1.y; }
      if (t >= 4.6 && t < 5.0) { bx = target.x; by = target.y; bo.open = Math.sin((t - 4.6) / .4 * Math.PI) * 4 * P; }
      if (t >= 5.0) {
        bx = target.x; by = Math.min(ground - 4 * P, target.y + (t - 5) * 300);
        var w2 = t - 5.3, n = Math.floor(w2 / .6);
        if (w2 > 0 && n < 3 && (w2 % .6) < .3) bo.rot = Math.sin((w2 % .6) / .3 * Math.PI) * .35 * (n % 2 ? -1 : 1);
      }
      if (t >= 9.6) bx = null;                                     // picked up
      draws.unshift(function () { if (show) mon(m, mxp, my, { face: mface, k: mk, white: mw, t: t }); });
      draws.push(function () {
        if (bx !== null) ball(bx, by, bo);
        if (t >= 4.6 && t < 5.1) flash(target.x, target.y, (t - 4.6) / .5);
        if (t > 7.2 && t < 9.0) {
          var s = (t - 7.2);
          for (var i = 0; i < 3; i++) star(target.x + (i - 1) * 3 * S, ground - 8 * P - s * 30 - (i === 1 ? 8 : 0), 5 + (i === 1 ? 2 : 0));
        }
        if (t >= 9.6) { var hp = cellAt(14, 9); ball(hp.x, hp.y - 2 * P, {}); }
      });
      var fr0 = bot.front;
      bot.front = function () { draws.forEach(function (d) { d(); }); if (fr0) fr0(); };
      void self;
    } };
  }
  // a partner: sent out, a walk together, called back
  function partnerRoutine() {
    var m, land;
    return { dur: 7.2, start: function () {
      m = nextMon(); bot.face = W - bot.x > W * .45 ? 1 : -1; land = null;
    }, run: function (t, dt) {
      bot.lift = 0;
      var f = bot.face, hand = cellAt(14, 10), draws = [];
      var mx = null, my = ground, mk = 1, mw = 0, bx = null, by = null, bo = {};
      if (t < .5) { side({ leg: 2, arm: 'up0' }); bx = hand.x; by = hand.y - 6 * S; }
      else if (t < 1.0) { side({ leg: 0, arm: 'forward' }); if (!land) land = { x: bot.x + f * 14 * S, y: ground - 4 * P };
                          var b = arc(hand, land, (t - .5) / .5, 5 * S); bx = b.x; by = b.y; }
      else if (t < 1.4) { front({ look: { x: f, y: 0 } }); bx = land.x; by = land.y; bo.open = Math.min(3 * P, (t - 1) * 30);
                          mx = land.x; mk = (t - 1) / .4; mw = 1 - mk; }
      else if (t < 2.2) { front({ armR: 'wave', look: { x: f, y: 0 } }); mx = land.x; my = ground - Math.abs(Math.sin((t - 1.4) * 8)) * 3 * P; }
      else if (t < 5.4) {                                                    // walking together
        bot.x += f * 70 * dt; side(run(t)); mx = bot.x + f * 14 * S; my = ground - Math.abs(Math.sin(t * 7)) * 2 * P;
      } else if (t < 6.4) {                                                  // called back: it turns white and shrinks into the ball
        side({ leg: 2, arm: 'forward' }); mx = bot.x + f * 14 * S;
        var r = (t - 5.4) / 1; mw = Math.min(1, r * 2); mk = r < .5 ? 1 : 1 - (r - .5) * 2;
        var hx = hand.x, hy = hand.y;
        draws.push(function () { ball(hx + f * P, hy - P, {}); });
      } else front({ look: { x: f, y: 0 }, armR: 'reach' });
      var face = f;
      draws.unshift(function () { if (mx !== null && mk > 0) mon(m, mx, my, { face: face, k: mk, white: mw, t: t }); if (bx !== null) ball(bx, by, bo); });
      var fr0 = bot.front;
      bot.front = function () { draws.forEach(function (d) { d(); }); if (fr0) fr0(); };
    } };
  }
  var ROUTINES = [encounterRoutine, partnerRoutine];
  var only = /[?&]costume=(\w+)/.exec(location.search);                                     // for screenshots
  if (only) { var pick = { encounter: encounterRoutine, partner: partnerRoutine }[only[1]]; if (pick) ROUTINES = [pick]; }
  var queue = [], cur = null, curT = 0, now = 0, last = 0, bag = [];
  function next() {
    if (!queue.length) {
      if (!bag.length) bag = ROUTINES.slice().sort(function () { return Math.random() - .5; });
      var make = bag.pop(), r = make(), spot = W * (.15 + Math.random() * .5);
      spot = Math.max(W * .14, Math.min(W * .62, spot));
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
    curT += dt; cur.run(curT, dt);
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
