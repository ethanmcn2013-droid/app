import type { LaneId, Priority } from "@/lib/data";
import type { DomainId } from "@/lib/domains";

/**
 * Drop-in task lists users can apply to an existing workspace.
 *
 * A template is pure declarative data — no DB writes here. The
 * `applyTemplateAction` server action reads this list, looks up the
 * matching template by id, and inserts each task into the active
 * workspace via the same shape `addTaskAction` accepts (additive —
 * existing tasks are NOT cleared).
 *
 * The vocabulary for `domain` matches the four `DomainPack`s in
 * `@/lib/domains` — picking the closest semantic neighbor lets the
 * gallery group / filter templates by audience later without
 * restructuring this module.
 *
 * `icon` is intentionally a small set of unicode glyphs (no SVG
 * sprite, no image assets) so we can render templates anywhere
 * without touching the asset pipeline.
 */

export type TemplateTaskInput = {
  title: string;
  lane: LaneId;
  priority: Priority;
  /** Human due label — same shape as `Task.due` ("Today", "Fri", "Mar 12"). */
  due?: string;
  tags?: string[];
};

export type Template = {
  id: string;
  name: string;
  description: string;
  /** Single unicode glyph; rendered inside a soft brand-tinted square. */
  icon: string;
  /** The starter pack this template pairs best with; used for grouping
   *  in the gallery and as a hint for which seed pack a brand-new
   *  workspace might want before applying. */
  domain: DomainId;
  tasks: TemplateTaskInput[];
};

