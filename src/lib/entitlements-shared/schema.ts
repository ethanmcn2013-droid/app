import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Canonical schema for the cross-product Signal entitlements DB.
 *
 * Lives on its own Turso DB (signal-entitlements) — readable by all
 * five product repos, writable by Tasks (via the Stripe webhook) and
 * Studio (via comp-code redemption + manual admin grants).
 *
 * Tier + source vocabularies are LOCKED to the marketing pricing
 * surface (signalstudio.ie/pricing). Renaming any value here is a
 * brand decision, not a technical one.
 *
 * Mirrors the original Studio schema at src/lib/db/schema.ts but:
 *   - adds stripe_customer_id + stripe_subscription_id (deferred in
 *     the Tasks-side implementation; finally landing here)
 *   - adds a processed_webhooks table for cross-product idempotency
 *
 * Studio's own DB (ethanmcnamara-studio) keeps cron_runs + the HQ
 * dashboard's local-first data — only the entitlements stack moves
 * here.
 */

/** Tier vocabulary — matches the public pricing page. */
export const ENTITLEMENT_TIERS = [
  "free",
  "event",
  "wedding",
  "workspace",
  "studio",
] as const;
export type EntitlementTier = (typeof ENTITLEMENT_TIERS)[number];

/** Source vocabulary — where a row came from. */
export const ENTITLEMENT_SOURCES = [
  "workspace_subscription",
  "event_pass",
  "student_edu",
  "venue_edition",
  "compliments",
  "review_access",
] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const ENTITLEMENT_STATUSES = ["active", "expired", "revoked"] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const entitlements = sqliteTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    userClerkId: text("user_clerk_id").notNull(),
    tier: text("tier").notNull(),
    source: text("source").notNull(),
    sourceRef: text("source_ref"),
    grantedAt: integer("granted_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    metadata: text("metadata"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("entitlements_user_clerk_id_idx").on(table.userClerkId),
    index("entitlements_status_expires_at_idx").on(
      table.status,
      table.expiresAt,
    ),
    index("entitlements_stripe_customer_idx").on(table.stripeCustomerId),
    index("entitlements_stripe_subscription_idx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;

export const sponsors = sqliteTable("sponsors", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  brandMeta: text("brand_meta"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;

export const LICENSE_CODE_STATUSES = ["minted", "redeemed", "revoked"] as const;
export type LicenseCodeStatus = (typeof LICENSE_CODE_STATUSES)[number];

export const licenseCodes = sqliteTable(
  "license_codes",
  {
    id: text("id").primaryKey(),
    sponsorId: text("sponsor_id")
      .notNull()
      .references(() => sponsors.id),
    code: text("code").notNull().unique(),
    status: text("status").notNull().default("minted"),
    sourceType: text("source_type").notNull(),
    tier: text("tier").notNull(),
    durationDays: integer("duration_days"),
    redeemedByUserId: text("redeemed_by_user_id"),
    redeemedAt: integer("redeemed_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("license_codes_sponsor_id_idx").on(table.sponsorId),
    index("license_codes_status_idx").on(table.status),
  ],
);

export type LicenseCode = typeof licenseCodes.$inferSelect;
export type NewLicenseCode = typeof licenseCodes.$inferInsert;

export const redemptions = sqliteTable(
  "redemptions",
  {
    id: text("id").primaryKey(),
    codeId: text("code_id")
      .notNull()
      .references(() => licenseCodes.id),
    userClerkId: text("user_clerk_id").notNull(),
    entitlementId: text("entitlement_id").references(() => entitlements.id),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    redeemedAt: integer("redeemed_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("redemptions_code_id_idx").on(table.codeId),
    index("redemptions_user_clerk_id_idx").on(table.userClerkId),
  ],
);

export type Redemption = typeof redemptions.$inferSelect;
export type NewRedemption = typeof redemptions.$inferInsert;

/**
 * Cross-product webhook dedup. Stripe webhooks land in Tasks today;
 * other writers (Studio admin grants, Clerk hooks if ever needed)
 * may land directly. A shared dedup table prevents duplicate writes
 * when retries fan out.
 */
export const processedWebhooks = sqliteTable(
  "processed_webhooks",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    eventId: text("event_id").notNull(),
    processedAt: integer("processed_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("processed_webhooks_source_event_idx").on(
      table.source,
      table.eventId,
    ),
  ],
);

export type ProcessedWebhook = typeof processedWebhooks.$inferSelect;
export type NewProcessedWebhook = typeof processedWebhooks.$inferInsert;
