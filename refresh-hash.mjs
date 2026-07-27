import path from "node:path";
import { writeFileSync } from "node:fs";
import { discoverRegistry, readJson, writeStableJson } from "./scripts/experience/lib.mjs";
const ONLY = new Set(["tasks.surface.command-palette"]);
const root = process.cwd();
const dir = path.join(root, "experience");
const config = readJson(path.join(dir, "config.json"));
const explicit = readJson(path.join(dir, "surfaces.json"));
const overrides = readJson(path.join(dir, "overrides.json"));
const registry = readJson(path.join(dir, "registry.json"));
const discovered = discoverRegistry({ studioRoot: root, config, explicit, overrides });
const dMap = new Map(discovered.experiences.map((e) => [e.id, e]));
let n = 0;
for (const e of registry.experiences) {
  if (!ONLY.has(e.id)) continue;
  const d = dMap.get(e.id);
  if (d && e.materialityHash !== d.materialityHash) {
    console.log(`${e.id}: ${e.materialityHash} -> ${d.materialityHash}`);
    e.materialityHash = d.materialityHash; n++;
  }
}
writeFileSync(path.join(dir, "registry.json"), writeStableJson(registry));
console.log(`refreshed ${n}`);
