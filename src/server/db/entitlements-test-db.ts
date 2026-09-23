import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { freshFileDb } from "./memory-test-db";
import { users, workspaces, workspaceMembers } from "./schema";
import * as sharedSchema from "../../lib/entitlements-shared/schema";

/** Two actual projects and independent disposable stores; never provider data. */
export async function entitlementFixture() {
  const local = await freshFileDb();
  await local.db.insert(users).values({
    id: "buyer", clerkId: "buyer", handle: "buyer", name: "Fixture buyer", initials: "FB", color: "fixture",
  });
  for (const id of ["project-a", "project-b"]) {
    await local.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: "buyer" });
    await local.db.insert(workspaceMembers).values({ workspaceId: id, userId: "buyer", role: "owner" });
  }
  const sharedClient = createClient({ url: ":memory:" });
  await sharedClient.executeMultiple(`CREATE TABLE entitlements (
    id TEXT PRIMARY KEY, user_clerk_id TEXT NOT NULL, tier TEXT NOT NULL, source TEXT NOT NULL,
    source_ref TEXT, granted_at INTEGER DEFAULT 0, expires_at INTEGER, status TEXT NOT NULL,
    stripe_customer_id TEXT, stripe_subscription_id TEXT, metadata TEXT,
    created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0
  )`);
  const shared = drizzle(sharedClient, { schema: sharedSchema });
  return {
    local, shared, sharedClient,
    dependencies: { database: local.db, sharedDatabase: shared },
    close: () => { local.cleanup(); sharedClient.close(); },
  };
}
