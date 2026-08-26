import { readFile } from "node:fs/promises";

const LAB = "C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const cssFiles = ["foundation.css", "shell.css", "tasks.css", "notes.css", "timeline.css", "across.css"];
const jsFiles = ["app.js", "tasks.js", "notes.js", "timeline.js", "fixture.js", "icons.js"];

let css = "";
for (const f of cssFiles) css += "\n/*FILE:" + f + "*/\n" + (await readFile(LAB + "/src/" + f, "utf8"));
let js = "";
for (const f of jsFiles) js += await readFile(LAB + "/src/" + f, "utf8");
js += await readFile(LAB + "/master.html", "utf8");
const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");

const declared = new Map();
const declRe = /(^|[;{\s])(--[a-zA-Z0-9-]+)\s*:/g;
let m;
while ((m = declRe.exec(clean)) !== null) declared.set(m[2], (declared.get(m[2]) || 0) + 1);

const used = new Set();
const useRe = /var\(\s*(--[a-zA-Z0-9-]+)/g;
while ((m = useRe.exec(clean)) !== null) used.add(m[1]);

const jsSet = new Set();
const jsRe = /setProperty\(\s*["'`](--[a-zA-Z0-9-]+)/g;
while ((m = jsRe.exec(js)) !== null) jsSet.add(m[1]);
const jsRe2 = /(--[a-zA-Z0-9-]+)\s*:/g;
while ((m = jsRe2.exec(js)) !== null) jsSet.add(m[1]);

const neverUsed = [...declared.keys()].filter((k) => !used.has(k));
const neverDeclared = [...used].filter((k) => !declared.has(k) && !jsSet.has(k));

console.log("declared:", declared.size, "used in var():", used.size, "set from JS:", jsSet.size);
console.log("\nDECLARED BUT NEVER READ VIA var() (" + neverUsed.length + "):");
neverUsed.forEach((k) => console.log("  " + k + "  x" + declared.get(k) + (jsSet.has(k) ? "  (also set from JS)" : "")));
console.log("\nREAD VIA var() BUT NEVER DECLARED IN CSS OR JS (" + neverDeclared.length + "):");
neverDeclared.forEach((k) => console.log("  " + k));
