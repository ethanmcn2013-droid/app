import "server-only";

import type { NoteRead } from "@/modules/notes/server/actions/notes";
import type { DemoFixtureId } from "@/modules/notes/server/demo/notes-fixtures";

/**
 * In-memory demo dataset for Signal Notes.
 *
 * Used only when access-mode is demo/review (see lib/access-mode.ts). The
 * real Turso DB is never touched in that mode, so this is the *entire* world
 * a reviewer sees. It must feel like a real, lived-in notebook, calm
 * coordination for normal people, not a lorem-ipsum placeholder.
 *
 * The cast of one person: a wedding-venue duty manager who also helps run a
 * small studio and is finishing a night course. Notes are written the way
 * people actually capture in three seconds: fragments, half-thoughts, the odd
 * extract pulled out toward Tasks.
 *
 * No real person's data appears here. Timestamps are computed relative to
 * "now" at read time so the notebook always looks freshly used.
 */

export const DEMO_USER_ID = "demo-user";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Fixed so screenshots and browser audits never depend on wall-clock time.
export const DEMO_REFERENCE_TIME = Date.UTC(2026, 6, 15, 9, 0, 0);

type Seed = {
  id: string;
  body: string;
  ago: number; // ms before now
  extractBody?: string;
  promotedTaskId?: string;
  archived?: boolean;
  source?: string;
};

const ACTIVE: Seed[] = [
  {
    id: "demo_n_01",
    body: "Saturday wedding, Maria + James. Ceremony 2pm in the orchard, drinks on the terrace if it stays dry. Confirm marquee sides with the hire company by Thursday.",
    ago: 35 * MIN,
    extractBody: "Confirm marquee sides with hire company before Thursday",
    promotedTaskId: "demo_task_marquee",
  },
  {
    id: "demo_n_02",
    body: "Florist can do the arch but wants final stem count Monday. Maria leaning toward the looser, wilder look, fewer roses, more foliage.",
    ago: 2 * HOUR,
  },
  {
    id: "demo_n_03",
    body: "Idea for the studio newsletter: short piece on “what a calm Saturday actually looks like behind the bar”. People love the backstage angle.",
    ago: 5 * HOUR,
    source: "notebook",
  },
  {
    id: "demo_n_04",
    body: "Course reading for Thursday: chapters 4–5 on cash-flow forecasting. Bring the worked example, the lecturer always opens with it.",
    ago: 9 * HOUR,
    extractBody: "Read cash-flow chapters 4–5 before Thursday class",
  },
  {
    id: "demo_n_05",
    body: "Walk-in couple this morning, June 2027, ~80 guests, budget-conscious but lovely. Sent them the midweek rate. Follow up Friday if no reply.",
    ago: 1 * DAY + 3 * HOUR,
  },
  {
    id: "demo_n_06",
    body: "Bar restock: tonic running low, order two extra cases before the weekend. Also the good olives, last delivery was short.",
    ago: 1 * DAY + 6 * HOUR,
    extractBody: "Order 2 cases tonic + olives before weekend",
    promotedTaskId: "demo_task_restock",
  },
  {
    id: "demo_n_07",
    body: "Photographer recommendation from the Hendersons: Aoife @ northlight. Natural light, doesn’t herd people. Keep her card for the recommended-suppliers list.",
    ago: 2 * DAY,
  },
  {
    id: "demo_n_08",
    body: "Small thing but it matters: the welcome sign by the gate is faded. Reprint before the open day, first impression is the whole car-park walk.",
    ago: 2 * DAY + 4 * HOUR,
  },
  {
    id: "demo_n_09",
    body: "Quote from today that I want to keep: “we don’t want a big production, we just want it to feel like us.” That’s the whole pitch, really.",
    ago: 3 * DAY,
    source: "notebook",
  },
  {
    id: "demo_n_10",
    body: "Heating: orchard room takes ~40 min to warm in October. Switch on before guests arrive, not when. Note for the winter brochure couples.",
    ago: 4 * DAY,
  },
];

