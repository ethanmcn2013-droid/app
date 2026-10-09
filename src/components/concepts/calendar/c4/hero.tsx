"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import type { Countdown, Task } from "./data";
import { fmtLong, fmtShort, plural, type Health } from "./model";
import { Diamond, Icon, ReadinessRing } from "./parts";
import styles from "./countdown.module.css";

/* ── CountdownSwitcher ─────────────────────────────────────────────── */

export function CountdownSwitcher({
  countdowns,
  activeId,
  today,
  onPick,
  onNew,
}: {
  countdowns: Countdown[];
  activeId: string;
  today: number;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = countdowns.findIndex((c) => c.id === activeId);
    const next =
      countdowns[
        (i + (e.key === "ArrowRight" ? 1 : -1) + countdowns.length) %
          countdowns.length
      ];
    onPick(next.id);
    e.preventDefault();
    requestAnimationFrame(() =>
      document.getElementById(`cd-tab-${next.id}`)?.focus(),
    );
  };
  return (
    <div
      className={styles.switcher}
      role="tablist"
      aria-label="Countdowns"
      onKeyDown={onKey}
    >
      {countdowns.map((c, i) => {
        const left = c.day - today;
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            id={`cd-tab-${c.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={styles.tab}
            data-active={active || undefined}
            style={{ "--cd": c.color } as CSSProperties}
            onClick={() => onPick(c.id)}
          >
            <span className={styles.tabDot} aria-hidden="true" />
            <span className={styles.tabText}>
              <span className={styles.tabName}>{c.name}</span>
              <span className={styles.tabMeta}>
                {left > 0
                  ? plural(left, "day")
                  : left === 0
                    ? "Today"
                    : `${plural(-left, "day")} ago`}{" "}
                · {fmtShort(c.day)}
              </span>
            </span>
            {i < 9 ? (
              <kbd className={`${styles.kbdInline} ${styles.tabKey}`}>
                {i + 1}
              </kbd>
            ) : null}
            {active ? (
              <motion.span
                layoutId="cd-tab-bar"
                className={styles.tabBar}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
      <button type="button" className={styles.tabNew} onClick={onNew}>
        <Icon name="plus" size={14} />
        New countdown
      </button>
    </div>
  );
}

/* ── The big number ────────────────────────────────────────────────── */

function BigNumber({
  value,
  atDay,
  passed,
}: {
  value: number;
  atDay: boolean;
  passed: boolean;
}) {
  const reduce = useReducedMotion();
  const numRef = useRef<HTMLSpanElement | null>(null);
  const shown = useRef(value);
  const [landed, setLanded] = useState(atDay);

  // Count the number towards its new value (and down to zero on the way into "The day").
  useLayoutEffect(() => {
    const target = atDay ? 0 : value;
    const from = shown.current;
    const write = (v: number) => {
      shown.current = v;
      if (numRef.current) numRef.current.textContent = String(Math.round(v));
    };
    if (!atDay) {
      queueMicrotask(() => setLanded(false));
    }
    write(from);
    if (reduce || from === target) {
      write(target);
      if (atDay) queueMicrotask(() => setLanded(true));
      return;
    }
    const controls = animate(from, target, {
      duration: Math.min(0.9, 0.25 + Math.abs(target - from) * 0.03),
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: write,
      onComplete: () => {
        if (atDay) setLanded(true);
      },
    });
    return () => controls.stop();
  }, [value, atDay, reduce]);

  const unit = passed
    ? Math.abs(value) === 1
      ? "day ago"
      : "days ago"
    : value === 1
      ? "day to go"
      : "days to go";

  return (
    <div className={styles.big} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        {landed ? (
          <motion.span
            key="day"
            className={styles.bigDay}
            initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          >
            The day
          </motion.span>
        ) : (
          <motion.span
            key="num"
            className={styles.bigRow}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <span ref={numRef} className={styles.bigNum}>
              {atDay ? 0 : value}
            </span>
            <span className={styles.bigUnit}>{unit}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── CountdownHero ─────────────────────────────────────────────────── */

export function CountdownHero({
  countdown,
  base,
  health: h,
  today,
  atDay,
  previewing,
  locked,
  moveOpen,
  onMove,
  onRename,
  children,
}: {
  countdown: Countdown;
  base: Countdown;
  health: Health;
  today: number;
  atDay: boolean;
  previewing: boolean;
  locked?: boolean;
  moveOpen: boolean;
  onMove: () => void;
  onRename: (name: string) => void;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const left = countdown.day - today;
  const passed = left < 0;
  const empty = countdown.tasks.length === 0;
  const ringTotal =
    h.tone === "passed" || h.tone === "day"
      ? countdown.tasks.length
      : h.dueSoFar;
  const ringDone =
    h.tone === "passed" || h.tone === "day"
      ? countdown.tasks.filter((t) => t.done).length
      : h.doneSoFar;
  const ringLate = h.tone === "passed" || h.tone === "day" ? 0 : h.late.length;
  const open = countdown.tasks
    .filter((t) => !t.done && t.due >= today)
    .map((t) => t.due);
  const firstDue = open.length ? Math.min(...open) : null;
  const toneWord =
    h.tone === "behind"
      ? "Behind"
      : h.tone === "passed"
        ? "Wrapping up"
        : h.tone === "day"
          ? "Today"
          : "On track";

  return (
    <>
      {/* Phone: the hero folds into this sticky strip. */}
      <div className={styles.strip} data-tone={h.tone}>
        <span className={styles.stripNum}>
          {passed
            ? `${plural(-left, "day")} ago`
            : left === 0 || atDay
              ? "The day"
              : plural(left, "day")}
        </span>
        <span className={styles.stripDot} aria-hidden="true" />
        <span className={styles.stripTone} data-tone={h.tone}>
          {empty ? "No tasks yet" : toneWord}
        </span>
        <span className={styles.stripSpacer} />
        {!empty ? (
          <ReadinessRing
            done={ringDone}
            late={ringLate}
            total={ringTotal}
            size={28}
            stroke={4}
            label={false}
          />
        ) : null}
        <button
          type="button"
          className={styles.stripMove}
          onClick={onMove}
          aria-expanded={moveOpen}
        >
          <Icon name="calendar" size={14} />
          <span className={styles.srOnly}>Move the big date</span>
        </button>
      </div>
      <header className={styles.hero} data-tone={h.tone}>
        <div className={styles.heroMain}>
          <div
            className={styles.heroNumber}
            data-preview={previewing || undefined}
          >
            <BigNumber
              value={Math.abs(left)}
              atDay={(atDay && left > 0) || left === 0}
              passed={passed}
            />
            {previewing ? (
              <span className={styles.previewTag}>
                was {plural(base.day - today, "day")}
              </span>
            ) : null}
          </div>

          <div className={styles.heroWhat}>
            <div className={styles.heroKind}>
              <span className={styles.heroSwatch} aria-hidden="true" />
              {countdown.kind}
            </div>
            {editing ? (
              <input
                className={`${styles.title} ${styles.titleInput}`}
                defaultValue={countdown.name}
                autoFocus
                aria-label="Countdown name"
                onBlur={(e) => {
                  onRename(e.currentTarget.value.trim() || countdown.name);
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
            ) : (
              <h1
                className={styles.title}
                onDoubleClick={() => setEditing(true)}
                title="Double-click to rename"
              >
                {countdown.name}
              </h1>
            )}
            <div className={styles.heroDateRow}>
              <button
                type="button"
                className={styles.dateButton}
                onClick={onMove}
                disabled={locked}
                aria-expanded={moveOpen}
                aria-haspopup="dialog"
                data-open={moveOpen || undefined}
              >
                <Icon name="calendar" size={15} />
                <span>{fmtLong(countdown.day)}</span>
                <span className={styles.dateButtonHint}>Move the big date</span>
                <kbd className={styles.kbdInline}>M</kbd>
              </button>
            </div>
            {children}
          </div>

          <div className={styles.heroStatus}>
            {empty ? (
              <p className={styles.statusEmpty}>
                Add the first few things that have to happen, and this is where
                you will see if you are on track.
              </p>
            ) : (
              <>
                <div className={styles.readiness}>
                  <ReadinessRing
                    done={ringTotal ? ringDone : 0}
                    late={ringLate}
                    total={ringTotal || 1}
                    label={ringTotal > 0}
                  />
                  <div className={styles.readinessText}>
                    <span className={styles.readinessBig}>
                      {ringTotal === 0
                        ? "Nothing due yet"
                        : h.tone === "passed" || h.tone === "day"
                          ? `${ringDone} of ${ringTotal} done`
                          : `${ringDone} of ${ringTotal} on track`}
                    </span>
                    <span className={styles.readinessSub}>
                      {ringTotal === 0
                        ? firstDue !== null
                          ? `The first task is due ${fmtShort(firstDue)}`
                          : "Add a task to start the count"
                        : h.tone === "passed" || h.tone === "day"
                          ? "Across the whole plan"
                          : "Done, out of everything due so far"}
                    </span>
                  </div>
                </div>
                <p className={styles.status} data-tone={h.tone}>
                  <span className={styles.statusLead}>
                    {h.tone === "behind" ? (
                      <Icon name="alert" size={14} />
                    ) : null}
                    {h.lead}
                  </span>{" "}
                  {h.rest}
                </p>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

/* ── Move the big date ─────────────────────────────────────────────── */

export function MoveDatePanel({
  base,
  shift,
  today,
  onShift,
  onCancel,
  onConfirm,
}: {
  base: Countdown;
  shift: number;
  today: number;
  onShift: (s: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const newDay = base.day + shift;
  const min = Math.max(-21, today + 1 - base.day);
  const intoPast: Task[] = base.tasks
    .filter((t) => !t.done && t.due >= today && t.due + shift < today)
    .sort((a, b) => a.due - b.due);
  const outOfPast: Task[] = base.tasks.filter(
    (t) => !t.done && t.due < today && t.due + shift >= today,
  );
  const direction = shift === 0 ? null : shift > 0 ? "later" : "earlier";

  return (
    <motion.div
      role="dialog"
      aria-label="Move the big date"
      className={styles.movePanel}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" && shift !== 0) onConfirm();
      }}
    >
      <div className={styles.moveHead}>
        <h2 className={styles.moveTitle}>Move the big date</h2>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onCancel}
          aria-label="Close"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <p className={styles.moveLede}>
        The whole runway slides with it. Every task keeps its distance to the
        day.
      </p>

      <div className={styles.moveDates}>
        <span className={styles.moveFrom} data-dim={shift !== 0 || undefined}>
          {fmtShort(base.day)}
        </span>
        <Icon name="arrow-right" size={14} className={styles.moveArrow} />
        <span className={styles.moveTo}>{fmtShort(newDay)}</span>
        <span className={styles.moveDelta}>
          {direction
            ? `${plural(Math.abs(shift), "day")} ${direction}`
            : "No change yet"}
        </span>
      </div>

      <div className={styles.sliderWrap}>
        <input
          type="range"
          min={min}
          max={21}
          step={1}
          value={shift}
          onChange={(e) => onShift(Number(e.currentTarget.value))}
          className={styles.slider}
          aria-label="Days to move the big date"
          aria-valuetext={
            direction
              ? `${plural(Math.abs(shift), "day")} ${direction}, ${fmtShort(newDay)}`
              : "No change"
          }
          autoFocus
          style={
            {
              "--p": `${((shift - min) / (21 - min)) * 100}%`,
              "--z": `${((0 - min) / (21 - min)) * 100}%`,
            } as CSSProperties
          }
        />
        <div className={styles.sliderScale} aria-hidden="true">
          <span>{plural(Math.abs(min), "day")} earlier</span>
          <span>Today&rsquo;s plan</span>
          <span>3 weeks later</span>
        </div>
      </div>

      <div className={styles.moveQuick}>
        {[-7, -1, 1, 7].map((d) => (
          <button
            key={d}
            type="button"
            className={styles.quick}
            disabled={shift + d < min || shift + d > 21}
            onClick={() => onShift(shift + d)}
          >
            {d < 0 ? "−" : "+"}
            {Math.abs(d) === 7 ? "1 week" : "1 day"}
          </button>
        ))}
      </div>

      <div
        className={styles.moveImpact}
        data-tone={intoPast.length ? "warn" : "ok"}
      >
        {intoPast.length ? (
          <>
            <p className={styles.impactHead}>
              <Icon name="alert" size={14} />
              {plural(intoPast.length, "task")} would now fall in the past
            </p>
            <ul className={styles.impactList}>
              {intoPast.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <span>{t.title}</span>
                  <span className={styles.impactWhen}>
                    {fmtShort(t.due + shift)}
                  </span>
                </li>
              ))}
              {intoPast.length > 5 ? (
                <li className={styles.impactMore}>
                  and {intoPast.length - 5} more
                </li>
              ) : null}
            </ul>
            <p className={styles.impactFoot}>
              They will join Running late. Nothing is lost.
            </p>
          </>
        ) : (
          <p className={styles.impactHead}>
            <Icon name="check" size={14} />
            {shift === 0
              ? "Drag the slider to see what moves."
              : outOfPast.length
                ? `Nothing falls in the past, and ${plural(outOfPast.length, "late task")} would be back on time.`
                : "Nothing falls in the past."}
          </p>
        )}
      </div>

      <div className={styles.checkpointShift}>
        {base.checkpoints.map((k) => (
          <span key={k.id} className={styles.checkpointShiftItem}>
            <Diamond size={9} />
            {k.name}{" "}
            <span className={styles.impactWhen}>{fmtShort(k.day + shift)}</span>
          </span>
        ))}
      </div>

      <div className={styles.moveActions}>
        <button type="button" className={styles.buttonGhost} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={onConfirm}
          disabled={shift === 0}
        >
          Move to {fmtShort(newDay)}
        </button>
      </div>
    </motion.div>
  );
}
