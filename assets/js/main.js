/* =========================================================
   Nordlicht Energietechnik – Interaktionen & Effekte
   Reines JavaScript, keine Abhängigkeiten.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = (d = 0) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmt0 = nf(0), fmt1 = nf(1);

  /* ---------------------------------------------------------
     Zentrale Scroll-Schleife (ein rAF pro Frame)
     --------------------------------------------------------- */
  const scrollFns = [];
  let ticking = false;
  const runScroll = () => { ticking = false; for (const fn of scrollFns) fn(); };
  const requestScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } };
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);

  /** Fortschritt 0..1 einer "Sticky"-Sektion (oben ab Kante, bis Ende) */
  function stickyProgress(el, offset = 0) {
    const r = el.getBoundingClientRect();
    const total = r.height - (window.innerHeight - offset);
    return total > 0 ? clamp((offset - r.top) / total) : 0;
  }

  /* ---------------------------------------------------------
     Navigation
     --------------------------------------------------------- */
  const gnav = $('#gnav');
  const toggle = $('.gnav__toggle');
  if (toggle) {
    const setOpen = (open) => {
      gnav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', () => setOpen(!gnav.classList.contains('is-open')));
    $$('#gnav-menu a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  const lnav = $('#lnav');
  if (lnav) {
    scrollFns.push(() => lnav.classList.toggle('is-stuck', lnav.getBoundingClientRect().top <= 0 && window.scrollY > 10));

    // Scroll-Spy für die lokale Navigation
    const links = $$('.lnav__links a');
    const targets = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    scrollFns.push(() => {
      const line = window.innerHeight * 0.35;
      let active = null;
      targets.forEach((t, i) => { if (t.getBoundingClientRect().top <= line) active = i; });
      links.forEach((a, i) => a.classList.toggle('is-active', i === active));
    });
  }

  /* ---------------------------------------------------------
     Reveal beim Scrollen
     --------------------------------------------------------- */
  const reveals = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------
     Zähler (Count-up)
     --------------------------------------------------------- */
  const counters = $$('[data-count]');
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const f = nf(dec);
    if (reduceMotion) { el.textContent = f.format(target); return; }
    const dur = 1800, t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / dur);
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
      el.textContent = f.format(target * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  } else counters.forEach((c) => { c.textContent = fmt0.format(+c.dataset.count); });

  /* ---------------------------------------------------------
     Hero: Panel klappt beim Scrollen auf
     --------------------------------------------------------- */
  const hero = $('[data-hero]');
  if (hero && !reduceMotion) {
    scrollFns.push(() => {
      const p = stickyProgress(hero);
      hero.style.setProperty('--p', p.toFixed(4));
    });
  }

  /* ---------------------------------------------------------
     Nordlicht-Animation (Canvas)
     --------------------------------------------------------- */
  const canvas = $('#aurora');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const SCALE = 0.25; // geringe Auflösung + CSS-Blur = weich & performant
    let w = 0, h = 0, raf = 0, visible = true;
    const ribbons = [
      { c: '60,242,176', y: .42, amp: .10, f: 1.3, s: .00011, len: .30, a: .85, ph: 0 },
      { c: '51,199,255', y: .50, amp: .08, f: 1.8, s: .00015, len: .22, a: .65, ph: 2 },
      { c: '143,123,255', y: .34, amp: .07, f: 1.1, s: .00009, len: .20, a: .55, ph: 4 },
    ];
    const resize = () => {
      w = Math.max(1, Math.round(canvas.clientWidth * SCALE));
      h = Math.max(1, Math.round(canvas.clientHeight * SCALE));
      canvas.width = w; canvas.height = h;
      draw(performance.now());
    };
    const draw = (time) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const r of ribbons) {
        for (let x = 0; x < w; x += 1) {
          const u = x / w;
          const t = time * r.s;
          const y = h * (r.y + r.amp * Math.sin(u * Math.PI * 2 * r.f + t * 6 + r.ph) + 0.03 * Math.sin(u * 17 + t * 9));
          const shimmer = 0.55 + 0.45 * Math.sin(u * 40 + t * 22 + r.ph) * Math.sin(u * 7 - t * 5);
          const edge = Math.sin(Math.PI * u);
          const alpha = r.a * shimmer * edge;
          const len = h * r.len * (0.7 + 0.5 * shimmer);
          const g = ctx.createLinearGradient(0, y - len, 0, y + len * 0.25);
          g.addColorStop(0, `rgba(${r.c},0)`);
          g.addColorStop(0.75, `rgba(${r.c},${alpha.toFixed(3)})`);
          g.addColorStop(1, `rgba(${r.c},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x, y - len, 1.2, len * 1.25);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && !reduceMotion && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    resize();
    window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  /* ---------------------------------------------------------
     Wort-für-Wort-Highlight
     --------------------------------------------------------- */
  $$('[data-words]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((word, i) => {
      const s = document.createElement('span');
      s.className = 'w' + (/2\.300|eigenen|Dach/.test(word) ? ' hl' : '');
      s.textContent = word;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    if (reduceMotion) { spans.forEach((s) => s.classList.add('on')); return; }
    scrollFns.push(() => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh * 0.85 - r.top) / (vh * 0.4 + r.height));
      const n = Math.round(p * spans.length);
      spans.forEach((s, i) => s.classList.toggle('on', i < n));
    });
  });

  /* ---------------------------------------------------------
     Energie-Simulation (gemeinsam für Tagesverlauf & Vergleich)
     --------------------------------------------------------- */
  const DT = 0.05; // Stunden
  const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  const pvAt = (t) => { const x = ((t % 24) - 6) / 14; return x <= 0 || x >= 1 ? 0 : 7.6 * Math.pow(Math.sin(Math.PI * x), 1.3); };
  const loadAt = (t) => { const h = t % 24; return 0.38 + 1.1 * gauss(h, 7.3, 0.9) + 0.6 * gauss(h, 12.5, 1.3) + 1.9 * gauss(h, 19.2, 1.7) + 0.35 * gauss(h, 22, 1); };

  function simulate(cap, pMax = 5) {
    const out = [];
    let soc = cap ? 0.5 : 0;
    for (let i = 0; i <= Math.round(48 / DT); i++) {
      const t = i * DT;
      const pv = pvAt(t), load = loadAt(t);
      const direct = Math.min(pv, load);
      let charge = 0, dis = 0;
      if (cap) {
        if (pv > load) charge = Math.min(pv - load, pMax, ((1 - soc) * cap) / DT);
        else dis = Math.min(load - pv, pMax, (Math.max(0, soc - 0.05) * cap) / DT);
        soc = clamp(soc + ((charge - dis) * DT) / cap);
      }
      const grid = Math.max(0, load - direct - dis);
      const feed = Math.max(0, pv - direct - charge);
      if (t >= 24 - 1e-9) out.push({ t: t - 24, pv, load, direct, charge, dis, grid, feed, soc });
    }
    return out; // 0..24 h, eingeschwungener 2. Tag
  }
  const simWith = simulate(10);
  const simWithout = simulate(0);
  const totals = (sim) => sim.reduce((a, d) => ({ load: a.load + d.load * DT, grid: a.grid + d.grid * DT }), { load: 0, grid: 0 });

  /* ---------------------------------------------------------
     Tagesverlauf – Scroll-Scrubbing
     --------------------------------------------------------- */
  const day = $('[data-day]');
  if (day) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (id) => document.getElementById(id);
    const sun = el('sun'), stars = el('stars'), aur = el('aurora-sky');
    const skyTop = el('sky-top'), skyBottom = el('sky-bottom');
    const batFill = el('bat-fill'), winGlow = el('win-glow');
    const flows = { charge: el('flow-charge'), dis: el('flow-dis'), grid: el('flow-grid'), feed: el('flow-feed') };
    const timeEl = el('day-time');
    const m = Object.fromEntries($$('[data-m]', day).map((n) => [n.dataset.m, n]));
    const barFill = $('.day__bar-fill', day);
    const captions = $$('.day__caption', day);
    const hill = el('hill'), ground = el('ground'), body = el('house-body'), roof = el('house-roof');

    // Sterne
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', (rnd() * 1000).toFixed(1));
      c.setAttribute('cy', (rnd() * 330).toFixed(1));
      c.setAttribute('r', (0.6 + rnd() * 1.4).toFixed(2));
      c.setAttribute('opacity', (0.35 + rnd() * 0.65).toFixed(2));
      stars.appendChild(c);
    }

    // Solarmodule auf dem Dach (Trapez 225..555 unten, 300..480 oben, y 250..340)
    const panelsG = el('panels');
    const panels = [];
    const xAt = (y, side) => {
      const k = (y - 250) / 90;
      return side < 0 ? lerp(300, 225, k) : lerp(480, 555, k);
    };
    const rows = [[260, 292], [298, 330]];
    const cols = 6;
    rows.forEach(([y0, y1]) => {
      const l0 = xAt(y0, -1) + 14, r0 = xAt(y0, 1) - 14, l1 = xAt(y1, -1) + 14, r1 = xAt(y1, 1) - 14;
      for (let c = 0; c < cols; c++) {
        const a = c / cols, b = (c + 1) / cols, g = 0.012;
        const pts = [
          [lerp(l0, r0, a + g), y0], [lerp(l0, r0, b - g), y0],
          [lerp(l1, r1, b - g), y1], [lerp(l1, r1, a + g), y1],
        ].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
        const poly = document.createElementNS(NS, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('fill', 'url(#cell-g)');
        poly.setAttribute('stroke', '#5a7fc0');
        poly.setAttribute('stroke-width', '0.8');
        panelsG.appendChild(poly);
        panels.push(poly);
      }
    });

    // Himmelsfarben je Uhrzeit
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const sky = [
      [0, '#03040b', '#0b0f22'], [5, '#05060f', '#141a33'], [6.2, '#1d2550', '#e07a5f'],
      [7.5, '#2a5aa8', '#f2b48a'], [9.5, '#2c7ad8', '#a8d6ff'], [13, '#1f6dd2', '#8fc9ff'],
      [17, '#3466b8', '#f0c08f'], [19.3, '#2b2a63', '#e8735c'], [20.6, '#111538', '#3a2c52'],
      [22, '#05071a', '#10142e'], [24, '#03040b', '#0b0f22'],
    ].map(([t, a, b]) => [t, hex(a), hex(b)]);
    const skyAt = (t) => {
      let i = 0; while (i < sky.length - 2 && sky[i + 1][0] < t) i++;
      const [t0, a0, b0] = sky[i], [t1, a1, b1] = sky[i + 1];
      const k = clamp((t - t0) / (t1 - t0));
      const mix = (x, y) => `rgb(${x.map((v, j) => Math.round(lerp(v, y[j], k))).join(',')})`;
      return [mix(a0, a1), mix(b0, b1)];
    };
    const daylight = (t) => clamp(Math.min((t - 5.6) / 2, (21 - t) / 2));

    const T0 = 5, T1 = 24;
    let lastT = -1;
    const render = (T) => {
      if (Math.abs(T - lastT) < 0.004) return;
      lastT = T;
      const d = simWith[Math.min(simWith.length - 1, Math.round(T / DT))];
      const [top, bottom] = skyAt(T);
      skyTop.setAttribute('stop-color', top);
      skyBottom.setAttribute('stop-color', bottom);

      const light = daylight(T);
      stars.setAttribute('opacity', (1 - light).toFixed(3));
      aur.setAttribute('opacity', (clamp(1 - light * 1.6) * (T > 12 ? 1 : 0.6)).toFixed(3));

      // Sonne
      const x = (T - 6) / 14;
      if (x > -0.05 && x < 1.05) {
        const cx = 80 + 840 * x;
        const cy = 470 - 360 * Math.sin(Math.PI * clamp(x));
        sun.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)})`);
        sun.setAttribute('opacity', clamp(Math.sin(Math.PI * clamp(x)) * 3).toFixed(3));
      } else sun.setAttribute('opacity', '0');

      // Landschaft heller bei Tag
      const shade = (base, day2) => `rgb(${base.map((v, j) => Math.round(lerp(v, day2[j], light))).join(',')})`;
      hill.setAttribute('fill', shade([13, 26, 20], [44, 92, 60]));
      ground.setAttribute('fill', shade([8, 16, 12], [34, 72, 46]));
      body.setAttribute('fill', shade([27, 34, 48], [218, 214, 206]));
      roof.setAttribute('fill', shade([38, 47, 64], [96, 70, 62]));

      // Module leuchten mit dem Ertrag
      const out = d.pv / 7.6;
      const glow = `rgba(120,200,255,${(out * 0.9).toFixed(3)})`;
      panels.forEach((p) => { p.style.filter = out > 0.05 ? `drop-shadow(0 0 ${(out * 6).toFixed(1)}px ${glow})` : 'none'; p.setAttribute('fill-opacity', (0.75 + out * 0.25).toFixed(2)); });
      panelsG.setAttribute('opacity', (0.55 + light * 0.45).toFixed(3));

      // Speicher
      const hFill = 94 * d.soc;
      batFill.setAttribute('y', (460 - hFill).toFixed(1));
      batFill.setAttribute('height', hFill.toFixed(1));

      // Fenster (Licht an morgens/abends)
      const lights = clamp(Math.max((7.8 - T) / 0.8, (T - 18.3) / 1)) * (T < 23.4 ? 1 : clamp((24 - T) / 0.6));
      winGlow.setAttribute('opacity', lights.toFixed(3));

      // Energieflüsse
      const op = (v, max) => (v > 0.05 ? clamp(0.25 + v / max) : 0).toFixed(3);
      flows.charge.style.opacity = op(d.charge, 4);
      flows.dis.style.opacity = op(d.dis, 2);
      flows.grid.style.opacity = op(d.grid, 2);
      flows.feed.style.opacity = op(d.feed, 4);

      // HUD
      const hh = Math.floor(T) % 24, mm = Math.floor((T % 1) * 60 / 5) * 5;
      timeEl.textContent = `${String(T >= 24 ? 24 : hh).padStart(2, '0')}:${String(T >= 24 ? 0 : mm).padStart(2, '0')}`;
      m.pv.textContent = fmt1.format(d.pv);
      m.load.textContent = fmt1.format(d.load);
      m.soc.textContent = fmt0.format(d.soc * 100);
      m.grid.textContent = fmt1.format(d.grid);
      barFill.style.width = `${((T - T0) / (T1 - T0)) * 100}%`;
      captions.forEach((c) => c.classList.toggle('is-active', T >= +c.dataset.from && T < +c.dataset.to));
    };

    scrollFns.push(() => {
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lnav-h')) || 52;
      const p = stickyProgress(day, offset);
      render(lerp(T0, T1 - 0.001, p));
    });
    render(T0);
  }

  /* ---------------------------------------------------------
     Vergleich: Diagramme + Slider
     --------------------------------------------------------- */
  const compare = $('[data-compare]');
  if (compare) {
    const W = 1000, H = 480, L = 56, R = 24, TOP = 110, B = 54;
    const X = (t) => L + (t / 24) * (W - L - R);
    const Y = (v) => H - B - (v / 8) * (H - TOP - B);

    const area = (sim, lo, hi) => {
      let d = `M${X(sim[0].t).toFixed(1)} ${Y(hi(sim[0])).toFixed(1)}`;
      for (const p of sim) d += `L${X(p.t).toFixed(1)} ${Y(hi(p)).toFixed(1)}`;
      for (let i = sim.length - 1; i >= 0; i--) d += `L${X(sim[i].t).toFixed(1)} ${Y(lo(sim[i])).toFixed(1)}`;
      return d + 'Z';
    };
    const line = (sim, f) => sim.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)} ${Y(f(p)).toFixed(1)}`).join('');

    const drawChart = (svg, sim) => {
      let s = '';
      for (let v = 0; v <= 8; v += 2) s += `<line class="chart-grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="chart-axis" x="${L - 12}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
      [0, 6, 12, 18, 24].forEach((h) => { s += `<text class="chart-axis" x="${X(h)}" y="${H - B + 26}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`; });
      s += `<text class="chart-axis" x="${L - 12}" y="${TOP - 18}" text-anchor="end">kW</text>`;
      s += `<path d="${area(sim, () => 0, (p) => p.direct)}" fill="#3cf2b0" fill-opacity=".85"/>`;
      s += `<path d="${area(sim, (p) => p.direct, (p) => p.direct + p.dis)}" fill="#33c7ff" fill-opacity=".85"/>`;
      s += `<path d="${area(sim, (p) => p.direct + p.dis, (p) => p.direct + p.dis + p.grid)}" fill="#ff6b6b" fill-opacity=".8"/>`;
      s += `<path d="${line(sim, (p) => p.pv)}" fill="none" stroke="#ffc24b" stroke-width="2.5" stroke-dasharray="6 6"/>`;
      svg.innerHTML = s;
    };
    drawChart($('#chart-without'), simWithout);
    drawChart($('#chart-with'), simWith);

    const tag = (sim, id) => {
      const t = totals(sim);
      $(id).textContent = `${fmt0.format((1 - t.grid / t.load) * 100)} % unabhängig · ${fmt1.format(t.grid)} kWh aus dem Netz`;
    };
    tag(simWithout, '#aut-without');
    tag(simWith, '#aut-with');

    const handle = $('.compare__handle', compare);
    let pos = 50;
    const set = (v) => {
      pos = clamp(v, 0, 100);
      compare.style.setProperty('--x', `${pos}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
      handle.setAttribute('aria-valuetext', `${Math.round(pos)} Prozent`);
    };
    const fromEvent = (e) => {
      const r = compare.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    let dragging = false, startX = 0, startY = 0, decided = false;
    compare.addEventListener('pointerdown', (e) => {
      dragging = true; decided = e.pointerType === 'mouse';
      startX = e.clientX; startY = e.clientY;
      compare.classList.remove('is-intro');
      if (decided) { compare.classList.add('is-dragging'); compare.setPointerCapture(e.pointerId); fromEvent(e); }
    });
    compare.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!decided) {
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; } // vertikales Scrollen erlauben
        decided = true; compare.classList.add('is-dragging'); compare.setPointerCapture(e.pointerId);
      }
      fromEvent(e);
    });
    const end = () => { dragging = false; compare.classList.remove('is-dragging'); };
    compare.addEventListener('pointerup', (e) => { if (dragging && !decided) fromEvent(e); end(); });
    compare.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 2;
      const map = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -10, PageUp: 10 };
      if (e.key in map) { set(pos + map[e.key]); e.preventDefault(); }
      else if (e.key === 'Home') { set(0); e.preventDefault(); }
      else if (e.key === 'End') { set(100); e.preventDefault(); }
    });

    // Kleine Intro-Bewegung, wenn der Slider sichtbar wird
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        compare.classList.add('is-intro');
        set(78);
        setTimeout(() => set(22), 1100);
        setTimeout(() => { set(50); setTimeout(() => compare.classList.remove('is-intro'), 1200); }, 2200);
      }, { threshold: 0.6 });
      io.observe(compare);
    }
  }

  /* ---------------------------------------------------------
     Tabs
     --------------------------------------------------------- */
  $$('[data-tabs]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const ink = $('.tabs__ink', root);
    const moveInk = () => {
      const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true');
      if (!t || !ink) return;
      ink.style.width = `${t.offsetWidth}px`;
      ink.style.transform = `translateX(${t.offsetLeft}px)`;
    };
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      moveInk();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          select(tabs[n], true); e.preventDefault();
        }
      });
    });
    window.addEventListener('resize', moveInk);
    requestAnimationFrame(moveInk);
  });

  /* ---------------------------------------------------------
     Galerie (Scroll-Snap + Punkte + Pfeile)
     --------------------------------------------------------- */
  $$('[data-gallery]').forEach((g) => {
    const track = $('.gallery__track', g);
    const cards = $$('.card', track);
    const dotsWrap = $('.gallery__dots', g);
    const [prev, next] = $$('.paddle', g);
    const dots = cards.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Zu Karte ${i + 1}: ${$('.card__eyebrow', c).textContent}`);
      b.addEventListener('click', () => go(i));
      dotsWrap.appendChild(b);
      return b;
    });
    const padLeft = () => parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    const go = (i) => {
      const c = cards[clamp(i, 0, cards.length - 1)];
      track.scrollTo({ left: c.offsetLeft - padLeft(), behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    const current = () => {
      const x = track.scrollLeft + padLeft();
      let best = 0, bd = Infinity;
      cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - x); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const update = () => {
      const i = current();
      dots.forEach((d, j) => d.setAttribute('aria-current', String(i === j)));
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    };
    prev.addEventListener('click', () => go(current() - 1));
    next.addEventListener('click', () => go(current() + 1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------------------------------------------------------
     Schritte: Fortschrittslinie
     --------------------------------------------------------- */
  const steps = $('[data-steps]');
  if (steps) {
    scrollFns.push(() => {
      const r = steps.getBoundingClientRect();
      const vh = window.innerHeight;
      steps.style.setProperty('--p', (reduceMotion ? 1 : clamp((vh * 0.8 - r.top) / (vh * 0.5 + r.height * 0.4))).toFixed(3));
    });
  }

  /* ---------------------------------------------------------
     Ersparnisrechner
     --------------------------------------------------------- */
  const calc = $('[data-calc]');
  if (calc) {
    const usage = $('#c-usage'), price = $('#c-price'), bat = $('#c-battery');
    const out = { usage: $('#o-usage'), price: $('#o-price') };
    const r = { saving: $('#r-saving'), kwp: $('#r-kwp'), bat: $('#r-bat'), aut: $('#r-aut'), autBar: $('#r-aut-bar'), co2: $('#r-co2') };
    const shown = { saving: 0, kwp: 0, aut: 0, co2: 0 };
    const tweens = {};
    const tween = (key, to, f, el) => {
      cancelAnimationFrame(tweens[key]);
      const from = shown[key], t0 = performance.now(), dur = reduceMotion ? 0 : 600;
      const step = (now) => {
        const k = dur ? clamp((now - t0) / dur) : 1;
        const e = 1 - Math.pow(1 - k, 3);
        shown[key] = lerp(from, to, e);
        el.textContent = f.format(shown[key]);
        if (k < 1) tweens[key] = requestAnimationFrame(step);
      };
      tweens[key] = requestAnimationFrame(step);
    };
    const fill = (input) => {
      const p = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--fill', `${p}%`);
    };

    const compute = () => {
      const kind = $('input[name="kind"]:checked', calc).value;
      const kwh = +usage.value, ct = +price.value, withBat = bat.checked;
      fill(usage); fill(price);
      out.usage.textContent = `${fmt0.format(kwh)} kWh`;
      out.price.textContent = `${ct} ct/kWh`;

      const gew = kind === 'gewerbe';
      const kwp = Math.max(3, Math.round((kwh / 1000) * (gew ? 1.0 : 1.2) * 2) / 2);
      const yieldKwh = kwp * 920;
      const quote = gew ? (withBat ? 0.75 : 0.55) : (withBat ? 0.65 : 0.30);
      const self = Math.min(yieldKwh * quote, kwh * (withBat ? 0.8 : 0.45));
      const feed = yieldKwh - self;
      const saving = self * (ct / 100) + feed * 0.07;
      const aut = (self / kwh) * 100;
      const batKwh = withBat ? Math.max(5, Math.round(kwp * (gew ? 0.8 : 1))) : 0;

      tween('saving', Math.round(saving / 10) * 10, fmt0, r.saving);
      tween('kwp', kwp, fmt1, r.kwp);
      tween('aut', aut, fmt0, r.aut);
      tween('co2', (yieldKwh * 0.38) / 1000, fmt1, r.co2);
      r.bat.textContent = withBat ? `${fmt0.format(batKwh)} kWh` : 'ohne';
      r.autBar.style.width = `${clamp(aut / 100) * 100}%`;
      calc.dataset.summary = `Rechner: ${gew ? 'Gewerbe' : 'Privat'}, ${fmt0.format(kwh)} kWh/Jahr, ${ct} ct/kWh, ca. ${fmt1.format(kwp)} kWp${withBat ? `, Speicher ca. ${batKwh} kWh` : ''}, geschätzte Ersparnis ca. ${fmt0.format(Math.round(saving / 10) * 10)} €/Jahr.`;
    };
    calc.addEventListener('input', compute);
    calc.addEventListener('change', (e) => {
      if (e.target.name === 'kind') {
        // sinnvolle Startwerte je Zielgruppe
        usage.value = e.target.value === 'gewerbe' ? 30000 : 4500;
      }
      compute();
    });
    compute();

    $('#calc-cta').addEventListener('click', () => {
      const msg = $('#f-msg');
      if (msg && !msg.value) msg.value = calc.dataset.summary || '';
      const kind = $('input[name="kind"]:checked', calc).value;
      const t = $(`input[name="type"][value="${kind === 'gewerbe' ? 'Gewerbe' : 'Privat'}"]`);
      if (t) t.checked = true;
    });
  }

  /* ---------------------------------------------------------
     Öffnungszeiten-Status (Zeitzone Hamburg)
     --------------------------------------------------------- */
  const openEl = $('#open-state');
  if (openEl) {
    const update = () => {
      try {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
        const wd = parts.weekday.replace('.', '');
        const h = parseInt(parts.hour, 10);
        const open = ['Mo', 'Di', 'Mi', 'Do', 'Fr'].includes(wd) && h >= 8 && h < 17;
        openEl.textContent = open ? 'Jetzt erreichbar' : 'Gerade geschlossen';
        openEl.classList.toggle('is-open', open);
      } catch (_) { openEl.textContent = ''; }
    };
    update();
    setInterval(update, 60000);
  }

  /* ---------------------------------------------------------
     Kontaktformular (öffnet E-Mail-Programm, kein Server nötig)
     --------------------------------------------------------- */
  const form = $('#contact-form');
  if (form) {
    const note = $('#form-note');
    const setNote = (txt, cls) => { note.textContent = txt; note.className = 'form__note' + (cls ? ` ${cls}` : ''); };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#f-name'), email = $('#f-email'), consent = $('#f-consent');
      let ok = true;
      [name, email].forEach((i) => {
        const valid = i.value.trim() && i.checkValidity();
        i.parentElement.classList.toggle('is-invalid', !valid);
        if (!valid) ok = false;
      });
      consent.closest('.check').classList.toggle('is-invalid', !consent.checked);
      if (!consent.checked) ok = false;
      if (!ok) { setNote('Bitte füllen Sie Name und E-Mail aus und bestätigen Sie den Datenschutzhinweis.', 'is-error'); return; }

      const type = $('input[name="type"]:checked', form).value;
      const body = [
        `Name: ${name.value.trim()}`,
        `E-Mail: ${email.value.trim()}`,
        `Telefon: ${$('#f-phone').value.trim() || '–'}`,
        `Anfrage für: ${type}`,
        '',
        $('#f-msg').value.trim(),
      ].join('\n');
      const subject = `Beratungsanfrage (${type}) – ${name.value.trim()}`;
      window.location.href = `mailto:kontakt@nordlicht-energie.example?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setNote('Vielen Dank! Ihr E-Mail-Programm wurde geöffnet – bitte senden Sie die Nachricht dort ab.', 'is-ok');
    });
    form.addEventListener('input', (e) => {
      const p = e.target.parentElement;
      if (p && p.classList.contains('is-invalid') && e.target.checkValidity() && e.target.value.trim()) p.classList.remove('is-invalid');
    });
  }

  /* ---------------------------------------------------------
     Footer-Jahr & erster Durchlauf
     --------------------------------------------------------- */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
  runScroll();
})();
