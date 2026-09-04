// Fill the refuter template once per finding across every seat that sat.
//
//   node panel/make-refuters.mjs --round=6
//
// One file per finding, so each refuter runs in its own fresh context and
// the default-REFUTED rule is never diluted by seeing a batch. Writes
// nothing for a seat that raised nothing, which is a valid answer.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";

const round = Number((process.argv.find((a) => a.startsWith("--round=")) || "").split("=")[1]);
if (!Number.isInteger(round)) { console.error("Pass --round=<n>."); process.exit(2); }

const dir = path.join(import.meta.dirname, `round-${round}`);
const out = path.join(dir, "refuters");
const template = await readFile(path.join(dir, "refuter-template.md"), "utf8");

await mkdir(out, { recursive: true });
const seats = (await readdir(dir)).filter((f) => /^seat-.*\.json$/.test(f)).sort();
if (!seats.length) { console.error(`No seat JSON in ${dir}.`); process.exit(1); }

let n = 0;
const roster = [];
for (const file of seats) {
  const seat = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  const findings = seat.findings || [];
  roster.push(`${file.replace(/^seat-|\.json$/g, "")}  ${seat.score}  ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
  for (const f of findings) {
    /* The placeholders are filled by NAME, not by position: a finding whose
       problem text happens to contain "{fix}" cannot rewrite the prompt. */
    const filled = template
      .replace("{id}", f.id)
      .replace("{seat}", seat.seat)
      .replace("{element}", f.element)
      .replace("{problem}", f.problem)
      .replace("{fix}", f.fix);
    await writeFile(path.join(out, `${f.id}.md`), filled, "utf8");
    n += 1;
  }
}
process.stdout.write(roster.join("\n") + `\n\n${n} refuter prompt${n === 1 ? "" : "s"} in ${out}\n`);
