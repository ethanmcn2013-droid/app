"use client";

/**
 * Projects: one surface, three views. Console (the default) lays every
 * project out as measured rows under four figures; Covers shows each project
 * as a living cover; List is a keyboard-first table. All three read the demo
 * store, share the page header and one view switcher (top right), and open
 * the same project home at /demo/projects/<id> without a page change. Back
 * returns to the view it came from.
 */

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEMO_BASE, useDemoLinks } from "../../demo/links";
import { PageHeader, PrimaryButton } from "../../tasks/header";
import tasksStyles from "../../tasks/tasks.module.css";
import { toastSentence, useUndoHint } from "../../tasks/toast";
import { Icon } from "./bits";
import type { Draft as CoverDraft } from "./create-card";
import type { Draft as RowDraft } from "./create";
import { CompareView } from "./compare";
import {
  addDays,
  daysFromToday,
  healthOf,
  isPastDue,
  needsAttention,
  PEOPLE,
  STATUS_LABEL,
  storeKind,
  type KindId,
  type PersonId,
  type Project,
  type StatusId,
} from "./data";
import { Console } from "./console";
import { Home } from "./home";
import { Ledger } from "./ledger";
import { DateEditor, OwnerMenu, Popover, rectOf, StatusEditor, type DatePreview, type Rect } from "./popovers";
import { Shelf } from "./shelf";
import { addProject, getDemoState, postUpdate, setMilestone, undo as undoStore, unwrapProject, updateProject, wrapProject } from "../../demo/store/client";
import { eachStep, markOpened, setSharedView, toggleTask as toggleStoreTask, useProjects } from "./live";
import { statusWhy, type EditKind } from "./table";
import { ViewSwitch, type Lens } from "./view-switch";
import css from "./projects.module.css";
import l from "./ledger.module.css";

type Pop = { kind: EditKind; ids: string[]; rect: Rect; side: "below" | "left" };
type Toast = { id: number; text: string; undo?: () => void; action?: { label: string; run: () => void } };

const BASE = `${DEMO_BASE}/projects`;

export default function FinalProjects({ sub }: { sub?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <Projects sub={sub} />
    </MotionConfig>
  );
}

let toastSeq = 0;

/**
 * Where the page is: which lens, and which project's home is open. Inside the
 * demo the address is the truth (/demo/projects/<id>?from=ledger), so a deep
 * link and a reload land on the same home. The home opens with a history entry
 * of its own, made without a route change so the cover can unfold in place.
 */
function useRoute(sub: string | undefined) {
  const { inDemo } = useDemoLinks();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const [localHome, setLocalHome] = useState<string | null>(null);
  const pushed = useRef(false);

  const lensOf = (v: string | null | undefined): Lens => (v === "ledger" ? "ledger" : v === "covers" ? "covers" : "console");
  let lens: Lens = lensOf(sub);
  let home: string | null = inDemo ? null : localHome;
  if (inDemo && pathname.startsWith(BASE)) {
    const seg = pathname.slice(BASE.length).split("/").filter(Boolean)[0];
    if (seg === "ledger" || seg === "covers") lens = seg;
    else if (seg) {
      home = decodeURIComponent(seg);
      lens = lensOf(search?.get("from"));
    } else lens = "console";
  } else if (!inDemo && sub && sub !== "ledger" && sub !== "covers" && sub !== "console" && localHome === null) {
    home = sub;
  }

  useEffect(() => {
    if (!home) pushed.current = false;
  }, [home]);

  const homeHref = (id: string, from: Lens) => `${BASE}/${encodeURIComponent(id)}${from === "console" ? "" : `?from=${from}`}`;
  const lensHref = (to: Lens) => (to === "console" ? BASE : `${BASE}/${to}`);

  const open = (id: string, from: Lens) => {
    if (!inDemo) return setLocalHome(id);
    if (home) {
      // Stepping between homes replaces the entry, so Back still returns to the lens.
      window.history.replaceState(null, "", homeHref(id, from));
    } else {
      window.history.pushState(null, "", homeHref(id, from));
      pushed.current = true;
    }
  };

  const close = (from: Lens) => {
    if (!inDemo) return setLocalHome(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      // Arrived by a deep link: there is no lens entry behind it, so put one in its place.
      window.history.replaceState(null, "", lensHref(from));
    }
  };

  return { lens, home, open, close, lensHref };
}

