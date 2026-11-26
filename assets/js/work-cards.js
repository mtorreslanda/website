/* Work cards (SH50): the switch, on demand: [ INSERT COIN ] turns a card on, EJECT turns it off. The paper record (.off) is clipped to the tiles that are still off; tiles flip in order of
   distance from the button pressed (plus noise), each flashing in the project's colour for a moment on a canvas on
   top. EJECT runs it backwards. Numbers in the screens count up when the card turns on. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.card.wc').forEach(function (cd) {
    var off = cd.querySelector('.layer.off'), fx = cd.querySelector('.fx'), g = fx.getContext('2d');
    var led = getComputedStyle(cd).getPropertyValue('--led').trim() || '#F2945A';
    var T = 20, tiles = [], k = 0, target = 0, raf = null, flashes = [];
    function build(ex, ey) {
      var W = cd.clientWidth, H = cd.clientHeight; fx.width = W; fx.height = H;
      var t = [];
      for (var y = 0; y < H; y += T) for (var x = 0; x < W; x += T)
        t.push({ x: x, y: y, d: Math.hypot(x + T / 2 - ex, y + T / 2 - ey) / Math.hypot(W, H) + Math.random() * .22 });
      t.sort(function (a, b) { return a.d - b.d; }); tiles = t;
    }
    function clip() {
      if (k === 0) { off.style.clipPath = ''; return; }
      if (k >= tiles.length) { off.style.clipPath = 'inset(50%)'; return; }
      var d = ''; for (var i = k; i < tiles.length; i++) d += 'M' + tiles[i].x + ' ' + tiles[i].y + 'h' + T + 'v' + T + 'h-' + T + 'z';
      off.style.clipPath = "path('" + d + "')";
    }
    function frame(now) {
      var step = Math.ceil(tiles.length / 24);
      for (var n = 0; n < step && k !== target; n++) {
        var t = target > k ? tiles[k++] : tiles[--k];
        flashes.push({ x: t.x, y: t.y, t0: now, on: target > 0 });
      }
      clip();
      g.clearRect(0, 0, fx.width, fx.height);
      flashes = flashes.filter(function (f) {
        var a = 1 - (now - f.t0) / 220; if (a <= 0) return false;
        g.globalAlpha = f.on ? .85 * a : .5 * a; g.fillStyle = f.on ? led : '#1A1A1A'; g.fillRect(f.x, f.y, T, T); g.globalAlpha = 1; return true;
      });
      raf = (k !== target || flashes.length) ? requestAnimationFrame(frame) : null;
    }
    function count() {
      cd.querySelectorAll('[data-to]').forEach(function (b) {
        var txt = b.dataset.to, to = parseFloat(txt.replace(/,/g, '')), dec = (txt.split('.')[1] || '').length, comma = txt.indexOf(',') > -1, t0 = performance.now();
        if (!/^[\d.,]+$/.test(txt) || reduce) return;
        (function tick(t) {
          var q = Math.min(1, (t - t0) / 900), v = to * (1 - Math.pow(1 - q, 3));
          b.textContent = comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec);
          if (q < 1) requestAnimationFrame(tick); else b.textContent = txt;
        })(t0);
      });
    }
    var lit = false, coin = cd.querySelector('.coin'), eject = cd.querySelector('.eject'), onL = cd.querySelector('.layer.on');
    function go(on, from) {
      lit = on; cd.classList.toggle('lit', on); coin.setAttribute('aria-pressed', String(on));
      onL.toggleAttribute('inert', !on); onL.setAttribute('aria-hidden', String(!on));
      if (reduce) { off.style.clipPath = on ? 'inset(50%)' : ''; off.toggleAttribute('inert', on); return; }
      if (on && k === 0) { var r = cd.getBoundingClientRect(), b = from.getBoundingClientRect(); build(b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top); }
      if (!tiles.length) return;
      target = on ? tiles.length : 0; if (!raf) raf = requestAnimationFrame(frame);
      off.toggleAttribute('inert', on);
      if (on) { count(); setTimeout(function () { if (lit) eject.focus({ preventScroll: true }); }, 400); }
      else setTimeout(function () { if (!lit) coin.focus({ preventScroll: true }); }, 400);
    }
    // the coin slot switches it on, starting from the slot; EJECT switches it off, folding back into the eject key
    coin.addEventListener('click', function () { go(true, coin); });
    eject.addEventListener('click', function () { go(false, eject); });
  });
})();
