"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { PROJECTS, projectById, type Item } from "./data";
import { useRiver } from "./ctx";
import { fmtDay, mondayOf, type Lens } from "./model";
import { Avatars, Icon, ProjectDot } from "./parts";
import styles from "./river.module.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export type LensCount = Record<Lens, number>;

const LENSES = (counts: LensCount): { id: Lens; label: string; count: number }[] => [
  { id: "all", label: "Everything", count: counts.all },
  { id: "mine", label: "Mine", count: counts.mine },
  ...PROJECTS.map((p) => ({ id: p.id as Lens, label: p.name, count: counts[p.id] })),
];

export function LensRail({
  lens,
  setLens,
  counts,
  undated,
  firstRun,
}: {
  lens: Lens;
  setLens: (l: Lens) => void;
  counts: LensCount;
  undated: Item[];
  firstRun?: boolean;
}) {
  return (
    <aside className={styles.rail} aria-label="Filters and undated tasks">
      <div className={styles.railInner}>
        <p className={styles.railHead} id="river-lens-head">
          Show
        </p>
        <ul className={styles.lensList} role="radiogroup" aria-labelledby="river-lens-head">
          {LENSES(counts).map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="radio"
                aria-checked={lens === l.id}
                className={cx(styles.lens, lens === l.id && styles.lensOn)}
                onClick={() => setLens(l.id)}
              >
                <span className={styles.lensIcon} aria-hidden="true">
                  {l.id === "all" ? (
                    <Icon name="calendar" size={14} />
                  ) : l.id === "mine" ? (
                    <Icon name="person" size={14} />
                  ) : (
                    <ProjectDot project={l.id as keyof typeof projectById} size={9} />
                  )}
                </span>
                <span className={styles.lensLabel}>{l.label}</span>
                <span className={styles.lensCount}>{l.count || ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {firstRun ? (
          <p className={styles.railNote}>
            {undated.length} {undated.length === 1 ? "task needs" : "tasks need"} a date. They are waiting in the middle of the page.
          </p>
        ) : (
          <NeedsDate undated={undated} />
        )}
        <p className={styles.railFoot}>
          <kbd className={styles.kbd}>?</kbd> Keyboard shortcuts
        </p>
      </div>
    </aside>
  );
}

export function LensChips({ lens, setLens, counts }: { lens: Lens; setLens: (l: Lens) => void; counts: LensCount }) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label="Show">
      {LENSES(counts).map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lens === l.id}
          className={cx(styles.lensChip, lens === l.id && styles.lensChipOn)}
          onClick={() => setLens(l.id)}
        >
          {l.id !== "all" && l.id !== "mine" && <ProjectDot project={l.id as keyof typeof projectById} />}
          {l.id === "all" || l.id === "mine" ? l.label : projectById[l.id as keyof typeof projectById].short}
        </button>
      ))}
    </div>
  );
}

