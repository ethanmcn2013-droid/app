"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Edition, type EditionCtx, type Scope } from "./context";
import {
  CHANGES,
  INITIAL_TASKS,
  PEOPLE,
  PROJECTS,
  TODAY,
  daysBetween,
  fmtLong,
  projectById,
  type Task,
  type TaskAction,
} from "./data";
import { Check, Chevron, Speaker, Stop } from "./icons";
import {
  OrchardBody,
  OrchardLede,
  QuietBody,
  QuietLede,
  useOrchard,
} from "./orchard";
import {
  PortfolioBody,
  PortfolioLede,
  ProjectBody,
  ProjectLede,
  Tile,
  useNeeds,
} from "./others";
import { Kbd } from "./pill";
import { Rewrite } from "./parts";
import s from "./edition.module.css";

type Toast = { id: number; message: string; undo: boolean };

function describe(t: Task, a: TaskAction) {
  switch (a.kind) {
    case "done":
      return t.id === "seating"
        ? "Approved the seating plan"
        : `Marked “${t.title}” done`;
    case "reschedule":
      return `Moved “${t.title}” to ${fmtLong(a.to)}`;
    case "reassign":
      return `Gave “${t.title}” to ${PEOPLE[a.to].name}`;
    case "nudge":
      return `Asked ${PEOPLE[a.to].name} about “${t.title}”`;
  }
}

function apply(t: Task, a: TaskAction, clock: string): Task {
  const base = { ...t, lastAction: a };
  switch (a.kind) {
    case "done":
      return {
        ...base,
        status: "done",
        doneAt: "2026-07-16",
        handled: `Done at ${clock}`,
        lastActivity: `You closed it at ${clock}`,
      };
    case "reschedule":
      return {
        ...base,
        due: a.to,
        status:
          t.status === "done" || t.status === "stalled" ? "todo" : t.status,
        handled: `You moved it to ${fmtLong(a.to)}`,
        lastActivity: `You moved the date at ${clock}`,
      };
    case "reassign":
      return {
        ...base,
        owner: a.to,
        handled: `You gave it to ${PEOPLE[a.to].name}`,
        lastActivity: `You reassigned it at ${clock}`,
      };
    case "nudge":
      return {
        ...base,
        handled: `You asked ${PEOPLE[a.to].name} at ${clock}`,
        lastActivity: `You asked ${PEOPLE[a.to].name} at ${clock}`,
      };
  }
}

