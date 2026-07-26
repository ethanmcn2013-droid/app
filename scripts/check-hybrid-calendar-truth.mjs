import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/components/hybrid/", import.meta.url));
const banned = [
  ["LAB_TODAY", /\bLAB_TODAY\b/],
  ["frozen July planning start", /2026-07-06/],
  ["frozen August planning end", /2026-08-14/],
  ["hard-coded selected date", /selectedDate\s*=\s*["']2026-/],
];

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    if (![".ts", ".tsx"].includes(extname(entry.name))) return [];
    if (entry.name.includes(".test.") || entry.name.startsWith("fixtures.")) return [];
    return [path];
  });
}

const failures = [];
for (const file of files(root)) {
  const source = readFileSync(file, "utf8");
  for (const [label, pattern] of banned) {
    if (pattern.test(source)) {
      failures.push(`${relative(root, file)} contains ${label}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Hybrid calendar truth gate failed:\n${failures.join("\n")}`);
}

console.log("Hybrid calendar truth gate passed.");
