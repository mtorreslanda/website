/* TennisVision court explorer (from the Court tab of the TennisVision product page, in English).
   <div class="cx" data-src="tennis-point.json" [data-links="label|url;label|url"]></div>
   The point from above, in court metres: every bounce numbered by its shot, the rally strip, a card for
   the selected shot, and a player that replays the point with both players and the 3D ball.
   Court coordinates: x across (0..10.97), y along (0 = near baseline .. 23.77 = far). In the drawing, as on
   the video: near baseline on the left (svg x = y, svg y = x). */
(function () {
  'use strict';
  var root = document.querySelector('.cx[data-src]');
  if (!root) return;
  var NS = 'http://www.w3.org/2000/svg';
  var L = 23.77, W = 10.97, RED = L / 2, CAJA = 6.40, S0 = 1.37, S1 = 9.60, RED_H = 0.914;
  var TIPO = { saque: 'Serve', derecha: 'Forehand', reves: 'Backhand' };
  var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(x, d) { d = d === undefined ? 1 : d; return x == null ? '–' : x.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function el(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function q(s) { return root.querySelector(s); }

  root.innerHTML =
    '<div class="cx-cab"><div><div class="cx-eyebrow" data-o="rotulo">The point, from above</div>' +
    '<h2><em data-o="ngolpes">–</em> shots, in metres</h2></div><div class="cx-bug" data-o="bug" aria-label="Score before the point"></div></div>' +
    '<div class="cx-franja" data-o="resumen">Loading the point…</div>' +
    '<div class="cx-grid"><div class="cx-izq">' +
    '<div class="cx-cancha"><svg data-o="cancha" viewBox="-6 -3.2 35.77 17.37" aria-label="The court from above with every bounce of the point"></svg></div>' +
    '<div class="cx-mandos"><button type="button" class="cx-mando on" data-o="play">▶ Play</button><button type="button" class="cx-mando" data-o="vel">Speed 1×</button>' +
    '<input type="range" data-o="barra" min="0" max="1000" value="0" aria-label="Time in the point"><span class="cx-reloj" data-o="reloj">0.0 s</span></div>' +
    '<div class="cx-latido"><div class="cx-latido-cab"><span data-o="arriba"></span><span>The rally, shot by shot · height = speed</span><span data-o="abajo"></span></div>' +
    '<svg data-o="latido" viewBox="0 0 1000 170" aria-label="Speed of every shot along the point"></svg></div>' +
    '</div><div class="cx-ficha" data-o="ficha" aria-live="polite"></div></div>' +
    (root.dataset.links ? '<div class="cx-pie">' + root.dataset.links.split(';').map(function (s) { var p = s.split('|'); return '<a href="' + p[1] + '">' + p[0] + '</a>'; }).join(' · ') + '</div>' : '');
  function o(n) { return q('[data-o="' + n + '"]'); }
  var cancha = o('cancha');

  var PT = null, sel = 0, tAnim = 0, jugando = false, vel = 1, ultimoT = null, COL = {}, NOMBRE = {}, f0 = 0, numPrevio = 0;
  function sv(tag, at, padre) { var e = el(tag, at); (padre || cancha).appendChild(e); return e; }
  function P(x, y) { return [y, x]; }   // metres → svg
  function dibujaPista() {
    cancha.replaceChildren();
    sv('rect', { x: -6, y: -3.2, width: 35.77, height: 17.37, fill: '#22553c' });
    sv('rect', { x: 0, y: 0, width: L, height: W, fill: '#2f5f8f' });
    var lin = { stroke: '#f2efe8', 'stroke-width': 0.07, fill: 'none' };
    function L2(a) { for (var k in lin) a[k] = lin[k]; return a; }
    sv('rect', L2({ x: 0, y: 0, width: L, height: W }));
    [S0, S1].forEach(function (x) { sv('line', L2({ x1: 0, y1: x, x2: L, y2: x })); });
    [RED - CAJA, RED + CAJA].forEach(function (y) { sv('line', L2({ x1: y, y1: S0, x2: y, y2: S1 })); });
    sv('line', L2({ x1: RED - CAJA, y1: W / 2, x2: RED + CAJA, y2: W / 2 }));
    sv('line', { x1: RED, y1: -0.9, x2: RED, y2: W + 0.9, stroke: '#d9dde1', 'stroke-width': 0.14 });
    var t = sv('text', { x: 0.2, y: -1.0, fill: '#9db0c1', 'font-size': 0.7, 'font-family': 'DM Sans, sans-serif' }); t.textContent = NOMBRE[PT.cerca] + "'s baseline (camera side)";
    var t2 = sv('text', { x: L - 0.2, y: -1.0, fill: '#9db0c1', 'font-size': 0.7, 'text-anchor': 'end', 'font-family': 'DM Sans, sans-serif' }); t2.textContent = NOMBRE[PT.lejos] + "'s baseline";
    ['capa-sel', 'capa-botes', 'capa-anim'].forEach(function (id) { sv('g', { 'data-g': id }); });
  }
  function capa(id) { return cancha.querySelector('[data-g="' + id + '"]'); }
  function pelotaEn(f) { var i = Math.round(f / PT.paso); return PT.pelota[Math.max(0, Math.min(PT.pelota.length - 1, i))]; }
  function tramo(fa, fb) { var pts = []; for (var f = fa; f <= fb; f += PT.paso) { var p = pelotaEn(f); if (p && p[0] != null) pts.push(p); } return pts; }
  function rival(j) { return j === PT.cerca ? PT.lejos : PT.cerca; }

  function pintaBotes() {
    var g = capa('capa-botes'); g.replaceChildren();
    PT.golpes.forEach(function (h, i) {
      if (h.bx == null) return;
      var c = P(h.bx, h.by), cx = c[0], cy = c[1];
      var b = sv('g', { class: 'bote', tabindex: 0, role: 'button', 'aria-label': 'Bounce of shot ' + h.n }, g);
      if (h.dentro === false) {
        sv('circle', { class: 'd', cx: cx, cy: cy, r: 0.32, fill: i === sel ? '#ffffff' : 'none', stroke: '#ff5a5a', 'stroke-width': 0.09 }, b);
        sv('path', { d: 'M' + (cx - .2) + ',' + (cy - .2) + 'L' + (cx + .2) + ',' + (cy + .2) + 'M' + (cx + .2) + ',' + (cy - .2) + 'L' + (cx - .2) + ',' + (cy + .2), stroke: '#ff5a5a', 'stroke-width': 0.08 }, b);
      } else {
        sv('circle', { class: 'd', cx: cx, cy: cy, r: 0.3, fill: i === sel ? '#ffffff' : COL[h.jugador], stroke: i === sel ? COL[h.jugador] : '#f2efe8', 'stroke-width': i === sel ? 0.12 : 0.06 }, b);
      }
      var n = sv('text', { x: cx, y: cy - 0.48, fill: '#f2efe8', 'font-size': 0.5, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace' }, b); n.textContent = h.n;
      b.addEventListener('click', function () { elegir(i, true); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { elegir(i, true); e.preventDefault(); } });
    });
  }
  function pintaSeleccion() {
    var g = capa('capa-sel'); g.replaceChildren();
    var h = PT.golpes[sel], sigF = PT.golpes[sel + 1] ? PT.golpes[sel + 1].f : PT.n - 1;
    var ida = tramo(h.f, h.bf != null ? h.bf : sigF), vuelta = h.bf != null ? tramo(h.bf, sigF) : [];
    function linea(pts, extra) {
      if (pts.length < 2) return;
      var a = { points: pts.map(function (p) { return P(p[0], p[1]).join(','); }).join(' '), fill: 'none', 'stroke-linecap': 'round' };
      for (var k in extra) a[k] = extra[k]; sv('polyline', a, g);
    }
    linea(ida, { stroke: '#9be86a', 'stroke-width': 0.14, class: 'vuelo-ida', pathLength: 1 });
    if (!jugando && h.bx != null) { var c = P(h.bx, h.by); sv('circle', { class: 'onda', cx: c[0], cy: c[1], r: 0.35, fill: 'none', stroke: h.dentro === false ? '#ff5a5a' : COL[h.jugador], 'stroke-width': 0.08 }, g); }
    linea(vuelta, { stroke: '#9be86a', 'stroke-width': 0.08, 'stroke-dasharray': '0.3 0.25', opacity: 0.7 });
    if (h.x != null) { var c1 = P(h.x, h.y); sv('rect', { x: c1[0] - 0.38, y: c1[1] - 0.38, width: 0.76, height: 0.76, transform: 'rotate(45 ' + c1[0] + ' ' + c1[1] + ')', fill: COL[h.jugador], stroke: '#f2efe8', 'stroke-width': 0.07 }, g); }
    if (h.rx != null) { var c2 = P(h.rx, h.ry); sv('circle', { cx: c2[0], cy: c2[1], r: 0.34, fill: 'none', stroke: COL[rival(h.jugador)], 'stroke-width': 0.1 }, g); }
  }
  // the ball's height against the distance it travels over the ground, from the shot to its bounce; the net marked
  function perfilSVG(h) {
    var pts = tramo(h.f, h.bf != null ? h.bf : h.f + 50);
    if (pts.length < 3) return '';
    var d = 0, serie = [[0, pts[0][2]]], redD = null;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], step = Math.hypot(b[0] - a[0], b[1] - a[1]);
      d += step; serie.push([d, b[2]]);
      if (redD == null && (a[1] - RED) * (b[1] - RED) <= 0) { var k = (RED - a[1]) / ((b[1] - a[1]) || 1e-6); redD = d - step * (1 - k); }
    }
    var W0 = 420, H0 = 100, zmax = Math.max(3, Math.max.apply(null, serie.map(function (s) { return s[1]; }))) * 1.1, sx = (W0 - 30) / d, sz = (H0 - 22) / zmax;
    function X(u) { return 22 + u * sx; } function Y(z) { return H0 - 14 - z * sz; }
    var s = '<svg viewBox="0 0 ' + W0 + ' ' + H0 + '" aria-label="Ball height along the flight">';
    [1, 2, 3].filter(function (z) { return z < zmax; }).forEach(function (z) { s += '<line x1="22" x2="' + (W0 - 6) + '" y1="' + Y(z) + '" y2="' + Y(z) + '" stroke="#2a3a4a" stroke-width="1"/><text x="18" y="' + (Y(z) + 3) + '" fill="#9db0c1" font-size="9" text-anchor="end">' + z + ' m</text>'; });
    s += '<line x1="22" x2="' + (W0 - 6) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#9db0c1" stroke-width="1"/>';
    if (redD != null) s += '<line x1="' + X(redD) + '" x2="' + X(redD) + '" y1="' + Y(0) + '" y2="' + Y(RED_H) + '" stroke="#f2efe8" stroke-width="3"/><text x="' + (X(redD) + 5) + '" y="' + (Y(RED_H) - 3) + '" fill="#f2efe8" font-size="9">net</text>';
    s += '<polyline fill="none" stroke="#9be86a" stroke-width="2.5" stroke-linejoin="round" points="' + serie.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    s += '<circle cx="' + X(d) + '" cy="' + Y(0) + '" r="3.5" fill="#f2efe8"/><text x="' + X(d) + '" y="' + (H0 - 2) + '" fill="#9db0c1" font-size="9" text-anchor="end">' + (h.bf != null ? 'bounce · ' : '') + fmt(d) + ' m</text></svg>';
    return s;
  }
  function pintaFicha() {
    var h = PT.golpes[sel], c = COL[h.jugador];
    var lejos = h.y != null && h.y > RED;
    var prof = h.by == null ? null : (h.by > RED ? L - h.by : h.by);
    var vuelo = h.bf != null ? (h.bf - h.f) / PT.fps : null;
    var resto = PT.golpes.filter(function (g) { return g.tipo !== 'saque' && g.kmh != null; }).map(function (g) { return g.kmh; });
    var media = resto.reduce(function (a, b) { return a + b; }, 0) / resto.length;
    var vmax = Math.max.apply(null, PT.golpes.map(function (g) { return g.kmh || 0; }));
    var v = h.kmh;
    var bote = h.bx == null ? ['Volley', 'taken before the bounce'] : h.dentro === false ? ['Out', prof != null ? fmt(Math.abs(prof)) + ' m from the baseline' : '']
      : ['In', h.tipo === 'saque' ? 'in the service box' : prof != null ? (prof < 0.05 ? 'on the baseline' : fmt(prof) + ' m inside the baseline') : ''];
    o('ficha').innerHTML =
      '<div class="tv-tag"><span>SHOT ' + h.n + ' / ' + PT.golpes.length + '</span><span>' + fmt((h.f - f0) / PT.fps) + ' s</span></div>' +
      '<div class="tv-quien"><i style="background:' + c + '"></i><h3>' + NOMBRE[h.jugador] + ' <span>· ' + (TIPO[h.tipo] || h.tipo) + '</span></h3></div>' +
      '<div class="tv-num"><b data-o="num">' + fmt(numPrevio, 0) + '</b><small>km/h</small><em>launch speed, from the fitted 3D flight</em></div>' +
      '<div class="tv-cmp"><div class="pista-b"><span style="width:' + (100 * (v || 0)) / vmax + '%; background:' + c + '"></span><i style="left:' + (100 * media) / vmax + '%"></i></div>' +
      '<div>the white tick is the rally average, serve left out: ' + fmt(media, 0) + ' km/h</div></div>' +
      '<dl class="tv-lista">' +
      '<dt>Bounce</dt><dd style="' + (h.dentro === false ? 'color:#ff7a7a' : '') + '">' + bote[0] + '<small>' + bote[1] + '</small></dd>' +
      '<dt>Contact height</dt><dd>' + (h.altura != null ? fmt(h.altura, 2) + ' m' : '–') + '</dd>' +
      '<dt>Over the net</dt><dd>' + (h.sobre_red != null ? fmt(h.sobre_red, 2) + ' m' : '–') + '<small>clearance</small></dd>' +
      '<dt>Shot to bounce</dt><dd>' + (vuelo != null ? fmt(vuelo, 2) + ' s' : '–') + '</dd>' +
      '<dt>Position when hitting</dt><dd>' + (h.y != null ? fmt(lejos ? L - h.y : h.y) + ' m' : '–') + '<small>from own baseline (− = behind it)</small></dd>' +
      '</dl>' +
      '<div class="perfil"><div class="tit">Ball height, shot to bounce</div>' + perfilSVG(h) + '</div>';
    var e0 = o('ficha').querySelector('[data-o="num"]'), desde = numPrevio, hasta = v || 0, t0 = performance.now();
    numPrevio = hasta;
    if (quieto) { e0.textContent = fmt(hasta, 0); return; }
    (function paso(t) { var k = Math.min(1, (t - t0) / 380); e0.textContent = fmt(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)), 0); if (k < 1) requestAnimationFrame(paso); })(t0);
  }
  function dibujaLatido() {
    var svg = o('latido'); svg.replaceChildren();
    var fa = PT.golpes[0].f, last = PT.golpes[PT.golpes.length - 1], fb = last.bf != null ? last.bf : PT.n - 1;
    var vmax = Math.max.apply(null, PT.golpes.map(function (g) { return g.kmh || 0; }));
    function X(f) { return 30 + ((f - fa) / (fb - fa)) * 940; }
    function mk(tag, at, padre) { var e = el(tag, at); (padre || svg).appendChild(e); return e; }
    mk('line', { x1: 10, x2: 990, y1: 85, y2: 85, stroke: '#2a3a4a', 'stroke-width': 1.5 });
    PT.golpes.forEach(function (h, i) {
      var v = h.kmh || 0, alto = 8 + (v / vmax) * 62, arriba = h.jugador === PT.cerca;
      var g = mk('g', { class: 'barra-g', tabindex: 0, role: 'button', 'aria-label': 'Shot ' + h.n + ': ' + NOMBRE[h.jugador] + ', ' + fmt(v, 0) + ' km/h' });
      mk('rect', { x: X(h.f) - 7, y: arriba ? 85 - alto : 85, width: 14, height: alto, rx: 3, fill: COL[h.jugador], opacity: 0.45, 'data-i': i }, g);
      var t = mk('text', { x: X(h.f), y: arriba ? 85 - alto - 6 : 85 + alto + 15, fill: '#9db0c1', 'font-size': 12, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace' }, g);
      t.textContent = fmt(v, 0);
      g.addEventListener('click', function () { elegir(i, true); });
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { elegir(i, true); e.preventDefault(); } });
    });
    mk('line', { 'data-g': 'aguja', x1: X(fa), x2: X(fa), y1: 6, y2: 164, stroke: '#f2efe8', 'stroke-width': 2 });
    svg._X = X;
  }
  function actualizaLatido() {
    var svg = o('latido');
    svg.querySelectorAll('rect[data-i]').forEach(function (r) {
      var on = Number(r.dataset.i) === sel;
      r.setAttribute('opacity', on ? 1 : 0.45); r.setAttribute('stroke', on ? '#f2efe8' : 'none'); r.setAttribute('stroke-width', on ? 2 : 0);
    });
    var ag = svg.querySelector('[data-g="aguja"]');
    if (ag && svg._X) { var x = svg._X(Math.max(PT.golpes[0].f, tAnim)); ag.setAttribute('x1', x); ag.setAttribute('x2', x); }
  }
  function playTxt() { o('play').textContent = jugando ? '❚❚ Pause' : '▶ Play'; o('play').classList.toggle('on', !jugando); }
  function elegir(i, parar) {
    sel = Math.max(0, Math.min(PT.golpes.length - 1, i));
    if (parar) { jugando = false; playTxt(); tAnim = PT.golpes[sel].f; pintaAnim(); }
    pintaBotes(); pintaSeleccion(); pintaFicha(); actualizaLatido();
  }
  function pintaAnim() {
    var g = capa('capa-anim'); g.replaceChildren();
    var f = tAnim;
    PT.golpes.forEach(function (h) {
      if (h.bf == null || f < h.bf || f > h.bf + 1.5 * PT.fps) return;
      var k = (f - h.bf) / (1.5 * PT.fps), c = P(h.bx, h.by);
      sv('circle', { cx: c[0], cy: c[1], r: 0.3 + 0.5 * k, fill: 'none', stroke: h.dentro === false ? '#ff5a5a' : COL[h.jugador], 'stroke-width': 0.1, opacity: 1 - k }, g);
    });
    var i = Math.round(f / PT.paso);
    Object.keys(PT.jugadores).forEach(function (j) {
      var serie = PT.jugadores[j], p = serie[Math.min(i, serie.length - 1)];
      if (!p || p[0] == null) return;
      var c = P(p[0], p[1]);
      sv('circle', { cx: c[0], cy: c[1], r: 0.45, fill: COL[j], stroke: '#f2efe8', 'stroke-width': 0.08 }, g);
      var t = sv('text', { x: c[0], y: c[1] + (p[1] < RED ? 1.15 : -0.75), fill: '#f2efe8', 'font-size': 0.6, 'text-anchor': 'middle', 'font-family': 'DM Sans, sans-serif', 'font-weight': 700 }, g);
      t.textContent = NOMBRE[j];
    });
    var est = []; for (var k = 18; k >= 0; k--) { var pe = pelotaEn(f - k * PT.paso); if (pe && pe[0] != null) est.push(pe); }
    if (est.length > 1) sv('polyline', { points: est.map(function (p) { return P(p[0], p[1]).join(','); }).join(' '), fill: 'none', stroke: '#9be86a', 'stroke-width': 0.09, opacity: 0.55 }, g);
    var p = pelotaEn(f);
    if (p && p[0] != null) {
      var c = P(p[0], p[1]);
      sv('circle', { cx: c[0], cy: c[1], r: 0.2, fill: '#000', opacity: 0.35 }, g);
      sv('circle', { cx: c[0], cy: c[1] - p[2] * 0.25, r: 0.2 + 0.06 * p[2], fill: '#d8f55a', stroke: '#0f1720', 'stroke-width': 0.04 }, g);
    }
    var fa = inicio(), fb = PT.n - 1;
    o('barra').value = Math.round((1000 * (f - fa)) / (fb - fa));
    actualizaLatido();
    o('reloj').textContent = fmt((f - f0) / PT.fps) + ' s / ' + fmt((fb - f0) / PT.fps) + ' s';
  }
  function inicio() { return Math.max(0, f0 - Math.round(0.3 * PT.fps)); }
  function bucle(ts) {
    if (!jugando) { ultimoT = null; return; }
    if (ultimoT != null) tAnim += ((ts - ultimoT) / 1000) * PT.fps * vel;
    ultimoT = ts;
    if (tAnim >= PT.n - 1) { tAnim = PT.n - 1; jugando = false; playTxt(); }
    var k = -1; PT.golpes.forEach(function (h, j) { if (h.f <= tAnim) k = j; });
    if (k >= 0 && k !== sel) elegir(k, false);
    pintaAnim();
    requestAnimationFrame(bucle);
  }
  o('play').addEventListener('click', function () {
    if (!PT) return;
    jugando = !jugando;
    if (jugando && tAnim >= PT.n - 1) tAnim = inicio();
    playTxt();
    if (jugando) requestAnimationFrame(bucle);
  });
  o('vel').addEventListener('click', function () { vel = vel === 1 ? 2 : vel === 2 ? 0.5 : 1; o('vel').textContent = 'Speed ' + vel + '×'; });
  o('barra').addEventListener('input', function (e) {
    if (!PT) return;
    tAnim = inicio() + (e.target.value / 1000) * (PT.n - 1 - inicio());
    var k = 0; PT.golpes.forEach(function (h, j) { if (h.f <= tAnim) k = j; }); elegir(k, false); pintaAnim();
  });
  root.addEventListener('keydown', function (e) {
    if (!PT || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { elegir(sel + 1, true); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { elegir(sel - 1, true); e.preventDefault(); }
  });

  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    PT = d; COL = d.colores; NOMBRE = d.nombres; f0 = d.f_saque;
    o('rotulo').textContent = d.rotulo;
    o('ngolpes').textContent = d.golpes.length;
    o('arriba').innerHTML = '<span style="color:' + COL[d.cerca] + '">▲ ' + NOMBRE[d.cerca] + '</span>';
    o('abajo').innerHTML = '<span style="color:' + COL[d.lejos] + '">▼ ' + NOMBRE[d.lejos] + '</span>';
    function fila(j, clase) {
      return '<span class="nom ' + clase + '">' + j + '</span><span class="saq ' + clase + '">' + (d.saca === j ? '●' : '') + '</span>' +
        d.marcador[j].map(function (x, i) { return '<span class="' + (i === d.marcador[j].length - 1 ? 'pts' : 'set') + ' ' + clase + '">' + x + '</span>'; }).join('');
    }
    o('bug').innerHTML = fila(d.cerca, '') + fila(d.lejos, 'fila2');
    o('resumen').innerHTML = '<span>Shots <b>' + d.golpes.length + '</b></span><span>Length <b>' + fmt(d.duracion) + ' s</b></span>' +
      '<span>Won by <b>' + NOMBRE[d.gana] + '</b> · ' + d.final + '</span>' +
      '<span>Ran <b>' + fmt(d.distancia[d.cerca]) + ' m</b> ' + NOMBRE[d.cerca] + ' · <b>' + fmt(d.distancia[d.lejos]) + ' m</b> ' + NOMBRE[d.lejos] + '</span>';
    dibujaLatido(); dibujaPista(); pintaBotes(); tAnim = inicio(); elegir(0, false); pintaAnim();
  }).catch(function () { o('resumen').textContent = 'The point data could not be loaded.'; });
})();
