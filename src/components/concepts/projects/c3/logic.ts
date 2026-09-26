import { EDGE_PROJECTS, ME, PEOPLE, PROJECTS, STATUS_LABEL, type Lane, type Project, type Signal, type Status } from "./data";

export type Scenario = "default" | "edge" | "calm" | "checked" | "wrapped";

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "default", label: "This week" },
  { id: "edge", label: "New and unowned" },
  { id: "calm", label: "Nothing needs you" },
  { id: "checked", label: "Already checked in" },
  { id: "wrapped", label: "All wrapped" },
];

/** Per-project client state: what the viewer has done to it this session. */
export type PState = {
  resolved: string[];
  snoozed: string[];
  nudged: string[];
  done: string[];
  override?: { lane: Lane; reason: string };
};

export const EMPTY: PState = { resolved: [], snoozed: [], nudged: [], done: [] };

export type Answer = { status: Status; line: string };

export function buildProjects(scenario: Scenario): Project[] {
  if (scenario === "edge") return [...EDGE_PROJECTS.slice(0, 1), ...PROJECTS, ...EDGE_PROJECTS.slice(1)];
  if (scenario === "calm") {
    return PROJECTS.map((p) => {
      if (p.id === "mara-finn")
        return { ...p, signals: [], actions: [], calm: "Seating plan approved and the bar order is in. 8 days to go." };
      if (p.id === "barn-roof")
        return { ...p, signals: [], actions: [], calm: "Declan confirmed heating by 6 Nov, a week clear of the Kavanagh 40th." };
      return p;
    });
  }
  if (scenario === "wrapped") {
    return PROJECTS.map((p) =>
      p.wrapped ? p : { ...p, signals: [], actions: [], wrapped: { on: wrapDate(p), note: WRAP_NOTES[p.id] ?? p.calm }, done: p.total },
    );
  }
  return PROJECTS;
}

const WRAP_NOTES: Record<string, string> = {
  "mara-finn": "142 guests, one rain shower, no speeches over time.",
  "barn-roof": "Signed off by Declan. Heating runs on the new timer.",
  "winter-launch": "Brochure printed and the new photos are on the site.",
  markets: "All 14 stalls paid. Layout notes saved for next year.",
  "science-fair": "31 projects, three prizes. Ciara has the photos.",
  harvest: "Sold out. The pairing notes are in Files.",
  kavanagh: "Ran to time. The family left a review.",
  "ada-theo": "Everything ran to plan. The couple sent flowers.",
  northside: "New sign is up and the brand kit is in Files.",
};

function wrapDate(p: Project) {
  const map: Record<string, string> = {
    "mara-finn": "Sat 19 Sep",
    "barn-roof": "Fri 18 Sep",
    "winter-launch": "Thu 17 Sep",
    markets: "Tue 15 Sep",
    "science-fair": "Fri 11 Sep",
    harvest: "Sat 12 Sep",
    kavanagh: "Sat 5 Sep",
    "ada-theo": "Fri 4 Sep",
    northside: "Thu 3 Sep",
  };
  return map[p.id] ?? p.date;
}

export function openSignals(p: Project, st: PState): Signal[] {
  return p.signals.filter((sig) => !st.resolved.includes(sig.id) && !st.snoozed.includes(sig.id));
}

export function inferredLane(p: Project, st: PState): Lane {
  if (p.wrapped) return "wrapped";
  const open = openSignals(p, st);
  if (open.some((x) => x.weight === "needs")) return "needs";
  if (open.some((x) => x.weight === "watch")) return "watch";
  return "smooth";
}

const LANE_RANK: Record<Lane, number> = { smooth: 0, watch: 1, needs: 2, wrapped: -1 };

/** The lane your own answer asks for: off track needs you, at risk stays in view, on track leaves it to the signals. */
function answerFloor(answer?: Answer): Lane | null {
  if (!answer) return null;
  return answer.status === "off" ? "needs" : answer.status === "risk" ? "watch" : null;
}

/**
 * Where a project sits: a manual move wins, then the worse of what the signals
 * say and what you said in this week's check-in.
 */
export function laneOf(p: Project, st: PState, answer?: Answer): Lane {
  if (p.wrapped) return "wrapped";
  if (st.override) return st.override.lane;
  const base = inferredLane(p, st);
  const floor = answerFloor(answer);
  return floor && LANE_RANK[floor] > LANE_RANK[base] ? floor : base;
}

/** True when your answer, not the signals, put the project in its lane. */
export function answerDrove(p: Project, st: PState, answer?: Answer): boolean {
  if (!answer || st.override || p.wrapped) return false;
  return laneOf(p, st, answer) !== inferredLane(p, st);
}

export function reasonOf(p: Project, st: PState): { lead: string; also: string | null } {
  const open = openSignals(p, st).filter((x) => x.weight !== "fine");
  if (open.length === 0) return { lead: p.calm, also: null };
  const lead = open[0].sentence;
  const also = open[1] ? `Also: ${lowerFirst(open[1].sentence)}` : null;
  return { lead, also };
}

