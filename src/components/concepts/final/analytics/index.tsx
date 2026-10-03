"use client";

/**
 * Analytics: one page, three lenses on the same history. Ask answers a
 * question in a sentence and one chart; All projects puts every project side
 * by side on one scale; Replay plays one project back day by day. The scope
 * picker, the numbers and the dates are shared, so a project reads the same
 * wherever you meet it, and each lens hands you to the others.
 */

import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { HealthMark, HealthPill } from "../../demo/health";
import { useDemoLinks, useInDemo, useSurfaceHref } from "../../demo/links";
import { countsFor, fmtDay as fmtIso, fmtRelative, forecast, projectIn, workspaceCounts } from "../../demo/store";
import { PageHeader } from "../../tasks/header";
import t from "../../tasks/tasks.module.css";
import { AskLens } from "./ask";
import { ReplayLens } from "./replay";
import { useWorld, type World } from "./live";
import { LENSES, setScope, update, useAnalytics, type Lens } from "./store";
import { WallLens } from "./wall";
import { STATUS_WORD, fmtDayLong, plural, tileColor, type Status } from "./wall-model";
import s from "./analytics.module.css";

const lensOf = (sub?: string): Lens => (sub === "all-projects" || sub === "replay" ? sub : "ask");

/** Replay's project when the scope is All projects: the next big date with some history to show. */
function defaultReplay(w: World) {
  const byDate = [...w.derived].sort((a, b) => a.p.bigDate - b.p.bigDate);
  return (byDate.find((d) => d.p.bigDate >= 0 && d.p.total >= 10) ?? byDate[0])?.p.id ?? w.replays[0]?.id ?? "all";
}

/** A link from Ctrl K or Files (`?q=…&project=…`) is read once, then left alone. */
let handledSearch: string | null = null;

export default function FinalAnalytics({ sub }: { sub?: string }) {
  const [lens, setLens] = useState<Lens>(lensOf(sub));
  const { scope: chosen } = useAnalytics();
  const world = useWorld();
  const pageRef = useRef<HTMLDivElement>(null);
  // A project that is no longer in the store (an undo, a reset) falls back to All projects.
  const scope = chosen === "all" || world.replayById(chosen) ? chosen : "all";

  // Follow the URL when it changes lens (back and forward included).
  const [seenSub, setSeenSub] = useState(sub);
  if (sub !== seenSub) {
    setSeenSub(sub);
    setLens(lensOf(sub));
  }
  // Lenses hand off to each other through the same event, so the page can
  // switch at once even before the URL catches up.
  useEffect(() => {
    const on = (e: Event) => {
      setLens((e as CustomEvent<Lens>).detail);
      pageRef.current?.scrollTo({ top: 0 });
    };
    window.addEventListener("analytics:lens", on);
    return () => window.removeEventListener("analytics:lens", on);
  }, []);

  // Questions handed over in the address: the project sets the scope, the question is asked.
  useEffect(() => {
    const search = window.location.search;
    if (!search || search === handledSearch) return;
    handledSearch = search;
    const params = new URLSearchParams(search);
    const project = params.get("project");
    const q = params.get("q")?.trim();
    const scopeFor = project && world.replayById(project) ? project : null;
    if (scopeFor) setScope(scopeFor);
    if (q) update((st) => ({ pendingTyped: { typed: q, scope: scopeFor ?? st.scope } }));
    // Only on arrival: a later change in the store must not read the address again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replay always shows one project: the one in scope, or the next big date.
  const shown = lens === "replay" && scope === "all" ? defaultReplay(world) : scope;

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.page} ref={pageRef}>
        <div className={s.header}>
          <PageHeader title="Analytics" project={<ScopePicker value={shown} allowAll={lens !== "replay"} onPick={setScope} />} summary={<Summary scope={shown} />} />
          <div className={s.lensRow}>
            <LensSwitch lens={lens} onLens={setLens} />
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lens}
            className={s.body}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {lens === "ask" ? <AskLens /> : lens === "all-projects" ? <WallLens /> : <ReplayLens projectId={shown} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/* ── The three lenses: one switch, like the Tasks views ─────────────────── */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function LensIcon({ lens }: { lens: Lens }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      {lens === "ask" ? (
        <>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.4 10.4 13.5 13.5" />
        </>
      ) : lens === "all-projects" ? (
        <>
          <rect x="2" y="2.5" width="5" height="4.5" rx="1" />
          <rect x="9" y="2.5" width="5" height="4.5" rx="1" />
          <rect x="2" y="9" width="5" height="4.5" rx="1" />
          <rect x="9" y="9" width="5" height="4.5" rx="1" />
        </>
      ) : (
        <>
          <path d="M2.5 13.5h11" />
          <path d="M5 4.2v6.6l5.5-3.3z" />
        </>
      )}
    </svg>
  );
}

function LensSwitch({ lens, onLens }: { lens: Lens; onLens: (l: Lens) => void }) {
  const href = useSurfaceHref();
  const inDemo = useInDemo();
  return (
    <nav className={s.switch} aria-label="Analytics view">
      {LENSES.map((l) => (
        <Link
          key={l.key}
          href={l.sub ? href("analytics", l.sub) : href("analytics")}
          className={s.view}
          aria-current={l.key === lens ? "page" : undefined}
          prefetch={false}
          scroll={false}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            if (!inDemo) e.preventDefault();
            onLens(l.key);
          }}
        >
          <LensIcon lens={l.key} />
          {l.name}
        </Link>
      ))}
    </nav>
  );
}

