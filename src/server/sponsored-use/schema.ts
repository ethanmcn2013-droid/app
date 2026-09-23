import { integer, text, sqliteTable, index, primaryKey } from "drizzle-orm/sqlite-core";

/** Private receipt, not a general outbox. No task text or raw actor/Project ids. */
export const sponsoredUseIntents = sqliteTable("sponsored_use_intents", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<"event" | "erase">().notNull(),
  actorKey: text("actor_key").notNull(),
  entitlementId: text("entitlement_id"),
  epoch: text("epoch").notNull(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
  deliveredAt: integer("delivered_at"),
}, t => [index("sponsored_use_pending_idx").on(t.deliveredAt, t.createdAt),
  index("sponsored_use_actor_idx").on(t.actorKey)]);
/** Retained only to carry an erasure across salt rotations after raw events age out. */
export const sponsoredUseSubjects = sqliteTable("sponsored_use_subjects", {
  actorKey: text("actor_key").notNull(),
  epoch: text("epoch").notNull(),
  subjectIdHash: text("subject_id_hash").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.actorKey, t.epoch] })]);
