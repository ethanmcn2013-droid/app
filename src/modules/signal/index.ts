/**
 * Signal module public surface — Phase 6 port.
 *
 * Exports the three route-level components wired by host route stubs.
 * Do not import from internal module paths; use this barrel only.
 *
 * Routes:
 *   /app/signal                         → SignalBriefPage
 *   /app/signal/onboarding              → SignalOnboardingPage
 *   /app/signal/settings/notifications  → SignalNotificationsPage
 */
export { SignalBriefPage } from "./app/signal-brief-page";
export { SignalOnboardingPage } from "./app/onboarding/signal-onboarding-page";
export { SignalNotificationsPage } from "./app/settings/notifications/signal-notifications-page";
