// Stream Ad Blocker v5 - Content Script (ISOLATED world)
// Handles DOM cleanup + ensures MAIN world injection via script tag

(function () {
  "use strict";

  // ========== 1. Inject MAIN world via script tag (backup for background.js) ==========
  // Use the web_accessible_resources file - NOT inline (avoids CSP issues)
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.onload = () => s.remove();
    (document.documentElement || document.head || document.body).prepend(s);
  } catch (e) {}

  // ========== 2. Remove ad scripts via MutationObserver ==========
  const AD_SCRIPT_PATTERNS = [
    "dutchrelay.com",
    "sharethis.com",
    "popads.net",
    "propellerads",
    "clickadu",
    "adsterra",
    "exoclick",
    "hilltopads",
    "juicyads",
    "adcash",
    "acscdn.com",
    "acsbap.com",
    "acsbapp.com",
  ];

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Remove external ad scripts
        if (node.tagName === "SCRIPT" && node.src) {
          const src = node.src.toLowerCase();
          if (AD_SCRIPT_PATTERNS.some((p) => src.includes(p))) {
            node.remove();
            return;
          }
          // Block the fake "jquery.min.js" on embedsports.top that's actually the ad SDK
          // Real jQuery doesn't set window['ZpQw9XkLmN8c3vR3']
          if (src.includes("jquery.min.js") && src.includes("embedsports")) {
            node.remove();
            console.log("[SAB] Blocked fake jQuery (ad SDK)");
            return;
          }
        }

        // Remove hidden ad iframes
        if (node.tagName === "IFRAME") {
          const id = node.id || "";
          const src = (node.src || "").toLowerCase();

          // Whitelist video player
          if (id === "main-player") continue;
          if (src.includes("embedsports")) continue;
          if (src.includes("pooembed")) continue;

          const style = node.getAttribute("style") || "";
          if (
            (node.width == 1 && node.height == 1) ||
            style.includes("visibility:hidden") ||
            style.includes("visibility: hidden") ||
            src.includes("/ad.html")
          ) {
            node.remove();
          }
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ========== 3. Periodic overlay cleanup ==========
  function cleanup() {
    document.querySelectorAll("div, a, span").forEach((el) => {
      try {
        const cs = window.getComputedStyle(el);
        const z = parseInt(cs.zIndex);
        const r = el.getBoundingClientRect();
        if (
          z > 999999 &&
          r.width > 100 &&
          r.height > 100 &&
          (cs.position === "fixed" || cs.position === "absolute") &&
          !el.closest(".video-player") &&
          !el.closest(".player-container") &&
          el.id !== "main-player"
        ) {
          el.remove();
        }
      } catch (e) {}
    });
  }

  setInterval(cleanup, 2000);
  document.addEventListener("DOMContentLoaded", cleanup);
  window.addEventListener("load", () => {
    setTimeout(cleanup, 500);
    setTimeout(cleanup, 2000);
  });

  console.log("[SAB] Content script loaded");
})();
