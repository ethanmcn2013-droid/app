"use client";

/**
 * Browser analytics — posts to our first-party capture route.
 */

export type ClientAnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export function captureClientEvent(
  event: string,
  properties: ClientAnalyticsProps = {},
): void {
  if (typeof window === "undefined") return;

  void fetch("/api/analytics/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
    keepalive: true,
  }).catch(() => {
    // Non-blocking — analytics must never break UX
  });
}
