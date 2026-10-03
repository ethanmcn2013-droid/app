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
import tasks from "../../tasks/tasks.module.css";
import styles from "./countdown.module.css";

/* ── CountdownPicker: the project pill, and the way between countdowns ── */

export function CountdownPicker({
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
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const active = countdowns.find((c) => c.id === activeId) ?? countdowns[0];
  const items = () =>
    Array.from(
      menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [],
    );
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[n]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  const left = (c: Countdown) => {
    const n = c.day - today;
    return n > 0 ? plural(n, "day") : n === 0 ? "Today" : `${plural(-n, "day")} ago`;
  };

  return (
    <span className={styles.picker}>
      <button
        ref={button}
        type="button"
        className={`${tasks.projectPill} ${styles.pickerButton}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => items()[countdowns.findIndex((c) => c.id === activeId)]?.focus());
        }}
      >
        <span className={tasks.projectDot} style={{ "--dot": active.color } as CSSProperties} aria-hidden="true" />
        <span className={tasks.projectName}>{active.name}</span>
        <Icon name="chevron-down" size={12} className={styles.pickerChevron} />
      </button>
      <AnimatePresence>
        {open ? (
          <>
            <span className={styles.pickerCatch} onClick={() => close(false)} aria-hidden="true" />
            <motion.div
              ref={menu}
              role="menu"
              aria-label="Countdowns"
              className={styles.pickerMenu}
              onKeyDown={onMenuKey}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
            >
              {countdowns.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={c.id === activeId}
                  className={styles.pickerItem}
                  onClick={() => {
                    onPick(c.id);
                    close();
                  }}
                >
                  <span className={styles.tabDot} style={{ "--cd": c.color } as CSSProperties} aria-hidden="true" />
                  <span className={styles.tabText}>
                    <span className={styles.tabName}>{c.name}</span>
                    <span className={styles.tabMeta}>
                      {left(c)} · {fmtShort(c.day)}
                    </span>
                  </span>
                  {i < 9 ? <kbd className={styles.kbdInline}>{i + 1}</kbd> : null}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className={styles.pickerNew}
                onClick={() => {
                  onNew();
                  close();
                }}
              >
                <Icon name="plus" size={14} />
                New countdown
              </button>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </span>
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
  children?: React.ReactNode;
}) {
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
      ? "Off track"
      : h.tone === "risk"
        ? "At risk"
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
      <section className={styles.hero} data-tone={h.tone} aria-label={`${countdown.name}, the countdown`}>
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
            {children}
          </div>

          <div className={styles.heroStatus}>
            {empty ? (
              <p className={styles.statusEmpty}>
                Add the first few things that have to happen, and this is where
                you will see if you are on track.
              </p>
            ) : (
              <div className={styles.readiness}>
                <ReadinessRing
                  done={ringTotal ? ringDone : 0}
                  late={ringLate}
                  total={ringTotal || 1}
                  label={ringTotal > 0}
                  size={52}
                  stroke={5}
                />
                <div className={styles.readinessText}>
                  <span className={styles.readinessBig}>
                    <span className={styles.verdict} data-tone={h.tone}>
                      {h.tone === "behind" ? <Icon name="alert" size={14} /> : null}
                      {toneWord}
                    </span>
                  </span>
                  <span className={styles.readinessSub}>
                    {ringTotal === 0
                      ? firstDue !== null
                        ? `The first task is due ${fmtShort(firstDue)}`
                        : "Add a task to start the count"
                      : h.tone === "passed" || h.tone === "day"
                        ? `${ringDone} of ${ringTotal} done across the plan`
                        : `${ringDone} of ${ringTotal} due so far are done`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
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
