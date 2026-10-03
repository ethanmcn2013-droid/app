"use client";

import { motion, useDragControls } from "motion/react";
import s from "./ledger.module.css";
import {
  KIND_LABEL,
  PEOPLE,
  daysFromToday,
  fmtDate,
  fmtRelative,
  isPastDue,
  nextMilestone,
  statusLooksStale,
  sum,
  type Project,
} from "./data";
import { Icon, Kbd, MilestoneWhen, OpenTrend, Progress, StatusPill, Swatch } from "./parts";
import { ActivityList, LinkList, MilestoneList, PeopleList, StatusHistory, TaskList } from "./sections";
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
            {index + 1} of {total}
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
            <button type="button" className={s.btnGhostSm} onClick={onOpen}>
              Open {!mobile && <Kbd>↵</Kbd>}
            </button>
            <button type="button" className={s.iconBtn} aria-label="Close peek (Esc)" onClick={onClose}>
              <Icon.close size={14} />
            </button>
          </div>
        </div>
        <div className={s.peekTitleRow}>
          <Swatch tone={p.tone} name={p.name} size={28} />
          <div className={s.peekTitleText}>
            <h2 className={s.peekTitle}>{p.name}</h2>
            <p className={s.peekPurpose}>{p.purpose}</p>
          </div>
        </div>
        <div className={s.peekStatusRow}>
          <button type="button" className={s.cellBtn} onClick={(e) => onEdit("status", e.currentTarget)} aria-label="Change status">
            <StatusPill status={p.status} past={isPastDue(p)} stale={statusLooksStale(p)} />
          </button>
          <span className={s.peekReason}>{p.statusReason}</span>
        </div>
      </header>

      <div className={s.peekFacts}>
        <button type="button" className={s.fact} onClick={(e) => onEdit("date", e.currentTarget)}>
          <span className={s.factLabel}>Date</span>
          <span className={s.factValue} data-tone={isPastDue(p) ? "late" : n <= 14 && n >= 0 ? "soon" : undefined}>
            {fmtDate(p.date)}
          </span>
          <span className={s.factSub}>{n < 0 ? `Ended ${-n} days ago` : fmtRelative(p.date)}</span>
        </button>
        <div className={s.fact}>
          <span className={s.factLabel}>Progress</span>
          <Progress done={p.done} total={p.total} width={64} />
          <span className={s.factSub}>{p.total - p.done} open</span>
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
          <span className={s.factLabel}>Owner</span>
          <span className={s.factValue}>{PEOPLE[p.owner].short}</span>
          <span className={s.factSub}>{KIND_LABEL[p.kind]}</span>
        </button>
      </div>

      {p.overdue > 0 && (
        <div className={s.peekAlert}>
          <Icon.clock size={14} />
          <span>
            {p.overdue} task{p.overdue === 1 ? "" : "s"} overdue
            {m ? (
              <>
                . Next milestone: {m.name}, <MilestoneWhen m={m} />.
              </>
            ) : (
              "."
            )}
          </span>
        </div>
      )}

      <section className={s.peekSection}>
        <h3 className={s.peekH}>Next up</h3>
        <TaskList tasks={p.tasks} />
      </section>
      <section className={s.peekSection}>
        <h3 className={s.peekH}>Milestones</h3>
        <MilestoneList milestones={p.milestones} />
      </section>
      <section className={s.peekSection}>
        <h3 className={s.peekH}>Status history</h3>
        <StatusHistory history={p.history} />
      </section>
      <section className={s.peekSection}>
        <h3 className={s.peekH}>People</h3>
        <PeopleList people={p.people} owner={p.owner} />
      </section>
      <section className={s.peekSection}>
        <h3 className={s.peekH}>Key links</h3>
        <LinkList links={p.links} />
      </section>
      <section className={s.peekSection}>
        <h3 className={s.peekH}>Latest activity</h3>
        <ActivityList activity={p.activity} />
      </section>
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
