# Stream Ad Blocker

A Chrome extension that blocks overlay ads, click hijacking, popunders, and malicious downloads on streaming sites like istreameast.

## The Problem

Free streaming sites layer multiple ad mechanisms on top of the video player:

- **Popunders** — `window.open()` triggered by click events opens ad tabs in the background
- **Click hijacking** — Obfuscated event listeners on `document/body` intercept your clicks before they reach the video player
- **Overlay ads** — Invisible `<div>` elements with max `z-index` cover the player; clicking anywhere triggers an ad redirect
- **Fake scripts** — Ad SDKs disguised as legitimate libraries (e.g. `jquery.min.js` that's actually a 610KB ad loader)
- **Anti-adblock detection** — Visibility polling and timeout checks to detect ad blockers
- **Hidden iframes** — 1×1 invisible iframes for tracking and ad refresh

You end up clicking 5-10 times before the video actually plays.

## How It Works

The extension uses a three-layer approach:

### 1. Network-Level Blocking (`rules.json`)
Uses Chrome's `declarativeNetRequest` API to block requests to 38 known ad domains, ad scripts (by filename), and ad landing pages before they even load.

### 2. MAIN World Script Injection (`inject.js`)
Injected into the page's JavaScript context via `chrome.scripting.executeScript` to override browser APIs:

- **`window.open`** → Returns a fake window object (blocks popunders)
- **`aclib`** → Wrapped in a `Proxy` so `runPop`, `runAutoTag`, etc. always return no-ops, regardless of what the ad SDK assigns
- **`addEventListener`** → Filters out global click handlers containing obfuscated code (`_0x` patterns) or redirect logic
- **`setInterval/setTimeout`** → Blocks anti-adblock visibility polling and detection timers
- **`fetch`** → Blocks tracking requests to analytics endpoints

### 3. DOM Cleanup (`content.js`)
Runs in the isolated world to manipulate the DOM:

- **MutationObserver** removes ad scripts and hidden iframes as they're added
- **Periodic cleanup** removes overlay elements with absurdly high `z-index`
- **Whitelist** ensures the actual video player iframe chain is never touched

## Installation

1. Clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `stream-ad-blocker` folder
5. Navigate to a streaming site — ads should be blocked automatically

## Project Structure

```
stream-ad-blocker/
├── manifest.json     # Extension config, permissions, content script registration
├── background.js     # Service worker — injects MAIN world script on every navigation
├── inject.js         # MAIN world script — overrides window.open, aclib, addEventListener
├── content.js        # Isolated world script — DOM cleanup, removes ad elements
├── rules.json        # declarativeNetRequest rules — blocks 38 ad domains/scripts
├── popup.html        # Extension popup UI
├── popup.js          # Popup logic
└── icons/            # Extension icons
```

## Technical Details

### Why not just use `"world": "MAIN"` in the manifest?

Chrome's manifest-based `"world": "MAIN"` content script injection doesn't work reliably across all Chromium-based browsers. This extension uses `chrome.scripting.executeScript` from the background service worker (triggered by `webNavigation.onCommitted`) as the primary injection method, with a `web_accessible_resources` script tag injection as a fallback.

### Why use a Proxy for aclib?

The ad SDK's obfuscated code creates the `aclib` object and assigns methods like `runPop`. Simply replacing `runPop` with a no-op doesn't work because the SDK can reassign it after our override. A `Proxy` intercepts property reads at the getter level — no matter what the SDK assigns internally, any read of `runPop` always returns a no-op function.

### The fake jQuery trick

Some streaming embed pages load their ad SDK as `/js/jquery.min.js`. It's not jQuery at all — it's a 610KB obfuscated ad loader (identical to the main page's ad script). The extension blocks this at both the network level (`declarativeNetRequest`) and DOM level (`MutationObserver`).

## Browser Support

- Chrome 111+
- Edge 111+
- Other Chromium-based browsers (Brave, Arc, etc.)

## License

MIT
