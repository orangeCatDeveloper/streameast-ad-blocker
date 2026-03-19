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

  // 4. Defuse global click hijackers
  const _ael = EventTarget.prototype.addEventListener;
  const BAD = new Set(["click","mousedown","mouseup","pointerdown","pointerup","touchstart","touchend"]);
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    if (BAD.has(type) && (this===window||this===document||this===document.documentElement||this===document.body)) {
      const s = fn?.toString?.() || "";
      if (s.includes("_0x")||s.includes("window.open")||s.includes("window['open']")||s.includes('window["open"]')
        ||s.includes("location.href")||s.includes("location.assign")||s.includes("location.replace")
        ||s.includes("location['href']")||s.includes('location["href"]')||s.includes("popunder")||s.includes("runPop")) {
        return;
      }
    }
    return _ael.call(this, type, fn, opts);
  };

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
  console.log("Stream Ad Blocker v5 installed");
});
