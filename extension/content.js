const now = () => Date.now();
const sendStep = (step) => chrome.runtime.sendMessage({ kind: "STEP_ADD", step });

(function wire() {
  // Initial page context (navigation)
  sendStep({ type: "navigate", url: location.href, timestamp: now() });

  // CLICK
  document.addEventListener("click", (e) => {
    const t = e.target && e.target.closest("*");
    if (!t) return;
    const selector = window.__getUniqueSelector(t);
    if (selector) sendStep({ type: "click", selector, timestamp: now() });
  }, { capture: true });

  // INPUT / CHANGE
  const inputHandler = (e) => {
    const t = e.target;
    if (!t || !("value" in t)) return;
    const selector = window.__getUniqueSelector(t);
    if (!selector) return;
    // Capture current value; in replay we use `fill` by default
    sendStep({ type: "input", selector, value: t.value, replace: true, timestamp: now() });
  };
  document.addEventListener("input", inputHandler, true);
  document.addEventListener("change", inputHandler, true);

  // KEYDOWN (e.g., Enter to submit)
  document.addEventListener("keydown", (e) => {
    sendStep({ type: "keyPress", key: e.key, timestamp: now() });
  }, true);

  // SCROLL (throttled)
  let scrollTimer;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      sendStep({ type: "scroll", x: window.scrollX, y: window.scrollY, timestamp: now() });
    }, 200);
  }, { passive: true });
})();
