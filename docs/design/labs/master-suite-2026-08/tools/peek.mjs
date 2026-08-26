/* What shape did the workflow journal actually record?
 *   node tools/peek.mjs <journal.jsonl>
 */
import { readFile } from "node:fs/promises";

const lines = (await readFile(process.argv[2], "utf8")).split(/\r?\n/).filter(Boolean);
const kinds = {};
const rows = [];
for (const l of lines) {
  try {
    const r = JSON.parse(l);
    kinds[r.type] = (kinds[r.type] || 0) + 1;
    if (r.type === "result") rows.push(r);
  } catch { /* partial tail */ }
}
console.log("line types:", JSON.stringify(kinds));
console.log("result count:", rows.length);
console.log("result keys:", Object.keys(rows[0] || {}).join(" "));
for (const i of [0, 1, 8, 20, 40, 70]) {
  const r = rows[i];
  if (!r) continue;
  const v = r.value ?? r.result ?? r.output;
  console.log(`\n── #${i} label=${JSON.stringify(r.label)} valueType=${typeof v}`);
  console.log(String(typeof v === "string" ? v : JSON.stringify(v)).slice(0, 420));
}
