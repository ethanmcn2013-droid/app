"use client";

import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import type { Cover, Person, Task } from "./data";
import { Icon, PriorityBars, StageGlyph } from "./icons";
import { dueFact, PRIORITY_WORDS } from "./model";
import styles from "./board.module.css";

/* ── Avatars ───────────────────────────────────────────────────────── */

export function Avatar({ person, size = 22, ring = false }: { person: Person; size?: number; ring?: boolean }) {
  return (
    <span
      className={styles.avatar}
      data-ring={ring ? "" : undefined}
      data-guest={person.guest ? "" : undefined}
      style={{ "--av": person.tone, width: size, height: size, fontSize: Math.round(size * 0.4) } as CSSProperties}
      title={person.guest ? `${person.name} (guest)` : person.name}
    >
      {person.initials}
    </span>
  );
}

export function AvatarStack({ people, max = 3, size = 22 }: { people: Person[]; max?: number; size?: number }) {
  if (people.length === 0) return null;
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const extra = people.length - shown.length;
  return (
    <span className={styles.stack} aria-hidden="true">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} ring />
      ))}
      {extra > 0 ? (
        <span className={styles.stackMore} style={{ width: size, height: size }}>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/* ── Cover art: drawn from project tokens, no images ──────────────── */

function CoverArt({ kind }: { kind: Cover["kind"] }) {
  switch (kind) {
    case "plan":
      return (
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect x="18" y="12" width="204" height="64" rx="4" />
          <path d="M18 40h54M72 12v64M150 12v28h72" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={98 + i * 28} cy="58" r="8" />
          ))}
          {[0, 1].map((i) => (
            <circle key={`t${i}`} cx={172 + i * 26} cy="26" r="6" />
          ))}
          <rect x="28" y="20" width="34" height="12" rx="2" />
        </svg>
      );
    case "sheet":
      return (
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <path d={`M22 ${16 + i * 14}h26`} />
              <path d={`M60 ${16 + i * 14}h${[120, 90, 140, 70, 110][i]}`} />
            </g>
          ))}
        </svg>
      );
    case "menu":
      return (
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <circle cx="70" cy="44" r="28" />
          <circle cx="70" cy="44" r="18" />
          <circle cx="170" cy="44" r="28" />
          <circle cx="170" cy="44" r="18" />
          <path d="M28 20v48M34 20v14M22 20v14M22 34h12M212 20c6 6 6 22 0 26v22" />
        </svg>
      );
    case "poster":
      return (
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M20 50h200" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i}>
              <circle cx={32 + i * 30} cy="50" r="4" />
              <path d={`M${32 + i * 30} ${i % 2 ? 58 : 42}v${i % 2 ? 14 : -14}`} />
            </g>
          ))}
        </svg>
      );
    case "map":
      return (
        <svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect x="24" y="14" width="80" height="60" rx="3" />
          <path d="M34 28h60M34 40h48M34 52h56M34 64h36" />
          <rect x="120" y="14" width="96" height="60" rx="3" />
          <path d="M130 62l20-22 16 14 14-10 26 18" />
        </svg>
      );
  }
}

