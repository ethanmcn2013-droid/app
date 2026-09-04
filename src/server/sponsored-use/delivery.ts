import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { sponsoredUseIntents } from "./schema";
import type { UsageExecutor } from "./capture";
import { signedUsageRequest, USAGE_PATHS } from "@/lib/sponsored-use/service-auth";
import { sweepUsageIntents } from "./erasure";

export type UsageDeliveryConfig = {
  enabled: boolean; studioOrigin: string; secret: string; issuanceSecret?: string;
  now?: number; send?: (request: Request) => Promise<Response>;
};
/** At-least-once, one bounded destination, no network inside a SQLite transaction. */
export async function deliverUsage(database: UsageExecutor, config: UsageDeliveryConfig) {
  const now = config.now ?? Date.now();
  await sweepUsageIntents(database, now);
  const pending = await database.select().from(sponsoredUseIntents)
    .where(and(isNull(sponsoredUseIntents.deliveredAt),config.enabled ? undefined : eq(sponsoredUseIntents.kind,"erase")))
    .orderBy(asc(sponsoredUseIntents.kind), asc(sponsoredUseIntents.createdAt)).limit(50);
  if(pending.length===0) return { delivered:0,failed:0 };
  if(config.secret.length<32 || config.secret===config.issuanceSecret) throw new Error("Usage configuration unavailable");
  let delivered = 0, failed = 0;
  for (const intent of pending) {
    try {
      const path = intent.kind === "erase" ? USAGE_PATHS.erase : USAGE_PATHS.ingest;
      const request = signedUsageRequest(new URL(path, config.studioOrigin).href, JSON.parse(intent.payload), config.secret, intent.epoch, now);
      const response = await (config.send ?? ((r) => fetch(r, { signal: AbortSignal.timeout(5000), redirect: "error" })))(request);
      // Conflict/auth/outage responses remain retryable and never leak remote bodies.
      if (!response.ok) { failed++; continue; }
      await database.update(sponsoredUseIntents).set({ deliveredAt: now })
        .where(and(eq(sponsoredUseIntents.id, intent.id), eq(sponsoredUseIntents.payload, intent.payload)));
      delivered++;
    } catch { failed++; }
  }
  return { delivered, failed };
}
