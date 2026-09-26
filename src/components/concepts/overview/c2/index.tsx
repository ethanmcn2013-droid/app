"use client";

import { useSyncExternalStore } from "react";
import { Desktop } from "./Desktop";
import { Phone } from "./Phone";
import { useRiver } from "./useRiver";
import s from "./river.module.css";

const QUERY = "(max-width: 720px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Overview, concept 2: River of time. */
export default function RiverOfTime() {
  const river = useRiver();
  const phone = useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
  // Until the viewport is known, hold a quiet frame rather than the wrong layout.
  if (phone === null) {
    return (
      <div className={s.root}>
        <header className={s.top}>
          <h1 className={s.h1}>Overview</h1>
        </header>
      </div>
    );
  }
  return phone ? <Phone river={river} /> : <Desktop river={river} />;
}
