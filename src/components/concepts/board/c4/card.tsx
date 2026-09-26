"use client";

import { motion } from "motion/react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { STAGE_BY_KEY, dayLabel, type Person } from "./data";
import { ageLevel, ageText, daysText, type Placed } from "./model";
import { AgeRing, Avatar, BlockerLine } from "./parts";
import { Icon } from "./icons";
import styles from "./flow.module.css";

const LAYOUT = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

export function weatherOf(p: Placed) {
  if (p.stage === "done") return 0;
  if (p.age >= 12) return 2;
  if (p.age >= 7) return 1;
  return 0;
}

export function AgedCard({
  placed,
  usual,
  owner,
  approver,
  day,
  nudged,
  selected,
  canDrag,
  fresh = false,
  onOpen,
  onRing,
  onRingLeave,
  onDragStart,
  onDragEnd,
  onKey,
}: {
  placed: Placed;
  usual: number;
  owner?: Person;
  approver?: Person;
  day: number;
  nudged: boolean;
  selected: boolean;
  canDrag: boolean;
  /** Replaying: this card arrived on the day being shown. */
  fresh?: boolean;
  onOpen: () => void;
  onRing: (el: HTMLElement) => void;
  onRingLeave: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { card, stage, age, sentBack } = placed;
  const weather = weatherOf(placed);
  const level = ageLevel(age, usual);
  const done = stage === "done";
  const label = done
    ? `${card.title}. Done ${dayLabel(placed.since)}.`
    : `${card.title}. In ${STAGE_BY_KEY[stage].name} for ${daysText(age)}, usually ${daysText(usual)}.${card.blocker && stage === "waiting" ? ` Waiting on ${card.blocker.who}.` : ""}${sentBack ? " Sent back once." : ""}`;

  return (
    <motion.div layout="position" layoutId={card.id} transition={LAYOUT} className={styles.cardWrap} data-weather={weather || undefined}>
      <div
        className={styles.card}
        data-done={done || undefined}
        data-selected={selected || undefined}
        data-fresh={fresh || undefined}
        data-level={done ? undefined : level}
        role="button"
        tabIndex={0}
        aria-label={label}
        draggable={canDrag}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        onKeyDown={onKey}
      >
        <p className={styles.cardTitle}>{card.title}</p>
        {sentBack > 0 && !done ? (
          <span className={styles.tag}>
            <Icon.undo size={12} />
            {sentBack === 1 ? "Sent back once" : `Sent back ${sentBack} times`}
          </span>
        ) : null}
        {card.blocker && stage === "waiting" ? <BlockerLine who={card.blocker.who} since={card.blocker.since} day={day} /> : null}
        {nudged && !done ? (
          <p className={styles.nudged}>
            <Icon.bell size={12} />
            Nudged {approver ? approver.first : "them"} today
          </p>
        ) : null}
        <div className={styles.cardFoot}>
          <span className={styles.who}>
            <Avatar person={owner} />
            <span className={styles.whoText}>
              {owner?.first}
              {approver && stage === "review" ? (
                <span className={styles.forWho}>
                  <Icon.arrowRight size={11} />
                  <span className={styles.srOnly}>for</span>
                  {approver.first}
                </span>
              ) : null}
            </span>
          </span>
          {done ? (
            <span className={styles.doneWhen}>
              <Icon.check size={13} />
              {dayLabel(placed.since) === "today" ? "Today" : dayLabel(placed.since).replace(/^./, (c) => c.toUpperCase())}
            </span>
          ) : (
            <span
              className={styles.age}
              data-level={level}
              onMouseEnter={(e: MouseEvent<HTMLSpanElement>) => onRing(e.currentTarget)}
              onMouseLeave={onRingLeave}
            >
              <AgeRing age={age} usual={usual} />
              <span>{ageText(age)}</span>
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function PackCard({
  items,
  approver,
  onUnpack,
  onOpen,
}: {
  items: Placed[];
  approver?: Person;
  onUnpack: () => void;
  onOpen: (id: string) => void;
}) {
  const oldest = Math.max(...items.map((p) => p.age));
  return (
    <motion.div
      layout
      layoutId="review-pack"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={LAYOUT}
      className={styles.packWrap}
    >
      <div className={styles.pack}>
        <div className={styles.packHead}>
          <span className={styles.packIcon}>
            <Icon.stack size={15} />
          </span>
          <div>
            <p className={styles.packTitle}>Review pack for {approver?.first ?? "sign-off"}</p>
            <p className={styles.packSub}>
              {items.length} to approve · oldest {daysText(oldest)}
            </p>
          </div>
        </div>
        <ul className={styles.packList}>
          {items.map((p) => (
            <li key={p.card.id}>
              <button type="button" className={styles.packItem} onClick={() => onOpen(p.card.id)}>
                <span className={styles.packItemTitle}>{p.card.title}</span>
                <span className={styles.packItemAge}>{p.age}d</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.packFoot}>
          <span className={styles.packSent}>
            <Icon.check size={13} />
            Sent today
          </span>
          <button type="button" className={styles.linkButton} onClick={onUnpack}>
            Unpack
          </button>
        </div>
      </div>
    </motion.div>
  );
}
