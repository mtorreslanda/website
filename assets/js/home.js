/* Front page behaviour. Everything is readable without this script:
   it only adds motion, and it adds none when the system asks for reduced motion. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var THEME = { ink: '#1A1A1A', eye: '#F5F3EE' };
  var THEME_DARK = { ink: '#F5F3EE', eye: '#2A2A2A' };
  var R = window.Robot;

  /* ================================================================ nav */
  var nav = document.querySelector('.nav');
  var contact = document.querySelector('.section-contact');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 50);
    var r = contact.getBoundingClientRect();
    nav.classList.toggle('on-dark', r.top < 60 && r.bottom > 60);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ================================================================ text: letters rise */
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

  /* ================================================================ text: decode */
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
      if (++frame <= total) setTimeout(tick, 28);
      else el.textContent = final;
    }
    tick();
  }
  document.querySelectorAll('[data-scramble]').forEach(function (el) {
    el.setAttribute('data-final', el.textContent); el.setAttribute('aria-label', el.textContent);
  });

  /* roles under the name: one after another, decoded */
  var roles = document.querySelector('.hero-roles');
  if (roles && !reduce) {
    roles.querySelectorAll('span').forEach(function (sp, i) {
      sp.setAttribute('data-final', sp.textContent);
      sp.style.visibility = 'hidden';
      setTimeout(function () { sp.style.visibility = ''; scramble(sp); }, 900 + i * 260);
    });
  }

  /* ================================================================ reveal on view */
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
        var k = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        setTimeout(function () { show(el); }, el.classList.contains('row') ? Math.min(k, 10) * 70 : 0);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    reveal.forEach(function (el) { io.observe(el); });
  }
  setTimeout(function () { reveal.forEach(show); }, 5000);   // never leave anything hidden

  if (!reduce) document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.setAttribute('data-final', a.textContent);
    a.addEventListener('mouseenter', function () { scramble(a); });
  });

  /* ================================================================ the robot (hero) */
  var heroCanvas = document.getElementById('robot');
  var specEl = document.getElementById('robot-spec');
  var idEl = document.getElementById('robot-id');
  var seed = Math.floor(Date.now() / 1000) >>> 0;
  var bot = R.make(seed);
  var hero = { build: null };
  var heroVisible = true;
  var blinkUntil = 0, nextBlink = performance.now() + 2500;
  var walker = null;
  var LABELS = { antenna: 'Antenna', head: 'Head', eyes: 'Eyes', mouth: 'Mouth', bolts: 'Bolts',
                 body: 'Body', chest: 'Chest', arms: 'Arms', legs: 'Legs', accent: 'Colour' };
  var KEYS = Object.keys(LABELS);

  function setFavicon(b) {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d');
    x.fillStyle = '#F5F3EE'; x.fillRect(0, 0, 32, 32);
    R.draw(x, b, {}, 0, -0.5, 2, THEME, false);
    var link = document.querySelector('link[rel="icon"]');
    if (link) { link.type = 'image/png'; link.href = c.toDataURL('image/png'); }
  }

  function valueText(k, v) {
    if (k === 'bolts') return v ? 'yes' : 'no';
    return String(v);
  }

  function renderSpec(changed) {
    if (!specEl) return;
    var prev = {};
    specEl.querySelectorAll('.part').forEach(function (el) { prev[el.dataset.k] = el.dataset.v; });
    specEl.innerHTML = '';
    if (changed) specEl.classList.add('ready');
    KEYS.forEach(function (k) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'part';
      btn.setAttribute('aria-label', LABELS[k] + ': ' + valueText(k, bot[k]) + '. Change');
      var name = document.createElement('span'); name.textContent = LABELS[k];
      var val = document.createElement('b');
      if (k === 'accent') { var sw = document.createElement('i'); sw.style.background = bot.accent; val.appendChild(sw); }
      else val.textContent = valueText(k, bot[k]);
      btn.appendChild(name); btn.appendChild(val);
      btn.dataset.k = k; btn.dataset.v = String(bot[k]);
      if (changed && !reduce && prev[k] !== undefined && prev[k] !== String(bot[k])) {
        btn.classList.add('flash');
        if (k !== 'accent') { val.setAttribute('data-final', val.textContent); scramble(val); }
      }
      btn.addEventListener('click', function () {
        lastEdit = performance.now();
        var opts = R.OPTIONS[k];
        var next = Object.assign({}, bot);
        next[k] = opts[(opts.indexOf(bot[k]) + 1) % opts.length];
        setBot(next, true, k);
        var again = specEl.querySelectorAll('.part')[KEYS.indexOf(k)];
        if (again) again.focus();
      });
      specEl.appendChild(btn);
    });
    if (idEl) {
      idEl.textContent = 'unit ' + String(bot.seed % 100000).padStart(5, '0');
      if (changed === 'all' && !reduce) { idEl.setAttribute('data-final', idEl.textContent); scramble(idEl); }
    }
  }

  /* The robot stands in a pixel teleporter: an emitter on top, a pad below, no glass.
     Grid: 24 x 28 cells. Emitter rows 0-2, robot rows 6-22 (columns 4-19), pad rows 24-26. */
  var CW = 24, CH = 28, RX = 4, RT = 6, PAD = 24;
  function heroSize() {
    var dpr = window.devicePixelRatio || 1;
    var w = heroCanvas.clientWidth;
    heroCanvas.width = Math.round(w * dpr);
    heroCanvas.height = Math.round(w * CH / CW * dpr);
  }

  function setBot(next, animate, changedKey) {
    var old = bot;
    bot = next;
    setFavicon(bot);
    renderSpec(animate ? changedKey || 'all' : null);
    if (window.Walker && animate) window.Walker.onRebuild();
    hero.build = (animate && !reduce) ? { t0: performance.now(), old: old } : null;
    drawHero(performance.now());
  }
  function newRandom() { seed = (seed + 7919) >>> 0; setBot(R.make(seed), true); }

  function machine(ctx, s, now, active) {
    var ink = THEME.ink;
    function bar(y, x0, x1, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x0 * s), Math.round(y * s), Math.round((x1 - x0 + 1) * s), Math.ceil(s)); }
    function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x * s), Math.round(y * s), Math.ceil(s), Math.ceil(s)); }
    // emitter
    bar(0, 6, 17, ink); bar(1, 4, 19, ink); bar(2, 8, 15, ink);
    // pad
    bar(PAD, 5, 18, ink); bar(PAD + 1, 3, 20, ink); bar(PAD + 2, 4, 6, ink); bar(PAD + 2, 17, 19, ink);
    // lights: a slow chase when idle, all on while building
    var lightsTop = [6, 9, 12, 15, 17], lightsPad = [5, 8, 11, 14, 17];
    var k = Math.floor(now / 380) % 5;
    lightsTop.forEach(function (x, i) { px(x, 1, active || i === k ? bot.accent : '#3A3A3A'); });
    lightsPad.forEach(function (x, i) { px(x + 1, PAD + 1, active || i === (4 - k) ? bot.accent : '#3A3A3A'); });
    for (var x = 9; x <= 14; x++) px(x, 2, active ? THEME.eye : '#2E2E2E');   // nozzle
  }

  function drawRobotRows(ctx, b, s, y0, rowFrom, rowTo) {
    R.cells(b, {}).forEach(function (p) {
      if (p.y < rowFrom || p.y > rowTo) return;
      ctx.fillStyle = R.color(p.c, b, THEME);
      ctx.fillRect(Math.round((RX + p.x) * s), Math.round(y0 + p.y * s), Math.ceil(s), Math.ceil(s));
    });
  }

  function drawHero(now) {
    var s = heroCanvas.width / CW;
    var ctx = heroCanvas.getContext('2d');
    ctx.clearRect(0, 0, heroCanvas.width, heroCanvas.height);
    var bld = hero.build;
    var y0 = RT * s;
    if (bld) {
      var t = now - bld.t0, OUT = 420, IN = 900, scan;
      ctx.fillStyle = bot.accent; ctx.globalAlpha = 0.10 + 0.05 * Math.sin(now / 40);   // beam
      ctx.fillRect(Math.round(7 * s), Math.round(3 * s), Math.round(10 * s), Math.round((PAD - 3) * s));
      ctx.globalAlpha = 1;
      if (t < OUT) {                                        // the old robot is erased from the top down
        scan = Math.floor(t / OUT * R.H);
        drawRobotRows(ctx, bld.old, s, y0, scan + 1, R.H);
      } else if (t < OUT + IN) {                            // the new one is printed row by row
        scan = Math.floor((t - OUT) / IN * R.H);
        drawRobotRows(ctx, bot, s, y0, 0, scan - 1);
        R.cells(bot, {}).forEach(function (p) {
          if (p.y !== scan) return;
          ctx.fillStyle = Math.random() < 0.5 ? bot.accent : THEME.eye;
          ctx.fillRect(Math.round((RX + p.x) * s), Math.round(y0 + p.y * s), Math.ceil(s), Math.ceil(s));
        });
      } else { hero.build = null; bld = null; }
      if (bld) {
        ctx.fillStyle = THEME.eye; ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(6 * s), Math.round(y0 + scan * s), Math.round(12 * s), Math.max(1, Math.round(s * 0.25)));
        ctx.globalAlpha = 1;
        machine(ctx, s, now, true);
        return;
      }
    }
    var bob = reduce ? 0 : (Math.sin(now / 700) > 0 ? -s * 0.3 : 0);
    var pulse = reduce ? false : (Math.floor(now / 900) % 3 === 0);
    ctx.fillStyle = bot.accent; ctx.globalAlpha = bob ? 0.12 : 0.2;                  // glow on the pad
    ctx.fillRect(Math.round(7 * s), Math.round((PAD - 0.6) * s), Math.round(10 * s), Math.round(0.6 * s));
    ctx.globalAlpha = 1;
    R.draw(ctx, bot, { blink: now < blinkUntil, pulse: pulse }, RX * s, y0 + bob, s, THEME, false);
    machine(ctx, s, now, false);
  }

  var lastEdit = 0;
  heroSize();
  setBot(bot, false);
  window.addEventListener('resize', function () { heroSize(); drawHero(performance.now()); });
  heroCanvas.addEventListener('click', newRandom);
  heroCanvas.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newRandom(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe(heroCanvas);
  }
  // a new robot every 14 s while the hero is on screen, unless someone is building one
  if (!reduce) setInterval(function () {
    if (heroVisible && !document.hidden && performance.now() - lastEdit > 30000) newRandom();
  }, 14000);

  /* ================================================================ sections and the soft snap (decision SH24)
     When the scroll stops with a boundary between two sections on screen, the page settles on
     one side of it, following the direction the reader was going. No stacking: SH23 was dropped. */
  var panels = Array.prototype.slice.call(document.querySelectorAll(
    '.section-hero, .section-about, .section-work, .section-course, .section-skills, .section-contact'));
  var snapOn = false, statics = [];
  function layoutPanels() {
    snapOn = !reduce && window.innerWidth >= 900;
    var y = 0;
    panels.forEach(function (el, i) { statics[i] = y; y += el.offsetHeight; });
  }
  // anchors: go to where each section starts in the flow (a pinned section reports where it is stuck)
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1), el = document.getElementById(id);
      var i = panels.indexOf(el);
      if (i < 0) return;
      e.preventDefault();
      window.scrollTo({ top: statics[i], behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + id);
    });
  });
  // soft snap
  var snapT = null, snapping = false;
  function settle() {
    if (!snapOn || snapping) return;
    var y = window.scrollY, vh = window.innerHeight, goal = null;
    for (var i = 3; i < panels.length; i++) {             // only Work|Coursework, Coursework|Skills, Skills|Contact
      var d = statics[i] - y;                              // where section i starts, relative to the top of the screen
      if (d < vh * 0.2 || d > vh * 0.8) continue;          // only when the boundary is left in the middle of the screen
      var q = 1 - d / vh;                                  // how much of the new section has slid in (0..1)
      var forward = scrollDir > 0 ? q > 0.35 : q > 0.65;   // follow the direction the reader was going
      goal = forward ? statics[i] : Math.max(statics[i - 1], statics[i] - vh);
      break;
    }
    if (goal === null || Math.abs(goal - y) < 3) return;
    snapping = true;
    window.scrollTo({ top: goal, behavior: 'smooth' });
    setTimeout(function () { snapping = false; settle(); }, 900);   // check again: the wheel may have cut it short
  }
  var lastY = window.scrollY, scrollDir = 1;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (!snapping && y !== lastY) scrollDir = y > lastY ? 1 : -1;
    lastY = y;
    clearTimeout(snapT); snapT = setTimeout(settle, 280);
  }, { passive: true });

  /* ================================================================ shared with walker.js */
  window.Home = {
    get bot() { return bot; },
    get blinkUntil() { return blinkUntil; },
    newRandom: newRandom, THEME: THEME, THEME_DARK: THEME_DARK, contact: contact, reduce: reduce
  };

  /* ================================================================ work: horizontal track */
  var section = document.querySelector('.section-work');
  var track = document.querySelector('.work-track');
  var bar = document.querySelector('.work-progress span');
  var trackX = 0, horizontal = false;
  function layoutWork() {
    horizontal = window.innerWidth >= 900 && !reduce;
    section.classList.toggle('horizontal', horizontal);
    if (!horizontal) { section.style.height = ''; track.style.transform = ''; return; }
    var extra = track.scrollWidth - window.innerWidth + 128;
    section.style.height = (window.innerHeight + Math.max(0, extra)) + 'px';
  }
  function layoutAll() { layoutWork(); layoutPanels(); }
  function worksTick() {
    if (!horizontal) return;
    var rect = section.getBoundingClientRect();
    var max = section.offsetHeight - window.innerHeight;
    var extra = track.scrollWidth - window.innerWidth + 128;
    var p = Math.min(1, Math.max(0, -rect.top / Math.max(1, max)));
    trackX += (-p * Math.max(0, extra) - trackX) * 0.12;
    track.style.transform = 'translate3d(' + trackX.toFixed(1) + 'px,0,0)';
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
  }
  layoutAll();
  window.addEventListener('resize', layoutAll);
  window.addEventListener('load', layoutAll);

  /* ================================================================ one loop */
  var last = performance.now();
  function loop() {
    var now = performance.now();
    var dt = Math.min(40, now - last);
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2500 + Math.random() * 3000; }
    if (heroVisible || hero.build) drawHero(now);
    if (window.Walker) window.Walker.tick(now, dt);
    worksTick();
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