export const TEMPLATES: Template[] = [
  // ─── Cross-domain ──────────────────────────────────────────────────
  {
    id: "job-application-sprint",
    name: "Job application sprint",
    description:
      "Tailor resume, send five outreach emails, practice the answers — without the panic.",
    icon: "💼",
    domain: "student",
    tasks: [
      {
        title: "Tailor resume to the role",
        lane: "doing",
        priority: "p1",
        due: "Today",
        tags: ["resume"],
      },
      {
        title: "Draft cover letter",
        lane: "todo",
        priority: "p1",
        due: "Tomorrow",
        tags: ["writing"],
      },
      {
        title: "Send 5 outreach emails to people at the company",
        lane: "todo",
        priority: "p2",
        due: "Fri",
        tags: ["outreach"],
      },
      {
        title: "Practice 3 behavioral interview answers out loud",
        lane: "todo",
        priority: "p2",
        tags: ["interview"],
      },
      {
        title: "Research the team — hiring manager + 2 ICs",
        lane: "todo",
        priority: "p2",
        tags: ["research"],
      },
      {
        title: "Submit application",
        lane: "todo",
        priority: "p1",
        due: "Mon",
        tags: ["submit"],
      },
      {
        title: "Send thank-you note within 24h of any interview",
        lane: "todo",
        priority: "p2",
        tags: ["follow-up"],
      },
    ],
  },
  {
    id: "quarterly-review-prep",
    name: "Quarterly review prep",
    description:
      "Walk into your one-on-one with receipts, not vibes.",
    icon: "🎯",
    domain: "marketing",
    tasks: [
      {
        title: "List wins this quarter — concrete, with numbers",
        lane: "doing",
        priority: "p1",
        due: "Today",
        tags: ["review"],
      },
      {
        title: "List 2 places I fell short and what I learned",
        lane: "todo",
        priority: "p1",
        tags: ["review"],
      },
      {
        title: "Gather peer feedback — 3 quick asks",
        lane: "todo",
        priority: "p2",
        due: "Wed",
        tags: ["feedback"],
      },
      {
        title: "Draft self-review doc",
        lane: "todo",
        priority: "p1",
        due: "Thu",
        tags: ["writing"],
      },
      {
        title: "Pick 3 goals for next quarter",
        lane: "todo",
        priority: "p2",
        tags: ["goals"],
      },
      {
        title: "Prep talking points for one-on-one",
        lane: "todo",
        priority: "p1",
        due: "Fri",
        tags: ["meeting"],
      },
    ],
  },
  {
    id: "apartment-move",
    name: "Apartment move",
    description:
      "Notice the landlord, hire movers, forward the mail. Survive the box maze.",
    icon: "📦",
    domain: "freelance",
    tasks: [
      {
        title: "Give landlord written notice",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["admin"],
      },
      {
        title: "Get 3 mover quotes",
        lane: "todo",
        priority: "p1",
        due: "Fri",
        tags: ["logistics"],
      },
      {
        title: "Book movers + reserve elevator",
        lane: "todo",
        priority: "p1",
        tags: ["logistics"],
      },
      {
        title: "Forward mail with USPS",
        lane: "todo",
        priority: "p2",
        tags: ["admin"],
      },
      {
        title: "Set up utilities at new place — power, internet, water",
        lane: "todo",
        priority: "p1",
        tags: ["utilities"],
      },
      {
        title: "Cancel utilities at old place (date-shift, don't shut off early)",
        lane: "todo",
        priority: "p2",
        tags: ["utilities"],
      },
      {
        title: "Pack room by room — label every box",
        lane: "todo",
        priority: "p2",
        tags: ["packing"],
      },
      {
        title: "Update address — bank, DMV, employer, subscriptions",
        lane: "todo",
        priority: "p2",
        tags: ["admin"],
      },
      {
        title: "Final walkthrough + photos for deposit",
        lane: "todo",
        priority: "p1",
        tags: ["move-out"],
      },
    ],
  },
  {
    id: "trip-planning",
    name: "Trip planning",
    description:
      "Flights, hotel, itinerary, everything you forget at the gate.",
    icon: "✈️",
    domain: "freelance",
    tasks: [
      {
        title: "Lock dates + budget",
        lane: "done",
        priority: "p1",
        tags: ["planning"],
      },
      {
        title: "Book flights",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["travel"],
      },
      {
        title: "Book hotel / Airbnb",
        lane: "todo",
        priority: "p1",
        due: "Tomorrow",
        tags: ["travel"],
      },
      {
        title: "Draft 3-day itinerary — leave room to wander",
        lane: "todo",
        priority: "p2",
        tags: ["itinerary"],
      },
      {
        title: "Reserve standout dinners",
        lane: "todo",
        priority: "p2",
        tags: ["food"],
      },
      {
        title: "Check passport expiry + visa",
        lane: "todo",
        priority: "p1",
        tags: ["admin"],
      },
      {
        title: "Travel insurance + emergency contacts",
        lane: "todo",
        priority: "p2",
        tags: ["admin"],
      },
      {
        title: "Pack list — checked + carry-on",
        lane: "todo",
        priority: "p3",
        tags: ["packing"],
      },
    ],
  },

  // ─── Wedding ───────────────────────────────────────────────────────
  {
    id: "wedding-3-month-countdown",
    name: "3-month countdown",
    description:
      "RSVPs, seating, vows, all the small fires before the big day.",
    icon: "💍",
    domain: "wedding",
    tasks: [
      {
        title: "Send invitations — 90 days out",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["invites"],
      },
      {
        title: "Track RSVPs — master spreadsheet",
        lane: "todo",
        priority: "p1",
        tags: ["guests"],
      },
      {
        title: "Final menu tasting + headcount to caterer",
        lane: "todo",
        priority: "p1",
        tags: ["catering"],
      },
      {
        title: "Seating chart v1 — assume 10% RSVP shifts",
        lane: "todo",
        priority: "p2",
        tags: ["guests"],
      },
      {
        title: "Vows — first draft",
        lane: "todo",
        priority: "p1",
        tags: ["ceremony"],
      },
      {
        title: "Final dress / suit fitting",
        lane: "todo",
        priority: "p1",
        tags: ["attire"],
      },
      {
        title: "Marriage license — file 30 days out",
        lane: "todo",
        priority: "p0",
        tags: ["legal"],
      },
      {
        title: "Confirm ceremony order with officiant",
        lane: "todo",
        priority: "p2",
        tags: ["ceremony"],
      },
      {
        title: "Welcome bag contents + assembly",
        lane: "todo",
        priority: "p3",
        tags: ["favors"],
      },
    ],
  },
  {
    id: "wedding-day-of-run-of-show",
    name: "Day-of run-of-show",
    description:
      "Vendor arrivals, ceremony, reception — minute-by-minute, nothing forgotten.",
    icon: "💍",
    domain: "wedding",
    tasks: [
      {
        title: "8:00 AM — hair & makeup arrives",
        lane: "todo",
        priority: "p1",
        tags: ["bride"],
      },
      {
        title: "10:00 AM — florals delivered",
        lane: "todo",
        priority: "p1",
        tags: ["vendors"],
      },
      {
        title: "11:00 AM — photographer first looks",
        lane: "todo",
        priority: "p1",
        tags: ["photo"],
      },
      {
        title: "1:00 PM — venue setup walkthrough",
        lane: "todo",
        priority: "p1",
        tags: ["venue"],
      },
      {
        title: "2:30 PM — guests arrive · pre-ceremony drinks",
        lane: "todo",
        priority: "p2",
        tags: ["guests"],
      },
      {
        title: "3:00 PM — ceremony",
        lane: "todo",
        priority: "p0",
        tags: ["ceremony"],
      },
      {
        title: "3:45 PM — cocktail hour + family photos",
        lane: "todo",
        priority: "p1",
        tags: ["photo"],
      },
      {
        title: "5:00 PM — reception dinner",
        lane: "todo",
        priority: "p1",
        tags: ["reception"],
      },
      {
        title: "7:00 PM — toasts + first dance",
        lane: "todo",
        priority: "p1",
        tags: ["reception"],
      },
      {
        title: "11:00 PM — sparkler send-off + getaway car",
        lane: "todo",
        priority: "p2",
        tags: ["reception"],
      },
    ],
  },

  // ─── Student ───────────────────────────────────────────────────────
  {
    id: "final-paper-sprint",
    name: "Final paper sprint",
    description:
      "Research, outline, draft, edit, submit — without the 4am panic.",
    icon: "🎓",
    domain: "student",
    tasks: [
      {
        title: "Pick thesis + nail the argument in one sentence",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["thesis"],
      },
      {
        title: "Gather 8 sources — primary and secondary",
        lane: "todo",
        priority: "p1",
        due: "Tomorrow",
        tags: ["research"],
      },
      {
        title: "Outline — section headings + topic sentences",
        lane: "todo",
        priority: "p1",
        due: "Wed",
        tags: ["outline"],
      },
      {
        title: "First draft — quantity over quality",
        lane: "todo",
        priority: "p1",
        due: "Fri",
        tags: ["writing"],
      },
      {
        title: "Office hours — sanity-check the argument",
        lane: "todo",
        priority: "p2",
        tags: ["meeting"],
      },
      {
        title: "Edit pass 1 — structure + flow",
        lane: "todo",
        priority: "p1",
        tags: ["editing"],
      },
      {
        title: "Edit pass 2 — sentence-level + citations",
        lane: "todo",
        priority: "p2",
        tags: ["editing"],
      },
      {
        title: "Format + submit",
        lane: "todo",
        priority: "p0",
        due: "Mon",
        tags: ["submit"],
      },
    ],
  },
  {
    id: "midterm-week",
    name: "Midterm week",
    description:
      "Review, practice problems, sleep. Pick all three.",
    icon: "🎓",
    domain: "student",
    tasks: [
      {
        title: "Build a 1-page review sheet for each class",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["review"],
      },
      {
        title: "Re-do every practice problem from class 1",
        lane: "todo",
        priority: "p1",
        tags: ["practice"],
      },
      {
        title: "Re-do every practice problem from class 2",
        lane: "todo",
        priority: "p1",
        tags: ["practice"],
      },
      {
        title: "Form study group — 2 hours, no phones",
        lane: "todo",
        priority: "p2",
        due: "Wed",
        tags: ["group"],
      },
      {
        title: "Office hours — bring 3 specific questions",
        lane: "todo",
        priority: "p2",
        tags: ["meeting"],
      },
      {
        title: "Sleep 8 hours the night before — non-negotiable",
        lane: "todo",
        priority: "p1",
        tags: ["health"],
      },
      {
        title: "Eat breakfast morning of",
        lane: "todo",
        priority: "p2",
        tags: ["health"],
      },
    ],
  },

  // ─── Freelance ─────────────────────────────────────────────────────
  {
    id: "new-client-onboarding",
    name: "New client onboarding",
    description:
      "Kickoff doc, contract, payment terms, first invoice. Start clean, sleep easy.",
    icon: "💼",
    domain: "freelance",
    tasks: [
      {
        title: "Kickoff doc — goals, scope, success metrics",
        lane: "doing",
        priority: "p1",
        due: "Today",
        tags: ["kickoff"],
      },
      {
        title: "Send contract + MSA for signature",
        lane: "todo",
        priority: "p0",
        due: "Tomorrow",
        tags: ["legal"],
      },
      {
        title: "Set up payment terms — Net 14, deposit upfront",
        lane: "todo",
        priority: "p1",
        tags: ["billing"],
      },
      {
        title: "Spin up shared workspace + repo access",
        lane: "todo",
        priority: "p2",
        tags: ["setup"],
      },
      {
        title: "Add to Slack / Linear / Figma — name the channels",
        lane: "todo",
        priority: "p2",
        tags: ["setup"],
      },
      {
        title: "Send first invoice — deposit",
        lane: "todo",
        priority: "p1",
        due: "Fri",
        tags: ["billing"],
      },
      {
        title: "Schedule weekly check-in",
        lane: "todo",
        priority: "p2",
        tags: ["meeting"],
      },
    ],
  },
  {
    id: "tax-season",
    name: "Tax season",
    description:
      "1099s, expenses, S-corp filings. Dread it less, finish it sooner.",
    icon: "📦",
    domain: "freelance",
    tasks: [
      {
        title: "Collect all 1099s from clients",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["income"],
      },
      {
        title: "Categorize Q1–Q4 expenses",
        lane: "todo",
        priority: "p1",
        tags: ["expenses"],
      },
      {
        title: "Reconcile Stripe + Mercury — match books to bank",
        lane: "todo",
        priority: "p1",
        tags: ["accounting"],
      },
      {
        title: "S-corp filing — Form 1120-S",
        lane: "todo",
        priority: "p0",
        tags: ["filing"],
      },
      {
        title: "Personal return draft — talk to CPA",
        lane: "todo",
        priority: "p1",
        tags: ["filing"],
      },
      {
        title: "Estimated taxes — Q1 next year",
        lane: "todo",
        priority: "p2",
        tags: ["filing"],
      },
      {
        title: "Stash receipts in one folder for next year",
        lane: "todo",
        priority: "p3",
        tags: ["future-me"],
      },
    ],
  },

  // ─── Marketing ─────────────────────────────────────────────────────
  {
    id: "product-launch",
    name: "Product launch",
    description:
      "Positioning, landing, email blast, post-mortem — ship the story, not just the feature.",
    icon: "🎯",
    domain: "marketing",
    tasks: [
      {
        title: "Positioning doc — who, why, what changes",
        lane: "doing",
        priority: "p0",
        due: "Today",
        tags: ["positioning"],
      },
      {
        title: "Landing page copy + design",
        lane: "todo",
        priority: "p1",
        due: "Wed",
        tags: ["landing"],
      },
      {
        title: "Hero video / motion graphic",
        lane: "todo",
        priority: "p1",
        tags: ["assets"],
      },
      {
        title: "Email blast — segmented for warm + cold",
        lane: "todo",
        priority: "p1",
        due: "Thu",
        tags: ["lifecycle"],
      },
      {
        title: "Social — Twitter thread + LinkedIn post",
        lane: "todo",
        priority: "p2",
        tags: ["social"],
      },
      {
        title: "Press / influencer outreach — 5 targets",
        lane: "todo",
        priority: "p2",
        tags: ["pr"],
      },
      {
        title: "Launch day war room — 9am to 6pm",
        lane: "todo",
        priority: "p0",
        due: "Mon",
        tags: ["launch"],
      },
      {
        title: "Post-mortem — what worked, what didn't, what next",
        lane: "todo",
        priority: "p2",
        tags: ["retro"],
      },
    ],
  },
  {
    id: "conference-booth-prep",
    name: "Conference booth prep",
    description:
      "Booth, swag, demo flow, lead capture. Show up looking like you meant to.",
    icon: "🎯",
    domain: "marketing",
    tasks: [
      {
        title: "Confirm booth size + electrical + Wi-Fi",
        lane: "doing",
        priority: "p1",
        due: "Today",
        tags: ["logistics"],
      },
      {
        title: "Booth signage — print 4 weeks out",
        lane: "todo",
        priority: "p1",
        tags: ["assets"],
      },
      {
        title: "Demo flow — 90-second hook + 3-min deep-dive",
        lane: "todo",
        priority: "p1",
        tags: ["demo"],
      },
      {
        title: "Order swag — stickers, tees, one premium item",
        lane: "todo",
        priority: "p2",
        tags: ["swag"],
      },
      {
        title: "Lead capture flow — QR + CRM tag",
        lane: "todo",
        priority: "p1",
        tags: ["leads"],
      },
      {
        title: "Schedule booth shifts — 2 people, never solo",
        lane: "todo",
        priority: "p2",
        tags: ["staffing"],
      },
      {
        title: "Travel + hotel for the team",
        lane: "todo",
        priority: "p2",
        tags: ["travel"],
      },
      {
        title: "Post-show follow-up — within 48h",
        lane: "todo",
        priority: "p1",
        tags: ["follow-up"],
      },
    ],
  },
];

/** O(1) lookup. Throws if the id is unknown — server action validates
 *  before invoking, so a thrown error is a programmer bug, not user
 *  input we need to gracefully handle. */
export function getTemplate(id: string): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template id: ${id}`);
  return t;
}