export default function MorningEdition() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [history, setHistory] = useState<Task[][]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [scope, setScopeState] = useState<Scope>("orchard");
  const [brief, setBrief] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [nav, setNav] = useState<{
    i: number;
    n: number;
    num: number;
  } | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [open, setOpen] = useState<{ key: string | null; pinned: boolean }>({
    key: null,
    pinned: false,
  });
  const [speaking, setSpeaking] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [section, setSection] = useState("");
  const [keysOpen, setKeysOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const clock = `09:${String(3 + history.length).padStart(2, "0")}`;

  const notify = useCallback(
    (message: string) => setToast({ id: Date.now(), message, undo: false }),
    [],
  );

  const act = useCallback(
    (taskId: string, a: TaskAction) => {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      setHistory((h) => [...h, tasks]);
      setTasks((prev) =>
        prev.map((x) => (x.id === taskId ? apply(x, a, clock) : x)),
      );
      setToast({ id: Date.now(), message: describe(t, a), undo: true });
    },
    [tasks, clock],
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    setTasks(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setToast({
      id: Date.now(),
      message: "Undone. The edition is back as it was.",
      undo: false,
    });
  }, [history]);

  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    setOpen({ key: null, pinned: false });
    setTracked(false);
    setNav(null);
    pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ── tracked changes: a small navigator walks the marks in the text ── */

  const changeMarks = useCallback(() => {
    const els = Array.from(
      pageRef.current?.querySelectorAll<HTMLElement>("[data-chg]") ?? [],
    ).filter((el) => !el.closest("[inert]") && el.getClientRects().length);
    return els;
  }, []);

  const goToChange = useCallback(
    (i: number, scroll = true) => {
      const els = changeMarks();
      if (!els.length) {
        setNav({ i: 0, n: 0, num: 0 });
        return;
      }
      const k = (i + els.length) % els.length;
      els.forEach((el, j) => {
        if (j === k) el.setAttribute("data-current", "");
        else el.removeAttribute("data-current");
      });
      if (scroll) els[k].scrollIntoView({ block: "center", behavior: "smooth" });
      setNav({ i: k, n: els.length, num: Number(els[k].dataset.chg) });
    },
    [changeMarks],
  );

  const toggleTracked = useCallback(() => {
    if (tracked) {
      setTracked(false);
      setNav(null);
      changeMarks().forEach((el) => el.removeAttribute("data-current"));
      return;
    }
    setTracked(true);
    // If no change is on screen, take the reader to the first one.
    requestAnimationFrame(() => {
      const page = pageRef.current;
      const els = changeMarks();
      if (!page || !els.length) {
        setNav({ i: 0, n: els.length, num: 0 });
        return;
      }
      const box = page.getBoundingClientRect();
      const inView = els.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return r.top > box.top + 60 && r.bottom < box.bottom - 80;
      });
      goToChange(inView >= 0 ? inView : 0, inView < 0);
    });
  }, [tracked, changeMarks, goToChange]);

  const ctx = useMemo<EditionCtx>(
    () => ({
      tasks,
      task: (id) => tasks.find((t) => t.id === id)!,
      act,
      notify,
      openPill: open.key,
      pinned: open.pinned,
      setOpenPill: (key, pinned = false) => setOpen({ key, pinned }),
      closePill: (key) =>
        setOpen((o) => (o.key === key ? { key: null, pinned: false } : o)),
      tracked,
      toggleTracked,
      brief,
      setScope,
    }),
    [tasks, act, notify, open, tracked, toggleTracked, brief, setScope],
  );

  const listen = useCallback(() => {
    const synth =
      typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      notify("Listening is not available in this browser");
      return;
    }
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = Array.from(
      pageRef.current?.querySelectorAll<HTMLElement>(
        "[data-speak], [data-prose]",
      ) ?? [],
    )
      .map((el) => el.innerText)
      .join("\n\n");
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }, [speaking, notify]);

  /* J and K step between sections, like turning a page. At the foot of the
     page the last section counts as current, even if it is too short to
     reach the top. */
  const stepSection = useCallback((dir: 1 | -1) => {
    const page = pageRef.current;
    if (!page) return;
    const rows = sectionRows(page);
    // J and K move focus to the heading they land on, so that heading is the
    // reader's place, even when the page cannot scroll it to the top.
    const focused = rows.findIndex((r) => r.contains(document.activeElement));
    const cur = focused >= 0 ? focused : currentSection(page, rows, 76);
    const next = rows[Math.min(rows.length - 1, Math.max(0, cur + dir))];
    if (!next) return;
    next.scrollIntoView({ block: "start", behavior: "smooth" });
    setSection(next.dataset.title ?? "");
    next.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, []);

  // Stop reading aloud when the page goes away.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // The toast leaves on its own.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.undo ? 7000 : 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Page shortcuts.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setKeysOpen((v) => !v);
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "b") setBrief((v) => !v);
      else if (k === "t") toggleTracked();
      else if (k === "l") listen();
      else if (k === "z") undo();
      else if (k === "j") stepSection(1);
      else if (k === "k") stepSection(-1);
      else if (k === "escape") {
        setOpen({ key: null, pinned: false });
        setKeysOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, listen, toggleTracked, stepSection]);

  const onScroll = () => {
    const el = pageRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? el.scrollTop / max : 0;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    const c = el.scrollTop > 260;
    if (c !== condensed) setCondensed(c);
    // Name the section being read in the running head: the one that has
    // crossed a line about a third of the way down, or the last at the foot.
    const rows = sectionRows(el);
    // A heading reached with J or K keeps its name while it is on screen.
    const box = el.getBoundingClientRect();
    const f = rows.findIndex((r) => {
      const h = r.querySelector("h2");
      if (!h || h !== document.activeElement) return false;
      const y = h.getBoundingClientRect().top;
      return y > box.top && y < box.bottom - 40;
    });
    const i = f >= 0 ? f : currentSection(el, rows, el.clientHeight * 0.3);
    const name = i >= 0 ? (rows[i].dataset.title ?? "") : "";
    if (name !== section) setSection(name);
  };

  const everything = () => {
    setHistory((h) => [...h, tasks]);
    setQuiet(false);
    setScopeState("orchard");
    setTasks((prev) =>
      prev.map((t) =>
        t.id === "seating" || t.id === "tonic" || t.id === "tasting"
          ? apply(t, t.actions![0], clock)
          : t,
      ),
    );
  };
  const resetToday = () => {
    setTasks(INITIAL_TASKS);
    setHistory([]);
    setQuiet(false);
    setScope("orchard");
  };

  const orchardScope = scope === "orchard";
  const scopeName =
    scope === "all" ? "All 5 projects" : projectById(scope).short;
  const lede =
    scope === "all" ? (
      <PortfolioLede />
    ) : orchardScope ? (
      quiet ? (
        <QuietLede />
      ) : (
        <OrchardLede />
      )
    ) : (
      <ProjectLede id={scope} />
    );
  const body =
    scope === "all" ? (
      <PortfolioBody />
    ) : orchardScope ? (
      quiet ? (
        <QuietBody />
      ) : (
        <OrchardBody />
      )
    ) : (
      <ProjectBody id={scope} />
    );
  const calm =
    (orchardScope && quiet) || scope === "kestrel" || scope === "winter";
  const canTrack = orchardScope && !quiet;
  const morning =
    orchardScope && quiet
      ? "quiet"
      : scope === "winter"
        ? "new"
        : "today";

  return (
    <Edition.Provider value={ctx}>
      <div
        ref={pageRef}
        className={`${s.page} v3-focus`}
        onScroll={onScroll}
        data-tracked={(tracked && canTrack) || undefined}
      >
        <div className={s.runhead} data-show={condensed || undefined}>
            {tracked && canTrack && nav && (
              <div className={s.chgNav} role="group" aria-label="Changes since Tuesday">
                <span className={s.chgNavSwatch} aria-hidden />
                <span className={s.chgNavText} aria-live="polite">
                  {nav.n
                    ? `Change ${nav.num} of ${CHANGES.length}`
                    : "No changes left in the text"}
                </span>
                {nav.n > 1 && (
                  <>
                    <button
                      type="button"
                      className={s.chgNavBtn}
                      aria-label="Previous change"
                      onClick={() => goToChange(nav.i - 1)}
                    >
                      <Chevron className={s.chevUp} />
                    </button>
                    <button
                      type="button"
                      className={s.chgNavBtn}
                      aria-label="Next change"
                      onClick={() => goToChange(nav.i + 1)}
                    >
                      <Chevron />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={s.chgNavDone}
                  onClick={toggleTracked}
                >
                  Hide
                </button>
              </div>
            )}
          <div className={s.runheadInner} aria-hidden={!condensed}>
            <span className={s.runheadText}>
              <strong>Overview</strong>
              <span className={s.runheadSep} aria-hidden>
                /
              </span>
              {scopeName}
              {section && (
                <>
                  <span className={s.runheadSep} aria-hidden>
                    /
                  </span>
                  <span className={s.runheadSection} key={section}>
                    {section}
                  </span>
                </>
              )}
            </span>
            <span className={s.progress}>
              <span ref={barRef} className={s.progressBar} />
            </span>
          </div>
        </div>

        <article
          className={s.sheet}
          data-calm={calm || undefined}
          data-scope={scope}
        >
          <header className={s.masthead}>
            <div className={s.mastMain} data-speak>
              <h1 className={s.h1}>
                Overview
                <span className={s.h1Date}>
                  <span className={s.datelineSep} aria-hidden>
                    ·
                  </span>
                  Thursday 16 July, 09:00 edition
                </span>
              </h1>
              <p className={s.lede} key={`${scope}-${quiet}`} data-lede>
                {lede}
              </p>
            </div>
            <MastRail key={`${scope}-${quiet}`} scope={scope} quiet={quiet} />
          </header>

          <div className={s.toolbar}>
            <ScopeSentence scope={scope} onChange={setScope} />
            <div className={s.controls}>
              <div
                className={s.segment}
                role="radiogroup"
                aria-label="Edition length"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={brief}
                  className={s.segBtn}
                  onClick={() => setBrief(true)}
                >
                  Brief
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!brief}
                  className={s.segBtn}
                  onClick={() => setBrief(false)}
                >
                  Full
                </button>
              </div>
              {canTrack && (
                <button
                  type="button"
                  className={s.toggle}
                  aria-pressed={tracked}
                  onClick={toggleTracked}
                  title="Mark what changed since Tuesday (T)"
                >
                  <span className={s.toggleSwatch} aria-hidden />
                  Since Tuesday
                  <span className={s.toggleCount}>{CHANGES.length}</span>
                </button>
              )}
              <button
                type="button"
                className={s.toggle}
                aria-pressed={speaking}
                onClick={listen}
                title="Read this edition aloud (L)"
              >
                {speaking ? <Stop /> : <Speaker />}
                {speaking ? "Stop" : "Listen"}
              </button>
            </div>
          </div>

          <div className={s.body} key={`${scope}-${quiet}`}>
            {body}
          </div>

          <footer className={s.colophon}>
            <p className={s.colophonNote}>
              Written at 09:00 from {UPDATES[scope]} updates across{" "}
              {scope === "all" ? "your five projects" : projectById(scope).short}
              . The next edition is tomorrow at 09:00.
            </p>
            <div className={s.colophonTools}>
              <PreviewMenu
                current={morning}
                onPick={(m) => {
                  if (m === "quiet") {
                    setScope("orchard");
                    setQuiet(true);
                  } else if (m === "new") {
                    setQuiet(false);
                    setScope("winter");
                  } else if (m === "done") {
                    everything();
                  } else resetToday();
                }}
              />
              <KeysPopover open={keysOpen} setOpen={setKeysOpen} />
            </div>
          </footer>
        </article>

        {toast && (
          <div className={s.toast} role="status" key={toast.id}>
            <Check className={s.toastTick} />
            <span className={s.toastText}>{toast.message}</span>
            {toast.undo && (
              <button type="button" className={s.toastUndo} onClick={undo}>
                Undo <Kbd>Z</Kbd>
              </button>
            )}
          </div>
        )}
      </div>
    </Edition.Provider>
  );
}

