/* Himmellounge — interactions & motion */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (!hasGsap || !window.ScrollTrigger || reduced) document.documentElement.classList.add("no-gsap");

  /* ---------------- Opening hours ---------------- */
  // [open, close] in minutes since midnight; close may exceed 1440 (after midnight)
  const HOURS = {
    0: [15 * 60, 24 * 60], 1: [16 * 60, 24 * 60], 2: [16 * 60, 24 * 60], 3: [16 * 60, 24 * 60],
    4: [16 * 60, 24 * 60], 5: [16 * 60, 26 * 60], 6: [15 * 60, 26 * 60],
  };
  const fmt = (m) => { m %= 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

  function zurichNow() {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, min: (+get("hour") % 24) * 60 + +get("minute") };
  }

  function openState() {
    const { day, min } = zurichNow();
    const prev = (day + 6) % 7;
    // still open from yesterday's late shift?
    if (HOURS[prev][1] > 1440 && min < HOURS[prev][1] - 1440) return { open: true, until: HOURS[prev][1], day };
    const [o, c] = HOURS[day];
    if (min >= o && min < c) return { open: true, until: c, day };
    if (min < o) return { open: false, next: `heute um ${fmt(o)}`, day };
    return { open: false, next: `morgen um ${fmt(HOURS[(day + 1) % 7][0])}`, day };
  }

  function renderStatus() {
    const s = openState();
    const status = $("[data-status]");
    const live = $("[data-live]");
    status.classList.toggle("is-open", s.open);
    $("b", status).textContent = s.open ? `Geöffnet bis ${fmt(s.until)}` : "Geschlossen";
    live.classList.toggle("is-open", s.open);
    $("[data-live-title]").textContent = s.open ? "Jetzt geöffnet" : "Gerade geschlossen";
    $("[data-live-sub]").textContent = s.open ? `Wir sind bis ${fmt(s.until)} Uhr für dich da.` : `Wir öffnen ${s.next} Uhr.`;
    const [o, c] = HOURS[s.day];
    $("[data-today]").textContent = `${DAYS[s.day]}, ${fmt(o)} – ${fmt(c)}`;
    $$("[data-hours] li").forEach((li) => li.classList.toggle("is-today", +li.dataset.day === s.day));
  }
  renderStatus();
  setInterval(renderStatus, 60_000);
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------------- Text splitting ---------------- */
  function splitChars(el) {
    const text = el.textContent;
    el.textContent = "";
    text.split(" ").forEach((w, i, arr) => {
      const word = document.createElement("span");
      word.className = "word";
      [...w].forEach((ch) => {
        const c = document.createElement("span");
        c.className = "char";
        c.textContent = ch;
        word.appendChild(c);
      });
      el.appendChild(word);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return $$(".char", el);
  }
  function splitWords(el, inner = false) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "word";
            if (inner) { const s = document.createElement("span"); s.textContent = part; w.appendChild(s); }
            else w.textContent = part;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
    return $$(".word", el);
  }

  const heroChars = $$("[data-split]").map(splitChars);
  const manifestWords = splitWords($("[data-manifest]"));
  const wordHeads = $$("[data-split-words]").map((el) => ({ el, words: splitWords(el, true) }));

  /* ---------------- Loader ---------------- */
  const loader = $(".loader");
  const countEl = $("[data-count]");
  let progress = 0;
  const imgs = $$("img").filter((i) => !i.loading || i.loading !== "lazy");
  let loaded = 0;
  const target = () => Math.min(100, Math.round((loaded / Math.max(imgs.length, 1)) * 100));
  imgs.forEach((img) => {
    if (img.complete) loaded++;
    else img.addEventListener("load", () => loaded++, { once: true }), img.addEventListener("error", () => loaded++, { once: true });
  });
  const start = performance.now();
  (function tick(now) {
    const minTime = reduced ? 0 : 1400;
    const t = Math.min(1, (now - start) / minTime);
    progress += (Math.min(target(), t * 100) - progress) * 0.12;
    countEl.textContent = Math.round(progress);
    if (progress > 99.4 && t >= 1) return finishLoading();
    requestAnimationFrame(tick);
  })(start);
  setTimeout(() => (loaded = imgs.length), 4000); // never block on slow images

  let finished = false;
  function finishLoading() {
    if (finished) return;
    finished = true;
    countEl.textContent = "100";
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    setTimeout(() => loader.classList.add("is-gone"), 1600);
    heroIntro();
  }

  /* ---------------- Hero intro ---------------- */
  function heroIntro() {
    const ins = $$("[data-hero-in]");
    if (!hasGsap || reduced) { ins.forEach((el) => (el.style.opacity = 1)); return; }
    gsap.set(ins, { opacity: 0, y: 30 });
    const tl = gsap.timeline({ delay: 0.45 });
    tl.from($(".hero__media img"), { scale: 1.35, duration: 2.6, ease: "expo.out" }, 0)
      .from(heroChars[0], { yPercent: 115, rotate: 6, duration: 1.3, ease: "expo.out", stagger: 0.028 }, 0.2)
      .from(heroChars[1], { yPercent: 115, rotate: 6, duration: 1.3, ease: "expo.out", stagger: 0.028 }, 0.42)
      .to(ins, { opacity: 1, y: 0, duration: 1.2, ease: "expo.out", stagger: 0.1 }, 0.9)
      .from(".nav", { yPercent: -100, opacity: 0, duration: 1.1, ease: "expo.out" }, 0.8);
    // gold shimmer travelling through italic line
    gsap.to(heroChars[1], { backgroundPosition: "-300% 0", duration: 6, ease: "none", repeat: -1 });
  }

  /* ---------------- Smooth scroll ---------------- */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    if (hasGsap && window.ScrollTrigger) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id === "#top" ? document.body : $(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(el, { offset: id === "#top" ? 0 : -40, duration: 1.6 });
      else el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    })
  );

  /* ---------------- Nav ---------------- */
  const nav = $("[data-nav]");
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > lastY && y > 600 && !menu.classList.contains("is-open"));
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const burger = $("[data-burger]");
  const menu = $("[data-menu]");
  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");
    lenis && lenis.start();
  }
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    if (!open) return closeMenu();
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");
    lenis && lenis.stop();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());

  /* ---------------- Reveal on scroll ---------------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }),
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  // draw-in SVG icons
  $$(".draw").forEach((svg) => {
    $$("path, circle", svg).forEach((p) => { try { p.style.setProperty("--len", Math.ceil(p.getTotalLength())); } catch (_) {} });
  });
  const drawIO = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("is-drawn")),
    { threshold: 0.3 }
  );
  $$(".draw").forEach((el) => drawIO.observe(el));

  // counters
  const countIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target, end = +el.dataset.counter, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    countIO.unobserve(el);
    const t0 = performance.now(), dur = reduced ? 1 : 1800;
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = pre + Math.round(end * e) + suf;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: 0.6 });
  $$("[data-counter]").forEach((el) => countIO.observe(el));

  /* ---------------- Text Reveal (manifest, scroll-scrubbed) ---------------- */
  const manifest = $("[data-manifest]");
  function litManifest() {
    const r = manifest.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
    const n = Math.round(p * manifestWords.length);
    manifestWords.forEach((w, i) => w.classList.toggle("is-lit", i < n));
  }
  window.addEventListener("scroll", litManifest, { passive: true });
  litManifest();

  /* ---------------- GSAP scroll scenes ---------------- */
  if (hasGsap && window.ScrollTrigger && !reduced) {
    // hero parallax out
    gsap.to("[data-hero-media]", { yPercent: 18, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__content", { yPercent: -22, opacity: 0.1, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });

    // Scroll Expansion (after 21st.dev @arunachalam/scroll-expansion-hero):
    // instead of hijacking the wheel, the section is pinned and the progress is scroll-scrubbed.
    const mobile = window.innerWidth < 768;
    gsap.timeline({
      scrollTrigger: { trigger: "[data-expand]", pin: "[data-expand-pin]", start: "top top", end: "+=130%", scrub: 0.6, anticipatePin: 1, refreshPriority: -1 },
    })
      .fromTo("[data-expand-media]",
        { width: mobile ? 220 : 300, height: mobile ? 320 : 400, borderRadius: 18 },
        { width: () => window.innerWidth, height: () => window.innerHeight, borderRadius: 0, ease: "power2.inOut" }, 0)
      .to("[data-expand-bg]", { opacity: 0, ease: "none" }, 0)
      .to("[data-expand-shade]", { opacity: 0.25, ease: "none" }, 0)
      .to("[data-expand-l]", { xPercent: mobile ? -60 : -90, ease: "power2.in" }, 0)
      .to("[data-expand-r]", { xPercent: mobile ? 60 : 90, ease: "power2.in" }, 0)
      .to("[data-expand-hint]", { opacity: 0, duration: 0.2 }, 0)
      .to(".expand__title", { opacity: 0, duration: 0.25 }, 0.75);

    // word-mask headings
    wordHeads.forEach(({ el, words }) => {
      gsap.from(words.map((w) => w.firstChild), {
        yPercent: 110, duration: 1.3, ease: "expo.out", stagger: 0.06,
        scrollTrigger: { trigger: el, start: "top 82%" },
      });
    });

    // horizontal experiences (desktop only)
    const mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", () => {
      const track = $("[data-exp-track]");
      const dist = () => track.scrollWidth - window.innerWidth;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: {
          trigger: "[data-exp]", pin: "[data-exp-pin]", start: "top top", end: () => "+=" + dist(),
          scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (st) => gsap.set("[data-exp-bar]", { scaleX: st.progress }),
        },
      });
      $$(".card", track).forEach((card) => {
        gsap.from(card, { opacity: 0.25, scale: 0.92, ease: "none", scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 100%", end: "left 55%", scrub: true } });
      });
    });

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }

  /* ---------------- Background Paths (after 21st.dev @kokonutd/background-paths) ---------------- */
  $$("[data-paths]").forEach((host) => {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 696 316");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    [1, -1].forEach((position) => {
      for (let i = 0; i < 36; i++) {
        const o = (n) => n - i * 5 * position;
        const d = `M${-o(380)} ${-(189 + i * 6)}C${-o(380)} ${-(189 + i * 6)} ${-o(312)} ${216 - i * 6} ${o(152)} ${343 - i * 6}C${o(616)} ${470 - i * 6} ${o(684)} ${875 - i * 6} ${o(684)} ${875 - i * 6}`;
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("pathLength", "1");
        path.setAttribute("stroke-width", (0.5 + i * 0.03).toFixed(2));
        path.setAttribute("stroke-opacity", (0.06 + i * 0.012).toFixed(3));
        path.style.setProperty("--d", `${20 + Math.random() * 10}s`);
        path.style.animationDelay = `${-Math.random() * 20}s`;
        svg.appendChild(path);
      }
    });
    host.appendChild(svg);
  });

  /* ---------------- Marquee speed follows scroll velocity ---------------- */
  const marquee = $("[data-marquee]");
  if (marquee && !reduced) {
    let v = 0, last = window.scrollY;
    (function loop() {
      const y = window.scrollY;
      v += (Math.abs(y - last) - v) * 0.1;
      last = y;
      marquee.style.animationDuration = `${Math.max(8, 38 - v * 1.4)}s`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- Cursor ---------------- */
  if (fine && !reduced) {
    const cur = $(".cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`; }, { passive: true });
    (function follow() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(follow);
    })();
    $$("a, button, [data-hover], .card, .pax button, .seg label").forEach((el) => {
      el.addEventListener("mouseenter", () => cur.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cur.classList.remove("is-hover"));
    });
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (fine && !reduced) {
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform .7s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "";
        setTimeout(() => (el.style.transition = ""), 700);
      });
    });

    // card tilt + glow follow
    $$("[data-tilt]").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", `${px * 100}%`);
        card.style.setProperty("--my", `${py * 100}%`);
        card.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 8}deg) rotateX(${(0.5 - py) * 8}deg)`;
      });
      card.addEventListener("mouseleave", () => (card.style.transform = ""));
    });
  }

  /* ---------------- Canvas: starfield ---------------- */
  function canvasLoop(canvas, setup, draw) {
    const ctx = canvas.getContext("2d");
    let w, h, dpr, state, visible = true;
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state = setup(w, h);
    };
    resize();
    window.addEventListener("resize", resize);
    new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(canvas);
    (function frame(t) {
      if (visible) draw(ctx, w, h, state, t);
      if (!reduced) requestAnimationFrame(frame);
    })(0);
  }

  canvasLoop($("[data-stars]"), (w, h) => {
    const n = Math.round((w * h) / 5200);
    return {
      stars: Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h * 0.62, r: Math.random() * 1.1 + 0.2,
        p: Math.random() * Math.PI * 2, s: 0.4 + Math.random() * 1.4,
      })),
      shoot: null,
    };
  }, (ctx, w, h, st, t) => {
    ctx.clearRect(0, 0, w, h);
    for (const s of st.stars) {
      const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.s + s.p));
      const fade = 1 - s.y / (h * 0.62);
      ctx.globalAlpha = a * fade;
      ctx.fillStyle = s.r > 1 ? "#f6e3b4" : "#ffffff";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // occasional shooting star
    if (!st.shoot && Math.random() < 0.004) st.shoot = { x: Math.random() * w * 0.7 + w * 0.2, y: Math.random() * h * 0.25, l: 0 };
    if (st.shoot) {
      const sh = st.shoot; sh.l += 14;
      const g = ctx.createLinearGradient(sh.x - sh.l, sh.y + sh.l * 0.45, sh.x, sh.y);
      g.addColorStop(0, "rgba(240,213,149,0)"); g.addColorStop(1, "rgba(255,245,220,.9)");
      ctx.globalAlpha = Math.max(0, 1 - sh.l / 420);
      ctx.strokeStyle = g; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sh.x - sh.l, sh.y + sh.l * 0.45); ctx.lineTo(sh.x, sh.y); ctx.stroke();
      sh.x -= 6; sh.y += 2.7;
      if (sh.l > 420) st.shoot = null;
    }
    ctx.globalAlpha = 1;
  });

  /* ---------------- Canvas: shisha smoke ---------------- */
  canvasLoop($("[data-smoke]"), (w, h) => {
    const puffs = Array.from({ length: Math.round(w / 55) }, () => newPuff(w, h, true));
    return { puffs };
  }, (ctx, w, h, st) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < st.puffs.length; i++) {
      const p = st.puffs[i];
      p.life += 1; p.y -= p.vy; p.x += Math.sin((p.life + p.seed) * 0.012) * 0.45 + p.vx; p.r += 0.22;
      const k = p.life / p.max;
      const a = Math.sin(Math.PI * Math.min(1, k)) * p.a;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(235,225,205,${a})`);
      g.addColorStop(1, "rgba(235,225,205,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      if (k >= 1) st.puffs[i] = newPuff(w, h, false);
    }
  });
  function newPuff(w, h, scatter) {
    const max = 380 + Math.random() * 380;
    return {
      x: Math.random() * w, y: h + 40 - (scatter ? Math.random() * h * 0.6 : 0),
      vx: (Math.random() - 0.5) * 0.2, vy: 0.35 + Math.random() * 0.55,
      r: 40 + Math.random() * 90, a: 0.035 + Math.random() * 0.05,
      life: scatter ? Math.random() * max : 0, max, seed: Math.random() * 1000,
    };
  }

  /* ---------------- Sparkles (footer) ---------------- */
  $$("[data-sparkles]").forEach((wrap) => {
    canvasLoop($("canvas", wrap), (w, h) => ({
      pts: Array.from({ length: Math.round((w * h) / 2600) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
        p: Math.random() * 6.28, s: 1 + Math.random() * 3,
      })),
    }), (ctx, w, h, st, t) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of st.pts) {
        p.x = (p.x + p.vx + w) % w; p.y = (p.y + p.vy + h) % h;
        const a = Math.max(0, Math.sin(t * 0.001 * p.s + p.p));
        // fade towards edges like a radial mask
        const dx = (p.x / w - 0.35) * 1.6, dy = (p.y / h - 0.55) * 1.6;
        const m = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        ctx.globalAlpha = a * m;
        ctx.fillStyle = "#f0d595";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  });

  /* ---------------- Reservation form → WhatsApp ---------------- */
  const form = $("[data-form]");
  const dateInput = $("#f-date");
  const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = todayISO;
  dateInput.value = todayISO;
  let pax = "2";
  $$("[data-pax] button").forEach((b) =>
    b.addEventListener("click", () => {
      $$("[data-pax] button").forEach((x) => { x.classList.remove("is-active"); x.setAttribute("aria-checked", "false"); });
      b.classList.add("is-active"); b.setAttribute("aria-checked", "true");
      pax = b.textContent;
    })
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const note = $("[data-form-note]");
    const name = $("#f-name");
    const valid = name.value.trim().length > 1 && dateInput.value && $("#f-time").value;
    name.closest(".field").classList.toggle("is-invalid", name.value.trim().length < 2);
    if (!valid) { note.textContent = "Bitte Name, Datum und Uhrzeit angeben."; return; }
    const d = new Date(dateInput.value + "T12:00:00");
    const dateStr = d.toLocaleDateString("de-CH", { weekday: "long", day: "2-digit", month: "long" });
    const area = (form.querySelector('input[name="area"]:checked') || {}).value || "Egal";
    const msg = $("#f-msg").value.trim();
    const text = [
      "Hallo Himmellounge ✨",
      `Ich möchte gerne einen Tisch reservieren:`,
      ``,
      `👤 Name: ${name.value.trim()}`,
      `📅 Datum: ${dateStr}`,
      `🕗 Uhrzeit: ${$("#f-time").value}`,
      `👥 Personen: ${pax}`,
      `📍 Bereich: ${area}`,
      msg ? `💬 ${msg}` : "",
    ].filter(Boolean).join("\n");
    note.textContent = "WhatsApp wird geöffnet …";
    window.open(`https://wa.me/41767996969?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  });
})();
