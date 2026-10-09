"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Project } from "./data";
import { TODAY } from "./data";
import { cellKey, mondayOf, spanLabel, type LoadMap } from "./model";
import { Icon } from "./icons";
import styles from "./c3.module.css";

export type Range = 2 | 4 | 6;

export function ProjectSwitcher({
  project,
  projects,
  onProject,
}: {
  project: Project;
  projects: Project[];
  onProject: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div className={styles.menuAnchor} ref={ref}>
      <button
        type="button"
        className={styles.projectPill}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.projectDot} style={{ background: `var(--v3-project-${project.tone})` }} />
        <span className={styles.projectName}>{project.name}</span>
        <span className={styles.projectKind}>{project.kind}</span>
        <Icon.chevronDown size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className={styles.menu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <p className={styles.menuLabel}>Switch project</p>
            {projects.map((p) => (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={p.id === project.id}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onProject(p.id);
                  setOpen(false);
                }}
              >
                <span className={styles.projectDot} style={{ background: `var(--v3-project-${p.tone})` }} />
                <span className={styles.menuItemMain}>
                  <span>{p.name}</span>
                  <span className={styles.menuItemSub}>
                    {p.people.map((x) => x.first).join(", ")}
                  </span>
                </span>
                {p.id === project.id && <Icon.check size={14} className={styles.menuCheck} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header({
  project,
  projects,
  onProject,
  range,
  onRange,
  start,
  days,
  onStep,
  onToday,
  load,
  focusName,
  onClearFocus,
}: {
  project: Project;
  projects: Project[];
  onProject: (id: string) => void;
  range: Range;
  onRange: (r: Range) => void;
  start: string;
  days: string[];
  onStep: (d: -1 | 1) => void;
  onToday: () => void;
  load: LoadMap;
  focusName: string | null;
  onClearFocus: () => void;
}) {
  let over = 0;
  for (const p of project.people) for (const d of days) if (load.get(cellKey(p.id, d))?.level === "over") over++;
  const unassigned = days.reduce((s, d) => s + (load.get(cellKey(null, d))?.tasks.length ?? 0), 0);
  const members = project.people.filter((p) => !p.guest).length;
  const guests = project.people.length - members;
  const onToday_ = start === mondayOf(TODAY);

  return (
    <header className={styles.header}>
      <div className={styles.headTop}>
        <div className={styles.headMain}>
          <div className={styles.titleRow}>
            <h1 className={styles.h1}>Team load</h1>
            <ProjectSwitcher project={project} projects={projects} onProject={onProject} />
          </div>
          <p className={styles.sub}>
            {members} {members === 1 ? "person" : "people"}
            {guests ? ` and ${guests === 1 ? "a guest" : `${guests} guests`}` : ""}
            <span className={styles.subDot} aria-hidden="true">·</span>
            {over === 0 ? (
              <span className={styles.subCalm}>No one is over in these weeks</span>
            ) : (
              <span className={styles.subOver}>
                {over} {over === 1 ? "day" : "days"} over
              </span>
            )}
            {unassigned > 0 && (
              <>
                <span className={styles.subDot} aria-hidden="true">·</span>
                <span>
                  {unassigned} {unassigned === 1 ? "task needs" : "tasks need"} someone
                </span>
              </>
            )}
          </p>
        </div>
        <div className={styles.headControls}>
          <AnimatePresence>
            {focusName && (
              <motion.button
                type="button"
                className={styles.focusChip}
                onClick={onClearFocus}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
              >
                Only {focusName}
                <span className={styles.focusChipX}>
                  Show everyone <kbd className={styles.kbd}>Esc</kbd>
                </span>
              </motion.button>
            )}
          </AnimatePresence>
          <div className={styles.segmented} role="radiogroup" aria-label="How many weeks to show">
            {([2, 4, 6] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={range === r}
                className={styles.segment}
                onClick={() => onRange(r)}
              >
                {range === r && <motion.span layoutId="c3-range" className={styles.segmentThumb} transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className={styles.segmentLabel}>{r} weeks</span>
              </button>
            ))}
          </div>
          <div className={styles.navGroup}>
            <button type="button" className={styles.iconBtn} onClick={() => onStep(-1)} aria-label={`Previous ${range} weeks`} title="Previous  [">
              <Icon.chevronLeft />
            </button>
            <button type="button" className={styles.todayBtn} onClick={onToday} aria-pressed={onToday_} title="Today  T">
              Today
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => onStep(1)} aria-label={`Next ${range} weeks`} title="Next  ]">
              <Icon.chevronRight />
            </button>
          </div>
          <p className={styles.rangeLabel} aria-live="polite">
            {spanLabel(days[0], days[days.length - 1])}
          </p>
        </div>
      </div>
    </header>
  );
}
