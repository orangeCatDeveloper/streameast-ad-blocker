// Popup script
document.addEventListener("DOMContentLoaded", () => {
  const toggles = ["block-popups", "block-overlays", "block-downloads"];

  // Load saved settings
  chrome.storage?.local?.get(toggles, (result) => {
    toggles.forEach((id) => {
      const el = document.getElementById(id);
      if (el && result[id] !== undefined) {
        el.checked = result[id];
      }
    });
  });

  // Save setting changes
  toggles.forEach((id) => {
    document.getElementById(id)?.addEventListener("change", (e) => {
      chrome.storage?.local?.set({ [id]: e.target.checked });
    });
  });

  // Update status display
  chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      document.getElementById("status-text").textContent = "Protected";
    }
  });
});