const sectionRows = (page: HTMLElement) =>
  Array.from(page.querySelectorAll<HTMLElement>("[data-section]")).filter(
    (r) => r.getClientRects().length > 0,
  );

/* The section being read: the last one whose top has crossed `line` pixels
   below the top of the page, or the last section once the page is at its
   foot, so a short closing section is still named and reachable. */
function currentSection(page: HTMLElement, rows: HTMLElement[], line: number) {
  if (!rows.length) return -1;
  const max = page.scrollHeight - page.clientHeight;
  if (max > 0 && page.scrollTop >= max - 4) return rows.length - 1;
  const top = page.getBoundingClientRect().top + line;
  let cur = -1;
  rows.forEach((r, i) => {
    if (r.getBoundingClientRect().top <= top) cur = i;
  });
  return cur;
}

const UPDATES: Record<Scope, number> = {
  orchard: 47,
  all: 112,
  harvest: 14,
  burren: 18,
  kestrel: 9,
  winter: 2,
};

/* ── the masthead rail: the next hard date, not a reading time ── */

function railFor(
  scope: Scope,
  quiet: boolean,
  seatingOpen: boolean,
): { label: string; big: string; sub: string } {
  const inDays = (iso: string) => {
    const n = daysBetween(TODAY, iso);
    return n === 1 ? "tomorrow" : `in ${n} days`;
  };
  const tag = scope === "all" ? "The Orchard, events: " : "";
  if ((scope === "orchard" && !quiet) || scope === "all") {
    if (seatingOpen)
      return {
        label: "Printer deadline",
        big: "27 hours",
        sub: tag
          ? `${tag}seating plan to the printer, tomorrow 12:00`
          : "Seating plan to the printer, tomorrow 12:00",
      };
    return {
      label: "Next date",
      big: "Saturday",
      sub: tag
        ? `${tag}the Kelly christening lunch, 40 guests`
        : "Kelly christening lunch, 40 guests",
    };
  }
  const next = (big: string, sub: string) => ({ label: "Next date", big, sub });
  if (scope === "orchard")
    return next("Sat 1 August", `Menu tasting, ${inDays("2026-08-01")}`);
  if (scope === "harvest")
    return next("Sat 12 September", `The supper club, ${inDays("2026-09-12")}`);
  if (scope === "burren")
    return next("Fri 31 July", `Coach booked by then, ${inDays("2026-07-31")}`);
  if (scope === "kestrel")
    return next("Fri 24 July", `Logo review, ${inDays("2026-07-24")}`);
  return next("No dates yet", "Pick three launch dates first");
}