/* ── The project in scope, shared by every lens ─────────────────────────── */

type Option = { id: string; name: string; note: string; tone: string | null; status?: Status; wrapped?: boolean };

function optionsOf(w: World): Option[] {
  return [
    { id: "all", name: "All projects", note: `${w.derived.length} active projects`, tone: null },
    ...[...w.derived]
      .sort((a, b) => a.p.bigDate - b.p.bigDate)
      .map((d) => ({ id: d.p.id, name: d.p.name, note: `${d.p.dateLabel} ${fmtDayLong(d.p.bigDate)}`, tone: tileColor(d.p.hue), status: d.status })),
    ...w.finished.map((p) => ({ id: p.id, name: p.name, note: `Wrapped ${fmtDayLong(p.doneOn ?? 0)}`, tone: tileColor(p.hue), wrapped: true })),
  ];
}

function Dot({ tone }: { tone: string }) {
  return <span className={s.dot} style={{ "--dot": tone } as CSSProperties} aria-hidden="true" />;
}

function AllDots() {
  const { derived } = useWorld();
  return (
    <span className={s.allDots} aria-hidden="true">
      {derived.slice(0, 3).map((d) => (
        <Dot key={d.p.id} tone={tileColor(d.p.hue)} />
      ))}
    </span>
  );
}

/** What the pill says after the name: the count, or the big date. */
function kindOf(w: World, id: string) {
  if (id === "all") return `${w.derived.length} active`;
  const d = w.derived.find((x) => x.p.id === id);
  if (d) return `${d.p.dateLabel} ${fmtDayLong(d.p.bigDate)}`;
  return "Wrapped";
}

