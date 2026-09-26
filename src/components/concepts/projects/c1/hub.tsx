"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type PanInfo,
  type Variants,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, HealthRing, Icon, menuKeys, StatusGlyph } from "./bits";
import {
  badgeFor,
  daysFromToday,
  firstName,
  ME,
  PEOPLE,
  percent,
  shortDate,
  STATUS_LABEL,
  weekday,
  type KeyLink,
  type LinkKind,
  type Project,
  type Status,
  type Task,
} from "./data";
import { hueVar } from "./cover-art";
import { CoverField, SharedCover } from "./shared-cover";
import { SPRING } from "./project-card";
import h from "./hub.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/*
 * Opening runs in sequence, not in parallel: the page behind goes first, the
 * cover grows, and only when it is about 70% of the way there do the plate,
 * the facts and the body arrive, 40 ms apart. No two layers of text ever
 * share the screen.
 */
const ARRIVE = { plate: 0.26, facts: 0.3, body: 0.34 };

type Props = {
  p: Project;
  position: number;
  count: number;
  flip: -1 | 0 | 1;
  reduce: boolean;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  onSetDate: (id: string, iso: string | null) => void;
  onSetStatus: (id: string, status: Status) => void;
};

export function Hub({ p, position, count, flip, reduce, onClose, onStep, onToggleTask, onSetDate, onSetStatus }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const heroH = useRef(400);
  const { scrollY } = useScroll({ container: scroller });
  // Scroll thresholds follow the hero's real height, which is fluid.
  const plateOpacity = useTransform(scrollY, (v) => clamp01(1 - v / (heroH.current * 0.42)));
  const compactOpacity = useTransform(scrollY, (v) => clamp01((v - (heroH.current - 190)) / 70));
  const [collapsed, setCollapsed] = useState(false);
  // Scroll can report before the hub has mounted (the layout animation measures it); ignore that.
  const mounted = useRef(false);
  useMotionValueEvent(scrollY, "change", (v) => {
    if (mounted.current) setCollapsed(v > heroH.current - 130);
  });

  const [dating, setDating] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLSpanElement>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const pct = percent(p.done, p.total);
  const badge = badgeFor(p);
  const wrapped = p.status === "wrapped";
  const layoutT = SPRING;
  const shared = !reduce;

  useEffect(() => {
    mounted.current = true;
    backRef.current?.focus({ preventScroll: true });
    const el = heroRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      heroH.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => {
      mounted.current = false;
      ro.disconnect();
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // Flipping to another project starts at its cover, not halfway down.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [p.id, reduce]);

  // The status menu: focus lands on the current status; a click elsewhere closes it.
  useEffect(() => {
    if (!statusMenu) return;
    statusMenuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!statusMenuRef.current?.contains(t) && !statusBtnRef.current?.contains(t)) setStatusMenu(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [statusMenu]);

  /** This is a concept: actions that would leave the page say where they would go. */
  function say(text: string) {
    setToast((t) => ({ n: (t?.n ?? 0) + 1, text }));
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -70 || info.velocity.x < -500) onStep(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) onStep(-1);
  }

  // Flipping swaps the hero for the next project's cover: the new one slides
  // in from the side it came from while the old one slides away.
  const flipVariants: Variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 90 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.42, ease: EASE } },
    exit: (d: number) =>
      reduce ? { opacity: 0 } : { opacity: 0, x: d * -90, transition: { duration: 0.32, ease: EASE } },
  };

  const owner = p.members.find((m) => m.owner);

  return (
    <motion.div
      className={h.layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hub-title"
      initial={{ opacity: 1 }}
      exit={{ opacity: 1 }}
    >
      {/* Opaque from the first frame's end: the shelf is gone before any hub text arrives. */}
      <motion.div
        className={h.sheetBg}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.24, delay: 0.06, ease: "linear" } }}
        transition={{ duration: reduce ? 0.18 : 0.12, ease: "linear" }}
      />
      <motion.div ref={scroller} layoutScroll className={`${h.scroller} thin-scroll`}>
        <div className={h.sheet} style={hueVar(p.hue)}>
          {/* Hero: the cover, grown to the full width of the page */}
          <div ref={heroRef} className={h.heroWrap}>
            <AnimatePresence initial={false} custom={flip}>
              <SharedCover
                key={p.id}
                p={p}
                layoutId={shared ? `cover-${p.id}` : undefined}
                transition={layoutT}
                radius={0}
                className={h.heroCover}
                variants={flipVariants}
                custom={flip}
              >
                <motion.div
                  className={h.heroDrag}
                  drag={reduce ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={onDragEnd}
                >
                  <CoverField p={p} transition={layoutT} />
                </motion.div>
              </SharedCover>
            </AnimatePresence>

            <motion.div className={h.heroTopOuter} style={{ opacity: plateOpacity }}>
              <motion.div
                className={h.heroTop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.25, delay: reduce ? 0 : ARRIVE.plate }}
              >
                <button ref={backRef} type="button" className={h.frost} onClick={onClose}>
                  <Icon.chevronLeft size={14} />
                  Projects
                  <kbd className={h.kbd}>Esc</kbd>
                </button>
                <div className={h.stepper}>
                  <span className={h.stepCount}>
                    {position + 1} of {count}
                  </span>
                  <button type="button" className={h.stepBtn} onClick={() => onStep(-1)} aria-label="Previous project">
                    <Icon.chevronLeft size={16} />
                  </button>
                  <button type="button" className={h.stepBtn} onClick={() => onStep(1)} aria-label="Next project">
                    <Icon.chevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            </motion.div>

            {/* Collapsed header after scrolling: a strip of the art stays above it */}
            <motion.div
              className={h.compact}
              style={{ opacity: compactOpacity, pointerEvents: collapsed ? "auto" : "none" }}
              aria-hidden={!collapsed}
            >
              <div className={h.compactInner}>
                <button
                  type="button"
                  className={h.iconBtn}
                  onClick={onClose}
                  aria-label="Back to projects"
                  tabIndex={collapsed ? 0 : -1}
                >
                  <Icon.chevronLeft size={16} />
                </button>
                <HealthRing pct={wrapped ? 100 : pct} status={p.status} overdue={0} size={36} stroke={3.5} />
                <span className={h.compactText}>
                  <span className={h.compactName}>{p.name}</span>
                  <span className={h.compactMeta}>
                    <StatusGlyph status={p.status} /> {STATUS_LABEL[p.status]}
                    {badge ? ` · ${badge.big}` : ""}
                  </span>
                </span>
                <span className={h.compactSteps}>
                  <button
                    type="button"
                    className={h.iconBtn}
                    onClick={() => onStep(-1)}
                    aria-label="Previous project"
                    tabIndex={collapsed ? 0 : -1}
                  >
                    <Icon.chevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className={h.iconBtn}
                    onClick={() => onStep(1)}
                    aria-label="Next project"
                    tabIndex={collapsed ? 0 : -1}
                  >
                    <Icon.chevronRight size={16} />
                  </button>
                </span>
              </div>
            </motion.div>
          </div>

          {/* Title row: the plate overlaps the art's lower edge; date and ring sit beside it */}
          <motion.div
            className={h.head}
            style={{ opacity: plateOpacity, pointerEvents: collapsed ? "none" : undefined }}
          >
            {/* The plate's surface fades on its own, so the ring and date can fly in over it at full strength. */}
            <motion.div
              className={h.headBg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.3, delay: reduce ? 0 : ARRIVE.plate, ease: EASE }}
            />
            <motion.div
              key={p.id}
              className={h.plate}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.34, delay: reduce ? 0 : flip ? 0.06 : ARRIVE.plate, ease: EASE }}
            >
              <div className={h.statusRow}>
                {wrapped ? (
                  <span className={`${h.pill} ${h.pill_wrapped}`}>
                    <StatusGlyph status="wrapped" /> Wrapped {p.wrapped?.on}
                  </span>
                ) : (
                  <span className={h.menuWrap}>
                    <button
                      ref={statusBtnRef}
                      type="button"
                      className={`${h.pill} ${h[`pill_${p.status.replace("-", "_")}`]}`}
                      onClick={() => setStatusMenu((v) => !v)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          e.preventDefault();
                          setStatusMenu(true);
                        }
                      }}
                      aria-haspopup="menu"
                      aria-expanded={statusMenu}
                      aria-label={`Status: ${STATUS_LABEL[p.status]}. Change the status`}
                    >
                      <StatusGlyph status={p.status} />
                      {STATUS_LABEL[p.status]}
                      <Icon.chevronDown size={12} />
                    </button>
                    <AnimatePresence>
                      {statusMenu ? (
                        <motion.span
                          ref={statusMenuRef}
                          className={h.menu}
                          role="menu"
                          aria-label="Project status"
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.16 }}
                          onKeyDown={(e) =>
                            menuKeys(e, (refocus) => {
                              setStatusMenu(false);
                              if (refocus) statusBtnRef.current?.focus();
                            })
                          }
                        >
                          {(["on-track", "at-risk", "off-track", "not-started"] as Status[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              role="menuitemradio"
                              aria-checked={p.status === st}
                              tabIndex={-1}
                              className={h.menuItem}
                              onClick={() => {
                                onSetStatus(p.id, st);
                                setStatusMenu(false);
                                statusBtnRef.current?.focus();
                              }}
                            >
                              <StatusGlyph status={st} />
                              {STATUS_LABEL[st]}
                              {p.status === st ? <Icon.check size={14} /> : null}
                            </button>
                          ))}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </span>
                )}
                <span className={h.statusBy}>
                  Set by {p.statusBy === "You" ? "you" : p.statusBy} {whenPhrase(p.statusWhen)}
                </span>
              </div>
              <h2 id="hub-title" className={h.title}>
                {p.name}
              </h2>
              <p className={h.purpose}>{p.purpose}</p>
            </motion.div>

            <motion.div
              key={`facts-${p.id}`}
              className={h.heroFacts}
              initial={flip ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: flip ? 0.08 : 0, ease: EASE }}
            >
              <motion.span
                className={h.factsRule}
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: reduce || flip ? 0 : ARRIVE.plate, ease: EASE }}
              />
              <span className={h.dateWrap}>
                <motion.button
                  type="button"
                  layoutId={shared && badge ? `badge-${p.id}` : undefined}
                  initial={badge && shared ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...layoutT, opacity: { duration: 0.25, delay: reduce ? 0 : ARRIVE.facts } }}
                  className={`${h.dateBadge} ${badge ? "" : h.dateBadgeEmpty}`}
                  style={{ borderRadius: 12 }}
                  onClick={() => !wrapped && setDating((v) => !v)}
                  aria-expanded={dating}
                  aria-label={badge ? `Target date ${badge.big}, ${badge.small}. Change the date` : "Set a date"}
                  disabled={wrapped}
                >
                  <span className={h.dateLabel}>{p.end ? "Runs" : wrapped ? "Wrapped" : "Target date"}</span>
                  <span className={h.dateBig}>{badge ? badge.big : "No date yet"}</span>
                  <span className={h.dateSmall}>
                    {badge ? badge.small : "Set a date"}
                    {!wrapped ? <Icon.calendar size={12} /> : null}
                  </span>
                </motion.button>
                {dating ? (
                  <span className={h.datePop}>
                    <label className={h.datePopLabel}>
                      Target date
                      <input
                        type="date"
                        className={h.dateInput}
                        defaultValue={p.start ?? ""}
                        autoFocus
                        onChange={(e) => {
                          if (e.target.value) onSetDate(p.id, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" || e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            setDating(false);
                          }
                        }}
                      />
                    </label>
                    <span className={h.datePopRow}>
                      <button
                        type="button"
                        className={h.linkBtn}
                        onClick={() => {
                          onSetDate(p.id, null);
                          setDating(false);
                        }}
                      >
                        Clear date
                      </button>
                      <button type="button" className={h.doneBtn} onClick={() => setDating(false)}>
                        Done
                      </button>
                    </span>
                  </span>
                ) : null}
              </span>
              <motion.span
                layoutId={shared ? `ring-${p.id}` : undefined}
                initial={shared && !wrapped ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...layoutT, opacity: { duration: 0.25, delay: reduce ? 0 : ARRIVE.facts } }}
                className={h.ringDisc}
                style={{ borderRadius: 999 }}
              >
                <HealthRing pct={wrapped ? 100 : pct} status={p.status} overdue={p.overdue} size={72} stroke={6} />
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Body */}
          <motion.div
            key={p.id}
            className={h.body}
            initial={{ opacity: 0, y: reduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.4, delay: reduce ? 0.05 : flip ? 0.04 : ARRIVE.body, ease: EASE }}
          >
            <div className={h.colMain}>
              {wrapped ? (
                <section className={`${h.callout} ${h.calloutDone}`} style={{ order: 1 }}>
                  <span className={h.calloutIcon}>
                    <Icon.check size={16} />
                  </span>
                  <div>
                    <h3 className={h.calloutTitle}>Wrapped on {p.wrapped?.on}</h3>
                    <p className={h.calloutBody}>{p.wrapped?.stat}. Everything stays here to look back on or reuse.</p>
                  </div>
                  <div className={h.calloutActions}>
                    <button
                      type="button"
                      className={h.btnSoft}
                      onClick={() => say(`Starts a new project with the tasks, milestones and people from ${p.name}`)}
                    >
                      Reuse as a template
                    </button>
                  </div>
                </section>
              ) : p.needsYou && !dismissed[p.id] ? (
                <section className={h.callout} style={{ order: 1 }} aria-label="Needs you">
                  <span className={h.calloutIcon}>
                    <Icon.hand size={16} />
                  </span>
                  <div>
                    <h3 className={h.calloutTitle}>{p.needsYou.title}</h3>
                    <p className={h.calloutBody}>{p.needsYou.body}</p>
                  </div>
                  <div className={h.calloutActions}>
                    <button
                      type="button"
                      className={h.btnAccent}
                      onClick={() => say(`${p.needsYou!.action} opens here, with the comments beside it`)}
                    >
                      {p.needsYou.action}
                      <Icon.arrowRight size={14} />
                    </button>
                    <button
                      type="button"
                      className={h.btnGhost}
                      onClick={() => {
                        setDismissed((d) => ({ ...d, [p.id]: true }));
                        say("Moved to tomorrow morning. It will come back then");
                      }}
                    >
                      Later
                    </button>
                  </div>
                </section>
              ) : null}

              <Section
                title="This week"
                meta={weekMeta(p.week)}
                order={3}
                action="All tasks"
                onAction={() => say(`Opens Tasks, filtered to ${p.name}`)}
              >
                {p.week.length === 0 ? (
                  <p className={h.emptyLine}>
                    {wrapped ? "Nothing left to do. Every task was finished." : "Nothing due this week."}
                  </p>
                ) : (
                  <ul className={h.tasks}>
                    {p.week.map((t) => (
                      <TaskRow key={t.id} t={t} onToggle={() => onToggleTask(p.id, t.id)} />
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Milestones" meta={milestoneMeta(p)} order={4}>
                <Milestones p={p} />
              </Section>

              <Section title="Recent activity" order={7}>
                <Activity p={p} />
                {p.activity.length < 3 && !p.activity.some((a) => a.did === "created") ? (
                  <p className={h.earlier}>
                    <span className={h.earlierLabel}>Earlier</span>
                    Project started
                    {p.milestones[0] ? ` ${shortDate(p.milestones[0].date)}` : ""}
                    {owner ? ` by ${owner.person === ME ? "you" : firstName(owner.person)}` : ""}
                  </p>
                ) : null}
              </Section>
            </div>

            <aside className={h.colSide}>
              <section className={h.progressCard} style={{ order: 2 }} aria-label="Progress">
                <p className={h.progressBig}>
                  {p.done} <span className={h.progressOf}>of {p.total} tasks done</span>
                </p>
                <Segments p={p} />
                <ul className={h.legend}>
                  <li>
                    <i className={h.lgDone} /> Done <b>{p.done}</b>
                  </li>
                  <li>
                    <i className={h.lgReview} /> In review <b>{p.review}</b>
                  </li>
                  <li>
                    <i className={h.lgOverdue} /> Overdue <b>{p.overdue}</b>
                  </li>
                  <li>
                    <i className={h.lgOpen} /> Open <b>{Math.max(0, p.total - p.done - p.review - p.overdue)}</b>
                  </li>
                </ul>
              </section>

              <Section
                title="People"
                meta={`${p.members.length}`}
                order={5}
                action="Invite"
                onAction={() => say(`Invites someone to ${p.name} by name or email`)}
              >
                <ul className={h.people}>
                  {p.members.map((m) => (
                    <li key={m.person} className={h.person}>
                      <Avatar id={m.person} size={30} ring={false} />
                      <span className={h.personText}>
                        <span className={h.personName}>
                          {PEOPLE[m.person]?.name}
                          {m.person === ME ? <span className={h.you}> (you)</span> : null}
                        </span>
                        {m.org ? <span className={h.personOrg}>{m.org}</span> : null}
                      </span>
                      <span className={`${h.role} ${m.owner ? h.roleOwner : ""}`}>{m.role}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="Key links"
                order={6}
                action="Add"
                onAction={() => say("Pins a file from Files, or any link, for everyone on the project")}
              >
                {p.links.length === 0 ? (
                  <p className={h.emptyLine}>Pin the run-sheet, a floor plan or a folder so everyone finds them.</p>
                ) : (
                  <ul className={h.links}>
                    {p.links.map((l) => (
                      <li key={l.label}>
                        <MiniCover l={l} onOpen={() => say(`Opens ${l.label} in Files`)} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </aside>
          </motion.div>
        </div>
      </motion.div>

      <div className={h.toastSpot} role="status" aria-live="polite">
        <AnimatePresence>
          {toast ? (
            <motion.p
              key={toast.n}
              className={h.toast}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, transition: { duration: 0.14 } }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <span className={h.toastTag}>Preview</span>
              {toast.text}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function whenPhrase(when: string) {
  if (/^\d/.test(when) || WEEKDAYS.includes(when)) return `on ${when}`;
  return when;
}

function weekMeta(week: Task[]) {
  const open = week.filter((t) => t.state !== "done").length;
  if (week.length === 0) return undefined;
  return open === 0 ? "All done" : `${open} to do`;
}

function milestoneMeta(p: Project) {
  if (p.milestones.length === 0) return undefined;
  const next = p.milestones[p.current];
  if (!next) return "All passed";
  const n = daysFromToday(next.date);
  return n > 0 ? `Next: ${next.label}, in ${n} day${n === 1 ? "" : "s"}` : `Now: ${next.label}`;
}

function Section({
  title,
  meta,
  action,
  onAction,
  order,
  children,
}: {
  title: string;
  meta?: string;
  action?: string;
  onAction?: () => void;
  order: number;
  children: ReactNode;
}) {
  return (
    <section className={h.section} style={{ order }}>
      <header className={h.sectionHead}>
        <h3 className={h.sectionTitle}>{title}</h3>
        {meta ? <span className={h.sectionMeta}>{meta}</span> : null}
        {action ? (
          <button type="button" className={h.sectionAction} onClick={onAction}>
            {action}
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function TaskRow({ t, onToggle }: { t: Task; onToggle: () => void }) {
  const done = t.state === "done";
  const overdue = !done && daysFromToday(t.due) < 0;
  return (
    <li className={`${h.task} ${done ? h.taskDone : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "Mark as not done" : "Mark as done"}: ${t.title}`}
        className={`${h.check} ${done ? h.checkOn : ""}`}
        onClick={onToggle}
      >
        <motion.svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <motion.path
            d="m3.5 8.5 3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          />
        </motion.svg>
      </button>
      <span className={h.taskTitle}>{t.title}</span>
      <span className={h.taskMeta}>
        {overdue ? (
          <span className={h.chipOverdue}>
            <Icon.alert size={12} /> Overdue since {weekday(t.due)}
          </span>
        ) : t.state === "review" ? (
          <span className={h.chipReview}>In review</span>
        ) : null}
        {overdue ? null : <span className={h.due}>{done ? "Done" : weekday(t.due)}</span>}
        <Avatar id={t.who} size={24} ring={false} />
      </span>
    </li>
  );
}

function Milestones({ p }: { p: Project }) {
  const listRef = useRef<HTMLOListElement>(null);
  const { id, current } = p;
  // On a phone the stations scroll sideways: start with the current one in view.
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const now = list.children[Math.min(current, list.children.length - 1)] as HTMLElement | undefined;
    if (now) list.scrollLeft = Math.max(0, now.offsetLeft - list.offsetLeft - 16);
  }, [id, current]);
  if (p.milestones.length === 0) {
    return <p className={h.emptyLine}>No milestones yet. Add the first one, like &lsquo;Venue booked&rsquo;.</p>;
  }
  return (
    <ol ref={listRef} className={h.stations} style={{ ["--n" as string]: p.milestones.length }}>
      {p.milestones.map((m, i) => {
        const state = i < p.current ? "done" : i === p.current ? "now" : "later";
        const last = i === p.milestones.length - 1;
        return (
          <li key={m.label} className={`${h.station} ${h[`st_${state}`]} ${last ? h.stationLast : ""}`}>
            <span className={h.node} aria-hidden="true">
              {state === "done" ? <Icon.check size={12} /> : null}
            </span>
            <span className={h.stationLabel}>{m.label}</span>
            <span className={h.stationDate}>
              {state === "now" ? "Now · " : ""}
              {shortDate(m.date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Activity({ p }: { p: Project }) {
  const days: { day: string; items: Project["activity"] }[] = [];
  for (const a of p.activity) {
    const last = days[days.length - 1];
    if (last && last.day === a.day) last.items.push(a);
    else days.push({ day: a.day, items: [a] });
  }
  return (
    <div className={h.activity}>
      {days.map((d) => (
        <div key={d.day} className={h.actDay}>
          <h4 className={h.actDayLabel}>{d.day}</h4>
          <ul className={h.actList}>
            {d.items.map((a, i) => (
              <li key={i} className={h.act}>
                <Avatar id={a.who} size={22} ring={false} />
                <span className={h.actText}>
                  <strong>{a.who === ME ? "You" : firstName(a.who)}</strong> {a.did}{" "}
                  <span className={h.actWhat}>{a.what}</span>
                </span>
                <span className={h.actTime}>{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Segments({ p }: { p: Project }) {
  const total = Math.max(p.total, 1);
  const segs: string[] = [];
  for (let i = 0; i < p.done; i++) segs.push(h.segDone);
  for (let i = 0; i < p.review; i++) segs.push(h.segReview);
  for (let i = 0; i < p.overdue; i++) segs.push(h.segOverdue);
  while (segs.length < total) segs.push(h.segOpen);
  if (p.total > 24) {
    // Long projects: one continuous bar instead of a segment per task.
    const pc = (n: number) => `${(n / total) * 100}%`;
    return (
      <div className={h.bar}>
        <span className={h.segDone} style={{ width: pc(p.done) }} />
        <span className={h.segReview} style={{ width: pc(p.review) }} />
        <span className={h.segOverdue} style={{ width: pc(p.overdue) }} />
      </div>
    );
  }
  return (
    <div className={h.segments} aria-hidden="true">
      {segs.slice(0, total).map((cls, i) => (
        <motion.span key={i} layout className={`${h.seg} ${cls}`} />
      ))}
    </div>
  );
}

const LINK_KIND: Record<LinkKind, { label: string; cls: string }> = {
  doc: { label: "Doc", cls: h.k_doc },
  plan: { label: "Plan", cls: h.k_plan },
  folder: { label: "Folder", cls: h.k_folder },
  sheet: { label: "Sheet", cls: h.k_sheet },
  deck: { label: "Deck", cls: h.k_deck },
  image: { label: "Images", cls: h.k_image },
};

function MiniCover({ l, onOpen }: { l: KeyLink; onOpen: () => void }) {
  const k = LINK_KIND[l.kind];
  return (
    <button type="button" className={`${h.mini} ${k.cls}`} onClick={onOpen}>
      <span className={h.miniArt} aria-hidden="true">
        <MiniArt kind={l.kind} />
      </span>
      <span className={h.miniText}>
        <span className={h.miniLabel}>{l.label}</span>
        <span className={h.miniMeta}>
          {k.label} · {l.meta}
        </span>
      </span>
    </button>
  );
}

function MiniArt({ kind }: { kind: LinkKind }) {
  switch (kind) {
    case "doc":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="34" y="10" width="52" height="64" rx="3" className={h.maPaper} />
          <path d="M42 22h30M42 30h36M42 38h26M42 46h34M42 54h22" className={h.maInk} strokeWidth="2.4" />
        </svg>
      );
    case "plan":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="18" y="10" width="84" height="46" rx="2" className={h.maLine} strokeWidth="2" fill="none" />
          <path d="M60 10v14M18 34h22" className={h.maLine} strokeWidth="2" />
          {[34, 52, 70, 88].map((x) => (
            <circle key={x} cx={x} cy={44} r={5} className={h.maFill} />
          ))}
          <rect x="72" y="16" width="24" height="10" rx="2" className={h.maFill} />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="40" y="16" width="44" height="34" rx="3" className={h.maPaper} transform="rotate(-8 62 33)" />
          <rect x="38" y="14" width="44" height="34" rx="3" className={h.maPaper} transform="rotate(5 60 31)" />
          <path d="M30 26h20l5 5h35v27H30z" className={h.maFill} />
        </svg>
      );
    case "sheet":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="24" y="12" width="72" height="48" rx="3" className={h.maPaper} />
          <path d="M24 24h72M24 36h72M24 48h72M48 12v48M72 12v48" className={h.maLine} strokeWidth="1.4" />
          <rect x="24" y="12" width="72" height="12" rx="3" className={h.maFill} />
        </svg>
      );
    case "deck":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="36" y="12" width="56" height="34" rx="3" className={h.maPaper} opacity="0.6" />
          <rect x="28" y="20" width="56" height="34" rx="3" className={h.maFill} />
          <path d="M36 30h24M36 38h16" className={h.maOn} strokeWidth="2.4" />
        </svg>
      );
    case "image":
      return (
        <svg viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice">
          <rect x="26" y="10" width="68" height="48" rx="3" className={h.maPaper} />
          <circle cx="76" cy="24" r="6" className={h.maFill} />
          <path d="M26 52l20-20 16 14 10-8 22 16v4H26z" className={h.maFill} />
        </svg>
      );
  }
}
