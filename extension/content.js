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

  // DOUBLE CLICK
  document.addEventListener("dblclick", (e) => {
    if (!isRecording) return;
    const t = e.target && e.target.closest("*");
    if (!t) return;
    const selector = window.__getUniqueSelector(t);
    if (selector) {
      console.log("Double click detected on:", selector);
      sendStep({ type: "doubleClick", selector, timestamp: now() });
    }
  }, { capture: true });

  // RIGHT CLICK (CONTEXT MENU)
  document.addEventListener("contextmenu", (e) => {
    if (!isRecording) return;
    const t = e.target && e.target.closest("*");
    if (!t) return;
    const selector = window.__getUniqueSelector(t);
    if (selector) {
      console.log("Right click detected on:", selector);
      sendStep({ type: "rightClick", selector, timestamp: now() });
    }
  }, { capture: true });

  // HOVER ACTIONS
  let hoverTimeout;
  document.addEventListener("mouseover", (e) => {
    if (!isRecording) return;
    const t = e.target && e.target.closest("*");
    if (!t) return;
    
    // Debounce hover events to avoid too many recordings
    clearTimeout(hoverTimeout);
    hoverTimeout = setTimeout(() => {
      const selector = window.__getUniqueSelector(t);
      if (selector) {
        console.log("Hover detected on:", selector);
        sendStep({ type: "hover", selector, timestamp: now() });
      }
    }, 300);
  }, { capture: true });

  // INPUT / CHANGE - capture complete input values with improved debouncing
  let inputTimeout;
  let lastEnterTime = 0;
  let lastRecordedValue = "";
  let lastRecordedSelector = "";
  
  const inputHandler = (e) => {
    if (!isRecording) return;
    const t = e.target;
    if (!t) return;
    
    // Don't record input if Enter was just pressed (within 1 second)
    if (Date.now() - lastEnterTime < 1000) return;
    
    // Handle both regular inputs and contenteditable elements
    let value = "";
    let selector = "";
    
    if ("value" in t) {
      // Regular input/textarea
      value = t.value;
      selector = window.__getUniqueSelector(t);
    } else if (t.contentEditable === "true" || t.isContentEditable || 
               (t.getAttribute && t.getAttribute('contenteditable') === 'true')) {
      // Contenteditable element (like ChatGPT's input)
      value = t.textContent || t.innerText || "";
      selector = window.__getUniqueSelector(t);
    }
    
    if (!selector || !value || value.trim().length === 0) return;
    
    console.log("Input detected:", value, "Selector:", selector);
    
    // Don't record if it's the same as last recorded value
    if (selector === lastRecordedSelector && value === lastRecordedValue) return;
    
    // Don't record if new value is shorter than last recorded (user is deleting)
    if (selector === lastRecordedSelector && value.length < lastRecordedValue.length) return;
    
    // Debounce input events to capture final value (increased to 1000ms for cleaner recording)
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      lastRecordedValue = value;
      lastRecordedSelector = selector;
      console.log("Recording input:", value);
      sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
    }, 1000);
  };
  document.addEventListener("input", inputHandler, true);
  document.addEventListener("change", inputHandler, true);
  
  // Also listen for text input on contenteditable elements
  document.addEventListener("textInput", inputHandler, true);
  
  // Listen for composition events (for IME input)
  document.addEventListener("compositionend", inputHandler, true);
  
  // Listen for focus events to capture input when user focuses on input field
  document.addEventListener("focus", (e) => {
    if (!isRecording) return;
    const t = e.target;
    if (!t) return;
    
    // Check if it's an input field or contenteditable
    if (("value" in t) || t.contentEditable === "true" || t.isContentEditable) {
      console.log("Focus detected on input field:", t);
    }
  }, true);
  
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

  // FILE UPLOAD DETECTION
  document.addEventListener("change", (e) => {
    if (!isRecording) return;
    const t = e.target;
    if (!t) return;
    
    // Check if it's a file input with files selected
    if (t.type === "file" && t.files && t.files.length > 0) {
      const selector = window.__getUniqueSelector(t);
      const files = Array.from(t.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified
      }));
      
      console.log("File upload detected:", files.length, "files");
      sendStep({
        type: "fileUpload",
        selector,
        files,
        fileCount: files.length,
        timestamp: now()
      });
    }
  }, true);

  // KEYDOWN - capture special keys and keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (!isRecording) return;
    
    // Track Enter key to stop input recording and capture final input
    if (e.key === "Enter") {
      lastEnterTime = Date.now();
      
      // Capture final input immediately before Enter
      const t = e.target;
      if (t && (("value" in t) || t.contentEditable === "true" || t.isContentEditable)) {
        let value = "";
        let selector = "";
        
        if ("value" in t) {
          value = t.value;
          selector = window.__getUniqueSelector(t);
        } else if (t.contentEditable === "true" || t.isContentEditable || 
                   (t.getAttribute && t.getAttribute('contenteditable') === 'true')) {
          value = t.textContent || t.innerText || "";
          selector = window.__getUniqueSelector(t);
        }
        
        if (selector && value && value.trim() && value.length > 0) {
          // Only record if it's different from last recorded
          if (selector !== lastRecordedSelector || value !== lastRecordedValue) {
            lastRecordedValue = value;
            lastRecordedSelector = selector;
            console.log("Enter key - recording final input:", value);
            sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
          }
        }
      }
      
      // Clear any pending input recording
      clearTimeout(inputTimeout);
    }
    
    // Capture keyboard shortcuts (Ctrl, Cmd, Alt combinations)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      const modifiers = [];
      if (e.ctrlKey) modifiers.push("Control");
      if (e.metaKey) modifiers.push("Meta");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");
      
      console.log("Keyboard shortcut detected:", modifiers.join("+"), e.key);
      sendStep({
        type: "keyboardShortcut",
        key: e.key,
        modifiers,
        timestamp: now()
      });
    }
    
    // Only capture special keys, not regular typing (which is handled by input events)
    if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape" || e.key === "Backspace" || e.key === "Delete") {
      sendStep({ type: "keyPress", key: e.key, timestamp: now() });
    }
  }, true);

  // KEYUP - capture input after typing is complete (disabled to prevent duplicates)
  // document.addEventListener("keyup", (e) => {
  //   // Keyup handler removed to prevent duplicate input recordings
  // }, true);

  // ADVANCED SCROLL (throttled with direction detection)
  let scrollTimer;
  let lastScrollY = 0;
  let lastScrollX = 0;
  
  window.addEventListener("scroll", () => {
    if (!isRecording) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const currentX = window.scrollX;
      const currentY = window.scrollY;
      
      // Determine scroll direction
      let direction = "none";
      if (currentY > lastScrollY) direction = "down";
      else if (currentY < lastScrollY) direction = "up";
      if (currentX > lastScrollX) direction += "-right";
      else if (currentX < lastScrollX) direction += "-left";
      
      console.log("Scroll detected:", direction, "to", currentX, currentY);
      sendStep({
        type: "scroll",
        x: currentX,
        y: currentY,
        direction: direction,
        timestamp: now()
      });
      
      lastScrollX = currentX;
      lastScrollY = currentY;
    }, 200);
  }, { passive: true });

  // DRAG AND DROP ACTIONS
  let dragStartElement = null;
  let dragStartTime = 0;
  let dragStartPosition = { x: 0, y: 0 };

  document.addEventListener("dragstart", (e) => {
    if (!isRecording) return;
    dragStartElement = e.target;
    dragStartTime = now();
    dragStartPosition = { x: e.clientX, y: e.clientY };
    console.log("Drag started on:", e.target);
  }, true);

  document.addEventListener("dragover", (e) => {
    if (!isRecording) return;
    e.preventDefault(); // Allow drop
  }, true);

  document.addEventListener("drop", (e) => {
    if (!isRecording || !dragStartElement) return;
    
    const dragEndElement = e.target;
    const dragDuration = now() - dragStartTime;
    const dragEndPosition = { x: e.clientX, y: e.clientY };
    
    const sourceSelector = window.__getUniqueSelector(dragStartElement);
    const targetSelector = window.__getUniqueSelector(dragEndElement);
    
    if (sourceSelector && targetSelector) {
      console.log("Drag and drop detected:", sourceSelector, "->", targetSelector);
      sendStep({
        type: "dragAndDrop",
        source: sourceSelector,
        target: targetSelector,
        duration: dragDuration,
        startPosition: dragStartPosition,
        endPosition: dragEndPosition,
        timestamp: now()
      });
    }
    
    dragStartElement = null;
  }, true);

  document.addEventListener("dragend", (e) => {
    if (!isRecording) return;
    dragStartElement = null;
  }, true);

  // Use MutationObserver to catch text changes in contenteditable elements
  let observer;
  const startObserver = () => {
    if (observer) return; // Already started
    
    observer = new MutationObserver((mutations) => {
      if (!isRecording) return;
      
      // Don't record if Enter was just pressed
      if (Date.now() - lastEnterTime < 1000) return;
      
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "characterData") {
          let target = mutation.target;
          
          // If target is a text node, get its parent element
          if (target && target.nodeType === 3) {
            target = target.parentElement;
          }
          
          // Check if target is a DOM element
          if (!target || target.nodeType !== 1) return;
          
          // Check if it's a contenteditable element
          if (target.contentEditable === "true" || target.isContentEditable || 
              (target.getAttribute && target.getAttribute('contenteditable') === 'true')) {
            const value = target.textContent || target.innerText || "";
            const selector = window.__getUniqueSelector(target);
            
            if (selector && value && value.trim() && value.length > 0) {
              console.log("MutationObserver detected input:", value, "Selector:", selector);
              
              // Don't record if it's the same as last recorded value
              if (selector === lastRecordedSelector && value === lastRecordedValue) return;
              
              // Don't record if new value is shorter than last recorded
              if (selector === lastRecordedSelector && value.length < lastRecordedValue.length) return;
              
              // Debounce to avoid too many events (increased to 1000ms for cleaner recording)
              clearTimeout(inputTimeout);
              inputTimeout = setTimeout(() => {
                lastRecordedValue = value;
                lastRecordedSelector = selector;
                console.log("MutationObserver recording input:", value);
                sendStep({ type: "input", selector, value: value, replace: true, timestamp: now() });
              }, 1000);
            }
          }
        }
      });
    });

    // Start observing when document.body is available
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    } else {
      // Wait for DOM to be ready
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
        }
      });
    }
  };

  // Start observer
  startObserver();
})();
