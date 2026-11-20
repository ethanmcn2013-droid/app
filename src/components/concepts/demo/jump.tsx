"use client";

/**
 * One search for the whole product (Ctrl/⌘ K): places, projects, tasks,
 * people and files, and any question handed to the surface that can answer
 * it. Files answers what is written down; Analytics answers how the work is
 * going.
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchDemo, type DemoHit } from "./search";
import { surfaceHref, type Surface } from "./links";
import { Icon, NAV_ALL, TITLES } from "./nav";
import styles from "./demo.module.css";

type Row = { id: string; group: string; label: string; meta?: string; icon: ReactNode; href: string; hint?: string; here?: boolean };

const EXTRA: readonly { surface: Surface; sub: string; label: string }[] = [
  { surface: "projects", sub: "covers", label: "Projects covers" },
  { surface: "projects", sub: "ledger", label: "Projects list" },
  { surface: "analytics", sub: "all-projects", label: "Analytics, all projects" },
  { surface: "analytics", sub: "replay", label: "Analytics, replay" },
];

const askIcon = (
  <Icon>
    <path d="M2.75 3.5h10.5v7H8l-3 2.5v-2.5H2.75z" />
  </Icon>
);
const fileIcon = (
  <Icon>
    <path d="M3.5 1.75h5.5l3.5 3.5v9h-9z" />
    <path d="M9 1.75v3.5h3.5" />
  </Icon>
);
const chartIcon = (
  <Icon>
    <path d="M2.5 13.5h11" />
    <path d="M4.5 11V8M8 11V4.5M11.5 11V6.5" />
  </Icon>
);

/** Questions about progress go to Analytics; questions about what was written go to Files. */
const PROGRESS = /\b(on (course|track)|late|behind|ahead|slip|worst|busiest|too much|pace|how many|finished|done|progress|ready|stuck|risk)\b/i;
const QUESTION = /^(who|what|when|where|which|why|how|are|is|did|do|does|can|will)\b|\?$/i;

function askRows(q: string): Row[] {
  if (!q) return [];
  const progress = PROGRESS.test(q);
  const files: Row = { id: "ask-files", group: "Ask", label: `Ask your files: “${q}”`, meta: "Answers quoted from inside the file", icon: fileIcon, href: surfaceHref(true, "files", undefined, { q }) };
  const analytics: Row = { id: "ask-analytics", group: "Ask", label: `Ask about the work: “${q}”`, meta: "Answers from tasks, dates and history", icon: chartIcon, href: surfaceHref(true, "analytics", undefined, { q }) };
  return progress ? [analytics, files] : [files, analytics];
}

function hitRow(hit: DemoHit): Row {
  return { id: `${hit.kind}-${hit.id}`, group: hit.group, label: hit.label, meta: hit.meta, icon: hit.kind === "file" ? fileIcon : askIcon, href: hit.href };
}

export function JumpMenu({ onClose, current }: { onClose: () => void; current?: Surface }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  const rows = useMemo(() => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const places: Row[] = [
      ...NAV_ALL.map((item) => {
        const t = TITLES[item.surface];
        return {
          id: item.surface,
          group: "Go to",
          label: t.group ? `${t.group}, ${item.label.toLowerCase()}` : item.label,
          icon: item.icon,
          href: surfaceHref(true, item.surface),
          hint: `G ${item.key}`,
          here: item.surface === current,
        };
      }),
      ...EXTRA.map((entry) => ({
        id: `${entry.surface}-${entry.sub}`,
        group: "Go to",
        label: entry.label,
        icon: NAV_ALL.find((item) => item.surface === entry.surface)!.icon,
        href: surfaceHref(true, entry.surface, entry.sub),
      })),
    ].filter((row) => !lower || row.label.toLowerCase().includes(lower));
    const found = q ? searchDemo(q).map(hitRow) : [];
    const asks = askRows(q);
    // A question leads with the answer; a name leads with the thing it names.
    return QUESTION.test(q) ? [...asks, ...found, ...places] : [...found, ...places, ...asks];
  }, [query, current]);

  useEffect(() => {
    opener.current = document.activeElement;
    input.current?.focus();
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  const pick = (row: Row | undefined) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(rows.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(rows[active]);
    } else if (event.key === "Tab") {
      // One field and one list: keep focus in the menu.
      event.preventDefault();
    }
  };

  let lastGroup = "";
  return (
    <div className={styles.jumpLayer} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.jumpPanel} role="dialog" aria-modal="true" aria-label="Search or ask" onKeyDown={onKey}>
        <input
          ref={input}
          className={styles.jumpInput}
          placeholder="Search projects, tasks, people and files, or ask a question"
          aria-label="Search or ask"
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="demo-jump-list"
          aria-activedescendant={rows[active] ? `demo-jump-${rows[active].id.replace(/[^a-z0-9-]/gi, "-")}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
        />
        <ul className={styles.jumpList} id="demo-jump-list" role="listbox" aria-label="Results">
          {rows.length === 0 ? <li className={styles.jumpEmpty}>Nothing by that name</li> : null}
          {rows.map((row, index) => {
            const heading = row.group !== lastGroup ? row.group : null;
            lastGroup = row.group;
            return (
              <li key={row.id} role="presentation">
                {heading ? (
                  <div className={styles.jumpGroup} aria-hidden="true">
                    {heading}
                  </div>
                ) : null}
                <div
                  id={`demo-jump-${row.id.replace(/[^a-z0-9-]/gi, "-")}`}
                  role="option"
                  aria-selected={index === active}
                  className={styles.jumpItem}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(row);
                  }}
                >
                  {row.icon}
                  <span className={styles.jumpText}>
                    <span className={styles.itemLabel}>{row.label}</span>
                    {row.meta ? <span className={styles.jumpMeta}>{row.meta}</span> : null}
                  </span>
                  {row.here ? <span className={styles.jumpHere}>You are here</span> : row.hint ? <kbd className={styles.kbd}>{row.hint}</kbd> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