const LONG_CONTENT: Seed[] = [
  {
    id: "demo_n_long_01",
    body: "Post-event debrief for Maria and James. The orchard ceremony moved inside at 13:20 when the rain line reached the west gate, so the team reset eighty-four chairs in eighteen minutes and kept the terrace drinks plan intact. What worked: Aoife held family photographs until the room settled; the bar moved one person to the entrance before guests arrived; the florist reused the aisle foliage around the fireplace without needing another decision. What to change next time: keep a printed wet-weather sequence in the duty folder, confirm who owns the accessibility route before opening the side doors, and label the supplier crate for the extraordinarily long North Coast Botanical Installations and Seasonal Hire Company name so it does not disappear into general storage. Follow up with Maria on Thursday, send the revised room-turn checklist to the Saturday team, and keep this note as the source for the winter brochure case study.",
    ago: 18 * MIN,
    extractBody: "Write the wet-weather room-turn checklist and share it with the Saturday team",
  },
  ...ACTIVE.slice(0, 5),
];

// Enough rows to exercise scanning, sticky chrome, and large-stream layout
// without relying on production data. The source notes repeat intentionally:
// density is the variable under review, while IDs and timestamps stay unique.
const DENSE: Seed[] = Array.from({ length: 36 }, (_, index) => {
  const source = ACTIVE[index % ACTIVE.length];
  return {
    ...source,
    id: `demo_n_dense_${String(index + 1).padStart(2, "0")}`,
    ago: (index + 1) * 23 * MIN,
    promotedTaskId: index % 7 === 0 ? `demo_task_dense_${index + 1}` : undefined,
  };
});

// Notes that crossed the one-way edge into Tasks. Each kept its private body
// here; the creator-authored extract is the action that now lives in Tasks.
// This is the surface that shows how Notes behaves in the ecosystem.
const ARCHIVED: Seed[] = [
  {
    id: "demo_n_a1",
    body: "Maria asked about a late checkout for the bridal suite, Sunday 11am instead of 9. Said yes in principle, just needs to clear housekeeping.",
    ago: 1 * DAY + 8 * HOUR,
    extractBody: "Clear Sunday 11am late checkout with housekeeping",
    promotedTaskId: "demo_task_checkout",
    archived: true,
  },
  {
    id: "demo_n_a2",
    body: "Linen supplier rang, the order now ships Tuesday, not Friday. Fine for Saturday, but tight if anything slips.",
    ago: 2 * DAY + 5 * HOUR,
    extractBody: "Chase linen order, now shipping Tuesday",
    promotedTaskId: "demo_task_linen",
    archived: true,
  },
  {
    id: "demo_n_a3",
    body: "Registrar confirmed she can do 2pm but wants the final paperwork a fortnight out. Don't leave it late this time.",
    ago: 4 * DAY,
    extractBody: "Send registrar paperwork two weeks before the date",
    promotedTaskId: "demo_task_registrar",
    archived: true,
  },
];

function toNote(s: Seed, now: number): NoteRead {
  const createdAt = now - s.ago;
  return {
    id: s.id,
    body: s.body,
    createdAt,
    // A faint "edited" pill only where it reads as genuinely touched.
    updatedAt: s.extractBody ? createdAt + 4 * MIN : createdAt,
    extractBody: s.extractBody ?? null,
    promotedTaskId: s.promotedTaskId ?? null,
    archivedAt: s.archived ? now - Math.round(s.ago * 0.6) : null,
    source: s.source ?? null,
    workspaceId: null,
  };
}

export function demoNotes(fixture: DemoFixtureId = "populated"): NoteRead[] {
  if (fixture === "empty" || fixture === "first-use") return [];
  if (fixture === "first-capture") {
    return [toNote(ACTIVE[0], DEMO_REFERENCE_TIME)];
  }
  const seeds =
    fixture === "long-content"
      ? LONG_CONTENT
      : fixture === "dense"
        ? DENSE
        : ACTIVE;
  return seeds.map((seed) => toNote(seed, DEMO_REFERENCE_TIME));
}

export function demoArchivedNotes(
  fixture: DemoFixtureId = "populated",
): NoteRead[] {
  if (
    fixture === "empty" ||
    fixture === "first-use" ||
    fixture === "first-capture"
  ) {
    return [];
  }
  return ARCHIVED.map((seed) => toNote(seed, DEMO_REFERENCE_TIME));
}

export function demoSearchNotes(
  query: string,
  fixture: DemoFixtureId = "populated",
): NoteRead[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return demoNotes(fixture).filter((note) => note.body.toLowerCase().includes(q));
}
