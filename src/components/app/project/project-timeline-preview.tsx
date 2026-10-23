"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { ConsoleRow } from "@/lib/projects/project-console";
import styles from "./project-timeline-preview.module.css";

function previewPosition(rect: DOMRect) {
  return { top: Math.min(rect.bottom + 6, Math.max(8, window.innerHeight - 360)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)) };
}

/** The same authorized milestone tasks as the Project timeline. No hover reads. */
export function ProjectTimelinePreview({ row, href, onGo }: { row: ConsoleRow; href: string; onGo: () => void }) {
  const id = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { cancel(); setPosition(null); };
  const open = () => {
    cancel();
    const rect = anchor.current?.getBoundingClientRect();
    if (rect) setPosition(previewPosition(rect));
  };
  const leave = () => { cancel(); timer.current = setTimeout(() => setPosition(null), 120); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.stopPropagation(); setPosition(null); } };
    const hide = () => setPosition(null);
    const reposition = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) setPosition(null);
      else setPosition(previewPosition(rect));
    };
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", reposition, true);
    return () => { document.removeEventListener("keydown", escape, true); window.removeEventListener("resize", hide); window.removeEventListener("scroll", reposition, true); };
  }, [position]);
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); close(); onGo();
  };
  return <span className={styles.wrap} onMouseEnter={open} onMouseLeave={leave}>
    <a ref={anchor} className={styles.link} href={href} onClick={go} onFocus={open} onBlur={leave} aria-describedby={position ? id : undefined}>See timeline</a>
    {position ? createPortal(<aside id={id} role="tooltip" className={styles.preview} style={position} onMouseEnter={cancel} onMouseLeave={leave}>
      <strong>{row.name}</strong>
      <p className={styles.caption}>Project milestones</p>
      {row.timeline === undefined ? <p className={styles.empty}>Milestones couldn’t be loaded. Open the timeline to try again.</p> : row.timeline.length === 0 ? <p className={styles.empty}>{row.timelineTruncated ? "This preview reached its limit. Open the timeline to see this project’s milestones." : "No dated milestones yet. Add a big date in this project’s tasks."}</p> : <ol className={styles.milestones}>
        {row.timeline.map(milestone => <li key={milestone.id} data-done={milestone.done || undefined}><time dateTime={milestone.date}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${milestone.date}T12:00:00Z`))}</time><span>{milestone.title}</span><small>{milestone.done ? "Done" : "Open"}</small></li>)}
      </ol>}
      {row.timelineTruncated ? <p className={styles.caption}>Preview limited. Open the timeline for more.</p> : null}
    </aside>, document.body) : null}
  </span>;
}