export function NeedsDate({ undated, inline }: { undated: Item[]; inline?: boolean }) {
  const api = useRiver();
  const receiving = api.dragId !== null && api.overDay === "none";
  return (
    <section
      className={cx(styles.needs, inline && styles.needsInline, receiving && styles.needsReceiving)}
      data-drop-day="none"
      aria-labelledby="river-needs-head"
    >
      <h2 className={styles.needsHead} id="river-needs-head">
        <Icon name="inbox" size={14} />
        Needs a date
        <span className={styles.needsCount}>{undated.length}</span>
      </h2>
      {undated.length === 0 ? (
        <p className={styles.needsEmpty}>Every task has a day. Nice and tidy.</p>
      ) : (
        <>
          <p className={styles.needsHint}>Drag one onto a day, or pick a day below.</p>
          <ul className={styles.needsList}>
            <AnimatePresence initial={false}>
              {undated.map((it) => (
                <NeedsItem key={it.id} item={it} />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </section>
  );
}

function NeedsItem({ item }: { item: Item }) {
  const api = useRiver();
  const g = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType !== "mouse") return;
    if ((e.target as HTMLElement).closest("button")) return;
    g.current = { x: e.clientX, y: e.clientY, on: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s) return;
    if (!s.on && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 5) {
      s.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      api.dragStart(item.id, e.clientX, e.clientY);
    }
    if (s.on) api.dragMove(e.clientX, e.clientY);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (g.current?.on) api.dragEnd(e.type === "pointerup");
    g.current = null;
  };
  const nextMon = mondayOf(0) + 7;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: api.dragId === item.id ? 0.4 : 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={styles.needsLi}
    >
      <div className={styles.needsItem} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <ProjectDot project={item.project} />
        <span className={styles.needsTitle}>{item.title}</span>
        <span className={styles.needsQuick}>
          <button type="button" className={styles.miniChip} onClick={() => api.move(item.id, 0, "menu")} aria-label={`Move ${item.title} to today`}>
            Today
          </button>
          <button type="button" className={styles.miniChip} onClick={() => api.move(item.id, 1, "menu")} aria-label={`Move ${item.title} to tomorrow`}>
            Tmrw
          </button>
          <button type="button" className={styles.miniChip} onClick={() => api.move(item.id, nextMon, "menu")} aria-label={`Move ${item.title} to next Monday`}>
            Mon
          </button>
        </span>
      </div>
    </motion.li>
  );
}

export function FirstRun({ undated }: { undated: Item[] }) {
  const api = useRiver();
  const nextMon = mondayOf(0) + 7;
  return (
    <motion.section
      className={styles.firstRun}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      aria-labelledby="river-first-head"
    >
      <div className={styles.firstArt} aria-hidden="true">
        <span className={styles.firstLine} />
        <span className={cx(styles.firstLine, styles.firstLineShort)} />
        <span className={styles.firstDiamond} />
        <span className={cx(styles.firstLine, styles.firstLineMid)} />
      </div>
      <h2 className={styles.firstHead} id="river-first-head">
        Your calendar fills in as tasks get dates.
      </h2>
      <p className={styles.firstText}>
        {undated.length} {undated.length === 1 ? "task needs" : "tasks need"} one. Pick a day for each and it takes its place in the stream, in order.
      </p>
      <ul className={styles.firstList}>
        <AnimatePresence initial={false}>
          {undated.map((it) => (
            <motion.li
              key={it.id}
              layout
              className={styles.firstItem}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
            >
              <ProjectDot project={it.project} />
              <span className={styles.firstTitle}>{it.title}</span>
              <Avatars people={it.people} max={1} />
              <span className={styles.firstPick}>
                <button type="button" className={styles.chip} onClick={() => api.move(it.id, 0, "menu")}>
                  Today
                </button>
                <button type="button" className={styles.chip} onClick={() => api.move(it.id, 1, "menu")}>
                  Tomorrow
                </button>
                <button type="button" className={styles.chip} onClick={() => api.move(it.id, nextMon, "menu")}>
                  {fmtDay(nextMon)}
                </button>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

export function EmptyAhead({ lens, onReset }: { lens: Lens; onReset: () => void }) {
  const project = PROJECTS.find((p) => p.id === lens);
  const text =
    lens === "crumb"
      ? "Nothing coming up for Crumb & Co. The launch is done."
      : project
        ? `Nothing coming up for ${project.name}.`
        : "Nothing coming up for you.";
  return (
    <motion.div
      className={styles.emptyAhead}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <span className={styles.emptyMark} aria-hidden="true">
        <Icon name="check" size={18} />
      </span>
      <p className={styles.emptyHead}>{text}</p>
      <p className={styles.emptyText}>
        {lens === "crumb" ? "Everything above is done. Add a follow-up if the client comes back, or look at the other projects." : "Add something below, or look at everything."}
      </p>
      <button type="button" className={styles.chip} onClick={onReset}>
        Show everything
      </button>
    </motion.div>
  );
}

