/* «One model, twenty-eight opponents»: the submitted agent's win rate against each opponent of the bench
   (assets/data/ptcg-bench.json; 50 games per opponent, alternating seats). The 50 dots are a count of wins and
   losses, not the order in which the games were played.
   Safeguard: with reduced motion the bars and dots appear at once. */
(function () {
  'use strict';
  var root = document.querySelector('.bx');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s) { return root.querySelector(s); };
  var list = $('.bx-list'), nameEl = $('.bx-name'), rateEl = $('.bx-rate'), subEl = $('.bx-sub'), dots = $('.bx-dots'),
      note = $('.bx-note'), sum = $('.bx-sum');
  // what we know about some opponents, from the project's notes
  var NOTES = {
    crustle_wall: 'Immune to damage from Pokémon ex. The collector found the answer on its own: attack with Chi-Yu, the deck\'s only non-ex attacker. The first random collector had found no winning path in 17,543.',
    grimmsnarl_ml: 'The hardest opponent that is a learnt model: 1,315 trees over 256 features. After the deadline, PPO on the policy took this matchup from 15.9% to 35.0%.',
    gengar_delay: 'Where specialising the value network bought +43 points (31.7% to 75.0%) before the multi-opponent model.',
    dragapult_spread: 'Won all 50 games.',
    iono_rb: 'The weakest matchup on the bench: 2 wins in 50.',
    lucario_v2: 'The opponent the early "48%" had been measured against, before the bench existed.',
    starmie_budew: 'Rebuilt by us from the description in a public notebook that had no code.'
  };
  var D = null, order = 'rate', cur = 0, run = 0;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rows() {
    var r = D.bench.map(function (b, i) { return { name: b[0], pct: b[1], i: i }; });
    if (order === 'name') r.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return r;
  }
  function draw(animate) {
    var r = rows();
    list.innerHTML = r.map(function (b) {
      return '<li' + (b.i === cur ? ' class="cur"' : '') + '><button type="button" data-i="' + b.i + '" aria-label="' + esc(b.name) + ', ' + b.pct + '% won">' +
        '<span class="nm">' + esc(b.name) + '</span><span class="tr"><span class="br ' + (b.pct >= 50 ? 'w' : 'l') + '" data-w="' + b.pct + '"></span></span>' +
        '<span class="pc">' + b.pct + '%</span></button></li>';
    }).join('');
    var bars = list.querySelectorAll('.br');
    function grow() { bars.forEach(function (b) { b.style.width = b.dataset.w + '%'; }); }
    if (animate && !reduce) requestAnimationFrame(function () { requestAnimationFrame(grow); }); else grow();
  }
  function show(i) {
    cur = i; var b = D.bench[i], n = D.games, w = Math.round(b[1] * n / 100), token = ++run;
    list.querySelectorAll('li').forEach(function (li) { li.classList.toggle('cur', +li.querySelector('button').dataset.i === i); });
    nameEl.textContent = b[0];
    rateEl.textContent = b[1] + '%';
    rateEl.style.color = b[1] >= 50 ? 'var(--win)' : 'var(--loss)';
    subEl.textContent = w + ' won, ' + (n - w) + ' lost';
    dots.innerHTML = new Array(n + 1).join('<i></i>');
    var ds = dots.querySelectorAll('i');
    ds.forEach(function (d, k) {
      if (k < w) d.classList.add('w');
      if (reduce) d.classList.add('on');
      else setTimeout(function () { if (token === run) d.classList.add('on'); }, 12 * k);
    });
    note.textContent = NOTES[b[0]] || (b[1] >= 50 ? 'Won more than half of the games.' : 'Lost more than half of the games.');
  }
  fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    var above = D.bench.filter(function (b) { return b[1] > 50; }).length;
    sum.innerHTML = '<dt>Bench</dt><dd>' + D.total[0] + ' of ' + D.total[1].toLocaleString('en-US') + ' games · ' +
      (100 * D.total[0] / D.total[1]).toFixed(1) + '%</dd><dt>Above half</dt><dd>' + above + ' of ' + D.bench.length + ' opponents</dd>' +
      '<dt>Before</dt><dd>best earlier agent ' + D.previous.toFixed(1) + '% on the same bench</dd>';
    draw(false);
    list.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(+b.dataset.i); });
    root.querySelectorAll('.bx-tools button').forEach(function (b) {
      b.addEventListener('click', function () {
        order = b.dataset.o; root.querySelectorAll('.bx-tools button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        draw(false);
      });
    });
    var start = D.bench.map(function (b) { return b[0]; }).indexOf('crustle_wall');
    list.querySelectorAll('.br').forEach(function (b) { b.style.width = '0'; });
    if (!reduce && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; io.disconnect(); draw(true); show(start);
      }, { threshold: .3 });
      io.observe(root);
    } else { draw(false); show(start); }
  }).catch(function () { note.textContent = 'The bench data could not be loaded.'; });
})();
