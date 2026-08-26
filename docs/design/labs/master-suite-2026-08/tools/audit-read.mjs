/* What the measured gate is actually reporting, grouped so it can be acted
 * on rather than scrolled past.
 *
 *   node tools/audit-read.mjs [category]
 *
 * The gate prints per-state totals; this prints the distinct defects and
 * where each one lives, because 173 "leading" failures is almost never 173
 * problems — it is one rule, seen 173 times.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data = JSON.parse(await readFile(path.join(LAB, "_audit.json"), "utf8"));
const only = process.argv[2];

const rows = new Map();
for (const [vp, v] of Object.entries(data.viewports)) {
  for (const [state, cats] of Object.entries(v.states)) {
    for (const [cat, list] of Object.entries(cats)) {
      if (!Array.isArray(list) || !list.length) continue;
      if (only && cat !== only) continue;
      for (const item of list) {
        /* One key per distinct defect, not per sighting. */
        const key = cat + " · " + (item.el || item.selector || "?") + " · " +
          [item.size, item.ratio, item.value, item.have, item.w, item.h, item.ratioNow, item.leading]
            .filter((x) => x !== undefined).join(" ");
        if (!rows.has(key)) rows.set(key, { cat, item, where: new Set(), n: 0 });
        const row = rows.get(key);
        row.where.add(state + " @" + vp.split("x")[0]);
        row.n += item.n || 1;
      }
    }
  }
}

const byCat = {};
for (const r of rows.values()) (byCat[r.cat] = byCat[r.cat] || []).push(r);

for (const [cat, list] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  process.stdout.write(`\n══ ${cat} · ${list.length} distinct · ${list.reduce((s, r) => s + r.n, 0)} sightings ══\n`);
  list.sort((a, b) => b.n - a.n);
  for (const r of list.slice(0, 24)) {
    const i = r.item;
    const facts = Object.entries(i)
      .filter(([k]) => !["el", "n", "text"].includes(k))
      .map(([k, v]) => `${k} ${v}`).join(" · ");
    process.stdout.write(
      `  ${String(r.n).padStart(4)}×  ${(i.el || "?").padEnd(34)} ${facts}\n` +
      `        ${[...r.where].sort().join(", ")}\n` +
      (i.text ? `        “${String(i.text).slice(0, 60)}”\n` : ""),
    );
  }
  if (list.length > 24) process.stdout.write(`  … and ${list.length - 24} more\n`);
}
