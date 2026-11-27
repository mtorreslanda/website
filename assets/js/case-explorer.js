/* «Ask the rulings»: replays real outputs of the case-law system (assets/data/caselaw-demo.json):
   the question, the hybrid search over the index, the six passages it returned, the local model's answer
   and every citation with its literal passage and the result of the word-for-word check.
   Safeguard: with reduced motion, or if anything goes wrong mid-animation, the final state is shown. */
(function () {
  'use strict';
  var root = document.querySelector('.cx');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return root.querySelector(s); };
  var qs = $('.cx-qs'), qEl = $('.cx-q'), caret = $('.cx-caret'), status = $('.cx-status'), hits = $('.cx-hits'),
      ansHead = $('.cx-answer > i'), text = $('.cx-text'), cites = $('.cx-cites');
  var DATA = [], run = 0, started = false, TOTAL = 364521;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function wait(ms, token) { return new Promise(function (ok, no) { setTimeout(function () { token === run ? ok() : no('stale'); }, ms); }); }

  function build(d) {
    hits.innerHTML = d.passages.map(function (p) {
      return '<li class="wait" data-n="' + p.n + '"><div class="cx-where"><em>[' + p.n + ']</em>' + esc(p.court) + ' District Court · amparo ' +
        esc(p.case) + ' · p. ' + p.page + ' <span>· ' + esc(p.section) + '</span></div><p>' + esc(p.snippet) + '</p></li>';
    }).join('');
    cites.innerHTML = d.citations.map(function (c, i) {
      var st = c.status === 'repaired' ? 'REPAIRED<b>✓</b>' : 'LITERAL<b>✓</b>';
      return '<div class="cx-cite wait" data-n="' + c.n + '" data-i="' + i + '"><div class="cx-where">[' + c.n + '] ' + esc(c.court) +
        ' District Court · amparo ' + esc(c.case) + ' · page ' + c.page + '</div><p>' + esc(c.pre) + '<mark>' + esc(c.quote) + '</mark>' +
        esc(c.post) + '</p><div class="cx-stamp" title="' + (c.status === 'repaired' ? 'Near-literal quote repaired to the exact text of the ruling' :
        'Quote found word for word in the ruling') + '">' + st + '</div></div>';
    }).join('');
    ansHead.textContent = 'Answer · Qwen3.5-9B, running locally · ' + d.t_llm.toFixed(1) + ' s';
  }
  function answerHTML(s) {
    return esc(s).replace(/\[(\d)\]/g, function (m, n) { return '<button type="button" data-n="' + n + '" aria-label="Show passage ' + n + '">[' + n + ']</button>'; });
  }
  function finish(d) {
    qEl.textContent = d.q; caret.hidden = true;
    status.innerHTML = '<span>Searched <b>' + fmt(TOTAL) + '</b> passages · BM25 + bge-m3</span><span>' + d.t_search.toFixed(1) + ' s on the CPU</span>';
    hits.querySelectorAll('li').forEach(function (li) { li.classList.remove('wait'); });
    text.innerHTML = answerHTML(d.answer);
    cites.querySelectorAll('.cx-cite').forEach(function (c) { c.classList.remove('wait'); c.classList.add('stamped'); });
    markCited(d);
  }
  function markCited(d) {
    d.citations.forEach(function (c) { var li = hits.querySelector('li[data-n="' + c.n + '"]'); if (li) li.classList.add('cited'); });
  }

  function play(i) {
    var d = DATA[i], token = ++run;
    qs.querySelectorAll('button').forEach(function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    build(d);
    if (reduce) { finish(d); return; }
    qEl.textContent = ''; caret.hidden = false; text.textContent = ''; status.innerHTML = '<span>&nbsp;</span>';
    var guard = setTimeout(function () { if (token === run) { run++; finish(d); } }, 16000);   // never leave it half-drawn
    var chain = Promise.resolve(), k;
    for (k = 1; k <= d.q.length; k++) (function (k) { chain = chain.then(function () { qEl.textContent = d.q.slice(0, k); return wait(18, token); }); })(k);
    chain.then(function () {                                                               // the search
      caret.hidden = true;
      var t0 = performance.now();
      return new Promise(function (ok, no) {
        (function tick() {
          if (token !== run) return no('stale');
          var f = Math.max(0, Math.min(1, (performance.now() - t0) / 900));
          status.innerHTML = '<span>Searching <b>' + fmt(Math.round(TOTAL * f)) + '</b> passages · BM25 + bge-m3</span><span>' + (f < 1 ? '…' : d.t_search.toFixed(1) + ' s on the CPU') + '</span>';
          if (f < 1) requestAnimationFrame(tick); else ok();
        })();
      });
    }).then(function () {                                                                  // the six passages
      var lis = hits.querySelectorAll('li'), p = Promise.resolve();
      lis.forEach(function (li) { p = p.then(function () { li.classList.remove('wait'); return wait(110, token); }); });
      return p;
    }).then(function () { markCited(d); return wait(350, token); })
      .then(function () {                                                                  // the answer, word by word
        var words = d.answer.split(' '), p = Promise.resolve();
        words.forEach(function (w, n) { p = p.then(function () { text.innerHTML = answerHTML(words.slice(0, n + 1).join(' ')); return wait(26, token); }); });
        return p;
      }).then(function () {                                                                // citations, stamped one by one
        var cs = cites.querySelectorAll('.cx-cite'), p = Promise.resolve();
        cs.forEach(function (c) { p = p.then(function () { c.classList.remove('wait'); c.classList.add('stamped'); return wait(480, token); }); });
        return p;
      }).then(function () { clearTimeout(guard); }, function (e) { clearTimeout(guard); if (e !== 'stale' && token === run) finish(d); });
  }

  function focus(n, on) {
    hits.querySelectorAll('li').forEach(function (li) { li.classList.toggle('focus', on && li.dataset.n === String(n)); });
  }
  root.addEventListener('mouseover', function (e) { var t = e.target.closest('[data-n]'); if (t && !t.matches('li')) focus(t.dataset.n, true); });
  root.addEventListener('mouseout', function (e) { var t = e.target.closest('[data-n]'); if (t && !t.matches('li')) focus(t.dataset.n, false); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('.cx-text button'); if (!b) return;
    var li = hits.querySelector('li[data-n="' + b.dataset.n + '"]');
    if (li) { focus(b.dataset.n, true); li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }
  });

  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    qs.innerHTML = d.map(function (x, i) {
      return '<button type="button" role="tab" aria-selected="false" data-i="' + i + '">' + esc(x.q_en) + '<small>' + esc(x.q) + '</small></button>';
    }).join('');
    qs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) play(+b.dataset.i); });
    build(d[0]); finish(d[0]);                                                              // visible from the start
    qs.querySelector('button').setAttribute('aria-selected', 'true');
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !started) { started = true; io.disconnect(); play(0); }
    }, { threshold: .35 });
    io.observe(root);
  }).catch(function () {
    root.querySelector('.cx-desk').insertAdjacentHTML('beforeend',
      '<p class="cx-note">The demo could not load here. The same questions and answers are in the write-up on GitHub.</p>');
  });
})();
