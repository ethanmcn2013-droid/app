"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { CSSProperties, DragEvent } from "react";
import clsx from "clsx";
import type { Project, Task } from "./data";
import { clock, roughly } from "./model";
import { IconCheck, IconChevronDown, IconUndo } from "./icons";
import { ProjectDot } from "./parts";
import s from "./desk.module.css";

/** A stable, gentle tilt for each finished card, so the pile looks handled. */
export function tiltFor(id: string): { r: number; x: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const r = ((h % 70) / 10 - 3.5) * 0.9;
  const x = ((h >> 3) % 9) - 4;
  return { r: Math.round(r * 10) / 10, x };
}

const SHOWN = 6;

export function RollingCount({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <span className={s.roll} aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function DonePile({
  done,
  projects,
  spread,
  over,
  hidden,
  onSpread,
  onReopen,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  done: Task[];
  projects: Project[];
  spread: boolean;
  over: boolean;
  /** A card in flight towards the pile: keep the landing spot empty. */
  hidden?: string;
  onSpread: () => void;
  onReopen: (id: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  const reduce = useReducedMotion();
  const ordered = [...done].sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
  const stack = ordered.filter((t) => t.id !== hidden).slice(-SHOWN);
  const total = ordered.reduce((sum, t) => sum + t.est, 0);
  const pj = (id: string) => projects.find((p) => p.id === id);

  return (
    <section
      className={clsx(s.zone, s.doneZone, over && s.zoneOver)}
      aria-labelledby="c3-done"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header className={s.zoneHead}>
        <h2 id="c3-done" className={s.zoneTitle}>
          Done today
        </h2>
        <span className={s.zoneCount}>
          <RollingCount value={done.length} />
        </span>
        <button type="button" className={s.pileToggle} onClick={onSpread} aria-expanded={spread} disabled={!done.length}>
          {spread ? "Stack up" : "Spread out"}
          <IconChevronDown width={14} height={14} className={clsx(s.chev, spread && s.chevUp)} />
        </button>
      </header>

      <div className={s.pileStage} data-pile-stage="">
        {stack.length === 0 && (
          <div className={s.pileEmpty}>
            <span>{over ? "Drop to mark it done" : "Finished work lands here."}</span>
          </div>
        )}
        {stack.map((task, i) => {
          const tilt = tiltFor(task.id);
          const depth = stack.length - 1 - i;
          const top = depth === 0;
          return (
            <motion.div
              key={task.id}
              className={clsx(s.pileCard, top ? s.pileTop : s.pileUnder)}
              style={{ zIndex: i + 1, "--pr": `${tilt.r}deg` } as CSSProperties}
              initial={reduce ? { opacity: 0 } : false}
              animate={{
                opacity: depth > 4 ? 0 : 1,
                x: tilt.x,
                y: -Math.min(depth, 4) * 7,
                rotate: tilt.r,
                scale: 1 - Math.min(depth, 4) * 0.015,
              }}
              transition={{ duration: reduce ? 0.2 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              aria-hidden={!top}
            >
              <span className={s.pileCheck}>
                <IconCheck width={12} height={12} />
              </span>
              <span className={s.pileText}>
                <span className={s.pileTitle}>{task.title}</span>
                <span className={s.pileMeta}>
                  <ProjectDot project={pj(task.project)} />
                  {task.doneAt != null ? `Done at ${clock(task.doneAt)}` : "Done"}
                </span>
              </span>
            </motion.div>
          );
        })}
        {/* The landing spot the flying card aims for. */}
        <span className={s.pileLanding} data-pile-landing="" aria-hidden />
      </div>

      {done.length > 0 && (
        <p className={s.pileFoot}>
          About {roughly(total)} of work since {clock(ordered[0]?.doneAt ? ordered[0].doneAt - ordered[0].est : 540)}
        </p>
      )}

      <AnimatePresence initial={false}>
        {spread && (
          <motion.ol
            className={s.spread}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {[...ordered].reverse().map((task) => (
              <li key={task.id} className={s.spreadRow}>
                <span className={s.spreadTime}>{task.doneAt != null ? clock(task.doneAt) : ""}</span>
                <span className={s.spreadTitle}>{task.title}</span>
                <button type="button" className={s.iconBtn} onClick={() => onReopen(task.id)} aria-label={`Undo, put ${task.title} back in hand`} title="Not done yet">
                  <IconUndo />
                </button>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  );
}
