/**
 * Signal's Home entry point — the narrow half of the module's public
 * surface, for the front door that reads the briefing without rendering
 * any of it.
 *
 * Why a second entry point exists. `index.ts` re-exports the three
 * briefing ROUTE components alongside the data surface Home consumes,
 * and a barrel is one module: importing `requireSignalUser` from it puts
 * those route components into /app/home's module graph, and every
 * `"use client"` boundary they reach becomes part of Home's chunk group.
 * The build was emitting a 9.7 KB gzip near-duplicate of the briefing
 * client tree for a page that renders none of it.
 *
 * This does not weaken the barrel's "use this barrel only" rule, which
 * exists to stop consumers reaching into module internals. Nothing here
 * is an internal path: this is a second DECLARED public surface, named
 * for its one consumer, and `index.ts` re-exports it verbatim so there
 * is exactly one definition of what Home is allowed to read. Internals
 * stay closed — a consumer that needs something not exported here still
 * has to widen the surface deliberately, in this file.
 */
export {
  buildBriefingForUser,
  type BriefingForUserResult,
} from "./server/briefing/signal-build-for-user";
export type {
  Briefing,
  BriefItem,
  FocusItem,
  TaskSignal,
} from "./lib/briefing/types";
export {
  calendarDayDifference,
  localWeekday,
} from "./lib/briefing/calendar-time";
export { requireSignalUser } from "./server/signal-auth";
export { parseBriefingReadScopeHint } from "./lib/planning-periods/read-scope-hint";
export { planningPeriodsEnabled, type SignalScope } from "./lib/planning-periods/scope";
