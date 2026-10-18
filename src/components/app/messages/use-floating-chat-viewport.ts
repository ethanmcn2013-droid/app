"use client";

import { useEffect, useState, type CSSProperties } from "react";

/** Keep the small overlay above a visual keyboard without changing App layout. */
export function useFloatingChatViewport(active: boolean): CSSProperties | undefined {
  const [bounds, setBounds] = useState<CSSProperties>();
  useEffect(() => {
    if (!active) return;
    const viewport = window.visualViewport;
    const measure = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offset = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
      setBounds({ "--signal-chat-viewport-height": `${height}px`, "--signal-chat-keyboard-offset": `${offset}px` } as CSSProperties);
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => { viewport?.removeEventListener("resize", measure); viewport?.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [active]);
  return bounds;
}
