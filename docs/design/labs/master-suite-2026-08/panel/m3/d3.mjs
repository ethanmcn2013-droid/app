import { launch, open } from "./drive.mjs";

function lum(r, g, b) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, c) { const l1 = lum(...a), l2 = lum(...c); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

const b = await launch();
const decoder = await (await b.newContext()).newPage();
await decoder.goto("data:text/html,<canvas id=c></canvas>");

async function pixels(png, w, h) {
  const b64 = png.toString("base64");
  return await decoder.evaluate(async ({ b64, w, h }) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = "data:image/png;base64," + b64; });
    const c = document.getElementById("c");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    const counts = {};
    for (let i = 0; i < d.length; i += 4) { const k = d[i] + "," + d[i + 1] + "," + d[i + 2]; counts[k] = (counts[k] || 0) + 1; }
    return Object.entries(counts).sort((a, x) => x[1] - a[1]).slice(0, 8);
  }, { b64, w, h });
}

for (const [state, sels] of [["tasks.board", [".railTile[aria-current]", '.railTile[data-rail="notes"]', ".railAvatar", ".railMark"]]]) {
  const p = await open(b, { state, width: 1440, height: 960 });
  for (const sel of sels) {
    const box = await p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.focus({ focusVisible: true }); const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }, sel);
    if (!box) { console.log(sel, "absent"); continue; }
    await p.waitForTimeout(250);
    const [x, y, w, h] = box;
    const shot = await p.screenshot({ clip: { x: Math.max(0, x - 8), y: Math.max(0, y - 8), width: w + 16, height: h + 16 } });
    const top = await pixels(shot, w + 16, h + 16);
    console.log(sel, "box", box.join(","));
    console.log("   painted:", top.map(([k, v]) => k + " x" + v).join(" | "));
    // the ring colour is the one closest to indigo
    const ring = top.map(([k]) => k.split(",").map(Number)).find((c) => Math.abs(c[2] - c[0]) > 40);
    // the floor colour is the darkest large-area colour that is not the ring
    const floor = top.map(([k]) => k.split(",").map(Number)).filter((c) => !ring || c.join() !== ring.join()).sort((a, c) => lum(...a) - lum(...c))[0];
    if (ring && floor) console.log("   RING " + ring.join(",") + " vs FLOOR " + floor.join(",") + " = " + ratio(ring, floor).toFixed(2) + ":1  (needs 3.0)");
  }
  await p.close();
}
await b.close();
