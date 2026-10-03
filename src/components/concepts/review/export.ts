import type { ConceptMeta } from "../types";
import { CONCEPT_VIEWS, conceptHref, conceptKey, orderConcepts, viewLabel } from "../views";
import type { Review, Reviews, Verdict } from "./store";

const DATA_OPEN = "<!-- concept-review-data";
const DATA_CLOSE = "-->";

const quote = (text: string) =>
  text
    .trim()
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `  > ${line}` : "  >"))
    .join("\n");

function entry(concept: ConceptMeta, review: Review | undefined) {
  const lines = [
    `### ${viewLabel(concept.view)} ${concept.n} · ${concept.title}`,
    "",
    `- Route: \`${conceptHref(concept)}\``,
    `- Code: \`src/components/concepts/${concept.view}/c${concept.n}/\``,
    `- Screenshot: \`public/concepts/${concept.view}-${concept.n}.png\``,
    `- Thesis: ${concept.thesis}`,
  ];
  if (review?.keep?.trim()) lines.push("- Keep:", quote(review.keep));
  if (review?.change?.trim()) lines.push("- Change or drop:", quote(review.change));
  if (review?.notes?.trim()) lines.push("- Notes:", quote(review.notes));
  return lines.join("\n");
}

/** The handoff: everything an AI needs to narrow the concepts and act on the notes. */
export function buildMarkdown(concepts: readonly ConceptMeta[], reviews: Reviews, now = new Date()) {
  const ordered = orderConcepts(concepts);
  const bucket = (verdict: Verdict | undefined) =>
    ordered.filter((concept) => reviews[conceptKey(concept)]?.verdict === verdict);
  const liked = bucket("like");
  const partly = bucket("partly");
  const out = bucket("out");
  const open = ordered.filter((concept) => !reviews[conceptKey(concept)]?.verdict);
  const date = now.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });

  const table = [
    "| View | Liked | Partly | Ruled out | Not reviewed |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...CONCEPT_VIEWS.filter((view) => ordered.some((concept) => concept.view === view.key)).map((view) => {
      const inView = ordered.filter((concept) => concept.view === view.key);
      const count = (verdict: Verdict | undefined) =>
        inView.filter((concept) => reviews[conceptKey(concept)]?.verdict === verdict).length;
      return `| ${view.label} | ${count("like")} | ${count("partly")} | ${count("out")} | ${count(undefined)} |`;
    }),
  ].join("\n");

  const section = (title: string, intro: string, list: ConceptMeta[]) =>
    list.length ? [`## ${title} (${list.length})`, "", intro, "", list.map((concept) => entry(concept, reviews[conceptKey(concept)])).join("\n\n")].join("\n") : "";

  const unreviewedNotes = open.filter((concept) => reviews[conceptKey(concept)]);

  return [
    "# Concept review · handoff",
    "",
    `Exported ${date}. ${ordered.length} concepts: ${liked.length} liked, ${partly.length} partly liked, ${out.length} ruled out, ${open.length} not reviewed.`,
    "",
    "## Instructions for the AI picking this up",
    "",
    "These are front-end concept explorations for the Signal Studio app, shown in the review-only gallery at `/app/concepts` (review mode: `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`).",
    [
      "- **Liked:** take these directions forward. Apply every Keep, Change and Note listed.",
      "- **Partly liked:** carry forward only what is listed under Keep. Treat everything else in the concept as rejected unless a note says otherwise.",
      "- **Ruled out:** do not pursue these directions or reuse their distinctive ideas.",
      "- **Not reviewed:** no decision yet. Leave them as they are.",
      "- Where a note names a part of another concept, combine the two as described.",
    ].join("\n"),
    "",
    "## Summary",
    "",
    table,
    "",
    section("Liked", "Take these forward.", liked),
    section("Partly liked", "Keep only the listed parts.", partly),
    section("Ruled out", "Do not pursue.", out),
    unreviewedNotes.length ? section("Notes without a verdict", "Notes were left, but no verdict yet.", unreviewedNotes) : "",
    open.length ? [`## Not reviewed (${open.length})`, "", open.map((concept) => `- ${viewLabel(concept.view)} ${concept.n} · ${concept.title} (\`${conceptHref(concept)}\`)`).join("\n")].join("\n") : "",
    "",
    `${DATA_OPEN} ${JSON.stringify(Object.fromEntries(ordered.map(conceptKey).filter((key) => reviews[key]).map((key) => [key, reviews[key]])))} ${DATA_CLOSE}`,
    "",
  ]
    .filter((block) => block !== "")
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Reads the review back out of an exported file. */
export function parseMarkdown(text: string): Reviews | null {
  const start = text.lastIndexOf(DATA_OPEN);
  if (start < 0) return null;
  const end = text.indexOf(DATA_CLOSE, start);
  if (end < 0) return null;
  try {
    const data = JSON.parse(text.slice(start + DATA_OPEN.length, end).trim());
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export function downloadMarkdown(markdown: string, now = new Date()) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `concept-review-${now.toISOString().slice(0, 10)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
