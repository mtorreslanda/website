/* «Scan a folder»: replays real outputs of the signature tool (assets/data/sig-demo.json) on ten PDFs built from
   public scanned pages. For each page: every candidate box the detector proposed, with the detector, classifier,
   vision-model and combined scores. A mode keeps the candidates at or above its threshold (the same thresholds as
   the notebook); overlapping kept boxes form one signature area, as in the tool's report.
   Safeguard: with reduced motion, or if anything goes wrong mid-animation, the final state is shown. */
(function () {
  'use strict';
  var root = document.querySelector('.sx');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return root.querySelector(s); };
  var modesEl = $('.sx-modes'), files = $('.sx-files'), nameEl = $('.sx-name'), pager = $('.sx-pager'), img = $('.sx-img'),
      boxes = $('.sx-boxes'), bar = $('.sx-bar'), crops = $('.sx-crops'), tally = $('.sx-tally');
  var MODES = [
    { k: 'det', id: 'detector', label: 'Detector only', note: 'recall 95% · false alarms 30%' },
    { k: 'cls', id: 'classifier', label: 'Detector + classifier', note: 'recall 90% · false alarms 9%' },
    { k: 'vlm', id: 'vlm', label: 'Detector + vision model', note: 'recall 90% · false alarms 3%' },
    { k: 'geo', id: 'geo', label: 'Classifier + vision model', note: 'recall 94% · false alarms 9%' }];
  // what the demo pages contain, by construction (signed_pages) and by looking at them
  var MARKS = { 'internal_email.pdf': 'no signature, but a handwritten mark next to the header',
                'supplier_letter.pdf': 'signed on page 2; page 1 carries handwritten notes and initials' };
  var D = null, mode = MODES[3], cur = 0, page = 0, scanned = [], run = 0, auto = true;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function wait(ms, token) { return new Promise(function (ok, no) { setTimeout(function () { token === run ? ok() : no('stale'); }, ms); }); }
  function thr() { return D.thresholds[mode.id]; }
  function overlap(a, b) {                       // intersection over the smaller box, as in the tool
    var ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    return ix * iy / Math.max(1e-6, Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])));
  }
  // kept candidates of a page, grouped into signature areas (link 0.2, chained), best first
  function areas(p) {
    var kept = p.cands.filter(function (c) { return c[mode.k] >= thr(); }), par = kept.map(function (_, i) { return i; });
    function r(i) { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }
    for (var i = 0; i < kept.length; i++) for (var j = i + 1; j < kept.length; j++) if (overlap(kept[i].box, kept[j].box) >= .2) par[r(i)] = r(j);
    var g = {};
    kept.forEach(function (c, i) {
      var k = r(i), a = g[k];
      if (!a) g[k] = { s: c[mode.k], best: c, box: c.box.slice() };
      else { if (c[mode.k] > a.s) { a.s = c[mode.k]; a.best = c; }
             a.box = [Math.min(a.box[0], c.box[0]), Math.min(a.box[1], c.box[1]), Math.max(a.box[2], c.box[2]), Math.max(a.box[3], c.box[3])]; }
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.s - a.s; });
  }
  function docFlag(d) { return d.pages.some(function (p) { return areas(p).length > 0; }); }

  function chip(i) {
    var d = D.docs[i], li = files.children[i], c = li.querySelector('.sx-chip'), truth = d.signed_pages.length > 0;
    if (!scanned[i]) { c.className = 'sx-chip ' + (i === cur && !reduce ? 'busy' : 'wait'); c.textContent = i === cur ? 'scanning' : '·'; return; }
    var f = docFlag(d);
    c.className = 'sx-chip ' + (f ? 'yes' : 'no') + (f !== truth ? ' bad' : '');
    c.textContent = f ? 'signed' : 'none';
    c.title = f === truth ? (truth ? 'Flagged, and it is signed' : 'Not flagged, and it is not signed')
                          : (truth ? 'Missed: it is signed' : 'False alarm: ' + (MARKS[d.file] || 'not signed'));
  }
  function drawTally() {
    var n = scanned.filter(Boolean).length, fl = 0, tp = 0, fp = [], miss = [];
    D.docs.forEach(function (d, i) {
      if (!scanned[i]) return;
      var f = docFlag(d), t = d.signed_pages.length > 0;
      if (f) fl++; if (f && t) tp++; if (f && !t) fp.push(d.file); if (!f && t) miss.push(d.file);
    });
    var signed = D.docs.filter(function (d, i) { return scanned[i] && d.signed_pages.length; }).length;
    tally.innerHTML = '<span>Scanned <b>' + n + '</b> of ' + D.docs.length + ' PDFs</span><span>Flagged <b>' + fl + '</b></span>' +
      '<span>Signed documents found <b>' + tp + ' of ' + signed + '</b></span>' +
      '<span>Flagged without a signature <b>' + fp.length + '</b>' + (fp.length ? ' (' + fp.map(esc).join(', ') + ')' : '') + '</span>' +
      (miss.length ? '<span>Missed <b>' + miss.map(esc).join(', ') + '</b></span>' : '');
  }
  function drawPage(reveal) {
    var d = D.docs[cur], p = d.pages[page], a = areas(p), t = thr();
    nameEl.textContent = d.file;
    pager.innerHTML = d.pages.length > 1 ? 'page ' + d.pages.map(function (_, i) {
      return '<button type="button" aria-current="' + (i === page) + '" data-p="' + i + '">' + (i + 1) + '</button>'; }).join('') : 'page 1 of 1';
    img.src = '../assets/img/sig-demo/' + p.thumb; img.width = p.w; img.height = p.h;
    img.alt = 'Page ' + (page + 1) + ' of ' + d.file;
    var html = '';
    p.cands.forEach(function (c) {                                  // candidates this mode drops (only the ones worth seeing)
      if (c[mode.k] >= t || c.det < .1) return;
      html += box(c.box, p, 'drop' + (c.det < .3 ? ' low' : ''), mode.k === 'det' ? c.det.toFixed(2) : 'det ' + c.det.toFixed(2) + ' → ' + c[mode.k].toFixed(2));
    });
    a.forEach(function (ar) { html += box(ar.box, p, 'keep', ar.s.toFixed(2)); });
    boxes.innerHTML = html;
    if (reveal) boxes.querySelectorAll('.sx-box').forEach(function (b) { b.classList.add('wait'); });
    drawCrops(reveal);
  }
  function box(b, p, cls, label) {
    return '<div class="sx-box ' + cls + '" data-top="' + (b[1] / p.h) + '" style="left:' + (100 * b[0] / p.w).toFixed(2) + '%;top:' +
      (100 * b[1] / p.h).toFixed(2) + '%;width:' + (100 * (b[2] - b[0]) / p.w).toFixed(2) + '%;height:' + (100 * (b[3] - b[1]) / p.h).toFixed(2) +
      '%"><span>' + label + '</span></div>';
  }
  function drawCrops(hide) {
    var d = D.docs[cur], out = [];
    if (hide) { crops.innerHTML = ''; return; }
    d.pages.forEach(function (p, i) { areas(p).forEach(function (a) { out.push({ a: a, pg: i + 1 }); }); });
    out.sort(function (x, y) { return y.a.s - x.a.s; });
    crops.innerHTML = out.length ? out.slice(0, 4).map(function (o) {
      return '<div class="sx-crop"><img src="../assets/img/sig-demo/' + o.a.best.crop + '" alt="Signature crop, page ' + o.pg + '"><div><span>page ' + o.pg +
        '</span><b>' + o.a.s.toFixed(2) + '</b></div><div class="sx-meter"><i style="width:' + Math.min(100, o.a.s * 100).toFixed(0) + '%"></i></div></div>';
    }).join('') : '<p class="sx-empty">No candidate reaches the threshold (' + thr().toFixed(2) + '): the document goes to "no signature".</p>';
    if (MARKS[d.file]) crops.insertAdjacentHTML('beforeend', '<p class="sx-empty">What is on it: ' + esc(MARKS[d.file]) + '.</p>');
  }
  function select(i, pg) {
    cur = i; page = pg || 0;
    Array.prototype.forEach.call(files.children, function (li, k) { li.classList.toggle('cur', k === cur); });
  }
  // sweep the light bar down the current page and reveal the boxes it passes
  function sweep(token, ms) {
    var list = boxes.querySelectorAll('.sx-box'); bar.hidden = false;
    return new Promise(function (ok, no) {
      var t0 = performance.now();
      (function tick(now) {
        if (token !== run) { bar.hidden = true; return no('stale'); }
        var k = Math.min(1, (now - t0) / ms);
        bar.style.top = (k * 100) + '%';
        list.forEach(function (b) { if (+b.dataset.top <= k) b.classList.remove('wait'); });
        if (k < 1) requestAnimationFrame(tick); else { bar.hidden = true; ok(); }
      })(t0);
    });
  }
  function finish() {
    run++; bar.hidden = true;
    D.docs.forEach(function (_, i) { scanned[i] = true; });
    drawPage(false); D.docs.forEach(function (_, i) { chip(i); }); drawTally();
  }
  async function play(from) {
    var token = ++run;
    try {
      for (var i = from; i < D.docs.length; i++) {
        if (!auto) return;
        for (var pg = 0; pg < D.docs[i].pages.length; pg++) {
          select(i, pg); chip(i); drawPage(true);
          await wait(150, token); await sweep(token, 1100); await wait(250, token);
        }
        scanned[i] = true; chip(i); drawCrops(false); drawTally();
        await wait(900, token);
      }
      auto = false; select(2, 1); drawPage(false); drawCrops(false);  // end on a letter: a signature kept, a logo dropped
    } catch (e) { if (e !== 'stale') finish(); }
  }
  async function open(i, pg) {
    auto = false; var token = ++run, first = !scanned[i];
    select(i, pg); if (first) chip(i); drawPage(!reduce && first);
    try {
      if (first && !reduce) { await sweep(token, 900); }
      scanned[i] = true; chip(i); drawCrops(false); drawTally();
    } catch (e) { if (e !== 'stale') finish(); }
  }
  function build() {
    modesEl.innerHTML = MODES.map(function (m) {
      return '<button type="button" role="tab" aria-selected="' + (m === mode) + '" data-m="' + m.id + '">' + m.label +
        '<small>threshold ' + D.thresholds[m.id].toFixed(2) + ' · ' + m.note + '</small></button>'; }).join('');
    files.innerHTML = D.docs.map(function (d, i) {
      return '<li><button type="button" data-i="' + i + '"><span class="fn">' + esc(d.file) + '</span><span class="sx-chip wait">·</span></button></li>'; }).join('');
    modesEl.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      mode = MODES.filter(function (m) { return m.id === b.dataset.m; })[0];
      modesEl.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      drawPage(false); D.docs.forEach(function (_, i) { chip(i); }); drawTally();
    });
    files.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) open(+b.dataset.i, 0); });
    pager.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { page = +b.dataset.p; drawPage(false); } });
    select(0, 0); drawPage(true); drawTally();
  }
  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    D = d; scanned = D.docs.map(function () { return false; }); build();
    if (reduce || !("IntersectionObserver" in window)) { select(2, 1); finish(); return; }
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return; io.disconnect(); if (auto) play(0);
    }, { threshold: .35 });
    io.observe(root);
  }).catch(function () { tally.textContent = 'The demo data could not be loaded.'; });
})();
