/* One finding, in full, out of the round record.
 *   node tools/show.mjs <round> <id> [<id> ...]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [round, ...ids] = process.argv.slice(2);
const rec = JSON.parse(await readFile(path.join(LAB, `panel/round-${round}.json`), "utf8"));

for (const id of ids) {
  const f = rec.confirmed.find((x) => x.id === id) || rec.refuted.find((x) => x.id === id);
  if (!f) { console.log(`\n══ ${id} — not in round ${round}\n`); continue; }
  console.log(`\n══ ${id} · ${f.severity || "?"} · ${f.seat}`);
  for (const k of ["element", "problem", "consequence", "fix", "sharpenedFix", "assertion", "breaks"]) {
    if (!f[k]) continue;
    console.log(`\n  ${k.toUpperCase()}\n    ${String(f[k]).replace(/\n/g, "\n    ")}`);
  }
}
