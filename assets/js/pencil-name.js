/* The name on the front page, drawn like a lettering sketch: construction lines, then the pencil
   follows the outline of every letter, then one diagonal sweep of hand shading. The real text stays
   underneath (transparent), so the layout, search engines, screen readers and the robot's route are
   unchanged. Outlines come from Playfair Display Bold (SIL Open Font License). */
(function () {
  'use strict';
  var title = document.querySelector('.hero-title');
  if (!title || !window.fetch) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg', PAD = 40, CAP = 0.708;
  var GL = null, built = null;
  window.__nameDone = false;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function el(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }

  // every letter of the title, where the page put it (relative to the title box)
  function letters() {
    var box = title.getBoundingClientRect(), out = [], lines = [];
    var tw = document.createTreeWalker(title, NodeFilter.SHOW_TEXT), node, rg = document.createRange();
    var mctx = mk(4, 4).getContext('2d');
    while ((node = tw.nextNode())) {
      var cs = getComputedStyle(node.parentElement), fs = parseFloat(cs.fontSize);
      mctx.font = '700 ' + fs + 'px "Playfair Display"';
      var asc = mctx.measureText('H').fontBoundingBoxAscent || fs * 0.9;
      for (var i = 0; i < node.nodeValue.length; i++) {
        var ch = node.nodeValue[i]; if (!GL.glyphs[ch]) continue;
        rg.setStart(node, i); rg.setEnd(node, i + 1);
        var r = rg.getBoundingClientRect();
        var lt = { ch: ch, x: r.left - box.left + PAD, y: r.top - box.top + asc + PAD, fs: fs, w: r.width };
        out.push(lt);
        var ln = null;
        for (var j = 0; j < lines.length; j++) if (Math.abs(lines[j].y - lt.y) < 4) ln = lines[j];
        if (!ln) lines.push(ln = { y: lt.y, x1: lt.x, x2: lt.x + lt.w, fs: fs });
        ln.x1 = Math.min(ln.x1, lt.x); ln.x2 = Math.max(ln.x2, lt.x + lt.w);
      }
    }
    return { list: out, lines: lines, w: box.width + PAD * 2, h: box.height + PAD * 2 };
  }

  function draw(animate) {
    var L = letters(), W = Math.ceil(L.w), H = Math.ceil(L.h), dpr = window.devicePixelRatio || 1, PW = Math.round(W * dpr), PH = Math.round(H * dpr);
    if (built) built.remove();
    var wrap = document.createElement('div'); wrap.className = 'pencil-layer'; wrap.setAttribute('aria-hidden', 'true');
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
    var cv = mk(PW, PH); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H });
    wrap.appendChild(cv); wrap.appendChild(svg); title.appendChild(wrap); built = wrap;
    var defs = el('defs', {}, svg), f = el('filter', { id: 'pencil-name', filterUnits: 'userSpaceOnUse', x: -50, y: -50, width: W + 100, height: H + 100 }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: .9, numOctaves: 1, seed: 4, result: 'n' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 1.8, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    var ctx = cv.getContext('2d');

    // 1. construction lines
    var guides = el('g', { stroke: '#8E8E8E', 'stroke-width': .7, fill: 'none', filter: 'url(#pencil-name)' }, svg), gl = [];
    L.lines.forEach(function (ln) {
      gl.push(el('line', { x1: ln.x1 - 24, y1: ln.y, x2: ln.x2 + 24, y2: ln.y }, guides));
      gl.push(el('line', { x1: ln.x1 - 24, y1: ln.y - ln.fs * CAP, x2: ln.x2 + 24, y2: ln.y - ln.fs * CAP }, guides));
    });
    L.list.forEach(function (lt) { gl.push(el('line', { x1: lt.x, y1: lt.y - lt.fs * CAP - 10, x2: lt.x, y2: lt.y + 10, 'stroke-width': .5 }, guides)); });

    // 2. outlines (two loose passes)
    var outl = el('g', { fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#pencil-name)' }, svg), paths = [];
    L.list.forEach(function (lt, i) {
      var s = lt.fs / GL.upm;
      [[1.5, '#262626', 0, 0, 0], [1, 'rgba(38,38,38,.55)', .9, .7, 160]].forEach(function (pass) {
        var p = el('path', { d: GL.glyphs[lt.ch].d, transform: 'translate(' + (lt.x + pass[2]) + ',' + (lt.y + pass[3]) + ') scale(' + s + ',' + (-s) + ')', stroke: pass[1], 'stroke-width': pass[0] / s }, outl);
        paths.push({ p: p, i: i, delay: pass[4] });
      });
    });

    // 3. shading: a hand zigzag per letter, cut to the letter, revealed by one diagonal sweep
    var segs = [];
    L.list.forEach(function (lt) {
      var s = lt.fs / GL.upm, path = new Path2D(GL.glyphs[lt.ch].d);
      lt.mask = mk(PW, PH); var mc = lt.mask.getContext('2d'); mc.setTransform(dpr * s, 0, 0, -dpr * s, dpr * lt.x, dpr * lt.y); mc.fill(path);
      lt.layer = mk(PW, PH); lt.lc = lt.layer.getContext('2d'); lt.lc.setTransform(dpr, 0, 0, dpr, 0, 0); lt.lc.lineCap = 'round'; lt.lc.lineJoin = 'round';
      var w = GL.glyphs[lt.ch].adv * s, k = lt.fs / 138;
      function zig(ang, len, gap, press, width) {
        var ca = Math.cos(ang), sa = Math.sin(ang), cx = lt.x + w / 2, cy = lt.y - lt.fs * CAP / 2, span = Math.max(w, lt.fs * .7) * 1.3, pts = [], q = -span / 2;
        while (q < span / 2) {
          var l1 = len * rnd(.8, 1.1), side = pts.length % 2 ? 1 : -1;
          pts.push({ x: cx + q * sa + side * l1 / 2 * ca + rnd(-2.5, 2.5) * k, y: cy - q * ca + side * l1 / 2 * sa + rnd(-2.5, 2.5) * k, p: rnd(press[0], press[1]), w: rnd(width[0], width[1]) * k });
          q += rnd(gap[0], gap[1]) * k;
        }
        return pts;
      }
      lt.pts = zig(-0.66 + rnd(-.08, .08), lt.fs * 1.05, [2, 3.1], [.58, .95], [1.8, 2.8]);
      lt.pts2 = zig(0.78 + rnd(-.1, .1), lt.fs * .95, [3, 4.6], [.3, .55], [1.2, 1.9]);
      lt.pts.forEach(function (pt, i) { if (i) segs.push({ lt: lt, set: 1, i: i, k: (pt.x + lt.pts[i - 1].x) / 2 + (pt.y + lt.pts[i - 1].y) / 2 * 1.2 }); });
      lt.pts2.forEach(function (pt, i) { if (i) segs.push({ lt: lt, set: 2, i: i, k: (pt.x + lt.pts2[i - 1].x) / 2 + (pt.y + lt.pts2[i - 1].y) / 2 * 1.2 + 60 }); });
    });
    segs.sort(function (a, b) { return a.k - b.k; });
    var grain = mk(PW, PH), gc = grain.getContext('2d'), gd = gc.createImageData(PW, PH);
    for (var q = 0; q < gd.data.length; q += 4) { var v = Math.random(); gd.data[q + 3] = v > .74 ? Math.min(255, (v - .74) * 800) : 0; }
    gc.putImageData(gd, 0, 0);
    var comp = mk(PW, PH), cc = comp.getContext('2d'), one = mk(PW, PH), c1 = one.getContext('2d');
    function stroke1(sg) {
      var pts = sg.set === 1 ? sg.lt.pts : sg.lt.pts2, p0 = pts[sg.i - 1], p1 = pts[sg.i], lc = sg.lt.lc;
      lc.strokeStyle = 'rgba(' + (sg.set === 1 ? '30,30,30' : '48,48,48') + ',' + p1.p.toFixed(2) + ')'; lc.lineWidth = p1.w;
      lc.beginPath(); lc.moveTo(p0.x, p0.y);
      lc.quadraticCurveTo((p0.x + p1.x) / 2 + rnd(-2, 2), (p0.y + p1.y) / 2 + rnd(-2, 2), p1.x, p1.y); lc.stroke();
      sg.lt.touched = true;
    }
    function compose() {
      cc.globalCompositeOperation = 'source-over'; cc.clearRect(0, 0, PW, PH);
      L.list.forEach(function (lt) {
        if (!lt.touched) return;
        c1.globalCompositeOperation = 'source-over'; c1.clearRect(0, 0, PW, PH);
        c1.drawImage(lt.layer, 0, 0); c1.globalCompositeOperation = 'destination-in'; c1.drawImage(lt.mask, 0, 0);
        cc.drawImage(one, 0, 0);
      });
      cc.globalCompositeOperation = 'destination-out'; cc.drawImage(grain, 0, 0);
      ctx.clearRect(0, 0, PW, PH); ctx.drawImage(comp, 0, 0);
    }
    title.classList.add('pencil-on');

    if (!animate) {                                         // already drawn: final state at once
      segs.forEach(stroke1); compose();
      guides.style.opacity = .35;
      window.__nameDone = true;
      return;
    }
    // timings
    var T_OUT = 650, OUT_EACH = 620, OUT_STAG = 120, tShade = T_OUT + L.list.length * OUT_STAG + OUT_EACH * 0.6, SWEEP = 2200;
    gl.forEach(function (ln, i) {
      var len = Math.hypot(ln.getAttribute('x2') - ln.getAttribute('x1'), ln.getAttribute('y2') - ln.getAttribute('y1'));
      ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
      var main = i < L.lines.length * 2;
      ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: main ? 600 : 250, delay: main ? i * 90 : 300 + (i - L.lines.length * 2) * 25, fill: 'forwards', easing: 'ease-out' });
    });
    paths.forEach(function (o) {
      var len = o.p.getTotalLength();
      o.p.style.strokeDasharray = len; o.p.style.strokeDashoffset = len;
      o.p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: OUT_EACH, delay: T_OUT + o.i * OUT_STAG + o.delay, fill: 'forwards', easing: 'ease-in-out' });
    });
    var kMin = segs[0].k, kMax = segs[segs.length - 1].k, drawn = 0, t0 = performance.now();
    function frame(now) {
      var t = now - t0;
      if (t >= tShade) {
        var fr = Math.min(1, (t - tShade) / SWEEP), lim = kMin + (kMax - kMin) * fr, ch = false;
        while (drawn < segs.length && segs[drawn].k <= lim) { stroke1(segs[drawn++]); ch = true; }
        if (ch) compose();
        if (fr >= 1) { guides.animate([{ opacity: 1 }, { opacity: .35 }], { duration: 800, fill: 'forwards' }); window.__nameDone = true; return; }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  var lastW = 0;
  Promise.all([fetch('assets/data/name-glyphs.json').then(function (r) { return r.json(); }), document.fonts.load('700 100px "Playfair Display"')])
    .then(function (res) {
      GL = res[0];
      lastW = innerWidth;
      draw(!reduce);
      window.addEventListener('resize', function () {
        if (Math.abs(innerWidth - lastW) < 2) return;
        lastW = innerWidth; draw(false);
      });
    })
    .catch(function () { title.classList.remove('pencil-on'); window.__nameDone = true; });   // the plain name stays
})();
