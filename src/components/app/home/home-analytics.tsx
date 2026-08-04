"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  captureClientEvent,
  type ClientAnalyticsProps,
} from "@/lib/analytics/client";

/**
 * Home instrumentation (DECISIONS.md D10). Event payloads carry trigger
 * kinds and timing phrases only — never titles or content.
 */

export function HomeViewedPing() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    captureClientEvent("home_viewed");
  }, []);
  return null;
}

export function HomeItemLink({
  href,
  event,
  properties,
  className,
  children,
}: {
  href: string;
  event: string;
  properties: ClientAnalyticsProps;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => captureClientEvent(event, properties)}
    >
      {children}
    </Link>
  );
}
