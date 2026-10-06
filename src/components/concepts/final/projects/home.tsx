"use client";

import { AnimatePresence, motion, useIsPresent, useMotionValueEvent, useScroll, useTransform, type PanInfo, type Variants } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDemoLinks } from "../../demo/links";
import { HealthMark } from "../../demo/health";
import { Avatar, HealthRing, Icon } from "./bits";
import {
  badgeFor,
  capFirst,
  dayDate,
  daysFromToday,
  fmtDate,
  fmtDaysCount,
  healthOf,
  isPastDue,
  ME,
  openByPerson,
  PEOPLE,
  percent,
  roleOf,
  statusLooksStale,
  STATUS_LABEL,
  statusWord,
  sum,
  weekday,
  type Activity,
  type LinkKind,
  type LinkRef,
  type Project,
  type Task,
  type Update,
} from "./data";
import { StatusGlyph } from "./parts";
import { hueVar } from "./cover-art";
import { CoverField, SharedCover } from "./shared-cover";
import { SPRING, statusSetBy, wrappedOn } from "./project-card";
import { DayBars, OpenTrend } from "./parts";
import { nextUp, StatusHistory } from "./sections";
import type { EditKind } from "./table";
import h from "./hub.module.css";
import m from "./home.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/*
 * Opening runs in sequence, not in parallel: the page behind goes first, the
 * cover grows, and only when it is about 70% of the way there do the plate,
 * the facts and the body arrive, 40 ms apart. No two layers of text share the screen.
 */
const ARRIVE = { plate: 0.26, facts: 0.3, body: 0.34 };

type Props = {
  p: Project;
  position: number;
  count: number;
  flip: -1 | 0 | 1;
  reduce: boolean;
  /** Where the home opened from: a shelf cover brings its date badge and ring with it; a ledger row has neither. */
  origin: "covers" | "ledger";
  canCompare: boolean;
  onClose: () => void;
  onStep: (dir: -1 | 1) => void;
  onEdit: (kind: EditKind, el: Element) => void;
  onToggleTask: (taskId: string) => void;
  onToggleMilestone: (msId: string) => void;
  onPost: (text: string) => void;
  onCompare: () => void;
  onWrap: () => void;
  onUnwrap: () => void;
  say: (text: string) => void;
};

