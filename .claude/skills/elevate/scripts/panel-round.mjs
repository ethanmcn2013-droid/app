// Generate one panel round from the lab's own truth.
//
//   node panel-round.mjs --lab=<dir> --round=3
//   node panel-round.mjs --lab=<dir> --round=3 --mode=prompts
//   node panel-round.mjs --lab=<dir> --round=3 --notes=panel/round-3-notes.md --final
//
// Emits either a Workflow-tool script (panel/round-N.workflow.js — run it
// with the Workflow tool) or, with --mode=prompts, a directory of seat
// prompt files plus a runsheet for subagent or sequential execution.
//
// Everything contextual is read, never retyped: the target and audience
// from brief.md, the lock from elevate.config.json, the frames from shots/,
// the gates from their files on disk. The generator holds only what is
// constant across every engagement — the standard, the seats, the refuter.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, loadLab } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const { lab, config } = await loadLab(args);
const ROUND = Number(args.get("round"));
if (!Number.isInteger(ROUND) || ROUND < 1) {
  console.error("Pass --round=<n>.");
  process.exit(2);
}
const MODE = args.get("mode") ?? "workflow";
const FINAL = args.get("final") === "true";

/* ── brief sections ──────────────────────────────────────────────── */
let brief = "";
try { brief = await readFile(path.join(lab, "brief.md"), "utf8"); } catch {}
const section = (name) => {
  const m = brief.match(new RegExp(`^## ${name}[^\\n]*\\n([\\s\\S]*?)(?=^## |\\n*$(?![\\s\\S]))`, "m"));
  return m ? m[1].trim() : "";
};
const target = section("Target") || config.product || "(no brief — write one before running a panel)";
const audience = (section("Audience") || "The person this is built for").split("\n")[0].replace(/^\((.*)\)$/, "$1").trim();
const decided = section("Decided — inherit, do not re-explore") || section("Decided");
const protectedObjects = section("Protected — elevate with a scalpel, never re-imagine") || section("Protected");
const outOfScope = section("What is out of scope");
const driveBrief = section("Drive");

/* ── the standard, verbatim across every engagement ──────────────── */
const STANDARD = `Score against this standard: the work of an award-winning design studio that
iterated on this product for months. 10 is that studio's best shipped work.
Benchmarks to hold it against, by name: Linear, Stripe, Vercel, xAI/Grok,
SpaceX. Score the ARTIFACT, not the effort. A polite ${Math.min(config.gate - 1.5, 8)} that should be a 6
makes the panel worthless.`;

/* ── constraints from the lock ───────────────────────────────────── */
const paletteLine = config.palette.map((p) => `${p.name} ${p.hex}`).join(", ");
const constraints = [
  `- Palette is exactly ${config.palette.length} colours: ${paletteLine}, plus tints of those at`,
  `  stated alpha. NO other hue may be introduced. Status and hierarchy are`,
  `  expressed by ink density, weight and fill, not by colour.`,
  `- Type is ${config.families.join(" and ")} at weights ${config.weights.join(" and ")} only.`,
  decided ? `- The locked architecture:\n${decided.replace(/^/gm, "  ")}` : null,
  protectedObjects ? `- Protected objects (polish, never redesign):\n${protectedObjects.replace(/^/gm, "  ")}` : null,
].filter(Boolean).join("\n");

/* ── frames actually on disk ─────────────────────────────────────── */
const grading = config.viewports[config.viewports.length - 1]?.name ?? "1440x960";
let shotFiles = [];
try { shotFiles = await readdir(path.join(lab, "shots")); } catch {}
const frames = [
  ...config.states.map((state) => ({ file: `${config.defaultVariant}-${state}--${grading}.png`, caption: state })),
  ...config.viewports.filter((v) => v.name !== grading).map((v) => ({
    file: `${config.defaultVariant}-${config.states[0]}--${v.name}.png`,
    caption: `${config.states[0]} at ${v.name}`,
  })),
].filter((f) => shotFiles.includes(f.file));
const framesBlock = frames.length
  ? frames.map((f) => `${path.join(lab, "shots", f.file)}    ${f.caption}`).join("\n")
  : "(no frames found — run shots.mjs before the round; a panel without frames is grading air)";

