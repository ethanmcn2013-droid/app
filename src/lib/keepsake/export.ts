/**
 * The Keepsake export: the thing the couple actually owns.
 *
 * D-010 point 3 ratified free, read-only, indefinite Keepsake access "while
 * the service exists", with a one-click export. The export is not a nicety
 * attached to that promise, it IS the promise: without it the sentence reduces
 * to "we will keep your wedding as long as we happen to be around", which is
 * not something to sell to a venue.
 *
 * So the export has one requirement above all others: it must still open in
 * ten years, on a laptop, with Signal Studio switched off and no internet
 * connection. That rules out a link, an app, a proprietary format, and any
 * HTML that fetches a font or a stylesheet. One self-contained HTML file a
 * person can read, plus the same content as JSON for anything that wants to
 * machine-read it.
 *
 * Pure. No database, no filesystem, no network. The caller assembles the
 * input; this turns it into files.
 */

export type KeepsakeMilestone = {
  title: string;
  /** Calendar date, YYYY-MM-DD, or null when the couple never set one. */
  date: string | null;
  /** "complete" | "upcoming" | "cancelled" as the plan recorded it. */
  state: string;
  /** The couple's own note against the milestone, if any. */
  note?: string | null;
};

export type KeepsakeTask = {
  title: string;
  lane: string;
  done: boolean;
  due?: string | null;
  notes?: string | null;
};

export type KeepsakeExportInput = {
  /** What the couple called the workspace. */
  label: string;
  /** The wedding day, YYYY-MM-DD, or null. */
  weddingDate: string | null;
  /** The couple's own label for the day, e.g. "Our wedding". */
  weddingDateLabel?: string | null;
  milestones: KeepsakeMilestone[];
  tasks: KeepsakeTask[];
  /**
   * The sponsoring venue's NAME, and nothing else. D-027 point 3 and D-011
   * point 2: no logo, no badge, no venue-written message, one line only.
   */
  venueName?: string | null;
  /** When the export was produced. */
  generatedAt: Date;
};

export type KeepsakeFile = {
  name: string;
  contentType: string;
  body: string;
};

export type KeepsakeExport = {
  files: KeepsakeFile[];
  /** Suggested archive name, safe on every filesystem. */
  archiveName: string;
};

// ── formatting ────────────────────────────────────────────────────────

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatCalendarDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return LONG_DATE.format(parsed);
}

/**
 * Escape for HTML text and attribute contexts. The export contains the
 * couple's own words and the names of their guests and suppliers; a surname
 * with an apostrophe or an ampersand must not be able to break the document.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "keepsake";
}

// ── the document ──────────────────────────────────────────────────────

/**
 * Every sentence a couple reads in the export. Kept together so the voice can
 * be checked in one place.
 *
 * Constraints, all ratified: never "forever" (D-009 point 3), no storage
 * guarantee (D-010 point 3), venue name only (D-027 point 3), nothing that
 * states or implies legal approval (D-016), no seat count (D-020).
 */
const COPY = {
  standfirst: "This is your plan, saved as one file. It opens on any computer, with or without an internet connection.",
  ownership:
    "This copy is yours. It does not need Signal Studio to open, it does not expire, and nothing here checks in with us.",
  milestonesHeading: "Milestones",
  tasksHeading: "Everything else on the plan",
  noMilestones: "No milestones were shared on this plan.",
  noTasks: "No tasks were recorded on this plan.",
  noDate: "No date set",
} as const;

function renderMilestones(milestones: KeepsakeMilestone[]): string {
  if (!milestones.length) return `<p class="empty">${COPY.noMilestones}</p>`;

  const rows = milestones.map((milestone) => {
    const date = formatCalendarDate(milestone.date) ?? COPY.noDate;
    const note = milestone.note?.trim()
      ? `<p class="note">${escapeHtml(milestone.note.trim())}</p>`
      : "";
    return [
      '<li class="milestone" data-state="' + escapeHtml(milestone.state) + '">',
      `<p class="when">${escapeHtml(date)}</p>`,
      `<h3>${escapeHtml(milestone.title)}</h3>`,
      note,
      "</li>",
    ].join("");
  });

  return `<ol class="milestones">${rows.join("")}</ol>`;
}

function renderTasks(tasks: KeepsakeTask[]): string {
  if (!tasks.length) return `<p class="empty">${COPY.noTasks}</p>`;

  const byLane = new Map<string, KeepsakeTask[]>();
  for (const task of tasks) {
    const lane = task.lane || "Other";
    const bucket = byLane.get(lane) ?? [];
    bucket.push(task);
    byLane.set(lane, bucket);
  }

  const sections = [...byLane.entries()].map(([lane, items]) => {
    const list = items.map((task) => {
      const due = formatCalendarDate(task.due);
      const meta = due ? `<span class="when">${escapeHtml(due)}</span>` : "";
      const notes = task.notes?.trim()
        ? `<p class="note">${escapeHtml(task.notes.trim())}</p>`
        : "";
      return [
        `<li data-done="${task.done ? "true" : "false"}">`,
        `<span class="title">${escapeHtml(task.title)}</span>`,
        meta,
        notes,
        "</li>",
      ].join("");
    });
    return `<section class="lane"><h3>${escapeHtml(lane)}</h3><ul>${list.join("")}</ul></section>`;
  });

  return sections.join("");
}

