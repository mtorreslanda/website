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

    // neck row 8
    set(7, 8, X); set(8, 8, X);

    // body rows 9-13
    var bb = BODIES[b.body];
    fillRows(9, bb, X);
    if (b.chest === 'panel') { for (var p = 6; p <= 9; p++) { set(p, 10, A); set(p, 11, A); } }
    if (b.chest === 'buttons') { set(6, 10, A); set(9, 10, A); set(7, 11, E); set(8, 11, E); }
    if (b.chest === 'screen') { for (var q = 5; q <= 10; q++) { set(q, 10, E); set(q, 11, E); } set(6, 11, A); set(7, 10, A); set(8, 11, A); set(9, 10, A); }
    if (b.chest === 'heart') { set(6, 10, A); set(9, 10, A); set(6, 11, A); set(7, 11, A); set(8, 11, A); set(9, 11, A); set(7, 12, A); set(8, 12, A); set(7, 10, E); set(8, 10, E); }

    // arms, outside the body's row-10 bounds
    var L = bb[1][0] - 1, R = bb[1][1] + 1;
    var len = b.arms === 'long' ? 4 : 3;
    for (var k = 0; k < len; k++) set(L, 10 + k, X);
    if (pose.wave) { for (var w = 0; w < 3; w++) set(R + (w === 0 ? 0 : 1), 9 - w, X); if (b.arms === 'claw') set(R + 1, 6, A); }
    else { for (var k2 = 0; k2 < len; k2++) set(R, 10 + k2, X); }
    if (b.arms === 'claw') { set(L - 1, 12, A); set(L, 13, A); if (!pose.wave) { set(R + 1, 12, A); set(R, 13, A); } }

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

  window.Robot = { W: W, H: H, make: make, cells: cells, draw: draw, color: color, describe: describe,
                   OPTIONS: OPTIONS, COMBOS: COMBOS };
})();
