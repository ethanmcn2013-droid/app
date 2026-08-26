// Fill refuter-template.md once per finding, from the seat JSON on disk.
//
//   node make-refuters.mjs <roundDir>
//
// One refuter per finding, fresh, defaulting to REFUTED. The template is
// the skill's; this only substitutes the five placeholders and names the
// output path, so no finding reaches a refuter reworded by the session that
// is about to fix it.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".");
const template = await readFile(path.join(dir, "refuter-template.md"), "utf8");
const out = path.join(dir, "refuters");
await mkdir(out, { recursive: true });

const files = (await readdir(dir)).filter((f) => /^seat-.*\.json$/.test(f));
const index = [];
for (const file of files) {
  let seat;
  try {
    seat = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  } catch (error) {
    process.stderr.write(`${file}: unreadable — ${error.message}\n`);
    continue;
  }
  for (const f of seat.findings ?? []) {
    const filled = template
      .replace("{id}", f.id)
      .replace("{seat}", seat.seat)
      .replace("{element}", f.element)
      .replace("{problem}", `${f.problem}\nConsequence claimed: ${f.consequence}\nSeverity claimed: ${f.severity}`)
      .replace("{fix}", f.fix);
    const name = `${f.id}.md`;
    await writeFile(path.join(out, name), filled +
      `\n\nWrite the JSON to ${path.join(out, f.id + ".json")}.\n` +
      `\nENVIRONMENT NOTE: @playwright/test resolves only from ` +
      `C:\\Users\\ethan\\signal-studio-workspace\\collateral — run driving scripts with that as ` +
      `the working directory, and keep throwaway scripts out of the lab.\n`, "utf8");
    index.push({ id: f.id, seat: seat.seat, severity: f.severity, file: name });
  }
}
await writeFile(path.join(out, "index.json"), JSON.stringify(index, null, 2) + "\n", "utf8");
process.stdout.write(`${index.length} refuter prompts from ${files.length} seats → ${out}\n`);
for (const r of index) process.stdout.write(`  ${r.severity.padEnd(11)} ${r.id}   (${r.seat})\n`);
