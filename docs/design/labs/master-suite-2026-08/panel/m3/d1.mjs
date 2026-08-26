import { launch, open } from "./drive.mjs";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

function lum(r, g, b) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, c) { const l1 = lum(...a), l2 = lum(...c); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

const b = await launch();
const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });

// Focus each of a set of controls that sit on the INK floor and read the painted ring.
const targets = [".railTile[aria-current]", ".railAvatar", ".railMark"];
for (const sel of targets) {
  const n = await p.locator(sel).count();
  if (!n) { console.log(sel, "absent"); continue; }
  const info = await p.evaluate((s) => {
    const el = document.querySelector(s);
    el.focus({ focusVisible: true });
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { outline: cs.outlineColor + " " + cs.outlineWidth + " " + cs.outlineStyle + " off:" + cs.outlineOffset, shadow: cs.boxShadow.slice(0, 90), box: [r.x, r.y, r.width, r.height].map(Math.round) };
  }, sel);
  console.log(sel, JSON.stringify(info));
  // screenshot the ring region and find the extreme pixels
  const [x, y, w, h] = info.box;
  const pad = 10;
  const clip = { x: Math.max(0, x - pad), y: Math.max(0, y - pad), width: w + pad * 2, height: h + pad * 2 };
  const buf = await p.screenshot({ clip });
  const png = PNG.sync.read(buf);
  const counts = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const k = png.data[i] + "," + png.data[i + 1] + "," + png.data[i + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, c) => c[1] - a[1]).slice(0, 6);
  console.log("   painted colours:", top.map(([k, v]) => k + " x" + v).join("  |  "));
  const floor = [17, 17, 17];
  for (const [k] of top) {
    const c = k.split(",").map(Number);
    if (c[0] === 17 && c[1] === 17 && c[2] === 17) continue;
    console.log("     " + k + " vs ink floor -> " + ratio(c, floor).toFixed(2) + ":1");
  }
}
await p.close();
await b.close();
