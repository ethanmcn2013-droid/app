"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEdition } from "./context";
import {
  EVENTS,
  FILES,
  PEOPLE,
  TODAY,
  WEEK_END,
  addDays,
  fmtLong,
  fmtShort,
  projectById,
  relative,
  type FileId,
  type PersonId,
  type Task,
  type TaskAction,
} from "./data";
import { Arrow, Calendar, Close, StatusGlyph } from "./icons";
import s from "./edition.module.css";

/* ── small atoms ─────────────────────────────────────────────── */

export const tone = (n: number) =>
  ({ "--tone": `var(--v3-project-${n})` }) as CSSProperties;

export function Avatar({
  id,
  size = "sm",
}: {
  id: PersonId;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const p = PEOPLE[id];
  return (
    <span
      className={`${s.avatar} ${s[`avatar_${size}`]}`}
      style={tone(p.tone)}
      aria-hidden
    >
      {/* At 16px two initials smudge; one reads. */}
      {size === "xs" ? p.initials[0] : p.initials}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export const isLate = (t: Task) =>
  t.status !== "done" && !!t.due && t.due < TODAY;

const STATUS_WORDS: Record<Task["status"], string> = {
  todo: "To do",
  doing: "In progress",
  review: "In review",
  stalled: "Stalled",
  done: "Done",
};

const canHover = () =>
  window.matchMedia("(hover: hover) and (min-width: 641px)").matches;

type CardAction = { label: string; key: string; run: () => void };

type PillProps = {
  variant: "task" | "person" | "date" | "file";
  label: ReactNode;
  lead?: ReactNode;
  heading: ReactNode;
  sub?: ReactNode;
  rows: [string, ReactNode][];
  actions: CardAction[];
  className?: string;
  /* What the handle stands for, e.g. the full task title. */
  detail: string;
  extra?: ReactNode;
};

/* The accessible name starts with the visible words (WCAG 2.5.3). */
function nameFor(
  variant: PillProps["variant"],
  label: ReactNode,
  detail: string,
) {
  const seen = typeof label === "string" ? label : detail;
  return seen === detail
    ? `${seen}, ${variant}`
    : `${seen}, ${variant}: ${detail}`;
}

/* ── the pill: an inline live handle with an unfolding card ──── */

/* Hover or focus opens a preview, out of the tab order. Its one-key actions
   already work, so a mouse reader learns them from the hints. Enter, Space or
   a click pins it, and only then does focus move inside. */
function Pill({
  variant,
  label,
  lead,
  heading,
  sub,
  rows,
  actions,
  className,
  detail,
  extra,
}: PillProps) {
  const ctx = useEdition();
  const key = useId();
  const cardId = `${key}-card`;
  const open = ctx.openPill === key;
  const pinned = open && ctx.pinned;
  const wrapRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{
    up: boolean;
    right: boolean;
    sheet: boolean;
    /* In the lede the card hangs below the whole paragraph, never over it. */
    anchor: { x: number; y: number } | null;
  }>({ up: false, right: false, sheet: false, anchor: null });
  /* Handles at display size open on click or Enter only, never on hover. */
  const inLede = () => !!wrapRef.current?.closest("[data-lede]");
  const inside = (n: Node | null) =>
    !!n && (!!wrapRef.current?.contains(n) || !!cardRef.current?.contains(n));

  const measure = () => {
    const r = pillRef.current?.getBoundingClientRect();
    if (!r) return;
    const rects = pillRef.current?.getClientRects();
    const last = rects && rects.length ? rects[rects.length - 1] : r;
    const sheet = window.matchMedia("(max-width: 640px)").matches;
    const lede = pillRef.current?.closest<HTMLElement>("[data-lede]");
    let anchor: { x: number; y: number } | null = null;
    if (lede && !sheet && rects && rects.length) {
      const L = lede.getBoundingClientRect();
      // An inline box's containing block starts at its first fragment.
      const W = wrapRef.current?.getClientRects()[0] ?? rects[0];
      const x = Math.min(
        Math.max(rects[0].left - L.left - 8, 0),
        Math.max(0, L.width - 320),
      );
      anchor = { x: x - (W.left - L.left), y: L.bottom - W.top + 14 };
    }
    setPlace({
      up: !anchor && last.bottom + 290 > window.innerHeight && last.top > 300,
      right: !anchor && r.left + 330 > window.innerWidth - 12,
      // On a phone the card is a bottom sheet, portalled above the app shell.
      sheet,
      anchor,
    });
  };

  const show = (pin: boolean) => {
    window.clearTimeout(timer.current);
    measure();
    ctx.setOpenPill(key, pin);
  };

  const { closePill } = ctx;

  // Close when the reader clicks elsewhere while the card is pinned.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!wrapRef.current?.contains(n) && !cardRef.current?.contains(n))
        closePill(key);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned, closePill, key]);

  // One-key actions work on any open card, where the hints are shown.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const hit = actions.find(
        (a) => a.key.toLowerCase() === e.key.toLowerCase(),
      );
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      hit.run();
      closePill(key);
      if (pinned) pillRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, pinned, actions, closePill, key]);

  const run = (a: CardAction) => {
    a.run();
    closePill(key);
    pillRef.current?.focus({ preventScroll: true });
  };

  const onPillKey = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      show(true);
      requestAnimationFrame(() =>
        cardRef.current
          ?.querySelector<HTMLButtonElement>("button[data-action]")
          ?.focus(),
      );
    }
  };

  const card = (
    <>
      <span className={s.scrim} onClick={() => closePill(key)} aria-hidden />
      <span
        ref={cardRef}
        id={cardId}
        role={pinned ? "dialog" : "tooltip"}
        aria-label={detail}
        data-card
        data-pinned={pinned || undefined}
        className={s.card}
        data-up={place.up || undefined}
        data-right={place.right || undefined}
        data-anchored={place.anchor ? true : undefined}
        style={
          place.anchor && !place.sheet
            ? { top: place.anchor.y, left: place.anchor.x }
            : undefined
        }
      >
        <span className={s.cardHead}>
          <span className={s.cardHeading}>{heading}</span>
          <button
            type="button"
            className={s.cardClose}
            aria-label="Close"
            tabIndex={pinned ? 0 : -1}
            onClick={() => closePill(key)}
          >
            <Close />
          </button>
        </span>
        {sub && <span className={s.cardSub}>{sub}</span>}
        {rows.length > 0 && (
          <span className={s.cardRows}>
            {rows.map(([k, v]) => (
              <span key={k} className={s.cardRow}>
                <span className={s.cardKey}>{k}</span>
                <span className={s.cardVal}>{v}</span>
              </span>
            ))}
          </span>
        )}
        {extra}
        <span className={s.cardActions}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              data-action
              tabIndex={pinned ? 0 : -1}
              className={i === 0 ? s.cardPrimary : s.cardSecondary}
              onClick={() => run(a)}
            >
              <span>{a.label}</span>
              <Kbd>{a.key}</Kbd>
            </button>
          ))}
        </span>
      </span>
    </>
  );

  return (
    <span
      ref={wrapRef}
      className={s.pillWrap}
      onMouseEnter={() => {
        window.clearTimeout(timer.current);
        // On touch screens and phones the card is a sheet: open it on tap only.
        if (open || !canHover() || inLede()) return;
        timer.current = window.setTimeout(
          () => show(false),
          ctx.openPill ? 40 : 240,
        );
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        if (pinned) return;
        if (!canHover()) return;
        timer.current = window.setTimeout(() => closePill(key), 180);
      }}
      onBlur={(e) => {
        window.clearTimeout(timer.current);
        if (!inside(e.relatedTarget as Node) && !place.sheet) closePill(key);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          closePill(key);
          pillRef.current?.focus();
        }
      }}
    >
      <span
        ref={pillRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={pinned}
        aria-controls={open ? cardId : undefined}
        aria-label={nameFor(variant, label, detail)}
        className={`${s.pill} ${s[`pill_${variant}`]} ${className ?? ""}`}
        data-open={open || undefined}
        onClick={() => (pinned ? closePill(key) : show(true))}
        onFocus={(e) => {
          // A short pause, so tabbing past a handle does not flash its card.
          if (
            !e.currentTarget.matches(":focus-visible") ||
            !canHover() ||
            inLede()
          )
            return;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => show(false), 420);
        }}
        onKeyDown={onPillKey}
      >
        {typeof label === "string" && lead ? (
          <>
            {/* Keep the mark with the first word so it never strands at a line end. */}
            <span className={s.pillLead}>
              {lead}
              <span className={s.pillText}>{label.split(" ")[0]}</span>
            </span>
            {label.includes(" ") && (
              <span className={s.pillText}>
                {label.slice(label.indexOf(" "))}
              </span>
            )}
          </>
        ) : (
          <>
            {lead}
            <span className={s.pillText}>{label}</span>
          </>
        )}
      </span>
      {open && (place.sheet ? createPortal(card, document.body) : card)}
    </span>
  );
}