function lowerFirst(t: string) {
  return /^[A-Z][a-z]/.test(t) && !/^(Aoife|Niamh|Sam|Declan|Ciara|Tomás|Orla)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

export function whoLabel(id: string) {
  return id === ME ? "You" : PEOPLE[id]?.first ?? id;
}

/** One sentence that explains why the card sits in its lane. */
export function placement(p: Project, st: PState, lane: Lane, answer?: Answer): string {
  if (st.override) return `You moved this here: ${st.override.reason.replace(/\.$/, "")}.`;
  if (answerDrove(p, st, answer) && answer) {
    return lane === "needs"
      ? `You said ${STATUS_LABEL[answer.status].toLowerCase()} today, so it needs you until the next check-in.`
      : `You said ${STATUS_LABEL[answer.status].toLowerCase()} today, so it stays in view until the next check-in.`;
  }
  if (p.isNew) return "Too new to read. Once a few tasks move, it will find its own lane.";
  const open = openSignals(p, st).filter((x) => x.weight !== "fine");
  if (answer?.status === "on" && open.length) {
    return `You said on track today; ${open.length === 1 ? "1 signal is" : `${open.length} signals are`} still open.`;
  }
  if (lane === "needs") {
    const n = open.filter((x) => x.weight === "needs").length;
    return n === 1
      ? "One signal needs a decision or a push from you."
      : `${n} signals need a decision or a push from you.`;
  }
  if (lane === "watch") {
    const owner = p.owner ? whoLabel(p.owner) : "No one";
    return `${owner === "You" ? "You are" : `${owner} is`} on it, but it could slip without a look.`;
  }
  return "No open signals, and the owner's latest status agrees.";
}

export function declaredLine(p: Project, lane: Lane, answer?: Answer): string | null {
  if (answer) return `You said ${STATUS_LABEL[answer.status].toLowerCase()} today.`;
  if (!p.declared) return null;
  const who = p.declared.by === ME ? "You" : PEOPLE[p.declared.by].first;
  const base = `${who} said ${STATUS_LABEL[p.declared.status].toLowerCase()} on ${p.declared.when}.`;
  if (p.declared.status === "on" && lane === "needs") return `${base} Newer signals disagree.`;
  return base;
}

export function laneCountsSentence(counts: Record<Lane, number>): string {
  const parts: string[] = [];
  parts.push(counts.needs === 0 ? "Nothing needs you" : `${counts.needs} ${counts.needs === 1 ? "needs" : "need"} you`);
  if (counts.watch) parts.push(`${counts.watch} to keep an eye on`);
  if (counts.smooth) parts.push(`${counts.smooth} running smoothly`);
  if (parts.length === 1 && counts.needs === 0 && counts.wrapped) return "Every project is wrapped";
  return parts.join(", ");
}

/**
 * The line the check-in writes for you, matched to the status you picked, so
 * an On track answer never carries an at-risk sentence. The signal-backed line
 * comes from the data; these are the honest alternatives for the other two.
 */
const ALT_LINES: Record<string, Partial<Record<Status, string>>> = {
  "mara-finn": {
    on: "Seating plan approved and Sam has the tonic order in hand. 8 days to go.",
    off: "Bar order still missing with 8 days left. Ordering it myself today.",
  },
  "barn-roof": {
    on: "Roof slipped, but Declan still has heating in before the Kavanagh 40th.",
    risk: "Roof slipped two weeks. Heating is tight against the Kavanagh 40th; asking Declan for 6 Nov.",
  },
  "winter-launch": {
    on: "Photos re-shoot booked for Monday and a writer is lined up for the brochure.",
    risk: "Photos short and brochure copy not started. Print on 9 Oct is tight.",
  },
  markets: {
    on: "Stallholders are signing up. Deposits due Thursday.",
    off: "Only 6 of 14 stalls signed. Moving the deposit date and asking Niamh for a new plan.",
  },
  "science-fair": {
    on: "Quiet, but Ciara says the projects are coming along. Hall booking next.",
    off: "Hall still unbooked with 8 weeks to go. Needs a date this week.",
  },
  harvest: {
    risk: "Two seats left and the pairing tasting isn't booked yet.",
    off: "Menu not locked. Needs a decision before tickets go out.",
  },
  kavanagh: {
    risk: "Invites are ready, but the barn heating date could clash.",
    off: "Barn heating lands too close. Looking at the old hall as a backup.",
  },
  "ada-theo": {
    risk: "Walkthrough done, but save-the-dates are waiting on Ada's design.",
    off: "Save-the-dates are late. Needs a new date from the couple.",
  },
  northside: {
    risk: "Sign-maker booked, but the menu proofs aren't back yet.",
    off: "Menus missed the printer. Needs a new print date.",
  },
  brunch: {
    on: "Menu pricing under way. Bookings open 5 Oct.",
    off: "No owner and no menu. The first date needs to move.",
  },
  "staff-party": {
    risk: "Date picked, but most venues are already booked for December.",
    off: "Too late for our first-choice venue. Needs a new plan.",
  },
};

const FALLBACK_LINE: Record<Status, string> = {
  on: "Moving as planned.",
  risk: "Could slip without a push this week.",
  off: "Needs a new plan or a new date.",
};

export function suggestFor(p: Project, status: Status): string {
  if (p.suggestion.status === status && p.suggestion.line) return p.suggestion.line;
  return ALT_LINES[p.id]?.[status] ?? FALLBACK_LINE[status];
}
