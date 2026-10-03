"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import clsx from "clsx";
import { DATE_LABEL, NEXT_WORKDAY, type Person, type Project, type Task } from "./data";
import { clock, dur, roughly } from "./model";
import { IconArrowLeft, IconCheck } from "./icons";
import { ProjectDot } from "./parts";
import s from "./desk.module.css";

export function EndOfDaySummary({
  person,
  place,
  now,
  done,
  carry,
  moved,
  closed,
  projects,
  onMove,
  onMoveAll,
  onBack,
  onClose,
}: {
  person: Person;
  place: string;
  now: number;
  done: Task[];
  carry: Task[];
  moved: Set<string>;
  closed: boolean;
  projects: Project[];
  onMove: (id: string) => void;
  onMoveAll: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const ordered = [...done].sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
  const total = ordered.reduce((sum, t) => sum + t.est, 0);
  const left = carry.filter((t) => !moved.has(t.id));
  const pj = (id: string) => projects.find((p) => p.id === id);
  const first = carry[0];

  return (
    <div className={s.wrapStage}>
      <motion.div
        className={s.receipt}
        initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)", y: -12 }}
        animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)", y: 0 }}
        transition={{ duration: reduce ? 0.15 : 0.9, ease: [0.3, 0.1, 0.2, 1] }}
      >
        <div className={s.rHead}>
          <p className={s.rPlace}>{place}</p>
          <h2 className={s.rTitle}>{DATE_LABEL}</h2>
          <p className={s.rSub}>
            {person.name} · wrapped up at {clock(now)}
          </p>
        </div>

        <div className={s.rRule} aria-hidden />

        <h3 className={s.rSection}>Finished</h3>
        {ordered.length === 0 ? (
          <p className={s.rEmpty}>Nothing finished yet today.</p>
        ) : (
          <ol className={s.rList}>
            {ordered.map((t) => (
              <li key={t.id} className={s.rRow}>
                <span className={s.rTime}>{t.doneAt != null ? clock(t.doneAt) : ""}</span>
                <span className={s.rName}>{t.title}</span>
                <span className={s.rDots} aria-hidden />
                <span className={s.rEst}>{dur(t.est)}</span>
              </li>
            ))}
          </ol>
        )}
        <div className={s.rTotal}>
          <span>
            {ordered.length} {ordered.length === 1 ? "thing" : "things"} done
          </span>
          <span>about {roughly(total)}</span>
        </div>

        <div className={s.rRule} aria-hidden />

        <div className={s.rSectionRow}>
          <h3 className={s.rSection}>Rolls to {NEXT_WORKDAY}</h3>
          {left.length > 1 && !closed && (
            <button type="button" className={s.rLink} onClick={onMoveAll}>
              Move all to {NEXT_WORKDAY}
            </button>
          )}
        </div>
        {carry.length === 0 ? (
          <p className={s.rEmpty}>Nothing to carry over.</p>
        ) : (
          <ul className={s.rList}>
            {carry.map((t) => {
              const isMoved = moved.has(t.id);
              return (
                <li key={t.id} className={clsx(s.rRow, s.rCarry, isMoved && s.rMoved)}>
                  <ProjectDot project={pj(t.project)} />
                  <span className={s.rName}>{t.title}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    {isMoved ? (
                      <motion.span
                        key="moved"
                        className={s.rMovedTag}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <IconCheck width={13} height={13} /> {NEXT_WORKDAY}
                      </motion.span>
                    ) : (
                      <motion.button
                        key="move"
                        type="button"
                        className={s.rMove}
                        onClick={() => onMove(t.id)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        disabled={closed}
                      >
                        Move to {NEXT_WORKDAY}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}

        {first && (
          <>
            <div className={s.rRule} aria-hidden />
            <p className={s.rNext}>
              {NEXT_WORKDAY} starts with <strong>{first.title}</strong>.
            </p>
          </>
        )}
        <div className={s.rTear} aria-hidden />
      </motion.div>

      <div className={s.wrapActions}>
        <button type="button" className={s.ghostBtn} onClick={onBack}>
          <IconArrowLeft width={15} height={15} /> Back to the desk
        </button>
        {closed ? (
          <p className={s.closedNote} role="status">
            The day is closed. Your desk will be ready on {NEXT_WORKDAY} morning.
          </p>
        ) : (
          <button type="button" className={s.primaryBtn} onClick={onClose}>
            Close the day
          </button>
        )}
      </div>
    </div>
  );
}
