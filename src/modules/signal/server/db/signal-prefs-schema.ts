/**
 * Re-export prefs schema from canonical module location.
 * The schema lives in lib/db/ (client-importable shape), the server
 * DB client here is the only consumer that needs to drizzle() it.
 */
export * from "../../lib/db/signal-prefs-schema";
