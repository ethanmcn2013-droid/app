"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, LayoutGroup, motion, MotionConfig, useReducedMotion } from "motion/react";
import { daysFromToday, formatDay, makeDocs, PEOPLE, type Doc, type PersonId } from "./data";
import {
  ancestors,
  indent as indentOp,
  insert,
  move as moveOp,
  newId,
  outdent as outdentOp,
  remove,
  rollup,
  setField,
  toggle as toggleOp,
  type Nodes,
} from "./tree";
import { Branch, OutlineProvider, type OutlineCtx, type Picker } from "./Outline";
import { DatePicker, EditToolbar, KeySheet, Minimap, PersonPicker, RollupBar, Switcher } from "./Chrome";
import { Avatar, Icon } from "./glyphs";
import s from "./outline.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;
type Key = Doc["key"];

/* Branches that start folded so the first screen shows every state. */
const START_FOLDED = new Set(["Invitations", "Ceilidh band", "Cake", "Legal and admin", "Dietary list", "Thank-you cards"]);

const PHONE = "(max-width: 720px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Toast = { id: number; text: string; undo?: boolean };

export default function LivingOutline() {
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const reduce = useReducedMotion();

  const [docs, setDocs] = useState(makeDocs);
  const [active, setActive] = useState<Key>("wedding");
  const [zooms, setZooms] = useState<Record<Key, string>>({ wedding: docs.wedding.rootId, hydrology: docs.hydrology.rootId });
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [hideDone, setHideDone] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [wave, setWave] = useState<OutlineCtx["wave"]>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [history, setHistory] = useState<{ key: Key; nodes: Nodes }[]>([]);
  const [keysOpen, setKeysOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const structural = useRef(false);
  const toastSeq = useRef(0);
  const waveSeq = useRef(0);

  const doc = docs[active];
  const nodes = doc.nodes;
  const zoom = zooms[active];
  const stats = useMemo(() => rollup(nodes, doc.rootId), [nodes, doc.rootId]);

  /* ── Open / visible ──────────────────────────────────────────────── */

  const isOpen = (id: string) => openMap[id] ?? (!stats[id].complete && !START_FOLDED.has(nodes[id].title));
  const canExpand = (_id: string, depth: number) => !isPhone || depth < 2;

  const visible: string[] = [];
  const walk = (id: string, depth: number) => {
    for (const k of nodes[id].children) {
      if (hideDone && stats[k].complete) continue;
      visible.push(k);
      if (nodes[k].children.length && canExpand(k, depth) && isOpen(k)) walk(k, depth + 1);
    }
  };
  walk(zoom, 0);
  const visibleSet = new Set(visible);

  /* ── Mutations ───────────────────────────────────────────────────── */

  const commit = (next: Nodes) => {
    setHistory((h) => [...h.slice(-40), { key: active, nodes }]);
    setDocs((d) => ({ ...d, [active]: { ...d[active], nodes: next } }));
  };
  const say = (text: string, undo = false) => {
    toastSeq.current += 1;
    const t = { id: toastSeq.current, text, undo };
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), 4200);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setDocs((d) => ({ ...d, [last.key]: { ...d[last.key], nodes: last.nodes } }));
    setEditing(null);
    say("Undone");
  };
  const markStructural = () => {
    structural.current = true;
    window.setTimeout(() => {
      structural.current = false;
    }, 150);
  };

  const toggleDone = (id: string) => {
    const was = stats[id].complete;
    const next = toggleOp(nodes, id, was);
    const chain = ancestors(nodes, id).filter((a) => a !== doc.rootId);
    const order: Record<string, number> = { [id]: 0 };
    chain.forEach((a, i) => (order[a] = reduce ? 0 : (i + 1) * 170));
    waveSeq.current += 1;
    setWave({ key: waveSeq.current, order });
    // Keep the branches you are looking at open while their rings fill.
    const pinned: Record<string, boolean> = {};
    for (const a of chain) if (isOpen(a)) pinned[a] = true;
    setOpenMap((m) => ({ ...m, ...pinned }));
    commit(next);
    if (!was) {
      // The highest branch this tick finished folds to a single line once its ring has pulsed.
      const after = rollup(next, doc.rootId);
      const finished = chain.filter((a) => a !== zoom && after[a].complete && !stats[a].complete && ancestors(next, a).includes(zoom));
      const top = finished[finished.length - 1];
      if (top) {
        const wait = reduce ? 500 : (order[top] ?? 0) + 1300;
        window.setTimeout(() => setOpenMap((m) => ({ ...m, [top]: false })), wait);
        window.setTimeout(() => say(`${nodes[top].title} is all done`), wait);
      }
    }
  };

  const zoomTo = (id: string) => {
    setZooms((z) => ({ ...z, [active]: id }));
    setEditing(null);
    setPicker(null);
    setCursor(null);
    scroller.current?.scrollTo({ top: 0 });
  };

  const openAncestors = (id: string) => {
    const patch: Record<string, boolean> = {};
    for (const a of ancestors(nodes, id)) {
      if (a === zoom) break;
      patch[a] = true;
    }
    setOpenMap((m) => ({ ...m, ...patch }));
  };

  const reveal = (id: string, flashIt = false) => {
    window.requestAnimationFrame(() =>
      window.setTimeout(() => {
        const el = scroller.current?.querySelector(`[data-line="${id}"]`);
        el?.scrollIntoView({ block: flashIt ? "center" : "nearest", behavior: reduce ? "auto" : "smooth" });
      }, flashIt ? 260 : 0),
    );
    if (flashIt) {
      setFlash(id);
      window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400);
    }
  };

  const jump = (id: string) => {
    openAncestors(id);
    setCursor(id);
    if (hideDone && stats[id].complete) setHideDone(false);
    reveal(id, true);
  };

  const doIndent = (id: string) => {
    const r = indentOp(nodes, id);
    if (!r) return;
    markStructural();
    setOpenMap((m) => ({ ...m, [r.newParent]: true }));
    commit(r.nodes);
  };
  const doOutdent = (id: string) => {
    const r = outdentOp(nodes, id, zoom);
    if (!r) return;
    markStructural();
    commit(r);
  };
  const doMove = (id: string, dir: -1 | 1) => {
    const r = moveOp(nodes, id, dir);
    if (!r) return;
    markStructural();
    commit(r);
  };
  const addAfter = (id: string) => {
    const n = nodes[id];
    const nid = newId();
    let next: Nodes;
    if (n.children.length && isOpen(id)) next = insert(nodes, id, 0, nid);
    else {
      const p = n.parent!;
      next = insert(nodes, p, nodes[p].children.indexOf(id) + 1, nid);
    }
    markStructural();
    commit(next);
    setFresh(nid);
    setEditing(nid);
    setCursor(nid);
  };
  const addChildEnd = (parent: string, title = "") => {
    const nid = newId();
    commit(insert(nodes, parent, nodes[parent].children.length, nid, title));
    if (parent !== zoom) setOpenMap((m) => ({ ...m, [parent]: true }));
    setFresh(title ? null : nid);
    setEditing(title ? null : nid);
    setCursor(nid);
    return nid;
  };
  const deleteLine = (id: string, quiet = false) => {
    const idx = visible.indexOf(id);
    markStructural();
    commit(remove(nodes, id));
    const prev = visible[idx - 1] ?? null;
    setCursor(prev);
    if (!quiet) say(`Deleted “${nodes[id].title || "Untitled"}”`, true);
    return prev;
  };

  /* ── Editing keys ────────────────────────────────────────────────── */

  const onEditKey = (e: ReactKeyboardEvent<HTMLInputElement>, id: string) => {
    const n = nodes[id];
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Enter" && mod) {
      e.preventDefault();
      if (!n.children.length) toggleDone(id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!n.title.trim()) return;
      addAfter(id);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) doOutdent(id);
      else doIndent(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
      setCursor(id);
    } else if (e.key === "Backspace" && n.title === "" && !n.children.length) {
      e.preventDefault();
      const prev = deleteLine(id, true);
      setEditing(prev);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      doMove(id, e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const i = visible.indexOf(id) + (e.key === "ArrowUp" ? -1 : 1);
      if (visible[i]) {
        e.preventDefault();
        setEditing(visible[i]);
        setCursor(visible[i]);
      }
    }
  };

  const onBlurEdit = (id: string) => {
    if (structural.current) return;
    if (picker?.id === id) return;
    if (fresh === id && !nodes[id]?.title.trim()) {
      setDocs((d) => ({ ...d, [active]: { ...d[active], nodes: remove(d[active].nodes, id) } }));
      setFresh(null);
    }
    setEditing((cur) => (cur === id ? null : cur));
  };

  /* ── Global keys (read the latest render through a ref) ──────────── */

  const onGlobalKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (mod) return;
    const cur = cursor && visibleSet.has(cursor) ? cursor : null;
    const go = (id: string | undefined) => {
      if (!id) return;
      setCursor(id);
      reveal(id);
    };
    switch (e.key) {
      case "ArrowDown":
      case "j":
        e.preventDefault();
        if (e.altKey && cur) doMove(cur, 1);
        else go(cur ? visible[visible.indexOf(cur) + 1] : visible[0]);
        break;
      case "ArrowUp":
      case "k":
        e.preventDefault();
        if (e.altKey && cur) doMove(cur, -1);
        else go(cur ? visible[visible.indexOf(cur) - 1] : visible[visible.length - 1]);
        break;
      case "ArrowRight":
        if (!cur || !nodes[cur].children.length) break;
        e.preventDefault();
        if (!isOpen(cur)) setOpenMap((m) => ({ ...m, [cur]: true }));
        else go(nodes[cur].children[0]);
        break;
      case "ArrowLeft":
        if (!cur) break;
        e.preventDefault();
        if (nodes[cur].children.length && isOpen(cur)) setOpenMap((m) => ({ ...m, [cur]: false }));
        else if (nodes[cur].parent && nodes[cur].parent !== zoom) go(nodes[cur].parent!);
        break;
      case "Enter":
        if (!cur) break;
        e.preventDefault();
        setEditing(cur);
        break;
      case " ":
      case "x":
        if (!cur) break;
        e.preventDefault();
        toggleDone(cur);
        break;
      case "Tab":
        if (!cur) break;
        e.preventDefault();
        if (e.shiftKey) doOutdent(cur);
        else doIndent(cur);
        break;
      case "z":
        if (!cur) break;
        e.preventDefault();
        zoomTo(cur);
        break;
      case "Escape":
        if (picker || keysOpen || switchOpen) {
          setPicker(null);
          setKeysOpen(false);
          setSwitchOpen(false);
        } else if (nodes[zoom].parent) {
          const back = zoom;
          zoomTo(nodes[zoom].parent!);
          setCursor(back);
        }
        break;
      case "h":
        setHideDone((v) => !v);
        break;
      case "?":
        setKeysOpen((v) => !v);
        break;
      case "Backspace":
      case "Delete":
        if (cur) deleteLine(cur);
        break;
    }
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => onGlobalKey(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  /* ── Pickers ─────────────────────────────────────────────────────── */

  const pickDate = (id: string, iso: string | undefined) => {
    commit(setField(nodes, id, { due: iso }));
    setPicker(null);
  };
  const pickPerson = (id: string, p: PersonId | undefined) => {
    commit(setField(nodes, id, { owner: p }));
    setPicker(null);
  };
  const renderPicker = (id: string, sheet = false) =>
    picker?.kind === "date" ? (
      <DatePicker current={nodes[id].due} eventDay={doc.eventDay} onPick={(iso) => pickDate(id, iso)} sheet={sheet} />
    ) : picker?.kind === "person" ? (
      <PersonPicker current={nodes[id].owner} people={doc.people} onPick={(p) => pickPerson(id, p)} sheet={sheet} />
    ) : null;

  /* ── Header facts ────────────────────────────────────────────────── */

  const zst = stats[zoom];
  const zn = nodes[zoom];
  const trail = ancestors(nodes, zoom).reverse();
  const toGo = daysFromToday(doc.eventDay);
  const facepile = doc.people;

  const ctx: OutlineCtx = {
    nodes,
    stats,
    zoom,
    isPhone,
    hideDone,
    cursor,
    editing,
    wave,
    flash,
    isOpen,
    canExpand,
    onToggleOpen: (id) => setOpenMap((m) => ({ ...m, [id]: !isOpen(id) })),
    onZoom: zoomTo,
    onToggleDone: toggleDone,
    onCursor: (id) => setCursor(id),
    onEdit: (id) => {
      setEditing(id);
      if (id) setCursor(id);
    },
    onTitle: (id, title) => setDocs((d) => ({ ...d, [active]: { ...d[active], nodes: setField(d[active].nodes, id, { title }) } })),
    onEditKey,
    onBlurEdit,
    picker,
    onPicker: (p) => setPicker((cur) => (cur && p && cur.id === p.id && cur.kind === p.kind ? null : p)),
    renderPicker: (id) => renderPicker(id),
  };

  const editNode = editing ? nodes[editing] : null;

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={scroller}
        className={s.root}
        layoutScroll
        onMouseDown={(e) => {
          if (picker && !(e.target as HTMLElement).closest("[role=dialog]")) setPicker(null);
          if (switchOpen && !(e.target as HTMLElement).closest("[data-switch]")) setSwitchOpen(false);
        }}
      >
        <LayoutGroup>
          <div className={s.frame}>
            <main className={s.column}>
              {/* ── Zoom path ─────────────────────────────────── */}
              <div className={s.topRow}>
                <nav className={s.crumbs} aria-label="Zoom path">
                  <span className={s.switchWrap} data-switch>
                    <button
                      type="button"
                      className={s.switchBtn}
                      onClick={() => setSwitchOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={switchOpen}
                      aria-label="Switch plan"
                    >
                      <span
                        className={s.tile}
                        style={{ background: active === "wedding" ? "var(--v3-project-3)" : "var(--v3-project-2)" }}
                      >
                        {nodes[doc.rootId].title.slice(0, 1)}
                      </span>
                      {trail.length === 0 && <span className={s.place}>{doc.place}</span>}
                      <Icon name="switch" size={12} className={s.switchIcon} />
                    </button>
                    <AnimatePresence>
                      {switchOpen && (
                        <Switcher
                          docs={docs}
                          active={active}
                          onPick={(k) => {
                            setActive(k);
                            setSwitchOpen(false);
                            setCursor(null);
                            setEditing(null);
                            setPicker(null);
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </span>
                  {isPhone
                    ? trail.length > 0 && (
                        <button type="button" className={s.back} onClick={() => zoomTo(trail[trail.length - 1])}>
                          <Icon name="back" size={16} />
                          <motion.span layoutId={`title-${trail[trail.length - 1]}`} transition={{ duration: 0.42, ease: EASE }}>
                            {nodes[trail[trail.length - 1]].title}
                          </motion.span>
                        </button>
                      )
                    : trail.map((a) => (
                        <span key={a} className={s.crumbItem}>
                          <Icon name="chevron" size={12} className={s.crumbSep} />
                          <button type="button" className={s.crumb} onClick={() => zoomTo(a)}>
                            <motion.span layoutId={`title-${a}`} transition={{ duration: 0.42, ease: EASE }}>
                              {nodes[a].title}
                            </motion.span>
                          </button>
                        </span>
                      ))}
                </nav>
                <div className={s.tools}>
                  <button
                    type="button"
                    className={hideDone ? `${s.toolToggle} ${s.toolToggleOn}` : s.toolToggle}
                    onClick={() => setHideDone((v) => !v)}
                    aria-pressed={hideDone}
                  >
                    <Icon name={hideDone ? "eyeOff" : "eye"} size={15} />
                    <span className={s.toolText}>Hide done</span>
                  </button>
                  {!isPhone && (
                    <span className={s.keysWrap}>
                      <button
                        type="button"
                        className={s.iconBtn}
                        onClick={() => setKeysOpen((v) => !v)}
                        aria-label="Keyboard shortcuts"
                        aria-expanded={keysOpen}
                        title="Shortcuts (?)"
                      >
                        <Icon name="keys" size={16} />
                      </button>
                      <AnimatePresence>{keysOpen && <KeySheet onClose={() => setKeysOpen(false)} />}</AnimatePresence>
                    </span>
                  )}
                </div>
              </div>

              {/* ── Heading ───────────────────────────────────── */}
              <header className={s.head}>
                <h1 className={s.h1}>
                  <motion.span
                    key={`${active}-${zoom}`}
                    layoutId={`title-${zoom}`}
                    className={s.h1Text} transition={{ duration: 0.42, ease: EASE }}>
                    {zn.title || "Untitled"}
                  </motion.span>
                </h1>
                <motion.div
                  key={`sum-${active}-${zoom}`}
                  className={s.summary}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.12, ease: EASE }}
                >
                  <span>
                    {zst.total === 1 && !zn.children.length ? (zn.done ? "Done" : "Not done yet") : `${zst.done} of ${zst.total} done`}
                  </span>
                  {zoom === doc.rootId ? (
                    <span>
                      <span className={s.dotSep} aria-hidden>
                        ·
                      </span>
                      {toGo} days to {doc.eventLabel}
                    </span>
                  ) : zn.due ? (
                    <span>
                      <span className={s.dotSep} aria-hidden>
                        ·
                      </span>
                      due {formatDay(zn.due)}
                    </span>
                  ) : null}
                  {zst.overdue > 0 && (
                    <span className={s.summaryLate}>
                      <span className={s.lateDotInline} aria-hidden />
                      {zst.overdue} late
                    </span>
                  )}
                  {zoom === doc.rootId && (
                    <span className={s.facepile} aria-label={`People: ${facepile.map((p) => PEOPLE[p].name).join(", ")}`}>
                      {facepile.map((p) => (
                        <Avatar key={p} person={p} size={22} />
                      ))}
                    </span>
                  )}
                </motion.div>
                <RollupBar nodes={nodes} stats={stats} zoom={zoom} onZoom={zoomTo} />
              </header>

              {/* ── Outline ───────────────────────────────────── */}
              <div className={s.outlineWrap}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={`${active}-${zoom}`}
                    className={s.outline}
                    role="tree"
                    aria-label={`Outline of ${zn.title}`}
                    style={{ "--step": isPhone ? "14px" : "24px" } as CSSProperties}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.32, delay: 0.1, ease: EASE } }}
                    exit={{ opacity: 0, transition: { duration: 0.14 } }}
                  >
                    <OutlineProvider value={ctx}>
                      {zn.children.length === 0 ? (
                        <EmptyZoom
                          title={zn.title}
                          onAdd={(t) => addChildEnd(zoom, t)}
                          onExit={() => {
                            if (!zn.parent) return;
                            zoomTo(zn.parent);
                            setCursor(zoom);
                          }}
                        />
                      ) : (
                        <>
                          {zn.children
                            .filter((k) => !(hideDone && stats[k].complete))
                            .map((k) => (
                              <Branch key={k} id={k} depth={0} />
                            ))}
                          {hideDone && zst.complete && <p className={s.allDone}>Everything in {zn.title} is done.</p>}
                          <button type="button" className={s.addLine} onClick={() => addChildEnd(zoom)}>
                            <Icon name="plus" size={14} />
                            Add a line to {zn.title}
                          </button>
                        </>
                      )}
                    </OutlineProvider>
                  </motion.div>
                </AnimatePresence>
              </div>
              {!isPhone && (
                <p className={s.hint}>
                  Click a ring to zoom in. Tab and Shift Tab move a line in and out. Press <kbd className={s.kbd}>?</kbd> for
                  every shortcut.
                </p>
              )}
            </main>

            <aside className={s.side}>
              <Minimap nodes={nodes} stats={stats} zoom={zoom} visible={visibleSet} cursor={cursor} onJump={jump} />
            </aside>
          </div>
        </LayoutGroup>

        {/* ── Phone: edit toolbar and picker sheet ─────────────── */}
        <AnimatePresence>
          {isPhone && editNode && picker && (
            <motion.div
              key="sheet"
              className={s.sheetWrap}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {renderPicker(editNode.id, true)}
            </motion.div>
          )}
          {isPhone && editNode && (
            <EditToolbar
              key="bar"
              onIndent={() => doIndent(editNode.id)}
              onOutdent={() => doOutdent(editNode.id)}
              onUp={() => doMove(editNode.id, -1)}
              onDown={() => doMove(editNode.id, 1)}
              onDate={() => setPicker((p) => (p?.kind === "date" ? null : { kind: "date", id: editNode.id }))}
              onPerson={() => setPicker((p) => (p?.kind === "person" ? null : { kind: "person", id: editNode.id }))}
              onDone={() => {
                setPicker(null);
                setEditing(null);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={s.toast}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              <span>{toast.text}</span>
              {toast.undo && (
                <button type="button" className={s.toastBtn} onClick={undo}>
                  Undo
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}

function EmptyZoom({ title, onAdd, onExit }: { title: string; onAdd: (t: string) => void; onExit: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className={s.empty}>
      <p className={s.emptyText}>
        Nothing under {title || "this line"} yet. Type to add the first step.
      </p>
      <div className={s.emptyLine}>
        <span className={s.emptyCheck} aria-hidden />
        <input
          className={`${s.titleInput} ${s.emptyInput}`}
          autoFocus
          value={value}
          placeholder="First step"
          aria-label={`First step under ${title}`}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !value) {
              e.preventDefault();
              onExit();
            } else if (e.key === "Enter" && value.trim()) {
              onAdd(value.trim());
              setValue("");
            }
          }}
        />
      </div>
    </div>
  );
}
