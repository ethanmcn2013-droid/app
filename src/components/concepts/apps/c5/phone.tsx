"use client";

/* The workbench on a phone: a stack of compact cards, each opening its pane full screen. */

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { FILES, fmtTime, NOTES, POSTS, PRESS, PROOFS, SUPPLIERS, toolById, type PaneState, type ToolId } from "./data";
import { cx, useBench, useSaturdayClock } from "./ctx";
import { ToolTile } from "./chrome";
import { ChevronIcon, ChevronLeftIcon, CloseIcon } from "./glyphs";
import { useFocusTrap } from "./trap";
import s from "./c5.module.css";
import f from "./phone.module.css";

type Fact = { text: string; tone?: "live" | "soon" };
type Action = { label: string; run: () => void };

/** The one thing worth knowing about a pane, and the one thing worth doing from the stack. */
function useCardFacts() {
  const b = useBench();
  const clock = useSaturdayClock();
  const nowMin = clock / 60;
  const tasks = b.tasks.filter((x) => x.project === b.project);
  const open = tasks.filter((x) => !x.done);
  const waiting = b.guests.filter((g) => g.table === null);
  const full = b.tables.filter((tb) => b.guests.filter((g) => g.table === tb.n).length >= tb.seats).length;
  const next = b.orchardSteps.find((x) => x.at > nowMin);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  return (tool: ToolId): { fact: Fact; action?: Action } => {
    const mf = b.project === "mf";
    const orchard = b.project === "orchard";
    switch (tool) {
      case "tasks": {
        const unplaced = mf ? open.find((x) => x.at === undefined && !x.link) : undefined;
        return {
          fact: { text: `${open.length} to do this week` },
          action: unplaced ? { label: "Give a task a time", run: () => b.openSend({ kind: "task", id: unplaced.id }) } : undefined,
        };
      }
      case "seating":
        return mf ? { fact: { text: `${full} of ${b.tables.length} tables full` }, action: { label: "Add a table", run: b.addTable } } : { fact: { text: "Not started yet" } };
      case "guests":
        return mf
          ? { fact: { text: `${plural(waiting.length, "person", "people")} waiting for a table` }, action: waiting[0] ? { label: `Seat ${waiting[0].name.split(" ").slice(-2).join(" ")}`, run: () => b.openSend({ kind: "guest", id: waiting[0].id }) } : undefined }
          : { fact: { text: "Not started yet" } };
      case "dayplan":
        if (orchard && next) return { fact: { text: `Next: ${next.title} at ${fmtTime(next.at)}`, tone: "live" }, action: { label: "Push the rest 15 minutes", run: () => b.pushLater(next.at, 15) } };
        if (mf) return { fact: { text: `${plural(b.mfSteps.length + tasks.filter((x) => x.at !== undefined).length, "step")} on Saturday 3 October` } };
        return { fact: { text: "Not started yet" } };
      case "timer": {
        if (!orchard || !next) return { fact: { text: "Counts down to the next step" } };
        const mins = Math.max(0, Math.ceil(next.at - nowMin));
        return { fact: { text: `${plural(mins, "minute")} to ${next.title}`, tone: mins <= 5 ? "soon" : "live" } };
      }
      case "suppliers": {
        if (!orchard) return { fact: { text: "Not started yet" } };
        const here = SUPPLIERS.filter((x) => x.status === "here").length;
        const due = SUPPLIERS.filter((x) => x.status === "due").length;
        return { fact: { text: `${here} here, ${due} still due` } };
      }
      case "outline": {
        if (b.project !== "riverside") return { fact: { text: "Not started yet" } };
        const words = b.sections.reduce((a, x) => a + x.words, 0);
        const target = b.sections.reduce((a, x) => a + x.target, 0);
        return { fact: { text: `${words.toLocaleString("en-IE")} of ${target.toLocaleString("en-IE")} words written` } };
      }
      case "split":
        if (b.project === "riverside") return { fact: { text: `${plural(b.sections.filter((x) => x.words < x.target / 2).length, "part")} under half written` } };
        return { fact: { text: `${plural(tasks.length, "task")} across ${plural(new Set(tasks.map((x) => x.who)).size, "person", "people")}` } };
      case "study":
        return { fact: { text: "Twenty-five minutes on, five off" } };
      case "social":
        return b.project === "hollis" ? { fact: { text: `${POSTS.filter((x) => x.state === "ready").length} posts ready, ${POSTS.filter((x) => x.state === "draft").length} still drafts` } } : { fact: { text: "Not started yet" } };
      case "press":
        return b.project === "hollis" ? { fact: { text: `${PRESS.filter((x) => x.state === "Coming").length} journalists coming, ${PRESS.filter((x) => x.state === "No reply").length} not replied` } } : { fact: { text: "Not started yet" } };
      case "proofs":
        return b.project === "hollis" ? { fact: { text: `${plural(PROOFS.filter((x) => x.state === "Waiting").length, "design")} waiting for a yes` } } : { fact: { text: "Not started yet" } };
      case "notes":
        return { fact: { text: plural(NOTES[b.project].length, "note") } };
      case "files":
        return { fact: { text: plural(FILES.length, "file") } };
      default:
        return { fact: { text: "Not started yet" } };
    }
  };
}