function ScopePicker({ value, allowAll, onPick }: { value: string; allowAll: boolean; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const world = useWorld();
  const every = useMemo(() => optionsOf(world), [world]);
  const options = useMemo(() => every.filter((o) => allowAll || o.id !== "all"), [every, allowAll]);
  const current = every.find((o) => o.id === value) ?? every[0];

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    // Focus the chosen item when the menu opens.
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
      if (e.key === "Escape") button.current?.focus();
    }
  };

  const active = options.filter((o) => o.id !== "all" && !o.wrapped);
  const finished = options.filter((o) => o.wrapped);
  const all = options.find((o) => o.id === "all");

  const item = (o: Option) => (
    <button
      key={o.id}
      type="button"
      role="menuitemradio"
      aria-checked={o.id === value}
      className={s.item}
      onClick={() => {
        onPick(o.id);
        setOpen(false);
        button.current?.focus();
      }}
    >
      {o.tone ? <Dot tone={o.tone} /> : <AllDots />}
      <span className={s.itemText}>
        <span className={s.itemName}>{o.name}</span>
        <span className={s.itemNote}>{o.note}</span>
      </span>
      {o.status ? <HealthMark health={o.status} label={STATUS_WORD[o.status]} /> : null}
      <svg className={s.check} width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
        <path d="M3 7.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div className={s.scope} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`${t.projectPill} ${s.scopeButton}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {current.tone ? <span className={t.projectDot} style={{ "--dot": current.tone } as CSSProperties} aria-hidden="true" /> : <AllDots />}
        <span className={`${t.projectName} ${s.scopeName}`}>{current.name}</span>
        <span className={`${t.projectKind} ${s.scopeKind}`}>{kindOf(world, current.id)}</span>
        <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Show analytics for"
            className={s.menu}
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {all ? item(all) : <p className={s.menuNote}>Replay shows one project at a time.</p>}
            <div className={s.menuHead}>Projects</div>
            {active.map(item)}
            {finished.length ? <div className={s.menuHead}>Finished</div> : null}
            {finished.map(item)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ── One line under the title: what the scope looks like right now ──────── */

/** Read from the store's selectors, so every number matches Projects, Tasks and the lenses below. */
function Summary({ scope }: { scope: string }) {
  const to = useDemoLinks();
  const world = useWorld();
  const state = world.state;
  if (scope === "all") {
    const w = workspaceCounts(state);
    return (
      <p className={s.summary}>
        <span>
          <strong className={s.strong}>{w.activeProjects}</strong> active projects
        </span>
        {w.offTrack ? (
          <span className={s.stat}>
            <HealthMark health="off_track" size={13} /> {w.offTrack} off track
          </span>
        ) : null}
        {w.atRisk ? (
          <span className={s.stat}>
            <HealthMark health="at_risk" size={13} /> {w.atRisk} at risk
          </span>
        ) : null}
        <span className={s.sep} aria-hidden="true">·</span>
        <span>
          <strong className={s.strong}>{w.open}</strong> open
        </span>
        <span className={s.sep} aria-hidden="true">·</span>
        <span className={w.late ? s.lateText : undefined}>{w.late} late</span>
        <span className={s.sep} aria-hidden="true">·</span>
        <span>{w.doneThisWeek} done this week</span>
      </p>
    );
  }
  const f = world.finished.find((x) => x.id === scope);
  if (f)
    return (
      <p className={s.summary}>
        <span>Wrapped {fmtDayLong(f.doneOn ?? 0)}</span>
        <span className={s.sep} aria-hidden="true">·</span>
        <span>{plural(f.total, "task")}, all done</span>
        <span className={s.sep} aria-hidden="true">·</span>
        <span>
          {f.dateLabel} was {fmtDayLong(f.bigDate)}
        </span>
      </p>
    );
  const d = world.derived.find((x) => x.p.id === scope);
  const p = projectIn(state, scope);
  if (!d || !p) return null;
  const c = countsFor(state, p.id);
  const fc = forecast(state, p.id);
  const spare =
    fc.verdict === "too_early" || fc.spare === null
      ? null
      : fc.spare > 0
        ? `${plural(fc.spare, "day")} to spare`
        : fc.spare === 0
          ? "done on the day"
          : `${plural(-fc.spare, "day")} past the date`;
  return (
    <p className={s.summary}>
      <HealthPill health={d.status} />
      <span>
        {d.p.dateLabel} {fmtIso(p.date)}, {fmtRelative(p.date)}
      </span>
      <span className={s.sep} aria-hidden="true">·</span>
      <span>
        <strong className={s.strong}>{c.open}</strong> open
      </span>
      <span className={s.sep} aria-hidden="true">·</span>
      <span className={c.late ? s.lateText : undefined}>{c.late} late</span>
      {spare ? (
        <>
          <span className={s.sep} aria-hidden="true">·</span>
          <span>{spare}</span>
        </>
      ) : null}
      <span className={s.sep} aria-hidden="true">·</span>
      <span>{d.p.lead} leads</span>
      <span className={s.sep} aria-hidden="true">·</span>
      <Link className={s.homeLink} href={to.project(p.id)} prefetch={false}>
        Project home
      </Link>
    </p>
  );
}
