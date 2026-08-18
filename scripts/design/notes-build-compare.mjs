// Inline the packed Notes frames and the real Geist into the comparison
// surface.
//
//   node scripts/design/notes-build-compare.mjs
//
// Sibling of scripts/design/build-compare.mjs. A published Artifact runs under
// a strict CSP with no external hosts, so everything the page needs travels
// inside it: the frames as WebP data URIs, and the product's own Geist as
// woff2 data URIs.
//
// The fonts are not a nicety. This page's whole job is to be looked at
// closely, and a surface that argues about a 400/600 pairing while silently
// falling back to system-ui is arguing about a typeface it is not showing.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const template = await readFile(path.join(LAB, "compare.template.html"), "utf8");
const frames = await readFile(path.join(LAB, "frames.json"), "utf8");

for (const token of ["__FRAMES__", "__FONTS__"]) {
  if (!template.includes(token)) {
    throw new Error(`compare.template.html no longer carries the ${token} placeholder`);
  }
}

const face = async (family, file) => {
  const bytes = await readFile(path.join(LAB, "fonts", file));
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2-variations");font-weight:100 900;font-display:swap;}`;
};

const fonts = [await face("Geist", "Geist.woff2"), await face("Geist Mono", "GeistMono.woff2")].join("\n");

const out = path.join(LAB, "compare.html");
await writeFile(out, template.replace("__FONTS__", fonts).replace("__FRAMES__", frames), "utf8");

const { size } = await stat(out);
const mb = size / 1024 / 1024;
process.stdout.write(`${out}\n${mb.toFixed(2)} MB (Artifact ceiling is 16 MB)\n`);
if (mb > 15.5) {
  process.stdout.write("over budget: re-pack at a lower quality\n");
  process.exitCode = 1;
}
