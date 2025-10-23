// Heuristics: id > name > aria-label > role > data-* > limited classes > constrained nth-of-type fallback
window.__getUniqueSelector = function getUniqueSelector(el) {
  if (!el || el.nodeType !== 1) return null;
  const attr = (n) => el.getAttribute(n);
  const tag = el.tagName.toLowerCase();

  if (attr("id")) return `#${CSS.escape(attr("id"))}`;
  if (attr("name")) return `${tag}[name="${CSS.escape(attr("name"))}"]`;
  if (attr("aria-label")) return `${tag}[aria-label="${CSS.escape(attr("aria-label"))}"]`;
  if (attr("role")) return `${tag}[role="${CSS.escape(attr("role"))}"]`;

  for (const a of el.attributes) {
    if (a.name.startsWith("data-") && a.value) {
      return `${tag}[${a.name}="${CSS.escape(a.value)}"]`;
    }
  }

  // Small, stable class subset (avoid long chains)
  const cls = (el.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (cls.length) return `${tag}.${cls.map((c) => CSS.escape(c)).join(".")}`;

  // Constrained nth-of-type (local to parent)
  let idx = 1, sib = el;
  while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) idx++;
  const parent = el.parentElement ? getUniqueSelector(el.parentElement) : tag;
  return parent ? `${parent} > ${tag}:nth-of-type(${idx})` : `${tag}:nth-of-type(${idx})`;
};
