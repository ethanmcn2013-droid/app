// Splice a round's assertion block into interaction-check.mjs, above the
// console-error check that must stay last.
//
//   node append-assertions.mjs round-1-assertions.js
//
// The block is authored in its own file with an editor tool rather than
// pasted through a shell, because a regex written through a heredoc loses
// its escapes — four times in one engagement, twice inside gate assertions,
// where it silently made the checks vacuous. lessons.md L-12.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(HERE, "..");
const which = process.argv[2];
if (!which) {
  process.stderr.write("Pass the assertion file, e.g. round-1-assertions.js\n");
  process.exit(2);
}

const gate = path.join(LAB, "interaction-check.mjs");
const source = await readFile(gate, "utf8");
const block = await readFile(path.join(HERE, which), "utf8");

const marker = "ok(\"zero console errors across every state and both grounds\"";
const at = source.indexOf(marker);
if (at < 0) {
  process.stderr.write("The console-error assertion was not found; refusing to guess where the block goes.\n");
  process.exit(2);
}
if (source.includes(block.split("\n")[0].trim()) && source.includes("round 1, batch 1")) {
  process.stdout.write("already spliced — nothing to do\n");
  process.exit(0);
}

const merged = source.slice(0, at) + block + "\n" + source.slice(at);
await writeFile(gate, merged, "utf8");
process.stdout.write(`spliced ${which} into interaction-check.mjs (${block.split("\n").length} lines)\n`);
