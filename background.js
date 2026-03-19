// Stream Ad Blocker v5 - Background Service Worker
// Primary injection mechanism: chrome.scripting.executeScript with world: MAIN

const INJECT_CODE = () => {
  if (window.__SAB__) return;
  window.__SAB__ = true;

  // 1. Block window.open
  const fake = {
    blur(){}, focus(){}, close(){}, closed:false,
    document:{write(){},close(){}}, location:{},
    addEventListener(){}, removeEventListener(){}, postMessage(){}
  };
  window.open = function() { return fake; };

  // 2. Trap aclib with Proxy (blocks runPop, runAutoTag, etc.)
  const AD = new Set(["runPop","runAutoTag","runNative","runBanner","runInterstitial","runVast"]);
  const noop = function(){};
  let _ac;
  try {
    Object.defineProperty(window, "aclib", {
      get(){ return _ac; },
      set(v){
        _ac = (v && typeof v === "object") ? new Proxy(v, {
          get(t,p){ return AD.has(p) ? noop : t[p]; }
        }) : v;
      },
      configurable: true
    });
  } catch(e){}

  // 3. Block Adcash
  try {
    Object.defineProperty(window, "Adcash", {
      get(){ return undefined; }, set(){}, configurable: true
    });
  } catch(e){}

  // 4. Defuse click hijackers (on ANY element, not just document/body)
  const _ael = EventTarget.prototype.addEventListener;
  const BAD = new Set(["click","mousedown","mouseup","pointerdown","pointerup","touchstart","touchend"]);
  const ADP = ["_0x","window.open","window['open']",'window["open"]',
    "location.href","location.assign","location.replace","location['href']",
    'location["href"]',"popunder","runPop"];
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    if (BAD.has(type)) {
      const s = fn?.toString?.() || "";
      if (ADP.some(p => s.includes(p))) return;
    }
    return _ael.call(this, type, fn, opts);
  };

  // 4b. Capture-phase click guard: block navigation to ad domains
  const HOSTS = new Set([window.location.hostname,
    "istreameast.is","embedsports.top","pooembed.eu"]);
  document.addEventListener("click", function(e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.href || "";
    if (!href || href.startsWith("javascript:")) return;
    try {
      const host = new URL(href, window.location.href).hostname;
      if (HOSTS.has(host)) return;
      if (host.includes("discord")||host.includes("twitter")||host.includes("x.com")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    } catch(ex){}
  }, true);

  // 4c. Block location.href hijacking
  const _loc = Object.getOwnPropertyDescriptor(window,"location")
    ||Object.getOwnPropertyDescriptor(Window.prototype,"location");
  if (_loc && _loc.set) {
    const _origSet = _loc.set;
    try {
      Object.defineProperty(window, "location", {
        get: _loc.get,
        set(val) {
          const s = typeof val === "string" ? val : "";
          try {
            const host = new URL(s, window.location.href).hostname;
            if (!HOSTS.has(host)) return;
          } catch(ex){}
          _origSet.call(this, val);
        },
        configurable: true
      });
    } catch(e){}
  }

  // 5. Block anti-adblock
  const _si = window.setInterval;
  window.setInterval = function(fn,ms,...a){
    const s = typeof fn==="function"?fn.toString():String(fn);
    if(s.includes("visibility")&&ms>=500&&ms<=2000) return 0;
    return _si.call(window,fn,ms,...a);
  };
  const _st = window.setTimeout;
  window.setTimeout = function(fn,ms,...a){
    const s = typeof fn==="function"?fn.toString():String(fn);
    if(s.includes("sadbl")||s.includes("adblock")||s.includes("AdBlock")) return 0;
    return _st.call(window,fn,ms,...a);
  };

  // 6. Block tracking fetch
  const _f = window.fetch;
  window.fetch = function(url,...a){
    const u = typeof url==="string"?url:url?.url||"";
    if(u.includes("cdn-lab.shop")) return Promise.resolve(new Response('{"data":{"report_interval":999999,"id":"x"}}',{status:200}));
    return _f.call(window,url,...a);
  };

  // 7. Intercept createElement to block dynamically loaded ad scripts
  const _ce = document.createElement.bind(document);
  document.createElement = function(tag, opts) {
    const el = _ce(tag, opts);
    if (tag.toLowerCase() === "script") {
      const _sd = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src")
        ||Object.getOwnPropertyDescriptor(el.__proto__,"src");
      if (_sd) {
        Object.defineProperty(el, "src", {
          get(){ return _sd.get.call(this); },
          set(val){
            const v = (val||"").toLowerCase();
            if (v.includes("adcash")||v.includes("tag.min.js")||v.includes("popads")
              ||v.includes("propellerads")||v.includes("clickadu")||v.includes("exoclick")
              ||v.includes("adsterra")||v.includes("hilltopads")) return;
            _sd.set.call(this, val);
          },
          configurable: true
        });
      }
    }
    return el;
  };

  console.log("[SAB] MAIN world OK:", window.location.hostname);
};

// Inject on every navigation (main frames and sub frames)
chrome.webNavigation.onCommitted.addListener((details) => {
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    func: INJECT_CODE,
    world: "MAIN",
    injectImmediately: true,
  }).catch(() => {
    // Fallback without injectImmediately for older Chrome
    chrome.scripting.executeScript({
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      func: INJECT_CODE,
      world: "MAIN",
    }).catch(() => {});
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Stream Ad Blocker installed");
});
