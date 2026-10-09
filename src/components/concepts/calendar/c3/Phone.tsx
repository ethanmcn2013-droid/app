"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TODAY, type Person, type Project, type Task } from "./data";
import {
  LEVEL_WORD,
  addDays,
  buildLoad,
  cellKey,
  dayKind,
  dayNum,
  daysFrom,
  hrs,
  levelOf,
  mondayOf,
  personTotal,
  shortDate,
  spanLabel,
  suggest,
  wd,
  weekSummary,
  type LoadMap,
  type Suggestion,
} from "./model";
import { Avatar, Num, SuggestionCard, tagLabel, tagOf } from "./Bits";
import { ProjectSwitcher } from "./Header";
import { MoveMenu } from "./Panel";
import { Icon } from "./icons";
import styles from "./c3.module.css";

type MoveFn = (taskId: string, to: { personId: string | null; date: string }) => void;

export function PhoneView({
  project,
  projects,
  onProject,
  tasks,
  onMove,
  onApply,
  flash,
}: {
  project: Project;
  projects: Project[];
  onProject: (id: string) => void;
  tasks: Task[];
  onMove: MoveFn;
  onApply: (s: Suggestion) => void;
  flash: { keys: string[]; at: number } | null;
}) {
  const [week, setWeek] = useState(mondayOf(TODAY));
  const [dir, setDir] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [moving, setMoving] = useState<Task | null>(null);
  const days = useMemo(() => daysFrom(week, 7), [week]);
  const load = useMemo(() => buildLoad(project, tasks, days), [project, tasks, days]);
  const ideas = useMemo(() => suggest(project, tasks, days, load), [project, tasks, days, load]);
  const sum = weekSummary(project, load, days);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const go = (d: -1 | 1) => {
    setDir(d);
    setWeek((w) => addDays(w, d * 7));
  };

  const open = openId ? (openId === "none" ? null : project.people.find((p) => p.id === openId)) : undefined;

  return (
    <div className={styles.phone}>
      <header className={styles.phoneHead}>
        {open !== undefined ? (
          <button type="button" className={styles.backBtn} onClick={() => setOpenId(null)}>
            <Icon.chevronLeft size={14} />
            Everyone
          </button>
        ) : null}
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>{open === undefined ? "Team load" : open ? open.name : "Unassigned"}</h1>
          {open === undefined && <ProjectSwitcher project={project} projects={projects} onProject={onProject} />}
        </div>
        <div className={styles.phoneWeekNav}>
          <button type="button" className={styles.iconBtn} onClick={() => go(-1)} aria-label="Previous week">
            <Icon.chevronLeft />
          </button>
          <div className={styles.phoneWeekText}>
            <span className={styles.phoneWeekSpan}>{spanLabel(days[0], days[6])}</span>
            <span className={styles.phoneWeekSub}>{week === mondayOf(TODAY) ? "This week" : "Swipe to change week"}</span>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => go(1)} aria-label="Next week">
            <Icon.chevronRight />
          </button>
        </div>
      </header>

      <div className={styles.phoneTotal} aria-label="Team total for the week">
        <span className={styles.phoneTotalLabel}>Team</span>
        <div className={styles.strip7}>
          {days.map((d) => {
            let h = 0;
            let a = 0;
            for (const p of project.people) {
              const c = load.get(cellKey(p.id, d));
              if (c) {
                h += c.hours;
                a += c.avail;
              }
            }
            const lvl = a === 0 ? (h > 0 ? "over" : "none") : levelOf(h, a);
            return (
              <span key={d} className={styles.tile} data-level={lvl} data-today={d === TODAY || undefined}>
                <span className={styles.tileWd}>{wd(d).slice(0, 1)}</span>
                <span className={styles.tileNum}>{h > 0 ? Math.round(h) : "–"}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div
        className={styles.phoneBody}
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={week + (openId ?? "")}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {open === undefined ? (
              <>
                <p className={styles.phoneMsg} data-tone={sum.over ? "over" : sum.full ? "full" : "calm"}>
                  {sum.over === 0 && sum.full === 0 ? (
                    <>
                      <Icon.check size={14} />
                      Everyone has room this week.
                    </>
                  ) : sum.over > 0 ? (
                    <>
                      <Icon.over size={14} />
                      {sum.over} {sum.over === 1 ? "day is" : "days are"} over this week
                    </>
                  ) : (
                    <>{sum.full} full days, no one over</>
                  )}
                </p>
                {ideas[0] && (
                  <div className={styles.phoneIdea}>
                    <SuggestionCard s={ideas[0]} project={project} compact onApply={() => onApply(ideas[0])} />
                  </div>
                )}
                <ul className={styles.phoneList}>
                  {[...project.people, null].map((p) => (
                    <PersonStrip key={p?.id ?? "none"} person={p} days={days} load={load} flash={flash} onOpen={() => setOpenId(p?.id ?? "none")} />
                  ))}
                </ul>
              </>
            ) : (
              <PersonDays person={open} days={days} load={load} project={project} onMoveTask={setMoving} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {moving && (
          <>
            <motion.div className={styles.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoving(null)} />
            <motion.div
              className={styles.sheet}
              role="dialog"
              aria-label={`Move ${moving.title}`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <span className={styles.sheetGrab} aria-hidden="true" />
              <div className={styles.sheetHead}>
                <h2 className={styles.sheetTitle}>Move {moving.title}</h2>
                <button type="button" className={styles.iconBtn} onClick={() => setMoving(null)} aria-label="Close">
                  <Icon.close />
                </button>
              </div>
              <MoveMenu
                task={moving}
                project={project}
                load={buildLoad(project, tasks, daysFrom(mondayOf(moving.date), 7))}
                onPick={(to) => {
                  onMove(moving.id, to);
                  setMoving(null);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PersonStrip({
  person,
  days,
  load,
  flash,
  onOpen,
}: {
  person: Person | null;
  days: string[];
  load: LoadMap;
  flash: { keys: string[]; at: number } | null;
  onOpen: () => void;
}) {
  const pid = person?.id ?? null;
  const total = personTotal(pid, load, days);
  const count = days.reduce((s, d) => s + (load.get(cellKey(pid, d))?.tasks.length ?? 0), 0);
  if (!person && count === 0) return null;
  return (
    <li>
      <button type="button" className={styles.personCard} onClick={onOpen}>
        <span className={styles.personCardHead}>
          {person ? (
            <Avatar person={person} size={32} />
          ) : (
            <span className={styles.unassignedIcon} data-lg="">
              <Icon.inbox size={15} />
            </span>
          )}
          <span className={styles.nameText}>
            <span className={styles.name}>
              {person ? person.first : "Unassigned"}
              {person?.guest && <span className={styles.guest}>Guest</span>}
            </span>
            <span className={styles.role}>
              {person
                ? total.hours === 0
                  ? `Nothing on ${person.first} yet · ${person.pattern}`
                  : `${hrs(total.hours)} this week${total.over ? ` · ${total.over} over` : ""}`
                : `${count} ${count === 1 ? "task needs" : "tasks need"} someone`}
            </span>
          </span>
          <Icon.chevronRight size={14} className={styles.personCardChevron} />
        </span>
        <span className={styles.strip7}>
          {days.map((d) => {
            const c = load.get(cellKey(pid, d))!;
            const kind = person ? dayKind(person, d) : "work";
            const lvl = !person ? (c.tasks.length ? "waiting" : "none") : c.avail === 0 && c.hours === 0 ? (kind === "away" ? "away" : "off") : c.level;
            const k = cellKey(pid, d);
            return (
              <span key={d} className={styles.tile} data-level={lvl} data-today={d === TODAY || undefined} style={{ "--i": days.indexOf(d) } as CSSProperties}>
                {flash?.keys.includes(k) && <span key={flash.at} className={styles.flash} aria-hidden="true" />}
                <span className={styles.tileWd}>{wd(d).slice(0, 1)}</span>
                <span className={styles.tileNum}>
                  {lvl === "over" && kind !== "away" ? <Icon.over size={8} className={styles.tileOver} /> : null}
                  {c.hours > 0 ? Math.round(c.hours * 10) / 10 : lvl === "away" ? "–" : lvl === "off" || lvl === "none" ? "" : "0"}
                </span>
              </span>
            );
          })}
        </span>
      </button>
    </li>
  );
}

function PersonDays({
  person,
  days,
  load,
  project,
  onMoveTask,
}: {
  person: Person | null;
  days: string[];
  load: LoadMap;
  project: Project;
  onMoveTask: (t: Task) => void;
}) {
  const pid = person?.id ?? null;
  return (
    <div className={styles.dayList}>
      {person && (
        <p className={styles.phonePattern}>
          <Avatar person={person} size={22} />
          {person.role} · {person.pattern}
        </p>
      )}
      {days.map((d) => {
        const c = load.get(cellKey(pid, d))!;
        const kind = person ? dayKind(person, d) : "work";
        if (person && c.avail === 0 && c.hours === 0 && kind !== "away") {
          return (
            <div key={d} className={styles.dayRowOff}>
              <span>{shortDate(d)}</span>
              <span>Not working</span>
            </div>
          );
        }
        if (!person && c.tasks.length === 0) return null;
        return (
          <section key={d} className={styles.dayBlock} data-level={kind === "away" ? "away" : c.level}>
            <header className={styles.dayBlockHead}>
              <span className={styles.dayBlockDate}>
                {shortDate(d)}
                {d === TODAY && <span className={styles.todayTag}>Today</span>}
                {project.milestones
                  .filter((m) => m.date === d)
                  .map((m) => (
                    <span key={m.label} className={styles.miniMilestone} data-kind={m.kind}>
                      {m.label}
                    </span>
                  ))}
              </span>
              {person && (
                <span className={styles.panelLevel} data-level={kind === "away" ? "away" : c.level}>
                  {c.level === "over" && kind !== "away" && <Icon.over size={11} />}
                  {kind === "away" ? `${person.first} is away` : c.hours === 0 ? `${hrs(c.avail)} free` : `${hrs(c.hours)} of ${hrs(c.avail)} · ${LEVEL_WORD[c.level]}`}
                </span>
              )}
            </header>
            {c.tasks.length === 0 ? (
              <p className={styles.dayEmpty}>Nothing planned.</p>
            ) : (
              <ul className={styles.dayTasks}>
                {c.tasks.map((t) => (
                  <li key={t.id} className={styles.dayTask}>
                    <span className={styles.taskTag} style={{ background: `var(--v3-project-${tagOf(t.tag)})` }} />
                    <span className={styles.taskMain}>
                      <span className={styles.taskTitle}>{t.title}</span>
                      <span className={styles.taskMeta}>
                        {tagLabel(t.tag)} · <Num value={t.hours} />
                        {t.fixed && (
                          <span className={styles.taskFixed}>
                            <Icon.pin size={11} />
                            Tied to this day
                          </span>
                        )}
                      </span>
                    </span>
                    <button type="button" className={styles.moveSmall} onClick={() => onMoveTask(t)}>
                      Move
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className={styles.panelFoot}>Showing {dayNum(days[0])}–{dayNum(days[6])} {shortDate(days[6]).split(" ")[2]}. Swipe for another week.</p>
    </div>
  );
}
