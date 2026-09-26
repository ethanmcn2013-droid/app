"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ME, PEOPLE, PERSON_IDS, PROJECT, SAMPLE_TASKS, STATUSES, type PersonId, type StatusId, type Task } from "./data";
import { Avatar, Icon, StatusGlyph } from "./glyphs";
import { Row } from "./Row";
import { Peek } from "./Peek";
import { Dock, filterOptions, type Option, type PickerKind, type Toast } from "./Dock";
import { ShortcutSheet } from "./Sheets";
import { daysFromToday, describeChange, hasChange, matches, parse, toChange, type Change } from "./parse";
import s from "./list.module.css";

/* ── Views, grouping, sorting ──────────────────────────────────────── */

type View = { id: string; label: string; test: (t: Task) => boolean };
const BASE_VIEWS: View[] = [
  { id: "all", label: "All tasks", test: () => true },
  { id: "mine", label: "Mine", test: (t) => t.assignee === ME },
  { id: "week", label: "This week", test: (t) => !!t.due && t.status !== "done" && daysFromToday(t.due) <= 2 },
  { id: "mara", label: "Mara & Finn", test: (t) => t.labels.includes("mara") },
  { id: "nodate", label: "Needs a date", test: (t) => !t.due && t.status !== "done" },
];

type GroupBy = "status" | "person";
type SortBy = "due" | "priority";
type Group = { key: string; name: string; icon: React.ReactNode; status?: StatusId; person?: PersonId | null; tasks: Task[] };

function sortTasks(list: Task[], by: SortBy) {
  const due = (t: Task) => (t.due ? daysFromToday(t.due) : 9999);
  return [...list].sort((a, b) =>
    by === "due" ? due(a) - due(b) || b.priority - a.priority || a.id - b.id : b.priority - a.priority || due(a) - due(b) || a.id - b.id,
  );
}

function buildGroups(list: Task[], groupBy: GroupBy, sortBy: SortBy): Group[] {
  if (groupBy === "status")
    return STATUSES.map((st) => ({
      key: st.id,
      name: st.name,
      status: st.id,
      icon: <StatusGlyph status={st.id} size={14} />,
      tasks: sortTasks(
        list.filter((t) => t.status === st.id),
        st.id === "done" ? "priority" : sortBy,
      ),
    }));
  return [...PERSON_IDS, null].map((p) => ({
    key: p ?? "none",
    name: p ? PEOPLE[p].name : "No one",
    person: p,
    icon: <Avatar person={p} size={16} />,
    tasks: sortTasks(
      list.filter((t) => t.assignee === p),
      sortBy,
    ),
  }));
}

/* ── Phone detection without effects ───────────────────────────────── */

const PHONE = "(max-width: 720px)";
const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/* ── The page ──────────────────────────────────────────────────────── */

