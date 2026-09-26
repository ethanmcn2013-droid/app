import type { CSSProperties } from "react";
import { LOAD_WORD, PERSON, loadLevel, plural } from "./data";
import styles from "./cal.module.css";

export function Avatar({ id, size = 18, guest }: { id: string; size?: number; guest?: boolean }) {
  const p = PERSON[id];
  if (!p) return null;
  return (
    <span
      className={styles.avatar}
      data-guest={guest || p.guest ? "" : undefined}
      style={{ "--av": p.color, "--size": `${size}px` } as CSSProperties}
      title={`${p.name}, ${p.role.toLowerCase()}`}
    >
      {p.name[0]}
    </span>
  );
}

export function AvatarStack({ people, guests = [], size = 18, max = 3 }: { people: string[]; guests?: string[]; size?: number; max?: number }) {
  const all = [...people.map((id) => ({ id, guest: false })), ...guests.map((id) => ({ id, guest: true }))];
  const shown = all.slice(0, max);
  const rest = all.length - shown.length;
  return (
    <span className={styles.stack} aria-label={all.map((a) => PERSON[a.id]?.name + (a.guest ? " (guest)" : "")).join(", ")} role="img">
      {shown.map((a) => (
        <Avatar key={a.id} id={a.id} size={size} guest={a.guest} />
      ))}
      {rest > 0 ? (
        <span className={styles.avatarMore} style={{ "--size": `${size}px` } as CSSProperties}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

/** Load tone for bars and tints: accent while calm, warning at four, danger from five. */
export function loadTone(open: number): "calm" | "warn" | "hot" | "none" {
  if (open === 0) return "none";
  if (open <= 3) return "calm";
  if (open === 4) return "warn";
  return "hot";
}

export function loadSentence(open: number, done: number, people?: number) {
  const word = LOAD_WORD[loadLevel(open)];
  if (open === 0 && done === 0) return "Free";
  const parts = [`${word} · ${plural(open, "open task")}`];
  if (people) parts.push(plural(people, "person", "people"));
  if (done) parts.push(`${done} done`);
  return parts.join(", ");
}

export function LoadBar({ open, preview }: { open: number; preview?: number }) {
  const n = preview ?? open;
  return (
    <span className={styles.loadBar} data-tone={loadTone(n)} data-preview={preview !== undefined ? "" : undefined} aria-hidden>
      <span style={{ width: `${(Math.min(n, 5) / 5) * 100}%` }} />
    </span>
  );
}
