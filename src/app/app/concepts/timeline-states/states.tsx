"use client";

import Link from "next/link";
import {
  AUDIENCE_TIMELINE_DTO_VERSION,
  type AudienceItemState,
  type AudienceKind,
  type AudienceTimelineDto,
} from "@/modules/timeline/lib/audience-timeline";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";

type Item = { title: string; date?: string; state: AudienceItemState };

function dto(
  label: string,
  kind: AudienceKind,
  today: string,
  items: Item[],
  primaryDate?: { label: string; date: string },
): AudienceTimelineDto {
  const order: AudienceItemState[] = ["covered", "now", "next", "later", "cancelled"];
  return {
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: kind,
    publicationId: `states-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    label,
    ownerDisplayLabel: kind === "couple" ? `Shared by ${label}` : "Shared by Ms Nolan",
    ...(primaryDate ? { primaryDate } : {}),
    lastUpdatedAt: `${today}T09:00:00.000Z`,
    today,
    sections: order
      .map((state) => ({
        state,
        label: state,
        items: items
          .map((item, index) => ({ ...item, publicId: `s-${index}` }))
          .filter((item) => item.state === state)
          .map(({ publicId, title, date, state: s }) => ({ publicId, title, ...(date ? { date } : {}), state: s })),
      }))
      .filter((section) => section.items.length > 0),
  } as AudienceTimelineDto;
}

const many: Item[] = Array.from({ length: 22 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 6, 1 + i * 5));
  return {
    title: ["Choose the readings", "Book the string trio", "Order the favours", "Taste the wine list", "Send the save-the-dates", "Fit the suits"][i % 6] + (i > 5 ? ` ${Math.floor(i / 6) + 1}` : ""),
    date: d.toISOString().slice(0, 10),
    state: i < 5 ? "covered" : i === 5 ? "next" : "later",
  };
});

const STATES: Record<string, { name: string; timeline: AudienceTimelineDto }> = {
  class: {
    name: "A class, no day",
    timeline: dto("Year 3 history project", "class", "2026-09-25", [
      { title: "Pick our topic", date: "2026-09-21", state: "covered" },
      { title: "Split up the jobs", date: "2026-09-22", state: "covered" },
      { title: "Find three sources", date: "2026-09-30", state: "next" },
      { title: "Draw the timeline poster", date: "2026-10-05", state: "later" },
      { title: "Practise the talk twice", date: "2026-10-12", state: "later" },
    ]),
  },
  past: {
    name: "The day has passed",
    timeline: dto("Aisling & Tom", "couple", "2026-10-20", [
      { title: "Book the venue", date: "2026-03-02", state: "covered" },
      { title: "Send the invitations", date: "2026-07-10", state: "covered" },
      { title: "Final guest numbers", date: "2026-09-12", state: "covered" },
      { title: "Wedding day", date: "2026-10-03", state: "covered" },
    ], { label: "Wedding day", date: "2026-10-03" }),
  },
  today: {
    name: "The day is today",
    timeline: dto("Nora & Cian", "couple", "2026-10-03", [
      { title: "Collect the rings", date: "2026-10-02", state: "covered" },
      { title: "Wedding day", date: "2026-10-03", state: "now" },
    ], { label: "Wedding day", date: "2026-10-03" }),
  },
  single: {
    name: "One milestone",
    timeline: dto("Harbour launch", "module", "2026-09-25", [
      { title: "Launch the new menu", date: "2026-10-15", state: "next" },
    ], { label: "Launch", date: "2026-10-15" }),
  },
  undated: {
    name: "Some timings not set",
    timeline: dto("Autumn open day", "module", "2026-09-25", [
      { title: "Pick a date", date: "2026-09-28", state: "next" },
      { title: "List everything that has to happen", state: "later" },
      { title: "Invite the people you need", state: "later" },
    ]),
  },
  many: {
    name: "Twenty-two moments",
    timeline: dto("Mara & Finn", "couple", "2026-07-27", many, { label: "Wedding day", date: "2026-10-20" }),
  },
  long: {
    name: "A very long name, overdue work",
    timeline: dto("The Kinsale Harbour Summer Music Festival and Community Picnic", "module", "2026-09-25", [
      { title: "Confirm the headline act and the stage plot with their management", date: "2026-09-20", state: "next" },
      { title: "Print the programmes", date: "2026-10-01", state: "later" },
      { title: "Festival weekend", date: "2026-10-17", state: "later" },
    ], { label: "Festival weekend", date: "2026-10-17" }),
  },
};

export function TimelineStates({ state }: { state: string | null }) {
  const current = state && STATES[state] ? STATES[state] : null;
  if (current) return <TimelineArtifact timeline={current.timeline} />;
  return (
    <main style={{ padding: 40, fontFamily: "var(--font-sans)" }}>
      <h1 style={{ margin: "0 0 16px" }}>Timeline states</h1>
      <ul style={{ lineHeight: 2 }}>
        {Object.entries(STATES).map(([key, value]) => (
          <li key={key}>
            <Link href={`/app/concepts/timeline-states?state=${key}`}>{value.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