export function CoverBlock({ cover }: { cover: Cover }) {
  return (
    <div className={styles.cover} style={{ "--c1": cover.from, "--c2": cover.to } as CSSProperties}>
      <CoverArt kind={cover.kind} />
      <span className={styles.coverCaption}>{cover.caption}</span>
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */

export function cardLabel(task: Task, people: Person[]) {
  const bits = [task.title];
  if (task.stage === "done") bits.push("Done");
  if (task.due && task.stage !== "done") bits.push(dueFact(task.due).spoken);
  if (task.priority) bits.push(PRIORITY_WORDS[task.priority]);
  if (task.label) bits.push(task.label.name);
  if (task.heldBy) bits.push(`Waiting on ${task.heldBy}`);
  if (task.subtasks?.length) bits.push(`${task.subtasks.filter((s) => s.done).length} of ${task.subtasks.length} steps done`);
  if (task.comments) bits.push(`${task.comments} ${task.comments === 1 ? "comment" : "comments"}`);
  if (people.length) bits.push(people.map((p) => p.name).join(", "));
  return bits.join(". ");
}

export function Progress({ done, total }: { done: number; total: number }) {
  const segments = Math.min(total, 8);
  const filled = Math.round((done / total) * segments);
  return (
    <span className={styles.progress} data-complete={done === total ? "" : undefined}>
      <span className={styles.progressBar} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <i key={i} data-on={i < filled ? "" : undefined} />
        ))}
      </span>
      <span className={styles.metaNum}>
        {done}/{total}
      </span>
    </span>
  );
}

type CardProps = HTMLAttributes<HTMLDivElement> & {
  task: Task;
  people: Person[];
  showStage?: boolean;
  lifted?: boolean;
  pickedUp?: boolean;
  justAdded?: boolean;
};

export const CardFace = forwardRef<HTMLDivElement, CardProps>(function CardFace(
  { task, people, showStage, lifted, pickedUp, justAdded, className, ...rest },
  ref,
) {
  const done = task.stage === "done";
  const due = task.due && !done ? dueFact(task.due) : null;
  const subDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const hasFoot = !!task.subtasks?.length;
  const hasProps = !!(due || task.priority >= 2 || task.label || (!hasFoot && task.comments));
  return (
    <div
      ref={ref}
      className={[styles.card, className].filter(Boolean).join(" ")}
      data-done={done ? "" : undefined}
      data-lifted={lifted ? "" : undefined}
      data-picked={pickedUp ? "" : undefined}
      data-new={justAdded ? "" : undefined}
      {...rest}
    >
      {task.cover && !done ? <CoverBlock cover={task.cover} /> : null}
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          {showStage || done ? <StageGlyph stage={task.stage} size={14} /> : null}
          <h3 className={styles.cardTitle}>{task.title}</h3>
          {done && people.length ? <AvatarStack people={people} size={18} /> : null}
        </div>
        {task.heldBy && !done ? (
          <p className={styles.held}>
            <Icon.clock size={13} />
            <span>
              Waiting on <strong>{task.heldBy}</strong>
            </span>
          </p>
        ) : null}
        {!done && (hasProps || (!hasFoot && people.length > 0)) ? (
          <div className={styles.meta}>
            <span className={styles.metaLeft}>
              {due ? (
                <span className={styles.due} data-tone={due.tone}>
                  <Icon.calendar size={12} />
                  {due.label}
                </span>
              ) : null}
              {task.priority >= 2 ? (
                <span className={styles.metaIcon} title={PRIORITY_WORDS[task.priority]}>
                  <PriorityBars priority={task.priority} />
                </span>
              ) : null}
              {task.label ? (
                <span className={styles.label} style={{ "--dot": task.label.tone } as CSSProperties}>
                  {task.label.name}
                </span>
              ) : null}
              {!hasFoot && task.comments ? (
                <span className={styles.metaIcon}>
                  <Icon.comment size={13} />
                  <span className={styles.metaNum}>{task.comments}</span>
                </span>
              ) : null}
            </span>
            {!hasFoot ? <AvatarStack people={people} /> : null}
          </div>
        ) : null}
        {!done && hasFoot ? (
          <div className={styles.foot}>
            <span className={styles.metaLeft}>
              {task.subtasks?.length ? <Progress done={subDone} total={task.subtasks.length} /> : null}
              {task.comments ? (
                <span className={styles.metaIcon}>
                  <Icon.comment size={13} />
                  <span className={styles.metaNum}>{task.comments}</span>
                </span>
              ) : null}
            </span>
            <AvatarStack people={people} />
          </div>
        ) : null}
      </div>
    </div>
  );
});
