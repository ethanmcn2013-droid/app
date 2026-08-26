/* The artifact wrapper, locally.
 *
 * master.html is page CONTENT: no <!doctype>, no <html>, no <head>, no
 * <body>, because the published artifact supplies those. Nothing can open
 * it as a file without them, so every gate in this lab opens a wrapped copy
 * instead — the same skeleton the artifact host puts around it, and the
 * same minimal reset.
 *
 * If this file and the host ever disagree, the gates are grading a page
 * nobody will see. It is deliberately short for that reason.
 *
 * It writes four files:
 *   _wrapped.html          opens on Tasks, answers ?p=
 *   _gate-{product}.html   opens on that product with no query string, so
 *                          the three labs' own audits — none of which knows
 *                          about ?p= — can be pointed at the composed file
 *                          rather than rewritten
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LAB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const body = await readFile(path.join(LAB, "master.html"), "utf8");

const skeleton = (content) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}</style>
</head>
<body>
${content}
</body>
</html>
`;

await writeFile(path.join(LAB, "_wrapped.html"), skeleton(body), "utf8");

const AUTHORED = '<div id="deck" class="floor" data-product="tasks">';
if (!body.includes(AUTHORED)) throw new Error("wrap: the deck's authored markup has moved");
for (const product of ["tasks", "notes", "timeline"]) {
  await writeFile(
    path.join(LAB, `_gate-${product}.html`),
    skeleton(body.replace(AUTHORED, AUTHORED.replace('"tasks"', `"${product}"`))),
    "utf8",
  );
}
/* The elevate toolchain's own handle. It reaches every surface through
   one parameter — ?state=<product>:<state> — so it is the plain wrapped
   copy under the name elevate.config.json points at. */
await writeFile(path.join(LAB, "_gate-suite.html"), skeleton(body), "utf8");
process.stdout.write(`_wrapped.html + 4 gate copies · ${Math.round(body.length / 1024)} KB each\n`);
