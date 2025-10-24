let recording = false;
let buffer = { version: "1.0", meta: {}, steps: [] };

// Restore recording state on service worker startup
chrome.storage.local.get(["recording", "buffer"]).then(({ recording: storedRecording, buffer: storedBuffer }) => {
  if (storedRecording) {
    recording = true;
  }
  if (storedBuffer) {
    buffer = storedBuffer;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.kind === "STEP_ADD" && recording) {
    buffer.steps.push(msg.step);
    console.log("Step added:", msg.step.type, msg.step.selector || msg.step.url || msg.step.key, "Total steps:", buffer.steps.length);
  }

  if (msg.kind === "GET_RECORDING_STATE") {
    sendResponse({ recording });
  }

  if (msg.kind === "REC_START") {
    recording = true;
    buffer = {
      version: "1.0",
      meta: { recordedAt: new Date().toISOString(), userAgent: navigator.userAgent },
      steps: []
    };
    chrome.storage.local.set({ recording: true, buffer });
    
    // Broadcast recording state to all content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { kind: "RECORDING_STATE", recording: true }).catch(() => {});
      });
    });
  }

  if (msg.kind === "REC_STOP") {
    recording = false;
    chrome.storage.local.set({ recording: false, buffer });
    
    // Broadcast recording state to all content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { kind: "RECORDING_STATE", recording: false }).catch(() => {});
      });
    });
  }

  if (msg.kind === "REC_CLEAR") {
    recording = false;
    buffer = { version: "1.0", meta: {}, steps: [] };
    chrome.storage.local.set({ recording: false, buffer });
  }

  if (msg.kind === "REC_DOWNLOAD") {
    chrome.storage.local.get("buffer").then(({ buffer: b }) => {
      const data = JSON.stringify(b || buffer, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      
      // Use FileReader to create data URL (URL.createObjectURL not available in service worker)
      const reader = new FileReader();
      reader.onload = () => {
        chrome.downloads.download({
          url: reader.result,
          filename: "action_trace.json",
          saveAs: true
        });
      };
      reader.readAsDataURL(blob);
    });
  }
});