/* ── gate pointers ───────────────────────────────────────────────── */
const gatesBlock = `MEASURED BASELINE. Two automated gates guard this master and both pass:
- ${path.join(HERE, "audit.mjs")} --lab=${lab}
  (palette lock, weights, families, WCAG AA contrast against the real
  composited backdrop, hit targets, radii, motion, type ramp, leading)
- ${path.join(lab, "interaction-check.mjs")}
READ the behaviour gate. Everything it asserts is already proven; a finding
that restates one of those assertions is worthless and will be refuted on
sight. Spend your findings on what automation cannot see.

Before scoring, also read the paid-for defect library at
${path.join(HERE, "..", "references", "lessons.md")} — those classes have
been found and fixed once already; check whether they are creeping back,
and spend the rest of your attention past them.`;

/* ── drive instructions ──────────────────────────────────────────── */
const master = path.join(lab, config.master);
const driveBlock = `GRADE BY DRIVING, NOT ONLY BY READING FRAMES. Open the master in Playwright
(chromium; import { chromium } from "@playwright/test") at
file://${master}?v=${config.defaultVariant}&state=<state> and operate it:
tab through everything, press what looks pressable, exercise the keyboard
model end to end, resize across ${config.viewports.map((v) => v.width).join("/")}, and watch what every
repaint does to scroll position and focus.${driveBrief ? "\n" + driveBrief : ""}`;

let notes = "";
if (args.get("notes")) {
  notes = (await readFile(path.resolve(args.get("notes")), "utf8")).trim();
}

const closing = FINAL
  ? `THIS IS THE FINAL ROUND. There will be no further remediation, so your
score is the number that goes on the record. Grade it as the finished
artifact.`
  : "";

const ask = `Say plainly what this is: name the score, name what earned it, and name what
still stands between it and ${config.gate} in terms a founder can act on — is what
remains polish, a build, or a different decision, and roughly how big. Do not
inflate to be kind and do not deflate to look rigorous.`;

const BAR = [
  STANDARD,
  `WHAT YOU ARE REVIEWING\n${target}\nThe audience: ${audience}.`,
  `CONSTRAINTS THAT ARE NOT NEGOTIABLE (do not propose breaking these):\n${constraints}\nFindings that amount to "add a colour", "add a weight" or "restructure the\nlocked architecture" are out of scope and will be discarded.${outOfScope ? `\nAlso out of scope for this engagement:\n${outOfScope}` : ""}`,
  gatesBlock,
  `FRAMES (read the images):\n${framesBlock}\nSource: ${master}`,
  driveBlock,
  notes ? `ROUND NOTES\n${notes}` : null,
  closing || null,
  ask,
].filter(Boolean).join("\n\n");

