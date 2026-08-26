// Compile the master into one self-contained page fit to publish.
//
//   node build-surface.mjs
//
// The master is the graded file and it is deliberately NOT self-contained:
// it loads fixture.js, which derive-fixture.mjs regenerates from the
// shipping fixture, and three woff2 files. A published artifact reaches no
// external host and receives one file, so this inlines both — and nothing
// else. There is no second source of truth: change the master, rebuild,
// republish.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const master = await readFile(path.join(HERE, "lately.html"), "utf8");
const fixture = await readFile(path.join(HERE, "fixture.js"), "utf8");

let out = master;

// The artifact host wraps the file in its own doctype, head and body, so the
// master's document furniture is removed rather than nested.
out = out.replace(/^<!doctype html>\s*/i, "");
// The charset belongs to the host's head; the viewport meta is kept, because
// a page published without one is laid out at 980px on every phone and the
// 390 composition never renders.
out = out.replace(/<meta charset[^>]*>\s*/i, "");
out = out.replace(/<body[^>]*>\s*/i, "");
out = out.replace(/<\/body>\s*$/i, "");

// The fixture, inlined verbatim — the same bytes derive-fixture.mjs wrote.
out = out.replace(
  '<script src="fixture.js"></script>',
  `<script>\n/* inlined from fixture.js by build-surface.mjs */\n${fixture}</script>`,
);

// The faces, as data URIs.
const faces = [
  ["fonts/Geist-Regular.woff2"],
  ["fonts/Geist-SemiBold.woff2"],
  ["fonts/GeistMono-Regular.woff2"],
];
for (const [rel] of faces) {
  const bytes = await readFile(path.join(HERE, rel));
  out = out.replace(
    `url("${rel}") format("woff2")`,
    `url("data:font/woff2;base64,${bytes.toString("base64")}") format("woff2")`,
  );
}

// Nothing may still reach outside the file.
const leaks = out.match(/(?:src|url)\(?["']?(?:https?:|\.\/|fonts\/|[a-z0-9-]+\.(?:js|css|woff2?))/gi) ?? [];
if (leaks.length) {
  process.stderr.write(`surface.html still reaches outside itself: ${leaks.join(", ")}\n`);
  process.exit(2);
}

// The body defaults the master used to carry as attributes now arrive from
// the script, which already sets them on every load.
await writeFile(path.join(HERE, "surface.html"), out, "utf8");
process.stdout.write(`surface.html · ${(out.length / 1024 / 1024).toFixed(2)} MB, self-contained\n`);
