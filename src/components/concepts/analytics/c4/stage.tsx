"use client";

import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  COLUMNS,
  dueAt,
  fmtDay,
  groupName,
  personName,
  plural,
  type Placed,
  type Replay,
  type Snapshot,
  type Status,
  type Task,
} from "./model";
import styles from "./c4.module.css";

export type ColourBy = "group" | "person";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function toneOf(p: Replay, t: Task, by: ColourBy) {
  if (by === "person")
    return p.people.find((x) => x.id === t.person)?.tone ?? 5;
  return p.groups.find((g) => g.id === t.group)?.tone ?? 5;
}

const STATUS_WORD: Record<Status, string> = {
  todo: "To do",
  doing: "Doing",
  waiting: "Waiting",
  done: "Done",
};

type Hover = { placed: Placed; x: number; y: number; below: boolean } | null;

/**
 * The board at one moment: four columns, one square per task, stacked from
 * the bottom in the order they arrived. Squares carry a layoutId, so when the
 * day changes each one glides to its new column (FLIP via motion/react).
 */
export function Stage({
  p,
  snap,
  prev,
  by,
  focusIds,
  tracedId,
  onPick,
  reduced,
  animate,
  label,
}: {
  p: Replay;
  snap: Snapshot;
  /** A week earlier, for the small change under each count. */
  prev: Snapshot | null;
  by: ColourBy;
  /** When set, every other square dims. */
  focusIds: Set<string> | null;
  tracedId: string | null;
  onPick: (t: Task) => void;
  reduced: boolean;
  /** Shared-layout motion on (the main stage), or static (the compare split). */
  animate: boolean;
  label?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [sq, setSq] = useState<number | null>(null);

  // Pick the largest square that lets every column hold its busiest day, so
  // nothing ever spills out of the stage during the replay.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      let best = 16;
      el.querySelectorAll<HTMLElement>("[data-stack]").forEach((stack) => {
        const key = stack.dataset.stack as Status;
        const n = Math.max(1, p.series.most[key]);
        const cs = getComputedStyle(stack);
        const gap = parseFloat(cs.columnGap) || 4;
        const w =
          stack.clientWidth -
          parseFloat(cs.paddingLeft) -
          parseFloat(cs.paddingRight);
        const h =
          stack.clientHeight -
          parseFloat(cs.paddingTop) -
          parseFloat(cs.paddingBottom);
        let s = 16;
        while (s > 3) {
          const perRow = Math.max(1, Math.floor((w + gap) / (s + gap)));
          if (Math.ceil(n / perRow) * (s + gap) - gap <= h) break;
          s -= 0.5;
        }
        best = Math.min(best, s);
      });
      setSq(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p]);

  const show = (placed: Placed, el: HTMLElement) => {
    const host = wrap.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!host) return;
    const y = r.top - host.top;
    setHover({
      placed,
      x: Math.min(
        Math.max(r.left - host.left + r.width / 2, 120),
        host.width - 120,
      ),
      y,
      below: y < 110,
    });
  };

  const board = (
    <div className={styles.columns} data-compact={animate ? undefined : ""}>
      {COLUMNS.map((c) => {
        const items = snap.cols[c.key];
        const before = prev ? prev.cols[c.key].length : null;
        const change = before === null ? 0 : items.length - before;
        return (
          <div key={c.key} className={styles.column} data-col={c.key}>
            <div className={styles.colHead}>
              <span className={styles.colName}>{c.name}</span>
              <span className={styles.colCount}>{items.length}</span>
              {prev && change !== 0 ? (
                <span
                  className={styles.colChange}
                  title="Change over the previous 7 days"
                >
                  {change > 0 ? `+${change}` : `−${-change}`}
                </span>
              ) : null}
            </div>
            <div className={styles.stack} data-stack={c.key}>
              {p.block === 5 ? (
                <Blocks
                  p={p}
                  items={items}
                  by={by}
                  dim={!!focusIds}
                  animate={animate && !reduced}
                />
              ) : (
                items.map((it) => {
                  const t = it.task;
                  const tone = toneOf(p, t, by);
                  const dim = focusIds ? !focusIds.has(t.id) : false;
                  const isNew =
                    animate &&
                    !reduced &&
                    t.created >= snap.day - 1 &&
                    snap.day > 0 &&
                    it.status === "todo";
                  const style: Vars = { "--tone": `var(--c4-tone-${tone})` };
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      tabIndex={-1}
                      layoutId={
                        animate && !reduced ? `sq-${p.id}-${t.id}` : undefined
                      }
                      initial={isNew ? { opacity: 0, y: -22 } : false}
                      animate={{ opacity: dim ? 0.14 : 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 36,
                        mass: 0.7,
                        opacity: { duration: 0.22 },
                      }}
                      className={styles.sq}
                      style={style}
                      data-late={it.late ? "" : undefined}
                      data-dim={dim ? "" : undefined}
                      data-lit={focusIds && !dim ? "" : undefined}
                      data-traced={tracedId === t.id ? "" : undefined}
                      aria-label={`${t.title}, ${STATUS_WORD[it.status].toLowerCase()}`}
                      onClick={() => onPick(t)}
                      onMouseEnter={(e) => show(it, e.currentTarget)}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      ref={wrap}
      className={styles.stageWrap}
      style={sq ? ({ "--c4-sq": `${sq}px` } as Vars) : undefined}
      onMouseLeave={() => setHover(null)}
    >
      {label ? <div className={styles.splitLabel}>{label}</div> : null}
      {animate && !reduced ? (
        <LayoutGroup id={`stage-${p.id}`}>{board}</LayoutGroup>
      ) : (
        board
      )}
      {hover ? <SquareTip p={p} hover={hover} day={snap.day} /> : null}
    </div>
  );
}

function SquareTip({
  p,
  hover,
  day,
}: {
  p: Replay;
  hover: NonNullable<Hover>;
  day: number;
}) {
  const { placed, x, y, below } = hover;
  const t = placed.task;
  const due = dueAt(t, day);
  const since = day - placed.since;
  const where =
    placed.status === "done"
      ? `Finished ${fmtDay(p, t.done ?? day)}`
      : placed.status === "waiting"
        ? `Waiting on ${t.waits.find((w) => w.from <= day && day < w.to)?.on ?? "someone"}, ${plural(since, "day")}`
        : placed.status === "doing"
          ? `Doing for ${plural(since, "day")}`
          : `To do, due ${fmtDay(p, due)}`;
  return (
    <div
      className={styles.tip}
      style={{ left: x, top: below ? y + 22 : y - 8 }}
      data-below={below ? "" : undefined}
      role="tooltip"
    >
      <div className={styles.tipTitle}>{t.title}</div>
      <div className={styles.tipMeta}>
        {groupName(p, t.group)} · {personName(p, t.person)}
      </div>
      <div className={styles.tipLine}>{where}</div>
      {placed.late ? (
        <div className={styles.tipLate}>Late: was due {fmtDay(p, due)}</div>
      ) : null}
      {placed.slips > 0 ? (
        <div className={styles.tipLine}>
          Date moved {plural(placed.slips, "time")}
        </div>
      ) : null}
      <div className={styles.tipHint}>Click to follow its story</div>
    </div>
  );
}

/** Large Projects: one square per five tasks of a group, the last one part-filled. */
function Blocks({
  p,
  items,
  by,
  dim,
  animate,
}: {
  p: Replay;
  items: Placed[];
  by: ColourBy;
  dim: boolean;
  animate: boolean;
}) {
  const keys =
    by === "group" ? p.groups.map((g) => g.id) : p.people.map((x) => x.id);
  const blocks: { key: string; tone: number; fill: number; name: string }[] =
    [];
  for (const k of keys) {
    const n = items.filter(
      (it) => (by === "group" ? it.task.group : it.task.person) === k,
    ).length;
    const tone =
      by === "group"
        ? (p.groups.find((g) => g.id === k)?.tone ?? 5)
        : (p.people.find((x) => x.id === k)?.tone ?? 5);
    const name = by === "group" ? groupName(p, k) : personName(p, k);
    for (let i = 0; i < Math.ceil(n / 5); i++)
      blocks.push({
        key: `${k}-${i}`,
        tone,
        fill: Math.min(5, n - i * 5),
        name,
      });
  }
  return (
    <>
      {blocks.map((b) => {
        const style: Vars = {
          "--tone": `var(--c4-tone-${b.tone})`,
          "--fill": `${(b.fill / 5) * 100}%`,
        };
        return (
          <motion.span
            key={b.key}
            layout={animate ? "position" : false}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={styles.block}
            style={style}
            data-part={b.fill < 5 ? "" : undefined}
            data-dim={dim ? "" : undefined}
            title={`${b.name}: ${plural(b.fill, "task")}`}
          />
        );
      })}
    </>
  );
}
