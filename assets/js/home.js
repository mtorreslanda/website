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
    if (walker && animate) walker.jumpReq = true;
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

  /* ================================================================ the walker: a platformer
     The small robot lives in page coordinates. Lines of text are platforms (their top edge);
     the bottom of the screen is always a floor. It follows the mouse, jumping up to lines
     above it and dropping off edges to reach lines below. */
  var wc = document.getElementById('walker');
  var S = 3, SW = R.W * S, SH = R.H * S;                // sprite size in CSS px
  var G = 0.0024, JUMP_H = 170, VJ = Math.sqrt(2 * G * JUMP_H), RUN = 0.22, WALK = 0.08;
  var PLATFORM_SEL_FULL = ['.hero-title > span', '.hero-roles', '.hero-areas', '.counter', '.about-name',
    '.about-meta', '.about-bio', '.edu div', '.sec-title', '.sec-lead', '.card', '.row-name', '.row-desc',
    '.sub-head', '.contact-email', '.contact-links'].join(',');
  var PLATFORM_SEL = '.none-yet';   // interim: floor only until the per-section route is built
  var BOX_SEL = '.card, .hero-areas, .contact-links, .edu div';
  var platforms = [];

  // distance from the top of a text box to the top of its capital letters, per font
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

  function linePlatforms() {
    var out = [];
    var top = window.scrollY, h = window.innerHeight, sx = window.scrollX;
    document.querySelectorAll(PLATFORM_SEL).forEach(function (el) {
      var r0 = el.getBoundingClientRect();
      if (r0.bottom < -300 || r0.top > h + 300 || r0.width < 30) return;
      if (el.matches(BOX_SEL)) { out.push({ x1: r0.left + sx, x2: r0.right + sx, y: r0.top + top }); return; }
      // text: one platform per line, standing on the capitals
      var lines = [];
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var node, rg = document.createRange();
      while ((node = tw.nextNode())) {
        if (!node.nodeValue.trim()) continue;
        var cs = getComputedStyle(node.parentElement);
        if (cs.visibility === 'hidden') continue;
        var inset = capInset(cs);
        rg.selectNodeContents(node);
        Array.prototype.forEach.call(rg.getClientRects(), function (r) {
          if (r.width < 4) return;
          var y = r.top + inset, l = null;
          for (var i = 0; i < lines.length; i++) if (Math.abs(lines[i].y - y) < 6) l = lines[i];
          if (l) { l.x1 = Math.min(l.x1, r.left); l.x2 = Math.max(l.x2, r.right); l.y = Math.min(l.y, y); }
          else lines.push({ y: y, x1: r.left, x2: r.right });
        });
      }
      lines.forEach(function (l) {
        if (l.x2 - l.x1 >= 30) out.push({ x1: l.x1 + sx, x2: l.x2 + sx, y: l.y + top });
      });
    });
    return out;
  }

  function floorY() { return window.scrollY + window.innerHeight - 6; }

  if (wc && !reduce) {
    var dpr = window.devicePixelRatio || 1;
    wc.width = Math.round(SW * dpr); wc.height = Math.round((SH + 4 * S) * dpr);
    wc.style.width = SW + 'px'; wc.style.height = (SH + 4 * S) + 'px';
    walker = { x: 80, y: floorY(), vx: 0, vy: 0, ground: true, dir: 1, step: 0, lastStep: 0,
               cooldown: 0, wave: false, jumpReq: false, landT: 0 };
    wc.addEventListener('click', newRandom);
    platforms = linePlatforms();
    setInterval(function () { platforms = linePlatforms(); }, 180);
    window.addEventListener('scroll', function () { platforms = linePlatforms(); }, { passive: true });
  }

  var mouse = { cx: -1, cy: -1, t: -1e9 };
  window.addEventListener('mousemove', function (e) { mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.t = performance.now(); });
  document.addEventListener('mouseleave', function () { mouse.t = -1e9; });
  var wander = { x: 200, y: 0, until: 0 };

  function supportAt(x, y, tol) {
    var best = null;
    platforms.forEach(function (p) {
      if (x >= p.x1 - 4 && x <= p.x2 + 4 && Math.abs(p.y - y) <= tol && (!best || p.y < best.y)) best = p;
    });
    return best;
  }

  // jump to platform p; if it is higher than one jump, plan a second jump at the apex
  function jumpTo(p, now, tx) {
    var w = walker;
    var xl = Math.min(Math.max(tx, p.x1 + 14), p.x2 - 14);
    var dy = p.y - w.y;                                    // negative = above
    var dbl = -dy > JUMP_H - 10;
    var tUp = VJ / G;                                      // time to the apex of one jump
    var rise = dbl ? JUMP_H : 0;                           // height already gained when the 2nd jump starts
    var disc = VJ * VJ + 2 * G * (dy + rise);
    if (disc < 0) return false;
    var t = (dbl ? tUp : 0) + (VJ + Math.sqrt(disc)) / G;  // total time until landing on the way down
    var vx = (xl - w.x) / t;
    if (Math.abs(vx) > 0.42) return false;
    w.vx = vx; w.vy = -VJ; w.ground = false; w.cooldown = now + 350;
    w.second = dbl ? now + tUp : 0;
    if (vx) w.dir = vx > 0 ? 1 : -1;
    return true;
  }

  function walkerTick(now, dt) {
    var w = walker;
    var vw = window.innerWidth, top = window.scrollY, fy = floorY();

    // out of view (the page scrolled away): drop back in from the top
    if (w.y < top - 40 || w.y > fy + 80) {
      w.x = Math.min(Math.max(mouse.t > 0 ? mouse.cx : vw * 0.3, 30), vw - 30);
      w.y = top - 10; w.vx = 0; w.vy = 0; w.ground = false;
    }

    // target: the mouse if it moved recently, otherwise wander between visible lines
    var active = now - mouse.t < 6000;
    var tx, ty;
    if (active) { tx = mouse.cx + window.scrollX; ty = mouse.cy + top; }
    else {
      if (now > wander.until) {
        var vis = platforms.filter(function (p) { return p.y > top + 80 && p.y < fy; });
        var pick = vis.length && Math.random() < 0.6 ? vis[Math.floor(Math.random() * vis.length)] : null;
        wander.x = pick ? pick.x1 + Math.random() * (pick.x2 - pick.x1) : 40 + Math.random() * (vw - 80);
        wander.y = pick ? pick.y : fy;
        wander.until = now + 3500 + Math.random() * 3000;
      }
      tx = wander.x; ty = wander.y;
    }

    w.wave = active && Math.abs(tx - w.x) < 34 && Math.abs(ty - (w.y - SH / 2)) < 40;

    if (w.ground) {
      var under = w.y >= fy - 1 ? { x1: 0, x2: vw, y: fy, floor: true } : supportAt(w.x, w.y, 3);
      if (!under) { w.ground = false; w.vy = 0; w.vx *= 0.3; }   // walked off an edge: drop almost straight down
      else {
        w.y = under.y;
        // target below this line and over it: walk past the nearer edge and drop
        if (ty > w.y + 30 && !under.floor && tx > under.x1 - 30 && tx < under.x2 + 30) {
          // where would each edge drop us? prefer the landing closest to the target
          var score = function (ex) {
            var land = fy;
            platforms.forEach(function (q) { if (q.y > w.y + 4 && q.y < land && ex >= q.x1 && ex <= q.x2) land = q.y; });
            return Math.abs(land - ty) + Math.abs(ex - tx) * 0.3;
          };
          var eL = under.x1 - 20, eR = under.x2 + 20;
          tx = score(eL) <= score(eR) ? eL : eR;
        }
        var dx = tx - w.x;
        var speed = active ? RUN : WALK;
        if (w.jumpReq) { w.jumpReq = false; w.vy = -VJ * 0.6; w.vx = 0; w.ground = false; }
        else if (w.wave) { w.vx = 0; w.step = 0; }
        else {
          if (ty < w.y - 30 && now > w.cooldown) {          // the target is higher: find a line to jump to
            var cands = platforms.filter(function (p) {
              return p.y < w.y - 18 && p.y > w.y - 2 * JUMP_H + 20 && p.x2 > w.x - 220 && p.x1 < w.x + 220;
            });
            cands.sort(function (a, b) {
              var da = Math.abs(a.y - ty) + Math.abs(Math.min(Math.max(tx, a.x1), a.x2) - tx) * 0.5;
              var db = Math.abs(b.y - ty) + Math.abs(Math.min(Math.max(tx, b.x1), b.x2) - tx) * 0.5;
              return da - db;
            });
            for (var i = 0; i < cands.length && i < 4; i++) if (jumpTo(cands[i], now, tx)) break;
          }
          if (w.ground) {
            if (Math.abs(dx) > 10) { w.vx = (dx > 0 ? 1 : -1) * speed; w.dir = dx > 0 ? 1 : -1; }
            else w.vx = 0;
            w.x += w.vx * dt;
            if (w.vx && now - w.lastStep > 150) { w.step ^= 1; w.lastStep = now; }
            if (!w.vx) w.step = 0;
          }
        }
      }
    }
    if (!w.ground) {
      if (w.second && now >= w.second) { w.second = 0; w.vy = -VJ; w.flip = now; }
      var prevY = w.y;
      w.vy += G * dt;
      w.x += w.vx * dt; w.y += w.vy * dt;
      if (w.vy > 0) {
        var land = null;
        platforms.forEach(function (p) {
          if (w.x >= p.x1 - 4 && w.x <= p.x2 + 4 && p.y >= prevY - 1 && p.y <= w.y + 1 && (!land || p.y < land.y)) land = p;
        });
        if (land) { w.y = land.y; w.vy = 0; w.vx = 0; w.ground = true; w.landT = now; }
        else if (w.y >= fy) { w.y = fy; w.vy = 0; w.vx = 0; w.ground = true; w.landT = now; }
      }
      w.step = 1;
    }
    w.x = Math.min(Math.max(w.x, SW / 2 + 4), vw - SW / 2 - 4);

    // draw: a fixed canvas placed at the robot's page position
    var squash = now - w.landT < 90 ? S : 0;
    wc.style.transform = 'translate(' + Math.round(w.x - SW / 2 - window.scrollX) + 'px,' +
                         Math.round(w.y - SH - 4 * S - top + squash) + 'px)';
    var r = contact.getBoundingClientRect();
    var onDark = (w.y - top) > r.top && (w.y - top) < r.bottom + 20;
    var ctx = wc.getContext('2d');
    var s = wc.width / R.W;
    ctx.clearRect(0, 0, wc.width, wc.height);
    R.draw(ctx, bot, { step: w.step, blink: now < blinkUntil, wave: w.wave }, 0, s * 4, s,
           onDark ? THEME_DARK : THEME, w.dir < 0);
  }

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
  layoutWork();
  window.addEventListener('resize', layoutWork);
  window.addEventListener('load', layoutWork);

  /* ================================================================ one loop */
  var last = performance.now();
  function loop() {
    var now = performance.now();
    var dt = Math.min(40, now - last);
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2500 + Math.random() * 3000; }
    if (heroVisible || hero.build) drawHero(now);
    if (walker) walkerTick(now, dt);
    worksTick();
    last = now;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
