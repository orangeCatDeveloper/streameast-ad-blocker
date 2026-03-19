# Stream Ad Blocker

**One click to play. No more ads.**

Watch NBA, NFL, NHL, MLB, and other live sports on free streaming sites — without popups, overlays, or click hijacking. Just click play and it works.

![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![License](https://img.shields.io/badge/license-MIT-green)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange)

## Before vs After

| Without Extension | With Extension |
|---|---|
| Click play → ad tab opens | Click play → Lakers vs Rockets starts |
| Click again → sportsbetting.ag popup | No popups, no redirects |
| Click 5-10 times → game finally loads | First click works |
| Random .exe downloads | Downloads blocked |

## Supported Sites

- istreameast
- streameast
- Other sites using the same ad SDK (`aclib` / Adcash popunder system)

> Works on any site that uses `aclib.runPop` for popunders — which covers most free streaming sites.

## What It Blocks

- **Popunder ads** — new tabs opening behind your current window
- **Click hijacking** — your first N clicks being stolen by ad scripts
- **Overlay ads** — invisible layers covering the video player
- **Fake scripts** — ad SDKs disguised as `jquery.min.js`
- **Malicious downloads** — `.exe`, `.dmg`, `.apk` files triggered by clicks
- **Tracking** — analytics and fingerprinting scripts
- **Ad redirects** — navigation to betting/gambling sites like sportsbetting.ag

## Install

1. Clone this repo:
   ```bash
   git clone https://github.com/orangeCatDeveloper/streameast-ad-blocker.git
   ```
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the cloned folder
5. Done. Go to a streaming site and click play.

## How It Works

Three layers of protection:

**Layer 1 — Network Blocking** (`rules.json`)
Blocks 38 known ad domains and scripts before they load, using Chrome's `declarativeNetRequest` API.

**Layer 2 — JavaScript API Override** (`inject.js` → MAIN world)
Overrides browser APIs that ads abuse:
- `window.open` → blocked (kills popunders)
- `aclib.runPop` → neutered via `Proxy` (the ad SDK runs but does nothing)
- `addEventListener` → filters out obfuscated click hijack handlers
- `document.createElement("script")` → blocks dynamically loaded ad scripts

**Layer 3 — DOM Cleanup** (`content.js` → isolated world)
Removes ad elements from the page:
- Strips overlay `<div>`s with high `z-index`
- Removes hidden 1×1 tracking iframes
- Blocks the fake `jquery.min.js` (actually a 610KB ad loader)

## Technical Deep Dive

<details>
<summary>Why use a Proxy for aclib?</summary>

The ad SDK creates `window.aclib` and assigns methods like `runPop`. Simply replacing `runPop` with a no-op doesn't work — the SDK can reassign it after your override.

A `Proxy` wraps the entire object and intercepts reads. No matter what the SDK assigns internally, any access to `aclib.runPop` always returns a no-op:

```js
Object.defineProperty(window, "aclib", {
  set(v) {
    _aclib = new Proxy(v, {
      get(target, prop) {
        return AD_METHODS.has(prop) ? noop : target[prop];
      }
    });
  }
});
```
</details>

<details>
<summary>Why not use manifest "world": "MAIN"?</summary>

Chrome's manifest-based `"world": "MAIN"` doesn't work reliably across all Chromium browsers (Arc, Brave, older Edge). We use `chrome.scripting.executeScript` from the background service worker instead, with a `web_accessible_resources` fallback. Both run before page scripts.
</details>

<details>
<summary>The fake jQuery trick</summary>

Some embed pages (like embedsports.top) load `/js/jquery.min.js` — but it's not jQuery. It's a 610KB obfuscated ad SDK (starts with `window['ZpQw9XkLmN8c3vR3']`). The extension blocks this at both the network level and DOM level.
</details>

## Project Structure

```
├── manifest.json     # Extension config (Manifest V3)
├── background.js     # Service worker — MAIN world injection via executeScript
├── inject.js         # Overrides window.open, aclib, addEventListener, createElement
├── content.js        # DOM cleanup — MutationObserver + periodic overlay removal
├── rules.json        # declarativeNetRequest — 38 blocked domains/scripts
├── popup.html/js     # Extension popup UI
└── icons/            # Extension icons
```

## Contributing

Found a site where ads still get through? [Open an issue](../../issues) with:
1. The site URL
2. What ads you see (popup? overlay? redirect?)
3. Console errors (F12 → Console → look for `[SAB]` logs)

## License

MIT