export default function KeyboardCommandList() {
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);

  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);
  const [history, setHistory] = useState<Task[][]>([]);
  const [focusId, setFocusId] = useState(38);
  const [selected, setSelected] = useState<number[]>([38, 44, 45]);
  const [anchor, setAnchor] = useState<number | null>(38);
  const [viewId, setViewId] = useState("all");
  const [custom, setCustom] = useState<{ id: string; label: string; query: string }[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [sortBy, setSortBy] = useState<SortBy>("due");
  const [collapsed, setCollapsed] = useState<string[]>(["done"]);
  const [cmd, setCmd] = useState("orla friday high");
  const [picker, setPicker] = useState<{ kind: PickerKind; targets: number[] } | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);
  const [flash, setFlash] = useState<{ ids: number[]; n: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newInto, setNewInto] = useState<StatusId | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const counter = useRef(1);

  /* derived */
  const views: View[] = [
    ...BASE_VIEWS,
    ...custom.map((c) => {
      const toks = parse(c.query);
      return { id: c.id, label: c.label, test: (t: Task) => matches(t, toks) };
    }),
  ];
  const view = views.find((v) => v.id === viewId) ?? views[0];
  const inView = tasks.filter(view.test);
  const isNew = /^\s*new\s*:/i.test(cmd);
  const filtering = !picker && !isNew && selected.length === 0 && cmd.trim().length > 0;
  const filterTokens = filtering ? parse(cmd) : [];
  const shown = filtering ? inView.filter((t) => matches(t, filterTokens)) : inView;
  const groups = buildGroups(shown, groupBy, sortBy);
  const showEmptyGroups = !filtering && viewId === "all";
  const order = groups.filter((g) => !collapsed.includes(g.key)).flatMap((g) => g.tasks.map((t) => t.id));
  const focus = order.includes(focusId) ? focusId : (order[0] ?? null);
  const focusTask = tasks.find((t) => t.id === focus) ?? null;
  const late = shown.filter((t) => t.due && t.status !== "done" && daysFromToday(t.due) < 0).length;
  const focusGroupStatus: StatusId = newInto ?? focusTask?.status ?? "todo";
  const highlightWords = filterTokens.flatMap((t) => (t.kind === "word" ? [t.word] : []));
  const flashOrder = flash ? order.filter((id) => flash.ids.includes(id)) : [];

  /* helpers */
  const say = (text: string, undo = true) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ n: counter.current++, text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  };

  const ripple = (ids: number[]) => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash({ ids, n: counter.current++ });
    flashTimer.current = window.setTimeout(() => setFlash(null), 900 + ids.length * 30);
  };

  const commit = (next: Task[]) => {
    setHistory((h) => [...h.slice(-19), tasks]);
    setTasks(next);
  };

  const reveal = (id: number) => {
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-row="${id}"]`)?.scrollIntoView({ block: "nearest" }));
  };

  const targets = () => (selected.length ? selected : focus != null ? [focus] : []);
  const plural = (n: number) => (n === 1 ? "1 task" : `${n} tasks`);

  const applyChange = (ids: number[], change: Change) => {
    if (!ids.length) return;
    if (change.remove) return remove(ids);
    const said = describeChange(change);
    commit(
      tasks.map((t) => {
        if (!ids.includes(t.id)) return t;
        return {
          ...t,
          status: change.status ?? t.status,
          assignee: change.assign !== undefined ? change.assign : t.assignee,
          due: change.due !== undefined ? change.due : t.due,
          priority: change.priority ?? t.priority,
          labels: change.labels ? [...new Set([...t.labels, ...change.labels])] : t.labels,
          activity: [...t.activity, ...said.map((what) => ({ who: "you" as const, what, when: "just now" }))],
        };
      }),
    );
    ripple(ids);
    const summary = said.map((x) => x.replace(/^(assigned it to|set the due date to|set priority to|moved it to|added) /, "")).join(" · ");
    say(`Updated ${plural(ids.length)}${summary ? `: ${summary}` : ""}`);
  };

  const toggleLabel = (ids: number[], label: Task["labels"][number]) => {
    const all = tasks.filter((t) => ids.includes(t.id)).every((t) => t.labels.includes(label));
    commit(tasks.map((t) => (ids.includes(t.id) ? { ...t, labels: all ? t.labels.filter((l) => l !== label) : [...new Set([...t.labels, label])] } : t)));
    ripple(ids);
  };

  const remove = (ids: number[], movedTo?: string) => {
    if (!ids.length) return;
    const i = order.indexOf(ids[0]);
    const rest = order.filter((id) => !ids.includes(id));
    commit(tasks.filter((t) => !ids.includes(t.id)));
    setSelected((sel) => sel.filter((id) => !ids.includes(id)));
    if (rest.length) setFocusId(rest[Math.min(Math.max(0, i), rest.length - 1)]);
    say(movedTo ? `Moved ${plural(ids.length)} to ${movedTo}` : `Deleted ${plural(ids.length)}`);
  };

  const toggleDone = (ids: number[]) => {
    const allDone = tasks.filter((t) => ids.includes(t.id)).every((t) => t.status === "done");
    applyChange(ids, { status: allDone ? "todo" : "done" });
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return say("Nothing to undo", false);
    setHistory((h) => h.slice(0, -1));
    setTasks(prev);
    say("Undone. Everything is back as it was.", false);
  };

  const openPicker = (kind: PickerKind, ids = targets()) => {
    if (!ids.length) return;
    setPicker({ kind, targets: ids });
    setPickerQuery("");
    setPickerIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pick = (o: Option) => {
    if (!picker) return;
    if (o.move) remove(picker.targets, o.move);
    else if (o.toggleLabel) toggleLabel(picker.targets, o.toggleLabel);
    else if (o.change) applyChange(picker.targets, o.change);
    setPicker(null);
    inputRef.current?.blur();
  };

  const moveFocus = (dir: 1 | -1, extend = false) => {
    if (!order.length) return;
    const i = focus == null ? -1 : order.indexOf(focus);
    const next = order[Math.min(order.length - 1, Math.max(0, i + dir))];
    if (extend) {
      const from = anchor != null && order.includes(anchor) ? anchor : (focus ?? next);
      const [a, b] = [order.indexOf(from), order.indexOf(next)].sort((x, y) => x - y);
      setSelected((sel) => [...new Set([...sel, ...order.slice(a, b + 1)])]);
      if (anchor == null) setAnchor(from);
    }
    setFocusId(next);
    reveal(next);
  };

  const toggleSelect = (id: number, range = false) => {
    if (range && anchor != null && order.includes(anchor)) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
      setSelected((sel) => [...new Set([...sel, ...order.slice(a, b + 1)])]);
    } else {
      setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
      setAnchor(id);
    }
  };

  const createTask = () => {
    const body = cmd.replace(/^\s*new\s*:/i, "");
    const [title, ...rest] = body.split(",");
    if (!title.trim()) return;
    const change = toChange(parse(rest.join(",")));
    const id = Math.max(...tasks.map((t) => t.id), 59) + 1;
    const task: Task = {
      id,
      title: title.trim().replace(/^./, (c) => c.toUpperCase()),
      status: change.status ?? focusGroupStatus,
      assignee: change.assign !== undefined ? change.assign : null,
      due: change.due ?? null,
      priority: change.priority ?? 0,
      labels: change.labels ?? [],
      activity: [{ who: "you", what: "created this task", when: "just now" }],
    };
    commit([...tasks, task]);
    setCollapsed((c) => c.filter((k) => k !== task.status));
    setFocusId(id);
    setCmd("");
    setNewInto(null);
    ripple([id]);
    reveal(id);
    say(`Created ${PROJECT.key}-${id} in ${STATUSES.find((x) => x.id === task.status)!.name}`);
  };

  const submit = () => {
    if (isNew) return createTask();
    if (!cmd.trim()) return;
    if (selected.length) {
      const toks = parse(cmd);
      if (toks.some((t) => t.kind === "word")) return;
      const change = toChange(toks);
      if (!hasChange(change)) return;
      applyChange(selected, change);
      setCmd("");
      return;
    }
    inputRef.current?.blur(); // filtering: hand the keys back to the list
  };

  const escape = () => {
    if (picker) return setPicker(null);
    if (cmd) {
      setCmd("");
      setNewInto(null);
      return;
    }
    if (selected.length) return setSelected([]);
    inputRef.current?.blur();
  };

  const startNew = (status?: StatusId) => {
    setNewInto(status ?? null);
    setSelected([]);
    setCmd("new: ");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const saveView = () => {
    const q = cmd.trim();
    if (!q) return say("Type a filter in the command line first, then save it as a view.", false);
    const id = `v${counter.current++}`;
    setCustom((c) => [...c, { id, label: q.length > 22 ? `${q.slice(0, 21)}…` : q.replace(/^./, (x) => x.toUpperCase()), query: q }]);
    setViewId(id);
    setCmd("");
    say(`Saved “${q}” as a view`, false);
  };

  const rowClick = (e: React.MouseEvent, id: number) => {
    if (isPhone) {
      if (selected.length) return toggleSelect(id);
      setFocusId(id);
      setSheetOpen(true);
      return;
    }
    if (e.shiftKey) return toggleSelect(id, true);
    if (e.metaKey || e.ctrlKey) return toggleSelect(id);
    setFocusId(id);
    setAnchor(id);
  };

  /* keyboard: one listener, re-bound each render so it reads fresh state */
  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (keysOpen) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        setKeysOpen(false);
      }
      return;
    }
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    if (el && el.closest("[role=dialog]") && !rootRef.current?.contains(el)) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === "a") {
      e.preventDefault();
      setSelected(order);
      return;
    }
    if (mod && k === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (mod || e.altKey) return;
    const handled = () => e.preventDefault();
    if (k === "j" || e.key === "ArrowDown") return handled(), moveFocus(1, e.shiftKey);
    if (k === "k" || e.key === "ArrowUp") return handled(), moveFocus(-1, e.shiftKey);
    if (k === "x" && focus != null) return handled(), toggleSelect(focus);
    if (k === "s") return handled(), openPicker("status");
    if (k === "a") return handled(), openPicker("assign");
    if (k === "d") return handled(), openPicker("due");
    if (k === "p") return handled(), openPicker("priority");
    if (k === "l") return handled(), openPicker("labels");
    if (k === "m") return handled(), openPicker("move");
    if (k === "c") return handled(), toggleDone(targets());
    if (k === "z") return handled(), undo();
    if (k === "n") return handled(), startNew();
    if (e.key === "Backspace" || e.key === "Delete") return handled(), remove(targets());
    if (e.key === "/") return handled(), inputRef.current?.focus();
    if (e.key === "?") return handled(), setKeysOpen(true);
    if (e.key === "Escape") return handled(), escape();
    if (e.key === "Enter" && isPhone && focus != null) return handled(), setSheetOpen(true);
    if (/^[1-9]$/.test(e.key) && views[Number(e.key) - 1]) return handled(), setViewId(views[Number(e.key) - 1].id);
  };
  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const peek = focusTask && (
    <Peek
      key={focusTask.id}
      task={focusTask}
      position={`${order.indexOf(focusTask.id) + 1} of ${order.length}`}
      onPick={(kind) => {
        setSheetOpen(false);
        openPicker(kind, [focusTask.id]);
      }}
      onToggleSub={(sub) =>
        commit(tasks.map((t) => (t.id === focusTask.id ? { ...t, subtasks: t.subtasks?.map((x) => (x.id === sub ? { ...x, done: !x.done } : x)) } : t)))
      }
      onAddSub={(title) =>
        commit(
          tasks.map((t) =>
            t.id === focusTask.id ? { ...t, subtasks: [...(t.subtasks ?? []), { id: `n${counter.current++}`, title, done: false }] } : t,
          ),
        )
      }
      onRename={(title) =>
        commit(tasks.map((t) => (t.id === focusTask.id ? { ...t, title, activity: [...t.activity, { who: "you", what: "renamed this task", when: "just now" }] } : t)))
      }
      onDescribe={(description) => commit(tasks.map((t) => (t.id === focusTask.id ? { ...t, description } : t)))}
      onStep={(dir) => moveFocus(dir)}
      onClose={isPhone ? () => setSheetOpen(false) : undefined}
    />
  );

  const arrange = (
    <span className={s.arrangeWrap}>
      <button type="button" className={s.readout} aria-expanded={arrangeOpen} onClick={() => setArrangeOpen((o) => !o)}>
        <Icon name="sort" size={14} />
        <span className={s.rLong}>Grouped by {groupBy === "status" ? "status" : "person"}</span>
        <span className={s.rShort}>{groupBy === "status" ? "Status" : "Person"}</span>
        <span className={s.readoutSep} aria-hidden>
          ·
        </span>
        <span className={s.rLong}>Sorted by {sortBy === "due" ? "due date" : "priority"}</span>
        <span className={s.rShort}>{sortBy === "due" ? "Due date" : "Priority"}</span>
      </button>
      {arrangeOpen && (
        <>
          <span className={s.menuCatch} onClick={() => setArrangeOpen(false)} />
          <span className={s.menu} role="menu">
            <span className={s.menuLabel}>Group by</span>
            {(["status", "person"] as GroupBy[]).map((g) => (
              <button key={g} type="button" role="menuitemradio" aria-checked={groupBy === g} className={s.menuItem} onClick={() => setGroupBy(g)}>
                {g === "status" ? "Status" : "Person"}
                {groupBy === g && <Icon name="check" size={14} />}
              </button>
            ))}
            <span className={s.menuLabel}>Sort by</span>
            {(["due", "priority"] as SortBy[]).map((o) => (
              <button key={o} type="button" role="menuitemradio" aria-checked={sortBy === o} className={s.menuItem} onClick={() => setSortBy(o)}>
                {o === "due" ? "Due date" : "Priority"}
                {sortBy === o && <Icon name="check" size={14} />}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );

  const filterWords = cmd.trim();

  return (
    <div className={s.root} ref={rootRef}>
      <div className={s.listPane}>
        <header className={s.head}>
          <div className={s.titleRow}>
            <div className={s.titleBlock}>
              <h1 className={s.h1}>Tasks</h1>
              <span className={s.project}>
                <span className={s.projTile} aria-hidden>
                  {PROJECT.initial}
                </span>
                {PROJECT.name}
              </span>
            </div>
            <div className={s.headActions}>
              <span className={s.wideOnly}>{arrange}</span>
              <button type="button" className={s.primaryBtn} onClick={() => startNew()}>
                <Icon name="plus" />
                New<span className={s.hideSm}> task</span>
              </button>
            </div>
          </div>

          <div className={s.viewRow}>
            <nav className={s.tabs} aria-label="Saved views">
              {views.map((v) => {
                const n = tasks.filter(v.test).filter((t) => v.id === "all" || t.status !== "done").length;
                return (
                  <button key={v.id} type="button" className={s.tab} aria-current={v.id === view.id || undefined} onClick={() => setViewId(v.id)}>
                    {v.label}
                    <span className={s.tabCount}>{n}</span>
                  </button>
                );
              })}
              <button type="button" className={s.tabAdd} onClick={saveView} title="Save the current filter as a view">
                <Icon name="plus" size={14} />
                Save view
              </button>
            </nav>
            <div className={s.viewMeta}>
              <span className={s.count}>
                {plural(shown.length)}
                {late > 0 && <span className={s.lateCount}> · {late} late</span>}
              </span>
              <span className={s.phoneOnly}>{arrange}</span>
              <button type="button" className={s.keysBtn} onClick={() => setKeysOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
                <Icon name="keyboard" />
              </button>
            </div>
          </div>
        </header>

        <div className={s.scroller} role="listbox" aria-label="Tasks" aria-multiselectable="true">
          {shown.length === 0 ? (
            <div className={s.empty}>
              <span className={s.emptyIcon} aria-hidden>
                <Icon name="filter" size={20} />
              </span>
              {filtering ? (
                <>
                  <p className={s.emptyTitle}>No tasks match “{filterWords}”.</p>
                  <button type="button" className={s.textBtn} onClick={() => setCmd("")}>
                    Clear the filter
                  </button>
                </>
              ) : (
                <>
                  <p className={s.emptyTitle}>Nothing in {view.label.toLowerCase()} right now.</p>
                  <button type="button" className={s.textBtn} onClick={() => setViewId("all")}>
                    Show all tasks
                  </button>
                </>
              )}
            </div>
          ) : (
            groups.map((g) => {
              if (!g.tasks.length) {
                if (!showEmptyGroups) return null;
                return (
                  <div key={g.key} className={s.groupEmpty}>
                    <span className={s.groupIcon}>{g.icon}</span>
                    {g.name} <span className={s.groupNone}>· none</span>
                  </div>
                );
              }
              const isCollapsed = collapsed.includes(g.key);
              return (
                <section key={g.key} className={s.group} aria-label={g.name}>
                  <div className={s.groupHead}>
                    <button
                      type="button"
                      className={s.groupToggle}
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((c) => (isCollapsed ? c.filter((x) => x !== g.key) : [...c, g.key]))}
                    >
                      <span className={s.chev} data-collapsed={isCollapsed || undefined}>
                        <Icon name="chevron" size={14} />
                      </span>
                      <span className={s.groupIcon}>{g.icon}</span>
                      <span className={s.groupName}>{g.name}</span>
                      <span className={s.groupCount}>{g.tasks.length}</span>
                    </button>
                    {g.status && g.status !== "done" && (
                      <button type="button" className={s.groupAdd} onClick={() => startNew(g.status)} aria-label={`New task in ${g.name}`}>
                        <Icon name="plus" size={14} />
                      </button>
                    )}
                  </div>
                  {!isCollapsed &&
                    g.tasks.map((t) => {
                      const fi = flashOrder.indexOf(t.id);
                      return (
                        <Row
                          key={t.id}
                          task={t}
                          focused={t.id === focus}
                          selected={selected.includes(t.id)}
                          selecting={selected.length > 0}
                          flash={flash && fi >= 0 ? { n: flash.n, delay: fi * 30 } : undefined}
                          onClick={rowClick}
                          highlight={highlightWords}
                          onToggleSelect={toggleSelect}
                          onToggleDone={(id) => toggleDone([id])}
                          onLongPress={(id) => {
                            setFocusId(id);
                            toggleSelect(id);
                          }}
                        />
                      );
                    })}
                </section>
              );
            })
          )}
        </div>
        <div className={s.fade} aria-hidden />

        <Dock
          cmd={cmd}
          onCmd={setCmd}
          inputRef={inputRef}
          selectedCount={selected.length}
          focusedKey={focus != null ? `${PROJECT.key}-${focus}` : null}
          newGroupName={STATUSES.find((x) => x.id === focusGroupStatus)!.name}
          filterCount={{ shown: shown.length, total: inView.length }}
          picker={picker}
          pickerQuery={pickerQuery}
          onPickerQuery={(v) => {
            setPickerQuery(v);
            setPickerIndex(0);
          }}
          pickerIndex={picker ? Math.min(pickerIndex, Math.max(0, filterOptions(picker.kind, pickerQuery).length - 1)) : 0}
          onPickerIndex={setPickerIndex}
          onPick={pick}
          onClosePicker={() => setPicker(null)}
          onOpenPicker={(k) => openPicker(k)}
          onSubmit={submit}
          onEscape={escape}
          onDelete={() => remove(targets())}
          onClearSelection={() => setSelected([])}
          onSaveView={saveView}
          onShortcuts={() => setKeysOpen(true)}
          toast={toast}
          onUndo={undo}
          onDismissToast={() => setToast(null)}
          compact={isPhone}
        />
      </div>

      {!isPhone && (
        <aside className={s.peekPane} aria-label="Task in focus">
          {peek ?? (
            <p className={s.peekEmpty}>{filtering ? "Nothing matches the filter, so there is nothing to show here." : "Click a task, or move with J and K, to see it here."}</p>
          )}
        </aside>
      )}

      {isPhone && sheetOpen && focusTask && (
        <div className={s.sheetScrim} onClick={() => setSheetOpen(false)}>
          <div className={s.sheet} role="dialog" aria-modal="true" aria-label={focusTask.title} onClick={(e) => e.stopPropagation()}>
            <span className={s.sheetHandle} aria-hidden />
            {peek}
          </div>
        </div>
      )}

      {keysOpen && <ShortcutSheet onClose={() => setKeysOpen(false)} />}
    </div>
  );
}