function Projects({ sub }: { sub?: string }) {
  const projects = useProjects();
  const links = useDemoLinks();
  const router = useRouter();
  const route = useRoute(sub);
  const isPhone = useMedia("(max-width: 720px)");
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const hydrated = useHydrated();
  const undoHint = useUndoHint();
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // The lens answers the click at once; the route follows (and back and forward still work).
  const [lens, setLens] = useState<Lens>(route.lens);
  const [seenRoute, setSeenRoute] = useState(route.lens);
  // The first lens is simply there; a switch cross-fades so the swap never jumps.
  const [lensMoved, setLensMoved] = useState(false);
  if (route.lens !== seenRoute) {
    setSeenRoute(route.lens);
    setLens(route.lens);
    setLensMoved(true);
  }

  const [query, setQuery] = useState("");
  const [flip, setFlip] = useState<-1 | 0 | 1>(0);
  const [returning, setReturning] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[] | null>(null);
  const [flyBack, setFlyBack] = useState(0);
  const [cmpClosing, setCmpClosing] = useState(false);
  const [pop, setPop] = useState<Pop | null>(null);
  const [datePreview, setDatePreview] = useState<DatePreview | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [createSignal, setCreateSignal] = useState(0);
  /** The name a search with no match hands to New project. */
  const [createName, setCreateName] = useState("");
  const [freshId, setFreshId] = useState<string | null>(null);
  // The order the lens on screen shows, so the home's previous and next follow it.
  const [order, setOrder] = useState<string[]>([]);
  const reportOrder = useCallback((ids: string[]) => {
    setOrder((prev) => (prev.join(",") === ids.join(",") ? prev : ids));
  }, []);

  const live = projects;
  const active = live.filter((p) => p.status !== "wrapped");
  const byId = (id: string | null | undefined) => (id ? projects.find((p) => p.id === id) : undefined);
  const home = byId(route.home);
  const homeId = home?.id ?? null;
  // An address that names no project. It waits for the saved session, which may hold a project made earlier.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const missing = settled && route.home && !home ? route.home : null;
  const homeIndex = home ? Math.max(0, order.indexOf(home.id)) : 0;
  const homeCount = Math.max(order.length, 1);

  // Closing by any route (Back button, Escape, the browser's Back): the cover flies home and focus follows it.
  const [seenHome, setSeenHome] = useState<string | null>(homeId);
  if (homeId !== seenHome) {
    if (seenHome && !homeId) {
      setReturning(reduce ? null : seenHome);
      setBack(seenHome);
      setPop(null);
      setFlip(0);
    }
    setSeenHome(homeId);
  }
  useEffect(() => {
    if (homeId || !back) return;
    const id = back;
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-card="${id}"] button, [data-console-row="${id}"]`);
      if (card) card.focus({ preventScroll: true });
      else scrollerRef.current?.focus({ preventScroll: true });
    });
  }, [homeId, back]);

  /* ── Toasts ──────────────────────────────────────────────────────── */

  const toast = useCallback((text: string, undo?: () => void, action?: Toast["action"]) => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, undo, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  /* ── The home ────────────────────────────────────────────────────── */

  const openHome = (id: string) => {
    setFlip(0);
    setReturning(null);
    setBack(null);
    setCompareIds(null);
    markOpened(id);
    route.open(id, lens);
  };

  const closeHome = () => {
    if (!homeId) return;
    route.close(lens);
  };

  const step = (dir: -1 | 1) => {
    if (!homeId || order.length < 2) return;
    const i = order.indexOf(homeId);
    const next = order[(i + dir + order.length) % order.length];
    setFlip(dir);
    markOpened(next);
    route.open(next, lens);
  };

  /* ── Compare ─────────────────────────────────────────────────────── */

  const closeCompare = useCallback(() => {
    if (cmpClosing) return;
    // Two steps: compare stays for one frame of the flight while the rows take back their covers and names.
    setCmpClosing(true);
    setFlyBack((n) => n + 1);
    window.setTimeout(() => {
      setCompareIds(null);
      setCmpClosing(false);
    }, 260);
  }, [cmpClosing]);

  const compareFromHome = () => {
    if (!homeId) return;
    const ids = order.length >= 2 ? order : active.map((p) => p.id);
    const i = ids.indexOf(homeId);
    const other = ids[(i + 1) % ids.length] ?? active.find((p) => p.id !== homeId)?.id;
    if (!other || other === homeId) return;
    setCompareIds([homeId, other]);
  };

  /* ── Edits: every one goes through the demo store, one undo step per project ── */

  const nameFor = (ids: string[]) => (ids.length === 1 ? byId(ids[0])?.name : `${ids.length} projects`);
  const TeamLead = (id: PersonId) => id as Parameters<typeof updateProject>[1]["lead"];

  const setStatus = (ids: string[], status: Exclude<StatusId, "wrapped">, reason: string) => {
    const r = reason.trim();
    const done = eachStep(ids, (id) => updateProject(id, { health: status, ...(r ? { healthReason: r } : {}) }));
    if (!done.count) {
      if (status !== "on_track" && !r) toast(`${STATUS_LABEL[status]} needs a reason, so the team knows why.`);
      return;
    }
    const word = STATUS_LABEL[status].toLowerCase();
    toast(r ? `${nameFor(ids)} marked ${word}. Your reason is posted as an update.` : `${nameFor(ids)} marked ${word}.`, done.undo);
  };

  const setOwner = (ids: string[], owner: PersonId) => {
    const done = eachStep(ids, (id) => updateProject(id, { lead: TeamLead(owner) }));
    if (done.count) toast(`${PEOPLE[owner].short} now leads ${nameFor(ids)}.`, done.undo);
  };

  const commitDate = (plan: DatePreview) => {
    const done = eachStep(plan.ids, (id) => {
      const p = byId(id);
      if (!p) return;
      const date = plan.iso ?? addDays(p.date, plan.delta ?? 0);
      const shift = daysFromToday(date) - daysFromToday(p.date);
      updateProject(id, { date, ...(p.end ? { end: addDays(p.end, shift) } : {}) });
    });
    if (done.count)
      toast(plan.ids.length > 1 ? `Moved ${plan.ids.length} dates by ${plan.delta! > 0 ? "+" : ""}${plan.delta} days.` : `Date moved for ${byId(plan.ids[0])?.name}.`, done.undo);
  };

  const wrap = (ids: string[]) => {
    const done = eachStep(ids, (id) => wrapProject(id));
    if (done.count) toast(`Wrapped up ${nameFor(ids)}. It moves to Wrapped.`, done.undo);
  };

  const unwrap = (ids: string[]) => {
    const done = eachStep(ids, (id) => unwrapProject(id));
    if (done.count) toast(`${nameFor(ids)} is active again.`, done.undo);
  };

  /** Make it, put it where it can be seen (first, in All active), and open it. */
  const reveal = (id: string, name: string, tasks: number) => {
    setSharedView("active");
    setQuery("");
    setFreshId(id);
    window.setTimeout(() => setFreshId((f) => (f === id ? null : f)), 2400);
    toast(tasks ? `Created ${name} with ${tasks} starter tasks.` : `Created ${name}.`, () => undoStore(), { label: "Open it", run: () => openHome(id) });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-card="${id}"], [data-row="${id}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    });
  };

  const create = (d: { name: string; kind: KindId; date: string; lead: PersonId; template?: string; hue?: number; note?: string }) => {
    const id = addProject({
      name: d.name,
      date: d.date,
      template: d.template,
      lead: TeamLead(d.lead),
      kind: storeKind(d.kind),
      ...(d.hue ? { hue: d.hue } : {}),
      ...(d.note ? { note: d.note } : d.template ? {} : { note: "Just started. No tasks yet" }),
    });
    const n = getDemoState().tasks.filter((t) => t.project === id).length;
    reveal(id, d.name, n);
  };

  const createFromCover = (d: CoverDraft) =>
    create({ name: d.name, kind: d.kind, date: d.date, lead: "orla", template: d.template, hue: d.hue, note: d.purpose || undefined });

  const createFromRow = (d: RowDraft) => create({ name: d.name, kind: d.kind, date: d.date, lead: d.owner, template: d.template });

  /* ── Editors: health, lead and date, from a row, a cover's home or the peek ── */

  const openEditor = (kind: EditKind, ids: string[], el?: Element | null, beside = false) => {
    let target = el ?? null;
    const cell = ids[0] ? document.querySelector(`[data-row="${ids[0]}"] [data-col="${kind}"]`) : null;
    if (!target && cell) target = cell.querySelector("button");
    const side = beside && !homeId && !!cell && (ids.length > 1 || !!target?.closest("[data-row]"));
    if (side) target = cell;
    const rect = rectOf(target) ?? { x: window.innerWidth / 2 - 140, y: 160, w: 0, h: 0 };
    setPop({ kind, ids, rect, side: side ? "left" : "below" });
  };

  const closePop = () => {
    setPop(null);
    setDatePreview(null);
  };

  const pickLens = (to: Lens) => {
    if (to === lens) return;
    setLensMoved(true);
    setLens(to);
    if (links.inDemo) router.push(route.lensHref(to), { scroll: false });
  };

  const startCreate = (name = "") => {
    if (homeId) closeHome();
    setQuery("");
    setSharedView("active");
    setCreateName(name);
    if (lens === "console") {
      // The console has no create card of its own: New project opens the covers' one.
      pickLens("covers");
      requestAnimationFrame(() => requestAnimationFrame(() => setCreateSignal((n) => n + 1)));
      return;
    }
    setCreateSignal((n) => n + 1);
  };

  /* ── Keyboard: what works everywhere; each lens adds its own ─────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || pop) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      // Ctrl/⌘ Z steps back the store's last change: a health, a lead, a date, a tick, a new project.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (undoStore()) {
          // The step is taken back, so a toast still offering to undo it would be a second, different undo.
          setToasts((ts) => ts.filter((x) => !x.undo));
          toast("Undone.");
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (compareIds) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeCompare();
        }
        return;
      }
      if (homeId) {
        if (e.key === "Escape" && !typing) {
          e.preventDefault();
          closeHome();
          return;
        }
        if (typing) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const inHome = (sel: string) => document.querySelector(`[aria-labelledby="home-title"] ${sel}`);
        if (key === "ArrowRight" || key === "ArrowLeft") {
          e.preventDefault();
          step(key === "ArrowRight" ? 1 : -1);
        } else if ((key === "s" || key === "d" || key === "o") && home?.status !== "wrapped") {
          e.preventDefault();
          const kind: EditKind = key === "s" ? "status" : key === "d" ? "date" : "owner";
          openEditor(kind, [homeId], inHome(`[aria-keyshortcuts="${key}"]`));
        } else if (key === "c") {
          e.preventDefault();
          compareFromHome();
        }
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        startCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── The header: counts with nouns, then one sentence that ends in the thing to do ── */

  const health = { off: 0, risk: 0, on: 0, early: 0 };
  for (const p of active) {
    const h = healthOf(p);
    if (h === "off_track") health.off += 1;
    else if (h === "at_risk") health.risk += 1;
    else if (h === "too_early") health.early += 1;
    else health.on += 1;
  }
  const openTasks = active.reduce((a, p) => a + (p.total - p.done), 0);
  const lateTasks = active.reduce((a, p) => a + p.overdue, 0);
  const past = active.filter(isPastDue);

  // The most pressing task Orla owns: the latest late one first, then one waiting on her approval.
  const yours = active
    .filter((p) => p.needsYou)
    .sort((a, b) => b.needsYou!.late - a.needsYou!.late || daysFromToday(a.date) - daysFromToday(b.date))[0];

  const summary = (
    <p className={tasksStyles.summary} style={{ flexWrap: "wrap" }}>
      <Count n={active.length} noun="active project" />
      {health.off ? <Count n={health.off} noun="off track" sep /> : null}
      {health.risk ? <Count n={health.risk} noun="at risk" sep /> : null}
      <Count n={health.on} noun="on track" sep />
      {health.early ? <Count n={health.early} noun="too early to tell" sep /> : null}
      <Count n={openTasks} noun="open task" sep />
      {lateTasks ? <Count n={lateTasks} noun="late" sep tone="late" /> : null}
    </p>
  );

  const sentence = past.length ? (
    <p className={tasksStyles.health}>
      <Icon.clock size={14} />
      <span>
        <strong>{past[0].name}</strong> is past its date{past.length > 1 ? `, with ${past.length - 1} more` : ""}.{" "}
        <button type="button" className={tasksStyles.inlineAction} onClick={() => wrap([past[0].id])}>
          Wrap up
        </button>
        <span className={tasksStyles.inlineSep} aria-hidden="true">
          ·
        </span>
        <button type="button" className={tasksStyles.inlineQuiet} onClick={() => openHome(past[0].id)}>
          Move the date
        </button>
      </span>
    </p>
  ) : yours ? (
    <p className={tasksStyles.health} data-tone={yours.needsYou!.late ? "late" : "you"}>
      <span className={css.sentenceMark} data-tone={yours.needsYou!.late ? "late" : "you"} aria-hidden="true" />
      <span>
        {yours.needsYou!.title}, in{" "}
        <button type="button" className={css.sentenceLink} onClick={() => openHome(yours.id)}>
          {yours.name}
        </button>
        .{" "}
        <button type="button" className={tasksStyles.inlineAction} onClick={() => router.push(links.task(yours.needsYou!.taskId))}>
          Open the task
        </button>
      </span>
    </p>
  ) : (
    <p className={tasksStyles.health} data-kind="healthy">
      <Icon.check size={14} />
      <span>Nothing of yours is late or waiting on you.</span>
    </p>
  );

  // The console's count line: quiet, monospaced, every number with its noun.
  const looks = active.filter(needsAttention).length;
  const consoleSummary = (
    <p className={css.countLine}>
      <span>{active.length} active</span>
      <span aria-hidden="true">·</span>
      <span className={looks ? css.countLook : undefined}>
        {looks} {looks === 1 ? "needs" : "need"} a look
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {openTasks} open {openTasks === 1 ? "task" : "tasks"}
      </span>
      {lateTasks ? (
        <>
          <span aria-hidden="true">·</span>
          <span className={css.countLate}>{lateTasks} late</span>
        </>
      ) : null}
    </p>
  );

  const popProjects = pop ? (pop.ids.map((id) => byId(id)).filter(Boolean) as Project[]) : [];
  const single = popProjects.length === 1 ? popProjects[0] : undefined;
  const overlay = !!homeId || !!compareIds;
  const shareCovers = !reduce && !homeId;

  const lensProps = {
    query,
    homeId,
    returning,
    onReturned: () => setReturning(null),
    reportOrder,
  };

  const searchBox = (
    <label className={css.search}>
      <Icon.search size={14} />
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a project"
        aria-label="Find a project"
        aria-keyshortcuts="/"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setQuery("");
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {query ? (
        <button type="button" className={css.clear} aria-label="Clear the search" onClick={() => setQuery("")}>
          <Icon.close size={12} />
        </button>
      ) : (
        <kbd className={css.kbd}>/</kbd>
      )}
    </label>
  );

  return (
    <div className={`${css.root} ${l.root}`} data-phone={isPhone || undefined}>
      {/* Shared ids live per lens: a cover unfolds from the lens it sits in, and switching lens never drags covers across. */}
      <LayoutGroup id={lens}>
        <motion.div ref={scrollerRef} tabIndex={-1} layoutScroll className={`${css.scroller} thin-scroll`} aria-hidden={overlay || undefined} inert={overlay}>
          <PageHeader
            title="Projects"
            summary={lens === "console" ? consoleSummary : summary}
            health={lens === "console" ? null : sentence}
            actions={
              <>
                <ViewSwitch lens={lens} onPick={pickLens} />
                {searchBox}
                <PrimaryButton onClick={() => startCreate()} className={css.newBtn}>
                  New project
                  <kbd className={css.kbdOnAccent}>N</kbd>
                </PrimaryButton>
              </>
            }
          />
          {isPhone ? (
            <div className={css.lensRow}>
              <ViewSwitch lens={lens} onPick={pickLens} wide />
              {searchBox}
            </div>
          ) : null}

          <motion.div
            key={lens}
            className={css.lensBody}
            initial={lensMoved ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
          {missing ? (
            <section className={css.missing} aria-labelledby="missing-title">
              <span className={css.missingMark} aria-hidden="true">
                <Icon.search size={18} />
              </span>
              <h2 id="missing-title" className={css.missingTitle}>
                No project at this address
              </h2>
              <p className={css.missingText}>
                Nothing here is called “{missing}”. The link may be old, or the project was made in another tab: a project made in this demo lives only in the tab that made it.
              </p>
              <div className={css.missingActions}>
                <Link href={links.surface("projects", lens === "console" ? undefined : lens)} prefetch={false} className={css.missingPrimary}>
                  See all {active.length} projects
                </Link>
                <button
                  type="button"
                  className={css.missingQuiet}
                  onClick={() => {
                    router.push(links.surface("projects", lens === "console" ? undefined : lens));
                    window.setTimeout(() => searchRef.current?.focus(), 80);
                  }}
                >
                  Find a project <kbd className={css.kbd}>/</kbd>
                </button>
              </div>
            </section>
          ) : lens === "console" ? (
            <Console query={query} hydrated={hydrated} onOpen={openHome} onClearQuery={() => setQuery("")} reportOrder={reportOrder} toast={toast} />
          ) : lens === "covers" ? (
            <Shelf
              {...lensProps}
              projects={live}
              onClearQuery={() => setQuery("")}
              back={back}
              reduce={reduce}
              hydrated={hydrated}
              createSignal={createSignal}
              createName={createName}
              onCreateNamed={startCreate}
              freshId={freshId}
              onCreate={createFromCover}
              onOpen={openHome}
              onLeaveBack={() => setBack(null)}
            />
          ) : (
            <Ledger
              {...lensProps}
              projects={projects}
              isPhone={isPhone}
              keysLive={!overlay && !pop}
              back={back}
              shareCovers={shareCovers}
              editing={pop ? { kind: pop.kind, ids: pop.ids } : null}
              datePreview={datePreview}
              compareIds={compareIds}
              flyKey={flyBack}
              flying={cmpClosing}
              createSignal={createSignal}
              createName={createName}
              onCreateNamed={startCreate}
              freshId={freshId}
              onOpen={openHome}
              onEdit={openEditor}
              onCompare={setCompareIds}
              onCreate={createFromRow}
              onWrap={(id) => wrap([id])}
              onWrapMany={wrap}
              onUnwrap={(id) => unwrap([id])}
              toast={toast}
            />
          )}
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {home ? (
            <Home
              key="home"
              p={home}
              position={homeIndex}
              count={homeCount}
              flip={flip}
              reduce={reduce}
              origin={lens === "covers" ? "covers" : "ledger"}
              canCompare={active.length > 1}
              onClose={closeHome}
              onStep={step}
              onEdit={(kind, el) => openEditor(kind, [home.id], el)}
              onToggleTask={(tid) => toggleStoreTask(tid)}
              onToggleMilestone={(mid) => {
                const m = home.milestones.find((x) => x.id === mid);
                if (m) setMilestone(home.id, mid, !m.done);
              }}
              onPost={(text) => {
                if (postUpdate(home.id, text)) toast("Posted to the updates feed.", () => undoStore());
              }}
              onUnwrap={() => unwrap([home.id])}
              onCompare={compareFromHome}
              onWrap={() => wrap([home.id])}
              say={(text) => toast(text)}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {compareIds ? (
            <CompareView
              key="compare"
              projects={compareIds.map((id) => byId(id)).filter(Boolean) as Project[]}
              pool={(order.length >= 2 ? order.map((id) => byId(id)).filter(Boolean) : active) as Project[]}
              onChange={setCompareIds}
              onClose={closeCompare}
              closing={cmpClosing}
              onOpen={(id) => {
                setCompareIds(null);
                openHome(id);
              }}
            />
          ) : null}
        </AnimatePresence>
      </LayoutGroup>

      {isPhone && !homeId && !compareIds ? (
        <button type="button" className={css.fab} onClick={() => startCreate()} aria-label="New project">
          <Icon.plus size={22} />
        </button>
      ) : null}

      <div className={l.toasts} aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={l.toast}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
            >
              <span>{toastSentence(t.text)}</span>
              {t.action && (
                <button
                  type="button"
                  className={l.toastUndo}
                  onClick={() => {
                    t.action!.run();
                    setToasts((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
              {t.undo && (
                <button
                  type="button"
                  className={l.toastUndo}
                  aria-keyshortcuts="Control+Z Meta+Z"
                  onClick={() => {
                    t.undo!();
                    setToasts((ts) => ts.filter((x) => x.id !== t.id));
                  }}
                >
                  Undo
                  <kbd className={tasksStyles.toastKbd}>{undoHint}</kbd>
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {pop && (
        <Popover
          rect={pop.rect}
          side={pop.side}
          height={pop.kind === "date" ? 408 : 320}
          mobile={isPhone}
          onClose={closePop}
          width={pop.kind === "date" ? 288 : pop.kind === "status" ? 300 : 240}
          align="start"
          label={pop.kind === "status" ? "Change health" : pop.kind === "owner" ? "Set the lead" : "Move date"}
        >
          {pop.kind === "status" && (
            <StatusEditor
              current={single && single.status !== "wrapped" ? single.status : undefined}
              tooEarly={single?.tooEarly}
              count={popProjects.length}
              currentReason={single && (single.status === "at_risk" || single.status === "off_track") ? (single.reason ?? undefined) : undefined}
              note={single ? statusWhy(single) : null}
              onCommit={(st, r) => {
                setStatus(pop.ids, st, r);
                closePop();
              }}
              onWrap={() => {
                wrap(pop.ids);
                closePop();
              }}
            />
          )}
          {pop.kind === "owner" && (
            <OwnerMenu
              current={single?.owner}
              onPick={(o) => {
                setOwner(pop.ids, o);
                closePop();
              }}
            />
          )}
          {pop.kind === "date" && popProjects.length > 0 && (
            <DateEditor
              projects={popProjects}
              onPreview={setDatePreview}
              onCommit={(plan) => {
                commitDate(plan);
                closePop();
              }}
            />
          )}
        </Popover>
      )}
    </div>
  );
}

/** "15 active projects", "2 off track", "11 late": every number with its noun. */
function Count({ n, noun, sep, tone }: { n: number; noun: string; sep?: boolean; tone?: "late" }) {
  const plural = /^(active project|open task)$/.test(noun) && n !== 1 ? `${noun}s` : noun;
  const body: ReactNode = (
    <span className={tone === "late" ? css.countLate : undefined}>
      <strong className={tasksStyles.strong}>{n}</strong> {plural}
    </span>
  );
  return (
    <>
      {sep ? (
        <span className={tasksStyles.sep} aria-hidden="true">
          ·
        </span>
      ) : null}
      {body}
    </>
  );
}

const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** A media query, read in a hydration-safe way: the server snapshot is always false. */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