/* ── the stack ──────────────────────────────────────────────────── */

type StackProps = {
  panes: PaneState[];
  arrived: Set<string>;
  pulse: string | null;
  onOpen: (id: string) => void;
};

export function PhoneStack({ panes, arrived, pulse, onOpen }: StackProps) {
  const factFor = useCardFacts();
  return (
    <ul className={f.stack} aria-label="Open tools">
      <AnimatePresence initial={false}>
        {panes.map((p) => {
          const def = toolById(p.tool);
          const { fact, action } = factFor(p.tool);
          const grew = arrived.has(p.id);
          return (
            <motion.li
              key={p.id}
              data-wrap={p.id}
              layoutId={grew ? `c5-arrive-${p.tool}` : undefined}
              layout
              initial={grew ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className={cx(f.card, pulse === p.id && f.cardPulse)}
            >
              <button type="button" className={f.cardMain} data-card={p.id} onClick={() => onOpen(p.id)} aria-label={`${def.name}: ${fact.text}. Open full screen`}>
                <ToolTile tool={p.tool} size={38} />
                <span className={f.cardText}>
                  <span className={f.cardName}>{def.name}</span>
                  <span className={cx(f.cardFact, fact.tone === "live" && f.factLive, fact.tone === "soon" && f.factSoon)}>
                    {fact.tone && <span className={f.liveDot} aria-hidden="true" />}
                    {fact.text}
                  </span>
                </span>
                <ChevronIcon size={18} className={f.cardChevron} />
              </button>
              {action && (
                <button type="button" className={f.cardAct} onClick={action.run}>
                  {action.label}
                </button>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

/* ── one pane, full screen ──────────────────────────────────────── */

type FullProps = {
  panes: PaneState[];
  index: number;
  direction: number;
  onIndex: (i: number) => void;
  onBack: () => void;
  onClose: (id: string) => void;
  inert: boolean;
  body: (p: PaneState) => ReactNode;
};

export function PhoneFull({ panes, index, direction, onIndex, onBack, onClose, inert, body }: FullProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const pane = panes[index];
  const currentId = useRef(pane?.id);
  useEffect(() => {
    currentId.current = pane?.id;
  }, [pane?.id]);
  useFocusTrap(ref, {
    initial: () => backRef.current,
    restore: () => document.querySelector<HTMLElement>(`[data-card="${currentId.current}"]`),
  });
  if (!pane) return null;
  const def = toolById(pane.tool);
  const prev = panes[index - 1];
  const next = panes[index + 1];

  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 70 || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    if (info.offset.x < 0 && next) onIndex(index + 1);
    if (info.offset.x > 0 && prev) onIndex(index - 1);
  };

  return (
    <motion.div
      ref={ref}
      className={f.full}
      role="dialog"
      aria-modal="true"
      aria-label={`${def.name}, ${index + 1} of ${panes.length}`}
      inert={inert}
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 24, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 38 }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onBack();
        }
      }}
    >
      <header className={f.fullBar}>
        <button ref={backRef} type="button" className={f.back} onClick={onBack} aria-label="Back to the layout">
          <ChevronLeftIcon size={18} /> Layout
        </button>
        <span className={f.fullTitle}>
          <ToolTile tool={pane.tool} size={22} />
          <span className={f.fullName}>{def.name}</span>
          <span className={f.fullCount}>
            {index + 1} of {panes.length}
          </span>
        </span>
        <span className={f.fullNav}>
          <button type="button" className={f.navBtn} disabled={!prev} onClick={() => onIndex(index - 1)} aria-label={prev ? `Previous: ${toolById(prev.tool).name}` : "No previous tool"}>
            <ChevronLeftIcon size={18} />
          </button>
          <button type="button" className={f.navBtn} disabled={!next} onClick={() => onIndex(index + 1)} aria-label={next ? `Next: ${toolById(next.tool).name}` : "No next tool"}>
            <ChevronIcon size={18} />
          </button>
          <button type="button" className={f.navBtn} onClick={() => onClose(pane.id)} aria-label={`Close ${def.name}. It stays on`}>
            <CloseIcon size={17} />
          </button>
        </span>
      </header>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={pane.id}
          className={cx(s.pane, f.fullPane)}
          data-pane={pane.tool}
          custom={direction}
          initial={{ opacity: 0, x: reduced ? 0 : 40 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduced ? 0 : -40 * direction, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          onPanEnd={onPanEnd}
        >
          <div className={cx(s.paneBody, f.fullBody)}>{body(pane)}</div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
