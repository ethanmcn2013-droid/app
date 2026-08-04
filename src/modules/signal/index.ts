/**
 * Signal module public surface — Phase 6 port.
 *
 * Exports the route-level components wired by host route stubs, plus the
 * Home consumption surface. Do not import from internal module paths;
 * use this barrel only.
 *
 * Routes:
 *   /app/home/briefing                         → SignalBriefPage
 *   /app/home/briefing/onboarding              → SignalOnboardingPage
 *   /app/home/briefing/settings/notifications  → SignalNotificationsPage
 */
export { SignalBriefPage } from "./app/signal-brief-page";
export { SignalOnboardingPage } from "./app/onboarding/signal-onboarding-page";
export { SignalNotificationsPage } from "./app/settings/notifications/signal-notifications-page";

/**
 * Home consumption surface (Signal → Home consolidation): Home renders
 * Today's Signal from the same orchestrator + engine as the Full
 * Briefing — one read, one authorization path, one ranking engine.
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
