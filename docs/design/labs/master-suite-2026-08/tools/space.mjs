/* Where the horizontal space actually goes.
 *
 *   node tools/space.mjs [width]
 *
 * The founder's three screenshots all say the same thing in different
 * words: at a real desk width the sheet is full of nothing. This measures
 * it rather than arguing about it — for each product, how much of the sheet
 * the content column actually occupies, and what is capping it.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = pathToFileURL(path.join(LAB, "_wrapped.html")).href;
const WIDTHS = process.argv[2] ? [Number(process.argv[2])] : [1920, 1680, 1440];

const browser = await chromium.launch();
for (const width of WIDTHS) {
  console.log(`\n══ ${width} × 1000 ══`);
  for (const product of ["tasks", "notes", "timeline"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(`${url}?p=${product}`);
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const box = (el) => (el ? el.getBoundingClientRect() : null);
      const r = (b) => (b ? { x: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) } : null);
      const app = document.querySelector(".app:not([hidden])");
      const sheet = app.classList.contains("sheet") ? app : app.querySelector(".sheet");
      const cs = getComputedStyle(document.documentElement);
      const scs = getComputedStyle(sheet);

      /* The widest thing inside the sheet that actually carries content. */
      let widest = null;
      for (const el of sheet.querySelectorAll("*")) {
        const b = el.getBoundingClientRect();
        if (b.width < 40 || b.height < 20) continue;
        if (!el.textContent.trim()) continue;
        if (!widest || b.width > widest.w) widest = { sel: el.className || el.tagName, ...r(b) };
      }
      /* And the vertical: how far down the sheet the last painted thing is. */
      let lowest = 0;
      for (const el of sheet.querySelectorAll("*")) {
        const b = el.getBoundingClientRect();
        if (!b.height || !el.textContent.trim()) continue;
        lowest = Math.max(lowest, b.bottom);
      }
      const sb = sheet.getBoundingClientRect();
      return {
        sheet: r(sb),
        sheetMaxWidth: scs.maxWidth,
        stack: cs.getPropertyValue("--stack").trim() || null,
        measure: cs.getPropertyValue("--measure").trim() || null,
        stageW: cs.getPropertyValue("--stage-w").trim() || null,
        /* The INK the content actually covers: the leftmost and rightmost
           edge of anything that paints a word inside the sheet. A
           full-width wrapper around a capped column is not content. */
        column: (() => {
          let left = Infinity, right = -Infinity;
          const walk = (el) => {
            for (const node of el.childNodes) {
              if (node.nodeType === 3 && node.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const b of range.getClientRects()) {
                  if (b.width < 1 || b.height < 1) continue;
                  left = Math.min(left, b.left);
                  right = Math.max(right, b.right);
                }
              } else if (node.nodeType === 1) walk(node);
            }
          };
          walk(sheet);
          if (right < 0) return null;
          return { sel: "painted words", x: Math.round(left), w: Math.round(right - left), h: 0 };
        })(),
        widest,
        contentBottom: Math.round(lowest - sb.top),
        sheetHeight: Math.round(sb.height),
      };
    });
    const sheetW = m.sheet.w;
    const colW = m.column ? m.column.w : 0;
    const sideAir = sheetW - colW;
    const vAir = m.sheetHeight - m.contentBottom;
    console.log(
      `  ${product.padEnd(9)} sheet ${String(sheetW).padStart(4)}  ` +
      `content ${String(colW).padStart(4)} (${m.column ? m.column.sel.split(" ")[0] : "—"})  ` +
      `→ ${String(sideAir).padStart(4)}px of side air (${Math.round((sideAir / sheetW) * 100)}%)  ` +
      `· ${String(vAir).padStart(4)}px below the last line (${Math.round((vAir / m.sheetHeight) * 100)}%)`,
    );
    console.log(
      `            caps: max-width ${m.sheetMaxWidth}` +
      (m.stack ? ` · --stack ${m.stack}` : "") +
      (m.stageW ? ` · --stage-w ${m.stageW}` : "") +
      (m.measure ? ` · --measure ${m.measure}` : ""),
    );
    await page.close();
  }
}
await browser.close();
