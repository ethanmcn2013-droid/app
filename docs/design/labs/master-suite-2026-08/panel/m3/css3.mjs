import { readFile } from "node:fs/promises";

const LAB = "C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const cssFiles = ["foundation.css", "shell.css", "tasks.css", "notes.css", "timeline.css", "across.css"];
const jsFiles = ["app.js", "tasks.js", "notes.js", "timeline.js", "fixture.js", "icons.js"];

let hay = "";
for (const f of jsFiles) hay += await readFile(LAB + "/src/" + f, "utf8");
hay += await readFile(LAB + "/master.html", "utf8");
for (const f of ["world.head.js", "world.foot.js"]) {
  try { hay += await readFile(LAB + "/tools/" + f, "utf8"); } catch {}
}

const camel = (s) => s.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());

const found = new Map();
for (const f of cssFiles) {
  const css = (await readFile(LAB + "/src/" + f, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /\[(data-[a-z0-9-]+)(?:([~^$*|]?=)"([^"]*)")?\]/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const key = m[1] + (m[3] !== undefined ? '="' + m[3] + '"' : "");
    if (!found.has(key)) found.set(key, { attr: m[1], val: m[3], files: new Set() });
    found.get(key).files.add(f);
  }
}

const deadAttr = [];
const deadVal = [];
for (const [key, info] of found) {
  const attrOk = hay.includes(info.attr) || hay.includes("dataset." + camel(info.attr));
  if (!attrOk) { deadAttr.push(key + "  [" + [...info.files].join(",") + "]"); continue; }
  if (info.val !== undefined && info.val !== "" && !hay.includes(info.val)) {
    deadVal.push(key + "  [" + [...info.files].join(",") + "]");
  }
}
console.log("distinct data-* selector keys:", found.size);
console.log("\nATTRIBUTE never written anywhere (" + deadAttr.length + "):");
deadAttr.forEach((d) => console.log("  " + d));
console.log("\nVALUE string never appears anywhere (" + deadVal.length + "):");
deadVal.forEach((d) => console.log("  " + d));
