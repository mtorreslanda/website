/* Front page behaviour. Everything is readable without this script:
   it only adds motion, and it adds none when the system asks for reduced motion. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var THEME = { ink: '#1A1A1A', eye: '#F5F3EE' };
  var THEME_DARK = { ink: '#F5F3EE', eye: '#2A2A2A' };

  /* ---------------------------------------------------------------- nav */
  var nav = document.querySelector('.nav');
  var contact = document.querySelector('.section-contact');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 50);
    var r = contact.getBoundingClientRect();
    nav.classList.toggle('on-dark', r.top < 60 && r.bottom > 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------- text: letters rise */
  document.querySelectorAll('[data-letters]').forEach(function (el) {
    if (reduce) return;
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var base = parseFloat(el.getAttribute('data-letters')) || 0;
    Array.prototype.forEach.call(text, function (ch, i) {
      var s = document.createElement('span');
      s.className = 'ltr';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch === ' ' ? ' ' : ch;
      s.style.animationDelay = (base + i * 0.045) + 's';
      el.appendChild(s);
    });
  });

  /* ---------------------------------------------------------------- text: decode on view */
  var GLYPHS = '▖▗▘▙▚▛▜▝▞▟░▒#/<>01';
  function scramble(el) {
    var final = el.getAttribute('data-final');
    var n = final.length, frame = 0, total = 18 + n;
    function tick() {
      var out = '';
      for (var i = 0; i < n; i++) {
        if (final[i] === ' ' || i < frame - 12) out += final[i];
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (++frame <= total) requestAnimationFrame(function () { setTimeout(tick, 28); });
      else el.textContent = final;
    }
    tick();
  }
  var scr = document.querySelectorAll('[data-scramble]');
  scr.forEach(function (el) { el.setAttribute('data-final', el.textContent); el.setAttribute('aria-label', el.textContent); });

  /* ---------------------------------------------------------------- reveal on view */
  var reveal = document.querySelectorAll('.rv, [data-scramble], .row');
  function show(el) {
    if (el.classList.contains('in')) return;
    el.classList.add('in');
    if (el.hasAttribute('data-scramble') && !reduce) scramble(el);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        setTimeout(function () { show(el); }, el.classList.contains('row') ? Math.min(sibs, 10) * 70 : 0);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveal.forEach(function (el) { io.observe(el); });
  }
  setTimeout(function () { reveal.forEach(show); }, 5000);   // never leave anything hidden

  /* ---------------------------------------------------------------- nav links: decode on hover */
  if (!reduce) document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.setAttribute('data-final', a.textContent);
    a.addEventListener('mouseenter', function () { scramble(a); });
  });

  /* ---------------------------------------------------------------- robots */
  var R = window.Robot;
  var seed = Math.floor(Date.now() / 1000);
  var bot = R.make(seed);
  var heroCanvas = document.getElementById('robot');
  var tag = document.getElementById('robot-tag');
  var hero = { particles: null, t0: 0, dur: 900 };
  var heroVisible = true;

  function setFavicon(b) {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d');
    x.fillStyle = '#F5F3EE'; x.fillRect(0, 0, 32, 32);
    R.draw(x, b, {}, 0, -0.5, 2, THEME, false);
    var link = document.querySelector('link[rel="icon"]');
    if (link) { link.type = 'image/png'; link.href = c.toDataURL('image/png'); }
  }

  function heroSize() {
    var dpr = window.devicePixelRatio || 1;
    var w = heroCanvas.clientWidth;
    heroCanvas.width = Math.round(w * dpr);
    heroCanvas.height = Math.round(w * (R.H + 2) / R.W * dpr);
    return heroCanvas.width / R.W;
  }

  function rebuild(newSeed) {
    var old = bot;
    seed = newSeed >>> 0;
    bot = R.make(seed);
    setFavicon(bot);
    if (tag) tag.textContent = 'unit ' + String(seed % 100000).padStart(5, '0') + ' · ' + R.describe(bot);
    if (walker) walker.bot = bot;
    if (reduce) { hero.particles = null; drawHero(); return; }
    var from = R.cells(old, {}), to = R.cells(bot, {});
    hero.particles = to.map(function (p, i) {
      var src = from[i % from.length];
      var scatter = Math.random() < 0.35;
      return {
        x0: scatter ? Math.random() * R.W : src.x, y0: scatter ? -2 - Math.random() * 6 : src.y,
        x1: p.x, y1: p.y, c: p.c, delay: (p.y / R.H) * 260 + Math.random() * 180
      };
    });
    hero.t0 = performance.now();
  }

  function ease(t) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  var blinkUntil = 0, nextBlink = performance.now() + 2500;
  function drawHero(now) {
    now = now || performance.now();
    var s = heroCanvas.width / R.W;
    var ctx = heroCanvas.getContext('2d');
    ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
    var oy = s * 1.5;
    if (hero.particles) {
      var done = true;
      hero.particles.forEach(function (p) {
        var t = Math.min(1, Math.max(0, (now - hero.t0 - p.delay) / hero.dur));
        if (t < 1) done = false;
        var e = ease(t);
        ctx.fillStyle = R.color(p.c, bot, THEME);
        ctx.fillRect(Math.round((p.x0 + (p.x1 - p.x0) * e) * s), Math.round(oy + (p.y0 + (p.y1 - p.y0) * e) * s),
                     Math.ceil(s), Math.ceil(s));
      });
      if (done) hero.particles = null;
      return;
    }
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2500 + Math.random() * 3000; }
    var bob = reduce ? 0 : (Math.sin(now / 700) > 0 ? -s * 0.25 : 0);
    // shadow on the ground, narrower when the robot is up
    ctx.fillStyle = 'rgba(26,26,26,0.12)';
    var sw = bob ? 6 : 8;
    ctx.fillRect(Math.round((R.W - sw) / 2 * s), Math.round(oy + R.H * s + s * 0.3), Math.round(sw * s), Math.round(s * 0.6));
    var pulse = reduce ? false : (Math.floor(now / 900) % 3 === 0);
    R.draw(ctx, bot, { blink: now < blinkUntil, pulse: pulse }, 0, oy + bob, s, THEME, false);
  }

  heroSize();
  rebuild(seed);
  hero.particles = null;          // first robot appears built
  window.addEventListener('resize', function () { heroSize(); drawHero(); });
  heroCanvas.addEventListener('click', function () { rebuild(seed + 7919); });
  heroCanvas.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rebuild(seed + 7919); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe(heroCanvas);
  }
  if (!reduce) setInterval(function () { if (heroVisible && !document.hidden) rebuild(seed + 7919); }, 12000);

  /* ---- the walker: a small copy of the same robot that lives at the bottom of the screen */
  var walker = null;
  var wc = document.getElementById('walker');
  if (wc && !reduce) {
    var S = 3;
    var dpr = window.devicePixelRatio || 1;
    wc.width = Math.round(R.W * S * dpr); wc.height = Math.round((R.H + 4) * S * dpr);
    wc.style.width = R.W * S + 'px'; wc.style.height = (R.H + 4) * S + 'px';
    walker = { bot: bot, x: 40, dir: 1, state: 'walk', until: performance.now() + 4000, step: 0,
               lastStep: 0, jumpT: -1, wave: false, lastY: window.scrollY };
    wc.addEventListener('mouseenter', function () { walker.wave = true; });
    wc.addEventListener('mouseleave', function () { walker.wave = false; });
    wc.addEventListener('click', function () { rebuild(seed + 7919); walker.jumpT = performance.now(); });
    window.addEventListener('scroll', function () {
      var dy = Math.abs(window.scrollY - walker.lastY);
      walker.lastY = window.scrollY;
      if (dy > 120 && walker.jumpT < 0) walker.jumpT = performance.now();
    }, { passive: true });
  }

  var last = performance.now();
  function walkerTick(now) {
    var dt = Math.min(64, now - last);
    if (now > walker.until) {
      if (walker.state === 'walk') { walker.state = 'idle'; walker.until = now + 1500 + Math.random() * 2500; }
      else {
        walker.state = 'walk'; walker.until = now + 3000 + Math.random() * 5000;
        if (Math.random() < 0.4) walker.dir *= -1;
      }
    }
    var maxX = window.innerWidth - R.W * 3 - 16;
    if (walker.state === 'walk' && !walker.wave) {
      walker.x += walker.dir * dt * 0.045;
      if (walker.x > maxX) { walker.x = maxX; walker.dir = -1; }
      if (walker.x < 16) { walker.x = 16; walker.dir = 1; }
      if (now - walker.lastStep > 170) { walker.step ^= 1; walker.lastStep = now; }
    } else walker.step = 0;
    var jy = 0;
    if (walker.jumpT >= 0) {
      var t = (now - walker.jumpT) / 450;
      if (t >= 1) walker.jumpT = -1; else jy = -Math.sin(t * Math.PI) * 9;
    }
    wc.style.transform = 'translate(' + Math.round(walker.x) + 'px,' + Math.round(jy) + 'px)';
    var r = contact.getBoundingClientRect();
    var onDark = r.top < window.innerHeight - 20;
    var ctx = wc.getContext('2d');
    var s = wc.width / R.W;
    ctx.clearRect(0, 0, wc.width, wc.height);
    R.draw(ctx, walker.bot, { step: walker.step, blink: now < blinkUntil, wave: walker.wave },
           0, s * 3, s, onDark ? THEME_DARK : THEME, walker.dir < 0);
  }

  function loop() {
    var now = performance.now();
    if (heroVisible || hero.particles) drawHero(now);
    if (walker) walkerTick(now);
    worksTick();
    last = now;
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- work: horizontal track */
  var section = document.querySelector('.section-work');
  var track = document.querySelector('.work-track');
  var tx = 0, txTarget = 0, horizontal = false;
  function layoutWork() {
    horizontal = window.innerWidth >= 900 && !reduce;
    section.classList.toggle('horizontal', horizontal);
    if (!horizontal) { section.style.height = ''; track.style.transform = ''; return; }
    var extra = track.scrollWidth - window.innerWidth + 128;
    section.style.height = (window.innerHeight + Math.max(0, extra)) + 'px';
  }
  function worksTick() {
    if (!horizontal) return;
    var rect = section.getBoundingClientRect();
    var max = section.offsetHeight - window.innerHeight;
    var extra = track.scrollWidth - window.innerWidth + 128;
    var p = Math.min(1, Math.max(0, -rect.top / Math.max(1, max)));
    txTarget = -p * Math.max(0, extra);
    tx += (txTarget - tx) * 0.12;
    track.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0)';
    var bar = document.querySelector('.work-progress span');
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
  }
  layoutWork();
  window.addEventListener('resize', layoutWork);
  window.addEventListener('load', layoutWork);

  requestAnimationFrame(loop);
})();
