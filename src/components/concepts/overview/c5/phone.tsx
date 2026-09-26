"use client";

import { useCallback, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { LINES, NETWORK, NET_SHARED, PEOPLE, TODAY, fmtDay, type LineId, type Model } from "./data";
import { RouteMap } from "./route-map";
import { layout } from "./geometry";
import { Arrived, DepotPanel, LineStrip, NextStops, ServiceUpdates, StarterRoutes, WrapUp } from "./rail";
import { Avatar } from "./cards";
import { IconClose, IconExpand, IconMinus, IconPlus } from "./icons";
import styles from "./c5.module.css";

/**
 * Phone: service updates lead, a mini-map opens full screen with pinch zoom,
 * and each line is its own vertical strip you swipe between.
 */
export function PhoneView({ model, scope, onImpact }: { model: Model; scope: "project" | "all"; onImpact: (id: string | null) => void }) {
  const [active, setActive] = useState(0);
  const [full, setFull] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  if (scope === "all") return <PhoneNetwork />;

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  };

  return (
    <div className={styles.phone}>
      {model.variant !== "empty" ? (
        <button type="button" className={styles.miniMap} onClick={() => setFull(true)} aria-label="Open the route map full screen">
          <RouteMap model={model} W={900} focusLine={null} onFocusLine={() => {}} impactFrom={null} journey={false} onJourney={() => {}} playT={null} thumbnail />
          <span className={styles.miniOpen}>
            <IconExpand size={13} /> Open map
          </span>
        </button>
      ) : null}

      <ServiceUpdates model={model} onImpact={onImpact} onFocusLine={(l) => l && goTo(LINES.findIndex((x) => x.id === l))} focusLine={null} />

      {model.variant !== "empty" ? (
        <section className={styles.panel} aria-label="Lines">
          <div className={styles.lineTabs} role="tablist" aria-label="Choose a line">
            {LINES.map((l, i) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={active === i}
                className={styles.lineTab}
                style={{ ["--lc" as string]: l.color }}
                onClick={() => goTo(i)}
              >
                <span className={styles.lineSwatch} style={{ background: l.color }} />
                {l.short}
              </button>
            ))}
          </div>
          <div
            ref={track}
            className={styles.stripTrack}
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== active) setActive(i);
            }}
          >
            {LINES.map((l) => (
              <div key={l.id} className={styles.stripSlide}>
                <LineStrip model={model} line={l.id as LineId} />
              </div>
            ))}
          </div>
          <div className={styles.dots} aria-hidden>
            {LINES.map((l, i) => (
              <span key={l.id} className={styles.dot} data-on={active === i || undefined} />
            ))}
          </div>
        </section>
      ) : null}

      {model.variant === "empty" ? (
        <>
          <DepotPanel />
          <StarterRoutes />
        </>
      ) : model.variant === "after" ? (
        <>
          <WrapUp />
          <Arrived model={model} />
        </>
      ) : (
        <>
          <NextStops model={model} />
          <Arrived model={model} />
        </>
      )}

      {full ? <FullMap model={model} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

const FULL_W = 1000;
/** Below this the map shows the whole route; stop names wait for a closer zoom. */
const FAR = 0.6;

function FullMap({ model, onClose }: { model: Model; onClose: () => void }) {
  // Open at reading size, scrolled so today sits a third of the way in: stop
  // names are legible straight away and the route ahead is to the right.
  // "Whole route" fits it to the width.
  const [fit] = useState(() => Math.max(0.3, Math.min(1, (window.innerWidth - 8) / FULL_W)));
  const [scale, setScale] = useState(1);
  /* horizontal scroll, so line names can stay pinned to the left edge */
  const [sx, setSx] = useState(0);
  const scroller = useRef<HTMLDivElement | null>(null);
  const todayX = layout(FULL_W, model.stations).x(model.today);
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      if (el) el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.34);
    },
    // Only on open: later zooms keep the reader's place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const clamp = (s: number) => Math.min(1.6, Math.max(fit, s));
  /* double-tap: zoom to full size around the tapped point, or back out */
  const onDouble = (e: React.MouseEvent) => {
    const el = scroller.current;
    if (!el) return;
    if (scale > fit + 0.05) {
      setScale(fit);
      return;
    }
    const r = el.getBoundingClientRect();
    const cx = (e.clientX - r.left + el.scrollLeft) / scale;
    const cy = (e.clientY - r.top + el.scrollTop) / scale;
    setScale(1);
    requestAnimationFrame(() => {
      el.scrollTo({ left: cx - el.clientWidth / 2, top: cy - el.clientHeight / 2 });
    });
  };
  const dist = () => {
    const [a, b] = [...pts.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const down = (e: RPointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) pinch.current = { d: dist(), s: scale };
  };
  const move = (e: RPointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pts.current.size === 2) setScale(clamp((pinch.current.s * dist()) / pinch.current.d));
  };
  const up = (e: RPointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
  };
  const W = FULL_W;
  return (
    <div className={styles.fullMap} role="dialog" aria-modal="true" aria-label="Route map">
      <div className={styles.fullBar}>
        <strong>The Orchard route</strong>
        <div className={styles.fullZoom}>
          <button type="button" className={styles.iconBtn} onClick={() => setScale((s) => clamp(s - 0.15))} aria-label="Zoom out">
            <IconMinus />
          </button>
          <button type="button" className={styles.fitBtn} onClick={() => setScale((s) => (s <= fit + 0.01 ? 1 : fit))} aria-pressed={scale <= fit + 0.01}>
            Whole route
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => setScale((s) => clamp(s + 0.15))} aria-label="Zoom in">
            <IconPlus />
          </button>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close the map">
            <IconClose />
          </button>
        </div>
      </div>
      <div ref={attach} className={styles.fullScroll} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={onDouble} onScroll={(e) => setSx(e.currentTarget.scrollLeft)}>
        <div style={{ width: W * scale, height: 560 * scale, margin: "auto 0", flex: "none" }}>
          <div
            className={styles.fullZoomLayer}
            data-far={scale < FAR || undefined}
            data-stuck={(scale >= FAR && sx > 24) || undefined}
            style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: W, ["--ls" as string]: String(scale < FAR ? Math.min(2.2, 0.8 / scale) : 1), ["--sx" as string]: `${sx / scale}px` }}
          >
            <RouteMap model={model} W={W} focusLine={null} onFocusLine={() => {}} impactFrom={null} journey={false} onJourney={() => {}} playT={null} />
          </div>
        </div>
      </div>
      <p className={styles.fullHint}>{scale < FAR ? "Double-tap anywhere to read the stops there. Turn your phone for more room." : "Pinch or use the buttons to zoom. Double-tap to see the whole route."}</p>
    </div>
  );
}

