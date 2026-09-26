"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "./icons";
import { AvatarStack, IdTile, StatusPill } from "./parts";
import { HubBody } from "./hub";
import {
  HEALTH_COLOR,
  KIND_LABEL,
  countLine,
  crunches,
  dated,
  fmtShort,
  fmtUntil,
  fullLabel,
  monthName,
  parts,
  type Project,
} from "./data";
import s from "./list.module.css";

export function ListView({ projects, onMap, phone }: { projects: Project[]; onMap: () => void; phone?: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const crunch = crunches(projects);
  const crunchIds = new Set(crunch.flatMap((c) => c.projects));
  const list = dated(projects);
  const groups: { key: string; label: string; items: Project[] }[] = [];
  const past = list.filter((p) => p.unwrapped);
  if (past.length) groups.push({ key: "past", label: "Past, not wrapped", items: past });
  for (const p of list.filter((x) => !x.unwrapped)) {
    const pt = parts(p.day ?? 0);
    const key = `${pt.y}-${pt.m}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: `${monthName(pt.m)}${pt.y !== 2026 ? ` ${pt.y}` : ""}`, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  const undated = projects.filter((p) => p.day === undefined);
  if (undated.length) groups.push({ key: "none", label: "No date", items: undated });

  return (
    <div className={s.page} data-phone={phone ? "" : undefined}>
      <div className={s.inner}>
        <header className={s.header}>
          <div>
            <h1 className={s.h1}>Projects</h1>
            <p className={s.sub}>
              {countLine(projects)}, in date order.{" "}
              {crunch.length ? `${crunch.length} crunch ${crunch.length === 1 ? "week" : "weeks"} marked.` : ""}
            </p>
          </div>
          <button type="button" className={s.mapBtn} onClick={onMap}>
            <Icon name="map" size={14} />
            {phone ? "Back to the river" : "Back to the map"}
          </button>
        </header>
        {projects.length === 0 ? (
          <p className={s.empty}>No projects yet. Go back to the map and double-click a date to add one.</p>
        ) : null}
        {groups.map((g) => (
          <section key={g.key} className={s.group} aria-labelledby={`c4-g-${g.key}`}>
            <h2 id={`c4-g-${g.key}`} className={s.groupTitle}>
              {g.label}
              <span className={s.count}>{g.items.length}</span>
            </h2>
            <ul className={s.rows}>
              {g.items.map((p) => (
                <li key={p.id} className={s.item} data-open={open === p.id ? "" : undefined}>
                  <button
                    type="button"
                    className={s.row}
                    aria-expanded={open === p.id}
                    aria-label={fullLabel(p)}
                    onClick={() => setOpen(open === p.id ? null : p.id)}
                  >
                    <IdTile p={p} size={28} />
                    <span className={s.name}>
                      <span className={s.nameText}>{p.name}</span>
                      <span className={s.kind}>
                        {KIND_LABEL[p.kind]}
                        {crunchIds.has(p.id) ? (
                          <span className={s.crunchTag} title="Someone on this project finishes 3 or more projects in the same fortnight">
                            In a crunch
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className={s.date}>
                      {p.day === undefined ? "No date" : p.endDay !== undefined ? `${fmtShort(p.day)} to ${fmtShort(p.endDay)}` : fmtShort(p.day)}
                      <span className={s.until}>{p.day === undefined ? "" : p.unwrapped ? `${-p.day} days over` : fmtUntil(p.day)}</span>
                    </span>
                    <span className={s.status}>
                      <StatusPill p={p} />
                    </span>
                    <span className={s.progress}>
                      <span className={s.bar} aria-hidden="true">
                        <span style={{ width: `${p.progress}%`, background: HEALTH_COLOR[p.health] }} />
                      </span>
                      <span className={s.pct}>{p.progress}%</span>
                    </span>
                    <span className={s.people}>
                      <AvatarStack ids={p.team} size={22} />
                    </span>
                    <Icon name="chevron-right" size={14} className={s.chev} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open === p.id ? (
                      <motion.div
                        className={s.expand}
                        initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <div className={s.expandInner}>
                          <p className={s.signal}>{p.signal}</p>
                          <HubBody p={p} all={projects} compact={phone} />
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
