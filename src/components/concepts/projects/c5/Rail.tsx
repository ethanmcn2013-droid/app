"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STATUS, countdown, fmtShort, initials, person, type Project } from "./data";
import { factsOf, oneLiner } from "./summary";
import { groupProjects } from "./groups";
import { Glyph, Pie, hueStyle } from "./bits";
import { anchorOf, type Anchor } from "./Floating";
import { ChevronDown, Grid, PanelLeft, Plus, Search } from "./icons";
import s from "./shell.module.css";

type Active = string; // a project id, "all" or "new"

type RailProps = {
  projects: Project[];
  active: Active;
  onOpen: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  /** Draw the 56px strip of glyphs instead of the list. */
  mini: boolean;
  onToggle: () => void;
  finding: boolean;
  onFinding: (on: boolean) => void;
};

const COLLAPSE_TIP = "Collapse the list  [  ·  J and K move between projects";

export function Rail(props: RailProps) {
  const { projects, active, onOpen, onAll, onNew, mini, onToggle, finding, onFinding } = props;
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<{ id: string; anchor: Anchor } | null>(null);
  const timer = useRef<number | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const running = projects.filter((p) => !p.wrapped);
  const hovered = hover ? projects.find((p) => p.id === hover.id) : undefined;

  // Hover-card timing: wait before the first card, so moving down the list
  // never flashes cards over the page; once one is open, the next row hands
  // off at once; leaving gets a short grace.
  const enter = (id: string, el: Element) => {
    if (timer.current) window.clearTimeout(timer.current);
    const anchor = anchorOf(el);
    const edge = navRef.current?.getBoundingClientRect().right ?? anchor.right;
    const next = { id, anchor: { ...anchor, right: edge } };
    if (hover) setHover(next);
    else timer.current = window.setTimeout(() => setHover(next), mini ? 300 : 450);
  };
  const leave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(null), 150);
  };
  const open = (id: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setHover(null);
    onOpen(id);
  };
  const stopFinding = () => {
    setQuery("");
    onFinding(false);
  };

  if (mini) {
    return (
      <nav className={s.railMini} aria-label="Projects" ref={navRef}>
        <button type="button" className={s.iconBtn} onClick={onToggle} aria-label="Expand the project list" title="Expand the list  [">
          <PanelLeft />
        </button>
        <button
          type="button"
          className={s.miniBtn}
          aria-current={active === "all" ? "page" : undefined}
          onClick={onAll}
          aria-label="All projects"
          title="All projects"
        >
          <Grid />
        </button>
        <button type="button" className={s.miniBtn} aria-current={active === "new" ? "page" : undefined} onClick={onNew} aria-label="New project" title="New project  N">
          <Plus />
        </button>
        <span className={s.miniRule} aria-hidden="true" />
        <div className={s.miniList}>
          {running.map((p) => {
            const flag = troubleOf(p);
            return (
              <button
                key={p.id}
                type="button"
                className={s.miniSwatch}
                aria-current={active === p.id ? "page" : undefined}
                aria-label={flag ? `${p.name}, ${flag.phrase}` : p.name}
                style={hueStyle(p)}
                onClick={() => open(p.id)}
                onMouseEnter={(e) => enter(p.id, e.currentTarget)}
                onMouseLeave={leave}
                onFocus={(e) => enter(p.id, e.currentTarget)}
                onBlur={leave}
              >
                <span className={s.miniTile} aria-hidden="true">
                  {initials(p.name)}
                </span>
                {flag ? <span className={s.miniFlag} data-tone={flag.tone} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        {hovered && hover ? <PreviewCard p={hovered} anchor={hover.anchor} /> : null}
      </nav>
    );
  }

  return (
    <nav className={s.rail} aria-label="Projects" ref={navRef}>
      <div className={s.railNav}>
        <div className={s.railHeadRow}>
          <button type="button" className={s.navRow} aria-current={active === "all" ? "page" : undefined} onClick={onAll}>
            <Grid />
            <span className={s.rowName}>All projects</span>
            <span className={s.count}>{running.length}</span>
          </button>
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => (finding ? stopFinding() : onFinding(true))}
            aria-label="Find a project"
            aria-pressed={finding}
            title="Find a project  /"
          >
            <Search size={15} />
          </button>
          <button type="button" className={s.iconBtn} onClick={onToggle} aria-label="Collapse the project list" title={COLLAPSE_TIP}>
            <PanelLeft />
          </button>
        </div>
        <button type="button" className={s.navRow} aria-current={active === "new" ? "page" : undefined} onClick={onNew}>
          <Plus />
          <span className={s.rowName}>New project</span>
          <kbd className={s.kbd}>N</kbd>
        </button>
      </div>

      {finding ? (
        <label className={s.search}>
          <Search size={15} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => {
              if (!query) onFinding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                stopFinding();
              }
              if (e.key === "Enter") {
                const first = findProjects(projects, query)[0];
                if (first) {
                  open(first.id);
                  stopFinding();
                }
              }
            }}
            placeholder="Find a project"
            aria-label="Find a project"
          />
          <kbd className={s.kbd}>esc</kbd>
        </label>
      ) : null}

      <div className={s.railScroll}>
        <ProjectList
          projects={projects}
          active={active}
          query={query}
          onOpen={(id) => {
            open(id);
            stopFinding();
          }}
          onEnter={enter}
          onLeave={leave}
        />
        {running.length === 1 && !query ? (
          <p className={s.soloHint}>Your projects line up here by date, soonest first. Press N to start another.</p>
        ) : null}
      </div>

      {hovered && hover ? <PreviewCard p={hovered} anchor={hover.anchor} /> : null}
    </nav>
  );
}

/**
 * Names first: a word in the name that starts with what you typed, then the
 * name containing it anywhere. The kind and the place count only from the
 * start of a word, so "har" finds Harvest supper club rather than every
 * project at The Orchard.
 */
function findProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  const startsWord = (text: string) => text.toLowerCase().split(/[\s&’'-]+/).some((w) => w.startsWith(q)) || text.toLowerCase().startsWith(q);
  const score = (p: Project) => {
    if (startsWord(p.name)) return 3;
    if (p.name.toLowerCase().includes(q)) return 2;
    if (startsWord(p.kind) || startsWord(p.place ?? "")) return 1;
    return 0;
  };
  return projects
    .map((p, i) => ({ p, i, n: score(p) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.p);
}

export function ProjectList({
  projects,
  active,
  query,
  onOpen,
  onEnter,
  onLeave,
  big,
}: {
  projects: Project[];
  active: Active;
  query: string;
  onOpen: (id: string) => void;
  onEnter?: (id: string, el: Element) => void;
  onLeave?: () => void;
  big?: boolean;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({ wrapped: true });
  const q = query.trim().toLowerCase();

  if (q) {
    const hits = findProjects(projects, q);
    if (hits.length === 0) return <p className={s.noHits}>No project matches “{query}”.</p>;
    return (
      <ul className={s.list} data-big={big ? "" : undefined}>
        {hits.map((p) => (
          <Row key={p.id} p={p} active={active === p.id} onOpen={onOpen} onEnter={onEnter} onLeave={onLeave} />
        ))}
      </ul>
    );
  }

  return (
    <>
      {groupProjects(projects).map((g) =>
        g.projects.length === 0 ? null : (
          <div key={g.id} className={s.group}>
            <button
              type="button"
              className={s.groupHead}
              aria-expanded={!closed[g.id]}
              onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))}
            >
              <span>{g.label}</span>
              <span className={s.groupCount}>{g.projects.length}</span>
              <ChevronDown size={13} className={s.groupChevron} />
            </button>
            {closed[g.id] ? null : (
              <ul className={s.list} data-big={big ? "" : undefined}>
                {g.projects.map((p) => (
                  <Row key={p.id} p={p} active={active === p.id} onOpen={onOpen} onEnter={onEnter} onLeave={onLeave} />
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </>
  );
}

function Row({
  p,
  active,
  onOpen,
  onEnter,
  onLeave,
}: {
  p: Project;
  active: boolean;
  onOpen: (id: string) => void;
  onEnter?: (id: string, el: Element) => void;
  onLeave?: () => void;
}) {
  const flag = troubleOf(p);
  const when = p.wrapped ? fmtShort(p.wrapped.on) : p.date ? countdown(p.date) : flag ? flag.label : "";
  return (
    <li>
      <button
        type="button"
        className={s.row}
        data-wrapped={p.wrapped ? "" : undefined}
        aria-current={active ? "page" : undefined}
        aria-label={flag ? `${p.name}, ${flag.phrase}${p.date ? `, ${countdown(p.date)}` : ""}` : undefined}
        style={hueStyle(p)}
        onClick={() => onOpen(p.id)}
        onMouseEnter={onEnter ? (e) => onEnter(p.id, e.currentTarget) : undefined}
        onMouseLeave={onLeave}
        onFocus={onEnter ? (e) => onEnter(p.id, e.currentTarget) : undefined}
        onBlur={onLeave}
      >
        <span className={s.swatch} aria-hidden="true" />
        <span className={s.rowName}>{p.name}</span>
        <span className={s.rowDate} data-tone={flag?.tone} title={flag ? flag.label : undefined}>
          {when}
        </span>
      </button>
    </li>
  );
}

/** At risk and blocked projects, the only ones the rail marks. */
function troubleOf(p: Project) {
  return !p.wrapped && (p.status === "at-risk" || p.status === "blocked") ? STATUS[p.status] : null;
}

function PreviewCard({ p, anchor }: { p: Project; anchor: Anchor }) {
  const f = factsOf(p);
  const vh = window.innerHeight;
  const mid = (anchor.top + anchor.bottom) / 2;
  const top = Math.max(12, Math.min(mid - 34, vh - 200));
  return createPortal(
    <div className={s.preview} style={{ ...hueStyle(p), left: anchor.right + 8, top }} role="tooltip">
      <span className={s.previewArrow} style={{ top: Math.max(14, mid - top) }} aria-hidden="true" />
      <div className={s.previewBody}>
        <div className={s.previewHead}>
          <Glyph p={p} size={28} />
          <div className={s.previewName}>{p.name}</div>
        </div>
        <p className={s.previewLine}>{oneLiner(p)}</p>
        <div className={s.previewMeta}>
          {p.wrapped ? (
            <span>{p.wrapped.tasks} tasks</span>
          ) : (
            <>
              <Pie value={f.progress} />
              <span>
                {f.done} of {f.total}
              </span>
            </>
          )}
          <span className={s.dotSep} aria-hidden="true" />
          <span>{person(p.owner).name}</span>
          {p.place ? (
            <>
              <span className={s.dotSep} aria-hidden="true" />
              <span className={s.previewPlace}>{p.place.replace("The Orchard, ", "")}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