/* A leading mark, only for bad state: late or stalled. */
function TaskMark({ t }: { t: Task }) {
  if (isLate(t))
    return <span className={s.mark} data-state="late" aria-hidden />;
  if (t.status === "stalled")
    return <span className={s.mark} data-state="stalled" aria-hidden />;
  return null;
}

/* ── variants ────────────────────────────────────────────────── */

const toCardAction = (
  task: Task,
  a: TaskAction,
  act: (id: string, a: TaskAction) => void,
): CardAction => ({
  label: a.label,
  key: a.key,
  run: () => act(task.id, a),
});

export function TaskPill({
  id,
  children,
}: {
  id: string;
  children?: ReactNode;
}) {
  const { task, act, notify } = useEdition();
  const t = task(id);
  const late = isLate(t);
  const owner = PEOPLE[t.owner];
  const defaults: TaskAction[] = [
    { kind: "done", label: "Mark done", key: "D" },
    {
      kind: "reschedule",
      label: "Push a week",
      key: "S",
      to: addDays(t.due && t.due > TODAY ? t.due : TODAY, 7),
    },
  ];
  const actions: CardAction[] =
    t.status === "done"
      ? [
          {
            label: "Open in Tasks",
            key: "O",
            run: () => notify(`Opened “${t.title}” in Tasks`),
          },
          {
            label: "Reopen",
            key: "U",
            run: () =>
              act(t.id, {
                kind: "reschedule",
                label: "Reopen",
                key: "U",
                to: addDays(TODAY, 7),
              }),
          },
        ]
      : (t.actions ?? defaults).map((a) => toCardAction(t, a, act));
  const statusText = t.handled
    ? t.handled
    : late
      ? `Late, due ${fmtShort(t.due!)}`
      : STATUS_WORDS[t.status];
  return (
    <Pill
      variant="task"
      lead={<TaskMark t={t} />}
      label={children ?? t.phrase}
      detail={t.title}
      heading={
        <>
          <StatusGlyph status={t.status} late={late} className={s.cardGlyph} />
          <span>{t.title}</span>
        </>
      }
      sub={projectById(t.project).name}
      rows={[
        [
          "Status",
          <span
            key="s"
            className={
              late
                ? s.toneDanger
                : t.status === "done"
                  ? s.toneSuccess
                  : undefined
            }
          >
            {statusText}
          </span>,
        ],
        [
          "Owner",
          <span key="o" className={s.inlinePerson}>
            <Avatar id={owner.id} size="xs" />
            {owner.name}
          </span>,
        ],
        [
          "Due",
          t.due ? `${fmtShort(t.due)} · ${relative(t.due)}` : "No date yet",
        ],
        ["Latest", t.lastActivity],
      ]}
      actions={actions}
    />
  );
}

