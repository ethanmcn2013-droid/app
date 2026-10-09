"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { projectById, TEAM } from "./data";
import {
  allUnder,
  baseAssign,
  buildView,
  columnName,
  diffMoves,
  OTHER_TEAMS,
  PROJECT_OPTIONS,
  projectName,
  proposeBalance,
  SCENARIOS,
  summarize,
  teamLine,
  type Assign,
  type ColumnVM,
  type Mode,
  type ProjectFilter,
  type Proposal,
  type ScenarioId,
  type TileVM,
} from "./model";
import { Shelves } from "./shelves";
import { PersonPanel, SelectedTask } from "./panel";
import { PhoneRows } from "./phone";
import {
  ArrowIcon,
  BalanceIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  HandIcon,
  hueVar,
  MoveMenu,
  tileLabel,
  UndoIcon,
  type MenuState,
} from "./bits";
import styles from "./c3.module.css";

/* ── phone or not: decided in JS so the moving tiles exist only once ── */

const PHONE_QUERY = "(max-width: 720px)";
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

/* ── the Project picker ────────────────────────────────────────────── */

function ProjectPicker({ value, onChange }: { value: ProjectFilter; onChange: (p: ProjectFilter) => void }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };
  const hue = value === "all" ? null : projectById(value).hue;
  return (
    <div className={styles.picker}>
      <button
        ref={btnRef}
        type="button"
        className={styles.pickerButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>("[aria-selected='true']")?.focus());
        }}
      >
        {hue ? <span className={styles.pickerSwatch} style={{ background: hueVar(hue) }} /> : <span className={styles.pickerAll} aria-hidden />}
        <span>{projectName(value)}</span>
        <ChevronIcon />
      </button>
      {open && (
        <>
          <div className={styles.menuScrim} onClick={() => setOpen(false)} aria-hidden />
          <ul ref={listRef} className={styles.pickerList} role="listbox" aria-label="Project" onKeyDown={onKey}>
            {PROJECT_OPTIONS.map((id) => {
              const p = id === "all" ? null : projectById(id);
              return (
                <li key={id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === id}
                    className={styles.pickerOption}
                    onClick={() => {
                      onChange(id);
                      close();
                    }}
                  >
                    {p ? <span className={styles.pickerSwatch} style={{ background: hueVar(p.hue) }} /> : <span className={styles.pickerAll} aria-hidden />}
                    <span className={styles.pickerName}>{projectName(id)}</span>
                    <span className={styles.pickerKind}>{p ? p.kind : "The Orchard and Mara & Finn"}</span>
                    {value === id && (
                      <span className={styles.pickerCheck}>
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={styles.segment}
          onClick={() => onChange(o.id)}
        >
          {value === o.id && <motion.span layoutId={`seg-${label}`} className={styles.segmentPill} transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          <span className={styles.segmentText}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ── the page ──────────────────────────────────────────────────────── */

export default function WhoNeedsAHand() {
  const phone = usePhone();
  const [scenarioId, setScenarioId] = useState<ScenarioId>("team");
  const scenario = SCENARIOS[scenarioId];
  const [project, setProject] = useState<ProjectFilter>("all");
  const [mode, setMode] = useState<Mode>("three");
  const [base, setBase] = useState<Assign>(() => baseAssign(SCENARIOS.team));
  const [cur, setCur] = useState<Assign>(() => baseAssign(SCENARIOS.team));
  const [pickedCol, setPickedCol] = useState<string | null>(null);
  const [pickedTile, setPickedTile] = useState<string | null>(null);
  const [dragTile, setDragTile] = useState<TileVM | null>(null);
  const [trayOver, setTrayOver] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [celebrate, setCelebrate] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  const [live, setLive] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);
  const [movesOpen, setMovesOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = useMemo(() => buildView(scenario, cur, mode, project), [scenario, cur, mode, project]);
  const moves = useMemo(() => diffMoves(scenario, base, cur), [scenario, base, cur]);
  const assignedCount = view.columns.reduce((n, c) => n + c.count, 0);
  const good = allUnder(view) && view.tray.length <= assignedCount;
  const summary = summarize(scenario, view, mode, moves.length);
  const viewKey = `${scenarioId}-${project}-${mode}`;
  const solo = scenarioId === "solo";
  const empty = scenarioId === "empty";

  const defaultCol = useMemo(() => {
    const overs = [...view.columns].sort((a, b) => b.over - a.over);
    return overs[0]?.id ?? null;
  }, [view]);
  const selectedCol = view.columns.find((c) => c.id === pickedCol) ?? view.columns.find((c) => c.id === defaultCol) ?? view.columns[0];
  const allTiles = [...view.columns.flatMap((c) => c.tiles), ...view.tray];
  const selectedTile = allTiles.find((t) => t.key === pickedTile) ?? null;
  const menuTile = menu ? allTiles.find((t) => t.key === menu.tileKey) ?? null : null;

  /* ── changing who has what ─────────────────────────────────────── */

  const say = (text: string) => setLive(text);
  const showToast = (text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ n: Date.now(), text });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };

  const commit = (next: Assign, message: string) => {
    const after = buildView(scenario, next, mode, project);
    const afterAssigned = after.columns.reduce((n, c) => n + c.count, 0);
    if (!good && allUnder(after) && after.tray.length <= afterAssigned) setCelebrate((c) => c + 1);
    setCur(next);
    say(message);
  };

  const withMove = (from: Assign, taskId: string, slot: number, to: string | null) => {
    const arr = [...(from[taskId] ?? [])];
    arr[slot] = to;
    return { ...from, [taskId]: arr };
  };

  const moveTile = (tile: TileVM, to: string | null, refocus = false) => {
    setProposals(null);
    setBalanceNote("");
    commit(withMove(cur, tile.task.id, tile.slot, to), `${tile.task.title} moved to ${columnName(scenario, to)}.`);
    if (to) setPickedCol(to);
    if (refocus) {
      setTimeout(() => document.querySelector<HTMLElement>(`[data-tile="${tile.key}"]`)?.focus(), 420);
    }
  };

  const accept = (p: Proposal) => {
    const rest = (proposals ?? []).filter((x) => x.key !== p.key);
    setProposals(rest.length ? rest : null);
    if (!rest.length) setBalanceNote("");
    const task = scenario.tasks.find((t) => t.id === p.taskId)!;
    commit(withMove(cur, p.taskId, p.slot, p.to), `${task.title} moved to ${columnName(scenario, p.to)}.`);
  };

  const acceptAll = () => {
    let next = cur;
    for (const p of proposals ?? []) next = withMove(next, p.taskId, p.slot, p.to);
    const n = proposals?.length ?? 0;
    setProposals(null);
    setBalanceNote("");
    commit(next, `${n} suggested ${n === 1 ? "move" : "moves"} accepted.`);
  };

  const balance = () => {
    if (proposals) {
      setProposals(null);
      setBalanceNote("");
      return;
    }
    const r = proposeBalance(scenario, view, cur);
    const n = r.proposals.length;
    let note: string;
    if (!n) {
      note = "Nobody has room for more without going past their own usual pace.";
    } else if (solo) {
      note = r.leftover.length
        ? `${n} ${n === 1 ? "move helps" : "moves help"}, but every week is already close to full.`
        : `${n} ${n === 1 ? "move makes" : "moves make"} every week workable. The latest things in a full week move to the week with the most room.`;
    } else if (empty) {
      note = `${n} tasks handed out by who has room, only to people on each task's Project.`;
    } else {
      note = r.leftover.length
        ? `${n} ${n === 1 ? "move helps" : "moves help"}, but ${r.leftover.map((l) => `${l.name} would still be ${l.over} over`).join(" and ")}. That may need a later date, or fewer things.`
        : `${n} ${n === 1 ? "move brings" : "moves bring"} everyone under their line. Latest-due things move first, only to people on that Project.`;
      if (r.skippedNew.length) note += ` ${r.skippedNew.join(" and ")} has no usual pace yet, so nothing went their way.`;
    }
    setBalanceNote(note);
    setProposals(n ? r.proposals : null);
    say(note);
  };

  const undoAll = () => {
    setCur(base);
    setProposals(null);
    setBalanceNote("");
    setMovesOpen(false);
    say("All moves undone.");
  };

  const undoOne = (taskId: string, slot: number) => {
    const b = base[taskId]?.[slot] ?? null;
    setCur(withMove(cur, taskId, slot, b));
    say("Move undone.");
  };

  const apply = () => {
    const n = moves.length;
    setBase(cur);
    setMovesOpen(false);
    showToast(`${n} ${n === 1 ? "move" : "moves"} applied on the board. This is a preview, so nothing there has changed.`);
  };

  const switchScenario = (id: ScenarioId) => {
    const s = SCENARIOS[id];
    setScenarioId(id);
    setBase(baseAssign(s));
    setCur(baseAssign(s));
    setProject("all");
    setMode("three");
    setProposals(null);
    setBalanceNote("");
    setPickedCol(null);
    setPickedTile(null);
    setSheet(null);
  };

  const switchProject = (p: ProjectFilter) => {
    setProject(p);
    setProposals(null);
    setBalanceNote("");
    setPickedCol(null);
    setPickedTile(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setProposals(null);
    setBalanceNote("");
  };

  /* ── tiles: select, keyboard, drag ─────────────────────────────── */

  const selectTile = (t: TileVM, colId: string | null) => {
    setPickedTile((k) => (k === t.key ? null : t.key));
    if (colId) setPickedCol(colId);
  };

  const openMenu = (t: TileVM, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPickedTile(t.key);
    setMenu({ tileKey: t.key, x: r.left, y: r.bottom + 6, returnFocus: t.key });
  };

  const onTileKey = (e: KeyboardEvent<HTMLButtonElement>, t: TileVM) => {
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      openMenu(t, e.currentTarget);
    } else if (e.key === "Escape") {
      setPickedTile(null);
    }
  };

  const closeMenu = () => {
    const key = menu?.returnFocus;
    setMenu(null);
    if (key) setTimeout(() => document.querySelector<HTMLElement>(`[data-tile="${key}"]`)?.focus(), 0);
  };

  const pickFromMenu = (to: string | null) => {
    if (!menuTile) return;
    const t = menuTile;
    setMenu(null);
    moveTile(t, to, true);
  };

  const onDrop = (to: string | null) => {
    if (dragTile) moveTile(dragTile, to);
    setDragTile(null);
  };

  /* ── pieces ────────────────────────────────────────────────────── */

  const balanceLabel = empty ? "Hand them out for me" : "Balance it for me";
  const workable = solo ? "Every week looks workable." : mode === "week" ? "Everyone has a workable week." : "Everyone has a workable few weeks.";

  const legend = (
    <ul className={styles.legend} aria-label="Key">
      {(solo ? [] : view.projectsInView).map((id) => (
        <li key={id} className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: hueVar(projectById(id).hue) }} />
          {projectById(id).name}
        </li>
      ))}
      {view.columns.some((c) => c.tiles.some((t) => t.muted)) && (
        <li className={styles.legendItem}>
          <span className={styles.swatchMuted} />
          Other Projects
        </li>
      )}
      <li className={styles.legendItem}>
        <span className={styles.legendLine} />
        {solo ? "Your usual week" : "Their usual pace"}
      </li>
      <li className={styles.legendItem}>
        <span className={styles.legendLate}>!</span>
        Past its date
      </li>
      {!solo && (
        <li className={styles.legendItem}>
          <span className={styles.legendShared}>O</span>
          Shared
        </li>
      )}
    </ul>
  );

  const tray = !solo && (
    <section
      className={styles.tray}
      data-big={empty || undefined}
      data-drop={dragTile && !view.tray.some((t) => t.key === dragTile.key) ? (trayOver ? "here" : "ok") : undefined}
      aria-labelledby="c3-tray"
      onDragOver={(e: DragEvent) => {
        if (dragTile && !view.tray.some((t) => t.key === dragTile.key)) {
          e.preventDefault();
          if (!trayOver) setTrayOver(true);
        }
      }}
      onDragLeave={() => setTrayOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setTrayOver(false);
        onDrop(null);
      }}
    >
      <div className={styles.trayHead}>
        <h2 id="c3-tray" className={styles.trayTitle}>
          Nobody has these <span className={styles.trayCount}>{view.tray.length}</span>
        </h2>
        <p className={styles.traySub}>
          {view.tray.length
            ? phone
              ? "Tap Move to hand one to someone."
              : "Drag one onto a person, or select it and press M."
            : "Everything has an owner. Drag a tile here to take it off someone."}
        </p>
      </div>
      {view.tray.length > 0 && (
        <div className={styles.trayTiles}>
          {view.tray.map((t) =>
            phone ? (
              <div key={t.key} className={styles.trayRow}>
                <span className={styles.swatch} style={{ background: hueVar(projectById(t.task.project).hue) }} />
                <span className={styles.trayRowTitle}>{t.task.title}</span>
                <button type="button" className={styles.upMove} onClick={(e) => openMenu(t, e.currentTarget)} aria-label={`Move ${t.task.title}`}>
                  Move
                </button>
              </div>
            ) : (
              <motion.div key={t.key} layout="position" layoutId={t.key} className={styles.trayTileWrap} transition={{ layout: { type: "spring", stiffness: 430, damping: 36 } }}>
                <button
                  type="button"
                  data-tile={t.key}
                  draggable
                  className={styles.tile}
                  data-tray
                  data-selected={pickedTile === t.key || undefined}
                  style={{ ["--tile" as string]: hueVar(projectById(t.task.project).hue) }}
                  aria-label={tileLabel(t, null)}
                  aria-pressed={pickedTile === t.key}
                  onClick={() => selectTile(t, null)}
                  onKeyDown={(e) => onTileKey(e, t)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.task.title);
                    setDragTile(t);
                  }}
                  onDragEnd={() => setDragTile(null)}
                >
                  <span className={styles.tileTitle}>{t.task.title}</span>
                  <span className={styles.tileDue} aria-hidden>
                    {t.due.slice(8, 10).replace(/^0/, "")} {t.due.slice(5, 7) === "09" ? "Sep" : "Oct"}
                  </span>
                </button>
              </motion.div>
            ),
          )}
        </div>
      )}
    </section>
  );

  const others =
    scenarioId === "team" && project === "all" ? (
      <section className={styles.others} aria-labelledby="c3-others">
        <h2 id="c3-others" className={styles.othersTitle}>
          Other teams
        </h2>
        <div className={styles.othersGrid}>
          {OTHER_TEAMS.map((id) => {
            const { view: v, line } = teamLine(TEAM, id);
            const p = projectById(id);
            return (
              <button key={id} type="button" className={styles.otherCard} onClick={() => switchProject(id)}>
                <span className={styles.otherTop}>
                  <span className={styles.pickerSwatch} style={{ background: hueVar(p.hue) }} />
                  <span className={styles.otherName}>{p.name}</span>
                  <span className={styles.otherKind}>
                    {v.columns.length} people · {p.kind}
                  </span>
                </span>
                <span className={styles.otherBody}>
                  <span className={styles.mini} aria-hidden>
                    {v.columns.map((c) => (
                      <span key={c.id} className={styles.miniCol}>
                        <span className={styles.miniStack}>
                          {Array.from({ length: c.count }, (_, k) => (
                            <span
                              key={k}
                              className={styles.miniBlock}
                              data-over={c.usual !== null && k >= c.usual ? true : undefined}
                              style={{ ["--tile" as string]: hueVar(p.hue) }}
                            />
                          ))}
                          {c.usual !== null && <span className={styles.miniTick} style={{ bottom: c.usual * 5 - 1 }} />}
                        </span>
                        <span className={styles.miniName}>{c.title[0]}</span>
                      </span>
                    ))}
                  </span>
                  <span className={styles.otherText}>
                    <span className={styles.otherLine}>{line}</span>
                    <span className={styles.otherOpen}>
                      Open {p.name} <ArrowIcon size={12} />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    ) : null;

  const sheetCol = sheet ? view.columns.find((c) => c.id === sheet) ?? null : null;

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <div className={styles.root}>
          <div className={styles.inner}>
            <header className={styles.header}>
              <div className={styles.titles}>
                <p className={styles.eyebrow}>
                  Analytics · {mode === "week" && !solo ? "21 to 27 Sep" : "21 Sep to 11 Oct"}
                </p>
                <h1 className={styles.h1}>{solo ? "Your next three weeks" : "Who needs a hand"}</h1>
              </div>
              <div className={styles.controls}>
                {scenarioId === "team" && <ProjectPicker value={project} onChange={switchProject} />}
                {!solo && (
                  <Segmented
                    label="Period"
                    value={mode}
                    onChange={switchMode}
                    options={[
                      { id: "week", label: "This week" },
                      { id: "three", label: "Next 3 weeks" },
                    ]}
                  />
                )}
              </div>
            </header>

            <p className={styles.summary}>
              <span className={styles.summaryLead}>{summary.lead}</span> {summary.rest}
            </p>

            <div className={styles.layout}>
              <div className={styles.main}>
                {empty && tray}

                <section className={styles.card} aria-label={solo ? "Your weeks" : "Everyone's coming weeks"}>
                  <div className={styles.cardTop}>
                    {legend}
                    <button
                      type="button"
                      className={styles.balance}
                      data-on={proposals ? true : undefined}
                      onClick={balance}
                      aria-pressed={!!proposals}
                    >
                      {empty ? <HandIcon size={15} /> : <BalanceIcon />}
                      {proposals ? "Hide suggestions" : balanceLabel}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {balanceNote && (
                      <motion.div
                        key="note"
                        className={styles.proposalBar}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div className={styles.proposalInner}>
                          <p className={styles.proposalText}>{balanceNote}</p>
                          {proposals && (
                            <div className={styles.proposalActions}>
                              <button type="button" className={styles.buttonPrimary} onClick={acceptAll}>
                                Accept all {proposals.length}
                              </button>
                              <button
                                type="button"
                                className={styles.button}
                                onClick={() => {
                                  setProposals(null);
                                  setBalanceNote("");
                                }}
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                          {!proposals && (
                            <button type="button" className={styles.iconButton} onClick={() => setBalanceNote("")} aria-label="Dismiss">
                              <CloseIcon size={12} />
                            </button>
                          )}
                        </div>
                        {proposals && !phone && <p className={styles.proposalHint}>Each dashed tile is a suggestion. Select one to accept just that move.</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {good && (
                      <motion.p
                        key={`good-${celebrate}`}
                        className={styles.workable}
                        data-fresh={celebrate > 0 || undefined}
                        initial={celebrate > 0 ? { opacity: 0, y: 6 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, delay: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                        role="status"
                      >
                        <span className={styles.workableIcon}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <path className={styles.workableTick} d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {workable}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {phone ? (
                    <PhoneRows
                      scenario={scenario}
                      view={view}
                      proposals={proposals ?? []}
                      allGood={good}
                      onOpen={(c: ColumnVM) => {
                        setPickedCol(c.id);
                        setSheet(c.id);
                      }}
                      onAccept={accept}
                    />
                  ) : (
                    <Shelves
                      scenario={scenario}
                      view={view}
                      assign={cur}
                      selectedCol={selectedCol?.id ?? null}
                      selectedTile={pickedTile}
                      dragTile={dragTile}
                      proposals={proposals ?? []}
                      allGood={good}
                      celebrate={celebrate > 0 && good}
                      viewKey={viewKey}
                      h={{
                        onSelectCol: (id) => setPickedCol(id),
                        onSelectTile: (t, colId) => selectTile(t, colId),
                        onTileKey,
                        onDragStart: (t) => setDragTile(t),
                        onDragEnd: () => setDragTile(null),
                        onDrop,
                        onAccept: accept,
                      }}
                    />
                  )}
                  {solo && <p className={styles.cardFoot}>Moving a task to another week moves its date by a week, to the same weekday.</p>}
                </section>

                {!empty && tray}
                {others}

                <AnimatePresence>
                  {moves.length > 0 && (
                    <motion.div
                      className={styles.pending}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    >
                      {movesOpen && (
                        <ul className={styles.movesList} aria-label="Moves ready to apply">
                          {moves.map((m) => (
                            <li key={`${m.taskId}:${m.slot}`} className={styles.moveItem}>
                              <span className={styles.moveText}>
                                <span className={styles.moveTitle}>{m.title}</span>
                                <span className={styles.moveMeta}>
                                  {columnName(scenario, m.from)} <ArrowIcon size={11} /> {columnName(scenario, m.to)}
                                </span>
                              </span>
                              <button type="button" className={styles.iconButton} onClick={() => undoOne(m.taskId, m.slot)} aria-label={`Undo moving ${m.title}`}>
                                <UndoIcon />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className={styles.pendingBar}>
                        <button type="button" className={styles.pendingCount} onClick={() => setMovesOpen((o) => !o)} aria-expanded={movesOpen}>
                          <span className={styles.pendingBadge}>{moves.length}</span>
                          {moves.length === 1 ? "move" : "moves"} ready
                          <ChevronIcon size={12} />
                        </button>
                        <span className={styles.pendingSpacer} />
                        <button type="button" className={styles.pendingGhost} onClick={undoAll}>
                          Undo all
                        </button>
                        <button type="button" className={styles.pendingApply} onClick={apply}>
                          Apply on the board
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <footer className={styles.situations}>
                  <span className={styles.situationsLabel}>See this page for</span>
                  <Segmented
                    label="Situation"
                    value={scenarioId}
                    onChange={switchScenario}
                    options={[
                      { id: "team", label: "A team" },
                      { id: "solo", label: "Just you" },
                      { id: "empty", label: "Nothing handed out" },
                    ]}
                  />
                </footer>
              </div>

              {!phone && selectedCol && (
                <aside className={styles.aside} aria-label="Details">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {selectedTile && (
                      <motion.div
                        key={selectedTile.key}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <SelectedTask
                          scenario={scenario}
                          assign={cur}
                          tile={selectedTile}
                          columns={view.columns}
                          onMove={(to) => moveTile(selectedTile, to)}
                          onClear={() => setPickedTile(null)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <PersonPanel
                    key={selectedCol.id}
                    scenario={scenario}
                    col={selectedCol}
                    mode={mode}
                    selectedTile={pickedTile}
                    onSelectTile={(t) => selectTile(t, null)}
                    onMoveMenu={(t, e: MouseEvent<HTMLButtonElement>) => openMenu(t, e.currentTarget)}
                  />
                </aside>
              )}
            </div>
          </div>

          <AnimatePresence>
            {phone && sheetCol && (
              <>
                <motion.div
                  key="scrim"
                  className={styles.sheetScrim}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSheet(null)}
                />
                <motion.div
                  key="sheet"
                  className={styles.sheet}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${sheetCol.title} details`}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                >
                  <span className={styles.sheetGrip} aria-hidden />
                  <PersonPanel
                    scenario={scenario}
                    col={sheetCol}
                    mode={mode}
                    selectedTile={pickedTile}
                    onSelectTile={(t) => selectTile(t, null)}
                    onMoveMenu={(t, e) => openMenu(t, e.currentTarget)}
                    onClose={() => setSheet(null)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {menu && menuTile && (
            <MoveMenu
              scenario={scenario}
              assign={cur}
              tile={menuTile}
              columns={view.columns}
              x={menu.x}
              y={menu.y}
              onPick={pickFromMenu}
              onClose={closeMenu}
            />
          )}

          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.n}
                className={styles.toast}
                role="status"
                initial={{ opacity: 0, y: 12, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{ opacity: 0, y: 12, x: "-50%" }}
              >
                <span className={styles.toastIcon}>
                  <CheckIcon />
                </span>
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>

          <p className={styles.srOnly} aria-live="polite">
            {live}
          </p>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}

