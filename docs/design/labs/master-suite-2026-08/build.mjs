/* Assemble master.html from the parts in src/.
 *
 *   node docs/design/labs/master-suite-2026-08/build.mjs
 *
 * src/ is the source; master.html is generated and is never hand-edited.
 * One self-contained file: the published artifact reaches no external host,
 * so every stylesheet, every script and both fonts travel inside it.
 *
 * The artifact wrapper supplies <!doctype>, <html>, <head> and <body>, so
 * this writes page content only. Two consequences it handles:
 *   - body { … } rules are still legal, so the ink floor is fine
 *   - nothing may be authored onto <body>, so every decision attribute
 *     that Timeline's own build.mjs put there rides on the app roots
 *
 * It also refuses to produce a master that has already gone wrong in one of
 * the three ways this composition can go wrong quietly:
 *   1. unbalanced CSS braces (the malformed @keyframes that scoped 562
 *      rules into nonsense in the Tasks Console)
 *   2. a keyframe name declared by two products, which would make one
 *      product's animation play the other's
 *   3. a product rule that escaped its scope
 * The browser recovers from bad CSS; a build step must not have to.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, selectors, assertBalanced, classesIn } from "./tools/css.mjs";

const LAB = path.dirname(fileURLToPath(import.meta.url));
/* Paths relative to the LAB, not to src/, because they are also read by
   the elevate audit — its source-ladder check finds the stylesheets by
   parsing the CSS list below out of this file, and a bare basename sent
   it looking in the wrong directory. One list, one meaning. */
const src = (f) => readFile(path.join(LAB, f), "utf8");

/* Order is the cascade. foundation first because both products reach
   through it; shell next because the products override it; then the three
   products, none of which can reach the other two. */
const CSS = ["src/foundation.css", "src/shell.css", "src/tasks.css", "src/notes.css", "src/timeline.css", "src/across.css"];
/* fixture before icons before the products, and app.js before all of them:
   every product registers with the suite as it loads. */
const JS = ["src/fixture.js", "src/icons.js", "src/app.js", "src/tasks.js", "src/notes.js", "src/timeline.js"];

/* ── the fonts ───────────────────────────────────────────────────
   The variable Geist from the Tasks and Notes labs, not Timeline's three
   static faces: one pair of files serves all three products at 400 and
   600, and verify.mjs proves Timeline renders identically against it
   before this is allowed to stand. */
const FONTS = [
  ["Geist", "Geist.woff2"],
  ["Geist Mono", "GeistMono.woff2"],
];
const faces = [];
let fontBytes = 0;
for (const [family, file] of FONTS) {
  const bytes = await readFile(path.join(LAB, "fonts", file));
  fontBytes += bytes.length;
  faces.push(
    `@font-face {\n` +
    `  font-family: "${family}";\n` +
    `  src: url("data:font/woff2;base64,${bytes.toString("base64")}") format("woff2-variations");\n` +
    `  font-weight: 100 900;\n` +
    `  font-display: block;\n` +
    `}`,
  );
}

/* ── the stylesheets ─────────────────────────────────────────────── */
const parts = [];
for (const file of CSS) {
  let text = await src(file);
  /* The two @font-face blocks in foundation.css point at ./fonts/. They are
     replaced by the inlined pair above, once, at the top. */
  if (file === "src/foundation.css") {
    text = text.replace(/@font-face \{[^}]*\}\s*/g, "");
  }
  assertBalanced(text, `src/${file}`);
  parts.push(`/* ══ ${path.basename(file)} ══════════════════════════════════════════ */`);
  parts.push(text.trim());
}
const css = faces.join("\n") + "\n\n" + parts.join("\n\n");

/* ── the three gates on the CSS ──────────────────────────────────── */
const nodes = {};
for (const file of CSS) nodes[file] = parse(await src(file), file);

