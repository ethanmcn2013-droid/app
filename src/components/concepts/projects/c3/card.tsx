"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Avatar, I, StatusDot, Swatch, firstName } from "./bits";
import { LANES, SIGNAL_FROM, STATUS_LABEL, type Action, type ActionOption, type Lane, type Project, type SignalKind } from "./data";
import { answerDrove, declaredLine, openSignals, placement, reasonOf, type Answer, type PState } from "./logic";
import s from "./c3.module.css";

export function daysLabel(n: number) {
  if (n < 0) return `${-n} days ago`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n <= 21) return `in ${n} days`;
  if (n <= 70) return `in ${Math.round(n / 7)} weeks`;
  return `in ${Math.round(n / 30)} months`;
}

const SIGNAL_ICON: Record<SignalKind, (p: { size?: number }) => React.ReactNode> = {
  overdue: I.clock,
  review: I.eye,
  clash: I.calendar,
  declared: I.flag,
  quiet: I.moon,
  deadline: I.calendar,
  owner: I.flag,
  link: I.link,
};

type Props = {
  project: Project;
  st: PState;
  lane: Lane;
  answer?: Answer;
  /** Position in the list of cards the last check-in moved, or -1. */
  moved?: number;
  isPhone: boolean;
  reduce: boolean;
  hintSwipe?: boolean;
  onSwiped?: () => void;
  onOpen: () => void;
  onAction: (a: Action, o?: ActionOption) => void;
  onSnooze: (signalId?: string) => void;
  onUnsnooze: (signalId: string) => void;
  onMove: (lane: Lane) => void;
  onClearOverride: () => void;
};

const SWIPE = 88;

/** Cards the check-in moved travel one after another, not all at once. */
function settleTransition(moved: number | undefined) {
  const at = moved ?? -1;
  return {
    type: "spring" as const,
    stiffness: at >= 0 ? 190 : 420,
    damping: at >= 0 ? 26 : 38,
    delay: at >= 0 ? at * 0.09 : 0,
  };
}

function startDrag(e: React.DragEvent<HTMLElement>, id: string) {
  e.dataTransfer.setData("text/x-c3-project", id);
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.setAttribute("data-lifted", "true");
}

/* ── full card: Needs you and Keep an eye on ───────────────────────── */

