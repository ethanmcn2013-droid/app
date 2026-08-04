import { signalAnalyticsDb } from "./signal-analytics-client";

/**
 * Compatibility shim since the 2026-07-31 data-layer reset: the separate
 * signal-prefs database was folded into the Signal database, so the prefs
 * client IS the Signal client. `user_preferences` lives in the same schema
 * module now (re-exported from signal-analytics-schema). Existing
 * `import { signalPrefsDb }` call sites keep working unchanged; new code
 * should import `signalAnalyticsDb` directly.
 */
export const signalPrefsDb = signalAnalyticsDb;
