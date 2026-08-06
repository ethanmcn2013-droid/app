/**
 * Signal module public surface — Phase 6 port.
 *
 * Exports the route-level components wired by host route stubs, plus the
 * Home consumption surface. Do not import from internal module paths;
 * the module has exactly two declared entry points and this is the wide
 * one. The other is `./home`, which carries the data surface alone —
 * see that file for why a page that reads the briefing without rendering
 * it must not come through here.
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
 *
 * Defined in `./home` and re-exported here so both entry points name the
 * same surface and cannot drift. Callers that need only this half should
 * import `@/modules/signal/home`; reaching it through the barrel drags
 * the briefing route components into their chunk group.
 */
export * from "./home";
