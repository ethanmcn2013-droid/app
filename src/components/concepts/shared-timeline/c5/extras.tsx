"use client";

/* The day everything leads to (add it to a calendar, pass the page on),
   and the quiet "Made with Signal Studio" mark. */

import { useRef, useState } from "react";
import type { Page } from "./data";
import { dayNum, monthDay } from "./data";
import s from "./c5.module.css";

function downloadIcs(page: Page) {
  const e = page.world.event;
  const esc = (t: string) => t.replace(/[,;]/g, (m) => `\\${m}`);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//Shared timeline//EN",
    "BEGIN:VEVENT",
    `UID:${page.world.id}-${e.start}@signalstudio.ie`,
    `DTSTAMP:${e.start}`,
    `DTSTART:${e.start}`,
    `DTEND:${e.end}`,
    `SUMMARY:${esc(`${e.title} · ${page.world.title}`)}`,
    `LOCATION:${esc(e.where)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  try {
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${page.world.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* concept: nothing else to do */
  }
}

export function EventCard({ page }: { page: Page }) {
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const e = page.world.event;
  const md = monthDay(page.final.date);
  const past = dayNum(page.today) > dayNum(page.final.date);

  return (
    <section className={s.eventCard} aria-label={e.title}>
      <div className={s.eventTop}>
        <span className={s.eventDate} aria-hidden="true">
          <span className={s.eventMonth}>{md.month}</span>
          <span className={s.eventDay}>{md.day}</span>
        </span>
        <span className={s.eventText}>
          <span className={s.eventTitle}>{e.title}</span>
          <span className={s.eventWhen}>{e.when}</span>
          <span className={s.eventWhere}>{e.where}</span>
        </span>
      </div>
      <div className={s.eventActions}>
        {!past ? (
          <button
            type="button"
            className={s.softButton}
            onClick={() => {
              downloadIcs(page);
              setAdded(true);
            }}
          >
            <svg viewBox="0 0 16 16" className={s.glyph} aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.8" />
              <path d="M2.5 6.5 H 13.5 M5.5 2 V 4.6 M10.5 2 V 4.6" />
            </svg>
            {added ? "Added" : "Add to calendar"}
          </button>
        ) : null}
        <button
          type="button"
          className={s.softButton}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
            } catch {
              /* clipboard blocked: still confirm, the link is in the address bar */
            }
            setCopied(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 2200);
          }}
        >
          <svg viewBox="0 0 16 16" className={s.glyph} aria-hidden="true">
            <path d="M6.6 9.4 L 9.4 6.6 M7.2 4.6 l1.2 -1.2 a2.6 2.6 0 0 1 3.7 3.7 l-1.2 1.2 M8.8 11.4 l-1.2 1.2 a2.6 2.6 0 0 1 -3.7 -3.7 l1.2 -1.2" />
          </svg>
          <span aria-live="polite">{copied ? "Link copied" : `Share with ${page.world.audienceNoun === "parents" ? "another parent" : "someone"}`}</span>
        </button>
      </div>
    </section>
  );
}

export function StudioMark() {
  return (
    <span className={s.mark}>
      <svg viewBox="0 0 16 16" className={s.markGlyph} aria-hidden="true">
        <circle cx="8" cy="8" r="7.5" className={s.markGround} />
        <circle cx="8" cy="8" r="4" className={s.markRing} />
        <circle cx="8" cy="8" r="1.6" className={s.markDot} />
      </svg>
      Made with Signal Studio
    </span>
  );
}
