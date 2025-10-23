const $ = (id) => document.getElementById(id);
const setStatus = (s) => ($("status").textContent = s);

// Load current recording state on popup open
chrome.storage.local.get(["recording", "buffer"]).then(({ recording, buffer }) => {
  if (recording) {
    $("start").disabled = true;
    $("stop").disabled = false;
    $("download").disabled = true;
    setStatus("recording…");
  } else if (buffer && buffer.steps && buffer.steps.length > 0) {
    $("start").disabled = false;
    $("stop").disabled = true;
    $("download").disabled = false;
    setStatus(`stopped (${buffer.steps.length} steps)`);
  } else {
    $("start").disabled = false;
    $("stop").disabled = true;
    $("download").disabled = true;
    setStatus("idle");
  }
});

$("start").onclick = async () => {
  await chrome.runtime.sendMessage({ kind: "REC_START" });
  $("start").disabled = true;
  $("stop").disabled = false;
  $("download").disabled = true;
  setStatus("recording…");
};

$("stop").onclick = async () => {
  await chrome.runtime.sendMessage({ kind: "REC_STOP" });
  $("start").disabled = false;
  $("stop").disabled = true;
  $("download").disabled = false;
  setStatus("stopped");
};

$("download").onclick = async () => {
  await chrome.runtime.sendMessage({ kind: "REC_DOWNLOAD" });
};

$("clear").onclick = async () => {
  await chrome.runtime.sendMessage({ kind: "REC_CLEAR" });
  $("start").disabled = false;
  $("stop").disabled = true;
  $("download").disabled = true;
  setStatus("cleared");
};
