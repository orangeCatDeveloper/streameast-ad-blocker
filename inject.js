// Stream Ad Blocker v5 - MAIN world script
// Loaded via web_accessible_resources as backup for background.js executeScript

(function () {
  "use strict";
  if (window.__SAB__) return;
  window.__SAB__ = true;

  const noop = function () {};
  const AD_METHODS = new Set([
    "runPop", "runAutoTag", "runNative",
    "runBanner", "runInterstitial", "runVast",
  ]);

  // 1. Block window.open
  const fake = {
    blur: noop, focus: noop, close: noop, closed: false,
    document: { write: noop, close: noop },
    location: {},
    addEventListener: noop, removeEventListener: noop, postMessage: noop,
  };
  window.open = function () { return fake; };

  // 2. Trap aclib
  let _ac;
  try {
    Object.defineProperty(window, "aclib", {
      get() { return _ac; },
      set(v) {
        _ac = (v && typeof v === "object")
          ? new Proxy(v, { get(t, p) { return AD_METHODS.has(p) ? noop : t[p]; } })
          : v;
      },
      configurable: true,
    });
  } catch (e) { window.aclib = { runPop: noop }; }

  // 3. Block Adcash
  try {
    Object.defineProperty(window, "Adcash", {
      get() { return undefined; }, set() {}, configurable: true,
    });
  } catch (e) {}

  // 4. Defuse click hijackers
  const _ael = EventTarget.prototype.addEventListener;
  const BAD = new Set(["click","mousedown","mouseup","pointerdown","pointerup","touchstart","touchend"]);
  const AD_PATTERNS = ["_0x","window.open","window['open']",'window["open"]',
    "location.href","location.assign","location.replace","location['href']",
    'location["href"]',"popunder","runPop"];
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (BAD.has(type)) {
      const s = fn?.toString?.() || "";
      // Block on any element if handler contains ad patterns
      if (AD_PATTERNS.some(p => s.includes(p))) return;
    }
    return _ael.call(this, type, fn, opts);
  };

  // 4b. Capture-phase click guard: block navigation to ad domains
  const SITE_HOSTS = new Set([
    window.location.hostname,
    "istreameast.is", "embedsports.top", "pooembed.eu",
  ]);
  document.addEventListener("click", function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.href || "";
    if (!href || href.startsWith("javascript:")) return;
    try {
      const host = new URL(href, window.location.href).hostname;
      // Allow same-site navigation
      if (SITE_HOSTS.has(host)) return;
      // Allow common legitimate domains
      if (host.includes("discord") || host.includes("twitter") || host.includes("x.com")) return;
      // Block everything else triggered by click (likely ad redirect)
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log("[SAB] Blocked ad navigation:", href);
    } catch (ex) {}
  }, true);

  // 4c. Block location.href hijacking
  const _loc = Object.getOwnPropertyDescriptor(window, "location")
    || Object.getOwnPropertyDescriptor(Window.prototype, "location");
  if (_loc && _loc.set) {
    const _origSet = _loc.set;
    try {
      Object.defineProperty(window, "location", {
        get: _loc.get,
        set(val) {
          const s = typeof val === "string" ? val : "";
          try {
            const host = new URL(s, window.location.href).hostname;
            if (!SITE_HOSTS.has(host)) {
              console.log("[SAB] Blocked location redirect:", s);
              return;
            }
          } catch (ex) {}
          _origSet.call(this, val);
        },
        configurable: true,
      });
    } catch (e) {}
  }

  // 5. Anti-adblock
  const _si = window.setInterval;
  window.setInterval = function (fn, ms, ...a) {
    const s = typeof fn === "function" ? fn.toString() : String(fn);
    if (s.includes("visibility") && ms >= 500 && ms <= 2000) return 0;
    return _si.call(window, fn, ms, ...a);
  };
  const _st = window.setTimeout;
  window.setTimeout = function (fn, ms, ...a) {
    const s = typeof fn === "function" ? fn.toString() : String(fn);
    if (s.includes("sadbl") || s.includes("adblock") || s.includes("AdBlock")) return 0;
    return _st.call(window, fn, ms, ...a);
  };

  // 6. Block tracking
  const _f = window.fetch;
  window.fetch = function (url, ...a) {
    const u = typeof url === "string" ? url : url?.url || "";
    if (u.includes("cdn-lab.shop")) {
      return Promise.resolve(new Response('{"data":{"report_interval":999999,"id":"x"}}', { status: 200 }));
    }
    return _f.call(window, url, ...a);
  };

  // 7. Intercept createElement to catch dynamically loaded ad scripts
  const _createElement = document.createElement.bind(document);
  document.createElement = function (tag, options) {
    const el = _createElement(tag, options);
    if (tag.toLowerCase() === "script") {
      // Monitor src assignment to block ad scripts
      const _srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src")
        || Object.getOwnPropertyDescriptor(el.__proto__, "src");
      if (_srcDesc) {
        Object.defineProperty(el, "src", {
          get() { return _srcDesc.get.call(this); },
          set(val) {
            const v = (val || "").toLowerCase();
            if (
              v.includes("adcash") || v.includes("tag.min.js") ||
              v.includes("popads") || v.includes("propellerads") ||
              v.includes("clickadu") || v.includes("exoclick") ||
              v.includes("adsterra") || v.includes("hilltopads")
            ) {
              console.log("[SAB] Blocked dynamic ad script:", val);
              return;
            }
            _srcDesc.set.call(this, val);
          },
          configurable: true,
        });
      }
    }
    return el;
  };

  console.log("[SAB] MAIN world OK:", window.location.hostname);
})();
