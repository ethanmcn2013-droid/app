"use client";

import { useEffect, useRef, useState } from "react";
import { captureClientEvent } from "@/lib/analytics/client";

/**
 * Home's arrival: the sections rise in order once, on the first paint of the
 * page, and the class is removed afterwards so later updates never replay it.
 * Reduced motion is honoured in the stylesheet.
 *
 * It also sends Home's one view event (DECISIONS.md D10), once per visit:
 * the event name only, never a title or a figure.
 */
export function EnterOnce({ className, enterClass, children }: { className: string; enterClass: string; children: React.ReactNode }) {
  const [entering, setEntering] = useState(true);
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      captureClientEvent("home_viewed");
    }
    const t = setTimeout(() => setEntering(false), 1200);
    return () => clearTimeout(t);
  }, []);
  return <div className={`${className} ${entering ? enterClass : ""}`}>{children}</div>;
}
