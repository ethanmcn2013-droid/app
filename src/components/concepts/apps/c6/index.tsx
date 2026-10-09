"use client";

/* How it all connects: Apps and tools as a living map of what talks to what. */

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { PROJECTS, flowFor, nodeById, projectById, type Choice, type Conn, type Filter } from "./data";
import { allLedger, initialState, plural, reducer, summary, type Sheet } from "./model";
import { FlowMap } from "./flow-map";
import { StripMap } from "./strip-map";
import { TodayLedger } from "./ledger";
import { ConnectionSheet, NewSheet, PickSheet, StartSheet } from "./sheet";
import { HealthNote, ProjectFilter, cx } from "./parts";
import { Icon, NodeGlyph } from "./glyphs";
import { useIsClient } from "./measure";
import s from "./c6.module.css";

type Preview = "yours" | "new";

export default function HowItAllConnects() {
  const [preview, setPreview] = useState<Preview>("yours");
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    if (!root) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [root]);
  const phone = width < 720;

  return (
    <MotionConfig reducedMotion="user">
      <div ref={setRoot} className={cx(s.root, phone && s.rootPhone)}>
        <Connections key={preview} empty={preview === "new"} phone={phone} wide={width >= 1180} preview={preview} setPreview={setPreview} />
      </div>
    </MotionConfig>
  );
}