/* The next hard date. When a decision moves it, it rewrites like the lede. */
function MastRail({ scope, quiet }: { scope: Scope; quiet: boolean }) {
  const o = useOrchard();
  return (
    <aside className={s.mastRail} aria-label="Next date">
      <Rewrite
        k={o.seatingOpen ? "open" : "done"}
        className={s.mastStack}
        render={(k) => {
          const r = railFor(scope, quiet, k === "open");
          return (
            <>
              <span className={s.mastLabel}>{r.label}</span>
              <span className={s.mastBig}>{r.big}</span>
              <span className={s.mastSub}>{r.sub}</span>
            </>
          );
        }}
      />
    </aside>
  );
}

/* ── colophon tools: other mornings and the keyboard ─────────── */

type Morning = "today" | "quiet" | "new" | "done";

function usePopover(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);
  return ref;
}

function PreviewMenu({
  current,
  onPick,
}: {
  current: Morning;
  onPick: (m: Morning) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = usePopover(open, close);
  const items: [Morning, string, string][] = [
    ["today", "This morning", "Thursday, as it is"],
    ["done", "Everything dealt with", "All three decisions made"],
    ["quiet", "A quiet day", "Nothing slipped, nothing needs you"],
    ["new", "A brand-new project", "Two tasks, no dates"],
  ];
  return (
    <div
      ref={ref}
      className={s.pop}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        className={s.colophonBtn}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Preview another morning
        <Chevron className={s.colophonChev} />
      </button>
      {open && (
        <div className={s.popMenu} role="menu" aria-label="Preview another morning">
          {items.map(([k, name, note]) => (
            <button
              key={k}
              type="button"
              role="menuitemradio"
              aria-checked={current === k}
              className={s.popItem}
              onClick={() => {
                setOpen(false);
                onPick(k);
              }}
            >
              <span className={s.popItemText}>
                <span className={s.popItemName}>{name}</span>
                <span className={s.popItemNote}>{note}</span>
              </span>
              {current === k && <Check className={s.scopeCheck} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KeysPopover({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean | ((v: boolean) => boolean)) => void;
}) {
  const close = useCallback(() => setOpen(false), [setOpen]);
  const ref = usePopover(open, close);
  const keys: [string[], string][] = [
    [["J", "K"], "Next or previous section"],
    [["Tab"], "Move between names, tasks and dates"],
    [["Enter"], "Open one, then act with its letter"],
    [["B"], "Brief or full edition"],
    [["T"], "Mark changes since Tuesday"],
    [["L"], "Listen"],
    [["Z"], "Undo"],
    [["?"], "Show these keys"],
  ];
  return (
    <div ref={ref} className={s.pop}>
      <button
        type="button"
        className={s.colophonBtn}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Keyboard <Kbd>?</Kbd>
      </button>
      {open && (
        <div
          className={`${s.popMenu} ${s.popKeys}`}
          role="dialog"
          aria-label="Keyboard shortcuts"
        >
          {keys.map(([ks, what]) => (
            <span key={what} className={s.popKeyRow}>
              <span className={s.popKeyKeys}>
                {ks.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              {what}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── scope as a sentence ──────────────────────────────────────── */

function ScopeSentence({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const { need, o } = useNeeds();
  const metaFor = (id: Exclude<Scope, "all">) => {
    if (need[id] < 1)
      return id === "kestrel"
        ? "On track"
        : id === "winter"
          ? "Early, 2 tasks"
          : "Steady";
    if (id === "orchard")
      return `${o.openDecisions} ${o.openDecisions === 1 ? "call" : "calls"} for you`;
    if (id === "harvest") return "Seats selling slowly, 1 call for you";
    return "Six forms out, 1 call for you";
  };
  const options: Scope[] = ["all", ...PROJECTS.map((p) => p.id)];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const focusOption = (i: number) =>
    requestAnimationFrame(() =>
      wrapRef.current
        ?.querySelectorAll<HTMLButtonElement>("[role=option]")
        [i]?.focus(),
    );

  const openMenu = () => {
    const i = Math.max(0, options.indexOf(scope));
    setActive(i);
    setOpen(true);
    focusOption(i);
  };

  const pick = (sc: Scope) => {
    setOpen(false);
    onChange(sc);
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n =
        (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
        options.length;
      setActive(n);
      focusOption(n);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      wrapRef.current
        ?.querySelector<HTMLButtonElement>("[data-scope-trigger]")
        ?.focus();
    }
  };

  const label = scope === "all" ? "all 5 projects" : projectById(scope).name;

  return (
    <div className={s.scope}>
      <span className={s.scopeLead}>Reading about</span>{" "}
      <span ref={wrapRef} className={s.scopeWrap}>
        <button
          type="button"
          data-scope-trigger
          className={s.scopeBtn}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          {scope !== "all" && <Tile id={scope} />}
          {label}
          <Chevron className={s.scopeChevron} />
        </button>
        {open && (
          <div
            className={s.scopeMenu}
            role="listbox"
            aria-label="Choose what this edition covers"
            onKeyDown={onListKey}
          >
            {options.map((o, i) => {
              const p = o === "all" ? null : projectById(o);
              const needs = p ? need[p.id] >= 1 : false;
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={o === scope}
                  tabIndex={i === active ? 0 : -1}
                  className={s.scopeOption}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setActive(i)}
                >
                  {p ? (
                    <Tile id={p.id} />
                  ) : (
                    <span className={s.tileAll} aria-hidden>
                      {PROJECTS.slice(0, 4).map((q) => (
                        <span
                          key={q.id}
                          style={{ background: `var(--v3-project-${q.tone})` }}
                        />
                      ))}
                    </span>
                  )}
                  <span className={s.scopeOptText}>
                    <span className={s.scopeOptName}>
                      {p ? p.name : "All 5 projects"}
                    </span>
                    <span
                      className={s.scopeOptMeta}
                      data-needs={needs || undefined}
                    >
                      {p ? metaFor(p.id) : "A short dispatch from each"}
                    </span>
                  </span>
                  {o === scope && <Check className={s.scopeCheck} />}
                </button>
              );
            })}
          </div>
        )}
      </span>
    </div>
  );
}
