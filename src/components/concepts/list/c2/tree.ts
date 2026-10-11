/* Pure outline operations. Every op returns a new node map. */
import { daysFromToday, type OutlineNode } from "./data";

export type Nodes = Record<string, OutlineNode>;
export type Stat = { done: number; total: number; overdue: number; complete: boolean };

/** Roll up every node: leaves count once, parents sum their leaves. */
export function rollup(nodes: Nodes, rootId: string): Record<string, Stat> {
  const out: Record<string, Stat> = {};
  const walk = (id: string): Stat => {
    const n = nodes[id];
    if (!n.children.length) {
      const late = !n.done && !!n.due && daysFromToday(n.due) < 0;
      const s = { done: n.done ? 1 : 0, total: 1, overdue: late ? 1 : 0, complete: n.done };
      out[id] = s;
      return s;
    }
    let done = 0;
    let total = 0;
    let overdue = 0;
    for (const c of n.children) {
      const s = walk(c);
      done += s.done;
      total += s.total;
      overdue += s.overdue;
    }
    const s = { done, total, overdue, complete: total > 0 && done === total };
    out[id] = s;
    return s;
  };
  walk(rootId);
  return out;
}

export function ancestors(nodes: Nodes, id: string): string[] {
  const out: string[] = [];
  let p = nodes[id]?.parent ?? null;
  while (p) {
    out.push(p);
    p = nodes[p].parent;
  }
  return out;
}

/** Depth of id below `from` (children of `from` are depth 0). */
export function depthBelow(nodes: Nodes, id: string, from: string) {
  let d = -1;
  let cur: string | null = id;
  while (cur && cur !== from) {
    d++;
    cur = nodes[cur].parent;
  }
  return d;
}

export function leaves(nodes: Nodes, id: string): string[] {
  const n = nodes[id];
  if (!n.children.length) return [id];
  return n.children.flatMap((c) => leaves(nodes, c));
}

export function subtree(nodes: Nodes, id: string): string[] {
  return [id, ...nodes[id].children.flatMap((c) => subtree(nodes, c))];
}

const clone = (nodes: Nodes, ids: string[]) => {
  const next = { ...nodes };
  for (const id of ids) next[id] = { ...nodes[id], children: [...nodes[id].children] };
  return next;
};

export function setField(nodes: Nodes, id: string, patch: Partial<OutlineNode>): Nodes {
  return { ...nodes, [id]: { ...nodes[id], ...patch } };
}

/** Leaves flip; a parent marks everything beneath it done (or open again). */
export function toggle(nodes: Nodes, id: string, complete: boolean): Nodes {
  const next = { ...nodes };
  for (const leaf of leaves(nodes, id)) next[leaf] = { ...nodes[leaf], done: !complete };
  return next;
}

export function indent(nodes: Nodes, id: string): { nodes: Nodes; newParent: string } | null {
  const p = nodes[id].parent;
  if (!p) return null;
  const idx = nodes[p].children.indexOf(id);
  if (idx <= 0) return null;
  const prev = nodes[p].children[idx - 1];
  const next = clone(nodes, [p, prev, id]);
  next[p].children.splice(idx, 1);
  next[prev].children.push(id);
  next[id].parent = prev;
  // A finished step that gains an open child is no longer "done" by itself.
  if (!nodes[prev].children.length) next[prev].done = false;
  return { nodes: next, newParent: prev };
}

export function outdent(nodes: Nodes, id: string, floor: string): Nodes | null {
  const p = nodes[id].parent;
  if (!p || p === floor) return null;
  const g = nodes[p].parent;
  if (!g) return null;
  const next = clone(nodes, [p, g, id]);
  next[p].children = next[p].children.filter((c) => c !== id);
  next[g].children.splice(next[g].children.indexOf(p) + 1, 0, id);
  next[id].parent = g;
  return next;
}

export function move(nodes: Nodes, id: string, dir: -1 | 1): Nodes | null {
  const p = nodes[id].parent;
  if (!p) return null;
  const list = nodes[p].children;
  const idx = list.indexOf(id);
  const to = idx + dir;
  if (to < 0 || to >= list.length) return null;
  const next = clone(nodes, [p]);
  next[p].children.splice(idx, 1);
  next[p].children.splice(to, 0, id);
  return next;
}

let seq = 0;
export function newId() {
  seq += 1;
  return `n${Date.now().toString(36)}${seq}`;
}

export function insert(nodes: Nodes, parent: string, index: number, id: string, title = ""): Nodes {
  const next = clone(nodes, [parent]);
  next[id] = { id, title, done: false, parent, children: [] };
  next[parent].children.splice(index, 0, id);
  return next;
}

export function remove(nodes: Nodes, id: string): Nodes {
  const p = nodes[id].parent;
  if (!p) return nodes;
  const next = clone(nodes, [p]);
  next[p].children = next[p].children.filter((c) => c !== id);
  for (const gone of subtree(nodes, id)) delete next[gone];
  return next;
}