export function Card(props: Props) {
  const { project: p, st, lane, isPhone, reduce } = props;
  const [whyOpen, setWhyOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; axis: "x" | "y" | null; id: number } | null>(null);
  const swiped = useRef(false);

  if (p.wrapped) return <WrappedCard project={p} onOpen={props.onOpen} reduce={reduce} />;
  const moved = (props.moved ?? -1) >= 0;

  const { lead, also } = reasonOf(p, st);
  const open = openSignals(p, st);
  const live = open.filter((x) => x.weight !== "fine");
  // The card already says these two in full; the Why panel only adds their evidence.
  const onCard = live.slice(0, 2).map((x) => x.id);
  const primary = p.actions.find((a) => !st.done.includes(a.id));

  /* phone swipe */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPhone || e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button, a, input")) return;
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) {
        g.axis = "x";
        e.currentTarget.setPointerCapture(g.id);
        setDragging(true);
      } else if (Math.abs(ddy) > 8) {
        gesture.current = null;
        return;
      }
    }
    if (g.axis === "x") setDx(Math.max(-140, Math.min(140, ddx)));
  };
  const onPointerEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== "x") return;
    swiped.current = true;
    if (Math.abs(dx) > SWIPE) props.onSwiped?.();
    window.setTimeout(() => {
      swiped.current = false;
    }, 50);
    if (dx > SWIPE && primary) {
      props.onAction(primary, primary.options?.[0]);
    } else if (dx < -SWIPE) {
      props.onSnooze();
    }
    setDragging(false);
    setDx(0);
  };

  const onCardClick = (e: React.MouseEvent) => {
    if (swiped.current) return;
    if ((e.target as HTMLElement).closest("button, a, input, [data-why], [role=menu]")) return;
    props.onOpen();
  };

  const signalCount = live.length;
  const whyLabel = p.isNew
    ? `Why ${p.name} has no signals yet`
    : `Why ${p.name} is in ${LANES.find((l) => l.id === lane)?.title.toLowerCase()}`;

  // One quiet line under the reason: the second signal in full, or where the only one came from.
  const source = live.length === 1 ? SIGNAL_FROM[live[0].id] : undefined;
  const secondLine = also ?? source ?? (p.isNew ? "No signals yet. It finds its lane once a few tasks move." : null);
  const answerOnWithSignals = props.answer?.status === "on" && live.length > 0 && !st.override;
  const answerMoved = answerDrove(p, st, props.answer);

  const whyBtn = (
    <button type="button" className={s.whyToggle} aria-expanded={whyOpen} aria-label={whyLabel} data-why onClick={() => setWhyOpen((v) => !v)}>
      {signalCount > 1 ? `${signalCount} signals` : "Why"}
      <span className={s.whyChevron} data-open={whyOpen}>
        <I.chevron size={11} />
      </span>
    </button>
  );

  return (
    <motion.article
      layout={reduce ? false : "position"}
      layoutId={`c3-card-${p.id}`}
      className={s.cardShell}
      data-tone={lane}
      data-c3-card={p.id}
      data-moved={moved || undefined}
      transition={settleTransition(props.moved)}
    >
      {isPhone ? (
        <div className={s.swipeUnder} aria-hidden data-side={dx > 0 ? "act" : dx < 0 ? "snooze" : "none"}>
          <span className={s.swipeAct} data-armed={dx > SWIPE}>
            <I.check size={18} />
            <span className={s.swipeLabel}>{primary ? primary.label.split(" ")[0] : "Open"}</span>
          </span>
          <span className={s.swipeSnooze} data-armed={dx < -SWIPE}>
            <span className={s.swipeLabel}>Snooze</span>
            <I.moon size={18} />
          </span>
        </div>
      ) : null}
      <div
        className={s.card}
        data-new={p.isNew || undefined}
        data-dragging={dragging || undefined}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        draggable={!isPhone}
        onDragStart={(e) => startDrag(e, p.id)}
        onDragEnd={(e) => e.currentTarget.removeAttribute("data-lifted")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onCardClick}
      >
        {st.override ? (
          <p className={s.overrideNote}>
            <span>Moved here by you · {st.override.reason}</span>
            <button type="button" className={s.linkBtn} onClick={props.onClearOverride}>
              Undo
            </button>
          </p>
        ) : null}

        {!isPhone ? (
          <span className={s.grip} title="Drag to another lane if it belongs somewhere else" aria-hidden>
            <I.grip size={14} />
          </span>
        ) : null}
        <p className={s.reason} data-calm={live.length === 0 || undefined}>
          {lead}
        </p>
        {secondLine ? (
          <p className={s.secondLine} data-source={(!also && !!source) || undefined}>
            {secondLine} <span className={s.whyInline}>{whyBtn}</span>
          </p>
        ) : null}

        <div className={s.cardMeta}>
          <button type="button" className={s.projName} onClick={props.onOpen} data-c3-handle>
            <Swatch hue={p.hue} />
            <span className={s.projNameText}>{p.name}</span>
          </button>
          <span className={s.cardWhen} data-soon={p.daysOut <= 14 || undefined} title={`${p.dateWhat} ${p.date}`}>
            <span aria-hidden className={s.sep}>
              ·
            </span>
            <span className={s.cardRel}>{daysLabel(p.daysOut)}</span>
            <span className={s.cardDate}>, {p.date}</span>
          </span>
          <span className={s.metaEnd}>
            <span className={s.ownerMark}>
              <Avatar id={p.owner} size={20} />
              <span className={s.srOnly}>Owner: {firstName(p.owner)}</span>
            </span>
          </span>
        </div>

        {props.answer ? (
          <div className={s.answerLine} data-moved={answerMoved || undefined}>
            <StatusDot status={props.answer.status} size={7} />
            <p className={s.answerText}>
              <span className={s.answerWho}>
                You said {STATUS_LABEL[props.answer.status].toLowerCase()} today{props.answer.line ? ". " : "."}
              </span>
              {props.answer.line}
              {answerOnWithSignals ? (
                <span className={s.answerNote}>
                  {live.length === 1 ? "1 signal is" : `${live.length} signals are`} still open, so it stays here.
                </span>
              ) : answerMoved ? (
                <span className={s.answerNote}>
                  {lane === "needs" ? "Your answer moved it to Needs you." : "Your answer moved it to Keep an eye on."}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className={s.cardActions}>
          {p.actions.map((a, i) => {
            if (st.done.includes(a.id)) {
              return (
                <span key={a.id} className={s.actionDone}>
                  <I.check size={12} />
                  {a.done ?? "Done"}
                </span>
              );
            }
            if (a.kind === "choose" && a.options) {
              return <ChoiceMenu key={a.id} action={a} primary={i === 0} onPick={(o) => props.onAction(a, o)} />;
            }
            return (
              <button key={a.id} type="button" className={i === 0 ? s.actionPrimary : s.action} onClick={() => props.onAction(a)}>
                {a.label}
              </button>
            );
          })}
          {secondLine ? null : <span className={s.cardActionsEnd}>{whyBtn}</span>}
        </div>

        <AnimatePresence initial={false}>
          {whyOpen ? (
            <motion.div
              key="why"
              data-why
              className={s.why}
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className={s.whyInner}>
                {props.answer ? (
                  <p className={s.declared}>
                    <StatusDot status={props.answer.status} size={8} />
                    <span>{placement(p, st, lane, props.answer)}</span>
                  </p>
                ) : declaredLine(p, lane) ? (
                  <p className={s.declared}>
                    <StatusDot status={p.declared?.status ?? null} size={8} />
                    <span>{declaredLine(p, lane)}</span>
                  </p>
                ) : (
                  <p className={s.whyPlacement}>{placement(p, st, lane)}</p>
                )}
                {p.signals.length > 0 ? (
                  <ul className={s.signalList}>
                    {p.signals.map((sig) => {
                      const Icon = SIGNAL_ICON[sig.kind];
                      const snoozed = st.snoozed.includes(sig.id);
                      const resolved = st.resolved.includes(sig.id);
                      const nudged = st.nudged.includes(sig.id);
                      // The card already says the first two in full; here they only add evidence.
                      const evidenceOnly = onCard.includes(sig.id);
                      const detail = resolved
                        ? "Handled just now."
                        : snoozed
                          ? "Snoozed until Fri 2 Oct."
                          : nudged
                            ? `${sig.detail} Nudged just now.`
                            : sig.detail;
                      return (
                        <li key={sig.id} className={s.signal} data-weight={sig.weight} data-off={snoozed || resolved || undefined}>
                          <span className={s.signalIcon}>
                            <Icon size={12} />
                          </span>
                          <p className={s.signalText}>
                            {evidenceOnly ? (
                              detail
                            ) : (
                              <>
                                <span className={s.signalLead}>{sig.sentence}</span> {detail}
                              </>
                            )}
                          </p>
                          {!resolved && sig.weight !== "fine" ? (
                            snoozed ? (
                              <button type="button" className={s.signalUndo} onClick={() => props.onUnsnooze(sig.id)}>
                                Bring back
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={s.signalBtn}
                                onClick={() => props.onSnooze(sig.id)}
                                aria-label={`Snooze a week: ${sig.sentence}`}
                                title="Snooze a week"
                              >
                                <I.moon size={13} />
                              </button>
                            )
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                <div className={s.moveRow}>
                  <span className={s.moveLabel}>Move to</span>
                  {LANES.filter((l) => l.id !== "wrapped" && l.id !== lane).map((l) => (
                    <button key={l.id} type="button" className={s.moveBtn} onClick={() => props.onMove(l.id)}>
                      {l.title}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {props.hintSwipe ? (
          <p className={s.swipeHint} aria-hidden>
            <I.arrowRight size={12} /> Swipe to act · swipe back to snooze
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}

/* ── a decision with two outcomes ──────────────────────────────────── */

function ChoiceMenu({ action, primary, onPick }: { action: Action; primary: boolean; onPick: (o: ActionOption) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const options = action.options ?? [];
  const menuId = `c3-menu-${action.id}-${action.label.replace(/\W+/g, "-").toLowerCase()}`;

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(at + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(at - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <span className={s.actionWrap} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={primary ? s.actionPrimary : s.action}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {action.label}
        <span className={s.menuChevron} data-open={open}>
          <I.chevron size={12} />
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label={action.label}
            className={s.menu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onKeyDown={onMenuKey}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && !wrap.current?.contains(next)) setOpen(false);
            }}
          >
            {options.map((o) => (
              <button
                key={o.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={s.menuItem}
                onClick={() => {
                  close(true);
                  onPick(o);
                }}
              >
                <span className={s.menuLabel}>{o.label}</span>
                {o.detail ? <span className={s.menuDetail}>{o.detail}</span> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/* ── compact row: Running smoothly ─────────────────────────────────── */

export function CompactRow({
  project: p,
  st,
  answer,
  moved,
  isPhone,
  reduce,
  onOpen,
  onClearOverride,
}: {
  project: Project;
  st: PState;
  answer?: Answer;
  moved?: number;
  isPhone: boolean;
  reduce: boolean;
  onOpen: () => void;
  onClearOverride: () => void;
}) {
  const { lead } = reasonOf(p, st);
  return (
    <motion.article
      layout={reduce ? false : "position"}
      layoutId={`c3-card-${p.id}`}
      className={s.rowShell}
      data-tone="smooth"
      data-c3-card={p.id}
      data-moved={(moved ?? -1) >= 0 || undefined}
      transition={settleTransition(moved)}
    >
      <div
        className={s.row}
        data-new={p.isNew || undefined}
        draggable={!isPhone}
        onDragStart={(e) => startDrag(e, p.id)}
        onDragEnd={(e) => e.currentTarget.removeAttribute("data-lifted")}
      >
        <button type="button" className={s.rowMain} onClick={onOpen} data-c3-handle>
          <span className={s.rowTop}>
            <Swatch hue={p.hue} />
            <span className={s.rowName}>{p.name}</span>
            {p.isNew ? <span className={s.newTag}>New</span> : null}
            <span className={s.rowDate} data-soon={p.daysOut <= 14 || undefined}>
              {p.date.replace(/^[A-Z][a-z]{2} /, "")}
            </span>
            <Avatar id={p.owner} size={18} />
            <span className={s.srOnly}>, owner {firstName(p.owner)}</span>
          </span>
          {answer && !st.override ? (
            <span className={s.rowCalm} data-answer>
              <StatusDot status={answer.status} size={7} />
              <span>
                <span className={s.answerWho}>You said {STATUS_LABEL[answer.status].toLowerCase()} today.</span> {answer.line || lead}
              </span>
            </span>
          ) : (
            <span className={s.rowCalm}>{st.override ? `You moved this here: ${st.override.reason}.` : lead}</span>
          )}
        </button>
        {st.override ? (
          <button type="button" className={s.rowUndo} onClick={onClearOverride} aria-label={`Undo move for ${p.name}`}>
            <I.undo size={13} />
          </button>
        ) : null}
      </div>
    </motion.article>
  );
}

export function WrappedCard({ project: p, onOpen, reduce }: { project: Project; onOpen: () => void; reduce: boolean }) {
  return (
    <motion.article
      layout={reduce ? false : "position"}
      layoutId={`c3-card-${p.id}`}
      className={s.cardShell}
      data-tone="wrapped"
      data-c3-card={p.id}
    >
      <button type="button" className={s.wrappedCard} onClick={onOpen} data-c3-handle>
        <span className={s.wrappedTop}>
          <Swatch hue={p.hue} />
          <span className={s.projNameText}>{p.name}</span>
        </span>
        <span className={s.wrappedMeta}>
          <I.check size={12} />
          Wrapped {p.wrapped?.on} · {p.total} tasks
        </span>
        <span className={s.wrappedNote}>{p.wrapped?.note}</span>
      </button>
    </motion.article>
  );
}
