const now = () => Date.now();
const sendStep = (step) => {
  try {
    chrome.runtime.sendMessage({ kind: "STEP_ADD", step });
  } catch (error) {
    console.log("Extension context invalidated, skipping step");
  }
};

// Check if recording is active before sending steps
let isRecording = false;

// Listen for recording state changes
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.kind === "RECORDING_STATE") {
      isRecording = msg.recording;
      console.log("Recording state changed:", isRecording);
    }
  });
} catch (error) {
  console.log("Extension context invalidated, message listener not available");
}

// Get initial recording state
try {
  chrome.runtime.sendMessage({ kind: "GET_RECORDING_STATE" }, (response) => {
    if (response && response.recording) {
      isRecording = true;
      // Send initial navigation if we're already recording
      sendStep({ type: "navigate", url: location.href, timestamp: now() });
    }
  });
} catch (error) {
  console.log("Extension context invalidated during initialization");
}

(function wire() {

  // CLICK
  document.addEventListener("click", (e) => {
    if (!isRecording) return;
    const t = e.target && e.target.closest("*");
    if (!t) return;
    const selector = window.__getUniqueSelector(t);
    if (selector) sendStep({ type: "click", selector, timestamp: now() });
  }, { capture: true });

  // INPUT / CHANGE - capture complete input values
  let inputTimeout;
  const inputHandler = (e) => {
    if (!isRecording) return;
    const t = e.target;
    if (!t) return;
    
    // Handle both regular inputs and contenteditable elements
    let value = "";
    let selector = "";
    
    if ("value" in t) {
      // Regular input/textarea
      value = t.value;
      selector = window.__getUniqueSelector(t);
    } else if (t.contentEditable === "true" || t.isContentEditable) {
      // Contenteditable element (like ChatGPT's input)
      value = t.textContent || t.innerText || "";
      selector = window.__getUniqueSelector(t);
    }
    
    if (!selector || !value) return;
    
    // Debounce input events to capture final value
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
    }, 100);
  };
  document.addEventListener("input", inputHandler, true);
  document.addEventListener("change", inputHandler, true);
  
  // Also listen for text input on contenteditable elements
  document.addEventListener("textInput", inputHandler, true);
  
  // Listen for composition events (for IME input)
  document.addEventListener("compositionend", inputHandler, true);
  
  // Listen for paste events
  document.addEventListener("paste", (e) => {
    if (!isRecording) return;
    const t = e.target;
    if (!t) return;
    
    // Handle paste on contenteditable elements
    if (t.contentEditable === "true" || t.isContentEditable) {
      setTimeout(() => {
        const value = t.textContent || t.innerText || "";
        const selector = window.__getUniqueSelector(t);
        if (selector && value) {
          sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
        }
      }, 50);
    }
  }, true);

  // KEYDOWN - only capture special keys, not regular typing
  document.addEventListener("keydown", (e) => {
    if (!isRecording) return;
    // Only capture special keys, not regular typing (which is handled by input events)
    if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape" || e.key === "Backspace" || e.key === "Delete") {
      sendStep({ type: "keyPress", key: e.key, timestamp: now() });
    }
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

  // Use MutationObserver to catch text changes in contenteditable elements
  const observer = new MutationObserver((mutations) => {
    if (!isRecording) return;
    
    mutations.forEach((mutation) => {
      if (mutation.type === "childList" || mutation.type === "characterData") {
        const target = mutation.target;
        if (target.contentEditable === "true" || target.isContentEditable) {
          const value = target.textContent || target.innerText || "";
          const selector = window.__getUniqueSelector(target);
          if (selector && value && value.trim()) {
            // Debounce to avoid too many events
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
              sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
            }, 200);
          }
        }
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