function PhoneNetwork() {
  return (
    <div className={styles.phone}>
      <section className={styles.panel} aria-labelledby="c5-pn">
        <div className={styles.panelHead}>
          <h2 id="c5-pn" className={styles.panelTitle}>
            All lines
          </h2>
          <span className={styles.muted}>5 projects</span>
        </div>
        <ul className={styles.netList}>
          {[...NETWORK]
            .sort((a, b) => a.date - b.date)
            .map((p) => {
              const span = p.date - (TODAY - 24);
              const pos = (d: number) => `${Math.max(0, Math.min(100, ((d - (TODAY - 24)) / span) * 100))}%`;
              return (
                <li key={p.id} className={styles.netRow} style={{ ["--lc" as string]: p.color }}>
                  <div className={styles.updateTop}>
                    <span className={styles.updateLine}>{p.name}</span>
                    <span className={styles.toneTag} data-tone={p.tone}>
                      {p.tone === "held" ? "Held" : p.tone === "minor" ? "Minor delays" : "Good service"}
                    </span>
                  </div>
                  <div className={styles.netMini} aria-hidden>
                    <span className={styles.netMiniLine} />
                    <span className={styles.netMiniToday} style={{ left: pos(TODAY) }} />
                    {p.stops.map((s) => (
                      <span key={s.name} className={styles.netMiniStop} data-done={s.done || undefined} data-held={s.held || undefined} style={{ left: pos(s.date) }} />
                    ))}
                    <span className={styles.netMiniTerm} />
                  </div>
                  <div className={styles.rowMeta}>
                    {p.terminus}, {fmtDay(p.date)} · {p.status}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
      <section className={styles.panel} aria-labelledby="c5-pi">
        <div className={styles.panelHead}>
          <h2 id="c5-pi" className={styles.panelTitle}>
            Interchanges
          </h2>
        </div>
        <ul className={styles.rows}>
          {NET_SHARED.map((s) => (
            <li key={s.person} className={styles.row}>
              <Avatar id={s.person} size={24} />
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{PEOPLE[s.person].full}</span>
                <span className={styles.rowMeta}>{s.what}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
