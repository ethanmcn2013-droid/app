// Inline the packed frames into the comparison surface.
//
//   node scripts/design/build-compare.mjs
//
// A published Artifact is served under a strict CSP with no external hosts, so
// the frames have to travel inside the page. This joins the template with
// frames.json and writes the single self-contained file that gets published.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/tasks-2026-08");
const template = await readFile(path.join(LAB, "compare.template.html"), "utf8");
const frames = await readFile(path.join(LAB, "frames.json"), "utf8");

if (!template.includes("__FRAMES__")) {
  throw new Error("compare.template.html no longer carries the __FRAMES__ placeholder");
}

const out = path.join(LAB, "compare.html");
await writeFile(out, template.replace("__FRAMES__", frames), "utf8");

const { size } = await stat(out);
process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB (Artifact ceiling is 16 MB)\n`);
