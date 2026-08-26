import { launch, open } from "./drive.mjs";

function lum(r, g, b) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, c) { const l1 = lum(...a), l2 = lum(...c); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

const b = await launch();
const decoder = await (await b.newContext()).newPage();
await decoder.goto("data:text/html,<canvas id=c></canvas>");
const pixels = async (png) => decoder.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = "data:image/png;base64," + b64; });
  const c = document.getElementById("c"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  const m = {}; for (let i = 0; i < d.length; i += 4) { const k = d[i] + "," + d[i + 1] + "," + d[i + 2]; m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, z) => z[1] - a[1]).slice(0, 6);
}, png.toString("base64"));

const cases = [
  ["tasks.board", 390, 844, ['.railTile[data-rail="notes"]', ".railAdd", ".railAvatar"]],
  ["notes.voice", 1440, 960, [".darkAct"]],
  ["notes.notebook", 390, 844, [".dockGlyph", ".dockAvatar"]],
  ["timeline.phone", 390, 844, ['.railTile[data-rail="notes"]']],
];
for (const [state, W, H, sels] of cases) {
  const p = await open(b, { state, width: W, height: H, touch: W <= 480 });
  console.log("=== " + state + " @" + W);
  for (const sel of sels) {
    const box = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.focus({ focusVisible: true }); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }, sel);
    if (!box) { console.log("  " + sel + " absent"); continue; }
    await p.waitForTimeout(250);
    const [x, y, w, h] = box;
    const clip = { x: Math.max(0, x - 8), y: Math.max(0, y - 8), width: Math.min(W - Math.max(0, x - 8), w + 16), height: Math.min(H - Math.max(0, y - 8), h + 16) };
    const top = await pixels(await p.screenshot({ clip }));
    const cols = top.map(([k, v]) => ({ c: k.split(",").map(Number), n: v }));
    const ring = cols.find((o) => Math.abs(o.c[2] - o.c[0]) > 40 || (o.c[0] === 255 && o.c[1] === 255 && o.c[2] === 255 && o.n < 400));
    const ground = cols.filter((o) => !ring || o.c.join() !== ring.c.join()).sort((a, z) => z.n - a.n)[0];
    console.log("  " + sel + "  painted: " + top.map(([k, v]) => k + " x" + v).join(" | "));
    if (ring && ground) console.log("     RING " + ring.c.join(",") + " vs GROUND " + ground.c.join(",") + " = " + ratio(ring.c, ground.c).toFixed(2) + ":1");
  }
  await p.close();
}
await b.close();
