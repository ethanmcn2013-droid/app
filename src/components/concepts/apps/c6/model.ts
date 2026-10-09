/* State for the map: connections on, what happened today, and what is open. */

import { CONNECTIONS, LEDGER, flowFor, nodeById, projectById, type Choice, type Conn, type Filter, type LedgerItem, type ProjectId } from "./data";

export type Sheet =
  | null
  | { kind: "conn"; id: string }
  | { kind: "new"; from: string; to: string }
  | { kind: "pick"; node: string }
  | { kind: "start" };

export type State = {
  conns: Conn[];
  events: LedgerItem[];
  removed: Conn | null;
};

export type Action =
  | { type: "rule"; id: string; rule: string }
  | { type: "pause"; id: string }
  | { type: "resume"; id: string }
  | { type: "disconnect"; id: string }
  | { type: "undo" }
  | { type: "signIn"; id: string }
  | { type: "allow"; id: string }
  | { type: "project"; id: string; project: ProjectId }
  | { type: "add"; from: string; to: string; choice: Choice };

export function initialState(empty: boolean): State {
  return { conns: empty ? [] : CONNECTIONS, events: [], removed: null };
}

let seq = 0;

export function reducer(state: State, a: Action): State {
  const edit = (id: string, f: (c: Conn) => Conn) => state.conns.map((c) => (c.id === id ? f(c) : c));
  switch (a.type) {
    case "rule":
      return { ...state, conns: edit(a.id, (c) => ({ ...c, rules: c.rules.map((r) => (r.id === a.rule ? { ...r, on: !r.on } : r)) })) };
    case "pause":
      return { ...state, conns: edit(a.id, (c) => ({ ...c, status: "paused", by: "you", note: "Paused by you", fresh: false })) };
    case "resume":
      return { ...state, conns: edit(a.id, (c) => ({ ...c, status: "live", by: undefined, note: undefined, fresh: true })) };
    case "disconnect": {
      const gone = state.conns.find((c) => c.id === a.id) ?? null;
      return { ...state, conns: state.conns.filter((c) => c.id !== a.id), removed: gone };
    }
    case "undo":
      if (!state.removed) return state;
      return { ...state, conns: [...state.conns, state.removed], removed: null };
    case "signIn": {
      const c = state.conns.find((x) => x.id === a.id);
      const where = c && (c.from === "gmail" || c.from === "drive" || c.from === "gcal") ? "Google" : "your account";
      return { ...state, conns: edit(a.id, (x) => ({ ...x, status: "waiting", note: `Waiting for you to allow access in ${where}` })) };
    }
    case "allow": {
      const c = state.conns.find((x) => x.id === a.id);
      if (!c) return state;
      const from = nodeById(c.from).name;
      const to = nodeById(c.to).name;
      const ev: LedgerItem = {
        id: `ev${++seq}`,
        time: "Just now",
        conn: c.id,
        text: `${from} is sending to ${to} again`,
        detail: c.project ? `For ${projectById(c.project).name}. The first one is on its way` : "The first one is on its way",
      };
      return { ...state, conns: edit(a.id, (x) => ({ ...x, status: "live", note: undefined, fresh: true })), events: [ev, ...state.events] };
    }
    case "project":
      return { ...state, conns: edit(a.id, (c) => ({ ...c, project: a.project })) };
    case "add": {
      const flow = flowFor(a.from, a.to);
      const id = `${a.from}-${a.to}-${a.choice.project}-${++seq}`;
      const waiting = Boolean(flow.access);
      const conn: Conn = {
        id,
        from: a.from,
        to: a.to,
        project: a.choice.project,
        label: flow.label,
        status: waiting ? "waiting" : "live",
        note: waiting ? flow.access : undefined,
        today: 0,
        week: [0, 0, 0, 0, 0, 0, 0],
        unit: flow.unit,
        fresh: !waiting,
        rules: [
          ...(flow.question === "Which Project is this for?" ? [] : [{ id: "q", text: `Only ${a.choice.label.replace(/^Emails/, "emails")}`, on: true }]),
          ...flow.rules.map((t, i) => ({ id: `r${i}`, text: t, on: true })),
        ],
      };
      const from = nodeById(a.from).name;
      const to = nodeById(a.to).name;
      const ev: LedgerItem = waiting
        ? { id: `ev${++seq}`, time: "Just now", conn: id, text: `${from} to ${to} is waiting for you`, detail: flow.access ?? "" }
        : { id: `ev${++seq}`, time: "Just now", conn: id, text: `${from} now sends to ${to}`, detail: `${a.choice.label}. The next one will travel along the new line` };
      return { ...state, conns: [...state.conns, conn], events: [ev, ...state.events] };
    }
  }
}

export function allLedger(state: State, empty: boolean) {
  return [...state.events, ...(empty ? [] : LEDGER)].filter((e) => state.conns.some((c) => c.id === e.conn));
}

/* ── emphasis ───────────────────────────────────────────────────────── */

export type Tone = "hi" | "normal" | "dim";

export function lineTone(c: Conn, filter: Filter, hi: string[]): Tone {
  if (hi.length) return hi.includes(c.id) ? "hi" : "dim";
  if (filter === "all") return "normal";
  if (c.project === filter) return "hi";
  if (c.project === null) return "normal";
  return "dim";
}

export function nodeTone(id: string, conns: Conn[], filter: Filter, hi: string[]): Tone {
  const mine = conns.filter((c) => c.from === id || c.to === id);
  if (hi.length) return mine.some((c) => hi.includes(c.id)) ? "hi" : "dim";
  if (filter === "all") return "normal";
  if (mine.some((c) => c.project === filter)) return "hi";
  if (mine.some((c) => c.project === null)) return "normal";
  return "dim";
}

export function summary(conns: Conn[], filter: Filter) {
  const scoped = filter === "all" ? conns : conns.filter((c) => c.project === filter || c.project === null);
  const ins = scoped.filter((c) => nodeById(c.from).side === "source");
  const outs = scoped.filter((c) => nodeById(c.to).side === "dest");
  const needs = scoped.filter((c) => c.status === "broken" || c.status === "waiting").length;
  const inToday = ins.reduce((a, c) => a + c.today, 0);
  const outToday = outs.reduce((a, c) => a + c.today, 0);
  return { ins: ins.length, outs: outs.length, needs, inToday, outToday };
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
