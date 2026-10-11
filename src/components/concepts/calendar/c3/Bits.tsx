"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PROJECTS, type Person, type Project } from "./data";
import { hrs, shortDate, type Suggestion } from "./model";
import { Icon } from "./icons";
import styles from "./c3.module.css";

const TAG_TONE = new Map(PROJECTS.flatMap((p) => p.tags.map((t) => [t.key, t.tone] as const)));
const TAG_LABEL = new Map(PROJECTS.flatMap((p) => p.tags.map((t) => [t.key, t.label] as const)));
export const tagOf = (key: string) => TAG_TONE.get(key) ?? 1;
export const tagLabel = (key: string) => TAG_LABEL.get(key) ?? key;

export function Avatar({ person, size = 28 }: { person: Person; size?: number }) {
  return (
    <span
      className={styles.avatar}
      data-guest={person.guest || undefined}
      style={{ width: size, height: size, fontSize: size * 0.39, background: `var(--v3-project-${person.tone})` }}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

/** Hours that re-count with a short roll when they change. */
export function Num({ value }: { value: number }) {
  return (
    <span className={styles.num}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={styles.numInner}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {hrs(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function SuggestionCard({
  s,
  project,
  compact,
  onApply,
  onDismiss,
  onShow,
}: {
  s: Suggestion;
  project: Project;
  compact?: boolean;
  onApply: () => void;
  onDismiss?: () => void;
  onShow?: () => void;
}) {
  const from = s.from.personId ? project.people.find((p) => p.id === s.from.personId) : null;
  const to = project.people.find((p) => p.id === s.to.personId)!;
  return (
    <div className={styles.idea} data-kind={s.kind} data-compact={compact || undefined}>
      <p className={styles.ideaText}>
        <span className={styles.ideaProblem}>
          {s.kind === "unassigned" ? <Icon.inbox size={13} /> : <Icon.over size={13} />}
          {s.problem}
        </span>{" "}
        <span className={styles.ideaRoom}>{s.room}</span>
      </p>
      <div className={styles.ideaMove}>
        <span className={styles.ideaTask}>
          <span className={styles.ideaTag} style={{ background: `var(--v3-project-${tagOf(s.task.tag)})` }} />
          <span className={styles.ideaTaskTitle}>{s.task.title}</span>
          <span className={styles.ideaHours}>{hrs(s.task.hours)}</span>
        </span>
        <span className={styles.ideaPath}>
          {from ? <Avatar person={from} size={18} /> : <span className={styles.ideaNone}>?</span>}
          <Icon.arrowRight size={12} />
          <Avatar person={to} size={18} />
          <span className={styles.ideaWhen}>{shortDate(s.to.date)}</span>
        </span>
      </div>
      <div className={styles.ideaActions}>
        <button type="button" className={styles.primaryBtn} onClick={onApply}>
          {s.kind === "unassigned" ? `Give to ${to.first}` : "Move it"}
        </button>
        {onShow && (
          <button type="button" className={styles.ghostBtn} onClick={onShow}>
            Show the day
          </button>
        )}
        {onDismiss && (
          <button type="button" className={styles.ghostBtn} onClick={onDismiss}>
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

/** The strip's version of an idea: one sentence, one move, one button. */
function IdeaChip({ s, project, onApply, onDismiss, onShow }: { s: Suggestion; project: Project; onApply: () => void; onDismiss: () => void; onShow: () => void }) {
  const from = s.from.personId ? project.people.find((p) => p.id === s.from.personId) : null;
  const to = project.people.find((p) => p.id === s.to.personId)!;
  return (
    <div className={styles.chip} data-kind={s.kind}>
      <button type="button" className={styles.chipText} onClick={onShow} title="Show the day">
        <span className={styles.ideaProblem}>
          {s.kind === "unassigned" ? <Icon.inbox size={13} /> : <Icon.over size={13} />}
          {s.problem}
        </span>{" "}
        <span className={styles.ideaRoom}>{s.room}</span>
      </button>
      <div className={styles.chipRow}>
        <span className={styles.chipMove}>
          <span className={styles.ideaTag} style={{ background: `var(--v3-project-${tagOf(s.task.tag)})` }} />
          <span className={styles.ideaTaskTitle}>{s.task.title}</span>
          <span className={styles.ideaHours}>{hrs(s.task.hours)}</span>
          <span className={styles.ideaPath}>
            {from ? <Avatar person={from} size={16} /> : <span className={styles.ideaNone}>?</span>}
            <Icon.arrowRight size={11} />
            <Avatar person={to} size={16} />
          </span>
        </span>
        <button type="button" className={styles.primaryBtn} data-sm="" onClick={onApply}>
          {s.kind === "unassigned" ? `Give to ${to.first}` : "Move it"}
        </button>
        <button type="button" className={styles.chipX} onClick={onDismiss} aria-label={`Not now: ${s.task.title}`} title="Not now">
          <Icon.close size={12} />
        </button>
      </div>
    </div>
  );
}

export function SuggestionStrip({
  suggestions,
  project,
  onApply,
  onDismiss,
  onShow,
}: {
  suggestions: Suggestion[];
  project: Project;
  onApply: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
  onShow: (s: Suggestion) => void;
}) {
  const [open, setOpen] = useState(true);
  const list = suggestions.slice(0, 8);
  return (
    <section className={styles.strip} aria-label="Ideas to even things out">
      <div className={styles.stripHead}>
        <Icon.spark size={14} className={styles.stripIcon} />
        <h2 className={styles.stripTitle}>
          {list.length === 0 ? "Nothing to rebalance" : `${suggestions.length} ${suggestions.length === 1 ? "idea" : "ideas"} to even things out`}
        </h2>
        <p className={styles.stripSub}>
          {list.length === 0
            ? "Everyone has room in these weeks, and nothing is waiting for someone."
            : "Each one moves a single task to someone with free hours that day or just before."}
        </p>
        {list.length > 0 && (
          <button type="button" className={styles.stripToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide ideas" : "Show ideas"}
            <Icon.chevronDown size={12} data-open={open || undefined} className={styles.stripChevron} />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {list.length > 0 && open && (
          <motion.div
            key="row"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className={styles.stripClip}
          >
            <div className={styles.stripRow}>
              <AnimatePresence initial={false} mode="popLayout">
                {list.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className={styles.stripItem}
                  >
                    <IdeaChip s={s} project={project} onApply={() => onApply(s)} onDismiss={() => onDismiss(s)} onShow={() => onShow(s)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Legend() {
  return (
    <footer className={styles.legend}>
      <div className={styles.legendItems} aria-label="What the colours mean">
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-level="empty" />
          Free
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-level="light">
            <span style={{ width: "45%" }} />
          </span>
          Light, room to spare
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-level="full">
            <span style={{ width: "90%" }} />
          </span>
          Full, most of the day
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-level="over">
            <Icon.over size={9} />
            <span style={{ width: "100%" }} />
          </span>
          Over, more than they have
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-level="away" />
          Away
        </span>
      </div>
      <p className={styles.legendKeys}>
        <Icon.keyboard size={14} />
        Drag a task to move it · Click a name to see only them · <kbd className={styles.kbd}>[</kbd>
        <kbd className={styles.kbd}>]</kbd> <kbd className={styles.kbd}>T</kbd>
      </p>
    </footer>
  );
}

export function UndoToast({ open, text, onUndo, onClose }: { open: boolean; text: string; onUndo: () => void; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.toast}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
        >
          <Icon.check size={14} className={styles.toastIcon} />
          <span className={styles.toastText}>{text}</span>
          <button type="button" className={styles.toastUndo} onClick={onUndo}>
            <Icon.undo size={13} />
            Undo
          </button>
          <button type="button" className={styles.toastClose} onClick={onClose} aria-label="Dismiss">
            <Icon.close size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
