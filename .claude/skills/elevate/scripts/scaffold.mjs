// Stamp a new elevation engagement: lab directory, config, brief, starter
// master, empty panel record, and the behaviour-gate skeleton.
//
//   node scaffold.mjs --name=pricing --dir=docs/design/labs \
//        [--product="one line"] [--gate=9.5] \
//        [--palette="Ink:#111111,Indigo:#4f46e5,White:#ffffff"] \
//        [--states=resting,dense,empty,loading]
//
// The scaffold gets an engagement from nothing to gates-runnable in one
// command. Everything it writes is a starting point the engagement owns and
// edits — except elevate.config.json's role: from the palette lock onward
// that file is enforced mechanically by audit.mjs, so changes to it are
// design decisions, not tweaks.
import { mkdir, writeFile, readFile, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();

const name = args.get("name");
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error("Pass --name=<kebab-slug> for the engagement.");
  process.exit(2);
}
const stamp = new Date().toISOString().slice(0, 7); // yyyy-mm
const parent = path.resolve(args.get("dir") ?? "docs/design/labs");
const lab = path.join(parent, `${name}-${stamp}`);

const palette = (args.get("palette") ?? "Ink:#111111,Indigo:#4f46e5,White:#ffffff")
  .split(",")
  .map((pair) => {
    const [n, hex] = pair.split(":");
    return { name: n.trim(), hex: hex.trim().toLowerCase() };
  });
const states = (args.get("states") ?? "resting,dense,empty,loading").split(",").map((s) => s.trim());

const config = {
  name,
  product: args.get("product") ?? "(fill from the brief)",
  master: "master.html",
  gate: Number(args.get("gate") ?? 9.5),
  states,
  variants: ["a"],
  defaultVariant: "a",
  viewports: [
    { name: "390x844", width: 390, height: 844, isMobile: true },
    { name: "768x1024", width: 768, height: 1024 },
    { name: "1280x900", width: 1280, height: 900 },
    { name: "1440x960", width: 1440, height: 960 },
  ],
  palette,
  families: ["Geist", "Geist Mono"],
  weights: [400, 600],
  ladders: {
    radii: [0, 4, 6, 8, 12, 16, 24, 999],
    durations: [0, 0.08, 0.14, 0.22],
    easings: ["cubic-bezier(0.23, 1, 0.32, 1)"],
    typeRamp: [],
  },
  console: { widths: [1440, 1280, 768, 390], inline: [], fonts: [] },
  artifacts: { console: "", log: "" },
};

const accent = palette[1] ?? palette[0];
const ink = palette[0];

/* A master that honours the toolchain contract from its first render:
   ?state= and ?v= URL parameters, tokens at :root, a state switcher, and
   an argued comment beside every decision. The engagement replaces the
   content wholesale; the contract and the shape of the file survive. */
const starterMaster = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · master</title>
<style>
/* ═════════════════════════════════════════════════════════════════
   ${name} · the working master.
   Palette lock: ${palette.map((p) => `${p.name} ${p.hex}`).join(" · ")}.
   Every colour below must be one of those at some alpha — audit.mjs
   enforces it. Every decision carries its argument in a comment
   beside it; a rule nobody can argue for is a rule to delete.
   ═════════════════════════════════════════════════════════════════ */
:root {
  --ink: ${ink.hex};
  --accent: ${accent.hex};
  --paper: #ffffff;
  --ink-2: rgba(17, 17, 17, 0.72);
  --line: rgba(17, 17, 17, 0.08);
  --wash: rgba(17, 17, 17, 0.04);
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font-family: "Geist", system-ui, sans-serif;
  font-weight: 400; font-size: 15px;
  line-height: 1.55; /* leading is a decision; 'normal' fails the audit */
  -webkit-font-smoothing: antialiased;
}
main { padding: 48px; max-width: 720px; margin: 0 auto; }
h1 { font-size: 24px; font-weight: 600; line-height: 1.15; margin: 0 0 12px; }
p { margin: 0 0 12px; color: var(--ink-2); line-height: 1.55; }
[data-state] main > section { display: none; }
${states.map((s) => `[data-state="${s}"] main > section[data-for="${s}"]`).join(",\n")} { display: block; }
</style>
<body data-state="${states[0]}" data-v="a">
<main>
${states.map((s) => `  <section data-for="${s}"><h1>${name} · ${s}</h1><p>Replace with the real ${s} state, rendered from the real fixture.</p></section>`).join("\n")}
</main>
<script>
/* The toolchain contract: the master answers ?state= and ?v=. */
const q = new URLSearchParams(location.search);
const state = q.get("state"); const v = q.get("v");
if (state) document.body.dataset.state = state;
if (v) document.body.dataset.v = v;
</script>
</body>`;

const panel = { gate: config.gate, seats: [
  "UI composition", "Typography", "Interaction and states",
  "UX and information design", "Brand and copy",
  "Product taste and emotional resonance", "Measured evidence",
], rounds: [] };

await mkdir(path.join(lab, "shots"), { recursive: true });
await mkdir(path.join(lab, "panel"), { recursive: true });

const write = (file, content) => writeFile(path.join(lab, file), content, "utf8");

await write("elevate.config.json", JSON.stringify(config, null, 2) + "\n");
await write("master.html", starterMaster);
await write("panel.json", JSON.stringify(panel, null, 2) + "\n");

/* The brief template travels from the skill's reference so the lab copy is
   the one the operator edits. */
const briefRef = await readFile(path.join(HERE, "..", "references", "brief-template.md"), "utf8");
const briefBody = briefRef.split("```markdown")[1]?.split("```")[0]?.trim()
  ?? "# Elevation brief\n\n(see references/brief-template.md)";
await write("brief.md", briefBody
  .replace("{name}", name)
  .replace("{yyyy-mm}", stamp) + "\n");

await cp(path.join(HERE, "interaction-skeleton.mjs"), path.join(lab, "interaction-check.mjs"));
for (const shell of ["report.shell.html", "console.shell.html"]) {
  await cp(path.join(HERE, "..", "assets", shell), path.join(lab, shell));
}
for (const tpl of ["DIRECTIONS.md", "lock.md"]) {
  await cp(path.join(HERE, "..", "assets", "templates", tpl), path.join(lab, tpl));
}

process.stdout.write(`Scaffolded ${lab}
  elevate.config.json   the mechanical truth (palette, ladders, states)
  brief.md              fill this WITH the operator before anything else
  master.html           starter honouring the ?state=/?v= contract
  interaction-check.mjs behaviour-gate skeleton — grow it every round
  panel.json            empty round record
  report.shell.html     Elevation Log shell
  console.shell.html    Design Console shell
  DIRECTIONS.md lock.md document templates

Next: fill brief.md, build directions, and run
  node ${path.relative(process.cwd(), path.join(HERE, "audit.mjs"))} --lab=${path.relative(process.cwd(), lab)}
`);