/* ── the seats ───────────────────────────────────────────────────── */
const SEATS = [
  { key: "ui", name: "UI composition", lens: "Composition, alignment, optical balance, grid, rhythm, density, the relationship between the page's major objects. Where the eye goes first and whether that is right. Lazy spacing, unequal optical margins, things that align mathematically but not optically." },
  { key: "type", name: "Typography", lens: `The type system: scale, weight pairing at ${config.weights.join("/")} only, tracking curve, line-height, measure, mono micro-label discipline, numerals, orphans and widows, hierarchy carried by size versus weight versus tracking. Hold it to Vercel Geist and Linear standards.` },
  { key: "interaction", name: "Interaction and states", lens: "Hover, focus, active, selected, drag, empty, loading, dense. Affordance at rest. Reflow on hover. Discoverability of reveal-on-hover controls. Keyboard model and focus order. What the loading frame promises versus what arrives." },
  { key: "ux", name: "UX and information design", lens: `${audience} has to run their work from this. Comprehension without training. Is the most important thing on screen the most prominent thing. Duplicated, missing, or twice-named information. Dense and empty states.` },
  { key: "brand", name: "Brand and copy", lens: "Register: confident, premium, restrained, never cheap. Voice: plain English, declarative, no jargon, no exclamation marks, sentence case. Judge every visible string. One grammar per fact; one name per thing. Judge whether the palette is being spent well or merely obeyed." },
  { key: "taste", name: "Product taste and emotional resonance", lens: "Would a discerning stranger believe a top studio made this and pay for it. Does it move you: relief, calm, confidence, delight. Or does it merely function. Name the single memorable moment, and if there is none that is the finding. Equal weight to any craft seat." },
  { key: "evidence", name: "Measured evidence", lens: "You distrust opinion. Read the SOURCE closely. CSS that cannot do what it claims, dead rules, specificity collisions, values off the declared ladders, states declared but unreachable, responsive rules that will break, accessibility beyond contrast (semantics, roles, names, focus order, aria), and any place the code and its comment disagree. Cite selectors and line context." },
];

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["seat", "score", "findings", "biggestWin"],
  properties: {
    seat: { type: "string" },
    score: { type: "number" },
    findings: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "element", "problem", "fix", "cost"],
        properties: {
          id: { type: "string", description: "a short kebab-case slug naming this defect" },
          element: { type: "string" },
          problem: { type: "string" },
          fix: { type: "string", description: "implementable exactly as written" },
          cost: { type: "number" },
        },
      },
    },
    biggestWin: { type: "string" },
  },
};

const VERDICT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "real", "reason"],
  properties: {
    id: { type: "string" },
    real: { type: "boolean" },
    reason: { type: "string" },
    sharpenedFix: { type: "string" },
  },
};

const REFUTE_OPEN = "Adversarially verify one design-review finding against the artifact. Default to REFUTED when uncertain.";
const REFUTE_RULES =
  `Refute if: it is factually wrong about the frames or the code; it is already handled; it would violate a non-negotiable constraint; it is taste stated as a defect with no argument; the fix would make the work worse; or it restates something the gates already prove. ` +
  `Confirm only if real, specific, and an improvement at a ${config.gate} bar. ` +
  `Echo the finding id back exactly so the verdict can be matched to its finding.`;

const refuterPrompt = (findingExpr) =>
  `${REFUTE_OPEN}\n\n${findingExpr}\n\n${BAR}\n\n${REFUTE_RULES}`;

await mkdir(path.join(lab, "panel"), { recursive: true });

