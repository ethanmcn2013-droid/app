import { launch, open } from "./drive.mjs";

function lum(r, g, b) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, c) { const l1 = lum(...a), l2 = lum(...c); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const parse = (s) => { const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
const over = (fg, bg) => [0, 1, 2].map((i) => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));

const b = await launch();
for (const [state, sels] of [
  ["tasks.board", [".railTile[aria-current]", ".railAvatar", ".railMark", ".railTile:not([aria-current])"]],
  ["notes.notebook", [".railTile[aria-current]", ".railAvatar"]],
  ["timeline.owner-flight", [".railTile[aria-current]", ".railAvatar"]],
]) {
  const p = await open(b, { state, width: 1440, height: 960 });
  console.log("=== " + state);
  for (const sel of sels) {
    const info = await p.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      el.focus({ focusVisible: true });
      const cs = getComputedStyle(el);
      // composite the backdrop by walking up
      let n = el, stack = [];
      while (n) { const c = getComputedStyle(n); stack.push(c.backgroundColor); n = n.parentElement; }
      return { outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, outlineOffset: cs.outlineOffset, shadow: cs.boxShadow, ownBg: cs.backgroundColor, stack: stack.slice(0, 6) };
    }, sel);
    if (!info) { console.log("  " + sel + " absent"); continue; }
    // resolve backdrop
    let bg = [255, 255, 255];
    for (let i = info.stack.length - 1; i >= 0; i--) { const c = parse(info.stack[i]); if (c && c[3] > 0) bg = over(c, bg); }
    const ring = parse(info.outlineColor);
    const shadowRing = /0px 0px 0px \d/.test(info.shadow) ? parse(info.shadow) : null;
    console.log("  " + sel);
    console.log("     outline " + info.outlineStyle + " " + info.outlineWidth + " " + info.outlineColor + " offset " + info.outlineOffset);
    console.log("     backdrop rgb(" + bg.join(",") + ")");
    if (ring && info.outlineStyle !== "none" && parseFloat(info.outlineWidth) > 0) console.log("     RING vs BACKDROP  " + ratio(over(ring, bg), bg).toFixed(2) + ":1  (WCAG 1.4.11 needs 3.0)");
    if (shadowRing) console.log("     shadow-ring " + info.shadow.slice(0, 70) + " -> " + ratio(over(shadowRing, bg), bg).toFixed(2) + ":1");
  }
  await p.close();
}
await b.close();