export function PersonPill({
  id,
  children,
  possessive,
}: {
  id: PersonId;
  children?: ReactNode;
  possessive?: boolean;
}) {
  const { tasks, notify } = useEdition();
  const p = PEOPLE[id];
  const open = tasks.filter((t) => t.owner === id && t.status !== "done");
  const week = open.filter((t) => t.due && t.due <= WEEK_END);
  const next = [...open]
    .filter((t) => t.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))[0];
  return (
    <Pill
      variant="person"
      label={children ?? (possessive ? `${p.name}’s` : p.name)}
      detail={p.name}
      heading={
        <>
          <Avatar id={id} size="md" />
          <span className={s.personHead}>
            <span>{p.name}</span>
            <span className={s.cardSubInline}>{p.role}</span>
          </span>
        </>
      }
      rows={
        p.client
          ? [
              ["Wedding", "Saturday 3 October, 140 guests"],
              ["Latest", p.lastSeen],
            ]
          : [
              [
                "Open",
                `${open.length} ${open.length === 1 ? "task" : "tasks"}, ${week.length} due this week`,
              ],
              [
                "Next",
                next
                  ? `${next.title}, ${fmtShort(next.due!)}`
                  : "Nothing dated",
              ],
              ["Now", p.lastSeen],
            ]
      }
      actions={[
        {
          label: `Message ${p.name}`,
          key: "M",
          run: () => notify(`Started a message to ${p.name}`),
        },
        p.client
          ? {
              label: "Open client notes",
              key: "O",
              run: () => notify(`Opened notes on ${p.name}`),
            }
          : {
              label: `See ${p.name}’s tasks`,
              key: "O",
              run: () => notify(`Showing ${p.name}’s tasks`),
            },
      ]}
    />
  );
}

