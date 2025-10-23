const now = () => Date.now();
const sendStep = (step) => chrome.runtime.sendMessage({ kind: "STEP_ADD", step });

// Check if recording is active before sending steps
let isRecording = false;

// Listen for recording state changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.kind === "RECORDING_STATE") {
    isRecording = msg.recording;
    console.log("Recording state changed:", isRecording);
  }
});

// Get initial recording state
chrome.runtime.sendMessage({ kind: "GET_RECORDING_STATE" }, (response) => {
  if (response && response.recording) {
    isRecording = true;
    // Send initial navigation if we're already recording
    sendStep({ type: "navigate", url: location.href, timestamp: now() });
  }
});

(function wire() {

  // CLICK
  document.addEventListener("click", (e) => {
    if (!isRecording) return;
    const t = e.target && e.target.closest("*");
    if (!t) return;
    const selector = window.__getUniqueSelector(t);
    if (selector) sendStep({ type: "click", selector, timestamp: now() });
  }, { capture: true });

  // INPUT / CHANGE
  const inputHandler = (e) => {
    if (!isRecording) return;
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
    if (!isRecording) return;
    sendStep({ type: "keyPress", key: e.key, timestamp: now() });
  }, true);

  // SCROLL (throttled)
  let scrollTimer;
  window.addEventListener("scroll", () => {
    if (!isRecording) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      sendStep({ type: "scroll", x: window.scrollX, y: window.scrollY, timestamp: now() });
    }, 200);
  }, { passive: true });
})();
