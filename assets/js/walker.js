/* The small robot. It has one place and one behaviour per section (decisions SH20, SH22):
     top, about  -> walks along the bottom of the screen after the cursor
     work        -> turns into a drone that flies ahead as the cards scroll and steadies when they stop
     coursework  -> turns into a desk lamp that lights the row under the cursor
     skills      -> hangs from a rope tied to the last letter of the title, swaying
     contact     -> stands on the word "Contact" and goes through a small routine; over the
                    e-mail address it folds into a paper plane
   Between places it drops (short way down) or flies with rockets on its feet.
   Everything is drawn cell by cell; nothing here is an image. */
(function () {
  'use strict';
  var Home = window.Home, R = window.Robot;
  var wc = document.getElementById('walker');
  var rope = document.getElementById('rope');
  var fx = document.getElementById('fx');
  if (!Home || !R || !wc || Home.reduce || window.innerWidth < 820) return;

  var S = 3, CC = 28, CR = 30, OX = 6, TOPM = 4;          // canvas in cells; robot drawn at (OX, TOPM)
  var RC = OX + 8, FOOT = TOPM + 17;                       // robot centre column; row under the feet
  var SEAT = 14, ROPE = 54;
  var dpr = window.devicePixelRatio || 1;
  wc.width = Math.round(CC * S * dpr); wc.height = Math.round(CR * S * dpr);
  wc.style.width = CC * S + 'px'; wc.style.height = CR * S + 'px';
  var ctx = wc.getContext('2d'), K = wc.width / CC;
  var fctx = fx.getContext('2d');
  var fxTop = document.getElementById('fxtop'), tctx = fxTop ? fxTop.getContext('2d') : fctx;   // in front of the robot
  function sizeFx() {
    fx.width = Math.round(innerWidth * dpr); fx.height = Math.round(innerHeight * dpr);
    if (fxTop) { fxTop.width = fx.width; fxTop.height = fx.height; }
  }
  sizeFx(); window.addEventListener('resize', sizeFx);

  /* ---------------------------------------------------------------- helpers */
  var capCache = {};
  var mctx = document.createElement('canvas').getContext('2d');
  function capInset(cs) {
    var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    if (capCache[font] == null) {
      mctx.font = font;
      var m = mctx.measureText('H');
      capCache[font] = (m.fontBoundingBoxAscent != null) ? m.fontBoundingBoxAscent - m.actualBoundingBoxAscent
                                                         : parseFloat(cs.fontSize) * 0.3;
    }
    return capCache[font];
  }
  // first line of text in el (viewport coords): left, right end of the text, cap top, baseline
  function textLine(el) {
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, rg = document.createRange();
    while ((node = tw.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      rg.selectNodeContents(node);
      var rs = rg.getClientRects(); if (!rs.length) continue;
      var first = rs[0], cs = getComputedStyle(node.parentElement), fs = parseFloat(cs.fontSize);
      var right = first.right;
      for (var i = 1; i < rs.length; i++) if (Math.abs(rs[i].top - first.top) < 4) right = Math.max(right, rs[i].right);
      return { left: first.left, right: right, top: first.top + capInset(cs), base: first.bottom - fs * 0.22, fs: fs };
    }
    var b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, base: b.bottom, fs: 16 };
  }
  // the last letter of el (viewport coords): left/right of its box, top of its ink, baseline
  function lastLetter(el) {
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, last = null;
    while ((node = tw.nextNode())) if (node.nodeValue.trim()) last = node;
    if (!last) { var b0 = el.getBoundingClientRect(); return { left: b0.right - 20, right: b0.right, top: b0.top, base: b0.bottom }; }
    var txt = last.nodeValue.replace(/\s+$/, ''), i = txt.length - 1;
    var rg = document.createRange(); rg.setStart(last, i); rg.setEnd(last, i + 1);
    var r = rg.getBoundingClientRect(), cs = getComputedStyle(last.parentElement);
    mctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = mctx.measureText(txt[i]);
    var base = r.top + (m.fontBoundingBoxAscent != null ? m.fontBoundingBoxAscent : parseFloat(cs.fontSize) * 0.9);
    return { left: r.left, right: r.right, top: base - m.actualBoundingBoxAscent, base: base };
  }
  var bgCache = new Map();
  function sectionBg(el) {
    if (!bgCache.has(el)) {
      var c = getComputedStyle(el).backgroundColor;
      bgCache.set(el, (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') ? '#F5F3EE' : c);
    }
    return bgCache.get(el);
  }
  function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------------------------------------------------------------- scenes */
  var SCENES = [
    { id: 'top', mode: 'hero' },
    { id: 'about', mode: 'rope' },
    { id: 'work', mode: 'drone', sel: '.section-work .sec-title' },
    { id: 'coursework', mode: 'lamp', sel: '#coursework .sec-title' },
    { id: 'skills', mode: 'tricks', sel: '#skills .sec-title' },
    { id: 'contact', mode: 'show', sel: '.contact-label' }
  ];
  SCENES.forEach(function (sc) { sc.section = document.getElementById(sc.id); sc.el = sc.sel ? document.querySelector(sc.sel) : null; });
  function sceneNow() {                     // the top-most panel that covers the middle of the screen
    var mid = innerHeight * 0.45;
    for (var i = SCENES.length - 1; i >= 0; i--) {
      var r = SCENES[i].section.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return SCENES[i];
    }
    return SCENES[0];
  }
  var lastSY = scrollY, scrollDir = 1, lastScrollT = 0, scrollV = 0;
  window.addEventListener('scroll', function () {
    var y = scrollY, now = performance.now(), dtS = Math.max(8, now - lastScrollT);
    if (y !== lastSY) scrollDir = y > lastSY ? 1 : -1;
    var v = Math.abs(y - lastSY) / dtS;                  // px per ms
    scrollV = now - lastScrollT > 300 ? v : scrollV * 0.6 + v * 0.4;
    lastSY = y; lastScrollT = now;
  }, { passive: true });
  // how hurried the move between sections should be, from how fast the page is scrolling
  function tempoNow(now) {
    var v = now - lastScrollT > 350 ? 0 : scrollV;
    return v > 6 ? 'teleport' : v > 2 ? 'express' : 'normal';
  }
  function incoming() {                      // the next section sliding in from below, if any
    if (scrollDir < 0 || !document.documentElement.classList.contains('stacked')) return null;
    for (var i = SCENES.indexOf(W.scene) + 1; i < SCENES.length; i++) {
      var r = SCENES[i].section.getBoundingClientRect();
      if (r.top > innerHeight * 0.12 && r.top < innerHeight * 0.95) return SCENES[i];
    }
    return null;
  }
  function floorY() { return scrollY + innerHeight - 6; }

  /* ---------------------------------------------------------------- front page and About (decision SH25)
     Front page: the name is a block. The robot walks on the ink of MIGUEL and on the part of
     A. CASTRO that sticks out, follows the cursor left and right, drops down, and goes up with a
     small rocket hop. Below the name the only level is the edge where About starts (the whole
     width), with "scroll" as a small step on it. When the top of the screen starts to squeeze it,
     it hangs from the ledge and lets go.
     About: it rappels down a rope hung to the right of the text, keeping pace with the scroll,
     and at the end lets go onto the edge where Work starts. */
  function firstLine(el) {                       // first line of text in el: x range and the top of its capitals
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, rg = document.createRange(), line = null;
    while ((node = tw.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      var cs = getComputedStyle(node.parentElement);
      if (cs.visibility === 'hidden') continue;
      rg.selectNodeContents(node);
      var rs = rg.getClientRects(), ins = capInset(cs);
      for (var k = 0; k < rs.length; k++) {
        var r = rs[k]; if (r.width < 2) continue;
        if (!line) line = { top: r.top, x1: r.left, x2: r.right, y: r.top + ins };
        else if (Math.abs(r.top - line.top) < 6) { line.x1 = Math.min(line.x1, r.left); line.x2 = Math.max(line.x2, r.right); line.y = Math.min(line.y, r.top + ins); }
        else if (r.top > line.top + 6) return line;
      }
    }
    return line;
  }
  function visibleP(p) { return p.y > scrollY + 80 && p.y <= scrollY + innerHeight + 4; }   // a surface on the bottom edge counts
  function nearestP(P, x, y, onlyVisible) {
    var bi = 0, bd = 1e9;
    P.forEach(function (p, i) {
      if (onlyVisible && !visibleP(p)) return;
      var dx = x < p.x1 ? p.x1 - x : x > p.x2 ? x - p.x2 : 0, d = Math.abs(p.y - y) + dx * 0.5;
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  }

  // The name as a landscape: the name is drawn into a hidden canvas and, column by column, the top of
  // the ink is read. The robot walks on that profile, so it follows the real letters (the L is a stem
  // with a foot, not a box).
  var heroTitle = document.querySelector('.hero-title');
  var hintEl = document.querySelector('.scroll-hint'), aboutEl = document.getElementById('about'), workEl = document.getElementById('work');
  var sky = null, skyAt = 0, bornAt = performance.now();
  var sctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function buildSky() {
    if (!heroTitle) return;
    var box = heroTitle.getBoundingClientRect();
    var ox = Math.floor(box.left - 30), oy = Math.floor(box.top - 60), w = Math.ceil(box.width + 60), h = Math.ceil(box.height + 120);
    var c = sctx.canvas; c.width = w; c.height = h;
    sctx.clearRect(0, 0, w, h); sctx.fillStyle = '#000'; sctx.textBaseline = 'alphabetic';
    var tw = document.createTreeWalker(heroTitle, NodeFilter.SHOW_TEXT), node, rg = document.createRange();
    while ((node = tw.nextNode())) {
      var txt = node.nodeValue, cs = getComputedStyle(node.parentElement);
      sctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var asc = sctx.measureText('H').fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9;
      for (var i = 0; i < txt.length; i++) {
        if (!txt[i].trim()) continue;
        rg.setStart(node, i); rg.setEnd(node, i + 1);
        var r = rg.getBoundingClientRect(); if (!r.width) continue;
        sctx.fillText(txt[i], r.left - ox, r.top + asc - oy);
      }
    }
    var d = sctx.getImageData(0, 0, w, h).data, top = new Float32Array(w), L = -1, Rr = -1;
    for (var x = 0; x < w; x++) {
      top[x] = Infinity;
      for (var y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 110) { top[x] = y + oy + scrollY; break; }
      if (top[x] < Infinity) { if (L < 0) L = x; Rr = x; }
    }
    sky = { x0: ox + scrollX, top: top, w: w, xl: L + ox + scrollX, xr: Rr + ox + scrollX };
    skyAt = performance.now();
  }
  var FOOT_HALF = 9;                                         // half the width of the feet, in px
  function skyY(x) {                                         // highest ink under the feet at page x
    if (!sky) return Infinity;
    var i0 = Math.round(x - sky.x0), m = Infinity;
    for (var i = i0 - FOOT_HALF; i <= i0 + FOOT_HALF; i++) if (i >= 0 && i < sky.w && sky.top[i] < m) m = sky.top[i];
    return m;
  }
  function gLetterX() {                                       // centre of the G of MIGUEL, in page coordinates
    var el = document.querySelector('.hero-title .l1'); if (!el) return null;
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), node, rg = document.createRange();
    while ((node = tw.nextNode())) {
      var i = node.nodeValue.indexOf('G');
      if (i >= 0) { rg.setStart(node, i); rg.setEnd(node, i + 1); var r = rg.getBoundingClientRect(); return (r.left + r.right) / 2 + scrollX; }
    }
    return null;
  }
  function stepBox() {                                       // the scroll text itself: a low step standing on the line
    var b = hintEl.getBoundingClientRect(), l = firstLine(hintEl);
    return { x1: b.left - 2 + scrollX, x2: b.right + 2 + scrollX, y: (l ? l.y : b.top) + scrollY };
  }
  function lineY() { return aboutEl.getBoundingClientRect().top + scrollY; }
  window.addEventListener('resize', function () { sky = null; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sky = null; });

  var aboutText = Array.prototype.slice.call(document.querySelectorAll('.about-text > *'));
  function ropeHB() { return (R.H - (feet().top - 3)) * S; }          // from the top of the ring to the feet
  function ropeAnchor() {
    var right = 0;
    aboutText.forEach(function (e) { right = Math.max(right, e.getBoundingClientRect().right); });
    return { x: (right + innerWidth) / 2 + scrollX, y: aboutEl.getBoundingClientRect().top + scrollY,
             bottom: workEl.getBoundingClientRect().top + scrollY };
  }
  function ropeLimit(an) { return an.bottom - ropeHB() - 46; }       // lowest the ring goes before it lets go
  function ropeWant(an) { return clamp(scrollY + innerHeight * 0.4, an.y + 50, ropeLimit(an)); }

  function landing(sc, pi) {
    if (sc.mode === 'hero') {
      if (!sky) buildSky();
      var lv = typeof pi === 'string' ? pi : null, st = stepBox(), ly = lineY();
      if (!lv) {
        var sx3 = clamp(W.x, sky ? sky.xl + 12 : 0, sky ? sky.xr - 12 : innerWidth), sy3 = skyY(sx3);
        var opts = [{ lv: 'line', d: Math.abs(ly - W.y) }, { lv: 'step', d: Math.abs(st.y - W.y) + Math.max(0, st.x1 - W.x, W.x - st.x2) * 0.5 }];
        if (sy3 < Infinity && sy3 > scrollY + 80) opts.push({ lv: 'sky', d: Math.abs(sy3 - W.y) });
        opts.sort(function (a, b) { return a.d - b.d; }); lv = opts[0].lv;
      }
      if (lv === 'sky') { var xs = clamp(W.x, sky.xl + 12, sky.xr - 12); return { x: xs, y: skyY(xs), pi: 'sky' }; }
      if (lv === 'step') return { x: clamp(W.x, st.x1 + 14, st.x2 - 14), y: st.y, pi: 'step' };
      return { x: clamp(W.x, 30, innerWidth - 30), y: ly, pi: 'line' };
    }
    if (sc.mode === 'rope') {
      var an = ropeAnchor(), ry = ropeWant(an);
      return { x: an.x, y: ry + ropeHB(), rope: true };
    }
    if (sc.mode === 'free') return { x: clamp(W.x, 40, innerWidth - 40), y: floorY() };
    var t = textLine(sc.el);
    if (sc.mode === 'drone') { var dp = droneSpot(sc); return { x: dp.x + scrollX, y: dp.y + scrollY + 9 * S, air: true }; }
    if (sc.mode === 'lamp') {                       // on the stem of the last letter (the k)
      var k = lastLetter(sc.el);
      return { x: k.left + (k.right - k.left) * 0.32 + scrollX, y: k.top + scrollY };
    }
    if (sc.mode === 'tricks') return { x: tricksX(), y: sc.section.getBoundingClientRect().bottom + scrollY };   // the edge with Contact is the floor
    if (sc.mode === 'hook') {                       // under the last letter (the s)
      var s2 = lastLetter(sc.el);
      var ax = (s2.left + s2.right) / 2 + scrollX, ay = s2.base + scrollY + 2;
      return { x: ax, y: ay + ROPE + (R.H - (feet().top - 3)) * S - 34, ax: ax, ay: ay };   // a little above: it grabs and drops
    }
    var st = sc.el.getBoundingClientRect();         // show: on the small stage above the label
    return { x: (t.left + t.right) / 2, y: st.top - 16 + scrollY };
  }

  // where the drone flies: along the header of the work section, by scroll progress (viewport coords)
  function droneSpot(sc) {
    var sec = sc.section, rect = sec.getBoundingClientRect();
    var p = clamp(-rect.top / Math.max(1, sec.offsetHeight - innerHeight), 0, 1);
    var tl = textLine(sc.el);
    var xL = tl.right + 70, xR = innerWidth - 90;
    return { x: xL + (xR - xL) * p, y: tl.top + (tl.base - tl.top) * 0.35 };
  }

  /* ---------------------------------------------------------------- sprites → cells in canvas coordinates */
  var fb = null;
  function feet() { if (!fb || fb.bot !== Home.bot) { fb = R.feet(Home.bot); fb.bot = Home.bot; } return fb; }
  function theme(dark) { return dark ? Home.THEME_DARK : Home.THEME; }

  function robotCells(pose, dir, dark) {
    var b = Home.bot, th = theme(dark);
    return R.cells(b, pose).map(function (p) {
      return { x: OX + (dir < 0 ? R.W - 1 - p.x : p.x), y: TOPM + p.y, col: R.color(p.c, b, th) };
    });
  }

  // a quadcopter, centred on the robot's centre (col RC, row 12)
  function droneCells(now, speed, dark) {
    var b = Home.bot, th = theme(dark), out = [], cy = 12;
    function put(c, r, col) { out.push({ x: RC + c, y: cy + r, col: col }); }
    var fast = Math.floor(now / (speed > 0.05 ? 35 : 70)) % 2;
    var blade = fast ? '#8A8A8A' : th.ink;
    if (fast) { for (var c1 = -10; c1 <= -7; c1++) put(c1, -4, blade); for (var c2 = 6; c2 <= 9; c2++) put(c2, -4, blade); }
    else { for (var c3 = -11; c3 <= -6; c3++) put(c3, -4, blade); for (var c4 = 5; c4 <= 10; c4++) put(c4, -4, blade); }
    put(-9, -3, th.ink); put(-8, -3, th.ink); put(7, -3, th.ink); put(8, -3, th.ink);
    for (var a = -9; a <= 8; a++) put(a, -2, th.ink);
    for (var t1 = -4; t1 <= 3; t1++) put(t1, -1, th.ink);
    for (var t2 = -5; t2 <= 4; t2++) put(t2, 0, (t2 >= -3 && t2 <= 2) ? th.eye : th.ink);
    for (var t3 = -5; t3 <= 4; t3++) put(t3, 1, (t3 === -1 || t3 === 0) ? b.accent : th.ink);
    for (var t4 = -4; t4 <= 3; t4++) put(t4, 2, th.ink);
    put(-3, 3, th.ink); put(2, 3, th.ink); put(-4, 4, th.ink); put(-3, 4, th.ink); put(2, 4, th.ink); put(3, 4, th.ink);
    put(-9, -2, b.accent); put(8, -2, b.accent);                 // arm lights
    return out;
  }

  // desk lamp standing where the robot's feet were; the shade turns by angle (radians, 0 = right)
  var LAMP_PIVOT = { x: 16, y: 6 }, SHADE_LEN = 7;
  function line(out, x0, y0, x1, y1, col, thick) {
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (var i = 0; i <= n; i++) {
      var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      out.push({ x: x, y: y, col: col }); if (thick) out.push({ x: x + 1, y: y, col: col });
    }
  }
  function lampCells(angle, lit, blink, dark) {
    var b = Home.bot, th = theme(dark), out = [];
    var base = FOOT - 1;                                          // the row the feet stood on
    for (var x = 9; x <= 18; x++) out.push({ x: x, y: base, col: th.ink });
    for (var x2 = 11; x2 <= 16; x2++) out.push({ x: x2, y: base - 1, col: th.ink });
    line(out, 13, base - 2, 10, 12, th.ink, true);
    out.push({ x: 10, y: 11, col: b.accent }, { x: 11, y: 11, col: b.accent });
    line(out, 11, 10, LAMP_PIVOT.x, LAMP_PIVOT.y + 1, th.ink, true);
    // shade: a trapezoid rasterised onto the grid
    var ca = Math.cos(angle), sa = Math.sin(angle);
    for (var gy = 0; gy < CR; gy++) for (var gx = 0; gx < CC; gx++) {
      var dx = gx + 0.5 - (LAMP_PIVOT.x + 0.5), dy = gy + 0.5 - (LAMP_PIVOT.y + 0.5);
      var u = dx * ca + dy * sa, v = -dx * sa + dy * ca;         // along / across the shade
      if (u < -0.6 || u > SHADE_LEN) continue;
      var half = 1.3 + (u / SHADE_LEN) * 2.4;
      if (Math.abs(v) > half) continue;
      var col = u > SHADE_LEN - 1.2 ? (lit ? '#FFD66B' : th.ink) : b.accent;
      if (!blink && u > 1.6 && u < 2.7 && Math.abs(v + 0.9) < 0.55) col = th.eye;   // its one eye
      out.push({ x: gx, y: gy, col: col });
    }
    return out;
  }
  function lampMouth(angle) {                                       // in canvas cells
    var ca = Math.cos(angle), sa = Math.sin(angle), half = 3.7;
    var mx = LAMP_PIVOT.x + 0.5 + ca * SHADE_LEN, my = LAMP_PIVOT.y + 0.5 + sa * SHADE_LEN;
    return { a: { x: mx - sa * half, y: my + ca * half }, b: { x: mx + sa * half, y: my - ca * half }, c: { x: mx, y: my } };
  }

  // paper plane, centred on the robot
  function planeCells(dark) {
    var th = theme(dark), out = [], rows = [
      '..............xx', '..........xxxx.x', '......xxxxxx..x.', '..xxxxxxxx...x..',
      'xxxxxxxxxxxxxx..', '..xxxxxx.xxx....', '......xx..x.....', '........xx......'];
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === 'x') out.push({ x: OX + x, y: 9 + y, col: th.ink }); });
    return out;
  }

  /* ---------------------------------------------------------------- drawing */
  var place = { left: 0, top: 0, rot: 0 };
  function paint(cells, halo) {
    ctx.clearRect(0, 0, wc.width, wc.height);
    var k = K;
    if (halo) {
      ctx.fillStyle = halo;
      cells.forEach(function (p) {
        ctx.fillRect((p.x - 1) * k, p.y * k, 3 * k, k);
        ctx.fillRect(p.x * k, (p.y - 1) * k, k, 3 * k);
      });
    }
    cells.forEach(function (p) {
      ctx.fillStyle = p.col;
      if (p.a != null) ctx.globalAlpha = p.a;
      ctx.fillRect(p.x * k, p.y * k, Math.ceil(k), Math.ceil(k));
      ctx.globalAlpha = 1;
    });
  }
  function commit() {
    wc.style.transform = 'translate(' + Math.round(place.left - scrollX) + 'px,' + Math.round(place.top - scrollY) + 'px)' +
                         (place.rot ? ' rotate(' + place.rot.toFixed(2) + 'deg)' : '');
  }
  function atFeet(x, y) { place.left = x - RC * S; place.top = y - FOOT * S; }   // robot standing at (x, y)

  /* ---------------------------------------------------------------- particles (fx canvas, page coordinates) */
  var parts = [];
  function puff(x, y, n, col, spread, up) {
    for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * (up || 0.05),
      life: 0, max: 380 + Math.random() * 300, col: col, g: 0.0002 });
  }
  // portals: a round hole of pixels with a turning ring, centred where the robot leaves or arrives
  var portals = [];
  function openPortal(x, y, R, openMs) { var pt = { x: x, y: y, R: R, t0: performance.now(), closeT: null, open: openMs || 180 }; portals.push(pt); return pt; }
  function portalR(pt, now) {
    var o = clamp((now - pt.t0) / pt.open, 0, 1), r = pt.R * (1 - Math.pow(1 - o, 3));
    if (pt.closeT != null) r *= 1 - clamp((now - pt.closeT) / 170, 0, 1);
    return r;
  }
  function drawPortal(pt, now) {
    var r = portalR(pt, now); if (r < 1) return;
    var cx = Math.round((pt.x - scrollX) / S) * S, cy = Math.round((pt.y - scrollY) / S) * S;
    fctx.fillStyle = 'rgba(18,18,18,0.9)';
    for (var yy = -r; yy <= r; yy += S) {                    // the hole, filled cell by cell so it stays pixelated
      var hw = Math.sqrt(Math.max(0, r * r - yy * yy));
      var x0 = Math.round((cx - hw) / S) * S, x1 = Math.round((cx + hw) / S) * S;
      fctx.fillRect(x0, Math.round((cy + yy) / S) * S, x1 - x0, S);
    }
    var cols = [Home.bot.accent, '#FFD66B', Home.bot.accent, '#F5F3EE'];
    var rings = [[r, 1, 70], [r * 0.62, -1, 110]];
    rings.forEach(function (rg, j) {
      var rr = rg[0], n = Math.max(8, Math.round(2 * Math.PI * rr / S)), spin = Math.floor(now / rg[2]) * rg[1];
      fctx.globalAlpha = j ? 0.55 : 1;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2;
        fctx.fillStyle = cols[((i + spin) % 4 + 4) % 4];
        fctx.fillRect(Math.round((cx + Math.cos(a) * rr) / S) * S, Math.round((cy + Math.sin(a) * rr) / S) * S, S, S);
      }
    });
    fctx.globalAlpha = 1;
  }
  function bit(x, y, vx, vy, max) {                         // a falling 0 or 1, or a plain pixel
    parts.push({ x: x, y: y, vx: vx, vy: vy, life: 0, max: max, g: 0,
                 col: Math.random() < 0.5 ? Home.bot.accent : '#FFD66B', ch: Math.random() < 0.45 ? (Math.random() < 0.5 ? '0' : '1') : null });
  }
  function drawFx(now, dt) {
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    portals = portals.filter(function (pt) { return pt.closeT == null || now - pt.closeT < 180; });
    portals.forEach(function (pt) { drawPortal(pt, now); });
    drawParkedLamp();
    drawGrass(now);
    if (fxTop) { tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, innerWidth, innerHeight); }
    propDraw.forEach(function (pr) {                         // the toys of the Skills scene, in front of the robot
      var k = S * (pr.scale || 1);
      tctx.globalAlpha = pr.alpha == null ? 1 : pr.alpha;
      pr.cells.forEach(function (c) {
        tctx.fillStyle = c.col;
        tctx.fillRect(Math.round(pr.x - scrollX + c.x * k), Math.round(pr.y - scrollY + c.y * k), Math.ceil(k), Math.ceil(k));
      });
      tctx.globalAlpha = 1;
    });
    propDraw = [];
    if (lightCone) {
      var c = lightCone;
      var g = fctx.createLinearGradient(c.m.x, c.m.y, c.r.x, c.r.y + c.r.h / 2);
      g.addColorStop(0, 'rgba(255, 214, 107, 0.42)'); g.addColorStop(1, 'rgba(255, 214, 107, 0.10)');
      fctx.fillStyle = g;
      fctx.beginPath();
      fctx.moveTo(c.a.x, c.a.y); fctx.lineTo(c.r.x, c.r.y); fctx.lineTo(c.r.x + c.r.w, c.r.y);
      fctx.lineTo(c.r.x + c.r.w, c.r.y + c.r.h); fctx.lineTo(c.r.x, c.r.y + c.r.h); fctx.lineTo(c.b.x, c.b.y);
      fctx.closePath(); fctx.fill();
    }
    parts = parts.filter(function (p) { return p.life < p.max; });
    parts.forEach(function (p) {
      p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      fctx.globalAlpha = 1 - p.life / p.max;
      fctx.fillStyle = p.col;
      if (p.ch) { fctx.font = '500 10px "JetBrains Mono", monospace'; fctx.fillText(p.ch, Math.round(p.x - scrollX), Math.round(p.y - scrollY)); }
      else fctx.fillRect(Math.round(p.x - scrollX), Math.round(p.y - scrollY), S, S);
    });
    fctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- state */
  var mouse = { cx: -1, cy: -1, t: -1e9, speed: 0 };
  var lastMove = { x: 0, y: 0, t: 0 };
  window.addEventListener('mousemove', function (e) {
    var now = performance.now(), dt = Math.max(1, now - lastMove.t);
    mouse.speed = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / dt;
    lastMove = { x: e.clientX, y: e.clientY, t: now };
    mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.t = now;
  });
  document.addEventListener('mouseleave', function () { mouse.t = -1e9; });
  function mouseActive(now) { return now - mouse.t < 7000; }

  var W = { x: 80, y: floorY(), dir: 1, step: 0, lastStep: 0, scene: SCENES[0], state: 'free', t0: 0,
            hop: -1, landT: -1e9, act: 0, actT: 0, idleT: 0, gesture: null,
            drone: null, lamp: null, hook: null, travel: null, morph: null, plane: null };
  wc.addEventListener('click', function () { Home.newRandom(); });
  (function startOnHero() {
    buildSky();
    if (!sky) return;
    W.x = sky.xl + 70; W.y = skyY(W.x);
    W.h = { lv: 'sky', act: null };
    W.state = 'intro'; W.t0 = performance.now();
  })();

  function setState(s, now) { W.state = s; W.t0 = now; }

  /* morph: pixels of one sprite fly into the places of another */
  function startMorph(fromCells, toFn, now, then) {
    // it transforms where it stands on the page, moving with the page like everything else
    W.morph = { from: fromCells, toFn: toFn, t0: now, then: then, delays: null, dur: W.tempo === 'express' ? 260 : 420,
                left: place.left, top: place.top };
    setState('morph', now);
  }
  function morphCells(now, halo) {
    var m = W.morph, to = m.toFn(now), t = (now - m.t0) / m.dur;
    if (!m.delays) m.delays = to.map(function () { return Math.random() * 0.35; });
    var out = to.map(function (p, i) {
      var src = m.from[i % m.from.length], d = m.delays[i];
      var e = easeIO(clamp((t - d) / (1 - 0.35), 0, 1));
      return { x: Math.round(src.x + (p.x - src.x) * e), y: Math.round(src.y + (p.y - src.y) * e),
               col: e < 0.5 ? src.col : p.col };
    });
    if (t < 0.9 && Math.random() < 0.6) {
      var sp = to[Math.floor(Math.random() * to.length)];
      out.push({ x: sp.x, y: sp.y, col: '#FFD66B' });
    }
    return { cells: out, done: t >= 1 };
  }

  /* ---------------------------------------------------------------- travel between scenes */
  function startTravel(sc, now, fromCells) {
    var top = scrollY;
    var sx = W.x, sy = clamp(W.y, top - 30, top + innerHeight + 70);
    W.x = sx; W.y = sy;
    var tg = landing(sc);
    var d = Math.hypot(tg.x - sx, tg.y - sy);
    // going down it lets go and falls (no rockets); up close it hops; far up it flies
    var kind = tg.y > sy + 40 ? 'fall' : d < 230 ? 'hop' : 'fly';
    W.scene = sc;
    var quick = W.tempo === 'express';
    W.travel = { sc: sc, sx: sx, sy: sy, kind: kind, pi: tg.pi,
                 dur: kind === 'hop' ? (quick ? 320 : 480) : quick ? clamp(d * 0.5, 350, 650) : clamp(d * 0.85, 600, 1100) };
    W.x = sx; W.y = sy;
    if (W.tempo === 'teleport') { startTeleport(now); return; }
    if (quick) { setState('flight', now); W.travel.t0 = now; return; }   // no wind-up
    if (kind === 'fall' && (W.prevState === 'hook' || W.prevState === 'rope' || sy <= top + 10)) {   // hanging, or already off the top: just drop
      setState('flight', now); W.travel.t0 = now; return;
    }
    setState(kind === 'fly' ? 'crouch' : 'hopoff', now);
  }

  function leaveScene(now) {               // transformed? turn back into a robot first
    W.prevState = W.state;
    W.tempo = tempoNow(now);
    var toS = sceneNow();
    if (W.state === 'tricks') {                                 // the toys burst first
      if (W.tk.phase === 'out') return;
      if (W.tk.last) poofAt(W.tk.last.x, W.tk.last.y, 12);
      W.tk.phase = 'out'; W.tk.t0 = now; W.tk.to = toS; grass.target = 0;
      return;
    }
    if (toS.mode === 'tricks') {
      if (W.state === 'lamp') { W.parkLamp = true; lightCone = null; clearLit(); enterTricks(now, toS, true); return; }   // the lamp stays on the k
      if (SCENES.indexOf(toS) < SCENES.indexOf(W.scene)) { W.tempo = 'normal'; startTravel(toS, now); return; }        // from below: a rocket jump up
      poofAt(W.x, W.y - 25, 12);
      enterTricks(now, toS, true);
      return;
    }
    if (W.state === 'workline' && sceneNow().id === 'work' && W.tempo !== 'teleport') {
      var to = sceneNow();
      startMorph(robotCells({}, W.dir, false), function (n) { return droneCells(n, 0.1, false); }, now, function (n) {
        W.scene = to;
        var spot = droneSpot(to), cyNow = W.y - 9 * S - scrollY;
        W.drone = { x: W.x - scrollX, v: 0, wob: 1, yo: cyNow - spot.y, vy: 0 };
        setState('drone', n);
      });
      W.scene = to;
      return;
    }
    var ids = W.scene.id + '>' + sceneNow().id;
    W.portalMode = ids === 'work>coursework' || ids === 'coursework>work';
    if (W.portalMode) W.tempo = 'teleport';                // the long way between them: always through a portal
    rope.style.opacity = 0; lightCone = null; clearLit();
    if (W.tempo !== 'teleport' && (W.state === 'drone' || W.state === 'lamp' || W.state === 'plane')) {
      var from = W.state === 'drone' ? droneCells(now, 0, false) : W.state === 'lamp' ? lampCells(W.lamp.angle, false, false, false) : planeCells(false);
      startMorph(from, function () { return robotCells({}, 1, false); }, now, function (n) { startTravel(sceneNow(), n); });
      return;
    }
    startTravel(sceneNow(), now);
  }

  // very fast scroll: it bursts into pixels and is printed again at its next place
  // very fast scroll (and always between Work and Coursework): scanned away in a column of light,
  // a stream of pixels runs to the goal, and it is printed there in another column of light
  function currentForm(now) {
    if (W.prevState === 'drone') return droneCells(now, 0.1, false);
    if (W.prevState === 'lamp' && W.lamp) return lampCells(W.lamp.angle, false, false, false);
    return robotCells({}, W.dir, false);
  }
  function formCentre(cells) {                              // centre of a sprite, in canvas cells, and its reach
    var xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
    cells.forEach(function (c) { if (c.x < xa) xa = c.x; if (c.x > xb) xb = c.x; if (c.y < ya) ya = c.y; if (c.y > yb) yb = c.y; });
    return { x: (xa + xb + 1) / 2, y: (ya + yb + 1) / 2, r: Math.max(xb - xa, yb - ya) / 2 };
  }
  // cells drawn swirling into (t from 0 to 1) or out of (reverse) the centre of a portal
  function swirl(cells, c, t, inward) {
    var maxd = 1;
    cells.forEach(function (q) { var d = Math.hypot(q.x - c.x, q.y - c.y); if (d > maxd) maxd = d; });
    var out = [];
    cells.forEach(function (q) {
      var dx = q.x - c.x, dy = q.y - c.y, d = Math.hypot(dx, dy);
      var delay = inward ? (1 - d / maxd) * 0.3 : (d / maxd) * 0.3;      // the edge goes in first; the core comes out first
      var k = clamp((t - delay) / 0.7, 0, 1);
      var e = inward ? k * k : 1 - Math.pow(1 - k, 2);
      var f = inward ? 1 - e : e;                                       // how far from the centre (1 = in place)
      if (f <= 0.04) return;
      var ang = (1 - f) * 2.6, ca = Math.cos(ang), sa = Math.sin(ang);
      out.push({ x: Math.round(c.x + (dx * ca - dy * sa) * f), y: Math.round(c.y + (dx * sa + dy * ca) * f),
                 col: f < 0.7 ? (Math.random() < 0.5 ? '#FFD66B' : Home.bot.accent) : q.col });
    });
    return out;
  }
  function startTeleport(now) {
    if (!W.portalMode) {                                    // the plain way: a burst of pixels, then printed row by row
      var bx = W.x, by = W.y;
      for (var i = 0; i < 18; i++) parts.push({ x: bx + (Math.random() - 0.5) * 30, y: by - Math.random() * 50, vx: (Math.random() - 0.5) * 0.25,
        vy: -Math.random() * 0.2, life: 0, max: 380, col: Math.random() < 0.5 ? Home.bot.accent : '#1A1A1A', g: 0.0006 });
      lightCone = null; clearLit();
      setState('print', now);
      return;
    }
    portalExit(now, null);
  }
  // goes into a portal where it stands, attached to the page (it scrolls with everything else).
  // If it is already off screen there is nothing to show: it is simply in transit.
  function portalExit(now, toId) {
    var cells0 = currentForm(now), c = formCentre(cells0);
    lightCone = null; clearLit();
    W.transitTo = toId;
    var cy = place.top + c.y * S - scrollY;
    if (cy < -30 || cy > innerHeight + 30) { setState(toId ? 'transit' : 'portalin', now); W.pin = null; return; }
    W.po = { cells: cells0, c: c, left: place.left, top: place.top };
    W.po.portal = openPortal(place.left + c.x * S, place.top + c.y * S, Math.max(24, c.r * S * 0.75), 80);
    setState('portalout', now);
  }

  /* ---------------------------------------------------------------- lamp light */
  var lightCone = null, litRow = null;
  var courseRows = Array.prototype.slice.call(document.querySelectorAll('#coursework .row'));
  function clearLit() { if (litRow) { litRow.classList.remove('lit'); litRow = null; } }
  function rowForMouse() {
    if (!mouseActive(performance.now())) return null;
    var best = null, bd = 1e9;
    courseRows.forEach(function (r) {
      var b = r.getBoundingClientRect();
      if (b.bottom < 80 || b.top > innerHeight) return;
      var d = mouse.cy < b.top ? b.top - mouse.cy : mouse.cy > b.bottom ? mouse.cy - b.bottom : 0;
      if (d < bd) { bd = d; best = r; }
    });
    return bd < 160 ? best : null;
  }

  /* ---------------------------------------------------------------- main tick */
  var ACTS = ['wave', 'look', 'dance', 'hop', 'spin', 'sit', 'dance', 'wave'];

  function tick(now, dt) {
    var blink = now < Home.blinkUntil;
    var sc = sceneNow();
    var busy = W.state === 'morph' || W.state === 'crouch' || W.state === 'ignite' || W.state === 'flight' || W.state === 'hopoff' || W.state === 'land' || W.state === 'ride' || W.state === 'portalin' || W.state === 'portalout' || W.state === 'transit' || W.state === 'print' || W.state === 'intro' || W.state === 'regrab';
    if (W.rodeLast && W.rodeLast.section.getBoundingClientRect().top > innerHeight) W.rodeLast = null;
    if (!busy || W.state === 'land') {
      var inc = incoming();
      if (inc && inc !== W.rodeLast && W.state !== 'plane') { startRide(inc, now); busy = true; }
    }
    if (sc !== W.scene && !busy) leaveScene(now);
    else if (sc !== W.scene && (W.state === 'flight') && W.travel && W.travel.sc !== sc) { W.travel.sc = sc; W.scene = sc; }

    var dark = (function () { var r = Home.contact.getBoundingClientRect(), y = W.y - scrollY; return y > r.top && y < r.bottom + 40; })();
    var halo = sectionBg(W.scene.section);
    var cells, el = now - W.t0;
    place.rot = 0;

    switch (W.state) {

      case 'morph': {
        place.left = W.morph.left; place.top = W.morph.top;
        W.x = place.left + RC * S; W.y = place.top + FOOT * S;
        var m = morphCells(now, halo);
        cells = m.cells;
        if (m.done) { var then = W.morph.then; W.morph = null; then(now); }
        break;
      }

      case 'crouch': {                                     // anticipation before take-off
        atFeet(W.x, W.y);
        place.top += S;
        cells = robotCells({ step: 0, blink: blink, armL: 'down', armR: 'down' }, W.dir, dark);
        if (el > 140) setState('ignite', now);
        break;
      }
      case 'ignite': {                                     // the rockets cough a few times
        atFeet(W.x, W.y);
        var on = Math.floor(el / 70) % 2 === 0 || el > 180;
        cells = robotCells({ step: 1, blink: blink, armR: 'up' }, W.dir, dark);
        if (on) cells = cells.concat(flames(now, el > 180 ? 3 : 1));
        if (Math.random() < 0.3) puff(W.x, W.y, 1, '#C8C2B8', 0.06, 0.02);
        if (el > 160) { setState('flight', now); W.travel.t0 = now; }
        break;
      }
      case 'hopoff': {                                     // short drop: a little hop first
        atFeet(W.x, W.y - Math.sin(clamp(el / 160, 0, 1) * Math.PI) * 10);
        cells = robotCells({ step: 1, blink: blink, armL: 'up', armR: 'up' }, W.dir, dark);
        if (el > 160) { setState('flight', now); W.travel.t0 = now; }
        break;
      }
      case 'flight': {
        var tr = W.travel, tg = landing(tr.sc, tr.pi), t = clamp((now - tr.t0) / tr.dur, 0, 1), x, y;
        if (tr.kind === 'fly') {
          var e = easeIO(t), cx = (tr.sx + tg.x) / 2, cy = Math.min(tr.sy, tg.y) - 120;
          x = (1 - e) * (1 - e) * tr.sx + 2 * (1 - e) * e * cx + e * e * tg.x;
          y = (1 - e) * (1 - e) * tr.sy + 2 * (1 - e) * e * cy + e * e * tg.y;
          y += Math.sin(now / 120) * 1.5;                  // a slight wobble
        } else if (tr.kind === 'hop') {
          var eh = easeIO(t);
          x = tr.sx + (tg.x - tr.sx) * eh; y = tr.sy + (tg.y - tr.sy) * eh - Math.sin(t * Math.PI) * 60;
        } else { x = tr.sx + (tg.x - tr.sx) * t; y = tr.sy + (tg.y - tr.sy) * t * t; }
        var vx = x - W.x;
        if (Math.abs(tg.x - tr.sx) > 4) W.dir = tg.x > tr.sx ? 1 : -1;
        W.x = x; W.y = y;
        atFeet(x, y);
        if (tr.kind === 'fly') {
          place.rot = clamp(vx * 4, -14, 14);
          var burning = t < 0.86 || tg.air;
          cells = robotCells({ step: 1, blink: blink, armR: 'up' }, W.dir, dark);
          if (burning) {
            cells = cells.concat(flames(now, 3));
            if (Math.random() < 0.7) parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + 4, vx: (Math.random() - 0.5) * 0.03, vy: 0.02,
              life: 0, max: 420, col: Math.random() < 0.5 ? '#F2B33D' : '#E0662E', g: 0 });
          }
        } else cells = robotCells({ step: 1, blink: blink, armL: 'up', armR: 'up' }, W.dir, dark);
        if (t >= 1) {
          W.y = tg.y; W.x = tg.x; W.landT = now;
          if (tg.air || tg.rope) { arrive(now); break; }
          puff(W.x, W.y, 8, dark ? '#777' : '#B9B2A6', 0.14, 0.03);
          setState('land', now);
        }
        break;
      }
      case 'land': {                                       // squash, then shake it off
        var lt = landing(W.scene, W.travel && W.travel.pi);
        W.x = lt.x; W.y = lt.y;
        atFeet(W.x, W.y);
        if (el < 120) place.top += S;
        var shake = W.tempo !== 'express' && el > 140 && el < 320 ? (Math.floor(el / 60) % 2 ? 1 : -1) : 0;
        place.left += shake;
        cells = robotCells({ step: 0, blink: blink, armL: el < 200 ? 'up' : 'down', armR: el < 200 ? 'up' : 'down' }, W.dir, dark);
        if (el > (W.tempo === 'express' ? 150 : 340)) arrive(now);
        break;
      }

      case 'hero': {
        if (!sky || (now - bornAt < 3500 && now - skyAt > 250)) buildSky();   // the letters rise in at first
        var hz = W.h, on = mouseActive(now), pz = { blink: blink }, st = stepBox(), ly = lineY();
        var mx = on ? mouse.cx + scrollX : (hz.wx != null ? hz.wx : W.x), my = on ? mouse.cy + scrollY : W.y - 30;
        if (!on && (!hz.wt || now > hz.wt)) {
          var lo = hz.lv === 'sky' ? sky.xl + 14 : hz.lv === 'step' ? st.x1 + 14 : 40, hi = hz.lv === 'sky' ? sky.xr - 14 : hz.lv === 'step' ? st.x2 - 14 : innerWidth - 40;
          hz.wx = lo + Math.random() * Math.max(0, hi - lo); hz.wt = now + 3500 + Math.random() * 3500;
        }
        var A = hz.act, cy0 = hz.lv === 'sky' ? skyY(W.x) : hz.lv === 'step' ? st.y : ly;

        // which level does the cursor point at?
        if (!A) {
          var want = hz.lv;
          if (on) {
            var sxm = clamp(mx, sky.xl + 12, sky.xr - 12), sym = skyY(sxm), opts2 = [];
            opts2.push({ lv: 'line', d: Math.abs(ly - (my + 25)) });
            opts2.push({ lv: 'step', d: Math.abs(st.y - (my + 25)) + Math.max(0, st.x1 - mx, mx - st.x2) * 0.6 });
            if (sym < Infinity && sym > scrollY + 80) opts2.push({ lv: 'sky', d: Math.abs(sym - (my + 25)) + Math.max(0, sky.xl - mx, mx - sky.xr) * 0.3 });
            opts2.sort(function (a, b) { return a.d - b.d; }); want = opts2[0].lv;
          }
          if (hz.lv === 'step' && hz.crossing) {
            var goalBeyond = hz.crossing > 0 ? mx > st.x2 + 4 : mx < st.x1 - 4;
            if (!on || goalBeyond || want === 'line') want = 'cross';
            else hz.crossing = 0;
          }
          var head = W.y - (R.H - feet().top) * S;
          if (hz.lv === 'sky' && head < scrollY + 72) want = 'line';            // squeezed by the top of the screen
          if (want !== hz.lv) {
            if (hz.lv === 'sky') A = hz.act = { type: 'toend', hurry: head < scrollY + 72 };
            else if (want === 'sky') {
              var rx = clamp(mx, sky.xl + 14, sky.xr - 14);
              A = hz.act = { type: 'rocket', t0: now, sx: W.x, sy: W.y, x: rx };
            } else if (want === 'step') {
              A = hz.act = { type: 'hop', t0: now, sx: W.x, sy: W.y, x: clamp(mx, st.x1 + 14, st.x2 - 14), to: 'step', arc: 26, dur: 360 };
            } else if (want === 'cross') {                                     // across the step and down the far side
              var edge = hz.crossing > 0 ? st.x2 - 12 : st.x1 + 12;
              if (Math.abs(W.x - edge) > 3) { W.dir = hz.crossing; W.x += hz.crossing * Math.min(0.2 * dt, Math.abs(W.x - edge)); W.y = st.y;
                if (now - W.lastStep > 140) { W.step ^= 1; W.lastStep = now; } pz.step = W.step; A = hz.act = { type: 'noop' }; }
              else { A = hz.act = { type: 'hop', t0: now, sx: W.x, sy: W.y, x: hz.crossing > 0 ? st.x2 + 24 : st.x1 - 24, to: 'line', arc: 14, dur: 300 }; hz.crossing = 0; }
            } else {                                                            // step -> line: off the nearer side
              var off = (mx < (st.x1 + st.x2) / 2) ? st.x1 - 26 : st.x2 + 26;
              A = hz.act = { type: 'hop', t0: now, sx: W.x, sy: W.y, x: off, to: 'line', arc: 16, dur: 320 };
            }
          }
        }

        if (A && A.type === 'noop') hz.act = null;
        if (A && A.type === 'toend') {                                          // along the letters to the end of the O
          var res = skyWalk(sky.xr - 3, (A.hurry ? 0.36 : 0.22) * dt, pz);
          if (res === 'edge' || res === 'there') A = hz.act = { type: 'ledge', t0: now, x0: W.x, y0: W.y };
        }
        if (A && A.type === 'skyhop') {
          var kt = clamp((now - A.t0) / A.dur, 0, 1), ke = easeIO(kt), ky = skyY(A.x);
          W.x = A.sx + (A.x - A.sx) * ke; W.y = A.sy + (ky - A.sy) * ke - Math.sin(kt * Math.PI) * A.arc;
          pz.step = 1; pz.armL = 'up'; pz.armR = 'up';
          if (kt >= 1) { hz.act = null; W.y = ky; W.landT = now; }
        }
        if (A && A.type === 'wall') {                                           // climbing a wall of a letter
          var ph = now - A.t0;
          W.dir = A.face;
          if (A.down) {
            if (ph < 240) {                                                     // over the edge: hands on top, body lowers
              var e1 = easeIO(ph / 240);
              W.x = A.x0 + (A.x - A.x0) * e1; W.y = A.y0 + 13 * S * e1;
              pz.armL = 'up'; pz.armR = 'up'; pz.step = 0;
            } else {
              var goal = A.y1, v = 0.15 * dt;
              W.x = A.x;
              if (W.y + v >= goal) { W.y = goal; hz.act = null; W.landT = now; }
              else W.y += v;
              var rg2 = Math.floor(W.y / 8) % 2; pz.step = rg2; pz.armL = rg2 ? 'climb' : 'down'; pz.armR = rg2 ? 'down' : 'climb';
            }
          } else {
            var top2 = A.y1 + 13 * S;
            if (W.y > top2 + 0.5) {                                             // climbing up
              W.x = A.x; W.y = Math.max(top2, W.y - 0.15 * dt);
              var rg3 = Math.floor(W.y / 8) % 2; pz.step = rg3; pz.armL = rg3 ? 'climb' : 'down'; pz.armR = rg3 ? 'down' : 'climb';
              if (W.y <= top2 + 0.5) A.t1 = now;
            } else {                                                            // pulls itself up onto the top
              var e2 = easeIO(clamp((now - A.t1) / 260, 0, 1));
              W.x = A.x + (A.xTop - A.x) * e2; W.y = top2 + (A.y1 - top2) * e2;
              pz.armL = 'up'; pz.armR = 'up'; pz.step = 1;
              if (e2 >= 1) { hz.act = null; W.y = skyY(W.x); }
            }
          }
        }
        if (A && A.type === 'ledge') {                                          // hangs from the end of the O, then lets go
          var lt = now - A.t0, endX = sky.xr + 14;
          W.dir = -1;                                                           // facing the letters
          if (lt < 300) {
            var e3 = easeIO(lt / 300);
            W.x = A.x0 + (endX - A.x0) * e3; W.y = A.y0 + 13 * S * e3;
            pz.armL = 'up'; pz.armR = 'up'; pz.step = 0;
          } else if (lt < (A.hurryRel ? 420 : 760)) {
            W.x = endX; W.y = A.y0 + 13 * S;
            pz.armL = 'up'; pz.armR = 'up'; pz.step = Math.floor(lt / 170) % 2;
            place.rot = Math.sin(lt / 110) * 3;
          } else { hz.act = { type: 'fall', vy: 0.04 }; pz.armL = 'up'; pz.armR = 'up'; }
          atFeet(W.x, W.y); cells = robotCells(pz, W.dir, false); break;
        }
        if (A && A.type === 'fall') {
          var py = W.y;
          A.vy += 0.0026 * dt; W.y += A.vy * dt;
          pz.armL = 'up'; pz.armR = 'up'; pz.step = 1;
          var onStep = W.x >= st.x1 - 4 && W.x <= st.x2 + 4;
          if (onStep && py <= st.y && W.y >= st.y) { W.y = st.y; hz.lv = 'step'; hz.act = null; W.landT = now; puff(W.x, W.y, 6, '#B9B2A6', 0.1, 0.02); }
          else if (W.y >= ly) { W.y = ly; hz.lv = 'line'; hz.act = null; W.landT = now; puff(W.x, W.y, 7, '#B9B2A6', 0.12, 0.02); }
        }
        if (A && A.type === 'hop') {                                            // an ordinary jump, no rockets
          var ht = clamp((now - A.t0) / A.dur, 0, 1), he = easeIO(ht);
          var ty2 = A.to === 'step' ? st.y : ly;
          W.x = A.sx + (A.x - A.sx) * he; W.y = A.sy + (ty2 - A.sy) * he - Math.sin(ht * Math.PI) * A.arc;
          if (Math.abs(A.x - A.sx) > 2) W.dir = A.x > A.sx ? 1 : -1;
          pz.step = 1; pz.armL = ht < 0.5 ? 'up' : 'down'; pz.armR = ht < 0.5 ? 'up' : 'down';
          if (ht >= 1) {
            hz.lv = A.to; hz.act = null; W.landT = now;
            if (A.cross && A.to === 'step') hz.crossing = A.cross;            // keep going: walk across, hop down the other side
          }
        }
        if (A && A.type === 'rocket') {                                         // from below up onto the letters
          var gy = skyY(A.x), rdur = clamp(Math.abs(A.sy - gy) * 1.1, 420, 760), rt2 = clamp((now - A.t0) / rdur, 0, 1), re = easeIO(rt2);
          W.x = A.sx + (A.x - A.sx) * re; W.y = A.sy + (gy - A.sy) * re - Math.sin(rt2 * Math.PI) * 36;
          if (Math.abs(A.x - A.sx) > 3) W.dir = A.x > A.sx ? 1 : -1;
          pz.armR = 'up'; pz.step = 1;
          atFeet(W.x, W.y);
          cells = robotCells(pz, W.dir, false).concat(rt2 < 0.85 ? flames(now, 2) : []);
          if (rt2 < 0.85 && Math.random() < 0.5) parts.push({ x: W.x, y: W.y + 4, vx: (Math.random() - 0.5) * 0.03, vy: 0.03, life: 0, max: 300, col: Math.random() < 0.5 ? '#F2B33D' : '#E0662E', g: 0 });
          if (rt2 >= 1) { hz.lv = 'sky'; hz.act = null; W.landT = now; }
          break;
        }

        if (!hz.act && !A) {                                                    // on its level: under the cursor
          if (hz.lv === 'sky') {
            var r4 = skyWalk(clamp(mx, sky.xl + 10, sky.xr - 10), (on ? 0.2 : 0.07) * dt, pz);
            if ((r4 === 'there' || r4 === 'edge') && on && (mx < sky.xl - 24 || mx > sky.xr + 24)) reachTo(mx, my, pz);
            else if (r4 === 'there') idleOrWave(now, on, mx, my, pz, hz);
          } else {
            var lo2 = hz.lv === 'step' ? st.x1 + 12 : 30, hi2 = hz.lv === 'step' ? st.x2 - 12 : innerWidth - 30;
            var gx = clamp(mx, lo2, hi2), dxs = gx - W.x, sp2 = (on ? 0.2 : 0.07) * dt;
            W.y = hz.lv === 'step' ? st.y : ly;
            // on the line, the scroll text is in the way: hop onto it to get past
            if (hz.lv === 'line' && Math.abs(dxs) > 3) {
              var nxl = W.x + clamp(dxs, -sp2, sp2), dirl = dxs > 0 ? 1 : -1;
              if (nxl + FOOT_HALF >= st.x1 && nxl - FOOT_HALF <= st.x2 && !(W.x + FOOT_HALF >= st.x1 && W.x - FOOT_HALF <= st.x2)) {
                hz.act = { type: 'hop', t0: now, sx: W.x, sy: W.y, x: dirl > 0 ? st.x1 + 12 : st.x2 - 12, to: 'step', arc: 18, dur: 300, cross: dirl };
                dxs = 0;
              }
            }
            if (Math.abs(dxs) > 3) { W.dir = dxs > 0 ? 1 : -1; W.x += clamp(dxs, -sp2, sp2); if (now - W.lastStep > 140) { W.step ^= 1; W.lastStep = now; } pz.step = W.step; hz.idleT = now; }
            else if (on && (mx < lo2 - 24 || mx > hi2 + 24)) reachTo(mx, my, pz);
            else idleOrWave(now, on, mx, my, pz, hz);
          }
        }
        var hy3 = 0;
        if (W.hop >= 0) { var hh = (now - W.hop) / 420; if (hh >= 1) W.hop = -1; else hy3 = -Math.sin(hh * Math.PI) * 12; }
        if (W.hello && now - W.hello < 1300) pz.armR = Math.floor((now - W.hello) / 260) % 2 ? 'wave' : 'up';   // hello after arriving
        atFeet(W.x, W.y + hy3);
        cells = robotCells(pz, W.dir, false);
        break;
      }

      case 'rope': {                                                    // rappelling down the right side of About
        var an = ropeAnchor(), want = ropeWant(an), rp = W.rp;
        // the edge with Work is in sight: let go
        if (an.bottom - scrollY < innerHeight * 0.85) { setState('ropefall', now); W.rf = { vy: 0.05 }; rope.style.opacity = 0; cells = robotCells({ blink: blink }, W.dir, false); break; }
        var gap = want - rp.ring;
        rp.ring += gap * Math.min(1, dt * 0.008);                        // it lags a little behind the scroll
        var moving = Math.abs(gap) > 3;
        var sway = Math.sin(now / 760) * 3 + (moving ? Math.sin(now / 95) * 1.5 : 0);
        if (rp.sw) sway += rp.sw * Math.exp(-(now - rp.st) / 1100) * Math.cos((now - rp.st) / 300);   // the swing it arrived with
        var rx = an.x + sway;
        showRope(an.x, an.y, rx, rp.ring);
        place.left = rx - RC * S; place.top = rp.ring - (TOPM + feet().top - 3) * S;
        place.rot = -sway * 0.6;
        W.x = rx; W.y = rp.ring + ropeHB();
        var kick = Math.floor(now / 160) % 2;
        if (mouseActive(now) && !moving && Math.abs(mouse.cx + scrollX - rx) > 40) W.dir = mouse.cx + scrollX > rx ? 1 : -1;
        var dyr = mouse.cy + scrollY - (rp.ring + 40);
        cells = robotCells({ blink: blink, armL: 'up', armR: moving ? (kick ? 'climb' : 'down') : 'down', step: moving ? kick : 0,
                             look: !moving && mouseActive(now) ? { x: 1, y: Math.abs(dyr) > 60 ? (dyr > 0 ? 1 : -1) : 0 } : null }, W.dir, false).concat(ring(false));
        break;
      }
      case 'ropefall': {                                                // lets go and lands on the edge where Work starts
        var an2 = ropeAnchor();
        W.rf.vy += 0.0026 * dt; W.y += W.rf.vy * dt; W.x = an2.x;
        var floorW = an2.bottom;
        atFeet(W.x, Math.min(W.y, floorW));
        cells = robotCells({ blink: blink, armL: 'up', armR: 'up', step: 1 }, W.dir, false);
        if (W.y >= floorW) { W.y = floorW; W.landT = now; puff(W.x, W.y, 6, '#B9B2A6', 0.1, 0.02); setState('workline', now); }
        break;
      }
      case 'regrab': {                                                  // throws a hook up to where the rope is tied, then is pulled up
        var an4 = ropeAnchor(), ringY = ropeWant(an4), hb4 = ropeHB(), rgs = W.rg;
        var handX = W.x + W.dir * 4, handY = W.y - 15 * S;               // where the hand is when the arm is up
        if (el < 160) {                                                   // wind-up: looks up, arm back
          W.y = an4.bottom; W.dir = an4.x >= W.x ? 1 : -1;
          atFeet(W.x, W.y);
          cells = robotCells({ blink: blink, armR: 'up', look: { x: 0, y: -1 } }, W.dir, false);
          rgs.sy = W.y; rgs.sx = W.x;
          break;
        }
        if (el < 520) {                                                   // the hook flies up in an arc
          var ft = easeIO((el - 160) / 360);
          var tipX = handX + (an4.x - handX) * ft, tipY = handY + (an4.y - handY) * ft - Math.sin(ft * Math.PI) * 40;
          showRope(handX, handY, tipX, tipY);
          parts.push({ x: tipX, y: tipY, vx: 0, vy: 0, life: 0, max: 90, col: Home.bot.accent, g: 0 });
          atFeet(W.x, W.y);
          cells = robotCells({ blink: blink, armR: 'reachUp', look: { x: 1, y: -1 } }, W.dir, false);
          if (el > 500 && !rgs.caught) { rgs.caught = true; puff(an4.x, an4.y, 6, '#FFD66B', 0.12, 0.02); }
          break;
        }
        var zt = clamp((el - 560) / 520, 0, 1), ze = zt * zt * (3 - 2 * zt);   // pulled up the rope
        var ringX = rgs.sx + (an4.x - rgs.sx) * ze, ringTop = (rgs.sy - hb4) + (ringY - (rgs.sy - hb4)) * ze;
        W.x = ringX; W.y = ringTop + hb4;
        showRope(an4.x, an4.y, ringX, ringTop);
        place.left = ringX - RC * S; place.top = ringTop - (TOPM + feet().top - 3) * S;
        place.rot = clamp((rgs.sx - an4.x) * 0.06 * (1 - ze), -18, 18);
        cells = robotCells({ blink: blink, armL: 'up', armR: 'up', step: 1 }, W.dir, false).concat(ring(false));
        if (zt >= 1) { W.rp = { ring: ringTop, sw: clamp(rgs.sx - an4.x, -40, 40) * 0.5, st: now }; setState('rope', now); }
        break;
      }

      case 'workline': {                                                // walking on the edge where Work starts
        var an3 = ropeAnchor(), onW = mouseActive(now);
        W.y = an3.bottom;
        if (an3.bottom - scrollY > innerHeight * 0.97) {                // scrolled back up: back on the rope
          W.rg = { sx: W.x, sy: W.y }; setState('regrab', now); cells = robotCells({ blink: blink }, W.dir, false); atFeet(W.x, W.y); break;
        }
        var pw = { blink: blink };
        if (!onW && (!W.wlT || now > W.wlT)) { W.wlX = 40 + Math.random() * (innerWidth - 80); W.wlT = now + 3500 + Math.random() * 3500; }
        var gxw = clamp(onW ? mouse.cx + scrollX : W.wlX, 30, innerWidth - 30), dxw = gxw - W.x, spw = (onW ? 0.2 : 0.07) * dt;
        if (Math.abs(dxw) > 3) { W.dir = dxw > 0 ? 1 : -1; W.x += clamp(dxw, -spw, spw); if (now - W.lastStep > 140) { W.step ^= 1; W.lastStep = now; } pw.step = W.step; }
        else if (onW && Math.abs(mouse.cy + scrollY - (W.y - 30)) < 50) pw.armR = 'wave';
        atFeet(W.x, W.y);
        cells = robotCells(pw, W.dir, false);
        break;
      }

      case 'intro': {                                      // waits for the name to rise, then comes out of a portal over the G
        cells = [];
        if (window.__robotBuilt && (window.__nameDone || el > 9000)) {   // once someone has built the robot
          var gx = gLetterX();
          if (gx != null) { W.x = gx; W.y = skyY(gx); }
          W.travel = { pi: 'sky' }; W.dir = 1; W.printDelay = 60; setState('print', now);
        }
        atFeet(W.x, W.y);
        break;
      }

      case 'print': {                                      // gone for a moment, then printed row by row where it goes
        var pg = landing(W.scene, W.travel && W.travel.pi), pd = W.printDelay || 120;
        W.x = pg.x; W.y = pg.y; atFeet(pg.x, pg.y);
        var pmode = W.scene.mode;
        var pform = pmode === 'lamp' ? lampCells(1.15, false, blink, false)
                  : pmode === 'drone' ? droneCells(now, 0.1, false)
                  : robotCells({ blink: blink }, W.dir, dark);
        var pa = Infinity, pb = -Infinity;
        pform.forEach(function (c) { if (c.y < pa) pa = c.y; if (c.y > pb) pb = c.y; });
        var prow = pa + Math.floor(clamp((el - pd) / 300, 0, 1) * (pb - pa + 1));
        cells = el < pd ? [] : pform.filter(function (c) { return c.y < prow; });
        if (el >= pd && el < pd + 300) {
          var pxs = pform.map(function (c) { return c.x; }), pxa = Math.min.apply(null, pxs), pxb = Math.max.apply(null, pxs);
          cells.push({ x: pxa + Math.floor(Math.random() * (pxb - pxa + 1)), y: prow, col: Home.bot.accent });
        }
        if (el > pd + 320) {
          W.landT = now; W.printDelay = 0;
          if (pmode === 'lamp') { W.parkLamp = false; W.lamp = { angle: 1.15, av: 0 }; setState('lamp', now); }
          else if (pmode === 'drone') { W.drone = { x: W.x - scrollX, v: 0, wob: 1 }; setState('drone', now); }
          else { arrive(now); if (W.scene.mode === 'hero') W.hello = now; }
        }
        break;
      }

      case 'portalout': {                                  // a portal opens behind it and it swirls in, as bits
        var po = W.po, ot = el;
        place.left = po.left; place.top = po.top;               // stays where it was on the page
        if (ot < 40) cells = po.cells;
        else {
          var tt = clamp((ot - 40) / 190, 0, 1);
          cells = swirl(po.cells, po.c, tt, true);
          if (Math.random() < 0.6) {
            var q2 = po.cells[Math.floor(Math.random() * po.cells.length)], px2 = place.left + q2.x * S, py2 = place.top + q2.y * S;
            var cxp = po.portal.x, cyp = po.portal.y;
            bit(px2, py2, (cxp - px2) / 260, (cyp - py2) / 260, 260);
          }
          if (tt >= 1 && po.portal.closeT == null) po.portal.closeT = now;
        }
        if (ot > 300) { W.pin = null; setState(W.transitTo ? 'transit' : 'portalin', now); }
        break;
      }

      case 'tricks': {
        var tk = W.tk, lyS = W.scene.section.getBoundingClientRect().bottom + scrollY, spotX = tricksX();
        W.y = lyS;
        grass.x = spotX + 70; grass.y = lyS;                    // wide enough for everywhere it runs during the tricks
        var pt2 = { blink: blink }, u = now - tk.trickT;
        var lookM = mouseActive(now) ? { x: Math.abs(mouse.cx + scrollX - W.x) > 30 ? (mouse.cx + scrollX > W.x ? 1 : -1) * W.dir : 0,
                                         y: Math.abs(mouse.cy + scrollY - (W.y - 40)) > 60 ? (mouse.cy + scrollY > W.y - 40 ? 1 : -1) : 0 } : null;
        if (tk.phase === 'wait') {                               // waits until its floor is on screen
          cells = []; W.x = scrollX - 30; atFeet(W.x, W.y);
          if (lyS < scrollY + innerHeight + 4) { tk.phase = 'run'; tk.t0 = now; }
          break;
        }
        if (tk.phase === 'run') {                                // runs in from the left, kicking up dust
          W.x += 0.5 * dt;
          if (now - W.lastStep > 80) { W.step ^= 1; W.lastStep = now; tuft(W.x, W.y); if (Math.random() < 0.6) puff(W.x - 10, W.y, 1, '#B9B2A6', 0.06, 0.03); }
          pt2.step = W.step; pt2.armL = W.step ? 'climb' : 'down'; pt2.armR = W.step ? 'down' : 'climb';
          if (W.x >= spotX - 10) { tk.phase = 'skid'; tk.t0 = now; }
          atFeet(W.x, W.y); cells = robotCells(pt2, 1, false); break;
        }
        if (tk.phase === 'skid') {                               // brakes, then the grass grows under it
          var sk = clamp((now - tk.t0) / 240, 0, 1);
          W.x += 0.25 * (1 - sk) * dt;
          if (Math.random() < 0.5) puff(W.x + 8, W.y, 1, '#B9B2A6', 0.08, 0.04);
          place.rot = -8 * (1 - sk);
          pt2.armL = 'up'; pt2.armR = 'reach';
          if (sk >= 1) { tk.phase = 'play'; tk.trickT = now; grass.target = 1; }
          atFeet(W.x, W.y); cells = robotCells(pt2, 1, false); break;
        }
        if (tk.phase === 'out') {                                // leaving: the toys burst, the grass goes down
          grass.target = 0;
          pt2.look = lookM;
          atFeet(W.x, W.y); cells = robotCells(pt2, W.dir, false);
          if (now - tk.t0 > (W.tempo === 'teleport' ? 120 : 300)) {
            var to2 = tk.to;
            if (to2.mode === 'lamp') {                           // back up to Coursework: through a portal
              W.prevState = 'tricks'; W.portalMode = true;
              W.parkLamp = false;                                 // Coursework is empty until it arrives
              portalExit(now, 'coursework');
            } else startTravel(to2, now);
          }
          break;
        }
        // play: one trick after another, in random order
        var name = TRICKS[tk.trick];
        if (u > TRICK_MS[name]) {                                // next trick: the old toy bursts
          if (tk.last) poofAt(tk.last.x, tk.last.y, 10);
          tk.trick = nextTrick(tk.trick); tk.trickT = now; u = 0; name = TRICKS[tk.trick]; tk.last = null; tk.sb = null; tk.tn = null; tk.caught = false;
        }
        var x0 = spotX, wall = tableX(), goalX = x0, pt3 = pt2;
        pt3.look = lookM;
        function walkTo(gx, speed) {                              // a few steps to the side, with the feet moving
          var d = gx - W.x;
          if (Math.abs(d) > 2) {
            W.x += clamp(d, -speed * dt, speed * dt);
            if (now - W.lastStep > (speed > 0.12 ? 95 : 130)) { W.step ^= 1; W.lastStep = now; tuft(W.x + (W.step ? 4 : -4), W.y); }
            pt3.step = W.step; return false;
          }
          return true;
        }
        function handAt(kind) {                                  // page position of the right hand for this pose
          var hc = R.hand(Home.bot, kind), hx = W.dir < 0 ? R.W - 1 - hc.x : hc.x;
          atFeet(W.x, W.y);
          return { x: place.left + (OX + hx + 0.5) * S, y: place.top + (TOPM + hc.y + 0.5) * S };
        }
        var footY = W.y - 3 * S;
        if (name === 'soccer') {
          // keepie-uppie with real gravity: feet, knee and head, running under the ball
          var G2 = 0.0016, headY = W.y - 18 * S, kneeY = W.y - 6 * S;
          if (!tk.sb) tk.sb = { x: W.x + 6, y: footY, vx: 0, vy: -Math.sqrt(2 * G2 * 70), next: 'foot', t: now };
          var sb = tk.sb;
          sb.vy += G2 * dt; sb.x += sb.vx * dt; sb.y += sb.vy * dt;
          var touchY = sb.next === 'head' ? headY : sb.next === 'knee' ? kneeY : footY;
          // where will it come down? the robot goes there
          var tFall = (-sb.vy + Math.sqrt(Math.max(0, sb.vy * sb.vy + 2 * G2 * (touchY - sb.y)))) / G2;
          var landX = sb.x + sb.vx * tFall;
          var offX = sb.next === 'head' ? 0 : sb.next === 'knee' ? 5 : (sb.foot ? 7 : -7);
          walkTo(landX - offX, 0.24);
          pt3.look = { x: 0, y: sb.y < W.y - 22 * S ? -1 : sb.y > W.y - 8 * S ? 1 : 0 };
          if (sb.next === 'head' && sb.y > W.y - 34 * S) pt3.look = { x: 0, y: -1 };
          if (sb.vy > 0 && sb.y >= touchY) {                    // the touch
            sb.y = touchY;
            var r3 = Math.random(), h = 60 + Math.random() * 60;
            if (sb.next === 'head') { W.hop = now; h += 20; }
            if (sb.next === 'foot') { sb.foot = !sb.foot; tuft(W.x + (sb.foot ? 6 : -6), W.y); }
            tk.touch = { kind: sb.next, t: now };
            sb.next = r3 < 0.5 ? 'foot' : r3 < 0.75 ? 'knee' : 'head';
            var up = Math.sqrt(2 * G2 * (h + (sb.next === 'head' ? 0 : 0)));
            var air = 2 * up / G2, target = x0 + (Math.random() - 0.5) * 140;
            sb.vy = -up; sb.vx = clamp((target - sb.x) / air, -0.14, 0.14);
          }
          if (tk.touch && now - tk.touch.t < 140) {
            if (tk.touch.kind === 'foot') pt3.step = 1;
            if (tk.touch.kind === 'knee') { pt3.step = 1; pt3.armL = 'up'; }
            if (tk.touch.kind === 'head') { pt3.armL = 'reach'; pt3.armR = 'reach'; }
          }
          W.dir = sb.x >= W.x ? 1 : -1;
          propDraw.push({ x: sb.x, y: sb.y - 2 * S, cells: BALL }); tk.last = { x: sb.x, y: sb.y };
        } else if (name === 'tennis') {
          // it walks up to the table and plays against the row numbers, which flash when hit
          if (!tk.tn) tk.tn = { x: wall - 150, k: -1 };
          var tn = tk.tn;
          W.dir = 1;
          var there = walkTo(tn.x + Math.sin(u / 1300) * 10, 0.18);
          var hk = 'reach';
          var per3 = 1200, k7 = (u % per3) / per3, rally = Math.floor(u / per3);
          if (rally !== tn.k) {                                   // a new shot: pick a number to aim at
            tn.k = rally;
            var vis = rowNums.slice(3, 5).filter(function (n) { var r = n.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 20; });
            tn.el = vis.length ? vis[Math.floor(Math.random() * vis.length)] : null;
            tn.hit = false;
          }
          if (k7 < 0.08 || k7 > 0.95) hk = 'reachUp';           // the swing
          pt3.armR = hk;
          var hp = handAt(hk);
          propDraw.push({ x: hp.x, y: hp.y, cells: RACKET });
          var headX2 = hp.x, headY2 = hp.y - 5 * S;
          var aim = { x: wall, y: headY2 - 40 };
          if (tn.el) { var rb = tn.el.getBoundingClientRect(); aim = { x: rb.left + rb.width / 2 + scrollX, y: rb.top + rb.height / 2 + scrollY }; }
          if (!there) aim = null;                                 // still walking up: the ball stays on the racket
          var tbx, tby;
          if (!aim) { tbx = headX2; tby = headY2 - 6; }
          else {
            var go = k7 < 0.5, f2 = go ? k7 * 2 : (1 - k7) * 2;
            tbx = headX2 + (aim.x - headX2) * f2;
            tby = headY2 + (aim.y - headY2) * f2 - Math.sin(f2 * Math.PI) * 26;
            if (!go && !tn.hit && tn.el) {                        // it hit the number
              tn.hit = true; puff(aim.x, aim.y, 5, '#C9E04A', 0.08, 0.02);
              var el2 = tn.el; el2.classList.add('hit'); setTimeout(function () { el2.classList.remove('hit'); }, 260);
            }
          }
          propDraw.push({ x: tbx, y: tby, cells: TBALL }); tk.last = { x: tbx, y: tby };
        } else if (name === 'football') {
          // walks to the left, throws long off the screen to the left, then runs right with its arms up,
          // waving ("I'm open!") before the pass appears; it comes from the left, over its head
          var spin = Math.floor(now / 80) % 2 ? FOOT_H : FOOT_V, fb2 = null;
          var offL = scrollX - 120, throwX = Math.max(scrollX + 60, x0 - 130), catchX = Math.min(x0 + 200, scrollX + innerWidth * 0.42);
          var hold = function () { var hh = handAt('climb'); return { x: hh.x - (W.dir > 0 ? 6 : -6), y: hh.y, c: FOOT_H }; };
          if (u < 1100) {                                         // ball in hands, walking over to the left
            W.dir = -1; pt3.armL = 'climb'; pt3.armR = 'climb'; fb2 = hold();
            if (!walkTo(throwX, 0.14) && u > 900) { tk.trickT += dt; u = now - tk.trickT; }   // not there yet: the throw waits
          }
          else if (u < 1600) { W.dir = -1; pt3.armR = 'up'; var h1 = handAt('up'); fb2 = { x: h1.x, y: h1.y - 6, c: FOOT_H }; }
          else if (u < 2600) {                                    // a long, high throw
            W.dir = -1; var t3 = (u - 1600) / 1000, h2 = handAt('down');
            fb2 = { x: h2.x + (offL - h2.x) * t3, y: h2.y - 40 - Math.sin(t3 * Math.PI * 0.9) * 230, c: spin };
            pt3.look = { x: 1, y: -1 }; pt3.armR = t3 < 0.2 ? 'reach' : 'down';
          }
          else if (u < 3200) { W.dir = -1; pt3.look = { x: 1, y: 0 }; walkTo(throwX + Math.sin(u / 380) * 6, 0.05); }
          else if (u < 5100) {
            W.dir = 1;
            walkTo(catchX, 0.17);
            pt3.look = { x: -1, y: -1 };                          // looking back for the ball
            var wv = Math.floor(u / 180) % 2;
            pt3.armL = 'up'; pt3.armR = u < 4400 ? (wv ? 'wave' : 'up') : 'up';   // "I'm open!"
            if (u > 3650) {
              var t4 = clamp((u - 3650) / 1450, 0, 1), cy2 = W.y - 18 * S;
              fb2 = { x: offL + (catchX - offL) * t4, y: cy2 - Math.sin(t4 * Math.PI) * 200, c: spin };
            }
          } else {
            if (!tk.caught) { tk.caught = true; tk.catchT = now; W.hop = now; fireworks(W.x, W.y - 26 * S, now); }
            var cel = now - tk.catchT;
            if (cel < 1400) {                                     // touchdown: ball up high, two jumps, fireworks
              if (cel > 600 && !tk.hop2) { tk.hop2 = true; W.hop = now; }
              pt3.armL = 'up'; pt3.armR = 'up';
              var hu = handAt('up'); fb2 = { x: hu.x - 4, y: hu.y - 8, c: Math.floor(now / 120) % 2 ? FOOT_H : FOOT_V };
            } else {                                              // the celebration is the end of this trick
              tk.trickT = now - TRICK_MS.football - 1;
              pt3.armL = 'climb'; pt3.armR = 'climb';
              fb2 = hold();
            }
          }
          if (u < 5100) { tk.caught = false; tk.hop2 = false; }
          if (fb2) { propDraw.push({ x: fb2.x, y: fb2.y, cells: fb2.c }); tk.last = { x: fb2.x, y: fb2.y }; }
        } else {
          // the drone comes in from close to the screen on the left (big), circles, and leaves the same way
          pt3.armL = 'climb'; pt3.armR = 'climb';
          var hc2 = handAt('climb');
          propDraw.push({ x: W.x, y: hc2.y + 2, cells: PAD });
          var gate = { x: scrollX + 60, y: scrollY + innerHeight * 0.55 };
          var orbitX = x0 + Math.sin(u / 900) * 110, orbitY = W.y - 100 + Math.sin(u / 450) * 26, sc2, dx3, dy3, al = 1;
          if (u < 1700) { var e5 = 1 - Math.pow(1 - u / 1700, 3); sc2 = 4 - 3 * e5; dx3 = gate.x + (orbitX - gate.x) * e5; dy3 = gate.y + (orbitY - gate.y) * e5; }
          else if (u < 5700) { sc2 = 1; dx3 = orbitX; dy3 = orbitY; }
          else { var e6 = Math.pow((u - 5700) / 1800, 2); sc2 = 1 + 3 * e6; dx3 = orbitX + (gate.x - orbitX) * e6; dy3 = orbitY + (gate.y - orbitY) * e6; al = e6 > 0.7 ? 1 - (e6 - 0.7) / 0.3 : 1; }
          walkTo(dx3 + (dx3 > W.x ? -50 : 50), 0.07);            // it follows the drone around
          propDraw.push({ x: dx3, y: dy3, cells: miniDrone(now), scale: sc2, alpha: al }); tk.last = { x: dx3, y: dy3 };
          W.dir = dx3 > W.x ? 1 : -1;
          pt3.look = { x: 1, y: dy3 < W.y - 60 ? -1 : 0 };
          if (sc2 < 2.2 && al > 0.3) rays(W.x, W.y - 17 * S, dx3, dy3, now);   // it is flying it
        }
        var hy4 = 0;
        if (W.hop >= 0) { var hh4 = (now - W.hop) / 320; if (hh4 >= 1) W.hop = -1; else hy4 = -Math.sin(hh4 * Math.PI) * 8; }
        atFeet(W.x, W.y + hy4);
        cells = robotCells(pt3, W.dir, false);
        break;
      }

      case 'transit': {                                    // between two portals; comes out where it should be
        cells = [];
        var tsc = sceneNow(), origin = W.scene;
        if (tsc.id === W.transitTo) {
          var lp2 = landing(tsc), vy2 = lp2.y - scrollY;
          if (vy2 > 90 && vy2 < innerHeight - 20) { W.scene = tsc; W.travel = null; W.pin = null; setState('portalin', now); }   // only when its place can be seen
        }
        else if (tsc === origin) {
          var back = origin.mode === 'drone' ? origin.section.getBoundingClientRect().bottom > innerHeight + 100 || scrollDir < 0
                                             : origin.section.getBoundingClientRect().top < innerHeight * 0.35 || scrollDir > 0;
          if (now - lastScrollT > 450) back = true;              // the page stopped short of the goal: come back out
          if (back && now - W.t0 > 250) { W.travel = null; W.pin = null; setState('portalin', now); }   // changed its mind: back where it was
        } else { W.scene = tsc; W.travel = null; W.printDelay = 60; setState('print', now); }          // jumped somewhere else
        break;
      }

      case 'portalin': {                                   // another portal opens where it goes; the bits swirl out and build its shape
        var bg2 = landing(W.scene, W.travel && W.travel.pi);
        W.x = bg2.x; W.y = bg2.y; atFeet(bg2.x, bg2.y);
        var mode = W.scene.mode;
        var form = mode === 'lamp' ? lampCells(1.15, false, blink, false)
                 : mode === 'drone' ? droneCells(now, 0.1, false)
                 : robotCells({ blink: blink }, W.dir, dark);
        var fc = formCentre(form);
        if (!W.pin) { W.pin = openPortal(place.left + fc.x * S, place.top + fc.y * S, Math.max(24, fc.r * S * 0.75)); if (mode === 'lamp') W.parkLamp = false; }
        W.pin.x = place.left + fc.x * S; W.pin.y = place.top + fc.y * S;
        if (el < 180) cells = [];
        else {
          var ti = clamp((el - 180) / 460, 0, 1);
          cells = swirl(form, fc, ti, false);
          if (ti < 0.8 && Math.random() < 0.6) {
            var a2 = Math.random() * Math.PI * 2, sp3 = 0.06 + Math.random() * 0.08;
            bit(W.pin.x, W.pin.y, Math.cos(a2) * sp3, Math.sin(a2) * sp3, 360);
          }
          if (ti >= 1 && W.pin.closeT == null) W.pin.closeT = now;
        }
        if (el > 820) {
          W.landT = now; W.pin = null;
          if (mode === 'lamp') { W.parkLamp = false; W.lamp = { angle: 1.15, av: 0 }; setState('lamp', now); }
          else if (mode === 'drone') { W.drone = { x: W.x - scrollX, v: 0, wob: 1 }; setState('drone', now); }
          else { arrive(now); if (W.scene.mode === 'hero') W.hello = now; }
        }
        break;
      }

      case 'ride': {                                       // standing on the edge of the section that slides in
        var rd = W.ride, rr = rd.sc.section.getBoundingClientRect();
        var edgeY = Math.max(rr.top, 130) + scrollY;          // never carried off the top of the screen
        if (rd.sx == null) { rd.sx = W.x; rd.sy = W.y; rd.x = clamp(W.x, 80, innerWidth - 80); }
        var jt = clamp((now - W.t0) / 420, 0, 1), rx2, ry2;
        rx2 = rd.sx + (rd.x - rd.sx) * easeIO(jt);
        ry2 = rd.sy + (edgeY - rd.sy) * easeIO(jt) - Math.sin(jt * Math.PI) * 46;
        W.x = rx2; W.y = ry2;
        atFeet(rx2, ry2);
        var surf = Math.floor(now / 280) % 2;
        cells = robotCells({ blink: blink, step: jt < 1 ? 1 : 0,
                             armL: jt < 1 ? 'up' : (surf ? 'up' : 'reach'), armR: jt < 1 ? 'up' : (surf ? 'reach' : 'up') }, W.dir, false);
        if (jt >= 1 && now - W.landT > 400 && rr.top < innerHeight - 4) {
          if (!rd.landed) { rd.landed = true; W.landT = now; puff(rx2, ry2, 6, '#B9B2A6', 0.12, 0.03); }
        }
        var settled = rr.top <= innerHeight * 0.35 || (now - lastScrollT > 500 && rr.top < innerHeight * 0.5);
        var gone = rr.top > innerHeight * 0.97 || rr.bottom < 0;
        if (jt >= 1 && (settled || gone)) { W.ride = null; startTravel(sceneNow(), now); }
        break;
      }

      case 'free': {
        var active = mouseActive(now), tx;
        if (active) tx = mouse.cx + scrollX;
        else {
          if (!W.wanderUntil || now > W.wanderUntil) { W.wanderX = 40 + Math.random() * (innerWidth - 80); W.wanderUntil = now + 3000 + Math.random() * 4000; }
          tx = W.wanderX;
        }
        W.y = floorY();
        var near = active && Math.abs(tx - W.x) < 30 && Math.abs(mouse.cy + scrollY - (W.y - 30)) < 50;
        var dx = tx - W.x, moving = !near && Math.abs(dx) > 8;
        if (moving) { W.dir = dx > 0 ? 1 : -1; W.x += W.dir * (active ? 0.2 : 0.07) * dt; W.idleT = now; }
        if (moving && now - W.lastStep > 150) { W.step ^= 1; W.lastStep = now; }
        if (!moving) W.step = 0;
        W.x = clamp(W.x, 30, innerWidth - 30);
        var hy = 0;
        if (W.hop >= 0) { var ht = (now - W.hop) / 420; if (ht >= 1) W.hop = -1; else hy = -Math.sin(ht * Math.PI) * 14; }
        var pose = { step: W.step, blink: blink, armR: near ? 'wave' : 'down' };
        if (!moving && !near && now - W.idleT > 2600) {   // idle gestures
          if (!W.gesture || now > W.gesture.until) W.gesture = { kind: ['look', 'scratch', 'stretch', 'none'][Math.floor(Math.random() * 4)], t0: now, until: now + 1800 };
          var gt = now - W.gesture.t0;
          if (W.gesture.kind === 'look') pose.look = { x: gt < 900 ? -1 : 1, y: 0 };
          if (W.gesture.kind === 'scratch') pose.armR = Math.floor(gt / 160) % 2 ? 'climb' : 'up';
          if (W.gesture.kind === 'stretch') { pose.armL = 'up'; pose.armR = 'up'; }
        }
        if (mouse.speed > 3 && now - mouse.t < 120 && W.hop < 0) W.hop = now;    // startled
        atFeet(W.x, W.y + hy);
        cells = robotCells(pose, W.dir, false);
        break;
      }

      case 'drone': {
        // the cards are done and Work starts to leave: into the portal now, while it can still be seen
        var wr = W.scene.section.getBoundingClientRect();
        if (scrollDir > 0 && now - lastScrollT < 400 && wr.bottom < innerHeight - 30) {
          cells = droneCells(now, 0.1, false); W.prevState = 'drone'; portalExit(now, 'coursework'); break;
        }
        var D = W.drone, spot = droneSpot(W.scene);
        var tx2 = spot.x;
        // spring with a little overshoot: it leans into the move and settles when the scroll stops
        var acc = 0.00005 * (tx2 - D.x) - 0.011 * D.v;
        D.v += acc * dt; D.x += D.v * dt;
        var still = Math.abs(D.v) < 0.02;
        D.wob = still ? D.wob * 0.96 : Math.min(1, D.wob + 0.05);
        if (D.yo) { D.vy += (-0.00005 * D.yo - 0.011 * D.vy) * dt; D.yo += D.vy * dt; if (Math.abs(D.yo) < 0.3 && Math.abs(D.vy) < 0.01) D.yo = 0; }
        var cyv = spot.y + (D.yo || 0) + Math.sin(now / 380) * (1.2 + 2.5 * D.wob);
        W.x = D.x + scrollX; W.y = cyv + scrollY + 9 * S;
        place.left = D.x + scrollX - RC * S; place.top = cyv + scrollY - 12 * S;
        place.rot = clamp(D.v * 55, -16, 16);
        cells = droneCells(now, Math.abs(D.v), false);
        if (!still && Math.random() < 0.25) parts.push({ x: W.x - W.dir * 20, y: cyv + scrollY + 14, vx: -D.v * 0.3, vy: 0.03, life: 0, max: 300, col: '#C8C2B8', g: 0 });
        break;
      }

      case 'lamp': {
        // scrolling back up and Coursework starts to go down: into the portal, back to Work
        var crr = W.scene.section.getBoundingClientRect();
        if (scrollDir < 0 && now - lastScrollT < 400 && crr.top > innerHeight * 0.5) {
          cells = lampCells(W.lamp.angle, false, false, false); W.prevState = 'lamp'; portalExit(now, 'work'); break;
        }
        var Lm = W.lamp, lt2 = landing(W.scene);
        atFeet(lt2.x, lt2.y); W.x = lt2.x; W.y = lt2.y;
        var row = rowForMouse();
        var goal = 1.15;                                    // resting: shade down, light off
        lightCone = null;
        if (row) {
          var b2 = row.getBoundingClientRect();
          var piv = { x: place.left - scrollX + (LAMP_PIVOT.x + 0.5) * S, y: place.top - scrollY + (LAMP_PIVOT.y + 0.5) * S };
          var aim = { x: b2.left + Math.min(220, b2.width * 0.3), y: b2.top + b2.height / 2 };
          goal = clamp(Math.atan2(aim.y - piv.y, aim.x - piv.x), -0.35, 1.3);
        }
        Lm.av += ((goal - Lm.angle) * 0.0009 - Lm.av * 0.018) * dt;   // springy neck
        Lm.angle += Lm.av * dt;
        var lit = !!row && Math.abs(goal - Lm.angle) < 0.25;
        if (row !== litRow) { clearLit(); if (row && lit) { litRow = row; row.classList.add('lit'); } }
        if (lit) {
          var mo = lampMouth(Lm.angle), b3 = row.getBoundingClientRect();
          var L0 = place.left - scrollX, T0 = place.top - scrollY;
          lightCone = { a: { x: L0 + mo.a.x * S, y: T0 + mo.a.y * S }, b: { x: L0 + mo.b.x * S, y: T0 + mo.b.y * S },
                        m: { x: L0 + mo.c.x * S, y: T0 + mo.c.y * S },
                        r: { x: b3.left - 8, y: b3.top + 4, w: b3.width + 16, h: b3.height - 8 } };
        }
        cells = lampCells(Lm.angle, lit, blink, false);
        break;
      }

      case 'hookgrab': {                                    // drops onto the rope and catches it
        var hk = landing(W.scene), g2 = clamp(el / 320, 0, 1);
        var drop = 34 * g2 * g2;
        atFeet(hk.ax, hk.y + drop);
        W.x = hk.ax; W.y = hk.y + drop;
        showRope(hk.ax, hk.ay, hk.ax, hk.y + drop - (R.H - (feet().top - 3)) * S);
        cells = robotCells({ blink: blink, armL: 'up', armR: 'up', step: 1 }, W.dir, dark).concat(ring(dark));
        if (el > 320) { W.hook = { t0: now }; setState('hook', now); }
        break;
      }
      case 'hook': {
        var h2 = landing(W.scene), since = now - W.hook.t0;
        var amp = 4 + 18 * Math.exp(-since / 1300);         // big swing that settles
        var sw = Math.sin(since / 520) * amp;
        var ringY = h2.y + 34 - (R.H - (feet().top - 3)) * S;   // top of the ring
        var len = ringY - h2.ay;
        var ang = Math.asin(clamp(sw / len, -0.5, 0.5));
        var rx = h2.ax + Math.sin(ang) * len, ry = h2.ay + Math.cos(ang) * len;
        place.left = rx - RC * S; place.top = ry - (TOPM + feet().top - 3) * S;
        place.rot = -ang * 180 / Math.PI * 0.6;
        W.x = rx; W.y = ry + (R.H - (feet().top - 3)) * S;
        showRope(h2.ax, h2.ay, rx, ry);
        // it points at the row of the table that sits at the height of the cursor
        var row = skillRowAt(mouse.cy), armR = 'down', look = null;
        if (row && since > 900) {
          var rb = row.getBoundingClientRect(), hand = ry - scrollY + (R.H - (feet().top - 3) - 7) * S;
          var dyr = (rb.top + rb.height / 2) - hand;
          W.dir = 1;                                         // the table is to its right
          armR = dyr < -45 ? 'reachUp' : dyr > 45 ? 'reachDown' : 'reach';
          look = { x: 1, y: dyr < -45 ? -1 : dyr > 45 ? 1 : 0 };
        } else if (mouseActive(now) && Math.abs(mouse.cx + scrollX - rx) > 40) W.dir = mouse.cx + scrollX > rx ? 1 : -1;
        cells = robotCells({ blink: blink, look: look, armL: since < 900 ? 'up' : 'down', armR: armR }, W.dir, dark).concat(ring(dark));
        break;
      }

      case 'show': {
        var sh = landing(W.scene);
        W.x = sh.x; W.y = sh.y;
        if (overEmail() && now > (W.planeCool || 0)) { startMorph(robotCells({}, 1, true), function () { return planeCells(true); }, now, function (n) { W.plane = { t0: n }; setState('plane', n); }); cells = robotCells({}, 1, true); atFeet(sh.x, sh.y); break; }
        if (now - W.actT > 2600) { W.act = (W.act + 1) % ACTS.length; W.actT = now; }
        var a = ACTS[W.act], u = now - W.actT, ps = { blink: blink }, px = sh.x, py = sh.y, sit = false;
        if (a === 'wave') ps.armR = Math.floor(u / 320) % 2 ? 'wave' : 'up';
        if (a === 'dance') { var bt = Math.floor(u / 300) % 2; ps.armL = bt ? 'up' : 'down'; ps.armR = bt ? 'down' : 'up'; ps.step = bt; px += bt ? 3 : -3; }
        if (a === 'hop') { py -= Math.abs(Math.sin(u / 2600 * Math.PI * 3)) * 18; ps.armL = ps.armR = 'up'; }
        if (a === 'spin') W.dir = Math.floor(u / 200) % 2 ? 1 : -1; else W.dir = 1;
        if (a === 'look') ps.look = { x: Math.floor(u / 800) % 2 ? 1 : -1, y: 0 };
        if (a === 'sit') sit = true;
        atFeet(px, py);
        if (sit) { place.top = py - (TOPM + SEAT) * S + (u < 160 ? -6 : u < 260 ? 2 : 0); }
        cells = robotCells(ps, W.dir, true);
        break;
      }
      case 'plane': {                                       // a loop over the address, then back
        var pt = (now - W.plane.t0) / 1800, sh2 = landing(W.scene);
        var r0 = 46, ax2 = sh2.x + Math.sin(pt * Math.PI * 2) * r0 * 1.6, ay2 = sh2.y - 30 - (1 - Math.cos(pt * Math.PI * 2)) * r0 * 0.6;
        atFeet(ax2, ay2);
        place.rot = Math.cos(pt * Math.PI * 2) * 25;
        cells = planeCells(true);
        if (Math.random() < 0.3) parts.push({ x: ax2, y: ay2 - 20, vx: 0, vy: 0, life: 0, max: 500, col: '#8A8A8A', g: 0 });
        if (pt >= 1) startMorph(planeCells(true), function () { return robotCells({}, 1, true); }, now, function (n) { setState('show', n); W.actT = n; W.planeCool = n + 5000; });
        break;
      }
    }

    if (W.state !== 'hook' && W.state !== 'hookgrab' && W.state !== 'rope' && W.state !== 'regrab') rope.style.opacity = 0;
    paint(cells, null);                                     // no outline: it may blend with dark letters (MA prefers it)
    commit();
    drawFx(now, dt);
  }

  function startRide(sc, now) {
    W.rodeLast = sc;
    rope.style.opacity = 0; lightCone = null; clearLit();
    var go = function (n) { W.ride = { sc: sc }; setState('ride', n); };
    if (W.state === 'drone' || W.state === 'lamp') {
      var from = W.state === 'drone' ? droneCells(now, 0, false) : lampCells(W.lamp.angle, false, false, false);
      startMorph(from, function () { return robotCells({}, 1, false); }, now, go);
    } else go(now);
  }

  // walk along the letters towards tx; small steps are taken in stride, bigger ones start a hop or a climb
  function skyWalk(tx, speed, pz) {
    var hz = W.h, dx = tx - W.x;
    if (Math.abs(dx) < 2) { W.y = skyY(W.x); pz.step = 0; return 'there'; }
    var dir = dx > 0 ? 1 : -1, stepPx = Math.min(Math.abs(dx), speed, 3), nx = W.x + dir * stepPx, ny = skyY(nx);
    W.dir = dir;
    if (ny === Infinity) { pz.step = 0; return 'edge'; }
    var dy = ny - W.y;
    if (Math.abs(dy) <= 12) { W.x = nx; W.y = ny; if (performance.now() - W.lastStep > 140) { W.step ^= 1; W.lastStep = performance.now(); } pz.step = W.step; hz.idleT = performance.now(); return 'walk'; }
    var now = performance.now();
    if (dy > 0) {                                            // the letters drop away under the feet
      var outX = nx + dir * (FOOT_HALF + 6), lowY = skyY(outX);
      if (lowY === Infinity) return 'edge';
      var drop = lowY - W.y;
      hz.act = { type: 'skyhop', t0: now, sx: W.x, sy: W.y, x: outX + (drop > 40 ? dir * 6 : 0), dur: drop > 40 ? 300 + drop * 1.4 : 260, arc: drop > 40 ? 18 : 10 };
      return 'busy';
    }
    var up = -dy;                                            // a wall rises in front
    if (up <= 40) { hz.act = { type: 'skyhop', t0: now, sx: W.x, sy: W.y, x: nx + dir * 4, dur: 240, arc: 14 }; return 'busy'; }
    hz.act = { type: 'wall', down: false, t0: now, x: W.x, y1: ny, xTop: nx + dir * (FOOT_HALF + 2), face: dir };
    return 'busy';
  }
  function reachTo(mx, my, pz) {
    W.dir = mx > W.x ? 1 : -1;
    var dyh = my - (W.y - 30);
    pz.armR = dyh < -50 ? 'reachUp' : dyh > 50 ? 'reachDown' : 'reach';
    pz.look = { x: 1, y: dyh < -50 ? -1 : dyh > 50 ? 1 : 0 };
  }
  function idleOrWave(now, on, mx, my, pz, hz) {
    if (on && Math.abs(mx - W.x) < 26 && Math.abs(my - (W.y - 28)) < 40) { pz.armR = 'wave'; return; }
    if (on || now - (hz.idleT || 0) < 2600) return;
    if (!W.gesture || now > W.gesture.until) W.gesture = { kind: ['look', 'scratch', 'stretch', 'none'][Math.floor(Math.random() * 4)], t0: now, until: now + 1800 };
    var gt = now - W.gesture.t0;
    if (W.gesture.kind === 'look') pz.look = { x: gt < 900 ? -1 : 1, y: 0 };
    if (W.gesture.kind === 'scratch') pz.armR = Math.floor(gt / 160) % 2 ? 'climb' : 'up';
    if (W.gesture.kind === 'stretch') { pz.armL = 'up'; pz.armR = 'up'; }
  }


  /* ---------------------------------------------------------------- Skills: tricks on the floor (decision SH28)
     It runs in from the left onto the edge between Coursework and Skills, a small patch of grass
     grows under it, and it goes through a few tricks tied to the projects. Its eyes follow the
     cursor. When it leaves, the toys burst into pixels and the grass goes back down. */
  var propDraw = [];
  function sprite(rows, map) {                                // ascii rows -> cells centred on the sprite
    var out = [], h = rows.length, w = rows[0].length;
    rows.forEach(function (r, y) { for (var x = 0; x < w; x++) { var col = map[r[x]]; if (col) out.push({ x: x - w / 2, y: y - h / 2, col: col }); } });
    return out;
  }
  var INK = '#1A1A1A', WHITE = '#FFFFFF';
  var BALL = sprite(['.kkk.', 'kwkwk', 'kkwkk', 'kwkwk', '.kkk.'], { k: INK, w: WHITE });
  var FOOT_H = sprite(['.bbbb.', 'bbwwbb', 'bbbbbb', '.bbbb.'], { b: '#8B4A2B', w: WHITE });
  var FOOT_V = sprite(['.bb.', 'bbbb', 'bwbb', 'bwbb', 'bbbb', '.bb.'], { b: '#8B4A2B', w: WHITE });
  var TBALL = sprite(['yy', 'yy'], { y: '#C9E04A' });
  var RACKET = sprite(['.kkk.', 'klllk', 'klllk', 'klllk', '.kkk.', '..k..', '..k..', '..k..'], { k: INK, l: '#D9D4CA' })
    .map(function (c) { return { x: c.x, y: c.y - 3.5, col: c.col }; });   // the bottom of the handle sits on (0,0)
  function rays(x0, y0, x1, y1, now) {                        // radio waves from the robot towards what it is flying
    var ang = Math.atan2(y1 - y0, x1 - x0), out = [];
    for (var w = 0; w < 3; w++) {
      var r = ((now / 9 + w * 14) % 42) + 6;
      for (var a = -0.45; a <= 0.45; a += 0.15) out.push({ x: Math.round(Math.cos(ang + a) * r / S), y: Math.round(Math.sin(ang + a) * r / S), col: w % 2 ? '#FFD66B' : Home.bot.accent });
    }
    propDraw.push({ x: x0, y: y0, cells: out });
  }
  var PAD = sprite(['kkkkk', 'kakek', 'kkkkk'], { k: INK, a: '#C0522A', e: '#FFD66B' });
  function miniDrone(now) {
    var f = Math.floor(now / 40) % 2, bl = f ? '#8A8A8A' : INK;
    return sprite([f ? '.bb.....bb.' : 'bbb.....bbb', '..k.....k..', '.kkkkkkkkk.', '...kkakk...', '....k.k....'],
                  { b: bl, k: INK, a: Home.bot.accent });
  }
  function tricksX() { return scrollX + Math.min(Math.max(innerWidth * 0.2, 170), 330); }
  // grass only where it steps: small tufts spring up under its feet and fade
  var tufts = [];
  var grass = { x: 0, y: 0, g: 0, target: 0 };               // kept for the scene logic; the floor itself has no grass
  function tuft(x, y) {
    return;                                                  // MA preferred it without grass
    if (tufts.length > 60) tufts.shift();
    for (var i = -1; i <= 1; i++) tufts.push({ x: x + i * S + (Math.random() - 0.5) * 4, y: y, t0: performance.now(),
      h: 1 + Math.floor(Math.random() * 3), c: Math.random() < 0.4 ? '#5DA66E' : '#3C8D5A' });
  }
  function drawGrass(now) {
    tufts = tufts.filter(function (t) { return now - t.t0 < 900; });
    tufts.forEach(function (t) {
      var a = now - t.t0, grow = Math.min(1, a / 140), h = Math.max(1, Math.round(t.h * grow));
      fctx.globalAlpha = a < 500 ? 1 : 1 - (a - 500) / 400;
      fctx.fillStyle = t.c;
      for (var k = 0; k < h; k++) fctx.fillRect(Math.round(t.x - scrollX + (k === h - 1 && Math.sin(now / 200 + t.x) > 0 ? 1 : 0)), Math.round(t.y - scrollY - (k + 1) * S), S, S);
    });
    fctx.globalAlpha = 1;
  }
  function poofAt(x, y, n) { for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 0.2, vy: -Math.random() * 0.16, life: 0, max: 360, col: Math.random() < 0.5 ? Home.bot.accent : '#FFD66B', g: 0.0004 }); }

  // the lamp stays parked on the k (light off) while the robot is elsewhere
  var courseScene = null;
  function drawParkedLamp() {
    if (!W.parkLamp || W.state === 'lamp') return;
    if (!courseScene) courseScene = SCENES.filter(function (q) { return q.id === 'coursework'; })[0];
    var lp = landing(courseScene), lft = lp.x - RC * S, tp = lp.y - FOOT * S;
    if (tp - scrollY > innerHeight + 20 || tp - scrollY < -120) return;
    lampCells(1.15, false, false, false).forEach(function (c) {
      fctx.fillStyle = c.col; fctx.fillRect(Math.round(lft - scrollX + c.x * S), Math.round(tp - scrollY + c.y * S), S, S);
    });
  }
  function enterTricks(now, sc, fromLeft) {
    W.scene = sc;
    var lx = landing(sc);
    W.y = lx.y; W.dir = 1;
    W.x = fromLeft ? scrollX - 30 : lx.x;
    W.tk = { phase: fromLeft ? 'wait' : 'play', t0: now, trick: Math.floor(Math.random() * TRICKS.length), trickT: now, last: null };
    grass.target = fromLeft ? 0 : 1;
    setState('tricks', now);
  }
  // pixel fireworks: a ring of sparks that bursts, slows and falls
  function fireworks(x, y, now) {
    var cols = ['#FFD66B', Home.bot.accent, '#2D6AA8', '#C0522A', '#3C8D5A', '#8A4FA0'];
    var spots = [[0, 0, 0], [-46, -26, 220], [44, -40, 440]];   // three bursts, one after another
    spots.forEach(function (sp) {
      setTimeout(function () {
        var cx = x + sp[0], cy = y + sp[1], n = 30;
        for (var i = 0; i < n; i++) {
          var a = i / n * Math.PI * 2 + Math.random() * 0.2, v = 0.16 + Math.random() * 0.08;
          parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 820 + Math.random() * 260,
                       col: cols[Math.floor(Math.random() * cols.length)], g: 0.0003 });
        }
        for (var j = 0; j < 8; j++) parts.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, life: 0, max: 380, col: '#FFFFFF', g: 0 });
      }, sp[2]);
    });
  }
  var TRICKS = ['soccer', 'football', 'tennis', 'drone'];
  var TRICK_MS = { soccer: 7600, football: 9200, tennis: 7000, drone: 7600 };
  var rowNums = Array.prototype.slice.call(document.querySelectorAll('#skills .row-i'));
  function nextTrick(i) { var j; do { j = Math.floor(Math.random() * TRICKS.length); } while (j === i); return j; }
  var skillsRows = document.querySelector('#skills .rows');
  function tableX() { return (skillsRows ? skillsRows.getBoundingClientRect().left : innerWidth * 0.45) + scrollX - 6; }

  function arrive(now) {
    var sc = W.scene;
    if (sc.mode === 'drone') {
      W.drone = { x: W.x - scrollX, v: 0, wob: 1 };
      startMorph(robotCells({}, 1, false), function (n) { return droneCells(n, 0.1, false); }, now, function (n) { setState('drone', n); });
    } else if (sc.mode === 'lamp') {
      W.lamp = { angle: 1.15, av: 0 };
      startMorph(robotCells({}, 1, false), function () { return lampCells(1.15, false, false, false); }, now, function (n) { setState('lamp', n); });
    } else if (sc.mode === 'tricks') enterTricks(now, sc, false);
    else if (sc.mode === 'hook') setState('hookgrab', now);
    else if (sc.mode === 'show') { W.actT = now; W.act = 0; setState('show', now); }
    else if (sc.mode === 'hero') { W.h = { lv: (W.travel && typeof W.travel.pi === 'string') ? W.travel.pi : 'line', act: null }; setState('hero', now); }
    else if (sc.mode === 'rope') { W.rp = { ring: W.y - ropeHB() }; setState('rope', now); }
    else setState('free', now);
  }

  function flames(now, len) {
    var f = feet(), out = [], fl = Math.floor(now / 70) % 2;
    f.xs.filter(function (x, i) { return i % 2 === 0; }).forEach(function (x0) {
      var x = OX + (W.dir < 0 ? R.W - 1 - x0 : x0);
      for (var r = 0; r < len + fl; r++) out.push({ x: x, y: TOPM + f.bottom + 1 + r, col: ['#F2B33D', '#E0662E', '#C0522A', '#C0522A'][Math.min(r, 3)], a: r >= len ? 0.6 : 1 });
    });
    return out;
  }
  function ring(dark) {
    var hy = TOPM + feet().top - 3, col = Home.bot.accent;
    return [[7, 0], [8, 0], [6, 1], [9, 1], [7, 2], [8, 2]].map(function (c) { return { x: OX + c[0], y: hy + c[1], col: col }; });
  }
  function showRope(x0, y0, x1, y1) {
    var len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0) * 180 / Math.PI;
    rope.style.opacity = 1;
    rope.style.height = len + 'px';
    rope.style.transform = 'translate(' + Math.round(x0 - scrollX) + 'px,' + Math.round(y0 - scrollY) + 'px) rotate(' + (-ang).toFixed(2) + 'deg)';
  }
  var skillRows = Array.prototype.slice.call(document.querySelectorAll('#skills .row'));
  function skillRowAt(cy) {                                  // the table row at this screen height, if the cursor is around
    if (!mouseActive(performance.now())) return null;
    for (var i = 0; i < skillRows.length; i++) {
      var b = skillRows[i].getBoundingClientRect();
      if (cy >= b.top && cy <= b.bottom) return skillRows[i];
    }
    return null;
  }
  var email = document.querySelector('.contact-email');
  function overEmail() {
    if (!mouseActive(performance.now()) || !email) return false;
    var b = email.getBoundingClientRect();
    return mouse.cx >= b.left && mouse.cx <= b.right && mouse.cy >= b.top && mouse.cy <= b.bottom;
  }

  window.Walker = {
    tick: tick,
    onRebuild: function () { fb = null; if (W.state === 'free' || W.state === 'hero') W.hop = performance.now(); }
  };
})();
