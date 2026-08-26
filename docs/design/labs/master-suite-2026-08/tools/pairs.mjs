/* The fidelity pairs, on one page, so they can be looked at rather than
 * only counted.
 *
 *   node tools/pairs.mjs        (after verify.mjs has written shots/)
 *
 * Writes shots/PAIRS.html — lab on the left, composed on the right, the
 * pixel diff under both, at every width. Lab furniture, deliberately: it
 * never goes near the master.
 */
import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = path.join(LAB, "shots");
const files = new Set(await readdir(SHOTS));
const gate = JSON.parse(await readFile(path.join(LAB, "gate.json"), "utf8")).results
  .filter((r) => r.section === "fidelity");

const WIDTHS = [1440, 1280, 768, 390];
const PRODUCTS = [
  ["tasks", "Tasks · Studio Floor · locked"],
  ["notes", "Notes · The Stack · locked"],
  ["timeline", "Timeline · B · The Approach · On paper"],
];

const rows = [];
for (const [key, title] of PRODUCTS) {
  for (const w of WIDTHS) {
    const lab = `lab-${key}-${w}.png`;
    const suite = `suite-${key}-${w}.png`;
    const diff = `diff-${key}-${w}.png`;
    if (!files.has(lab) || !files.has(suite)) continue;
    const says = gate
      .filter((r) => r.name.includes(key) && r.name.includes(String(w)))
      .map((r) => `<li${r.ok ? "" : ' class="bad"'}>${r.name.replace(key + " ", "").replace("@" + w, "")} — ${esc(r.detail || "")}</li>`)
      .join("");
    rows.push(`
<section>
  <h2>${esc(title)} <em>${w}</em></h2>
  <ul>${says}</ul>
  <div class="pair">
    <figure><img src="./${lab}" alt=""><figcaption>the lab master</figcaption></figure>
    <figure><img src="./${suite}" alt=""><figcaption>the same surface, composed</figcaption></figure>
    ${files.has(diff) ? `<figure><img src="./${diff}" alt=""><figcaption>every differing pixel</figcaption></figure>` : ""}
  </div>
</section>`);
  }
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Master suite · fidelity pairs</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 40px; background: #fafafa; color: #111;
         font: 400 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 30px; letter-spacing: -0.03em; margin: 0 0 4px; }
  p.lede { margin: 0 0 40px; color: rgba(17,17,17,0.62); max-width: 62ch; }
  section { margin: 0 0 56px; }
  h2 { font-size: 17px; margin: 0 0 8px; letter-spacing: -0.02em; }
  h2 em { font-style: normal; color: rgba(17,17,17,0.46); font-variant-numeric: tabular-nums; }
  ul { margin: 0 0 14px; padding-left: 18px; color: rgba(17,17,17,0.62); font-size: 13px; }
  li.bad { color: #b00; font-weight: 600; }
  .pair { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  figure { margin: 0; }
  img { width: 100%; display: block; border: 1px solid rgba(17,17,17,0.10); background: #fff; }
  figcaption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em;
               color: rgba(17,17,17,0.46); margin-top: 6px; }
</style></head><body>
<h1>Fidelity pairs</h1>
<p class="lede">Each lab master at its locked preset, beside the same surface inside
the composed suite, at four widths. The diff paints every differing pixel red.
The sheet — the product — is identical in every pair; the spine is the one object
that was composed, and Timeline is re-composed onto the sheet by design.</p>
${rows.join("")}
</body></html>
`;
await writeFile(path.join(SHOTS, "PAIRS.html"), page, "utf8");
process.stdout.write(`shots/PAIRS.html · ${rows.length} pairs\n${pathToFileURL(path.join(SHOTS, "PAIRS.html")).href}\n`);
