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
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (BAD.has(type) && (this===window||this===document||this===document.documentElement||this===document.body)) {
      const s = fn?.toString?.() || "";
      if (s.includes("_0x")||s.includes("window.open")||s.includes("window['open']")||s.includes('window["open"]')
        ||s.includes("location.href")||s.includes("location.assign")||s.includes("location.replace")
        ||s.includes("popunder")||s.includes("runPop")) return;
    }
    return _ael.call(this, type, fn, opts);
  };

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

  console.log("[SAB] MAIN world OK:", window.location.hostname);
})();