/* 1 · every keyframe name belongs to exactly one sheet */
const frames = new Map();
for (const [file, list] of Object.entries(nodes)) {
  for (const n of list) {
    if (n.kind !== "at" || !/^@(-\w+-)?keyframes\b/.test(n.prelude)) continue;
    const name = n.prelude.split(/\s+/).pop();
    if (frames.has(name) && frames.get(name) !== file) {
      throw new Error(
        `build: two stylesheets declare @keyframes ${name} (${frames.get(name)} and ${file}). ` +
        `A keyframe name is global; one product would play the other's animation.`,
      );
    }
    frames.set(name, file);
  }
}

/* 2 · no product rule escapes its scope. The shell owns the floor, the
   spine, the sheet's base and the body; a product rule that does not name
   its own app element is a rule that can starve another product. */
const SHELL_OK = new Set(["src/shell.css", "src/foundation.css"]);
/* across.css is Timeline's own new surface, kept in its own file so it is
   easy to argue with, and held to the same scope rule. */
const APP_OF = { "src/across.css": "timeline" };
for (const [file, list] of Object.entries(nodes)) {
  if (SHELL_OK.has(file)) continue;
  const app = APP_OF[file] || path.basename(file, ".css");
  for (const n of list) {
    if (n.kind !== "rule") continue;
    for (const s of selectors(n.selector)) {
      if (!s.includes(`[data-app="${app}"]`)) {
        throw new Error(`build: ${file} declares «${s}» outside [data-app="${app}"]`);
      }
    }
  }
}

/* 3 · no product sheet redeclares a shell class. */
const SHELL_CLASSES = new Set(
  "floor rail railMark railDivider railGroup railUtil railTile railSpacer railAvatar railAdd sr".split(" "),
);
for (const [file, list] of Object.entries(nodes)) {
  if (SHELL_OK.has(file)) continue;
  for (const n of list) {
    if (n.kind !== "rule") continue;
    for (const s of selectors(n.selector)) {
      const cs = [...classesIn(s)];
      if (cs.length && cs.every((c) => SHELL_CLASSES.has(c))) {
        throw new Error(`build: ${file} redeclares shell chrome «${s}» — shell.css owns it`);
      }
    }
  }
}

/* ── the scripts ─────────────────────────────────────────────────── */
const scripts = [];
for (const file of JS) {
  scripts.push(`/* ══ ${path.basename(file)} ══════════════════════════════════════════ */`);
  scripts.push((await src(file)).trim());
}

/* ── the page ────────────────────────────────────────────────────
   One floor, one spine, three sheets. Every decision attribute rides on
   the app root that owns it, because nothing may be authored onto <body>.
   The presets are the locked ones and there is no switch UI anywhere in
   this file: it is a production application, not a console. */
const page = `<title>Signal Studio</title>
<style>
${css}
</style>

<div id="deck" class="floor" data-product="tasks">
  <!-- The spine is inserted here by app.js, once, before the sheets. -->
  <div class="app" data-app="notes" hidden inert></div>
  <div class="app" data-app="tasks"></div>
  <main class="app sheet" data-app="timeline" hidden inert
        data-v="paper" data-ground="paper" data-spacing="measured"
        data-past="folded" data-accent="structure" data-state="owner-flight">
    <div id="tl"></div>
  </main>
</div>

<script>
${scripts.join("\n\n")}

/* ══ the suite opens ═══════════════════════════════════════════ */
/* Timeline's own file registers nothing — it is the one product with no
   console behind it — so the suite is told here what its repaint is
   called. mount() re-reads the decisions off the app root every time,
   which is exactly the arrival behaviour the other two get from theirs. */
window.__SUITE.register("timeline", { show: window.__TLCORE.mount, api: window.__TLCORE });
window.__TLCORE.mount();

/* Every product has registered and painted. The floor gets its spine, and
   the sheet the URL names is repainted now that it has a box. */
window.__SUITE.start();
</script>
`;

await writeFile(path.join(LAB, "master.html"), page, "utf8");
process.stdout.write(
  `master.html · ${CSS.length} stylesheets · ${JS.length} scripts · ` +
  `${Math.round(fontBytes / 1024)} KB of font · ${Math.round(page.length / 1024)} KB total\n` +
  `  ${frames.size} keyframe names, no collisions · every product rule inside its scope\n`,
);
