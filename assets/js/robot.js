/* Pixel robots, assembled from parts by a seeded random generator.
   Every robot is 16 x 17 cells and symmetric. No images: each frame is drawn on a canvas.
   window.Robot.make(seed) -> robot; Robot.cells(robot, pose) -> [{x, y, c}] */
(function () {
  'use strict';
  var W = 16, H = 17;
  var ACCENTS = ['#C0522A', '#2D6AA8', '#3C8D5A', '#C8902A', '#8A4FA0'];

  function rng(a) {               // mulberry32
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  // left/right bounds per row (inclusive); all symmetric around 7.5
  var HEADS = {
    square:  [[3, 12], [3, 12], [3, 12], [3, 12], [3, 12]],
    rounded: [[4, 11], [3, 12], [3, 12], [3, 12], [4, 11]],
    narrow:  [[4, 11], [4, 11], [4, 11], [4, 11], [4, 11]],
    dome:    [[5, 10], [4, 11], [3, 12], [3, 12], [3, 12]]
  };
  var BODIES = {
    wide:   [[3, 12], [3, 12], [3, 12], [3, 12], [3, 12]],
    narrow: [[4, 11], [4, 11], [4, 11], [4, 11], [4, 11]],
    barrel: [[4, 11], [3, 12], [3, 12], [3, 12], [4, 11]],
    taper:  [[3, 12], [3, 12], [4, 11], [4, 11], [5, 10]]
  };

  function make(seed) {
    var r = rng(seed >>> 0);
    return {
      seed: seed >>> 0,
      accent: pick(r, ACCENTS),
      antenna: pick(r, ['none', 'single', 'double', 'dish']),
      head: pick(r, Object.keys(HEADS)),
      eyes: pick(r, ['dots', 'big', 'visor', 'cyclops']),
      mouth: pick(r, ['line', 'grill', 'smile', 'none']),
      bolts: r() < 0.5,
      body: pick(r, Object.keys(BODIES)),
      chest: pick(r, ['panel', 'buttons', 'screen', 'heart']),
      arms: pick(r, ['short', 'long', 'claw']),
      legs: pick(r, ['legs', 'legs', 'wheel', 'tracks'])
    };
  }

  // pose: {step: 0|1, blink: bool, wave: bool}
  function cells(b, pose) {
    pose = pose || {};
    var g = [];
    for (var y = 0; y < H; y++) { g.push([]); for (var x = 0; x < W; x++) g[y].push(null); }
    function set(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; }
    function fillRows(y0, rows, c) {
      rows.forEach(function (lr, i) { for (var x = lr[0]; x <= lr[1]; x++) set(x, y0 + i, c); });
    }
    var X = 'x', A = 'a', E = 'e';

    // antenna rows 0-2
    if (b.antenna === 'single') { set(7, 0, A); set(8, 0, A); set(7, 1, X); set(8, 1, X); set(7, 2, X); set(8, 2, X); }
    if (b.antenna === 'double') { set(4, 0, A); set(11, 0, A); set(5, 1, X); set(10, 1, X); set(6, 2, X); set(9, 2, X); }
    if (b.antenna === 'dish') { for (var i = 6; i <= 9; i++) set(i, 0, A); set(7, 1, X); set(8, 1, X); set(7, 2, X); set(8, 2, X); }

    // head rows 3-7
    var hb = HEADS[b.head];
    fillRows(3, hb, X);
    var eye = pose.blink ? X : E;
    if (b.eyes === 'dots') { set(5, 5, eye); set(10, 5, eye); }
    if (b.eyes === 'big') { [5, 6, 9, 10].forEach(function (x) { set(x, 5, eye); if (!pose.blink) set(x, 4, E); }); }
    if (b.eyes === 'visor') { for (var v = 5; v <= 10; v++) set(v, 5, pose.blink ? A : E); }
    if (b.eyes === 'cyclops') { set(7, 5, eye); set(8, 5, eye); if (!pose.blink) { set(7, 4, E); set(8, 4, E); } }
    if (b.mouth === 'line') { for (var m = 6; m <= 9; m++) set(m, 7, A); }
    if (b.mouth === 'grill') { set(6, 7, A); set(8, 7, A); set(7, 7, A); set(9, 7, A); set(6, 6, X); }
    if (b.mouth === 'smile') { set(5, 6, A); set(10, 6, A); for (var s = 6; s <= 9; s++) set(s, 7, A); }
    if (b.bolts) { set(hb[2][0] - 1, 5, A); set(hb[2][1] + 1, 5, A); }

    // gaze: move the eye cells by (look.x, look.y), staying inside the head
    if (pose.look && (pose.look.x || pose.look.y) && !pose.blink) {
      var eyes = [];
      for (var ey = 3; ey <= 7; ey++) for (var ex = 0; ex < W; ex++) if (g[ey][ex] === E) { eyes.push([ex, ey]); g[ey][ex] = X; }
      eyes.forEach(function (c) {
        var nx = c[0] + pose.look.x, ny = c[1] + pose.look.y, row = hb[ny - 3];
        if (row && nx >= row[0] + 1 && nx <= row[1] - 1) set(nx, ny, E); else set(c[0], c[1], E);
      });
    }

    // neck row 8
    set(7, 8, X); set(8, 8, X);

    // body rows 9-13
    var bb = BODIES[b.body];
    fillRows(9, bb, X);
    if (b.chest === 'panel') { for (var p = 6; p <= 9; p++) { set(p, 10, A); set(p, 11, A); } }
    if (b.chest === 'buttons') { set(6, 10, A); set(9, 10, A); set(7, 11, E); set(8, 11, E); }
    if (b.chest === 'screen') { for (var q = 5; q <= 10; q++) { set(q, 10, E); set(q, 11, E); } set(6, 11, A); set(7, 10, A); set(8, 11, A); set(9, 10, A); }
    if (b.chest === 'heart') { set(6, 10, A); set(9, 10, A); set(6, 11, A); set(7, 11, A); set(8, 11, A); set(9, 11, A); set(7, 12, A); set(8, 12, A); set(7, 10, E); set(8, 10, E); }

    // arms, outside the body's row-10 bounds. Each arm has a pose:
    // down | up | wave | reach | visor | climb (half up). The right arm is drawn on the
    // right; the whole sprite is mirrored when the robot faces left.
    var L = bb[1][0] - 1, R = bb[1][1] + 1;
    var len = b.arms === 'long' ? 4 : 3;
    var claw = b.arms === 'claw';
    function arm(x, side, kind) {          // side: -1 left, +1 right
      var o = x + side;                    // one column further out
      if (kind === 'up') { set(x, 9, X); for (var u = 5; u <= 8; u++) set(o, u, X); set(o, 4, A); }
      else if (kind === 'climb') { set(x, 9, X); set(o, 8, X); set(o, 7, X); set(o, 6, claw ? A : X); }
      else if (kind === 'wave') { set(x, 9, X); set(o, 8, X); set(o, 7, X); if (claw) set(o, 6, A); }
      else if (kind === 'reach') { set(x, 10, X); set(o, 10, X); set(o + side, 10, X); set(o + side, 9, claw ? A : X); }
      else if (kind === 'reachUp') { set(x, 9, X); set(o, 8, X); set(o + side, 7, X); set(o + side, 6, A); }
      else if (kind === 'reachDown') { set(x, 11, X); set(o, 12, X); set(o + side, 13, X); set(o + side, 14, A); }
      else if (kind === 'visor') {
        set(x, 9, X); set(o, 8, X); set(o, 7, X); set(o, 6, X); set(o, 5, X); set(x, 4, A);
        var hx = hb[1][side > 0 ? 1 : 0];  // hand across the forehead, over the eyes
        for (var v2 = hx; side > 0 ? v2 >= 8 : v2 <= 7; v2 -= side) set(v2, 4, A);
      }
      else {                               // down
        for (var k = 0; k < len; k++) set(x, 10 + k, X);
        if (claw) { set(o, 12, A); set(x, 13, A); }
      }
    }
    arm(L, -1, pose.armL || 'down');
    arm(R, 1, pose.armR || (pose.wave ? 'wave' : 'down'));

    // legs rows 14-16
    var st = pose.step || 0;
    if (b.legs === 'legs') {
      if (st === 0) { [5, 6, 9, 10].forEach(function (x) { set(x, 14, X); set(x, 15, X); }); [4, 5, 6, 9, 10, 11].forEach(function (x) { set(x, 16, X); }); }
      else { [5, 6, 9, 10].forEach(function (x) { set(x, 14, X); }); [9, 10].forEach(function (x) { set(x, 15, X); }); [4, 5, 6].forEach(function (x) { set(x, 15, X); }); [9, 10, 11].forEach(function (x) { set(x, 16, X); }); }
    }
    if (b.legs === 'wheel') {
      for (var a1 = 6; a1 <= 9; a1++) { set(a1, 14, X); set(a1, 16, X); }
      for (var a2 = 5; a2 <= 10; a2++) set(a2, 15, X);
      set(st ? 6 : 9, 15, A); set(st ? 9 : 6, 15, E);
    }
    if (b.legs === 'tracks') {
      for (var t1 = 3; t1 <= 12; t1++) { set(t1, 14, X); set(t1, 15, X); }
      for (var t2 = 4; t2 <= 11; t2++) set(t2, 16, X);
      for (var t3 = 4 + st; t3 <= 11; t3 += 2) set(t3, 15, A);
    }

    if (pose.pulse) for (var px = 0; px < W; px++) if (g[0][px] === A) g[0][px] = 'p';

    var out = [];
    for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) if (g[yy][xx]) out.push({ x: xx, y: yy, c: g[yy][xx] });
    return out;
  }

  function color(c, b, theme) {
    if (c === 'p') return theme.eye;
    if (c === 'a') return b.accent;
    if (c === 'e') return theme.eye;
    return theme.ink;
  }

  // draw robot on a 2d context at (ox, oy) with cell size s; flip = face left
  function draw(ctx, b, pose, ox, oy, s, theme, flip) {
    cells(b, pose).forEach(function (p) {
      ctx.fillStyle = color(p.c, b, theme);
      var x = flip ? (W - 1 - p.x) : p.x;
      ctx.fillRect(Math.round(ox + x * s), Math.round(oy + p.y * s), Math.ceil(s), Math.ceil(s));
    });
  }

  function describe(b) {
    return b.head + ' head, ' + b.eyes + ' eyes, ' + b.body + ' body, ' + b.legs;
  }

  // the choices for each slot, in display order (legs weighted 2:1:1 in make, listed once here)
  var OPTIONS = {
    antenna: ['none', 'single', 'double', 'dish'],
    head: Object.keys(HEADS),
    eyes: ['dots', 'big', 'visor', 'cyclops'],
    mouth: ['line', 'grill', 'smile', 'none'],
    bolts: [false, true],
    body: Object.keys(BODIES),
    chest: ['panel', 'buttons', 'screen', 'heart'],
    arms: ['short', 'long', 'claw'],
    legs: ['legs', 'wheel', 'tracks'],
    accent: ACCENTS
  };
  var COMBOS = Object.keys(OPTIONS).reduce(function (n, k) { return n * OPTIONS[k].length; }, 1);

  // columns of the lowest cells (where rocket flames come out) and the highest row (where a hook holds it)
  function feet(b) {
    var c = cells(b, {}), bottom = 0, top = H;
    c.forEach(function (p) { if (p.y > bottom) bottom = p.y; if (p.y < top) top = p.y; });
    return { xs: c.filter(function (p) { return p.y === bottom; }).map(function (p) { return p.x; }), bottom: bottom, top: top };
  }

  // the cell of the right hand for an arm pose (before any mirroring)
  function hand(b, kind) {
    var R = BODIES[b.body][1][1] + 1, o = R + 1;
    if (kind === 'reach') return { x: o + 1, y: 9 };
    if (kind === 'reachUp') return { x: o + 1, y: 6 };
    if (kind === 'up') return { x: o, y: 4 };
    if (kind === 'climb') return { x: o, y: 6 };
    return { x: R, y: 12 };
  }

  window.Robot = { W: W, H: H, make: make, cells: cells, draw: draw, color: color, describe: describe, hand: hand,
                   OPTIONS: OPTIONS, COMBOS: COMBOS, feet: feet };
})();
