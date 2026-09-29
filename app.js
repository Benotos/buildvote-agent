/* Build.vote shared script. No build step, no dependencies besides three.js r128 (optional). */
(function () {
  "use strict";

  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = mqReduce.matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav__toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    }
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 780) setOpen(false);
    });
  }

  /* ---------- Card tilt ---------- */
  function initTilt() {
    if (reduceMotion || !finePointer) return;
    var els = document.querySelectorAll("[data-tilt]");
    Array.prototype.forEach.call(els, function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 5;
      var raf = 0;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          el.style.transition = "transform 0.12s linear, border-color 0.3s";
          el.style.transform =
            "perspective(1100px) rotateX(" + (-py * max).toFixed(2) + "deg) rotateY(" + (px * max).toFixed(2) + "deg)";
        });
      });
      el.addEventListener("pointerleave", function () {
        cancelAnimationFrame(raf);
        el.style.transition = "";
        el.style.transform = "";
      });
    });
  }

  /* ---------- Whitepaper table of contents highlight ---------- */
  function initToc() {
    var toc = document.querySelector(".toc");
    if (!toc || !("IntersectionObserver" in window)) return;
    var links = toc.querySelectorAll("a[href^='#']");
    var map = {};
    Array.prototype.forEach.call(links, function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          Array.prototype.forEach.call(links, function (a) { a.classList.remove("is-active"); });
          map[en.target.id].classList.add("is-active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------- Wallet helpers ---------- */
  var B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function base58(bytes) {
    var digits = [0];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) {
        carry += digits[j] << 8;
        digits[j] = carry % 58;
        carry = (carry / 58) | 0;
      }
      while (carry) {
        digits.push(carry % 58);
        carry = (carry / 58) | 0;
      }
    }
    var out = "";
    for (var k = 0; k < bytes.length && bytes[k] === 0; k++) out += "1";
    for (var d = digits.length - 1; d >= 0; d--) out += B58[digits[d]];
    return out;
  }

  function randomHex(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  function shortKey(k) { return k.length > 10 ? k.slice(0, 4) + "…" + k.slice(-4) : k; }

  function getProvider() {
    var w = window;
    if (w.phantom && w.phantom.solana && w.phantom.solana.isPhantom) return { p: w.phantom.solana, name: "Phantom" };
    if (w.solflare && w.solflare.isSolflare) return { p: w.solflare, name: "Solflare" };
    if (w.solana) {
      var s = w.solana;
      return { p: s, name: s.isPhantom ? "Phantom" : s.isSolflare ? "Solflare" : "Solana wallet" };
    }
    return null;
  }

  function isMobile() { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Draft ballot ---------- */
  function initBallot() {
    var form = document.getElementById("ballot");
    if (!form) return;

    var connectBtn = document.getElementById("connect");
    var signBtn = document.getElementById("sign");
    var statusEl = document.getElementById("wallet-status");
    var previewEl = document.getElementById("msg-preview");
    var outEl = document.getElementById("sig-out");

    var state = { wallet: null, pubkey: null, choice: null, nonce: randomHex(8) };

    form.addEventListener("submit", function (e) { e.preventDefault(); });

    function currentChoice() {
      var c = form.querySelector("input[name='choice']:checked");
      return c ? c.value : null;
    }

    function buildMessage(issuedAt) {
      return [
        (document.documentElement.getAttribute("data-brand") || "Build.vote") + " vote preview",
        "",
        "Round: 1 (draft ballot)",
        "Choice: " + (state.choice || "(none selected)"),
        "Wallet: " + (state.pubkey || "(not connected)"),
        "Nonce: " + state.nonce,
        "Issued at: " + (issuedAt || "(set when you sign)"),
        "",
        "This is a signed message, not a transaction.",
        "It moves no funds, approves nothing and is not counted."
      ].join("\n");
    }

    function setOut(html, isError) {
      outEl.innerHTML = html;
      outEl.classList.toggle("is-error", !!isError);
    }

    function render() {
      state.choice = currentChoice();
      previewEl.textContent = buildMessage();
      signBtn.disabled = !(state.pubkey && state.choice);
      if (state.pubkey) {
        statusEl.innerHTML = "Connected with " + escapeHtml(state.wallet.name) + ": <strong>" + escapeHtml(shortKey(state.pubkey)) + "</strong>";
        connectBtn.textContent = "Disconnect";
      } else {
        connectBtn.textContent = "Connect wallet";
      }
      if (!state.pubkey) signBtn.title = "Connect a wallet first";
      else if (!state.choice) signBtn.title = "Mark an option first";
      else signBtn.removeAttribute("title");
    }

    function onDisconnected() {
      state.pubkey = null;
      statusEl.textContent = "No wallet connected.";
      render();
    }

    form.addEventListener("change", function () {
      setOut("");
      render();
    });

    connectBtn.addEventListener("click", function () {
      if (state.pubkey && state.wallet) {
        try { state.wallet.p.disconnect && state.wallet.p.disconnect(); } catch (e) { /* ignore */ }
        onDisconnected();
        setOut("Disconnected.");
        return;
      }

      var w = getProvider();
      if (!w) {
        var here = window.location.href;
        var ref = window.location.origin;
        var msg = "No Solana wallet found in this browser. Install <a href=\"https://phantom.com\" target=\"_blank\" rel=\"noopener noreferrer\">Phantom</a> or <a href=\"https://solflare.com\" target=\"_blank\" rel=\"noopener noreferrer\">Solflare</a>, then reload.";
        if (isMobile() && /^https:/.test(here)) {
          msg = "No wallet found. Open this page inside a wallet app: " +
            "<a href=\"https://phantom.app/ul/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(ref) + "\">Phantom</a> or " +
            "<a href=\"https://solflare.com/ul/v1/browse/" + encodeURIComponent(here) + "?ref=" + encodeURIComponent(ref) + "\">Solflare</a>.";
        }
        statusEl.innerHTML = msg;
        return;
      }

      connectBtn.disabled = true;
      setOut("Waiting for " + escapeHtml(w.name) + "…");
      Promise.resolve()
        .then(function () { return w.p.connect(); })
        .then(function (res) {
          var pk = (res && res.publicKey) || w.p.publicKey;
          if (!pk) throw new Error("The wallet did not return a public key.");
          state.wallet = w;
          state.pubkey = pk.toString();
          setOut("");
          if (typeof w.p.on === "function" && !w.p.__bvBound) {
            w.p.__bvBound = true;
            w.p.on("disconnect", onDisconnected);
            w.p.on("accountChanged", function (next) {
              if (next) { state.pubkey = next.toString(); render(); } else { onDisconnected(); }
            });
          }
          render();
        })
        .catch(function (err) {
          var m = (err && err.message) || "Connection was cancelled.";
          setOut(escapeHtml(m), true);
        })
        .then(function () { connectBtn.disabled = false; });
    });

    signBtn.addEventListener("click", function () {
      if (!state.pubkey || !state.choice || !state.wallet) return;
      var p = state.wallet.p;
      if (typeof p.signMessage !== "function") {
        setOut("This wallet does not support message signing.", true);
        return;
      }
      state.nonce = randomHex(8);
      var message = buildMessage(new Date().toISOString());
      previewEl.textContent = message;
      var bytes = new TextEncoder().encode(message);

      signBtn.disabled = true;
      setOut("Check your wallet. It should ask you to sign a message, not approve a transaction.");
      Promise.resolve()
        .then(function () { return p.signMessage(bytes, "utf8"); })
        .then(function (res) {
          var sig = res && res.signature ? res.signature : res;
          if (!sig || typeof sig.length !== "number") throw new Error("The wallet returned no signature.");
          var b58 = base58(new Uint8Array(sig));
          setOut("");
          showReceipt({ choice: state.choice, wallet: state.pubkey, sig: b58, at: new Date() });
        })
        .catch(function (err) {
          var m = (err && err.message) || "Signing was cancelled.";
          setOut(escapeHtml(m), true);
        })
        .then(function () { render(); });
    });

    var receipt = null;
    function showReceipt(r) {
      if (receipt) receipt.remove();
      var brand = document.documentElement.getAttribute("data-brand") || "Build.vote";
      var xLink = document.querySelector(".nav__x");
      var handle = xLink ? (xLink.getAttribute("href").split("/").pop() || "") : "";
      var text = "I just marked " + r.choice + " on the " + brand + " draft ballot. Holders vote, an AI agent builds it live." + (handle ? " @" + handle : "");
      var share = "https://x.com/intent/post?text=" + encodeURIComponent(text) + (/^https:/.test(location.href) ? "&url=" + encodeURIComponent(location.origin + location.pathname) : "");
      var time = r.at.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

      receipt = document.createElement("div");
      receipt.className = "receipt";
      receipt.setAttribute("role", "status");
      receipt.setAttribute("tabindex", "-1");
      receipt.innerHTML =
        '<div class="receipt__stamp" aria-hidden="true">' +
          '<svg viewBox="0 0 40 40"><rect x="4" y="4" width="32" height="32" rx="5"/><path class="x x1" pathLength="1" d="M11.5 20.5l6 6.5 11.5-13.5"/></svg>' +
          "<span>Signed</span>" +
        "</div>" +
        '<p class="receipt__title">Your mark: <strong>' + escapeHtml(r.choice) + "</strong></p>" +
        '<dl class="receipt__rows">' +
          "<div><dt>Wallet</dt><dd><code>" + escapeHtml(shortKey(r.wallet)) + "</code></dd></div>" +
          "<div><dt>Signed</dt><dd>" + escapeHtml(time) + "</dd></div>" +
          "<div><dt>Signature</dt><dd><code>" + escapeHtml(r.sig.slice(0, 10) + "…" + r.sig.slice(-6)) + "</code></dd></div>" +
        "</dl>" +
        '<p class="receipt__note">This is what a real vote looks like. In a live round this signature gets checked against the snapshot and added to the public tally. This preview was not sent anywhere.</p>' +
        '<div class="btn-row">' +
          '<a class="btn btn--primary" href="' + escapeHtml(share) + '" target="_blank" rel="noopener noreferrer">Share on X</a>' +
          '<button type="button" class="btn btn--ghost" data-act="copy">Copy signature</button>' +
          '<button type="button" class="btn btn--ghost" data-act="again">Change mark</button>' +
        "</div>";

      form.classList.add("is-signed");
      form.querySelector(".ballot__actions").after(receipt);
      Array.prototype.forEach.call(form.querySelectorAll("input[name='choice']"), function (i) { i.disabled = true; });
      receipt.focus({ preventScroll: true });
      receipt.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });

      receipt.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-act]"); if (!b) return;
        if (b.getAttribute("data-act") === "copy") {
          var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy signature"; }, 1600); };
          if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(r.sig).then(done, function () {});
        } else {
          receipt.remove(); receipt = null;
          form.classList.remove("is-signed");
          Array.prototype.forEach.call(form.querySelectorAll("input[name='choice']"), function (i) { i.disabled = false; i.checked = false; });
          render();
          var first = form.querySelector("input[name='choice']"); if (first) first.focus();
        }
      });
    }

    render();
  }

  /* ---------- three.js background ---------- */
  function initScene() {
    var canvas = document.getElementById("scene");
    var THREE = window.THREE;
    if (!canvas || !THREE) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
      if (!renderer.getContext()) throw new Error("no context");
    } catch (e) {
      canvas.style.display = "none";
      return;
    }
    var BG = 0x070c1a;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BG, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 16, 40);
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    camera.position.set(0, 0, 24);

    var world = new THREE.Group();
    scene.add(world);
    var swarm = new THREE.Group();
    world.add(swarm);

    var boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    var blueMat = new THREE.LineBasicMaterial({ color: 0x7fa2ff, transparent: true, opacity: 0.7 });
    var redMat = new THREE.LineBasicMaterial({ color: 0xff5a4d, transparent: true, opacity: 1 });

    var N = 70, TURNS = 3.2, HEIGHT = 22, RADIUS = 6.4;
    var cubes = [], H = [], S = [], G = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    var COLS = 10, ROWS = 7, GAP = 1.75;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var a = t * TURNS * Math.PI * 2;
      H.push(new THREE.Vector3(Math.cos(a) * RADIUS, (t - 0.5) * HEIGHT, Math.sin(a) * RADIUS));
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      S.push(new THREE.Vector3(Math.cos(th) * r * 7.2, y * 7.2, Math.sin(th) * r * 7.2));
      var c = i % COLS, rw = Math.floor(i / COLS);
      G.push(new THREE.Vector3((c - (COLS - 1) / 2) * GAP, ((ROWS - 1) / 2 - rw) * GAP, 0));
      var isRed = i % 9 === 0;
      var m = new THREE.LineSegments(boxEdges, isRed ? redMat : blueMat);
      m.userData.s = isRed ? 1.0 : 0.5 + ((i * 37) % 10) / 28;
      m.userData.spin = 0.4 + ((i * 13) % 7) / 10;
      m.userData.phase = i;
      swarm.add(m);
      cubes.push(m);
    }

    var core = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.5, 1)), new THREE.LineBasicMaterial({ color: 0xff5a4d, transparent: true, opacity: 0.9 }));
    var innerCore = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.2, 0)), new THREE.LineBasicMaterial({ color: 0xff5a4d, transparent: true, opacity: 0.5 }));
    world.add(core); world.add(innerCore);

    // dust
    var DUST = 700, dpos = new Float32Array(DUST * 3);
    for (var k = 0; k < DUST; k++) {
      dpos[k * 3] = (Math.random() - 0.5) * 70;
      dpos[k * 3 + 1] = (Math.random() - 0.5) * 44;
      dpos[k * 3 + 2] = (Math.random() - 0.5) * 40 - 6;
    }
    var dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    var dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0x9fb6ff, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(dust);

    // bloom (desktop only)
    var composer = null, bloom = null;
    var wantBloom = window.innerWidth > 900 && THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass;
    if (wantBloom) {
      try {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.9, 0.45, 0.12);
        composer.addPass(bloom);
      } catch (e) { composer = null; }
    }

    var baseX = 0;
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      if (composer) { composer.setSize(w, h); bloom.setSize(w / 2, h / 2); }
      camera.aspect = w / h;
      baseX = camera.aspect > 1.15 ? -6.5 : 0;
      camera.position.z = camera.aspect < 0.8 ? 34 : 24;
      camera.updateProjectionMatrix();
    }

    function smooth(e0, e1, x) { var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
    var mx = 0, my = 0, tx = 0, ty = 0, scrollP = 0, sp = 0, rotY = 0, lastT = 0;
    function readScroll() {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollP = Math.min(1, Math.max(0, window.scrollY / max));
    }
    var tmp = new THREE.Vector3();

    function draw(now) {
      var el = now / 1000;
      var dt = lastT ? Math.min(0.05, el - lastT) : 0.016; lastT = el;
      mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
      sp += (scrollP - sp) * 0.06;

      var A = smooth(0.12, 0.42, sp);   // helix -> sphere
      var B = smooth(0.6, 0.9, sp);     // sphere -> grid
      rotY = (rotY + dt * (0.09 + 0.25 * A) * (1 - B)) % (Math.PI * 2);

      swarm.rotation.y = rotY * (1 - B);
      world.rotation.z = 0.32 * (1 - A) * (1 - B);
      world.rotation.x = -0.12 * B;

      for (var i = 0; i < cubes.length; i++) {
        var c = cubes[i], u = c.userData;
        tmp.copy(H[i]).lerp(S[i], A).lerp(G[i], B);
        tmp.y += Math.sin(el * 0.8 + u.phase) * 0.18 * (1 - B);
        c.position.copy(tmp);
        var sc = u.s * (1 - B) + 0.9 * B;
        c.scale.setScalar(sc);
        c.rotation.x = (u.spin * el * 0.35 + i) * (1 - B);
        c.rotation.y = (u.spin * el * 0.5 + i * 0.5) * (1 - B);
      }
      var cs = 1 - 0.75 * B;
      core.scale.setScalar(cs); innerCore.scale.setScalar(cs);
      core.position.z = innerCore.position.z = -3 * B;
      core.rotation.x = el * 0.16 + sp * 2; core.rotation.y = el * 0.22;
      innerCore.rotation.x = -el * 0.3; innerCore.rotation.y = -el * 0.25;
      dust.rotation.y = el * 0.01; dust.position.y = -sp * 6;

      camera.position.x = baseX * (1 - 0.35 * B) + mx * 2.4;
      camera.position.y = -my * 1.8;
      camera.lookAt(0, 0, 0);
      if (composer) composer.render(); else renderer.render(scene, camera);
    }

    resize(); readScroll(); sp = scrollP;

    if (reduceMotion) {
      draw(4000);
      window.addEventListener("resize", function () { resize(); draw(4000); });
      window.addEventListener("scroll", function () { readScroll(); sp = scrollP; draw(4000); }, { passive: true });
      return;
    }

    var running = false, rafId = 0;
    function loop(now) { if (!running) return; draw(now); rafId = requestAnimationFrame(loop); }
    function start() { if (!running) { running = true; lastT = 0; rafId = requestAnimationFrame(loop); } }
    function stop() { running = false; cancelAnimationFrame(rafId); }

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); stop(); canvas.style.display = "none"; });
    start();
  }

  /* ---------- Motion layer ---------- */
  var preloadDelay = document.documentElement.classList.contains("no-preload") || reduceMotion ? 0 : 1500;

  function splitWords(el) {
    var idx = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            var w = document.createElement("span"); w.className = "w";
            var inner = document.createElement("span"); inner.textContent = p; inner.style.setProperty("--i", idx++);
            w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "svg" && !n.classList.contains("sr-only")) {
          walk(n);
        }
      });
    })(el);
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  }

  function initMotion() {
    if (reduceMotion) return;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -12% 0px" }) : null;
    function watch(el) { if (io) io.observe(el); else el.classList.add("is-in"); }

    Array.prototype.forEach.call(document.querySelectorAll("[data-split]"), function (h) {
      splitWords(h);
      if (h.closest(".hero") || h.closest(".page-head")) {
        h.style.setProperty("--d", preloadDelay + "ms");
        requestAnimationFrame(function () { requestAnimationFrame(function () { h.classList.add("is-in"); }); });
      } else watch(h);
    });

    var sel = [".hero .lead", ".tags", ".ca", ".hero__cta", ".page-head .lead", ".draft-note", ".agent-status", ".section__head p",
      ".ballot-intro p", ".ballot", ".builds li", ".rules", ".contrib__item", ".contrib__note", ".faq__item", ".cta",
      ".tl", ".fee-card", ".table-card", ".readouts", ".panel", ".wp .toc", ".prose"].join(",");
    var groups = new Map();
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      var parent = el.parentNode, n = groups.get(parent) || 0; groups.set(parent, n + 1);
      var inHero = el.closest(".hero, .page-head");
      el.style.setProperty("--rd", ((inHero ? preloadDelay + 250 : 0) + Math.min(n, 6) * 80) + "ms");
      el.setAttribute("data-reveal", "");
      if (inHero) requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
      else watch(el);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".flow, .hs__panel"), watch);
  }

  function initSpotlight() {
    if (!finePointer) return;
    Array.prototype.forEach.call(document.querySelectorAll(".card"), function (c) { c.setAttribute("data-spot", ""); });
    document.addEventListener("pointermove", function (e) {
      var c = e.target.closest && e.target.closest("[data-spot]"); if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  function initMagnetic() {
    if (reduceMotion || !finePointer) return;
    Array.prototype.forEach.call(document.querySelectorAll(".btn"), function (b) {
      b.addEventListener("pointermove", function (e) {
        if (b.disabled) return;
        var r = b.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = "translate(" + (dx * 0.18).toFixed(1) + "px," + (dy * 0.3).toFixed(1) + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  function initScrollFx() {
    var hs = document.querySelector(".hs"), track = hs && hs.querySelector(".hs__track");
    var big = document.querySelectorAll(".bigcta__type span");
    var pinned = false, travel = 0;

    function layoutHS() {
      if (!hs) return;
      var want = !reduceMotion && window.innerWidth > 900;
      hs.classList.toggle("is-pinned", want);
      pinned = want;
      if (!want) { hs.style.removeProperty("--hs-h"); hs.style.removeProperty("--hx"); return; }
      travel = Math.max(0, track.scrollWidth - window.innerWidth);
      hs.style.setProperty("--hs-h", (travel + window.innerHeight) + "px");
    }
    function onScroll() {
      var vh = window.innerHeight;
      if (hs && pinned) {
        var r = hs.getBoundingClientRect();
        var total = hs.offsetHeight - vh;
        var p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
        hs.style.setProperty("--hx", (-p * travel).toFixed(1) + "px");
        hs.style.setProperty("--hp", p.toFixed(3));
        Array.prototype.forEach.call(track.children, function (panel) {
          var pr = panel.getBoundingClientRect();
          if (pr.left < window.innerWidth * 0.85 && pr.top < vh) panel.classList.add("is-in");
        });
      }
      Array.prototype.forEach.call(big, function (sp, i) {
        var r = sp.getBoundingClientRect();
        var f = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.55)));
        sp.style.setProperty("--fill", f.toFixed(3));
      });
    }
    var ticking = false;
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); } }
    layoutHS(); onScroll();
    window.addEventListener("scroll", req, { passive: true });
    window.addEventListener("resize", function () { layoutHS(); onScroll(); });
    window.addEventListener("load", function () { layoutHS(); onScroll(); });
  }

  /* ---------- Live build dashboard ---------- */
  function initLive() {
    var main = document.querySelector("main[data-live-json]");
    if (!main) return;
    var jsonUrl = main.getAttribute("data-live-json");
    var repo = (main.getAttribute("data-github") || "").match(/github\.com\/([^\/]+)\/([^\/#?]+)/);
    var POLL = 20000;
    var last = { json: null, commits: null, commitCount: null };

    function $(sel) { return main.querySelector(sel); }
    function fmtNum(n, d) { return Number(n).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
    function ago(iso) {
      var t = Date.parse(iso); if (!t) return "";
      var s = Math.max(0, (Date.now() - t) / 1000);
      if (s < 60) return "just now";
      if (s < 3600) return Math.floor(s / 60) + "m ago";
      if (s < 86400) return Math.floor(s / 3600) + "h ago";
      return Math.floor(s / 86400) + "d ago";
    }
    function day(iso) { var t = Date.parse(iso); return t ? new Date(t).toISOString().slice(0, 10) : "—"; }
    function safeUrl(u) { return /^https:\/\//.test(u || "") ? u : ""; }
    function link(u, text) { u = safeUrl(u); return u ? '<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) + "</a>" : '<span class="muted">none</span>'; }
    function txLink(sig) { return sig ? link("https://solscan.io/tx/" + encodeURIComponent(sig), sig.slice(0, 6) + "…" + sig.slice(-4)) : '<span class="muted">none</span>'; }
    function isNum(v) { return typeof v === "number" && isFinite(v); }

    function animateTo(el, to, fmt) {
      var from = parseFloat(el.getAttribute("data-val"));
      el.setAttribute("data-val", to);
      if (reduceMotion || !isFinite(from) || from === to) { el.textContent = fmt(to); return; }
      var t0 = performance.now(), dur = 900;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
      })(t0);
      el.parentNode.classList.remove("is-fresh"); void el.offsetWidth; el.parentNode.classList.add("is-fresh");
    }
    function setReadout(key, value, fmt, note) {
      var box = $('.readout[data-key="' + key + '"]'); if (!box) return;
      var v = box.querySelector(".readout__v"), n = box.querySelector(".readout__n");
      if (isNum(value)) { animateTo(v, value, fmt); box.classList.add("is-live"); }
      else { v.textContent = "—"; v.removeAttribute("data-val"); box.classList.remove("is-live"); }
      if (note) n.innerHTML = note;
    }
    function setCount(key, n, word) {
      var el = $('[data-count="' + key + '"]'); if (!el || !n) return;
      el.textContent = n + " " + word + (n === 1 ? "" : "s");
      el.classList.add("pill--live");
    }
    function showEmpty(key, show) { var e = $('[data-empty="' + key + '"]'); if (e) e.hidden = !show; }

    /* console */
    var con = $(".console"), feedEl = $("#feed"), seen = {}, typeQ = [], typing = false, clockTimer = 0;
    var KIND = { start: "▶", think: "›", read: "read", edit: "edit", run: "$", search: "find", plan: "plan", tool: "tool", done: "✓", error: "!", info: "·" };
    function c(k) { return con ? con.querySelector('[data-c="' + k + '"]') : null; }
    function hhmmss(ms) {
      var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      return (h ? h + ":" : "") + (h ? ("0" + m).slice(-2) : m) + ":" + ("0" + x).slice(-2);
    }
    function clockTick(d) {
      clearInterval(clockTimer);
      var a = (d && d.agent) || {}, sch = (d && d.schedule) || {};
      function tick() {
        if (a.status === "building" && a.started_at) c("clock").textContent = "⏱ " + hhmmss(Date.now() - Date.parse(a.started_at));
        else c("clock").textContent = "";
        var nx = Date.parse(sch.next_run || "");
        if (a.status !== "building" && nx) {
          var left = nx - Date.now();
          c("next").textContent = left > 0 ? "Next session in " + hhmmss(left) : "Next session starting soon";
        } else c("next").textContent = "";
      }
      tick(); clockTimer = setInterval(tick, 1000);
    }
    function pump() {
      if (typing || !typeQ.length) return;
      typing = true;
      var job = typeQ.shift(), li = job.li, txt = job.text, i = 0, out = li.querySelector(".f__text");
      li.hidden = false;
      if (reduceMotion || document.hidden || typeQ.length > 12) { out.textContent = txt; typing = false; feedEl.scrollTop = feedEl.scrollHeight; pump(); return; }
      li.classList.add("is-typing");
      (function step() {
        i = Math.min(txt.length, i + Math.max(1, Math.round(txt.length / 40)));
        out.textContent = txt.slice(0, i);
        feedEl.scrollTop = feedEl.scrollHeight;
        if (i < txt.length) setTimeout(step, 14);
        else { li.classList.remove("is-typing"); typing = false; setTimeout(pump, 90); }
      })();
    }
    function renderFeed(feed, animate) {
      if (!feedEl) return;
      feed.slice(-80).forEach(function (f) {
        var key = (f.t || "") + "|" + (f.kind || "") + "|" + (f.text || "");
        if (seen[key]) return; seen[key] = 1;
        var li = document.createElement("li");
        var kind = KIND[f.kind] ? f.kind : "info";
        li.className = "f f--" + kind;
        var t = Date.parse(f.t), ts = t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }) : "";
        li.innerHTML = '<span class="f__t">' + escapeHtml(ts) + '</span><span class="f__k">' + escapeHtml(KIND[kind]) + '</span><span class="f__text"></span>';
        feedEl.appendChild(li);
        if (animate) { li.hidden = true; typeQ.push({ li: li, text: String(f.text || "") }); }
        else li.querySelector(".f__text").textContent = String(f.text || "");
      });
      while (feedEl.children.length > 120) feedEl.removeChild(feedEl.firstChild);
      c("empty").hidden = !!feed.length;
      feedEl.scrollTop = feedEl.scrollHeight;
      pump();
    }
    var firstRender = true;
    var demo = false;
    function renderStatus(d) {
      if (!con || demo) return;
      var a = (d && d.agent) || {};
      var state = ["building", "idle", "standby", "paused"].indexOf(a.status) > -1 ? a.status : "standby";
      if (state === "building" && d.updated_at && Date.now() - Date.parse(d.updated_at) > 2 * 3600 * 1000) state = "idle";
      con.setAttribute("data-state", state);
      c("state").textContent = { building: "Building", idle: "Idle", standby: "Standby", paused: "Paused" }[state];
      c("task").textContent = a.task || (state === "standby" ? "Starts at launch. Creator fees fund the first session." : "");
      c("session").textContent = a.session ? "session #" + a.session : "no session";
      c("turns").textContent = a.turns ? a.turns + " steps" : "";
      var feed = Array.isArray(d.feed) ? d.feed : [];
      // on first load replay only the last few lines with typing, the rest instantly
      if (firstRender) { renderFeed(feed.slice(0, -6), false); renderFeed(feed.slice(-6), true); firstRender = false; }
      else renderFeed(feed, true);
      clockTick(d);

      var sessions = Array.isArray(d.sessions) ? d.sessions : [];
      var sub = d.billing === "subscription";
      function val(x) { return isNum(x.cost_usd) && x.cost_usd > 0 ? x.cost_usd : (isNum(x.api_value_usd) ? x.api_value_usd : 0); }
      var bars = $("#spendbars"), costs = sessions.map(val);
      var st = $("#spend-title"); if (st) st.textContent = sub ? "Usage per session" : "Spend per session";
      var total = costs.reduce(function (s, v) { return s + v; }, 0), max = Math.max.apply(null, costs.concat([0.0001]));
      $('[data-c="spendempty"]').hidden = !!sessions.length;
      $('[data-c="spendtotal"]').textContent = sessions.length ? (sub ? "$0 billed" : "$" + fmtNum(total, 2) + " total") : "—";
      $('[data-c="nsess"]').textContent = sessions.length;
      $('[data-c="avg"]').textContent = sessions.length ? "$" + fmtNum(total / sessions.length, 2) + (sub ? " API value" : "") : "—";
      $('[data-c="cap"]').textContent = sub ? (isNum(d.max_sessions_per_day) ? d.max_sessions_per_day + " sessions / day" : "Subscription")
        : isNum(d.daily_budget_usd) ? "$" + fmtNum(d.daily_budget_usd, 2) + " / day" : "—";
      var capdt = $('[data-c="cap"]') && $('[data-c="cap"]').previousElementSibling; if (capdt) capdt.textContent = sub ? "Limit" : "Daily cap";
      bars.innerHTML = sessions.slice(-24).map(function (x, i) {
        var h = Math.max(4, val(x) / max * 100);
        var tip = day(x.date) + " · " + (x.task || "") + " · " + (x.billing === "subscription" ? "$" + fmtNum(val(x), 2) + " API value, covered by subscription" : "$" + fmtNum(x.cost_usd || 0, 2));
        var u = safeUrl(x.log_url);
        return (u ? '<a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer"' : "<span") + ' class="sb" style="--h:' + h.toFixed(1) + '%;--i:' + i + '" title="' + escapeHtml(tip) + '"><span class="sr-only">' + escapeHtml(tip) + "</span>" + (u ? "</a>" : "</span>");
      }).join("");
      bars.setAttribute("aria-label", sessions.length ? sessions.length + " sessions, $" + fmtNum(total, 2) + " total" : "No sessions yet");
    }


    /* demo session: clearly labeled, never touches real numbers */
    var DEMO_SCRIPT = [
      ["start", "Session started: Bundle detector, first working version"],
      ["think", "Reading my notes from last session before changing anything."],
      ["read", "PROGRESS.md"], ["read", "TASK.md"],
      ["plan", "Now: fetch early buyers for a mint from a public RPC"],
      ["search", "getSignaturesForAddress"],
      ["read", "bundle-detector/src/rpc.ts"],
      ["edit", "bundle-detector/src/rpc.ts"],
      ["think", "Early buyers need their funding source, so I also need the first incoming SOL transfer per wallet."],
      ["edit", "bundle-detector/src/funding.ts"],
      ["run", "npm test -- funding"],
      ["error", "1 test failed: expected 3 clusters, got 4"],
      ["think", "Two wallets share a funder through an intermediate hop. Grouping should follow one hop."],
      ["edit", "bundle-detector/src/cluster.ts"],
      ["run", "npm test"],
      ["info", "12 passed, 0 failed"],
      ["edit", "bundle-detector/README.md"],
      ["edit", "PROGRESS.md"],
      ["done", "Session finished · 16 steps · demo, no real cost"]
    ];
    var demoTimers = [], demoClock = 0;
    function stopDemoTimers() { demoTimers.forEach(clearTimeout); demoTimers = []; clearInterval(demoClock); }
    function resetFeed() { feedEl.innerHTML = ""; seen = {}; typeQ = []; typing = false; }
    function exitDemo() {
      stopDemoTimers(); demo = false; resetFeed(); firstRender = true;
      con.removeAttribute("data-demo"); c("badge").hidden = true;
      demoBtn.textContent = "Watch a demo";
      renderStatus(last.json || {});
    }
    function startDemo() {
      stopDemoTimers(); clearInterval(clockTimer);
      demo = true; resetFeed();
      con.setAttribute("data-demo", ""); con.setAttribute("data-state", "building");
      c("badge").hidden = false; c("empty").hidden = true;
      c("state").textContent = "Demo";
      c("task").textContent = "Bundle detector (sample session)";
      c("session").textContent = "demo"; c("next").textContent = ""; c("turns").textContent = "";
      demoBtn.textContent = "Exit demo";
      var t0 = Date.now(), steps = 0;
      demoClock = setInterval(function () { c("clock").textContent = "⏱ " + hhmmss(Date.now() - t0); }, 1000);
      c("clock").textContent = "⏱ 0:00";
      var delay = 400;
      DEMO_SCRIPT.forEach(function (row, i) {
        delay += row[0] === "think" ? 1600 : row[0] === "run" ? 1900 : 900 + (i % 3) * 250;
        demoTimers.push(setTimeout(function () {
          if (row[0] !== "think" && row[0] !== "start" && row[0] !== "done" && row[0] !== "info" && row[0] !== "error") steps++;
          c("turns").textContent = steps ? steps + " steps" : "";
          renderFeed([{ t: new Date().toISOString(), kind: row[0], text: row[1] }], true);
          if (i === DEMO_SCRIPT.length - 1) {
            clearInterval(demoClock);
            con.setAttribute("data-state", "idle");
            c("state").textContent = "Demo finished";
            c("task").textContent = "Real sessions start at launch.";
          }
        }, delay));
      });
    }
    var demoBtn = con && con.querySelector("[data-demo-btn]");
    if (demoBtn) demoBtn.addEventListener("click", function () { if (demo) exitDemo(); else startDemo(); });

    function renderJson(d) {
      renderStatus(d);
      var sessions = Array.isArray(d.sessions) ? d.sessions : [];
      var rows = Array.isArray(d.ledger) ? d.ledger : [];
      var queue = Array.isArray(d.queue) ? d.queue : [];

      var spend = sessions.reduce(function (t, x) { return t + (isNum(x.cost_usd) ? x.cost_usd : 0); }, 0);
      var subs = d.billing === "subscription";
      setReadout("spend", sessions.length ? spend : null, function (v) { return "$" + fmtNum(v, 2); },
        sessions.length ? (subs ? "Runs on a Claude subscription, no API bill" : "Across " + sessions.length + " session" + (sessions.length === 1 ? "" : "s")) : "Not live yet");

      function sumType(t) { return rows.filter(function (r) { return r.type === t && isNum(r.amount); }).reduce(function (s, r) { return s + r.amount; }, 0); }
      var claims = rows.filter(function (r) { return r.type === "claim"; });
      var payouts = rows.filter(function (r) { return r.type === "payout"; });
      setReadout("fees", claims.length ? sumType("claim") : null, function (v) { return fmtNum(v, 2) + " SOL"; },
        claims.length ? claims.length + " claim" + (claims.length === 1 ? "" : "s") + " on Solana" : "Not live yet");
      setReadout("payouts", payouts.length ? sumType("payout") : null, function (v) { return fmtNum(v, 2) + " SOL"; },
        payouts.length ? payouts.length + " payout" + (payouts.length === 1 ? "" : "s") : "Not live yet");

      var h = d.holders || {};
      setReadout("holders", isNum(h.count) ? h.count : null, function (v) { return fmtNum(v); },
        isNum(h.count) ? (safeUrl(h.source) ? link(h.source, "Source") + " · " : "") + ago(h.as_of) : "Token not launched");

      var r = d.round || {};
      setReadout("round", isNum(r.number) ? r.number : null, function (v) { return "#" + fmtNum(v); },
        isNum(r.number) ? escapeHtml((r.status || "") + (r.title ? ": " + r.title : "")) : "Round 1 opens after launch");

      var q = $("#queue");
      q.innerHTML = queue.map(function (x) {
        return '<li><span class="feed__main">' + escapeHtml(x.title || "Untitled") + '</span><span class="tag tag--' + escapeHtml(x.status || "queued") + '">' + escapeHtml(x.status || "queued") + "</span></li>";
      }).join("");
      showEmpty("queue", !queue.length); setCount("queue", queue.length, "item");
      var foot = $('[data-foot="queue"]'); if (foot) foot.hidden = !queue.some(function (x) { return x.status === "proposed"; });

      if (sessions.length) {
        $("#sessions").innerHTML = sessions.slice().sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); }).map(function (x) {
          return "<tr><td>" + day(x.date) + "</td><td>" + escapeHtml(x.task || "") + "</td><td>" + (isNum(x.calls) ? fmtNum(x.calls) : "—") + "</td><td>" + (isNum(x.cost_usd) ? "$" + fmtNum(x.cost_usd, 2) : "—") + "</td><td>" + link(x.log_url, "Log") + "</td></tr>";
        }).join("");
        setCount("sessions", sessions.length, "session");
      }
      if (rows.length) {
        $("#ledger").innerHTML = rows.slice().sort(function (a, b) { return Date.parse(b.date) - Date.parse(a.date); }).map(function (x) {
          return "<tr><td>" + day(x.date) + '</td><td><span class="tag tag--' + escapeHtml(x.type || "") + '">' + escapeHtml(x.type || "") + "</span></td><td>" + (isNum(x.amount) ? fmtNum(x.amount, 3) + " " + escapeHtml(x.unit || "SOL") : "—") + "</td><td>" + escapeHtml(x.to || "") + "</td><td>" + txLink(x.tx) + "</td></tr>";
        }).join("");
        setCount("ledger", rows.length, "record");
      }
    }

    function renderCommits(list, total) {
      var ol = $("#commits");
      ol.innerHTML = list.slice(0, 8).map(function (c) {
        var msg = ((c.commit && c.commit.message) || "").split("\n")[0];
        var when = c.commit && c.commit.author && c.commit.author.date;
        return '<li><a class="feed__main" href="' + escapeHtml(safeUrl(c.html_url)) + '" target="_blank" rel="noopener noreferrer"><code>' + escapeHtml((c.sha || "").slice(0, 7)) + "</code> " + escapeHtml(msg) + '</a><span class="feed__time">' + ago(when) + "</span></li>";
      }).join("");
      showEmpty("commits", !list.length);
      setCount("commits", total || list.length, "commit");
      var name = repo[1] + "/" + repo[2].replace(/\.git$/, "");
      setReadout("commits", list.length ? (total || list.length) : null, function (v) { return fmtNum(v); },
        list.length ? link("https://github.com/" + name, name) + " · last " + ago(list[0].commit.author.date) : "No commits yet");
    }

    function loadJson() {
      if (!jsonUrl) return;
      fetch(jsonUrl + (jsonUrl.indexOf("?") > -1 ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { last.json = d; renderJson(d); })
        .catch(function () {
          /* keep last render; retry on next poll */
        });
    }
    function loadCommits() {
      if (!repo) return;
      var base = "https://api.github.com/repos/" + repo[1] + "/" + repo[2].replace(/\.git$/, "");
      fetch(base + "/commits?per_page=10", { headers: { Accept: "application/vnd.github+json" } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json().then(function (list) { return { list: list }; });
        })
        .then(function (res) {
          if (!Array.isArray(res.list)) return;
          // total count: ask for 1 per page and read the last page number
          return fetch(base + "/commits?per_page=1").then(function (r2) {
            var l = r2.headers.get("Link") || "", m = l.match(/[?&]page=(\d+)>; rel="last"/);
            renderCommits(res.list, m ? parseInt(m[1], 10) : res.list.length);
          }, function () { renderCommits(res.list, res.list.length); });
        })
        .catch(function () { /* rate limited or repo missing: keep last render */ });
    }

    loadJson(); loadCommits();
    var timers = [];
    function start() { timers = [setInterval(loadJson, POLL), setInterval(loadCommits, POLL * 3), setInterval(function () {}, 30000)]; }
    function stop() { timers.forEach(clearInterval); timers = []; }
    start();
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else { loadJson(); start(); } });
  }

  /* ---------- Copy contract address ---------- */
  function initCopy() {
    var btn = document.querySelector(".ca__copy");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var v = btn.getAttribute("data-copy");
      if (!v) return;
      function done() { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1600); }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(v).then(done, function () { btn.textContent = "Select and copy"; });
      } else {
        var r = document.createRange(); r.selectNodeContents(document.getElementById("ca-value"));
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
      }
    });
  }

  function init() {
    initCopy();
    initLive();
    initMotion();
    initSpotlight();
    initMagnetic();
    initScrollFx();
    initNav();
    initTilt();
    initToc();
    initBallot();
    try { initScene(); } catch (e) { /* fail silently */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
