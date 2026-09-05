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

/** Both Studio handlers acknowledge committed custody with exactly {ok:true}. */
async function acknowledged(response: Response): Promise<boolean> {
  if (response.status !== 200 || response.redirected ||
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    void response.body?.cancel().catch(() => {});
    return false;
  }
  const reader = response.body?.getReader();
  if (!reader) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 256) return false;
          chunks.push(part.value);
        }
        // Reject extra/duplicate keys, partial JSON and non-protocol 2xx pages.
        return /^[\t\r\n ]*\{[\t\r\n ]*"ok"[\t\r\n ]*:[\t\r\n ]*true[\t\r\n ]*\}[\t\r\n ]*$/.test(
          new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
        );
      })(),
      new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 5000); }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
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
      if (!await acknowledged(response)) { failed++; continue; }
      await database.update(sponsoredUseIntents).set({ deliveredAt: now })
        .where(and(eq(sponsoredUseIntents.id, intent.id), eq(sponsoredUseIntents.payload, intent.payload)));
      delivered++;
    } catch { failed++; }
  }
  return { delivered, failed };
}