/** The project home: the cover grown to the page, then everything the project needs, in one place. */
export function Home({
  p,
  position,
  count,
  flip,
  reduce,
  origin,
  canCompare,
  onClose,
  onStep,
  onEdit,
  onToggleTask,
  onToggleMilestone,
  onPost,
  onCompare,
  onWrap,
  onUnwrap,
  say,
}: Props) {
  const links = useDemoLinks();
  const scoped = (surface: "tasks/board" | "files" | "analytics" | "overview") => links.surface(surface, undefined, { project: p.id });
  const scroller = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const heroH = useRef(160);
  const { scrollY } = useScroll({ container: scroller });
  // Scroll thresholds follow the hero's real height, which is fluid.
  // The hero is short, so the plate stays until it has nearly scrolled under the bar, then the bar takes over.
  const plateOpacity = useTransform(scrollY, (v) => clamp01(1 - (v - heroH.current * 0.6) / 90));
  const compactOpacity = useTransform(scrollY, (v) => clamp01((v - (heroH.current + 10)) / 50));
  const [collapsed, setCollapsed] = useState(false);
  // Scroll can report before the home has mounted (the layout animation measures it); ignore that.
  const mounted = useRef(false);
  useMotionValueEvent(scrollY, "change", (v) => {
    if (mounted.current) setCollapsed(v > heroH.current + 30);
  });
  // Folding away, the collapsed bar leaves at once so only the cover travels home.
  const present = useIsPresent();

  const pct = percent(p.done, p.total);
  const badge = badgeFor(p);
  const wrapped = p.status === "wrapped";
  const past = isPastDue(p);
  const layoutT = SPRING;
  const shared = !reduce;
  const carried = shared && origin === "covers";

  useEffect(() => {
    mounted.current = true;
    backRef.current?.focus({ preventScroll: true });
    const el = heroRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // While the home folds away the hero empties; keep the last real height so the compact bar stays hidden.
      if (el.offsetHeight > 80) heroH.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => {
      mounted.current = false;
      ro.disconnect();
    };
  }, []);

  // Flipping to another project starts at its cover, not halfway down.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollTop > 0) el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [p.id, reduce]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -70 || info.velocity.x < -500) onStep(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) onStep(-1);
  }

  // Flipping swaps the hero for the next project's cover: the new one slides
  // in from the side it came from while the old one slides away.
  const flipVariants: Variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 90 }),
    center: { opacity: 1, x: 0, transition: { duration: 0.42, ease: EASE } },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -90, transition: { duration: 0.32, ease: EASE } }),
  };

  const load = openByPerson(p);
  const loadMax = Math.max(1, ...load.map((r) => r.open));
  const openTasks = p.total - p.done;
  // The list holds still while you tick: a finished task stays in place, struck through, until the home is reopened.
  const pick = () => ({ pid: p.id, ids: nextUp(p.tasks).slice(0, 6).map((t) => t.id) });
  const [shown, setShown] = useState(pick);
  if (shown.pid !== p.id) setShown(pick());
  const upNext = shown.ids.map((id) => p.tasks.find((t) => t.id === id)).filter((t): t is Task => !!t);
  const health = healthOf(p);
  const [showAllHistory, setShowAllHistory] = useState(false);

  return (
    <motion.div className={h.layer} role="dialog" aria-modal="true" aria-labelledby="home-title" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      {/* Opaque from the first frame's end: the lens is gone before any home text arrives. */}
      <motion.div
        className={h.sheetBg}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.24, delay: 0.06, ease: "linear" } }}
        transition={{ duration: reduce ? 0.18 : 0.12, ease: "linear" }}
      />
      <motion.div ref={scroller} layoutScroll className={`${h.scroller} thin-scroll`}>
        <div className={h.sheet} style={hueVar(p.tone)}>
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
                <motion.div className={h.heroDrag} drag={reduce ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18} onDragEnd={onDragEnd}>
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
                  <button type="button" className={h.stepBtn} onClick={() => onStep(-1)} aria-label="Previous project" title="Previous project (←)">
                    <Icon.chevronLeft size={16} />
                  </button>
                  <button type="button" className={h.stepBtn} onClick={() => onStep(1)} aria-label="Next project" title="Next project (→)">
                    <Icon.chevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            </motion.div>

            {/* Collapsed header after scrolling: a strip of the art stays above it */}
            <motion.div className={h.compact} style={{ opacity: present ? compactOpacity : 0, pointerEvents: collapsed && present ? "auto" : "none" }} aria-hidden={!collapsed}>
              <div className={h.compactInner}>
                <button type="button" className={h.iconBtn} onClick={onClose} aria-label="Back to projects" tabIndex={collapsed ? 0 : -1}>
                  <Icon.chevronLeft size={16} />
                </button>
                <HealthRing pct={wrapped ? 100 : pct} status={p.status} tooEarly={p.tooEarly} size={36} stroke={3.5} />
                <span className={h.compactText}>
                  <span className={h.compactName}>{p.name}</span>
                  <span className={h.compactMeta}>
                    <StatusGlyph status={p.status} tooEarly={p.tooEarly} /> {statusWord(p)} · {p.total ? `${p.done} of ${p.total} done` : "No tasks yet"} · {badge.big}
                  </span>
                </span>
                <span className={h.compactSteps}>
                  <button type="button" className={h.iconBtn} onClick={() => onStep(-1)} aria-label="Previous project" tabIndex={collapsed ? 0 : -1}>
                    <Icon.chevronLeft size={16} />
                  </button>
                  <button type="button" className={h.iconBtn} onClick={() => onStep(1)} aria-label="Next project" tabIndex={collapsed ? 0 : -1}>
                    <Icon.chevronRight size={16} />
                  </button>
                </span>
              </div>
            </motion.div>
          </div>

          {/* Title row: the plate overlaps the art's lower edge; date and ring sit beside it */}
          <motion.div className={h.head} style={{ opacity: plateOpacity, pointerEvents: collapsed ? "none" : undefined }}>
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
                    <StatusGlyph status="wrapped" /> Wrapped {wrappedOn(p)}
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`${h.pill} ${h[`pill_${health}`]}`}
                    onClick={(e) => onEdit("status", e.currentTarget)}
                    aria-haspopup="dialog"
                    aria-keyshortcuts="s"
                    aria-label={`How it is doing: ${statusWord(p)}. Change it, or wrap the project up`}
                  >
                    {health ? <HealthMark health={health} size={14} /> : null}
                    {statusWord(p)}
                    {statusLooksStale(p) ? <span className={m.stale}>?</span> : null}
                    <Icon.chevronDown size={12} />
                  </button>
                )}
                <span className={h.statusBy}>{p.tooEarly && p.status === "on_track" ? `· ${statusSetBy(p)}` : capFirst(statusSetBy(p))}</span>
              </div>
              {p.reason && !wrapped ? (
                <p className={m.healthReason} data-status={p.status}>
                  {p.reason}
                </p>
              ) : null}
              <h2 id="home-title" className={h.title}>
                {p.name}
              </h2>
              <p className={h.purpose}>{p.purpose}</p>
              <div className={m.meta}>
                <button
                  type="button"
                  className={m.metaBtn}
                  onClick={(e) => !wrapped && onEdit("owner", e.currentTarget)}
                  disabled={wrapped}
                  aria-keyshortcuts="o"
                  aria-label={`Lead: ${PEOPLE[p.owner]?.name}. Change the lead`}
                >
                  <Avatar id={p.owner} size={20} ring={false} />
                  <span className={m.metaLabel}>Lead</span>
                  {PEOPLE[p.owner]?.name}
                  {p.owner === ME ? <span className={h.you}> (you)</span> : null}
                </button>
                <span className={m.metaSep} aria-hidden="true" />
                <nav className={m.jump} aria-label={`${p.name} in other views`}>
                  <Link className={m.jumpLink} href={scoped("tasks/board")} prefetch={false}>
                    <Icon.check size={13} /> Tasks
                  </Link>
                  <Link className={m.jumpLink} href={scoped("files")} prefetch={false}>
                    <Icon.doc size={13} /> Files
                  </Link>
                  <Link className={m.jumpLink} href={scoped("analytics")} prefetch={false}>
                    <Icon.chart size={13} /> Analytics
                  </Link>
                  <Link className={m.jumpLink} href={scoped("overview")} prefetch={false}>
                    <Icon.calendar size={13} /> Overview
                  </Link>
                  {canCompare ? (
                    <button type="button" className={m.jumpLink} onClick={onCompare} aria-keyshortcuts="c">
                      <Icon.compare size={13} /> Compare
                    </button>
                  ) : null}
                </nav>
              </div>
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
                  layoutId={carried ? `badge-${p.id}` : undefined}
                  initial={carried ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...layoutT, opacity: { duration: 0.25, delay: reduce ? 0 : ARRIVE.facts } }}
                  className={`${h.dateBadge} ${past ? m.datePast : ""}`}
                  style={{ borderRadius: 12 }}
                  onClick={(e) => !wrapped && onEdit("date", e.currentTarget)}
                  aria-keyshortcuts="d"
                  aria-label={`${p.end ? "Runs" : "Date"} ${badge.big}, ${badge.small}. Change the date`}
                  disabled={wrapped}
                >
                  <span className={h.dateLabel}>{p.end ? "Runs" : wrapped ? "Wrapped" : "Date"}</span>
                  <span className={h.dateBig}>{badge.big}</span>
                  <span className={h.dateSmall}>
                    {badge.small}
                    {!wrapped ? <Icon.calendar size={12} /> : null}
                  </span>
                </motion.button>
              </span>
              <motion.span
                layoutId={carried ? `ring-${p.id}` : undefined}
                initial={carried && !wrapped ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...layoutT, opacity: { duration: 0.25, delay: reduce ? 0 : ARRIVE.facts } }}
                className={h.ringDisc}
                style={{ borderRadius: 999 }}
              >
                <HealthRing pct={wrapped ? 100 : pct} status={p.status} tooEarly={p.tooEarly} size={64} stroke={5.5} />
              </motion.span>
              <span className={m.ringWords}>
                <span className={m.ringWordsBig}>{p.total ? `${p.done} of ${p.total}` : "No tasks"}</span>
                <span className={m.ringWordsSmall}>
                  {p.total ? "tasks done" : "yet"}
                  {p.overdue ? <span className={m.ringLate}>{p.overdue} late</span> : null}
                </span>
              </span>
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
                    <h3 className={h.calloutTitle}>Wrapped on {wrappedOn(p)}</h3>
                    <p className={h.calloutBody}>
                      {p.done} of {p.total} tasks done. Everything stays here to look back on. Bring it back if there is more to do.
                    </p>
                  </div>
                  <div className={h.calloutActions}>
                    <button type="button" className={h.btnSoft} onClick={onUnwrap}>
                      Bring it back
                    </button>
                  </div>
                </section>
              ) : past ? (
                <section className={`${h.callout} ${m.calloutPast}`} style={{ order: 1 }} aria-label="Past its date">
                  <span className={h.calloutIcon}>
                    <Icon.clock size={16} />
                  </span>
                  <div>
                    <h3 className={h.calloutTitle}>Past its date: it was {fmtDate(p.end ?? p.date)}</h3>
                    <p className={h.calloutBody}>
                      {openTasks ? `${openTasks} ${openTasks === 1 ? "task is" : "tasks are"} still open. ` : ""}Wrap it up if it is finished, or move the date.
                    </p>
                  </div>
                  <div className={h.calloutActions}>
                    <button type="button" className={h.btnAccent} onClick={onWrap}>
                      <Icon.check size={14} /> Wrap up
                    </button>
                    <button type="button" className={h.btnSoft} onClick={(e) => onEdit("date", e.currentTarget)}>
                      Move the date
                    </button>
                  </div>
                </section>
              ) : p.needsYou ? (
                <section className={`${h.callout} ${p.needsYou.late ? m.calloutLate : ""}`} style={{ order: 1 }} aria-label="Yours">
                  <span className={h.calloutIcon}>
                    {p.needsYou.late ? <Icon.clock size={16} /> : <Icon.hand size={16} />}
                  </span>
                  <div>
                    <h3 className={h.calloutTitle}>{p.needsYou.title}</h3>
                    <p className={h.calloutBody}>{p.needsYou.body}</p>
                  </div>
                  <div className={h.calloutActions}>
                    <Link className={h.btnAccent} href={links.task(p.needsYou.taskId)} prefetch={false}>
                      Open the task
                      <Icon.arrowRight size={14} />
                    </Link>
                  </div>
                </section>
              ) : null}

              <Section
                title="Updates"
                meta={p.updates.length ? `${p.updates.length} ${p.updates.length === 1 ? "update" : "updates"}` : undefined}
                order={2}
              >
                <UpdatesFeed p={p} onPost={onPost} />
              </Section>

              <Section
                title="Next up"
                meta={p.total === 0 ? undefined : openTasks === 0 ? "All done" : `${openTasks} open${p.overdue ? `, ${p.overdue} late` : ""}`}
                order={4}
                action={
                  p.total > 0 ? (
                    <Link className={h.sectionAction} href={scoped("tasks/board")} prefetch={false}>
                      All {p.total} tasks
                    </Link>
                  ) : null
                }
              >
                {upNext.length === 0 ? (
                  p.total === 0 && !wrapped ? (
                    <div className={m.emptyTasks}>
                      <p className={m.emptyTasksTitle}>No tasks yet</p>
                      <p className={m.emptyTasksBody}>Add the first few things to do. They show here, on the board and in the week ahead.</p>
                      <Link className={h.btnAccent} href={links.surface("tasks/list", undefined, { project: p.id })} prefetch={false}>
                        <Icon.plus size={14} /> Add tasks
                      </Link>
                    </div>
                  ) : (
                    <p className={h.emptyLine}>{wrapped ? "Nothing left to do. Every task was finished." : "Every task is done."}</p>
                  )
                ) : (
                  <ul className={h.tasks}>
                    {upNext.map((t) => (
                      <TaskRow key={t.id} t={t} href={links.task(t.id)} onToggle={() => onToggleTask(t.id)} />
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Big dates" meta={milestoneMeta(p)} order={5}>
                <Milestones p={p} onToggle={onToggleMilestone} />
              </Section>

              <Section title="Recent work" order={8}>
                <ActivityDays p={p} />
              </Section>
            </div>

            <aside className={h.colSide}>
              {p.total === 0 ? (
                <section className={h.progressCard} style={{ order: 3 }} aria-label="Tasks">
                  <p className={m.emptyTasksTitle}>Progress starts with the first task</p>
                  <p className={m.trendSub}>How much is done, what is late and how the pace compares with the date all show here once there is work to count.</p>
                </section>
              ) : (
              <section className={h.progressCard} style={{ order: 3 }} aria-label="Tasks">
                <p className={h.progressBig}>
                  {p.total} <span className={h.progressOf}>{p.total === 1 ? "task" : "tasks"}</span>
                </p>
                <Segments p={p} />
                <ul className={h.legend}>
                  <li>
                    <i className={h.lgDone} /> Done <b>{p.done}</b>
                  </li>
                  <li>
                    <i className={h.lgReview} /> To check <b>{p.review}</b>
                  </li>
                  <li>
                    <i className={h.lgOverdue} /> Late <b>{p.overdue}</b>
                  </li>
                  <li>
                    <i className={h.lgOpen} /> Other open <b>{Math.max(0, p.total - p.done - p.review - p.overdue)}</b>
                  </li>
                </ul>
                <div className={m.trend}>
                  <div className={m.trendHead}>
                    <span className={m.trendLabel}>Open tasks, last 14 days</span>
                    <OpenTrend p={p} width={56} height={16} />
                  </div>
                  <DayBars done={p.sparkDone} added={p.sparkAdded} width={264} height={40} />
                  <span className={m.trendSub}>
                    {sum(p.sparkDone)} done and {sum(p.sparkAdded)} added in 14 days
                    {sum(p.sparkDone) > 0 ? `, ${sum(p.sparkDone.slice(-7))} of the done in the last 7` : ""}. Done above the line, added below.
                  </span>
                </div>
                {!wrapped ? <p className={m.pace} data-verdict={p.pace.verdict}>{paceLine(p)}</p> : null}
              </section>
              )}

              <Section title="People" meta={`${p.people.length} on it`} order={6} action={<button type="button" className={h.sectionAction} onClick={() => say(`Invites someone to ${p.name} by name or email`)}>Invite</button>}>
                <ul className={h.people}>
                  {load.map((r) => (
                    <li key={r.who} className={`${h.person} ${m.person}`}>
                      <Avatar id={r.who} size={30} ring={false} />
                      <span className={h.personText}>
                        <span className={h.personName}>
                          {PEOPLE[r.who]?.name}
                          {r.who === ME ? <span className={h.you}> (you)</span> : null}
                        </span>
                        <span className={h.personOrg}>{roleOf(p, r.who)}</span>
                      </span>
                      {!wrapped ? (
                        <span className={m.load}>
                          <span className={m.loadBar} aria-hidden="true">
                            <span style={{ width: `${(r.open / loadMax) * 100}%` }} />
                            <span className={m.loadLate} style={{ width: `${(r.overdue / loadMax) * 100}%` }} />
                          </span>
                          <span className={m.loadN}>
                            {r.open} open {r.open === 1 ? "task" : "tasks"}
                            {r.overdue > 0 ? <span className={m.loadLateN}>, {r.overdue} late</span> : null}
                          </span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                title="Files"
                meta={p.links.length ? `${p.links.length}` : undefined}
                order={7}
                action={
                  <Link className={h.sectionAction} href={scoped("files")} prefetch={false}>
                    All files
                  </Link>
                }
              >
                {p.links.length === 0 ? (
                  <p className={h.emptyLine}>No files yet. Add the run sheet, a floor plan or a quote in Files.</p>
                ) : (
                  <ul className={h.links}>
                    {p.links.slice(0, 4).map((l) => (
                      <li key={l.id}>
                        <MiniLink l={l} href={scoped("files")} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="How it has been doing" order={9}>
                <StatusHistory history={p.history} limit={showAllHistory ? undefined : 4} />
                {p.history.length > 4 ? (
                  <button type="button" className={m.feedMore} onClick={() => setShowAllHistory((v) => !v)}>
                    {showAllHistory ? "Show fewer" : `Show all ${p.history.length}`}
                  </button>
                ) : null}
              </Section>
            </aside>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function milestoneMeta(p: Project) {
  if (p.milestones.length === 0) return undefined;
  const done = p.milestones.filter((x) => x.done).length;
  const next = [...p.milestones].filter((x) => !x.done).sort((x, y) => x.date.localeCompare(y.date))[0];
  if (!next) return `${done} of ${p.milestones.length} done`;
  const n = daysFromToday(next.date);
  if (n < 0) return `${next.name}, ${fmtDaysCount(-n)} late`;
  return `Next: ${next.name}, ${n === 0 ? "today" : `in ${fmtDaysCount(n)}`}`;
}

/** The store's forecast in one line: open work due by the date, at the last 7 days' pace. */
function paceLine(p: Project) {
  const f = p.pace;
  if (f.verdict === "too_early") return "Too early to tell how the pace compares with the date.";
  if (f.verdict === "done") return "Nothing left to do before the date.";
  if (!f.finish || f.spare === null) return `${f.remaining} ${f.remaining === 1 ? "task" : "tasks"} due by the date, and nothing finished in the last 7 days.`;
  const when = dayDate(f.finish);
  const n = `${f.remaining} ${f.remaining === 1 ? "task" : "tasks"}`;
  return f.spare >= 0
    ? `At this pace the ${n} due by the date are done ${when}: ${fmtDaysCount(f.spare)} to spare.`
    : `At this pace the ${n} due by the date are done ${when}: ${fmtDaysCount(-f.spare)} past it.`;
}

function Section({ title, meta, action, order, children }: { title: string; meta?: string; action?: ReactNode; order: number; children: ReactNode }) {
  return (
    <section className={h.section} style={{ order }}>
      <header className={h.sectionHead}>
        <h3 className={h.sectionTitle}>{title}</h3>
        {meta ? <span className={h.sectionMeta}>{meta}</span> : null}
        {action}
      </header>
      {children}
    </section>
  );
}

function TaskRow({ t, href, onToggle }: { t: Task; href: string; onToggle: () => void }) {
  const done = t.state === "done";
  const n = t.due ? daysFromToday(t.due) : null;
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
      <Link className={h.taskTitle} href={href} prefetch={false}>
        {t.title}
      </Link>
      <span className={h.taskMeta}>
        {t.late && n !== null ? (
          <span className={h.chipOverdue}>{fmtDaysCount(-n)} late</span>
        ) : t.state === "waiting" && t.waitingOn ? (
          <span className={h.chipReview}>Waiting on {t.waitingOn}</span>
        ) : t.state === "review" ? (
          <span className={h.chipReview}>To check</span>
        ) : null}
        {t.late ? null : <span className={h.due}>{done ? "Done" : t.due ? weekday(t.due) : "No date"}</span>}
        <Avatar id={t.who} size={24} ring={false} />
      </span>
    </li>
  );
}

/** Milestone stations. Each one is a toggle: tick it off and both lenses update at once. */
function Milestones({ p, onToggle }: { p: Project; onToggle: (id: string) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const nowIndex = p.milestones.findIndex((x) => !x.done);
  const { id } = p;
  // On a phone the stations scroll sideways: start with the current one in view.
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const now = list.children[Math.max(0, nowIndex)] as HTMLElement | undefined;
    if (now) list.scrollLeft = Math.max(0, now.offsetLeft - list.offsetLeft - 16);
  }, [id, nowIndex]);
  if (p.milestones.length === 0) {
    return <p className={h.emptyLine}>No milestones yet. Add the first one, like “Venue booked”.</p>;
  }
  return (
    <ol ref={listRef} className={h.stations} style={{ ["--n" as string]: p.milestones.length }}>
      {p.milestones.map((x, i) => {
        const state = x.done ? "done" : i === nowIndex ? "now" : "later";
        const n = daysFromToday(x.date);
        const late = !x.done && n < 0;
        const last = i === p.milestones.length - 1;
        return (
          <li key={x.id} className={`${h.station} ${h[`st_${state}`]} ${last ? h.stationLast : ""}`}>
            <button
              type="button"
              className={m.stationBtn}
              aria-pressed={x.done}
              aria-label={`${x.name}, ${fmtDate(x.date)}${late ? `, ${fmtDaysCount(-n)} late` : ""}. ${x.done ? "Done. Mark as not done" : "Mark as done"}`}
              onClick={() => onToggle(x.id)}
            >
              <span className={h.node} aria-hidden="true">
                {x.done ? <Icon.check size={12} /> : null}
              </span>
            </button>
            <span className={h.stationLabel}>{x.name}</span>
            <span className={`${h.stationDate} ${late ? m.stationLate : ""}`}>
              {late ? `${fmtDaysCount(-n)} late · ` : state === "now" ? "Next · " : ""}
              {fmtDate(x.date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const UPDATE_KIND: Record<Update["kind"], string | null> = { update: null, health: "How it is doing", wrapped: "Wrapped" };

/** The updates feed: the newest one large, the two before it small, and a composer. Posting goes to the store. */
function UpdatesFeed({ p, onPost }: { p: Project; onPost: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  const [all, setAll] = useState(false);
  const wrapped = p.status === "wrapped";
  const [first, ...rest] = p.updates;
  const older = all ? rest : rest.slice(0, 2);
  const by = (u: Update) => (u.who === ME ? "You" : (PEOPLE[u.who]?.short ?? u.who));
  const tag = (u: Update) => {
    const k = UPDATE_KIND[u.kind];
    if (!k) return null;
    if (u.kind === "health") {
      const step = [...p.history].reverse().find((x) => x.date === u.date && x.reason === u.text);
      return step ? `${k}: ${STATUS_LABEL[step.status]}` : k;
    }
    return k;
  };
  return (
    <div className={m.update} data-status={p.status}>
      {first ? (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={first.id}
            className={m.updateLead}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <p className={m.updateText}>
              <Avatar id={first.who} size={22} ring={false} />
              <span>{first.text}</span>
            </p>
            <p className={m.updateMeta}>
              {by(first)} · {dayDate(first.date)}
              {tag(first) ? <span className={m.updateTag}>{tag(first)}</span> : null}
            </p>
          </motion.div>
        </AnimatePresence>
      ) : (
        <p className={m.updateEmpty}>No updates yet. Say how it is going in a line or two, and the team sees it here.</p>
      )}
      {older.length ? (
        <ol className={m.feed}>
          {older.map((u) => (
            <li key={u.id} className={m.feedItem}>
              <Avatar id={u.who} size={18} ring={false} />
              <span className={m.feedBody}>
                <span className={m.feedText}>{u.text}</span>
                <span className={m.feedMeta}>
                  {by(u)} · {dayDate(u.date)}
                  {tag(u) ? ` · ${tag(u)}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {rest.length > 2 ? (
        <button type="button" className={m.feedMore} onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${p.updates.length} updates`}
        </button>
      ) : null}
      {!wrapped ? (
        <form
          className={m.composer}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onPost(draft.trim());
            setDraft("");
          }}
        >
          <input
            className={m.composerInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write an update for the team"
            aria-label="Write an update for the team"
            maxLength={280}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <button type="submit" className={m.post} disabled={!draft.trim()}>
            Post
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ActivityDays({ p }: { p: Project }) {
  // Updates have their own feed; this is the work itself.
  const items = p.activity.filter((a) => a.kind === "task" || a.kind === "file").slice(0, 12);
  const days: { day: string; items: Activity[] }[] = [];
  for (const a of items) {
    const last = days[days.length - 1];
    if (last && last.day === a.date) last.items.push(a);
    else days.push({ day: a.date, items: [a] });
  }
  if (days.length === 0) return <p className={h.emptyLine}>Nothing has moved yet. Finished tasks and shared files show here.</p>;
  return (
    <div className={h.activity}>
      {days.map((d) => (
        <div key={d.day} className={h.actDay}>
          <h4 className={h.actDayLabel}>{dayLabel(d.day)}</h4>
          <ul className={h.actList}>
            {d.items.map((a) => (
              <li key={a.id} className={h.act}>
                <Avatar id={a.who} size={22} ring={false} />
                <span className={h.actText}>
                  <strong>{a.who === ME ? "You" : PEOPLE[a.who]?.short}</strong>{" "}
                  {a.kind === "status" ? (
                    <>
                      posted an update: <span className={h.actWhat}>{a.text}</span>
                    </>
                  ) : (
                    <span className={h.actWhat}>{a.text.charAt(0).toLowerCase() + a.text.slice(1)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** "Today", "Yesterday", "Wed 23 Sep". */
function dayLabel(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return `${weekday(iso) === fmtDate(iso) ? "" : `${weekday(iso)} `}${fmtDate(iso)}`;
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

function MiniLink({ l, href }: { l: LinkRef; href: string }) {
  const k = LINK_KIND[l.kind];
  return (
    <Link className={`${h.mini} ${k.cls}`} href={href} prefetch={false} title={l.label}>
      <span className={h.miniArt} aria-hidden="true">
        <MiniArt kind={l.kind} />
      </span>
      <span className={h.miniText}>
        <span className={h.miniLabel}>{l.label}</span>
        <span className={h.miniMeta}>
          {k.label} · {l.meta}
        </span>
      </span>
    </Link>
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