function Connections({ empty, phone, wide, preview, setPreview }: { empty: boolean; phone: boolean; wide: boolean; preview: Preview; setPreview: (p: Preview) => void }) {
  const [state, dispatch] = useReducer(reducer, empty, initialState);
  const [filter, setFilter] = useState<Filter>("all");
  const [hover, setHover] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tab, setTab] = useState<"map" | "today">("map");
  const [toast, setToast] = useState<{ text: string; undo?: boolean } | null>(null);
  // Dots render on the server too; the reduced-motion answer only applies once hydrated.
  const live = useIsClient();
  const prefersReduced = useReducedMotion();
  const reduced = live > 0 && Boolean(prefersReduced);
  const { conns } = state;
  // A new account shows ghosts only until its first line is drawn.
  const bare = empty && conns.length === 0;

  // A hovered row, line or ledger entry lights its exact route; a hovered app lights all of its lines.
  const openId = sheet?.kind === "conn" ? sheet.id : null;
  const hi = useMemo(() => {
    if (!hover) return openId ? [openId] : [];
    if (hover.startsWith("node:")) {
      const id = hover.slice(5);
      return conns.filter((c) => c.from === id || c.to === id).map((c) => c.id);
    }
    return [hover];
  }, [hover, conns, openId]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: conns.length };
    for (const p of PROJECTS) out[p.id] = conns.filter((c) => c.project === p.id).length;
    return out;
  }, [conns]);

  const ledger = allLedger(state, empty);
  const closeSheet = useCallback(() => setSheet(null), []);
  const say = useCallback((text: string, undo?: boolean) => setToast({ text, undo }), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const act = useCallback(
    (c: Conn) => {
      if (c.status === "broken") {
        dispatch({ type: "signIn", id: c.id });
        setSheet({ kind: "conn", id: c.id });
      } else if (c.status === "waiting") {
        dispatch({ type: "allow", id: c.id });
        say(`${nodeById(c.from).name} can now send to ${nodeById(c.to).name}. Watch the line.`);
      }
    },
    [say],
  );

  const ev = useMemo(
    () => ({
      onOpen: (id: string) => setSheet({ kind: "conn", id }),
      onHover: setHover,
      onAct: act,
      onPick: (node: string) => setSheet({ kind: "pick", node }),
    }),
    [act],
  );

  const onDone = (from: string, to: string, choice: Choice) => {
    dispatch({ type: "add", from, to, choice });
    setSheet(null);
    if (filter !== "all" && filter !== choice.project) setFilter(choice.project);
    const a = nodeById(from).name;
    const b = nodeById(to).name;
    const access = flowFor(from, to).access;
    say(access ? `Almost there. ${access.replace("Waiting for you to allow", "Allow")} to finish.` : `${a} now sends to ${b} for ${projectById(choice.project).name}.`);
  };

  const dispatchWrap: typeof dispatch = (a) => {
    dispatch(a);
    if (a.type === "disconnect") {
      const c = conns.find((x) => x.id === a.id);
      if (c) say(`${nodeById(c.from).name} is no longer connected to ${nodeById(c.to).name}.`, true);
    }
    if (a.type === "allow") {
      const c = conns.find((x) => x.id === a.id);
      if (c) say(`${nodeById(c.from).name} can now send to ${nodeById(c.to).name}. Watch the line.`);
    }
    if (a.type === "pause") say("Paused. Nothing new comes along this line until you resume it.");
  };

  const sheetConn = sheet?.kind === "conn" ? conns.find((c) => c.id === sheet.id) : undefined;
  const pending = sheet?.kind === "new" ? { from: sheet.from, to: sheet.to } : null;
  const sum = summary(conns, filter);

  const lede = empty
    ? "Where things come in, what they turn into, and where they go. Draw a line between two places to turn a connection on."
    : "Where things come in, what they turn into, and where they go. Every line is a connection that is on.";

  const filterSentence =
    filter === "all" ? (
      <>
        <span className={s.num}>{plural(sum.ins, "connection brings", "connections bring")}</span> things in and <span className={s.num}>{sum.outs}</span> send them on.
        {sum.needs > 0 && <> {plural(sum.needs, "needs", "need")} you.</>}
      </>
    ) : (
      <>
        {projectById(filter).name} is fed by <span className={s.num}>{plural(sum.ins, "connection", "connections")}</span> and sends to{" "}
        <span className={s.num}>{plural(sum.outs, "place", "places")}</span>.{sum.needs > 0 && <> {plural(sum.needs, "needs", "need")} you.</>}
      </>
    );

  const emptyNote = bare && (
    <div className={s.emptyNote}>
      <span className={s.emptyGlyph}>
        <NodeGlyph g="mail" size={22} />
      </span>
      <div className={s.emptyBody}>
        <p className={s.emptyTitle}>Nothing is connected yet. Most teams start with email.</p>
        <p className={s.emptySub}>Pick which emails matter, and each one becomes a task in the right Project, with the email attached.</p>
      </div>
      <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={() => setSheet({ kind: "new", from: "gmail", to: "tasks" })}>
        Connect email
      </button>
    </div>
  );

  const header = (
    <header className={s.header}>
      <div className={s.headText}>
        <h1 className={s.h1}>How it all connects</h1>
        <p className={s.lede}>{lede}</p>
      </div>
      {!bare && (
        <button type="button" className={cx(s.btn, s.btnPrimary)} onClick={() => setSheet({ kind: "start" })}>
          <Icon name="plus" /> Connect something
        </button>
      )}
    </header>
  );

  const toolbar = !bare ? (
    <div className={s.toolbar}>
      <ProjectFilter value={filter} onChange={setFilter} counts={counts} />
      <p className={s.filterSentence} aria-live="polite">
        {filterSentence}
      </p>
    </div>
  ) : null;

  const ledgerEl = (
    <TodayLedger items={ledger} conns={conns} filter={filter} hi={hi} empty={empty} onHover={setHover} onOpen={ev.onOpen} onClearFilter={() => setFilter("all")} />
  );
  const scopedConns = filter === "all" ? conns : conns.filter((c) => c.project === filter || c.project === null);
  const health = <HealthNote conns={scopedConns} onAct={act} onOpen={ev.onOpen} onHover={setHover} />;

  const legend = !bare && (
    <ul className={s.legend} aria-label="How to read the lines">
      <li>
        <svg width="26" height="8" aria-hidden="true">
          <path d="M1 4H25" className={s.legLive} />
          <circle cx="16" cy="4" r="2.6" className={s.legDot} />
        </svg>
        On, with today’s flow
      </li>
      <li>
        <svg width="26" height="8" aria-hidden="true">
          <path d="M1 4H25" className={s.legWait} />
        </svg>
        Waiting for access
      </li>
      <li>
        <svg width="26" height="8" aria-hidden="true">
          <path d="M1 4H25" className={s.legPaused} />
        </svg>
        Paused
      </li>
      <li>
        <svg width="26" height="8" aria-hidden="true">
          <path d="M1 4H9M17 4H25" className={s.legBroken} />
        </svg>
        Stopped, needs you
      </li>
      <li>
        <svg width="26" height="8" aria-hidden="true">
          <path d="M1 4H25" className={s.legShared} />
        </svg>
        Shared by every Project
      </li>
    </ul>
  );

  const sheetEl = (
    <AnimatePresence>
      {sheet?.kind === "conn" && sheetConn && <ConnectionSheet key={`c-${sheetConn.id}`} conn={sheetConn} phone={phone} dispatch={dispatchWrap} onClose={closeSheet} events={state.events} />}
      {sheet?.kind === "new" && <NewSheet key={`n-${sheet.from}-${sheet.to}`} from={sheet.from} to={sheet.to} phone={phone} onClose={closeSheet} onDone={(c) => onDone(sheet.from, sheet.to, c)} />}
      {sheet?.kind === "pick" && <PickSheet key={`p-${sheet.node}`} node={sheet.node} conns={conns} phone={phone} onClose={closeSheet} onPick={(from, to) => setSheet({ kind: "new", from, to })} />}
      {sheet?.kind === "start" && <StartSheet key="start" conns={conns} phone={phone} onClose={closeSheet} onPick={(node) => setSheet({ kind: "pick", node })} />}
    </AnimatePresence>
  );

  const toastEl = (
    <AnimatePresence>
      {toast && (
        <motion.div className={cx(s.toast, phone && s.toastPhone)} role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.22 }}>
          <Icon name="check" />
          <span>{toast.text}</span>
          {toast.undo && state.removed && (
            <button
              type="button"
              className={s.toastBtn}
              onClick={() => {
                dispatch({ type: "undo" });
                setToast(null);
              }}
            >
              <Icon name="undo" /> Undo
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const previewSwitch = (
    <footer className={s.previewBar}>
      <span className={s.previewLabel}>Preview</span>
      <div className={s.seg} role="group" aria-label="Preview">
        <button type="button" aria-pressed={preview === "yours"} onClick={() => setPreview("yours")}>
          Your connections
        </button>
        <button type="button" aria-pressed={preview === "new"} onClick={() => setPreview("new")}>
          A new account
        </button>
      </div>
    </footer>
  );

  if (phone) {
    const todayCount = ledger.length;
    return (
      <div className={s.page}>
        {header}
        <div className={s.tabs} role="tablist" aria-label="Views">
          <button type="button" role="tab" aria-selected={tab === "map"} className={s.tab} onClick={() => setTab("map")}>
            Map
          </button>
          <button type="button" role="tab" aria-selected={tab === "today"} className={s.tab} onClick={() => setTab("today")}>
            Today {todayCount > 0 && <span className={cx(s.tabCount, s.num)}>{todayCount}</span>}
          </button>
        </div>
        {tab === "map" ? (
          <div role="tabpanel" aria-label="Map" className={s.phoneMap}>
            {emptyNote}
            {toolbar}
            <HealthNote conns={scopedConns} onAct={act} onOpen={ev.onOpen} onHover={setHover} compact />
            <StripMap conns={conns} filter={filter} hi={hi} reduced={reduced} empty={bare} ev={ev} />
            {legend}
          </div>
        ) : (
          <div role="tabpanel" aria-label="Today" className={s.phoneToday}>
            {health}
            {ledgerEl}
          </div>
        )}
        {previewSwitch}
        {sheetEl}
        {toastEl}
      </div>
    );
  }

  return (
    <div className={s.page}>
      {header}
      {emptyNote}
      {toolbar}
      <div className={cx(s.body, wide && s.bodyWide)}>
        <section className={s.mapCol} aria-label="Connection map">
          <FlowMap conns={conns} filter={filter} hi={hi} reduced={reduced} empty={bare} pending={pending} ev={ev} onDraw={(from, to) => setSheet({ kind: "new", from, to })} />
          {legend}
        </section>
        <aside className={s.aside}>
          {health}
          {ledgerEl}
        </aside>
      </div>
      {previewSwitch}
      {sheetEl}
      {toastEl}
    </div>
  );
}
