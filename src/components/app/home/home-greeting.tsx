"use client";

import { useSyncExternalStore } from "react";

/**
 * The greeting follows the reader's own clock. The server renders the
 * greeting from the saved timezone (UTC when none is saved); once hydrated,
 * the browser's local hour takes over so "Good evening" is never said at 9am.
 */
function greetingForHour(hour: number): string {
  if (hour < 5) return "Still up.";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 5 * 60_000);
  return () => window.clearInterval(timer);
};

export function HomeGreeting({ serverGreeting, pinned = false }: { serverGreeting: string; pinned?: boolean }) {
  const greeting = useSyncExternalStore(
    subscribe,
    () => (pinned ? serverGreeting : greetingForHour(new Date().getHours())),
    () => serverGreeting,
  );
  return <>{greeting}</>;
}
