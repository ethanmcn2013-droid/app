"use client";

/*
 * Projects, concept 5: the living project page.
 * The page you land on is a project; the portfolio is a slim rail beside it.
 * Front end only, on invented sample data from ./data.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SEED, type Project } from "./data";
import { railOrder } from "./groups";
import { Rail, ProjectList } from "./Rail";
import { ProjectPage, type Change } from "./ProjectPage";
import { Portfolio } from "./Portfolio";
import { Creator } from "./Creator";
import { Glyph } from "./bits";
import { ChevronDown, Grid, Plus, Search, X } from "./icons";
import s from "./shell.module.css";

let seq = 0;

/** Narrower than this, the project list folds to its strip unless someone opens it. */
const AUTO_FOLD = 1120;

const noSubscribe = () => () => {};
/** The one-project preview lives behind ?solo, for reviewing the first-run state. */
const readSolo = () => new URLSearchParams(window.location.search).has("solo");

export default function LivingProjectPage() {
  const [projects, setProjects] = useState<Project[]>(SEED);
  const [view, setView] = useState<string>("mara-finn"); // a project id, "all" or "new"
  // null: follow the width. true or false: the person chose.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [finding, setFinding] = useState(false);
  const soloParam = useSyncExternalStore(noSubscribe, readSolo, () => false);
  const [soloOff, setSoloOff] = useState(false);
  const solo = soloParam && !soloOff;
  const [sheet, setSheet] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const visible = solo ? projects.filter((p) => p.id === "mara-finn") : projects;
  const current = view === "all" || view === "new" ? undefined : visible.find((p) => p.id === view) ?? visible[0];
  const active = current?.id ?? view;

  const toast = (text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToastMsg({ id: ++seq, text });
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  };

  const changeFor =
    (id: string): Change =>
    (fn, note) =>
      setProjects((ps) =>
        ps.map((p) => {
          if (p.id !== id) return p;
          const next = fn(p);
          if (!note) return next === p ? p : { ...next, edited: "just now" };
          return {
            ...next,
            edited: "just now",
            activity: [{ id: `n${++seq}`, who: "orla", text: note.text, when: "just now", section: note.section }, ...next.activity],
          };
        }),
      );

  const open = (id: string) => {
    setView(id);
    setSheet(false);
  };

  // Keyboard: / find, [ collapse, N new, J/K move through the rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector("[role=dialog]")) return;
      const width = rootRef.current?.clientWidth ?? 1440;
      if (e.key === "/") {
        e.preventDefault();
        if (width < 720) setSheet(true);
        else {
          setCollapsed(false);
          setFinding(true);
        }
      } else if (e.key === "[") {
        setCollapsed((c) => !(c ?? width < AUTO_FOLD));
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setView("new");
      } else if (e.key === "j" || e.key === "k") {
        const order = railOrder(visible).filter((p) => !p.wrapped);
        const i = order.findIndex((p) => p.id === active);
        const nextIndex = e.key === "j" ? Math.min(order.length - 1, i + 1) : Math.max(0, i - 1);
        const target = i < 0 ? order[0] : order[nextIndex];
        if (target) setView(target.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, active]);

  return (
    <div className={s.root} ref={rootRef}>
      <div className={s.frame}>
        <div className={s.railSlot} data-auto={collapsed === null ? "" : undefined}>
          {collapsed !== true ? (
            <Rail
              projects={visible}
              active={active}
              onOpen={open}
              onAll={() => setView("all")}
              onNew={() => setView("new")}
              mini={false}
              onToggle={() => {
                setFinding(false);
                setCollapsed(true);
              }}
              finding={finding}
              onFinding={setFinding}
            />
          ) : null}
          {collapsed !== false ? (
            <Rail
              projects={visible}
              active={active}
              onOpen={open}
              onAll={() => setView("all")}
              onNew={() => setView("new")}
              mini
              onToggle={() => setCollapsed(false)}
              finding={false}
              onFinding={setFinding}
            />
          ) : null}
        </div>

        <div className={s.phoneBar}>
          <button type="button" className={s.switcher} onClick={() => setSheet(true)} aria-haspopup="dialog">
            {current ? (
              <Glyph p={current} size={24} />
            ) : (
              <span className={s.switcherIcon}>{view === "new" ? <Plus size={14} /> : <Grid size={14} />}</span>
            )}
            <span className={s.switcherName}>{current ? current.name : view === "new" ? "New project" : "All projects"}</span>
            <ChevronDown size={14} />
          </button>
          <button type="button" className={s.barBtn} aria-label="All projects" aria-current={view === "all" ? "page" : undefined} onClick={() => setView("all")}>
            <Grid />
          </button>
          <button type="button" className={s.barBtn} aria-label="New project" aria-current={view === "new" ? "page" : undefined} onClick={() => setView("new")}>
            <Plus />
          </button>
        </div>

        <main className={s.pane} key={view === "all" || view === "new" ? view : current?.id}>
          {view === "all" ? (
            <Portfolio projects={visible} onOpen={open} onNew={() => setView("new")} />
          ) : view === "new" ? (
            <Creator
              onCancel={() => setView(projects[0].id)}
              onCreate={(draft) => {
                const p = { ...draft, id: `new-${++seq}` };
                setProjects((ps) => [p, ...ps]);
                setSoloOff(true);
                setView(p.id);
                toast(`Created ${p.name}.`);
              }}
            />
          ) : current ? (
            <ProjectPage p={current} change={changeFor(current.id)} toast={toast} />
          ) : null}
        </main>
      </div>

      {sheet ? <SwitchSheet projects={visible} active={active} onOpen={open} onAll={() => { setView("all"); setSheet(false); }} onNew={() => { setView("new"); setSheet(false); }} onClose={() => setSheet(false)} /> : null}
      {toastMsg
        ? createPortal(
            <div key={toastMsg.id} className={s.toast} role="status">
              {toastMsg.text}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SwitchSheet({
  projects,
  active,
  onOpen,
  onAll,
  onNew,
  onClose,
}: {
  projects: Project[];
  active: string;
  onOpen: (id: string) => void;
  onAll: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className={s.scrim} onClick={onClose} aria-hidden="true" />
      <div className={s.switchSheet} role="dialog" aria-label="Switch project">
        <div className={s.sheetHead}>
          <span className={s.sheetTitle}>Projects</span>
          <button type="button" className={s.barBtn} onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <label className={s.search} data-big="">
          <Search size={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a project" aria-label="Find a project" />
        </label>
        <div className={s.sheetScroll}>
          <div className={s.railNav} data-big="">
            <button type="button" className={s.navRow} aria-current={active === "all" ? "page" : undefined} onClick={onAll}>
              <Grid />
              <span className={s.rowName}>All projects</span>
            </button>
            <button type="button" className={s.navRow} onClick={onNew}>
              <Plus />
              <span className={s.rowName}>New project</span>
            </button>
          </div>
          <ProjectList projects={projects} active={active} query={q} onOpen={onOpen} big />
        </div>
      </div>
    </>,
    document.body,
  );
}
