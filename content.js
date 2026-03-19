// Stream Ad Blocker - Content Script (ISOLATED world)
// Handles DOM cleanup + ensures MAIN world injection via script tag

(function () {
  "use strict";

  // ========== 1. Inject MAIN world via script tag (backup for background.js) ==========
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("inject.js");
    s.onload = () => s.remove();
    (document.documentElement || document.head || document.body).prepend(s);
  } catch (e) {}

  // ========== 2. Remove ad scripts and ad elements via MutationObserver ==========
  const AD_SCRIPT_PATTERNS = [
    "dutchrelay.com", "sharethis.com", "popads.net", "propellerads",
    "clickadu", "adsterra", "exoclick", "hilltopads", "juicyads",
    "adcash", "acscdn.com", "acsbap.com", "acsbapp.com", "kiosked.com",
    "adcashexpo", "tag.min.js",
  ];

  // Whitelist: domains/ids that are part of the video player
  function isPlayerElement(node) {
    const id = node.id || "";
    const src = (node.src || node.href || "").toLowerCase();
    if (id === "main-player") return true;
    if (src.includes("embedsports")) return true;
    if (src.includes("pooembed")) return true;
    if (src.includes("clappr")) return true;
    if (src.includes("hls")) return true;
    return false;
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;

        // Remove external ad scripts (by domain or filename)
        if (node.tagName === "SCRIPT" && node.src) {
          const src = node.src.toLowerCase();
          if (AD_SCRIPT_PATTERNS.some((p) => src.includes(p))) {
            node.remove();
            continue;
          }
          // Block fake "jquery.min.js" on embedsports.top (actually the ad SDK)
          if (src.includes("jquery.min.js") && src.includes("embedsports")) {
            node.remove();
            console.log("[SAB] Blocked fake jQuery (ad SDK)");
            continue;
          }
        }

        // Remove dynamically loaded ad scripts (inline scripts created by the SDK)
        if (node.tagName === "SCRIPT" && !node.src) {
          const text = node.textContent || "";
          if (
            text.includes("runPop") ||
            text.includes("popunder") ||
            text.includes("adcash") ||
            text.includes("Adcash")
          ) {
            node.remove();
            continue;
          }
        }

        // Remove ad iframes
        if (node.tagName === "IFRAME" && !isPlayerElement(node)) {
          const src = (node.src || "").toLowerCase();
          const style = node.getAttribute("style") || "";
          if (
            (node.width == 1 && node.height == 1) ||
            style.includes("visibility:hidden") ||
            style.includes("visibility: hidden") ||
            src.includes("/ad.html") ||
            src.includes("ad.html") ||
            src.includes("doubleclick") ||
            src.includes("googlesyndication") ||
            src.includes("amazon-adsystem")
          ) {
            node.remove();
            continue;
          }
        }

        // Remove overlay divs created by the ad SDK
        // These are typically: large, positioned fixed/absolute, high z-index,
        // or have ad-related attributes
        if (
          node.tagName === "DIV" ||
          node.tagName === "A" ||
          node.tagName === "ASIDE" ||
          node.tagName === "SECTION"
        ) {
          if (isAdOverlay(node)) {
            node.remove();
            continue;
          }
        }
      }
    }
  });

  function isAdOverlay(el) {
    // Check inline style for overlay patterns
    const style = el.getAttribute("style") || "";
    const id = (el.id || "").toLowerCase();
    const cls = (el.className || "").toLowerCase();

    // Known ad overlay indicators
    if (
      id.includes("overlay") || id.includes("interstitial") ||
      id.includes("modal") || id.includes("popup") ||
      cls.includes("overlay") || cls.includes("interstitial") ||
      cls.includes("modal") || cls.includes("popup")
    ) {
      // Don't remove elements that are part of the site's own UI
      if (id.includes("mobileNav") || id.includes("hamburger")) return false;
      return true;
    }

    // Large fixed/absolute elements with high z-index (inline style check)
    if (
      (style.includes("position:fixed") || style.includes("position: fixed") ||
       style.includes("position:absolute") || style.includes("position: absolute")) &&
      (style.includes("z-index") && /z-index:\s*(\d+)/.test(style))
    ) {
      const z = parseInt(style.match(/z-index:\s*(\d+)/)[1]);
      if (z > 9999) return true;
    }

    // Elements with data-ad attributes
    if (el.getAttribute("data-ad") || el.getAttribute("data-pop") || el.getAttribute("data-click")) {
      return true;
    }

    // Full-viewport transparent/semi-transparent overlays
    if (style.includes("width:100%") && style.includes("height:100%") && style.includes("position:fixed")) {
      return true;
    }
    if (style.includes("width: 100%") && style.includes("height: 100%") && style.includes("position: fixed")) {
      return true;
    }

    return false;
  }

  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ========== 3. Aggressive periodic cleanup ==========
  function cleanup() {
    // Remove elements with absurdly high z-index that overlay the page
    document.querySelectorAll("*").forEach((el) => {
      try {
        if (isPlayerElement(el)) return;
        if (el.closest(".video-player") || el.closest(".player-container")) return;
        if (el.tagName === "VIDEO" || el.tagName === "HTML" || el.tagName === "BODY") return;

        const cs = window.getComputedStyle(el);
        const z = parseInt(cs.zIndex);
        const r = el.getBoundingClientRect();

        // Large positioned overlay with high z-index
        if (
          z > 9999 &&
          r.width > 100 &&
          r.height > 100 &&
          (cs.position === "fixed" || cs.position === "absolute")
        ) {
          // Check if it's an ad (not site content)
          const tag = el.tagName;
          const id = el.id || "";
          // Don't remove navigation, header, player elements
          if (id === "main-player" || id === "hamburger" || id === "mobileNav") return;
          if (tag === "NAV" || tag === "HEADER" || tag === "FOOTER") return;
          el.remove();
        }

        // Also catch transparent full-screen overlays
        if (
          (cs.position === "fixed" || cs.position === "absolute") &&
          r.width > window.innerWidth * 0.8 &&
          r.height > window.innerHeight * 0.8 &&
          (parseFloat(cs.opacity) < 0.1 || cs.backgroundColor === "transparent" ||
           cs.backgroundColor === "rgba(0, 0, 0, 0)")
        ) {
          if (el.tagName !== "NAV" && el.tagName !== "HEADER") {
            el.remove();
          }
        }
      } catch (e) {}
    });

    // Remove any iframes that slipped through
    document.querySelectorAll("iframe").forEach((iframe) => {
      if (isPlayerElement(iframe)) return;
      const src = (iframe.src || "").toLowerCase();
      const style = iframe.getAttribute("style") || "";
      if (
        (iframe.width == 1 && iframe.height == 1) ||
        style.includes("visibility:hidden") ||
        style.includes("visibility: hidden") ||
        src.includes("/ad.html") ||
        src.includes("doubleclick") ||
        src.includes("googlesyndication")
      ) {
        iframe.remove();
      }
    });
  }

  // Run cleanup frequently
  setInterval(cleanup, 1500);
  document.addEventListener("DOMContentLoaded", cleanup);
  window.addEventListener("load", () => {
    setTimeout(cleanup, 300);
    setTimeout(cleanup, 1000);
    setTimeout(cleanup, 3000);
  });

  console.log("[SAB] Content script loaded");
})();
