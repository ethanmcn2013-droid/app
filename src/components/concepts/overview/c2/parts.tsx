import type { CSSProperties, ReactNode } from "react";
import { type Item, type PersonId, PERSON, WORKSTREAM, relative, short } from "./data";
import s from "./river.module.css";

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export function Avatar({ person, size = 16, ring }: { person: PersonId; size?: number; ring?: boolean }) {
  const p = PERSON[person];
  return (
    <span
      className={cx(s.avatar, ring && s.avatarRing)}
      style={
        {
          width: size,
          height: size,
          fontSize: Math.max(9, Math.round(size * 0.48)),
          "--p": `var(--rv-person-${person})`,
          "--p-ink": `var(--rv-person-${person}-ink)`,
        } as CSSProperties
      }
      aria-hidden="true"
      title={p.name}
    >
      {p.initials}
    </span>
  );
}

export function FlagGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size + 4} viewBox="0 0 14 18" aria-hidden="true" className={s.flagGlyph}>
      <path d="M2 1v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.6 1.6h9.2l-2.4 3.4 2.4 3.4H2.6z" fill="currentColor" />
    </svg>
  );
}

type IconName =
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-up"
  | "target"
  | "spread"
  | "undo"
  | "check"
  | "clock"
  | "arrow-right"
  | "close"
  | "plus"
  | "minus"
  | "calendar"
  | "archive"
  | "pen";

const PATHS: Record<IconName, ReactNode> = {
  "chevron-down": <path d="m4 6 4 4 4-4" />,
  "chevron-left": <path d="m10 4-4 4 4 4" />,
  "chevron-right": <path d="m6 4 4 4-4 4" />,
  "chevron-up": <path d="m4 10 4-4 4 4" />,
  target: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  spread: (
    <>
      <path d="M2 5h5M2 8h8M2 11h3" />
      <path d="m11 9 3 2-3 2" />
    </>
  ),
  undo: <path d="M5 4 2.5 6.5 5 9M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7" />,
  check: <path d="m3.5 8.5 3 3 6-7" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2 1.3" />
    </>
  ),
  "arrow-right": <path d="M3 8h10m-3.5-3.5L13 8l-3.5 3.5" />,
  close: <path d="m4.5 4.5 7 7m0-7-7 7" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  minus: <path d="M3.5 8h9" />,
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  archive: (
    <>
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 9h3" />
    </>
  ),
  pen: <path d="M10.5 3 13 5.5 6 12.5l-3 .5.5-3z" />,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export const STATUS_LABEL: Record<Item["status"], string> = {
  todo: "Not started",
  doing: "In progress",
  review: "In review",
  done: "Done",
};

export function StatusChip({ item, asOf = 0 }: { item: Item; asOf?: number }) {
  const done = item.doneOn !== undefined && item.doneOn <= asOf;
  const late = !done && item.due !== undefined && item.due < asOf;
  const today = !done && item.due === asOf;
  if (done) return <span className={cx(s.chip, s.chipDone)}>Done {short(item.doneOn!)}</span>;
  if (late) return <span className={cx(s.chip, s.chipLate)}>{asOf - item.due!} {asOf - item.due! === 1 ? "day" : "days"} late</span>;
  if (today) return <span className={cx(s.chip, s.chipToday)}>Due today</span>;
  return <span className={cx(s.chip, item.status === "review" && s.chipReview)}>{STATUS_LABEL[item.status]}</span>;
}

export function dueText(item: Item, asOf = 0): string {
  if (item.due === undefined) return "No date yet";
  if (item.kind === "milestone") return `${short(item.due)}, ${relative(item.due, asOf)}`;
  return `${short(item.start ?? item.due)} to ${short(item.due)}`;
}

export function laneName(item: Item) {
  return WORKSTREAM[item.lane].name;
}
