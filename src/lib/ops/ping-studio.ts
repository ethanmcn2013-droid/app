import "server-only";

/**
 * Cross-repo cron heartbeat: Tasks → Studio HQ.
 *
 * The Tasks daily digest cron pings Studio's cron_runs ledger so HQ
 * can see the 09:00 UTC digest is alive. Mirrors the analytics
 * ping-studio helper exactly (same shape, same allowlist, same
 * fail-silent contract). The bearer secret is only ever sent to a
 * signalstudio.ie https host; if STUDIO_CRON_PING_URL is unset or
 * points anywhere else, the ping is skipped — observability must
 * never break the digest, and the credential must never leak.
 *
 * Until STUDIO_CRON_PING_URL + STUDIO_CRON_PING_SECRET are set on
 * the Tasks Vercel project this is a no-op and HQ reads the digest
 * cron as `never` (honest), self-healing to green on the first run
 * after the env lands.
 */

interface PingPayload {
  source: "tasks_digest";
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
      "[ping-studio] STUDIO_CRON_PING_URL is not a signalstudio.ie https host — refusing to send (credential safety).",
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
    // Never throw — observability must not break the digest.
  } finally {
    clearTimeout(timer);
  }
}
