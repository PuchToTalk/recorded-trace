const $ = (id) => document.getElementById(id);
const setStatus = (s) => ($("status").textContent = s);

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
  setStatus("cleared");
};
