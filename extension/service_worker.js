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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.kind === "STEP_ADD" && recording) {
    buffer.steps.push(msg.step);
  }

  if (msg.kind === "REC_START") {
    recording = true;
    buffer = {
      version: "1.0",
      meta: { recordedAt: new Date().toISOString(), userAgent: navigator.userAgent },
      steps: []
    };
    chrome.storage.local.set({ recording: true, buffer });
  }

  if (msg.kind === "REC_STOP") {
    recording = false;
    chrome.storage.local.set({ recording: false, buffer });
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