export function DatePill({
  iso,
  children,
}: {
  iso: string;
  children: ReactNode;
}) {
  const { tasks, notify } = useEdition();
  const events = (EVENTS[iso] ?? []).slice(0, 3);
  const covered = new Set(events.map((e) => e.taskId).filter(Boolean));
  const due = tasks
    .filter((t) => t.due === iso && t.status !== "done" && !covered.has(t.id))
    .slice(0, 4 - Math.min(events.length, 2));
  return (
    <Pill
      variant="date"
      label={children}
      detail={fmtLong(iso)}
      heading={
        <>
          <span className={s.dateTile} aria-hidden>
            <Calendar />
          </span>
          <span className={s.personHead}>
            <span>{fmtLong(iso)}</span>
            <span className={s.cardSubInline}>{relative(iso)}</span>
          </span>
        </>
      }
      rows={[]}
      extra={
        <span className={s.cardList}>
          {events.map((ev) => (
            <span key={ev.label} className={s.cardEvent}>
              <span className={s.cardEventDot} aria-hidden />
              {ev.label}
            </span>
          ))}
          {events.length > 0 && due.length > 0 && (
            <span className={s.cardDivider} aria-hidden />
          )}
          {due.map((t) => (
            <span key={t.id} className={s.cardTaskRow}>
              <StatusGlyph
                status={t.status}
                late={isLate(t)}
                className={s.cardRowGlyph}
              />
              <span className={s.cardTaskTitle}>{t.title}</span>
              <Avatar id={t.owner} size="xs" />
            </span>
          ))}
          {!events.length && !due.length && (
            <span className={s.cardEvent}>Nothing else on this day</span>
          )}
        </span>
      }
      actions={[
        {
          label: "Open in Timeline",
          key: "O",
          run: () => notify(`Opened Timeline at ${fmtShort(iso)}`),
        },
        {
          label: "Remind me at 08:30",
          key: "R",
          run: () =>
            notify(`You will get a reminder at 08:30 on ${fmtShort(iso)}`),
        },
      ]}
    />
  );
}

export function FilePill({
  id,
  children,
}: {
  id: FileId;
  children?: ReactNode;
}) {
  const { notify } = useEdition();
  const f = FILES[id];
  const waiting = f.ext === "Waiting";
  return (
    <Pill
      variant="file"
      label={children ?? f.name}
      detail={f.name}
      heading={
        <>
          <span className={s.fileTileLg} data-kind={f.kind} aria-hidden>
            {waiting ? "…" : f.ext}
          </span>
          <span className={s.personHead}>
            <span>{f.name}</span>
            <span className={s.cardSubInline}>
              {waiting ? "Not in Files yet" : `${f.ext} · ${f.size}`}
            </span>
          </span>
        </>
      }
      rows={[
        [waiting ? "Asked" : "Updated", `${f.updated} by ${PEOPLE[f.by].name}`],
        ...(waiting
          ? ([["Blocks", "Wine list, then the menu tasting"]] as [
              string,
              ReactNode,
            ][])
          : []),
      ]}
      actions={
        waiting
          ? [
              {
                label: "Chase Ballymaloe",
                key: "C",
                run: () =>
                  notify(
                    "Drafted a chase to Ballymaloe Wines for Niamh to send",
                  ),
              },
              {
                label: "Upload it",
                key: "U",
                run: () =>
                  notify("Drop the quote anywhere on this page to attach it"),
              },
            ]
          : [
              {
                label: "Open",
                key: "O",
                run: () => notify(`Opened ${f.name}`),
              },
              {
                label: "Copy link",
                key: "K",
                run: () => notify("Link copied"),
              },
            ]
      }
    />
  );
}

/* A decision's verb, set inside the sentence that names it. The one most
   urgent decision on the page gets the only filled button. */
export function Act({
  task: id,
  index = 0,
  primary,
  children,
}: {
  task: string;
  index?: number;
  primary?: boolean;
  children: ReactNode;
}) {
  const { task, act } = useEdition();
  const t = task(id);
  const a = t.actions?.[index];
  if (!a) return <>{children}</>;
  return (
    <button
      type="button"
      className={primary ? s.actPrimary : s.act}
      onClick={() => act(t.id, a)}
    >
      {children}
      {primary && <Arrow className={s.actArrow} />}
      <span className={s.actHint} aria-hidden>
        <Kbd>↵</Kbd>
      </span>
    </button>
  );
}

/* A phrase that takes the reader to another part of the page. */
export function Jump({
  to,
  quiet,
  children,
}: {
  to: string;
  /* A small back-reference, like a footnote, rather than a handle. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={quiet ? s.see : s.jump}
      onClick={() => {
        const el = document.getElementById(to);
        if (!el) return;
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        el.focus({ preventScroll: true });
      }}
    >
      <span className={s.jumpText}>{children}</span>
    </button>
  );
}
