import "server-only";

/**
 * Server-side PostHog capture via HTTP API.
 * No posthog-node dependency, keeps the bundle lean.
 *
 * Env:
 *   POSTHOG_API_KEY, project API key
 *   NEXT_PUBLIC_POSTHOG_HOST, optional, defaults to eu.i.posthog.com
 */

export type AnalyticsEventProps = Record<
  string,
  string | number | boolean | null | undefined
>;

const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: AnalyticsEventProps = {},
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[analytics] ${event}`, { distinctId, ...properties });
    }
    return;
  }

  const payload = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      ...properties,
      $lib: "signal-tasks-server",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn(`[analytics] PostHog ${res.status}`, await res.text());
    }
  } catch (err) {
    console.warn("[analytics] capture failed", err);
  }
}
