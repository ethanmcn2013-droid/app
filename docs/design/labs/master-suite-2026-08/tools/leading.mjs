/* Every text element whose leading the BROWSER is choosing, and what it
 * currently chooses.
 *
 *   node tools/leading.mjs
 *
 * "Leading is a decision; the browser choosing it means nobody did." The
 * Tasks engagement ran nineteen rounds without this check — its audit
 * never had one — so this is the first time anything has looked. The
 * ratio is printed so a declared value can be chosen that does not move
 * a single pixel of a surface that has already been ratified.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = pathToFileURL(path.join(LAB, "_gate-suite.html")).href;
const STATES = ["tasks.board", "tasks.dense", "notes.notebook", "notes.seam", "notes.voice",
  "timeline.owner-flight", "timeline.desk", "timeline.phone"];

const browser = await chromium.launch();
const found = new Map();
for (const state of STATES) {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 960 } });
    await page.goto(`${url}?state=${state}`);
    await page.waitForTimeout(700);
    const rows = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll(".app:not([hidden]) *, .rail, .rail *")) {
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!hasText || el.ownerSVGElement) continue;
        const cs = getComputedStyle(el);
        if (cs.lineHeight !== "normal") continue;
        const size = parseFloat(cs.fontSize);
        /* What 'normal' actually resolves to, measured — a one-line box is
           its own leading. */
        const probe = el.cloneNode(true);
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.whiteSpace = "nowrap";
        probe.style.width = "auto";
        document.body.appendChild(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        out.push({
          sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""),
          size,
          ratio: size ? Math.round((h / size) * 1000) / 1000 : 0,
          text: el.textContent.trim().slice(0, 28),
        });
      }
      return out;
    });
    for (const r of rows) {
      const key = r.sel + "|" + r.size;
      if (!found.has(key)) found.set(key, { ...r, where: new Set() });
      found.get(key).where.add(state.split(":")[0]);
    }
    await page.close();
  }
}
await browser.close();

const list = [...found.values()].sort((a, b) => a.sel.localeCompare(b.sel));
process.stdout.write(`${list.length} distinct elements with an undeclared leading\n\n`);
for (const r of list) {
  process.stdout.write(
    `  ${r.sel.padEnd(40)} ${String(r.size).padStart(5)}px  normal ≈ ${String(r.ratio).padEnd(6)} ` +
    `${[...r.where].join(",").padEnd(10)} “${r.text}”\n`,
  );
}
