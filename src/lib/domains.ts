import type { LaneId, Priority, Task, UserId } from "@/lib/data";
import { TASKS_DOMAIN } from "@/lib/product-urls";

export type DomainId =
  | "marketing"
  | "student"
  | "freelance"
  | "wedding"
  | "trades";

/**
 * Per-domain overlay applied to the canonical 16-task seed structure.
 * The cinematic demo's scripted scenes (carry t-101 → doing,
 * comment on t-202, etc.) operate by task ID, so every domain MUST
 * keep IDs t-101..t-404 with identical lane assignments and timeline
 * geometry. Only the user-facing flavor swaps.
 */
export type DomainPack = {
  id: DomainId;
  label: string;
  /** Tiny tagline shown next to label in toggle. */
  description: string;
  /** Replaces "Q3 Launch · Plays in motion" in demo subheader. */
  workspaceTitle: string;
  /** Replaces "Team › Marketing" crumb in demo subheader. */
  workspaceCrumb: string;
  /** Replaces tasks.signalstudio.ie/team/marketing in demo browser-chrome. */
  workspaceUrl: string;
  /** Single comment posted by the autonomous demo's typing scene. */
  demoCommentText: string;
  /** Empty-state copy used across app views. */
  emptyStateHeadline: string;
  emptyStateBody: string;
  /** Sample first-task placeholder for empty-state CTA inputs. */
  firstTaskExample: string;
  /** Per-task overlays keyed by canonical task id. */
  tasks: Record<
    string,
    Pick<Task, "title"> & Partial<Pick<Task, "tags">>
  >;
  /** Optional per-domain dependency graph. Replaces canonical
   *  `blockedBy` for the listed task ids. The freelance dev domain
   *  uses this to surface engineering-flavored blocker chains
   *  ("Stripe webhook fix" can't ship until "Auth rebuild" is done);
   *  other domains inherit the canonical structure. */
  blockedBy?: Record<string, string[]>;
  /** Three-line seed for any per-task comment threads. */
  commentBodies: string[];
};

