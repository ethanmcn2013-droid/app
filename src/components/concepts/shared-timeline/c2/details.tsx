"use client";

import { useState } from "react";
import type { World } from "./data";
import { icsStamp } from "./time";
import s from "./c2.module.css";

function icsFor(world: World): string {
  const endAt = world.target + world.durationMin * 60_000;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Signal Studio//Shared timeline//EN",
    "BEGIN:VEVENT",
    `UID:${world.id}-${world.target}@signalstudio.ie`,
    `DTSTAMP:${icsStamp(world.target - 40 * 86_400_000)}`,
    `DTSTART:${icsStamp(world.target)}`,
    `DTEND:${icsStamp(endAt)}`,
    `SUMMARY:${world.eventName}: ${world.title}`,
    `LOCATION:${world.place}\\, ${world.address.replace(/,/g, "\\,")}`,
    `DESCRIPTION:${world.detailsIntro.replace(/,/g, "\\,")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function googleLink(world: World): string {
  const endAt = world.target + world.durationMin * 60_000;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${world.eventName}: ${world.title}`,
    dates: `${icsStamp(world.target)}/${icsStamp(endAt)}`,
    location: `${world.place}, ${world.address}`,
    details: world.detailsIntro,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function downloadIcs(world: World) {
  const blob = new Blob([icsFor(world)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${world.eventName.toLowerCase().replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Details({ world, hasDate }: { world: World; hasDate: boolean }) {
  const [saved, setSaved] = useState(false);
  return (
    <section className={s.details} aria-labelledby="c2-details">
      <div className={s.detailsMain}>
        <h2 id="c2-details" className={s.sectionTitle}>
          {world.detailsTitle}
        </h2>
        <p className={s.detailsIntro}>{world.detailsIntro}</p>
        <dl className={s.detailsFacts}>
          <div className={s.detailsFact}>
            <dt>When</dt>
            <dd>
              {hasDate ? (
                <>
                  {world.whenLong}
                  <span className={s.detailsSub}>{world.timeLine}</span>
                </>
              ) : (
                <>
                  Date coming soon
                  <span className={s.detailsSub}>We will add it here the moment it is set.</span>
                </>
              )}
            </dd>
          </div>
          <div className={s.detailsFact}>
            <dt>Where</dt>
            <dd>
              {world.place}
              <span className={s.detailsSub}>{world.address}</span>
            </dd>
          </div>
          {world.extra ? (
            <div className={s.detailsFact}>
              <dt>{world.extra.label}</dt>
              <dd>{world.extra.value}</dd>
            </div>
          ) : null}
        </dl>
        <div className={s.calRow}>
          <button
            type="button"
            className={s.btnPrimary}
            disabled={!hasDate}
            onClick={() => {
              downloadIcs(world);
              setSaved(true);
            }}
          >
            <CalIcon />
            {saved ? "Calendar file saved" : "Add to Apple or Outlook"}
          </button>
          {hasDate ? (
            <a className={s.btnGhost} href={googleLink(world)} target="_blank" rel="noreferrer">
              Add to Google Calendar
            </a>
          ) : null}
        </div>
      </div>
      <div className={s.detailsSide}>
        <h3 className={s.runTitle}>How the {world.id === "agency" ? "night" : world.id === "wedding" ? "day" : "evening"} runs</h3>
        <ol className={s.run}>
          {world.run.map((r) => (
            <li key={r.time} className={s.runItem}>
              <span className={s.runTime}>{r.time}</span>
              <span className={s.runWhat}>{r.what}</span>
            </li>
          ))}
        </ol>
        <h3 className={s.runTitle}>Getting there</h3>
        <p className={s.detailsBody}>{world.gettingThere}</p>
      </div>
    </section>
  );
}

export function CalIcon() {
  return (
    <svg className={s.icon} viewBox="0 0 16 16" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg className={s.icon} viewBox="0 0 16 16" aria-hidden>
      <path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 013.6 3.6L10.6 8M9 11.5l-1.2 1.2a2.6 2.6 0 01-3.6-3.6L5.4 8" />
    </svg>
  );
}