if (MODE === "workflow") {
  const script = `export const meta = {
  name: '${config.name}-panel-round-${ROUND}${FINAL ? "-final" : ""}',
  description: 'Seven fresh independent seats grade the ${config.name} master against a ${config.gate} bar',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

const BAR = ${JSON.stringify(BAR)}
const REFUTE_OPEN = ${JSON.stringify(REFUTE_OPEN)}
const REFUTE_RULES = ${JSON.stringify(REFUTE_RULES)}

const SCHEMA = ${JSON.stringify(SCHEMA, null, 2)}

const SEATS = ${JSON.stringify(SEATS, null, 2)}

phase('Review')
const reviews = await parallel(SEATS.map((seat) => () =>
  agent(
    \`You are the \${seat.name} seat on an independent design review panel. Round ${ROUND}.\\n\\n\` +
    \`YOUR LENS\\n\${seat.lens}\\n\\n\${BAR}\\n\\n\` +
    \`Return your score to one decimal, your 3 to 5 most costly defects, and the single change that would raise the score most. \` +
    \`Give every finding a short kebab-case id. Do not hedge, do not give credit for effort, and do not guess at any other seat's opinion.\`,
    { label: \`seat:\${seat.key}\`, phase: 'Review', schema: SCHEMA }
  )
))

const alive = reviews.filter(Boolean)

phase('Verify')
const verdicts = await parallel(
  alive.flatMap((review) =>
    review.findings.map((finding) => () =>
      agent(
        REFUTE_OPEN + '\\n\\n' +
        \`FINDING id=\${finding.id}\\nSeat: \${review.seat}\\nElement: \${finding.element}\\nProblem: \${finding.problem}\\nProposed fix: \${finding.fix}\` +
        '\\n\\n' + BAR + '\\n\\n' + REFUTE_RULES,
        { label: \`verify:\${finding.id}\`, phase: 'Verify', schema: ${JSON.stringify(VERDICT_SCHEMA)} }
      )
    )
  )
)

const byId = new Map()
for (const review of alive) {
  for (const finding of review.findings) byId.set(finding.id, { seat: review.seat, ...finding })
}

const checked = verdicts.filter(Boolean)
const confirmed = []
const refuted = []
for (const verdict of checked) {
  const finding = byId.get(verdict.id)
  if (!finding) continue
  const row = { ...finding, verdict: verdict.reason, sharpenedFix: verdict.sharpenedFix || null }
  if (verdict.real) confirmed.push(row)
  else refuted.push(row)
}

log(\`round ${ROUND}: \${alive.length} seats, \${checked.length} verdicts, \${confirmed.length} confirmed, \${refuted.length} refuted\`)

return {
  round: ${ROUND},
  scores: alive.map((r) => ({ seat: r.seat, score: r.score, biggestWin: r.biggestWin })),
  confirmed,
  refuted: refuted.map((r) => ({ seat: r.seat, id: r.id, problem: r.problem, why: r.verdict })),
}
`;
  const out = path.join(lab, "panel", `round-${ROUND}.workflow.js`);
  await writeFile(out, script, "utf8");
  process.stdout.write(`${out}\nRun it with the Workflow tool: Workflow({ scriptPath: "${out}" })\n`);
} else {
  const dir = path.join(lab, "panel", `round-${ROUND}`);
  await mkdir(dir, { recursive: true });
  for (const seat of SEATS) {
    const prompt = `You are the ${seat.name} seat on an independent design review panel. Round ${ROUND}.

YOUR LENS
${seat.lens}

${BAR}

Return ONLY a JSON object matching:
${JSON.stringify(SCHEMA, null, 2)}

Score to one decimal. 3 to 5 findings, each with a short kebab-case id and a
cost in tenths. Do not hedge, do not give credit for effort, and do not
guess at any other seat's opinion. Write the JSON to ${path.join(dir, `seat-${seat.key}.json`)}.
`;
    await writeFile(path.join(dir, `seat-${seat.key}.md`), prompt, "utf8");
  }
  await writeFile(path.join(dir, "refuter-template.md"),
    refuterPrompt("FINDING id={id}\nSeat: {seat}\nElement: {element}\nProblem: {problem}\nProposed fix: {fix}") +
    `\n\nReturn ONLY a JSON object matching:\n${JSON.stringify(VERDICT_SCHEMA, null, 2)}\n`, "utf8");
  await writeFile(path.join(dir, "runsheet.md"), `# Round ${ROUND} runsheet (prompts mode)

1. Run each seat-<key>.md in its own FRESH context (subagent if available;
   strictly one at a time otherwise), writing each seat's JSON to disk
   before the next seat begins. Never mention one seat's output to another.
2. For every finding across all seats, run refuter-template.md (fill the
   {placeholders}) in a fresh context. Default is REFUTED.
3. Fix every confirmed finding; verify each rendered; grow the behaviour
   gate; run both gates; append the round to panel.json; rebuild and
   republish both artifacts; push.
4. If seats ran sequentially in one shared context, record "degraded
   blindness" in the round entry.
`, "utf8");
  process.stdout.write(`${dir}\n7 seat prompts + refuter-template.md + runsheet.md\n`);
}
