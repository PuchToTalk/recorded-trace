import json, time, sys
from typing import Any, Dict, List
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

ACTION_TRACE_PATH = sys.argv[1] if len(sys.argv) > 1 else "action_trace.json"

def load_trace(path: str) -> Dict[str, Any]:
    data = json.load(open(path, "r", encoding="utf-8"))
    # Support both array-only and {steps:[...]} formats
    if isinstance(data, list):
        return {"version": "1.0", "meta": {}, "steps": data}
    if "steps" in data and isinstance(data["steps"], list):
        return data
    raise ValueError("Invalid trace format: expected array or object with 'steps'.")

def main():
    trace = load_trace(ACTION_TRACE_PATH)
    steps: List[Dict[str, Any]] = trace.get("steps", [])
    if not steps:
        print("No steps found in action trace.")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        def wait_for(sel: str, timeout=15000):
            page.wait_for_selector(sel, timeout=timeout, state="visible")

        for i, s in enumerate(steps):
            t = s.get("type")
            try:
                if t == "navigate":
                    url = s["url"]
                    print(f"[{i}] navigate -> {url}")
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)

                elif t == "wait":
                    ms = s.get("ms", 500)
                    print(f"[{i}] wait {ms}ms")
                    time.sleep(ms / 1000)

                elif t == "waitForSelector":
                    sel = s["selector"]
                    to = s.get("timeout", 20000)
                    print(f"[{i}] waitForSelector {sel} ({to}ms)")
                    wait_for(sel, timeout=to)

                elif t == "click":
                    sel = s["selector"]
                    print(f"[{i}] click {sel}")
                    wait_for(sel, timeout=20000)
                    page.click(sel)

                elif t == "input":
                    sel = s["selector"]
                    val = s.get("value", "")
                    replace = s.get("replace", True)
                    print(f"[{i}] input {sel} -> '{val[:40]}...' (replace={replace})")
                    wait_for(sel)
                    
                    # Check if element is contenteditable
                    is_contenteditable = page.evaluate(f"""
                        () => {{
                            const el = document.querySelector('{sel}');
                            return el && (el.contentEditable === 'true' || el.isContentEditable);
                        }}
                    """)
                    
                    if is_contenteditable:
                        # For contenteditable elements, use innerHTML or textContent
                        page.evaluate(f"""
                            (value) => {{
                                const el = document.querySelector('{sel}');
                                if (el) {{
                                    el.textContent = value;
                                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                }}
                            }}
                        """, val)
                    else:
                        # Regular input/textarea
                        if replace:
                            page.fill(sel, val)
                        else:
                            page.type(sel, val, delay=20)

                elif t == "keyPress":
                    key = s["key"]
                    print(f"[{i}] keyPress {key}")
                    page.keyboard.press(key)

                elif t == "scroll":
                    x, y = s.get("x", 0), s.get("y", 0)
                    print(f"[{i}] scroll to {x},{y}")
                    page.evaluate("(x,y)=>window.scrollTo(x,y)", x, y)

                elif t == "hover":
                    sel = s["selector"]
                    print(f"[{i}] hover {sel}")
                    wait_for(sel)
                    page.hover(sel)

                elif t == "dragAndDrop":
                    src, dst = s["source"], s["target"]
                    print(f"[{i}] dragAndDrop {src} -> {dst}")
                    wait_for(src); wait_for(dst)
                    page.drag_and_drop(src, dst)

                else:
                    print(f"[{i}] warn: unsupported type '{t}', skipping")

            except PWTimeout:
                page.screenshot(path=f"replay_timeout_step_{i}.png")
                print(f"[error] Timeout at step {i} ({t}). Screenshot saved to replay_timeout_step_{i}.png", file=sys.stderr)
                raise
            except Exception as e:
                page.screenshot(path=f"replay_error_step_{i}.png")
                print(f"[error] Step {i} ({t}) failed: {e}. Screenshot saved to replay_error_step_{i}.png", file=sys.stderr)
                raise

        page.screenshot(path="replay_done.png")
        browser.close()

if __name__ == "__main__":
    main()
