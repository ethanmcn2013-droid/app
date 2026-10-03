"use client";

import { motion, useDragControls } from "motion/react";
import s from "./ledger.module.css";
import {
  KIND_LABEL,
  ME,
  PEOPLE,
  dayDate,
  capFirst,
  daysFromToday,
  fmtDate,
  fmtDaysCount,
  fmtRelative,
  isPastDue,
  nextMilestone,
  statusLooksStale,
  sum,
  type Project,
} from "./data";
import { Icon, Kbd, MilestoneWhen, OpenTrend, Progress, StatusPill } from "./parts";
import { MiniCover } from "./shared-cover";
import { TaskList } from "./sections";
import type { EditKind } from "./table";

export function Peek({
  project: p,
  index,
  total,
  onClose,
  onOpen,
  onStep,
  onEdit,
  mobile,
}: {
  project: Project;
  index: number;
  total: number;
  onClose: () => void;
  onOpen: () => void;
  onStep: (d: 1 | -1) => void;
  onEdit: (kind: EditKind, el: Element) => void;
  mobile?: boolean;
}) {
  const drag = useDragControls();
  const n = daysFromToday(p.date);
  const m = nextMilestone(p);
  const done = sum(p.sparkDone);
  const added = sum(p.sparkAdded);
  const latest = p.updates[0];
  const since = p.history[p.history.length - 1];

  const body = (
    <>
      <header className={s.peekHead}>
        {mobile && (
          <div className={s.sheetGrab} onPointerDown={(e) => drag.start(e)} aria-hidden="true">
            <span className={s.sheetHandle} />
          </div>
        )}
        <div className={s.peekBar}>
          <span className={s.peekCount}>
            <span className={s.peekEyebrow}>Quick look</span> · {index + 1} of {total}
          </span>
          <div className={s.peekNav}>
            {!mobile && (
              <>
                <button type="button" className={s.iconBtn} aria-label="Previous project (K)" onClick={() => onStep(-1)}>
                  <Icon.arrowUp size={14} />
                </button>
                <button type="button" className={s.iconBtn} aria-label="Next project (J)" onClick={() => onStep(1)}>
                  <Icon.arrowDown size={14} />
                </button>
              </>
            )}
            <button type="button" className={s.iconBtn} aria-label="Close peek (Esc)" onClick={onClose}>
              <Icon.close size={14} />
            </button>
          </div>
        </div>
        <div className={s.peekTitleRow}>
          <MiniCover p={p} w={44} h={30} radius={7} />
          <div className={s.peekTitleText}>
            <h2 className={s.peekTitle}>{p.name}</h2>
            <p className={s.peekPurpose}>{p.purpose}</p>
          </div>
        </div>
        <div className={s.peekStatusRow}>
          <button type="button" className={s.cellBtn} onClick={(e) => onEdit("status", e.currentTarget)} aria-label="Change status">
            <StatusPill status={p.status} tooEarly={p.tooEarly} stale={statusLooksStale(p)} />
          </button>
          <span className={s.peekReason}>
            {isPastDue(p) ? "Past its date. Wrap it up, or move the date." : (p.reason ?? p.note)}
            {since ? (
              <span className={s.peekSince}>
                {p.tooEarly && p.status === "on_track" ? (
                  `Started ${dayDate(p.start)}`
                ) : (
                  <>
                    {p.status === "wrapped" ? "" : "Since "}
                    {dayDate(since.date)} · {since.by === ME ? "you" : PEOPLE[since.by]?.short}
                  </>
                )}
              </span>
            ) : null}
          </span>
        </div>
      </header>

      <div className={s.peekFacts}>
        <button type="button" className={s.fact} onClick={(e) => onEdit("date", e.currentTarget)}>
          <span className={s.factLabel}>Date</span>
          <span className={s.factValue} data-tone={isPastDue(p) ? "late" : n <= 14 && n >= 0 ? "soon" : undefined}>
            {fmtDate(p.date)}
          </span>
          <span className={s.factSub}>{n < 0 ? `Ended ${fmtDaysCount(-n)} ago` : capFirst(fmtRelative(p.date))}</span>
        </button>
        <div className={s.fact}>
          <span className={s.factLabel}>Tasks done</span>
          <Progress done={p.done} total={p.total} width={48} />
          <span className={s.factSub}>
            {p.total - p.done} open{p.overdue ? `, ${p.overdue} late` : ""}
          </span>
        </div>
        <div className={s.fact}>
          <span className={s.factLabel}>Open tasks, last 14 days</span>
          <span className={s.factFlow}>
            <OpenTrend p={p} width={56} height={18} />
          </span>
          <span className={s.factSub}>
            {done} done, {added} added
          </span>
        </div>
        <button type="button" className={s.fact} onClick={(e) => onEdit("owner", e.currentTarget)}>
          <span className={s.factLabel}>Lead</span>
          <span className={s.factValue}>{PEOPLE[p.owner]?.short}</span>
          <span className={s.factSub}>{KIND_LABEL[p.kind]}</span>
        </button>
      </div>

      {p.overdue > 0 && (
        <div className={s.peekAlert}>
          <Icon.clock size={14} />
          <span>
            {p.overdue} late {p.overdue === 1 ? "task" : "tasks"}
            {m ? (
              <>
                . Next big date: {m.name}, <MilestoneWhen m={m} />.
              </>
            ) : (
              "."
            )}
          </span>
        </div>
      )}

      {latest ? (
        <section className={s.peekSection}>
          <h3 className={s.peekH}>Latest update</h3>
          <p className={s.peekUpdate}>
            &ldquo;{latest.text}&rdquo;
            <span className={s.peekUpdateBy}>
              {latest.who === ME ? "You" : PEOPLE[latest.who]?.short}, {dayDate(latest.date)}
            </span>
          </p>
        </section>
      ) : null}
      <section className={s.peekSection}>
        <h3 className={s.peekH}>Next up</h3>
        <TaskList tasks={p.tasks} limit={3} />
      </section>
      <div className={s.peekFoot}>
        <p className={s.peekFootText}>Updates, milestones, people and files are on the project&rsquo;s page.</p>
        <button type="button" className={s.peekOpen} onClick={onOpen}>
          Open project <Icon.arrowRight size={14} />
          {!mobile && <Kbd>↵</Kbd>}
        </button>
      </div>
    </>
  );

  if (mobile) {
    return (
      <div className={s.layer}>
        <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.aside
          className={s.peekSheet}
          aria-label={`${p.name}, peek`}
          role="dialog"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          drag="y"
          dragControls={drag}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
          }}
        >
          {body}
        </motion.aside>
      </div>
    );
  }

  return (
    <motion.aside
      className={s.peek}
      aria-label={`${p.name}, peek`}
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className={s.peekScroll} key={p.id}>
        {body}
      </div>
    </motion.aside>
  );
}
