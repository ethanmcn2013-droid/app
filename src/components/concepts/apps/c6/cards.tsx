"use client";

import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent } from "react";
import { type Conn, type NodeDef } from "./data";
import type { CardBox } from "./layout";
import { rowNote } from "./layout";
import { plural, type Tone } from "./model";
import { Icon, NodeGlyph } from "./glyphs";
import { Swatch, cx, pc } from "./parts";
import s from "./c6.module.css";

export type CardEvents = {
  onOpen: (id: string) => void;
  onHover: (id: string | null) => void;
  onAct: (c: Conn) => void;
  onPick: (nodeId: string) => void;
};

/* ── the port you drag a new line from ───────────────────────────────── */

export function PortHandle({
  node,
  edge,
  dashed,
  onDown,
  onPick,
}: {
  node: NodeDef;
  edge: "right" | "left";
  dashed?: boolean;
  onDown?: (e: RPointerEvent<HTMLButtonElement>, node: NodeDef) => void;
  onPick: (id: string) => void;
}) {
  const onKey = (e: RKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick(node.id);
    }
  };
  return (
    <button
      type="button"
      className={cx(s.handle, edge === "right" ? s.handleRight : s.handleLeft, dashed && s.handleDashed)}
      aria-label={`Connect ${node.name} to…`}
      title="Drag to connect, or press to choose"
      onPointerDown={onDown ? (e) => onDown(e, node) : undefined}
      onClick={onDown ? undefined : () => onPick(node.id)}
      onKeyDown={onKey}
    >
      <Icon name="plus" size={10} />
    </button>
  );
}

/* ── one line's row inside a card ────────────────────────────────────── */

function Row({ c, h, tone, ev, withCount }: { c: Conn; h: number; tone: Tone; ev: CardEvents; withCount: boolean }) {
  const note = rowNote(c);
  const outgoingIdle = c.status === "live" && c.today === 0 && c.next;
  return (
    <div
      className={cx(s.row, s[`rowTone_${tone}`], pc(c.project))}
      style={{ height: h }}
      onPointerEnter={() => ev.onHover(c.id)}
      onPointerLeave={() => ev.onHover(null)}
    >
      <button type="button" className={s.rowMain} onClick={() => ev.onOpen(c.id)} onFocus={() => ev.onHover(c.id)} onBlur={() => ev.onHover(null)}>
        <Swatch project={c.project} />
        <span className={s.rowLabel}>{c.label}</span>
        {withCount && c.status === "live" && (
          <span className={cx(s.rowCount, s.num, c.today === 0 && s.rowCountZero)} aria-label={outgoingIdle ? c.next : `${plural(c.today, c.unit[0], c.unit[1])} today`}>
            {c.today}
          </span>
        )}
      </button>
      {note && (
        <p className={cx(s.rowNote, s[`note_${c.status}`])}>
          <Icon name={c.status === "broken" ? "warn" : c.status === "paused" ? "pause" : "wait"} size={12} />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

/* ── a place things come from or go to ───────────────────────────────── */

export function SideCard({
  card,
  conns,
  tone,
  rowTone,
  ev,
  edge,
  onHandleDown,
  target,
  compact,
}: {
  card: CardBox;
  conns: Conn[];
  tone: Tone;
  rowTone: (c: Conn) => Tone;
  ev: CardEvents;
  edge: "right" | "left";
  onHandleDown?: (e: RPointerEvent<HTMLButtonElement>, node: NodeDef) => void;
  target?: boolean;
  compact?: boolean;
}) {
  const { node } = card;
  const byId = new Map(conns.map((c) => [c.id, c]));
  return (
    <div
      className={cx(s.card, s.sideCard, card.ghost && s.ghost, s[`tone_${tone}`], target && s.cardTarget)}
      style={{ transform: `translate(${card.x}px, ${card.y}px)`, width: card.w, height: card.h }}
      data-node={node.id}
    >
      {card.ghost ? (
        <button type="button" className={s.ghostHead} disabled={node.later} onClick={() => ev.onPick(node.id)} aria-label={node.later ? `${node.name}, coming later. ${node.would}` : `Connect ${node.name}. ${node.would}`}>
          <span className={s.tile}>
            <NodeGlyph g={node.glyph} />
          </span>
          <span className={s.cardNames}>
            <span className={s.ghostTop}>
              <span className={s.cardName}>{node.name}</span>
              {node.later && <span className={s.laterPill}>Later</span>}
            </span>
            {!compact && <span className={s.would}>{node.would}</span>}
          </span>
        </button>
      ) : (
        <div className={s.cardHead}>
          <span className={s.tile}>
            <NodeGlyph g={node.glyph} />
          </span>
          <span className={s.cardNames}>
            <span className={s.cardName}>{node.name}</span>
            <span className={s.cardSub}>{node.sub}</span>
          </span>
        </div>
      )}
      {card.rows.map((r) => {
        const c = byId.get(r.conn);
        return c ? <Row key={r.conn} c={c} h={r.h} tone={rowTone(c)} ev={ev} withCount /> : null;
      })}
      {card.handle && !node.later && <PortHandle node={node} edge={edge} dashed={card.ghost} onDown={onHandleDown} onPick={ev.onPick} />}
    </div>
  );
}

/* ── a Signal app in the middle ──────────────────────────────────────── */

export function AppCard({
  card,
  conns,
  tone,
  ev,
  onHandleDown,
  target,
  empty,
}: {
  card: CardBox;
  conns: Conn[];
  tone: Tone;
  ev: CardEvents;
  onHandleDown?: (e: RPointerEvent<HTMLButtonElement>, node: NodeDef) => void;
  target?: boolean;
  empty?: boolean;
}) {
  const { node } = card;
  const ins = conns.filter((c) => c.to === node.id);
  const outs = conns.filter((c) => c.from === node.id);
  const inToday = ins.reduce((a, c) => a + (c.status === "live" ? c.today : 0), 0);
  const line = empty
    ? node.sub
    : ins.length + outs.length === 0
      ? "Nothing connected"
      : inToday > 0
        ? `${inToday} in today`
        : outs.length
          ? `Sends to ${plural(outs.length, "place", "places")}`
          : "Quiet today";
  return (
    <div
      className={cx(s.card, s.appCard, s[`tone_${tone}`], target && s.cardTarget)}
      style={{ transform: `translate(${card.x}px, ${card.y}px)`, width: card.w, height: card.h }}
      data-node={node.id}
      onPointerEnter={() => ev.onHover(ins.length + outs.length ? `node:${node.id}` : null)}
      onPointerLeave={() => ev.onHover(null)}
    >
      <span className={s.appTile}>
        <NodeGlyph g={node.glyph} />
      </span>
      <span className={s.cardNames}>
        <span className={s.cardName}>{node.name}</span>
        <span className={cx(s.cardSub, s.num)}>{line}</span>
      </span>
      {card.handle && <PortHandle node={node} edge="right" onDown={onHandleDown} onPick={ev.onPick} />}
    </div>
  );
}
