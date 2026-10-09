"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type DragEvent } from "react";
import clsx from "clsx";
import type { BacklogTask, Person, Project, Stage } from "./data";
import { dur } from "./model";
import { IconChevronUp, IconPlus, IconSearch, IconX } from "./icons";
import { Avatar, ProjectDot } from "./parts";
import s from "./desk.module.css";

const STAGES: { id: Stage; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "review", label: "Review" },
  { id: "waiting", label: "Waiting" },
];

export function BacklogDrawer({
  open,
  backlog,
  team,
  projects,
  viewer,
  justAdded,
  onToggle,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  open: boolean;
  backlog: BacklogTask[];
  team: Person[];
  projects: Project[];
  viewer: Person;
  justAdded: string | null;
  onToggle: () => void;
  onAdd: (id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragEnd: () => void;
}) {
  const reduce = useReducedMotion();
  const [who, setWho] = useState<string>("all");
  const [query, setQuery] = useState("");
  const pj = (id: string) => projects.find((p) => p.id === id);
  const person = (id: string) => team.find((p) => p.id === id);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return backlog.filter((t) => (who === "all" || t.owner === who) && (!q || t.title.toLowerCase().includes(q)));
  }, [backlog, who, query]);

  const lateCount = backlog.filter((t) => t.late).length;

  return (
    <div className={clsx(s.drawer, open && s.drawerOpen)}>
      <button type="button" className={s.drawerBar} onClick={onToggle} aria-expanded={open} aria-controls="c3-drawer">
        <span className={s.drawerLabel}>
          <IconChevronUp width={16} height={16} className={clsx(s.chev, open && s.chevDown)} />
          Everything else
          <span className={s.drawerCount}>{backlog.length}</span>
        </span>
        <span className={s.drawerHint}>
          {open ? "Close" : lateCount ? `${lateCount} late across the team · E to open` : "The full board, when you need it · E to open"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="c3-drawer"
            className={s.drawerPanel}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { height: "min(46vh, 400px)", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0.6 }}
            transition={{ duration: reduce ? 0.12 : 0.38, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className={s.drawerTools}>
              <div className={s.chips} role="group" aria-label="Whose tasks">
                <button type="button" className={clsx(s.chip, who === "all" && s.chipOn)} aria-pressed={who === "all"} onClick={() => setWho("all")}>
                  Everyone
                </button>
                {team.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={clsx(s.chip, who === p.id && s.chipOn)}
                    aria-pressed={who === p.id}
                    onClick={() => setWho(p.id)}
                  >
                    {p.initials ? <Avatar person={p} size={18} /> : <span className={s.noOwner} aria-hidden />}
                    {p.id === viewer.id ? "Mine" : p.id === "none" ? "No owner" : p.first}
                    <span className={s.chipCount}>{backlog.filter((t) => t.owner === p.id).length}</span>
                  </button>
                ))}
              </div>
              <label className={s.search}>
                <IconSearch width={14} height={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a task" aria-label="Find a task" />
                {query && (
                  <button type="button" className={s.searchClear} onClick={() => setQuery("")} aria-label="Clear">
                    <IconX width={12} height={12} />
                  </button>
                )}
              </label>
            </div>
            <p className={s.drawerNote}>Drag a task onto Up next, or press the plus to add it to the end of today.</p>
            <div className={s.mini}>
              {STAGES.map((stage) => {
                const col = shown.filter((t) => t.stage === stage.id);
                return (
                  <section key={stage.id} className={s.miniCol} aria-label={stage.label}>
                    <h3 className={s.miniHead}>
                      <span className={s.stageDot} data-stage={stage.id} aria-hidden />
                      {stage.label}
                      <span className={s.miniCount}>{col.length}</span>
                    </h3>
                    <ul className={s.miniList}>
                      {col.map((t) => {
                        const owner = person(t.owner);
                        return (
                          <li
                            key={t.id}
                            className={clsx(s.miniCard, justAdded === t.id && s.miniAdded)}
                            draggable
                            onDragStart={(e) => onDragStart(e, t.id)}
                            onDragEnd={onDragEnd}
                          >
                            <span className={s.miniTitle}>{t.title}</span>
                            <span className={s.miniMeta}>
                              <ProjectDot project={pj(t.project)} />
                              <span className={clsx(t.late && s.lateText)}>{t.due ?? dur(t.est)}</span>
                              {owner?.initials ? <Avatar person={owner} size={18} /> : <span className={s.noOwner} title="No owner yet" />}
                            </span>
                            <button type="button" className={s.miniAdd} onClick={() => onAdd(t.id)} aria-label={`Add ${t.title} to Up next`} title="Add to Up next">
                              <IconPlus width={14} height={14} />
                            </button>
                          </li>
                        );
                      })}
                      {col.length === 0 && <li className={s.miniEmpty}>Nothing here</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
