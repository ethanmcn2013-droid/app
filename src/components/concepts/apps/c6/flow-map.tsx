"use client";

import { useEffect, useMemo, useState, type PointerEvent as RPointerEvent } from "react";
import { type Conn, type Filter, type NodeDef } from "./data";
import { setMeasure, layoutDesktop, orthRoute, type CardBox } from "./layout";
import { lineTone, nodeTone } from "./model";
import { AppCard, SideCard, type CardEvents } from "./cards";
import { Wire, cx } from "./parts";
import { canvasMeasure, estimate, useIsClient } from "./measure";
import s from "./c6.module.css";

type Drag = { from: NodeDef; side: "in" | "out"; x0: number; y0: number; x: number; y: number; moved: boolean; over: string | null };

export function FlowMap({
  conns,
  filter,
  hi,
  reduced,
  empty,
  pending,
  ev,
  onDraw,
}: {
  conns: Conn[];
  filter: Filter;
  hi: string[];
  reduced: boolean;
  empty: boolean;
  pending: { from: string; to: string } | null;
  ev: CardEvents;
  onDraw: (from: string, to: string) => void;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(820);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  const live = useIsClient();
  const L = useMemo(() => {
    setMeasure(live ? canvasMeasure : estimate);
    return layoutDesktop(width, conns, { empty });
  }, [width, conns, empty, live]);
  const cardById = useMemo(() => new Map(L.cards.map((c) => [c.id, c])), [L]);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = el!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const targetAt = (x: number, y: number, side: "in" | "out"): string | null => {
    const pool = L.cards.filter((c) => (side === "in" ? c.node.side === "app" : c.node.side === "dest" && !c.node.later));
    const hit = pool.find((c) => x >= c.x - 14 && x <= c.x + c.w + 14 && y >= c.y - 10 && y <= c.y + c.h + 10);
    return hit ? hit.id : null;
  };

  const onHandleDown = (e: RPointerEvent<HTMLButtonElement>, node: NodeDef) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const card = cardById.get(node.id)!;
    const side = node.side === "app" ? "out" : "in";
    const p = toLocal(e);
    setDrag({ from: node, side, x0: card.handle!.x, y0: card.handle!.y, x: p.x, y: p.y, moved: false, over: null });
  };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const p = toLocal(e);
    const moved = drag.moved || Math.hypot(p.x - drag.x0, p.y - drag.y0) > 6;
    setDrag({ ...drag, x: p.x, y: p.y, moved, over: moved ? targetAt(p.x, p.y, drag.side) : null });
  };

  const onUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) ev.onPick(d.from.id);
    else if (d.over) onDraw(d.from.id, d.over);
  };

  // The line being drawn, or the one waiting on the question in the sheet.
  let ghostRoute: { d: string; snapped: boolean; end: { x: number; y: number } } | null = null;
  const routeTo = (fromCard: CardBox, toCard: CardBox, side: "in" | "out") => {
    const x1 = fromCard.handle!.x;
    const y1 = fromCard.handle!.y;
    const x2 = toCard.x;
    const y2 = toCard.y + Math.min(toCard.h / 2, 26);
    const [a, b] = side === "in" ? [L.cols.src[0] + L.cols.src[1], L.cols.app[0]] : [L.cols.app[0] + L.cols.app[1], L.cols.dest[0]];
    return { d: orthRoute("draft", x1, y1, x2, y2, (a + b) / 2).d, end: { x: x2, y: y2 } };
  };
  if (drag && drag.moved) {
    const fromCard = cardById.get(drag.from.id)!;
    if (drag.over) {
      const r = routeTo(fromCard, cardById.get(drag.over)!, drag.side);
      ghostRoute = { d: r.d, snapped: true, end: r.end };
    } else {
      const lane = drag.x0 + (drag.x - drag.x0) / 2;
      ghostRoute = { d: orthRoute("draft", drag.x0, drag.y0, drag.x, drag.y, lane, 8).d, snapped: false, end: { x: drag.x, y: drag.y } };
    }
  } else if (pending && cardById.get(pending.from) && cardById.get(pending.to)) {
    const fromCard = cardById.get(pending.from)!;
    const side = fromCard.node.side === "app" ? "out" : "in";
    const r = routeTo(fromCard, cardById.get(pending.to)!, side);
    ghostRoute = { d: r.d, snapped: true, end: r.end };
  }

  const connById = new Map(conns.map((c) => [c.id, c]));
  const bandBottom = Math.max(...L.cards.filter((c) => c.node.side === "app").map((c) => c.y + c.h)) + 14;
  const nodeT = (id: string) => (empty ? "normal" : nodeTone(id, conns, filter, hi));
  const rowTone = (c: Conn) => lineTone(c, filter, hi);
  const overId = drag?.over ?? pending?.to ?? null;

  return (
    <>
    <div className={s.colHeads} aria-hidden="true">
      <span style={{ left: L.cols.src[0], width: L.cols.src[1] }}>Comes in from</span>
      <span style={{ left: L.cols.app[0] - 14, width: L.cols.app[1] + 28, textAlign: "center" }}>Signal</span>
      <span style={{ left: L.cols.dest[0], width: L.cols.dest[1] }}>Goes out to</span>
    </div>
    <div
      ref={setEl}
      className={cx(s.map, drag?.moved && s.mapDrawing)}
      style={{ height: L.height }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => setDrag(null)}
    >
      <svg className={s.mapSvg} width={L.width} height={L.height} aria-hidden="true">
        {/* the Signal band behind the middle column */}
        <rect className={s.band} x={L.cols.app[0] - 14} y={-8} width={L.cols.app[1] + 28} height={bandBottom + 8} rx={16} />
        {Object.values(L.routes).map((r) => {
          const c = connById.get(r.id);
          if (!c) return null;
          return <Wire key={r.id} route={r} conn={c} tone={lineTone(c, filter, hi)} pathId={`c6-${r.id}`} reduced={reduced} onHover={ev.onHover} onOpen={ev.onOpen} />;
        })}
        {ghostRoute && (
          <g className={cx(s.draft, ghostRoute.snapped && s.draftSnapped)}>
            <path d={ghostRoute.d} />
            <circle cx={ghostRoute.end.x} cy={ghostRoute.end.y} r={4.5} />
          </g>
        )}
      </svg>
      {L.cards.map((card) =>
        card.node.side === "app" ? (
          <AppCard key={card.id} card={card} conns={conns} tone={nodeT(card.id)} ev={ev} onHandleDown={empty ? undefined : onHandleDown} target={overId === card.id} empty={empty} />
        ) : (
          <SideCard
            key={card.id}
            card={card}
            conns={conns}
            tone={card.ghost && !empty && filter !== "all" ? "dim" : nodeT(card.id)}
            rowTone={rowTone}
            ev={ev}
            edge={card.node.side === "source" ? "right" : "left"}
            onHandleDown={card.node.side === "source" ? onHandleDown : undefined}
            target={overId === card.id}
            compact={empty}
          />
        ),
      )}
    </div>
    </>
  );
}