export const DOMAINS: Record<DomainId, DomainPack> = {
  marketing: {
    id: "marketing",
    label: "Marketing",
    description: "launch plays · campaigns · analytics",
    workspaceTitle: "Q3 Launch · Plays in motion",
    workspaceCrumb: "Marketing",
    workspaceUrl: `${TASKS_DOMAIN}/team/marketing`,
    demoCommentText: "Hero animation looks great, shipping today.",
    emptyStateHeadline: "This is where your launch plan goes.",
    emptyStateBody:
      "Plot the campaign. Drop in the deliverables. Watch them ship.",
    firstTaskExample: "Audit pricing page funnel by Friday",
    tasks: {
      "t-101": {
        title: "Audit pricing page conversion funnel",
        tags: ["growth"],
      },
      "t-102": { title: "Review beta feedback themes", tags: ["research"] },
      "t-103": { title: "Plan the next quarter · pick three priorities", tags: ["planning"] },
      "t-104": {
        title: "Refresh component color tokens",
        tags: ["design-system"],
      },
      "t-105": {
        title: "Customer success · quarterly stories",
        tags: ["marketing"],
      },
      "t-201": { title: "Sales demo sync", tags: ["meeting"] },
      "t-202": {
        title: "Launch demo video, final cut",
        tags: ["launch"],
      },
      "t-203": {
        title: "Headcount planning · engineering",
        tags: ["ops"],
      },
      "t-204": { title: "Engineering sync · roadmap", tags: ["meeting"] },
      "t-301": { title: "Weekly sales status report", tags: ["report"] },
      "t-302": {
        title: "Marketing campaign · banner set",
        tags: ["marketing"],
      },
      "t-303": {
        title: "Latest features · customer email",
        tags: ["lifecycle"],
      },
      "t-401": { title: "Project onboarding deck", tags: ["onboarding"] },
      "t-402": { title: "Finalize launch timeline", tags: ["launch"] },
      "t-403": { title: "All-hands alignment", tags: ["meeting"] },
      "t-404": { title: "Press release · draft v2", tags: ["pr"] },
    },
    commentBodies: [
      "Hero animation looks great in the latest cut.",
      "Pinged finance, they'll review by EOW.",
      "Bumped this to P1 after the demo sync. Keep moving.",
      "Linking the brief, let me know if anything's unclear.",
      "Marketing has the assets. We just need the copy review.",
      "Spec is locked, building now. ETA Tuesday.",
      "Two design tweaks left, then ready for review.",
    ],
  },

  student: {
    id: "student",
    label: "College student",
    description: "papers · midterms · group projects",
    workspaceTitle: "Spring semester · Junior year",
    workspaceCrumb: "School",
    workspaceUrl: `${TASKS_DOMAIN}/me/school`,
    demoCommentText: "Group's meeting at the library tonight at 7.",
    emptyStateHeadline: "This is where your semester comes together.",
    emptyStateBody:
      "Drop in papers, midterms, group projects. Stop forgetting things at 2am.",
    firstTaskExample: "Submit thesis proposal by next Friday",
    tasks: {
      "t-101": { title: "Submit thesis proposal", tags: ["thesis"] },
      "t-102": {
        title: "Read 3 papers for econ seminar",
        tags: ["reading"],
      },
      "t-103": {
        title: "Plan study group · midterms week",
        tags: ["midterms"],
      },
      "t-104": { title: "Update notes from CS lecture", tags: ["notes"] },
      "t-105": { title: "Apply for summer internship", tags: ["career"] },
      "t-201": { title: "Office hours · Prof Liu", tags: ["meeting"] },
      "t-202": { title: "Final paper · history of art", tags: ["essay"] },
      "t-203": { title: "Lab report · organic chem", tags: ["lab"] },
      "t-204": {
        title: "Group project sync · ethics class",
        tags: ["group"],
      },
      "t-301": { title: "Calc problem set #7", tags: ["pset"] },
      "t-302": {
        title: "Resume for spring career fair",
        tags: ["career"],
      },
      "t-303": {
        title: "Email professor about extension",
        tags: ["email"],
      },
      "t-401": { title: "Buy textbooks for spring", tags: ["shopping"] },
      "t-402": {
        title: "Register for spring semester",
        tags: ["admin"],
      },
      "t-403": { title: "Club president meeting", tags: ["club"] },
      "t-404": { title: "Submit financial aid forms", tags: ["admin"] },
    },
    commentBodies: [
      "Got the syllabus, pacing is brutal week 6.",
      "Library quiet floor reserved Wed 6–10pm.",
      "Pushing this back. Midterms first.",
      "Asked the TA, extension might be possible.",
      "Found a study guide from last semester. Sharing now.",
      "Group's meeting Sunday at the union.",
      "Just turned this in. Took forever.",
    ],
  },

  freelance: {
    id: "freelance",
    label: "Freelance",
    description: "brief · edit · deliver · invoice",
    workspaceTitle: "Q2 client work · Solo studio",
    workspaceCrumb: "Studio",
    workspaceUrl: `${TASKS_DOMAIN}/me/studio`,
    demoCommentText:
      "Final delivery sent · Coombe wedding gallery, invoice closed Friday.",
    emptyStateHeadline: "This is where the client work actually ships.",
    emptyStateBody:
      "Briefs, edit rounds, deliveries, invoices. Three clients, one inbox, no notebook scattered around the desk.",
    firstTaskExample: "Send Bregman wedding gallery by Friday at 3pm",
    tasks: {
      "t-101": {
        title: "Edit round 2 · Bregman wedding gallery",
        tags: ["review"],
      },
      "t-102": {
        title: "Brief review · Foley + Strand autumn campaign",
        tags: ["brief"],
      },
      "t-103": {
        title: "Q2 invoices · Stripe + Mercury reconcile",
        tags: ["billing"],
      },
      "t-104": {
        title: "Final delivery · Coombe wedding via Pixieset",
        tags: ["delivery"],
      },
      "t-105": {
        title: "Mossfield rebrand kickoff · voice and tone doc",
        tags: ["kickoff"],
      },
      "t-201": {
        title: "Discovery call · Bregman Studios brand work",
        tags: ["call"],
      },
      "t-202": {
        title: "Mood board v1 · Bregman editorial shoot",
        tags: ["client"],
      },
      "t-203": {
        title: "Image cull · Coombe wedding · 487 frames",
        tags: ["process"],
      },
      "t-204": {
        title: "Edit notes · Foley round 1 review",
        tags: ["review"],
      },
      "t-301": {
        title: "Stock licensing · refresh expiring Adobe images",
        tags: ["admin"],
      },
      "t-302": {
        title: "Rewrite NorthLight Studio landing copy",
        tags: ["client"],
      },
      "t-303": {
        title: "Send MSA · Mossfield rebrand",
        tags: ["proposal"],
      },
      "t-401": { title: "1099s + sole-trader tax prep", tags: ["admin"] },
      "t-402": {
        title: "Renew Cloudinary + Pixieset annual",
        tags: ["admin"],
      },
      "t-403": {
        title: "Coffee with Niamh · Bregman Studios",
        tags: ["network"],
      },
      "t-404": {
        title: "MSA template · Foley solicitor review",
        tags: ["legal"],
      },
    },
    /**
     * The freelance domain's signature: a real dependency graph. Three
     * chains visible on the board:
     *   - t-201 (Discovery) → t-202 (Mood board) → t-101 (Edit round)
     *     "no mood board until they tell you what they want"
     *   - t-203 (Image cull) → t-104 (Final delivery)
     *     "can't deliver a gallery you haven't culled yet"
     *   - t-303 (MSA sent) → t-105 (Mossfield kickoff)
     *     "kickoff blocked on contract signature"
     */
    blockedBy: {
      "t-202": ["t-201"],
      "t-101": ["t-202"],
      "t-104": ["t-203"],
      "t-105": ["t-303"],
    },
    commentBodies: [
      "Loved the moody set, can we get one more with the bridesmaids?",
      "Copy reads great. One change: 'studio' appears twice in para 2, pick the stronger one.",
      "Final delivery sent · gallery passworded · receipt attached.",
      "Aoife's RSVP came in, full guest list updated.",
      "Light was perfect after 5pm, moving the second cull session to tonight.",
      "Niamh's brief locked. Mood board v2 going across Thursday.",
      "Mercury reconciled · Q2 invoices closed · numbers match.",
      "Pinned the new MSA, Foley's solicitor signed off.",
      "Brief attached. Flexible on the colour palette but the typeface is locked.",
    ],
  },

  trades: {
    id: "trades",
    label: "Trades",
    description: "calls · jobs · invoices · ladder back in the truck",
    workspaceTitle: "Wired Right · January route",
    workspaceCrumb: "Trades",
    workspaceUrl: `${TASKS_DOMAIN}/me/trades`,
    demoCommentText:
      "Panel upgrade priced, quote out to the Hartwells tonight.",
    emptyStateHeadline: "This is where the day's calls live.",
    emptyStateBody:
      "Service calls, quotes, materials, the invoice you keep meaning to send. One place.",
    firstTaskExample: "Replace breaker at 142 Maple by Thursday",
    tasks: {
      "t-101": {
        title: "Replace breaker · 142 Maple",
        tags: ["service"],
      },
      "t-102": {
        title: "Quote: Hartwell panel upgrade",
        tags: ["quote"],
      },
      "t-103": {
        title: "Order three 20A breakers + 200A main",
        tags: ["materials"],
      },
      "t-104": {
        title: "Permit pickup · town hall",
        tags: ["permits"],
      },
      "t-105": {
        title: "Invoice November service calls",
        tags: ["billing"],
      },
      "t-201": {
        title: "Walk Roy through the Tuesday route",
        tags: ["crew"],
      },
      "t-202": {
        title: "Rough-in: 38 Beechwood new build",
        tags: ["job"],
      },
      "t-203": {
        title: "Diagnose tripped GFCI · Sandoval kitchen",
        tags: ["service"],
      },
      "t-204": {
        title: "Crew sync · Friday morning",
        tags: ["meeting"],
      },
      "t-301": {
        title: "Final walk · Patel basement panel",
        tags: ["walkthrough"],
      },
      "t-302": {
        title: "Invoice · Patel basement",
        tags: ["billing"],
      },
      "t-303": {
        title: "Replace porch fixture · 19 Oak",
        tags: ["service"],
      },
      "t-401": { title: "QuickBooks · Q4 reconcile", tags: ["admin"] },
      "t-402": {
        title: "Renew master license · state board",
        tags: ["license"],
      },
      "t-403": {
        title: "Truck inspection + tag",
        tags: ["fleet"],
      },
      "t-404": {
        title: "Insurance certificate · 38 Beechwood",
        tags: ["insurance"],
      },
    },
    commentBodies: [
      "Panel was deeper than it looked, pulled an extra hour.",
      "Materials list updated. Pickup on the way in tomorrow.",
      "Sandoval rescheduled to next Tuesday morning.",
      "Roy's running the Beechwood rough-in solo today.",
      "Permit cleared. We can break ground Friday.",
      "Invoice sent. Net 14 from today.",
      "Truck back in the shop, alternator. Out of service Thursday.",
      "Hartwells signed off. Final walk Monday at 10.",
    ],
  },

  wedding: {
    id: "wedding",
    label: "Wedding planner",
    description: "venues · vendors · vows · run-of-show",
    workspaceTitle: "Hartwell Wedding · 6.14.26",
    workspaceCrumb: "Weddings",
    workspaceUrl: `hartwell-wedding`,
    demoCommentText: "Florals confirmed, peonies and garden roses.",
    emptyStateHeadline: "This is where the day comes together.",
    emptyStateBody:
      "Vendors, run-of-show, RSVPs, the small things. Every detail in one place, finally.",
    firstTaskExample: "Confirm catering tasting menu by Friday",
    tasks: {
      "t-101": {
        title: "Confirm catering tasting menu",
        tags: ["catering"],
      },
      "t-102": {
        title: "Send save-the-dates · 200 guests",
        tags: ["invites"],
      },
      "t-103": { title: "Final venue walkthrough", tags: ["venue"] },
      "t-104": { title: "Pick floral arrangements", tags: ["florals"] },
      "t-105": {
        title: "Book guest transport · welcome night",
        tags: ["logistics"],
      },
      "t-201": {
        title: "Vendor sync · photo + video",
        tags: ["vendors"],
      },
      "t-202": {
        title: "Day-of timeline · run-of-show",
        tags: ["planning"],
      },
      "t-203": {
        title: "Track RSVPs · master spreadsheet",
        tags: ["guests"],
      },
      "t-204": {
        title: "Bride's hair and nails trial",
        tags: ["bride"],
      },
      "t-301": {
        title: "DJ playlist final approval",
        tags: ["music"],
      },
      "t-302": {
        title: "Officiant ceremony script",
        tags: ["ceremony"],
      },
      "t-303": { title: "Welcome bag contents", tags: ["favors"] },
      "t-401": { title: "Venue contract signed", tags: ["contract"] },
      "t-402": { title: "Engagement shoot wrapped", tags: ["photo"] },
      "t-403": { title: "Tasting at Mariposa", tags: ["catering"] },
      "t-404": { title: "Marriage license filed", tags: ["legal"] },
    },
    commentBodies: [
      "Florals confirmed, peonies and garden roses.",
      "RSVPs at 89%, on pace.",
      "Mariposa locked in. Tasting was 10/10.",
      "DJ pulled the playlist together, sending now.",
      "Hair and nails booked for the morning of.",
      "Sent 4 vendor reminders this morning.",
      "Photographer wants a 30min walkthrough Thursday.",
      "Hartwells loved the welcome bag mockup.",
    ],
  },
};

