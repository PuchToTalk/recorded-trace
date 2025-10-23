let recording = false;
let buffer = { version: "1.0", meta: {}, steps: [] };

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
    chrome.storage.local.set({ buffer });
  }

  if (msg.kind === "REC_STOP") {
    recording = false;
    chrome.storage.local.set({ buffer });
  }

  if (msg.kind === "REC_CLEAR") {
    buffer = { version: "1.0", meta: {}, steps: [] };
    chrome.storage.local.set({ buffer });
  }

  if (msg.kind === "REC_DOWNLOAD") {
    chrome.storage.local.get("buffer").then(({ buffer: b }) => {
      const blob = new Blob([JSON.stringify(b || buffer, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url, filename: "action_trace.json", saveAs: true });
    });
  }
});
