"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  COUNTDOWN,
  hueVar,
  INITIAL,
  newWidget,
  PROJECTS,
  projectById,
  SUGGESTIONS,
  TODAY_LINE,
  toolById,
  type GroupId,
  type ProjectId,
  type Size,
  type ToolId,
  type Widget,
} from "./data";
import type { BodyApi } from "./bodies";
import { AddCell, Dock, PageDots, Placeholder, SuggestionCell, ToolDrawer, ToolSheet, WidgetFrame, type ScreenRef } from "./parts";
import { ArrangeIcon, ChevronLeft, ChevronRight, PlusIcon } from "./glyphs";
import s from "./c1.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

/* ── phone or not: pagination depends on it, so it is decided in JS ── */

const PHONE_QUERY = "(max-width: 640px)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const usePhone = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );

/* ── pages ───────────────────────────────────────────────────────── */

const GROUPS: { id: GroupId; name: string; hue: string | null }[] = [
  { id: "all", name: "All Projects", hue: null },
  ...PROJECTS.map((p) => ({ id: p.id as GroupId, name: p.name, hue: hueVar(p.hue) })),
];
const WEIGHT: Record<Size, number> = { s: 1, m: 2, l: 4 };

type Item = { kind: "widget"; w: Widget } | { kind: "suggest"; tool: ToolId; title: string; reason: string } | { kind: "add" };
type Screen = ScreenRef & { items: Item[] };

