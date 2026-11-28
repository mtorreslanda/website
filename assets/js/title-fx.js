/* Project titles drawn in the theme of each project (SH63), instead of the pencil sketch:
     grass       · the letters grow out of the ground as a mown pitch, stripes and blades (ball possession);
     scan        · a scanner light sweeps the letters in as scan lines, then a detection box closes on the title (signatures);
     calligraphy · the title is signed with a pen, left to right, and underlined with a flourish (signatures, alternative);
     pixel       · the title in a pixel font, outlined and extruded, drops in letter by letter like a game's title screen (Pokémon TCG agent).
   Any element with data-title-fx="<style>". The outlines are the same Playfair Display Bold glyphs as the pencil title
   (data-pencil-glyphs); the real text stays underneath, transparent, for layout, search engines and screen readers.
   Safeguard: with reduced motion, or after the first drawing, the final state is drawn at once. */
(function () {
  'use strict';
  var titles = Array.prototype.slice.call(document.querySelectorAll('[data-title-fx]'));
  if (!titles.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAD = 40, CAP = 0.708, glyphCache = {};

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function bounce(t) {
    var n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
    return n * (t -= 2.625 / d) * t + .984375;
  }

  // every letter of the title, where the page put it (relative to the layer, which is PAD larger on each side)
  function letters(title, GL) {
    var box = title.getBoundingClientRect(), out = [];
    var tw = document.createTreeWalker(title, NodeFilter.SHOW_TEXT), node, rg = document.createRange(), m = mk(4, 4).getContext('2d');
    while ((node = tw.nextNode())) {
      if (node.parentElement.closest('.fx-layer')) continue;
      var fs = parseFloat(getComputedStyle(node.parentElement).fontSize);
      m.font = '700 ' + fs + 'px "Playfair Display"';
      var asc = m.measureText('H').fontBoundingBoxAscent || fs * .9;
      for (var i = 0; i < node.nodeValue.length; i++) {
        var ch = node.nodeValue[i]; if (!GL.glyphs[ch]) continue;
        rg.setStart(node, i); rg.setEnd(node, i + 1);
        var r = rg.getBoundingClientRect();
        out.push({ ch: ch, x: r.left - box.left + PAD, y: r.top - box.top + asc + PAD, fs: fs, w: r.width });
      }
    }
    return { list: out, w: box.width + PAD * 2, h: box.height + PAD * 2 };
  }

  function build(title, GL, animate) {
    var style = title.getAttribute('data-title-fx');
    var L = letters(title, GL), W = Math.ceil(L.w), H = Math.ceil(L.h), dpr = window.devicePixelRatio || 1;
    if (!L.list.length) return;
    if (title._fx) { title._fx.stop = true; title._fx.wrap.remove(); }
    var wrap = document.createElement('div'); wrap.className = 'pencil-layer fx-layer'; wrap.setAttribute('aria-hidden', 'true');
    wrap.style.width = W + 'px'; wrap.style.height = H + 'px';
    var cv = mk(Math.round(W * dpr), Math.round(H * dpr)); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    wrap.appendChild(cv); title.appendChild(wrap);
    var st = { wrap: wrap, stop: false }; title._fx = st;
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // one mask per letter and one for all, in layer pixels (dpr scaled)
    var all = mk(cv.width, cv.height), ac = all.getContext('2d');
    var x0 = 1e9, x1 = -1e9, top = 1e9, base = -1e9;
    L.list.forEach(function (lt) {
      var s = lt.fs / GL.upm, path = new Path2D(GL.glyphs[lt.ch].d);
      lt.mask = mk(cv.width, cv.height); var mc = lt.mask.getContext('2d');
      mc.setTransform(dpr * s, 0, 0, -dpr * s, dpr * lt.x, dpr * lt.y); mc.fill(path);
      ac.drawImage(lt.mask, 0, 0);
      lt.top = lt.y - lt.fs * .78; lt.adv = GL.glyphs[lt.ch].adv * s;
      x0 = Math.min(x0, lt.x); x1 = Math.max(x1, lt.x + lt.adv); top = Math.min(top, lt.y - lt.fs * CAP); base = Math.max(base, lt.y);
    });
    var box = { x0: x0, x1: x1, top: top, base: base, fs: L.list[0].fs };
    title.classList.add('pencil-on', 'fx-on');
    var draw = STYLES[style] ? STYLES[style](ctx, L, all, box, W, H, dpr, title) : null;
    if (!draw) return;
    if (!animate) { draw(1e9); window.__nameDone = true; return; }
    var t0 = performance.now();
    (function frame(now) {
      if (st.stop) return;
      ctx.clearRect(0, 0, W, H);
      var done = draw(now - t0);
      if (done) { window.__nameDone = true; return; }
      requestAnimationFrame(frame);
    })(t0);
  }

  // draw `src` (a dpr-scaled canvas) through the mask of a letter, or of all letters
  function masked(src, mask, w, h) {
    var c = mk(w, h), x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0);
    return c;
  }

  var STYLES = {
    /* ---------------------------------------------------------------- the pitch */
    grass: function (ctx, L, all, box, W, H, dpr) {
      var CW = all.width, CH = all.height, k = box.fs / 130;
      // the turf: mown stripes, a few darker speckles
      var turf = mk(CW, CH), tc = turf.getContext('2d'), band = Math.max(10, box.fs * .2) * dpr;
      for (var x = 0; x < CW; x += band) { tc.fillStyle = Math.round(x / band) % 2 ? '#2F8A47' : '#3FA35A'; tc.fillRect(x, 0, band + 1, CH); }
      for (var i = 0; i < CW * CH / 90; i++) { tc.fillStyle = Math.random() < .5 ? 'rgba(20,70,35,.35)' : 'rgba(150,210,120,.3)'; tc.fillRect(Math.random() * CW, Math.random() * CH, 1.5 * dpr, 2.5 * dpr); }
      // blades: wherever a letter has empty space above it, short blades grow up from its top edge
      var blades = [], data = all.getContext('2d').getImageData(0, 0, CW, CH).data, step = Math.max(2, Math.round(2.2 * dpr));
      for (var cx = 0; cx < CW; cx += step) {
        var prev = 0;
        for (var cy = 0; cy < CH; cy++) {
          var a = data[(cy * CW + cx) * 4 + 3];
          if (a > 128 && prev <= 128) {
            var bx = cx / dpr, by = cy / dpr, li = 0;
            for (var j = 0; j < L.list.length; j++) if (bx >= L.list[j].x - 2 && bx <= L.list[j].x + L.list[j].adv + 2) li = j;
            blades.push({ x: bx, y: by + 1.5, len: rnd(3, 9) * k, lean: rnd(-.45, .45), w: rnd(1.1, 1.9) * Math.max(.8, k), col: Math.random() < .5 ? '#2F8A47' : Math.random() < .5 ? '#56B86C' : '#24703A', li: li });
          }
          prev = a;
        }
      }
      var letterTurf = L.list.map(function (lt) { return masked(turf, lt.mask, CW, CH); });
      var STAG = 85, GROW = 650;
      return function (t) {
        var done = true;
        L.list.forEach(function (lt, i) {
          var p = ease(clamp((t - i * STAG) / GROW)); if (p < 1) done = false;
          if (p <= 0) return;
          var yb = lt.y + lt.fs * .25, yt = lt.top - 10, cut = yb - (yb - yt) * p;               // grows up from the ground
          ctx.save(); ctx.beginPath(); ctx.rect(0, cut, W, H); ctx.clip();
          ctx.drawImage(letterTurf[i], 0, 0, W, H); ctx.restore();
        });
        ctx.lineCap = 'round';
        blades.forEach(function (b) {
          var g = ease(clamp((t - b.li * STAG - GROW * .7) / 500)); if (g < 1) done = false;
          if (g <= 0) return;
          var sway = Math.sin(t / 700 + b.x * .15) * .08 * (t > 4000 ? 1 : 0);
          ctx.strokeStyle = b.col; ctx.lineWidth = b.w; ctx.beginPath(); ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x + Math.sin(b.lean + sway) * b.len * g, b.y - Math.cos(b.lean + sway) * b.len * g); ctx.stroke();
        });
        return done && t > 1e8;                                                                     // keeps swaying gently
      };
    },

    /* ---------------------------------------------------------------- the scanner */
    scan: function (ctx, L, all, box, W, H, dpr) {
      var CW = all.width, CH = all.height, LIGHT = '#5CC8FF', CY = '#1C7FB5';
      var lines = mk(CW, CH), lc = lines.getContext('2d'), gap = Math.max(3, Math.round(box.fs / 32)) * dpr;
      lc.fillStyle = '#1A1A1A';
      for (var y = 0; y < CH; y += gap) lc.fillRect(0, y, CW, Math.max(1, gap * .62));
      var ink = masked(lines, all, CW, CH);
      var faint = mk(CW, CH), fc = faint.getContext('2d'); fc.globalAlpha = .14; fc.drawImage(all, 0, 0);
      var bx0 = box.x0 - 14, bx1 = box.x1 + 14, by0 = box.top - 16, by1 = box.base + box.fs * .22 + 10;
      var SWEEP = 1500, T0 = 250, BOX = T0 + SWEEP + 150, BOXD = 550, score = '0.98';
      return function (t) {
        var p = clamp((t - T0) / SWEEP), xs = bx0 - 30 + (bx1 - bx0 + 60) * ease(p);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, xs, H); ctx.clip();
        ctx.drawImage(faint, 0, 0, W, H); ctx.drawImage(ink, 0, 0, W, H); ctx.restore();
        if (p > 0 && p < 1) {                                                                       // the light bar
          var g = ctx.createLinearGradient(xs - 46, 0, xs + 8, 0);
          g.addColorStop(0, 'rgba(92,200,255,0)'); g.addColorStop(.8, 'rgba(92,200,255,.35)'); g.addColorStop(1, 'rgba(92,200,255,.9)');
          ctx.fillStyle = g; ctx.fillRect(xs - 46, by0 - 10, 54, by1 - by0 + 20);
          ctx.fillStyle = LIGHT; ctx.fillRect(xs, by0 - 10, 2.5, by1 - by0 + 20);
        }
        var q = ease(clamp((t - BOX) / BOXD));
        if (q > 0) {                                                                                // the detection box closes in
          var pad = (1 - q) * 22, x0 = bx0 - pad, x1 = bx1 + pad, y0 = by0 - pad, y1 = by1 + pad, c = Math.min(28, (x1 - x0) / 6);
          ctx.strokeStyle = LIGHT; ctx.lineWidth = 2; ctx.globalAlpha = q; ctx.setLineDash([5, 5]); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
          ctx.strokeStyle = CY; ctx.lineWidth = 3.5; ctx.beginPath();
          ctx.moveTo(x0, y0 + c); ctx.lineTo(x0, y0); ctx.lineTo(x0 + c, y0); ctx.moveTo(x1 - c, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + c);
          ctx.moveTo(x1, y1 - c); ctx.lineTo(x1, y1); ctx.lineTo(x1 - c, y1); ctx.moveTo(x0 + c, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - c); ctx.stroke();
          ctx.font = '500 12px "JetBrains Mono", monospace'; var label = 'signature  ' + score, lw = ctx.measureText(label).width + 14;
          ctx.fillStyle = CY; ctx.fillRect(x0, y0 - 20, lw, 20); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x0 + 7, y0 - 9.5);
          ctx.globalAlpha = 1;
        }
        return t > BOX + BOXD;
      };
    },

    /* ---------------------------------------------------------------- the pen */
    calligraphy: function (ctx, L, all, box, W, H, dpr, title) {
      var INKC = '#1B2A4A', text = title.textContent.trim(), fs = box.fs * 1.18;
      var pen = mk(all.width, all.height), pc = pen.getContext('2d');
      pc.setTransform(dpr, 0, 0, dpr, 0, 0); pc.font = '400 ' + fs + 'px "Great Vibes", cursive'; pc.fillStyle = INKC; pc.textBaseline = 'alphabetic';
      var tw = pc.measureText(text).width, x0 = box.x0 + 4, y = box.base - box.fs * .02;
      pc.fillText(text, x0, y);
      var SIGN = 2400, T0 = 200, SW = 700, x1 = x0 + tw;
      // the flourish: a swash under the name, from the last letter back under it
      var swash = new Path2D(), sy = y + fs * .16;
      swash.moveTo(x1 - tw * .05, y - fs * .1);
      swash.bezierCurveTo(x1 + tw * .04, y + fs * .2, x0 + tw * .5, sy + fs * .12, x0 + tw * .08, sy);
      swash.bezierCurveTo(x0 + tw * .02, sy - fs * .03, x0 + tw * .12, sy - fs * .06, x0 + tw * .3, sy - fs * .02);
      return function (t) {
        var p = clamp((t - T0) / SIGN), xs = x0 - 10 + (tw + 20) * p;
        ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(xs + 18, 0); ctx.lineTo(xs - 18, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
        ctx.drawImage(pen, 0, 0, W, H); ctx.restore();
        var q = clamp((t - T0 - SIGN) / SW);
        if (q > 0) {
          ctx.save(); ctx.strokeStyle = INKC; ctx.lineWidth = Math.max(1.6, fs / 60); ctx.lineCap = 'round';
          ctx.setLineDash([tw * 2.2 * ease(q), tw * 3]); ctx.stroke(swash); ctx.restore();
        }
        if (p > 0 && p < 1) { ctx.fillStyle = INKC; ctx.beginPath(); ctx.arc(xs, y - fs * .35 + Math.sin(t / 60) * fs * .12, 2.2, 0, Math.PI * 2); ctx.fill(); }
        return q >= 1;
      };
    },

    /* ---------------------------------------------------------------- the title screen */
    pixel: function (ctx, L, all, box, W, H, dpr, title) {
      var pal = (title.getAttribute('data-title-pal') || 'gold').split(',');
      var PALS = { gold: ['#FFE48A', '#FFCB05', '#F59E0B', '#1A1A1A', '#C0281B'], red: ['#FF6B5A', '#E3350D', '#B3240A', '#1A1A1A', '#2A75BB'] };
      var C = PALS[pal[0]] || PALS.gold;
      // the title set in a pixel font (Press Start 2P, SIL Open Font License), each glyph pixel one block of B px
      var text = title.textContent.trim(), size = Math.max(16, Math.round(box.fs * .58 / 8) * 8), B = size / 8;
      var m = mk(Math.ceil(W), Math.ceil(H)), mc = m.getContext('2d', { willReadFrequently: true });
      mc.font = size + 'px "Press Start 2P"'; mc.textBaseline = 'alphabetic';
      var cx = 0, base = 0, lineY = null, k = 0, cells = [];
      for (var i = 0; i < text.length; i++) {
        var ch = text[i], adv = mc.measureText(ch).width;
        if (ch !== ' ' && L.list[k]) {                                                              // follow the page's own line breaks
          var lt = L.list[k++];
          if (lineY === null || Math.abs(lt.y - lineY) > 4) { lineY = lt.y; cx = Math.round(lt.x / B) * B; base = Math.round((lt.y - lt.fs * .12) / B) * B; }
          mc.clearRect(0, 0, m.width, m.height); mc.fillText(ch, cx, base);
          var data = mc.getImageData(0, 0, m.width, m.height).data, out = [], on = {};
          for (var y = base - size * 1.5; y < base + size * .5; y += B) for (var x = cx; x < cx + adv; x += B) {
            var px = Math.round(x + B / 2), py = Math.round(y + B / 2);
            if (px >= 0 && py >= 0 && px < m.width && py < m.height && data[(py * m.width + px) * 4 + 3] > 128) { on[x + ',' + y] = 1; out.push({ x: x, y: y }); }
          }
          var edge = [];                                                                            // the outline, one block around
          out.forEach(function (c) {
            [[-B, 0], [B, 0], [0, -B], [0, B], [-B, -B], [B, B], [-B, B], [B, -B]].forEach(function (d) {
              var key = (c.x + d[0]) + ',' + (c.y + d[1]); if (!on[key]) { on[key] = 2; edge.push({ x: c.x + d[0], y: c.y + d[1] }); }
            });
          });
          var tp = 1e9, bt = -1e9; out.forEach(function (c) { tp = Math.min(tp, c.y); bt = Math.max(bt, c.y + B); });
          cells.push({ fill: out, edge: edge, top: base - size * .9, base: base });
        }
        cx += adv;
      }
      L = { list: cells };
      var STAG = 70, DROP = 650, SHINE = 900;
      var tEnd = (L.list.length - 1) * STAG + DROP + 200 + SHINE;
      return function (t) {
        var shineX = box.x0 - 80 + (box.x1 - box.x0 + 160) * clamp((t - (L.list.length - 1) * STAG - DROP - 200) / SHINE);
        var dys = cells.map(function (lc, i) { var p = clamp((t - i * STAG) / DROP); return p <= 0 ? null : -(1 - bounce(p)) * (lc.base + 40); });
        // three passes over all letters, so no letter's outline covers its neighbour's face
        ctx.fillStyle = C[4];
        cells.forEach(function (lc, i) { if (dys[i] === null) return; lc.edge.concat(lc.fill).forEach(function (c) { ctx.fillRect(c.x + B * .6, c.y + dys[i] + B * .8, B, B); }); });
        ctx.fillStyle = C[3];
        cells.forEach(function (lc, i) { if (dys[i] === null) return; lc.edge.forEach(function (c) { ctx.fillRect(c.x, c.y + dys[i], B, B); }); });
        cells.forEach(function (lc, i) {
          if (dys[i] === null) return;
          lc.fill.forEach(function (c) {
            var r = (c.y + B / 2 - lc.top) / (lc.base - lc.top);
            ctx.fillStyle = r < .3 ? C[0] : r < .72 ? C[1] : C[2];
            if (Math.abs(c.x - (shineX - (c.y - lc.top) * .5)) < B * 1.2) ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(c.x, c.y + dys[i], B, B);
          });
        });
        return t > tEnd;
      };
    }
  };

  // load the outlines (and the script font when a title asks for it), then draw every title
  var fonts = [document.fonts.load('700 100px "Playfair Display"')];
  if (titles.some(function (t) { return t.getAttribute('data-title-fx') === 'calligraphy'; })) fonts.push(document.fonts.load('400 100px "Great Vibes"'));
  if (titles.some(function (t) { return /scan|pixel/.test(t.getAttribute('data-title-fx')); })) fonts.push(document.fonts.load('500 12px "JetBrains Mono"'));
  if (titles.some(function (t) { return t.getAttribute('data-title-fx') === 'pixel'; })) fonts.push(document.fonts.load('16px "Press Start 2P"'));
  var guard = setTimeout(function () { titles.forEach(function (t) { if (!t._fx) t.classList.add('pencil-fail'); }); }, 5000);
  titles.forEach(function (title) {
    var url = title.getAttribute('data-pencil-glyphs') || '../assets/data/title-glyphs.json';
    if (!glyphCache[url]) glyphCache[url] = fetch(url).then(function (r) { return r.json(); });
    Promise.all([glyphCache[url]].concat(fonts)).then(function (res) {
      clearTimeout(guard); title.classList.remove('pencil-fail');
      build(title, res[0], !reduce);
      var lastW = innerWidth;
      window.addEventListener('resize', function () { if (Math.abs(innerWidth - lastW) < 2) return; lastW = innerWidth; build(title, res[0], false); });
    }).catch(function () { title.classList.add('pencil-fail'); window.__nameDone = true; });
  });
})();
