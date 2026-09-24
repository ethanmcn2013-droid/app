import "server-only";

/**
 * Cross-repo cron heartbeat: Tasks → Studio HQ.
 *
 * The Tasks daily digest cron pings Studio's cron_runs ledger so HQ
 * can see the 09:00 UTC digest is alive. Mirrors the analytics
 * ping-studio helper exactly (same shape, same allowlist, same
 * fail-silent contract). The bearer secret is only ever sent to a
 * signalstudio.ie https host; if STUDIO_CRON_PING_URL is unset or
 * points anywhere else, the ping is skipped, observability must
 * never break the digest, and the credential must never leak.
 *
 * Until STUDIO_CRON_PING_URL + STUDIO_CRON_PING_SECRET are set on
 * the Tasks Vercel project this is a no-op and HQ reads the digest
 * cron as `never` (honest), self-healing to green on the first run
 * after the env lands.
 */

/** Must match Studio's CRON_RUN_SOURCES; an unknown source is refused (400). */
export type StudioCronSource =
  | "tasks_digest"
  | "app_analytics_snapshots"
  | "app_drive_grant_repair";

interface PingPayload {
  source: StudioCronSource;
  ranAt: number;
  ok: boolean;
  considered?: number;
  sent?: number;
  skipped?: number;
  failed?: number;
  notes?: string;
}

const TIMEOUT_MS = 2000;

function isAllowedHost(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return (
      u.hostname === "signalstudio.ie" ||
      u.hostname.endsWith(".signalstudio.ie")
    );
  } catch {
    return false;
  }
}

export async function pingStudio(payload: PingPayload): Promise<void> {
  const url = process.env.STUDIO_CRON_PING_URL;
  const secret = process.env.STUDIO_CRON_PING_SECRET;
  if (!url || !secret) {
    return;
  }
  if (!isAllowedHost(url)) {
    console.error(
      "[ping-studio] STUDIO_CRON_PING_URL is not a signalstudio.ie https host, refusing to send (credential safety).",
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Never throw, observability must not break the digest.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wrap a cron route so every authorised run leaves a heartbeat in Studio's
 * cron_runs, where HQ Health reads it. Vercel keeps runtime logs briefly, so
 * without this a nightly job leaves no durable record of having run.
 *
 * - A 401, or the fixed "cron-secret-not-configured" refusal that precedes
 *   the auth check, is not recorded: the route is public and must not let
 *   anyone write to the ledger by calling it.
 * - A thrown handler is recorded as a failed run, then rethrown.
 * - The heartbeat carries only ok and a skip reason. Routes differ in what
 *   a top-level `failed` counts, so it is not forwarded; the route's own
 *   response keeps its full counts.
 */
export function withStudioHeartbeat<Req extends Request>(
  source: StudioCronSource,
  handler: (request: Req) => Promise<Response>,
): (request: Req) => Promise<Response> {
  return async (request: Req) => {
    let response: Response;
    try {
      response = await handler(request);
    } catch (error) {
      await pingStudio({ source, ranAt: Date.now(), ok: false, notes: "handler threw" });
      throw error;
    }
    if (response.status === 401) return response;

    let body: Record<string, unknown> | null = null;
    try {
      body = (await response.clone().json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (body?.error === "cron-secret-not-configured") return response;
    const skipped = typeof body?.skipped === "string" ? body.skipped : null;
    await pingStudio({
      source,
      ranAt: Date.now(),
      ok: response.ok && body?.ok !== false,
      skipped: skipped ? 1 : 0,
      notes: skipped ? `skipped: ${skipped}` : `http ${response.status}`,
    });
    return response;
  };
}