/**
 * Colour and type, stated literally, and this is the one file in the repo
 * where that is correct rather than drift.
 *
 * The design system is loaded at build time from `src/ds/tokens.css`. This
 * document has to open on a laptop in ten years with Signal Studio switched
 * off, so it cannot reference a token, import a stylesheet, or load a font.
 * The values below ARE the light-mode tokens, materialised, and each is named
 * so the pair can be kept in step:
 *
 *   --paper       rgb(255 255 255)
 *   --paper-soft  rgb(250 250 250)
 *   --paper-deep  rgb(244 244 245)
 *   --ink         rgb(17 17 17)
 *   --ink-soft    rgb(63 63 70)
 *   --ink-faint   rgb(113 113 122)
 *   --ink-ghost   rgb(212 212 216)
 *   --hairline    rgb(17 17 17 / 0.10)
 *
 * Written in rgb() rather than hex deliberately: this file should not need
 * a token exception to render its one-off printable artifact.
 * Geist is named first so a reader who has it gets it, and the stack falls
 * back to the reader's own system fonts rather than fetching anything.
 */
const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 4rem 1.5rem 6rem;
  background: rgb(250 250 250);
  color: rgb(17 17 17);
  font: 400 17px/1.6 Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 44rem; margin: 0 auto; }
h1 { margin: 0 0 0.5rem; font-size: clamp(2.4rem, 8vw, 3.6rem); line-height: 1.02;
     font-weight: 500; letter-spacing: -0.03em; }
h2 { margin: 3.5rem 0 1.25rem; font-size: 0.8125rem; font-weight: 500; letter-spacing: 0.12em;
     text-transform: uppercase; color: rgb(113 113 122); }
h3 { margin: 0 0 0.25rem; font-size: 1.0625rem; font-weight: 500; letter-spacing: -0.01em; }
.day { margin: 0 0 2rem; color: rgb(113 113 122); }
.standfirst { margin: 0 0 2.5rem; max-width: 34rem; color: rgb(63 63 70); }
.milestones { margin: 0; padding: 0; list-style: none; }
.milestone { padding: 1.25rem 0; border-top: 1px solid rgb(17 17 17 / 0.10); }
.milestone[data-state="cancelled"] { color: rgb(113 113 122); }
.when { margin: 0 0 0.15rem; font: 400 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
        letter-spacing: 0.06em; text-transform: uppercase; color: rgb(113 113 122); }
.note { margin: 0.5rem 0 0; color: rgb(63 63 70); }
.lane { margin: 0 0 2rem; }
.lane h3 { margin-bottom: 0.5rem; }
.lane ul { margin: 0; padding: 0; list-style: none; }
.lane li { padding: 0.6rem 0; border-top: 1px solid rgb(212 212 216); }
.lane li[data-done="true"] .title { color: rgb(113 113 122); text-decoration: line-through; }
.lane .when { display: block; margin-top: 0.15rem; }
.empty { color: rgb(113 113 122); }
footer { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid rgb(17 17 17 / 0.10);
         font-size: 14px; color: rgb(113 113 122); }
footer p { margin: 0 0 0.4rem; }
@media print {
  body { background: rgb(255 255 255); padding: 0; }
  footer { break-inside: avoid; }
}
`.trim();

/**
 * Build the export. Returns file contents; writing them is the caller's job.
 */
export function buildKeepsakeExport(input: KeepsakeExportInput): KeepsakeExport {
  const weddingDay = formatCalendarDate(input.weddingDate);
  const dayLabel = input.weddingDateLabel?.trim() || "The day";
  const generated = LONG_DATE.format(input.generatedAt);

  const attribution = input.venueName?.trim()
    ? `<p>Compliments of ${escapeHtml(input.venueName.trim())}.</p>`
    : "";

  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex, nofollow">',
    `<title>${escapeHtml(input.label)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<main>",
    `<h1>${escapeHtml(input.label)}</h1>`,
    weddingDay
      ? `<p class="day">${escapeHtml(dayLabel)}, ${escapeHtml(weddingDay)}</p>`
      : "",
    `<p class="standfirst">${COPY.standfirst}</p>`,
    `<h2>${COPY.milestonesHeading}</h2>`,
    renderMilestones(input.milestones),
    `<h2>${COPY.tasksHeading}</h2>`,
    renderTasks(input.tasks),
    "<footer>",
    `<p>${COPY.ownership}</p>`,
    `<p>Saved ${escapeHtml(generated)}.</p>`,
    attribution,
    "<p>A Signal Studio product.</p>",
    "</footer>",
    "</main>",
    "</body>",
    "</html>",
  ].filter(Boolean).join("\n");

  const json = JSON.stringify(
    {
      format: "signal-studio-keepsake",
      version: 1,
      generatedAt: input.generatedAt.toISOString(),
      label: input.label,
      weddingDate: input.weddingDate,
      weddingDateLabel: input.weddingDateLabel ?? null,
      venueName: input.venueName?.trim() || null,
      milestones: input.milestones,
      tasks: input.tasks,
    },
    null,
    2,
  );

  return {
    archiveName: `${slug(input.label)}-keepsake`,
    files: [
      { name: "keepsake.html", contentType: "text/html; charset=utf-8", body: html },
      { name: "keepsake.json", contentType: "application/json; charset=utf-8", body: json },
    ],
  };
}

/**
 * Assert the export is genuinely self-contained: no request of any kind leaves
 * the file when it is opened. Exported so the test asserts the property rather
 * than a hand-written list of strings, and so a future edit to the template
 * cannot quietly add a webfont.
 */
export function findExternalReferences(html: string): string[] {
  const found: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/<script\b/i, "script"],
    [/<link\b/i, "link"],
    [/<img\b/i, "img"],
    [/<iframe\b/i, "iframe"],
    [/\bsrc\s*=/i, "src attribute"],
    [/https?:\/\//i, "absolute URL"],
    [/@import\b/i, "css import"],
    [/url\s*\(/i, "css url()"],
  ];
  for (const [pattern, name] of patterns) {
    if (pattern.test(html)) found.push(name);
  }
  return found;
}
