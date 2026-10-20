/**
 * Home fixtures: plain inputs for `buildHomeBento`, shared by the unit tests
 * and the browser check (`experience/home-overview/home.mjs`). Not shipped:
 * no route imports this file.
 *
 *   busy      three launches (the first on track, a sooner one behind), a year of work
 *   behind    the lead launch is behind plan
 *   monday    Monday morning, nothing finished yet this week
 *   none      no Projects at all
 *   notarget  Projects, but none with a target date
 *   unread    the finish history could not be read
 *   chatoff   Chat is not switched on for this reader
 */

import type { HomeBentoInput, HomeLaunchFact } from "@/lib/home/home-bento";

export type HomeBentoFixtureState = "busy" | "behind" | "monday" | "none" | "notarget" | "unread" | "chatoff";

const DAY = 86_400_000;
/** Tuesday 20 October 2026, 21:40 in Dublin. */
export const FIXTURE_NOW = Date.parse("2026-10-20T20:40:00Z");
const MONDAY_NOW = Date.parse("2026-10-19T07:30:00Z");

const at = (iso: string, hour = 11) => Date.parse(`${iso}T${String(hour).padStart(2, "0")}:00:00Z`);

/** A year of finishes: quieter long ago, steady lately, light at weekends. Seeded, so stable. */
function year(now: number): number[] {
  const anchor = FIXTURE_NOW;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const out: number[] = [];
  for (let d = 380; d >= 8; d--) {
    const day = anchor - d * DAY;
    const recent = d < 120 ? 1 : d < 220 ? 0.6 : 0.25;
    const weekend = new Date(day).getUTCDay() % 6 === 0 ? 0.3 : 1;
    const n = rnd() < 0.25 + recent * 0.5 ? Math.round(rnd() * 7 * recent * weekend) : 0;
    for (let i = 0; i < n; i++) out.push(day - Math.floor(rnd() * 9) * 3_600_000);
  }
  // Last week (Mon 12 – Sun 18 Oct): 2, 2, 1, 0, 1, 0, 0. This week so far: 5 and 4.
  const fixed: [string, number][] = [["2026-10-12", 2], ["2026-10-13", 2], ["2026-10-14", 1], ["2026-10-16", 1], ["2026-10-19", 5], ["2026-10-20", 4], ["2026-09-30", 14]];
  const days = new Set(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-09-30"]);
  const kept = out.filter((ms) => !days.has(new Date(ms).toISOString().slice(0, 10)));
  for (const [iso, n] of fixed) for (let i = 0; i < n; i++) kept.push(at(iso, 9 + i));
  return kept.filter((ms) => ms <= now);
}

function finishes(start: string, dates: readonly string[]): number[] {
  return dates.map((iso) => at(iso)).filter((ms) => ms >= at(start, 0));
}

const LAUNCHES: readonly HomeLaunchFact[] = [
  {
    id: "p-ping",
    name: "Ping Private Release",
    href: "/app/timeline?workspaceId=p-ping&open=project",
    tasksHref: "/app/tasks?workspaceId=p-ping",
    start: "2026-09-07",
    target: "2026-11-20",
    total: 22,
    complete: 14,
    completions: finishes("2026-09-07", ["2026-09-10", "2026-09-12", "2026-09-17", "2026-09-19", "2026-09-25", "2026-10-01", "2026-10-02", "2026-10-06", "2026-10-09", "2026-10-13", "2026-10-15", "2026-10-19", "2026-10-19", "2026-10-20"]),
    milestones: [
      { title: "Scope", date: "2026-09-18", done: true },
      { title: "Build", date: "2026-10-16", done: true },
      { title: "QA", date: "2026-11-06", done: false },
      { title: "Launch", date: "2026-11-20", done: false },
    ],
    dueThisWeek: 2,
  },
  {
    id: "p-menu",
    name: "Autumn menu launch",
    href: "/app/timeline?workspaceId=p-menu&open=project",
    tasksHref: "/app/tasks?workspaceId=p-menu",
    start: "2026-09-21",
    target: "2026-11-06",
    total: 11,
    complete: 5,
    completions: finishes("2026-09-21", ["2026-09-24", "2026-09-27", "2026-10-03", "2026-10-09", "2026-10-15"]),
    milestones: [
      { title: "Menu set", date: "2026-10-02", done: true },
      { title: "Tasting", date: "2026-10-22", done: false },
      { title: "Photos", date: "2026-10-29", done: false },
      { title: "Launch", date: "2026-11-06", done: false },
    ],
    dueThisWeek: 3,
  },
  {
    id: "p-web",
    name: "Website refresh",
    href: "/app/timeline?workspaceId=p-web&open=project",
    tasksHref: "/app/tasks?workspaceId=p-web",
    start: "2026-09-28",
    target: "2026-12-15",
    total: 9,
    complete: 3,
    completions: finishes("2026-09-28", ["2026-10-02", "2026-10-09", "2026-10-16"]),
    milestones: [
      { title: "Brief", date: "2026-10-05", done: true },
      { title: "Design", date: "2026-11-03", done: false },
    ],
    dueThisWeek: 1,
  },
];

export function homeBentoFixture(state: HomeBentoFixtureState = "busy"): HomeBentoInput {
  const now = state === "monday" ? MONDAY_NOW : FIXTURE_NOW;
  const base: HomeBentoInput = {
    now,
    timeZone: "Europe/Dublin",
    firstName: "Orla",
    hasProjects: true,
    launches: LAUNCHES,
    completions: year(now),
    // 2 + 3 + 1 on the launches, and 2 more in Projects with no target date.
    dueThisWeek: 8,
    openTasks: 30,
    activeProjects: 5,
    finishedProjects: 1,
    filesThisMonth: 24,
    messages: { available: true, unread: 4, conversations: 2 },
  };
  switch (state) {
    case "behind":
      return { ...base, launches: [{ ...LAUNCHES[0]!, complete: 9, completions: LAUNCHES[0]!.completions.slice(0, 9) }, LAUNCHES[2]!] };
    case "monday":
      return { ...base, completions: base.completions!.filter((ms) => ms < Date.parse("2026-10-19T00:00:00Z")) };
    case "none":
      return { ...base, hasProjects: false, launches: [], completions: [], dueThisWeek: 0, openTasks: 0, activeProjects: 0, finishedProjects: 0, filesThisMonth: 0, messages: { available: true, unread: 0, conversations: 0 } };
    case "notarget":
      return { ...base, launches: [] };
    case "unread":
      return { ...base, completions: null, dueThisWeek: null, filesThisMonth: null };
    case "chatoff":
      return { ...base, messages: { available: false, unread: 0, conversations: 0 } };
    default:
      return base;
  }
}
