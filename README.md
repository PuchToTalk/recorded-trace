# Altera Chrome DevTools-like Recorder

This repository implements a minimal Chrome DevTools Recorder clone:

1) **Chrome Extension** to record user actions and download a JSON trace.  
2) **Python (Playwright) script** to replay the trace.  
3) **Sample trace** of a multi-turn interaction on `https://chatgpt.com` (includes one **Search** query).

---
## Repository Structure

```
.
├─ README.md
├─ replay.py
├─ requirements.txt
├─ action_trace.json
└─ extension/
   ├─ manifest.json
   ├─ popup.html
   ├─ popup.css
   ├─ popup.js
   ├─ selector.js
   ├─ content.js
   └─ service_worker.js
```

---

## 1) Recording a Trace (Chrome Extension)

1. Open `chrome://extensions` → **Load unpacked** → select `extension/`.  
2. Navigate to `https://chatgpt.com`.  
3. Extension popup → **Start** → perform a multi-round interaction (use **Search** at least once).  
4. **Stop** → **Download JSON** → save as `action_trace.json` at repo root.

**Captured events:** `navigate`, `click`, `input`, `keyPress`, `scroll` (+ optional waits).  
**Selector priority:** `id` → `name` → `aria-*` → `role` → `data-*` → short class → constrained `:nth-of-type`.


---

## 2) Replaying a Trace (Python + Playwright)

Install dependencies:
```bash
pip install -r requirements.txt
python -m playwright install
```

Replay:
```bash
python replay.py action_trace.json
```

---

## 3) Example Trace

See `action_trace.json` for a minimal multi-turn ChatGPT flow (including one Search query).
Note: ChatGPT's DOM may change; selectors are written to be robust, but you may need to re-record.
```bash
{
  "version": "1.0",
  "steps": [
    { "type": "navigate", "url": "https://chatgpt.com" },
    { "type": "click", "selector": "textarea[aria-label='Message']" },
    { "type": "input", "selector": "textarea[aria-label='Message']", "value": "Hello!" },
    { "type": "keyPress", "key": "Enter" }
  ]
}
```

---

## Implementation Tradeoffs

This implementation uses HTML selectors (similar to Chrome DevTools Recorder) rather than multimodal models or OCR approaches. HTML selectors provide precise element targeting with CSS selectors, offering lightweight performance without AI model inference requirements, and work reliably across different websites with simple, debuggable logic. The tradeoff is that selectors may break when websites update their HTML structure, and the approach is limited to web browsers only. Multimodal/OCR approaches would be more robust to UI changes and work with visual elements, but require AI models with higher computational cost and potential accuracy issues. The HTML selector approach provides the best balance of simplicity, performance, and reliability for web automation, making it ideal for a Chrome DevTools-like recorder that needs to work across diverse websites with minimal overhead.

**Next Steps:** The implementation could be enhanced with fallback mechanisms for when selectors break, integration with visual regression testing for UI change detection, and support for more complex interaction patterns like drag-and-drop sequences and multi-step workflows.