/**
 * Public audience order, the homepage demo toggle and /about grid map
 * this. Only the four real Signal Tasks audiences (BRAND.md §3's
 * canonical example set: a wedding planner, a tradesperson, a
 * freelancer, a student) are presented. `marketing` is retained in
 * DOMAINS as the inert canonical seed-structure fallback for
 * domain-context and templates, but is never shown to a user, a
 * tech-company marketing board is the §2.2 vocabulary alienation this
 * product refuses to put in front of the 80%.
 */
export const DOMAIN_ORDER: DomainId[] = [
  "wedding",
  "trades",
  "freelance",
  "student",
];

/** Apply a domain pack overlay to the canonical seed task list.
 *  Mutates nothing; returns a fresh array with title+tags (and, when
 *  the pack defines them, blockedBy chains) swapped. */
export function applyDomainOverlay(
  seedTasks: Task[],
  domain: DomainId,
): Task[] {
  const pack = DOMAINS[domain];
  return seedTasks.map((t) => {
    const overlay = pack.tasks[t.id];
    const packBlockers = pack.blockedBy?.[t.id];
    if (!overlay && !packBlockers) return t;
    return {
      ...t,
      title: overlay?.title ?? t.title,
      tags: overlay?.tags ?? t.tags,
      blockedBy: packBlockers ?? t.blockedBy,
    };
  });
}

/** Build a fresh canonical seed pack with domain titles + tags applied. */
export function buildDomainSeed(
  domain: DomainId,
  canonical: Task[],
): Task[] {
  return applyDomainOverlay(canonical, domain).map((t) => ({ ...t }));
}

/** Truncate a string for activity-feed-style chips. */
export function shorten(s: string, n = 24): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

/** Dummy reference so unused-warnings stay clean if a caller drops the
 *  param and only uses the lookup table directly. */
export const _DOMAIN_TYPE_GUARD: Record<DomainId, true> = {
  marketing: true,
  student: true,
  freelance: true,
  wedding: true,
  trades: true,
};

export type _PriorityForReuse = Priority;
export type _UserIdForReuse = UserId;
export type _LaneIdForReuse = LaneId;