function paginate(group: GroupId, list: Widget[], cap: number): Item[][] {
  const items: Item[] = list.map((w) => ({ kind: "widget", w }));
  if (group === "night") {
    const placed = new Set(list.map((w) => w.tool));
    for (const sg of SUGGESTIONS) if (!placed.has(sg.tool)) items.push({ kind: "suggest", ...sg });
  }
  items.push({ kind: "add" });
  const weight = (it: Item) => (it.kind === "widget" ? WEIGHT[it.w.size] : it.kind === "suggest" ? 2 : 1);
  const pages: Item[][] = [[]];
  let used = 0;
  for (const it of items) {
    const wt = weight(it);
    if (used + wt > cap && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(it);
    used += wt;
  }
  return pages;
}

function buildScreens(lists: Record<GroupId, Widget[]>, cap: number): Screen[] {
  return GROUPS.flatMap((g) => {
    const pages = paginate(g.id, lists[g.id], cap);
    return pages.map((items, i) => ({ key: `${g.id}-${i}`, group: g.id, index: i, count: pages.length, name: g.name, hue: g.hue, items }));
  });
}

type Toast = { id: number; msg: string; undo?: () => void };

/* ── the page ────────────────────────────────────────────────────── */

export default function ToolShelf() {
  const phone = usePhone();
  const cap = phone ? 6 : 16;
  const [lists, setLists] = useState<Record<GroupId, Widget[]>>(INITIAL);
  const [pos, setPos] = useState<{ group: GroupId; index: number }>({ group: "mf", index: 0 });
  const [dir, setDir] = useState(1);
  const [arranging, setArranging] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [target, setTarget] = useState<ProjectId>("mf");
  const [sheet, setSheet] = useState<Widget | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [dragTool, setDragTool] = useState<ToolId | null>(null);
  const [drop, setDrop] = useState<number | null>(null);
  const wheel = useRef({ acc: 0, lock: 0 });
  const toastTimer = useRef<number | null>(null);

  const screens = useMemo(() => buildScreens(lists, cap), [lists, cap]);
  const current = Math.max(
    0,
    screens.findIndex((sc) => sc.group === pos.group && sc.index === Math.min(pos.index, sc.count - 1)),
  );
  const screen = screens[current];
  const group = screen.group as GroupId;
  const showProject = group === "all";

  /* navigation */
  const go = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(screens.length - 1, i));
      if (n === current) return;
      setDir(n > current ? 1 : -1);
      setPos({ group: screens[n].group as GroupId, index: screens[n].index });
      if (screens[n].group !== "all") setTarget(screens[n].group as ProjectId);
    },
    [screens, current],
  );
  const goGroup = (g: GroupId) => go(screens.findIndex((sc) => sc.group === g));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [role='dialog'], [role='radiogroup']") || t.isContentEditable)) return;
      if (arranging && t?.closest("[data-wid-card]")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, current, arranging]);

  /* the shelf is live: a reply lands while you look at it */
  useEffect(() => {
    const id = window.setTimeout(() => setFlags((f) => new Set(f).add("reply-mf")), 9000);
    return () => window.clearTimeout(id);
  }, []);

  /* feedback */
  const notify = useCallback((msg: string, undo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    const id = Date.now();
    setToast({ id, msg, undo });
    toastTimer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), undo ? 6000 : 4200);
  }, []);

  const markFresh = (wids: string[]) => {
    setFresh((f) => new Set([...f, ...wids]));
    window.setTimeout(() => setFresh((f) => new Set([...f].filter((x) => !wids.includes(x)))), 900);
  };

  const api: BodyApi = useMemo(
    () => ({
      notify: (m: string) => notify(m),
      flag: (k: string) => flags.has(k),
      setFlag: (k: string) => setFlags((f) => new Set(f).add(k)),
      retry: (wid: string) => {
        const setState = (st: Widget["state"]) =>
          setLists((L) => {
            const next = { ...L };
            for (const g of Object.keys(next) as GroupId[]) next[g] = next[g].map((w) => (w.wid === wid ? { ...w, state: st } : w));
            return next;
          });
        setState("loading");
        window.setTimeout(() => setState("ok"), 1100);
      },
    }),
    [flags, notify],
  );

  /* arranging */
  const reorder = (wid: string, overWid: string) =>
    setLists((L) => {
      const list = [...L[group]];
      const from = list.findIndex((w) => w.wid === wid);
      const to = list.findIndex((w) => w.wid === overWid);
      if (from < 0 || to < 0) return L;
      const [it] = list.splice(from, 1);
      list.splice(to, 0, it);
      return { ...L, [group]: list };
    });
  const move = (wid: string, delta: -1 | 1) =>
    setLists((L) => {
      const list = [...L[group]];
      const from = list.findIndex((w) => w.wid === wid);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= list.length) return L;
      [list[from], list[to]] = [list[to], list[from]];
      return { ...L, [group]: list };
    });
  const resize = (w: Widget, size: Size) => {
    setLists((L) => {
      const next = { ...L };
      for (const g of Object.keys(next) as GroupId[]) next[g] = next[g].map((x) => (x.wid === w.wid ? { ...x, size } : x));
      return next;
    });
    setSheet((sh) => (sh && sh.wid === w.wid ? { ...sh, size } : sh));
  };
  const turnOff = (w: Widget) => {
    const before = lists;
    setLists((L) => {
      const next = { ...L };
      for (const g of Object.keys(next) as GroupId[]) next[g] = next[g].filter((x) => !(x.tool === w.tool && x.project === w.project));
      return next;
    });
    setSheet(null);
    const t = toolById(w.tool);
    notify(`${t.name} is off for ${projectById(w.project).name}. Its data is kept.`, () => setLists(before));
  };

  /* turning a tool on */
  const isOn = (tool: ToolId, project: ProjectId) => lists[project].some((w) => w.tool === tool);
  const add = (tool: ToolId, at?: number, into?: ProjectId, size?: Size) => {
    const project = into ?? (group === "all" ? target : (group as ProjectId));
    const w = newWidget(tool, project, size ?? (phone && toolById(tool).size === "l" ? "m" : undefined));
    const next = { ...lists };
    const home = [...next[project]];
    if (group === project && at !== undefined) home.splice(Math.min(at, home.length), 0, w);
    else home.push(w);
    next[project] = home;
    if (group === "all") {
      const all = [...next.all];
      if (at !== undefined) all.splice(Math.min(at, all.length), 0, { ...w });
      else all.push({ ...w });
      next.all = all;
    }
    setLists(next);
    markFresh([w.wid]);
    const shown = group === "all" ? "all" : project;
    const sc = buildScreens(next, cap).find((x) => x.group === shown && x.items.some((it) => it.kind === "widget" && it.w.wid === w.wid));
    if (sc && (sc.group !== pos.group || sc.index !== pos.index)) {
      setDir(1);
      setPos({ group: sc.group as GroupId, index: sc.index });
    }
    const t = toolById(tool);
    notify(`${t.name} is on for ${projectById(project).name}.`);
    if (phone) setDrawer(false);
  };

  /* drag from the drawer onto the page */
  const indexAt = (e: DragEvent) => {
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-wid]"))
      .find(Boolean);
    const list = screen.items.filter((it) => it.kind === "widget") as { kind: "widget"; w: Widget }[];
    if (!hit) return list.length;
    const i = list.findIndex((it) => it.w.wid === hit.dataset.wid);
    return i < 0 ? list.length : i;
  };
  const screenOffset = useMemo(() => {
    let n = 0;
    for (let i = 0; i < current; i++) if (screens[i].group === screen.group) n += screens[i].items.filter((it) => it.kind === "widget").length;
    return n;
  }, [screens, current, screen.group]);

  const onGridDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dragTool) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const i = indexAt(e);
    if (i !== drop) setDrop(i);
  };
  const onGridDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const tool = (e.dataTransfer.getData("text/plain") || dragTool) as ToolId | null;
    const at = drop ?? indexAt(e);
    setDrop(null);
    setDragTool(null);
    if (tool) add(tool, screenOffset + at);
  };

  /* swipe and trackpad */
  const onWheel = (e: React.WheelEvent) => {
    if (arranging || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const now = Date.now();
    if (now < wheel.current.lock) return;
    wheel.current.acc += e.deltaX;
    if (Math.abs(wheel.current.acc) > 120) {
      go(current + (wheel.current.acc > 0 ? 1 : -1));
      wheel.current = { acc: 0, lock: now + 650 };
    }
  };

  const mf = COUNTDOWN.mf;
  const widgetItems = screen.items;
  let wIndex = 0;
  const gridChildren: React.ReactNode[] = [];
  for (const it of widgetItems) {
    if (it.kind === "widget") {
      if (drop === wIndex && dragTool) gridChildren.push(<Placeholder key="drop" size={toolById(dragTool).size} tool={dragTool} />);
      wIndex++;
      gridChildren.push(
        <WidgetFrame
          key={it.w.wid}
          w={it.w}
          showProject={showProject}
          arranging={arranging}
          fresh={fresh.has(it.w.wid)}
          wobbleIndex={wIndex}
          api={api}
          onOpen={setSheet}
          onRemove={turnOff}
          onResize={resize}
          onReorderOver={reorder}
          onMove={move}
          onLongPress={() => setArranging(true)}
        />,
      );
    } else if (it.kind === "suggest") {
      gridChildren.push(
        <SuggestionCell
          key={`sg-${it.tool}`}
          tool={it.tool}
          title={it.title}
          reason={it.reason}
          onPlace={() => add(it.tool, undefined, "night", "m")}
        />,
      );
    } else {
      if (drop !== null && drop >= wIndex && dragTool) gridChildren.push(<Placeholder key="drop" size={toolById(dragTool).size} tool={dragTool} />);
      gridChildren.push(<AddCell key="add" open={drawer} onClick={() => setDrawer(true)} />);
    }
  }

  const isNight = group === "night";

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root}>
        <div className={cx(s.frame, drawer && !phone && s.frameWithDrawer)}>
          <main className={s.main}>
            <header className={s.header}>
              <div className={s.titles}>
                <h1 className={s.h1}>Your tools</h1>
                <p className={cx(s.dateline, s.num)}>
                  {TODAY_LINE}, {mf.days} days to Mara & Finn
                </p>
              </div>
              <div className={s.headActions}>
                <button type="button" className={cx(s.ghostBtn, arranging && s.ghostBtnOn)} aria-pressed={arranging} onClick={() => setArranging((a) => !a)}>
                  {arranging ? (
                    "Done"
                  ) : (
                    <>
                      <ArrangeIcon /> Arrange
                    </>
                  )}
                </button>
                {phone ? (
                  <button type="button" className={s.addIconBtn} onClick={() => setDrawer(true)} aria-label="Add a tool" aria-expanded={drawer}>
                    <PlusIcon />
                  </button>
                ) : (
                  <button type="button" className={s.primaryBtn} onClick={() => setDrawer((d) => !d)} aria-expanded={drawer}>
                    <PlusIcon /> Add a tool
                  </button>
                )}
              </div>
            </header>

            <div className={s.navRow}>
              <div className={s.segments} role="tablist" aria-label="Projects">
                {GROUPS.map((g) => {
                  const on = g.id === group;
                  const pages = screens.filter((sc) => sc.group === g.id).length;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      aria-controls="c1-page"
                      className={cx(s.segment, on && s.segmentOn)}
                      onClick={() => goGroup(g.id)}
                    >
                      {on && <motion.span layoutId="c1-seg" className={s.segmentPill} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                      <span className={s.segmentInner}>
                        {g.hue ? <span className={s.headDot} style={{ background: g.hue }} aria-hidden /> : null}
                        {g.name}
                        {g.id === "night" && <span className={s.newTag}>New</span>}
                        {pages > 1 && <span className={cx(s.segCount, s.num)}>{pages} pages</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={s.navEnd}>
                <PageDots screens={screens} current={current} onGo={go} />
                <div className={s.arrows}>
                  <button type="button" className={s.iconBtn} onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous page">
                    <ChevronLeft />
                  </button>
                  <button type="button" className={s.iconBtn} onClick={() => go(current + 1)} disabled={current === screens.length - 1} aria-label="Next page">
                    <ChevronRight />
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {arranging && (
                <motion.p
                  className={s.arrangeHint}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {phone
                    ? "Drag to move. The corner changes the size. The minus turns a tool off."
                    : "Drag a widget to move it, or use the arrow keys. Pull the corner to resize. The minus turns a tool off, and keeps its data."}
                </motion.p>
              )}
            </AnimatePresence>

            <section className={s.stage} id="c1-page" role="tabpanel" aria-label={`${screen.name}${screen.count > 1 ? `, page ${screen.index + 1} of ${screen.count}` : ""}`} onWheel={onWheel}>
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={screen.key}
                  className={s.page}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ x: `${d * 104}%`, opacity: 0.4 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: `${d * -104}%`, opacity: 0.4 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 34 }, opacity: { duration: 0.2 } }}
                  drag={arranging || dragTool ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  dragDirectionLock
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70 || info.velocity.x < -500) go(current + 1);
                    else if (info.offset.x > 70 || info.velocity.x > 500) go(current - 1);
                  }}
                >
                  {isNight && (
                    <div className={s.newIntro}>
                      <span className={s.newIntroTitle}>Opening night is new.</span> Start with one of these, or add any tool. You can move and resize them later.
                    </div>
                  )}
                  <LayoutGroup id={screen.key}>
                    <div
                      className={cx(s.grid, dragTool && s.gridDropping)}
                      onDragOver={onGridDragOver}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
                      }}
                      onDrop={onGridDrop}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {gridChildren}
                      </AnimatePresence>
                    </div>
                  </LayoutGroup>
                </motion.div>
              </AnimatePresence>
            </section>

            <div className={s.bottom}>
              <div className={s.dotsBottom}>
                <PageDots screens={screens} current={current} onGo={go} />
              </div>
              <Dock />
              <div className={s.toastRegion} aria-live="polite">
                <AnimatePresence>
                  {toast && (
                    <motion.div
                      key={toast.id}
                      className={s.toast}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span>{toast.msg}</span>
                      {toast.undo && (
                        <button
                          type="button"
                          className={s.toastUndo}
                          onClick={() => {
                            toast.undo?.();
                            setToast(null);
                          }}
                        >
                          Undo
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </main>

          <AnimatePresence>
            {drawer && (
              <ToolDrawer
                key="drawer"
                phone={phone}
                target={group === "all" ? target : (group as ProjectId)}
                fromAll={group === "all"}
                onTarget={setTarget}
                isOn={isOn}
                onAdd={(t) => add(t)}
                onClose={() => {
                  setDrawer(false);
                  setDragTool(null);
                  setDrop(null);
                }}
                onDragTool={(t) => {
                  setDragTool(t);
                  if (!t) setDrop(null);
                }}
              />
            )}
          </AnimatePresence>
        </div>


        <AnimatePresence>
          {sheet && (
            <ToolSheet
              key="sheet"
              w={sheet}
              phone={phone}
              api={api}
              onClose={() => setSheet(null)}
              onTurnOff={turnOff}
              onResize={resize}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
