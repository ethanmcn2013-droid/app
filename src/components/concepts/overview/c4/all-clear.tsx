"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CAPACITY,
  CLEAN_TASKS,
  dayLabel,
  HARVEST_TASKS,
  IDLE,
  PEOPLE,
  PROJECT_SUMMARY,
  PROJECTS,
  relativeDay,
  TASKS,
  TODAY,
  weekday,
  type Decision,
  type PersonId,
  type ProjectId,
} from "./data";
import { Avatar } from "./consequence";
import { ProjectTile } from "./stage";
import { ArrowRight, Check, Clock, KindIcon, Undo } from "./icons";
import { applyOutcomes, loadsFor, type Outcomes, type ProjectState } from "./model";
import s from "./c4.module.css";

const TEAM_ORDER: PersonId[] = ["aoife", "tomas", "priya", "cian", "niamh", "you"];

const SEGMENTS = [
  { key: "done", label: "Done", cls: s.segDone },
  { key: "review", label: "In review", cls: s.segReview },
  { key: "progress", label: "In progress", cls: s.segProgress },
  { key: "todo", label: "To do", cls: s.segTodo },
] as const;

export function AllClear({
  decisions,
  outcomes,
  state,
  inView,
  showProject,
  clean = false,
  onUndo,
  onOpen,
}: {
  decisions: Decision[];
  outcomes: Outcomes;
  state: Record<ProjectId, ProjectState>;
  inView: ProjectId[];
  showProject: boolean;
  clean?: boolean;
  onUndo: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const base = [...(clean ? CLEAN_TASKS : TASKS), ...(showProject ? HARVEST_TASKS : [])];
  const { soon, tasting, completed } = applyOutcomes(decisions, outcomes, base);
  const tasks = base.map((t) =>
    completed.has(t.id) ? { ...t, status: "done" as const, done: "Just now", fresh: true } : { ...t, fresh: false },
  );
  const done = [...tasks.filter((t) => t.fresh), ...tasks.filter((t) => t.status === "done" && !t.fresh)];
  const orchard = state.orchard;
  const counts = SEGMENTS.map((g) => ({ ...g, n: orchard[g.key] }));
  const open = inView.reduce((a, p) => a + state[p].open, 0);

  const calls = decisions
    .filter((d) => outcomes[d.id]?.type === "decided" || outcomes[d.id]?.type === "moot")
    .sort((a, b) => outcomes[a.id].at.localeCompare(outcomes[b.id].at));
  const deferred = decisions.filter((d) => outcomes[d.id]?.type === "deferred");
  const pending = decisions.filter((d) => !outcomes[d.id]);

  // Who is carrying what once this morning's calls land: the same numbers the choice panel shows.
  const loads = loadsFor(state, inView);
  const team = TEAM_ORDER.filter((id) => loads[id] !== undefined).map((id) => ({
    id,
    open: loads[id] ?? 0,
    idle: IDLE[id] ?? "Nothing dated this fortnight",
    next: soon.find((i) => i.owner === id && !i.milestone),
  }));
  const scale = Math.max(CAPACITY + 2, ...team.map((m) => m.open + 1));

  const rise = (i: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduce ? 0 : 0.36, delay: reduce ? 0 : 0.08 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] as const },
  });

  const orchardWaiting = pending.filter((d) => d.project === "orchard").length;
  const harvestWaiting = pending.filter((d) => d.project === "harvest").length;

  return (
    <div className={s.overview}>
      {showProject && (
        <motion.ul className={s.projStrip} aria-label="Projects" {...rise(0)}>
          <ProjectLine id="orchard" st={state.orchard} waiting={orchardWaiting} />
          <ProjectLine id="harvest" st={state.harvest} waiting={clean ? 0 : harvestWaiting} />
        </motion.ul>
      )}
      <div className={s.ovMain}>
        {!showProject && (
          <motion.section className={s.panelCard} aria-labelledby="ov-progress" {...rise(0)}>
            <div className={s.progressTop}>
              <div>
                <h2 id="ov-progress" className={s.sectionTitle}>
                  <ProjectTile id="orchard" size={18} />
                  The Orchard, events
                </h2>
                <p className={s.bigNum}>
                  {orchard.pct}
                  <span className={s.bigUnit}>%</span>
                </p>
                <p className={s.muted}>
                  {orchard.done} of {orchard.total} tasks done, {orchard.open} open
                </p>
              </div>
              <div className={s.countdown}>
                <p className={s.countdownNum}>79 days</p>
                <p className={s.muted}>until the wedding, Sat 3 Oct</p>
              </div>
            </div>
            <div className={s.segBar} role="img" aria-label={counts.map((c) => `${c.label} ${c.n}`).join(", ")}>
              {counts.map((c) => (
                <motion.span
                  key={c.key}
                  className={`${s.seg} ${c.cls}`}
                  style={{ flexGrow: c.n }}
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                />
              ))}
            </div>
            <ul className={s.legend}>
              {counts.map((c) => (
                <li key={c.key}>
                  <span className={`${s.legendDot} ${c.cls}`} aria-hidden="true" />
                  {c.label} <strong>{c.n}</strong>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        <motion.section className={s.panelCard} aria-labelledby="ov-soon" {...rise(1)}>
          <div className={s.sectionHead}>
            <h2 id="ov-soon" className={s.sectionTitle}>
              Next 14 days
            </h2>
            <span className={s.muted}>
              {soon.length} with a date, of {open} open
            </span>
          </div>
          <ul className={s.soon}>
            {soon.map((it) => {
              const late = it.due < TODAY;
              return (
                <motion.li key={it.id} className={s.soonRow} layout={!reduce}>
                  <span className={late ? `${s.soonDate} ${s.soonLate}` : s.soonDate}>
                    <span className={s.soonDay}>{it.due === TODAY ? "Today" : weekday(it.due)}</span>
                    <span className={s.soonNum}>{dayLabel(it.due)}</span>
                  </span>
                  <span className={it.milestone ? `${s.soonMark} ${s.soonMarkMilestone}` : s.soonMark} aria-hidden="true" />
                  <span className={s.soonTitle}>
                    {showProject && <ProjectTile id={it.project} size={14} />}
                    {it.title}
                    {late && <span className={`${s.pill} ${s.pillDanger}`}>{TODAY - it.due} days late</span>}
                    {it.moved && (
                      <span className={`${s.pill} ${s.pillAccent}`}>Moved from {dayLabel(it.baseDue)}</span>
                    )}
                    {it.newOwner && <span className={`${s.pill} ${s.pillAccent}`}>New owner</span>}
                    {it.added && <span className={`${s.pill} ${s.pillSuccess}`}>From your call</span>}
                  </span>
                  {it.owner ? <Avatar id={it.owner} size={22} /> : <span className={s.soonNoOwner} />}
                </motion.li>
              );
            })}
          </ul>
          <p className={s.soonThen}>
            Then: The Orchard menu tasting {weekday(tasting)} {dayLabel(tasting)}
            {tasting !== 32 && <span className={`${s.pill} ${s.pillAccent}`}>Moved from 1 Aug</span>}
            <span className={s.dotSep} aria-hidden="true" />
            Wedding day Sat 3 Oct
            {showProject && (
              <>
                <span className={s.dotSep} aria-hidden="true" />
                Harvest supper Sat 8 Aug
              </>
            )}
          </p>
        </motion.section>

        <motion.section className={s.panelCard} aria-labelledby="ov-done" {...rise(2)}>
          <div className={s.sectionHead}>
            <h2 id="ov-done" className={s.sectionTitle}>
              Finished this week
            </h2>
            <span className={s.muted}>{done.length}</span>
          </div>
          <ul className={s.doneList}>
            {done.map((t) => (
              <motion.li key={t.id} className={s.doneRow} layout={!reduce}>
                <span className={s.doneTick}>
                  <Check size={13} />
                </span>
                <span className={s.soonTitle}>
                  {t.title}
                  {t.fresh && <span className={`${s.pill} ${s.pillSuccess}`}>From your call</span>}
                </span>
                <span className={s.muted}>
                  {PEOPLE[t.owner].name}, {t.done?.toLowerCase()}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      </div>

      <aside className={s.ovSide} aria-label="This morning">
        {pending.length > 0 && (
          <motion.section className={`${s.panelCard} ${s.pendingCard}`} aria-labelledby="ov-pending" {...rise(0)}>
            <h2 id="ov-pending" className={s.sectionTitle}>
              Still waiting on you
            </h2>
            <ul className={s.receipt}>
              {pending.map((d) => (
                <li key={d.id} className={s.receiptRow}>
                  <KindChipMini kind={d.kind} />
                  <span className={s.receiptText}>
                    <span className={s.receiptTitle}>{d.short}</span>
                    {showProject && <span className={s.receiptMeta}>{PROJECTS[d.project].short}</span>}
                  </span>
                  <button type="button" className={s.linkBtn} onClick={() => onOpen(d.id)}>
                    Open
                    <ArrowRight size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {calls.length > 0 && (
          <motion.section className={`${s.panelCard} ${s.callsCard}`} aria-labelledby="ov-calls" {...rise(1)}>
            <div className={s.sectionHead}>
              <h2 id="ov-calls" className={s.sectionTitle}>
                Your calls this morning
              </h2>
              <span className={s.muted}>{calls.length}</span>
            </div>
            <ul className={s.receipt}>
              <AnimatePresence initial={false}>
                {calls.map((d) => {
                  const o = outcomes[d.id];
                  const text =
                    o.type === "decided"
                      ? d.choices[o.choice].filed
                      : o.type === "moot"
                        ? `${PEOPLE[o.by].name} sorted ${d.short.toLowerCase()}`
                        : "";
                  return (
                    <motion.li
                      key={d.id}
                      className={s.receiptRow}
                      layout={!reduce}
                      exit={{ opacity: 0, x: reduce ? 0 : -12 }}
                      transition={{ duration: reduce ? 0 : 0.2 }}
                    >
                      <span className={o.type === "moot" ? `${s.receiptTick} ${s.receiptTickMoot}` : s.receiptTick}>
                        <Check size={12} />
                      </span>
                      <span className={s.receiptText}>
                        <span className={s.receiptTitle}>{text}</span>
                        <span className={s.receiptMeta}>
                          {o.at}
                          {showProject && ` · ${PROJECTS[d.project].short}`}
                          {o.type === "decided" && d.choices[o.choice].draft && ` · note sent to ${d.choices[o.choice].draft?.to}`}
                        </span>
                      </span>
                      {o.type === "decided" && (
                        <button
                          type="button"
                          className={s.iconBtn}
                          onClick={() => onUndo(d.id)}
                          aria-label={`Undo: ${text}`}
                          title="Undo"
                        >
                          <Undo size={14} />
                        </button>
                      )}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </motion.section>
        )}

        {deferred.length > 0 && (
          <motion.section className={`${s.panelCard} ${s.laterCard}`} aria-labelledby="ov-later" {...rise(2)}>
            <div className={s.sectionHead}>
              <h2 id="ov-later" className={s.sectionTitle}>
                Waiting for later
              </h2>
              <span className={s.muted}>{deferred.length}</span>
            </div>
            <ul className={s.receipt}>
              {deferred.map((d) => {
                const o = outcomes[d.id];
                const opt = o.type === "deferred" ? d.defer[o.option] : undefined;
                return (
                  <li key={d.id} className={s.receiptRow}>
                    <span className={`${s.receiptTick} ${s.receiptTickLater}`}>
                      <Clock size={12} />
                    </span>
                    <span className={s.receiptText}>
                      <span className={s.receiptTitle}>{d.short}</span>
                      <span className={s.receiptMeta}>
                        Back {opt ? relativeDay(opt.until).toLowerCase() : "later"}
                        {opt && opt.until === TODAY ? `, ${opt.detail.split(", ")[1]}` : ""}
                      </span>
                    </span>
                    <button type="button" className={s.linkBtn} onClick={() => onUndo(d.id)}>
                      Bring back
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}

        <motion.section className={`${s.panelCard} ${s.teamCard}`} aria-labelledby="ov-team" {...rise(3)}>
          <div className={s.sectionHead}>
            <h2 id="ov-team" className={s.sectionTitle}>
              Who is on what
            </h2>
            <span className={s.muted}>{open} open tasks</span>
          </div>
          <ul className={s.team}>
            {team.map((m) => (
              <motion.li key={m.id} className={s.teamRow} layout={!reduce}>
                <Avatar id={m.id} size={26} />
                <span className={s.receiptText}>
                  <span className={s.receiptTitle}>{PEOPLE[m.id].name}</span>
                  <span className={`${s.receiptMeta} ${s.teamMeta}`}>
                    {m.next ? (
                      <>
                        <span className={m.next.due < TODAY ? s.teamWhenLate : s.teamWhen}>
                          {m.next.due < TODAY
                            ? `${TODAY - m.next.due} days late`
                            : m.next.due === TODAY
                              ? "Today"
                              : `${weekday(m.next.due)} ${dayLabel(m.next.due)}`}
                        </span>
                        {m.next.title}
                      </>
                    ) : (
                      m.idle
                    )}
                  </span>
                </span>
                <span className={s.teamLoad}>
                  <span className={s.teamTrack} aria-hidden="true">
                    <motion.span
                      className={m.open > CAPACITY ? `${s.teamFill} ${s.teamFillHigh}` : s.teamFill}
                      initial={false}
                      animate={{ scaleX: m.open / scale }}
                      transition={{ duration: reduce ? 0 : 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                    <span className={s.teamCap} style={{ left: `${(CAPACITY / scale) * 100}%` }} />
                  </span>
                  <span className={m.open > CAPACITY ? `${s.teamNum} ${s.teamNumHigh}` : s.teamNum}>{m.open}</span>
                </span>
              </motion.li>
            ))}
          </ul>
          <p className={s.cqFoot}>
            <span className={s.capKey} aria-hidden="true" />
            The line is a full week: {CAPACITY} open tasks.
          </p>
        </motion.section>
      </aside>
    </div>
  );
}

function ProjectLine({ id, st, waiting }: { id: ProjectId; st: ProjectState; waiting: number }) {
  const p = PROJECTS[id];
  const sum = PROJECT_SUMMARY[id];
  const people = Object.keys(st.load).length;
  return (
    <li className={s.projLine}>
      <span className={s.projHead}>
        <ProjectTile id={id} size={20} />
        <span className={s.projName}>{p.short}</span>
        <span className={waiting ? `${s.projState} ${s.projStateWaiting}` : s.projState}>
          {waiting ? `${waiting} waiting on you` : "On track"}
        </span>
      </span>
      <span className={s.projBar} aria-hidden="true">
        <span className={s.projFill} style={{ width: `${st.pct}%` }} />
      </span>
      <span className={s.projMeta}>
        <span>
          <strong className={s.projPct}>{st.pct}%</strong> {st.done} of {st.total} tasks done
        </span>
        <span>
          {id === "harvest" ? sum.note : `${people} people, ${st.open} open`}
        </span>
      </span>
      <span className={s.projNext}>
        Next: {sum.next}
        <span className={s.projEvent}>
          {sum.event}, in {sum.days} days
        </span>
      </span>
    </li>
  );
}

function KindChipMini({ kind }: { kind: Decision["kind"] }) {
  return (
    <span className={`${s.kindMini} ${s[`kind_${kind}`]}`}>
      <KindIcon kind={kind} size={13} />
    </span>
  );
}
