"use client";

import { useEffect, useMemo, useState } from "react";
import { type Conn, type Filter } from "./data";
import { setMeasure, layoutStrip } from "./layout";
import { lineTone, nodeTone } from "./model";
import { AppCard, SideCard, type CardEvents } from "./cards";
import { Wire } from "./parts";
import { canvasMeasure, estimate, useIsClient } from "./measure";
import s from "./c6.module.css";

const SECTION_TITLE = { from: "Comes in from", signal: "Your Signal apps", to: "Goes out to" } as const;
const SECTION_SUB = {
  from: "Where things start",
  signal: "Where they land",
  to: "Where they are sent",
} as const;

/** The phone map: the same system turned on its side, with the lines running down a
    gutter on the left like a line on a transit strip map. */
export function StripMap({ conns, filter, hi, reduced, empty, ev }: { conns: Conn[]; filter: Filter; hi: string[]; reduced: boolean; empty: boolean; ev: CardEvents }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(358);
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
    return layoutStrip(width, conns, { empty });
  }, [width, conns, empty, live]);
  const connById = new Map(conns.map((c) => [c.id, c]));
  const nodeT = (id: string) => (empty ? "normal" : nodeTone(id, conns, filter, hi));

  return (
    <div ref={setEl} className={s.strip} style={{ height: L.height }}>
      <svg className={s.mapSvg} width={L.width} height={L.height} aria-hidden="true">
        {Object.values(L.routes).map((r) => {
          const c = connById.get(r.id);
          if (!c) return null;
          return <Wire key={r.id} route={r} conn={c} tone={lineTone(c, filter, hi)} pathId={`c6s-${r.id}`} reduced={reduced} thin onHover={ev.onHover} onOpen={ev.onOpen} />;
        })}
      </svg>
      {L.sections.map((sec) => (
        <div key={sec.id} className={s.stripHead} style={{ transform: `translateY(${sec.y}px)`, paddingLeft: L.gutter }}>
          <h2 className={s.stripTitle}>{SECTION_TITLE[sec.id]}</h2>
          <span className={s.stripSub}>{SECTION_SUB[sec.id]}</span>
        </div>
      ))}
      {L.cards.map((card) =>
        card.node.side === "app" ? (
          <AppCard key={card.id} card={card} conns={conns} tone={nodeT(card.id)} ev={ev} empty={empty} />
        ) : (
          <SideCard
            key={card.id}
            card={card}
            conns={conns}
            tone={card.ghost && !empty && filter !== "all" ? "dim" : nodeT(card.id)}
            rowTone={(c) => lineTone(c, filter, hi)}
            ev={ev}
            edge="left"
            compact={empty}
          />
        ),
      )}
    </div>
  );
}
