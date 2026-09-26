"use client";

/* The Line. A shared timeline drawn as a transit map: milestones are
   stations, strands of work are coloured lines that merge into the day,
   and small trains show where everything is right now. A public page for
   people with a link; front-end only, invented sample data. */

import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MOMENTS,
  WORLD_LABEL,
  WORLD_ORDER,
  arrived,
  buildScenario,
  dayMonth,
  dayNum,
  longDate,
  reachedCount,
  relative,
  upcoming,
  type MomentId,
  type WorldId,
} from "./data";
import { layoutH, layoutV } from "./layout";
import { MapH } from "./map-h";
import { MapV } from "./map-v";
import { Board } from "./board";
import { Key, StationCard, StopList } from "./card";
import { LineSwatch, StudioMark } from "./glyphs";
import s from "./c6.module.css";

const PAD_L = 56;
const PAD_R = 250;
const MIN_MAP_H = 330;

/* Phone or not, read from the viewport without an effect. */
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia("(max-width: 720px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const isPhoneNow = () => window.matchMedia("(max-width: 720px)").matches;

export default function Concept() {
  const [worldId, setWorldId] = useState<WorldId>("wedding");
  const [moment, setMoment] = useState<MomentId>("now");
  const [followId, setFollowId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<"near" | "whole">("near");
  const [animPx, setAnimPx] = useState<number | null>(null);
  const [frameW, setFrameW] = useState(1320);
  const [phoneW, setPhoneW] = useState(358);
  const reduced = Boolean(useReducedMotion());
  const phone = useSyncExternalStore(subscribePhone, isPhoneNow, () => false);

  const sc = buildScenario(worldId, moment);
  const key = `${worldId}-${moment}`;
  const next = upcoming(sc)[0] ?? null;
  const nextId = next?.id ?? null;
  const done = arrived(sc);
  const { done: reached, total } = reachedCount(sc);

  // Scale: comfortable by default, with the whole line one click away.
  const days = dayNum(sc.terminus.date) - dayNum(sc.start);
  const fitPx = Math.max(1.6, (frameW - PAD_L - PAD_R) / days);
  const nearPx = Math.min(16, Math.max(4.6, fitPx));
  const canZoom = fitPx < nearPx - 0.15;
  const px = animPx ?? (zoom === "whole" && canZoom ? fitPx : nearPx);
  const L = layoutH(sc, px, PAD_L, PAD_R, nextId);
  const V = layoutV(sc, phoneW);

  /* ── Measuring ── */
  const scroller = useRef<HTMLDivElement>(null);
  const phoneBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target === scroller.current && e.contentRect.width > 0) setFrameW(Math.round(e.contentRect.width));
        if (e.target === phoneBox.current && e.contentRect.width > 0) setPhoneW(Math.round(e.contentRect.width));
      }
    });
    if (scroller.current) ro.observe(scroller.current);
    if (phoneBox.current) ro.observe(phoneBox.current);
    return () => ro.disconnect();
  }, []);

  /* ── Where the view sits: today a little left of centre ── */
  const anchor = useRef<number | null>(null);
  const placedFor = useRef<string>("");
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current !== null) {
      el.scrollLeft = L.today.x - anchor.current;
      return;
    }
    const k = `${key}-${frameW > 0}`;
    if (placedFor.current !== k) {
      placedFor.current = k;
      el.scrollLeft = Math.max(0, L.today.x - el.clientWidth * 0.42);
    }
  }, [L, key, frameW]);

  const toggleZoom = () => {
    const el = scroller.current;
    const to = zoom === "near" ? fitPx : nearPx;
    anchor.current = el ? L.today.x - el.scrollLeft : null;
    setZoom(zoom === "near" ? "whole" : "near");
    setOpenId(null);
    if (reduced) {
      anchor.current = null;
      return;
    }
    animate(px, to, {
      duration: 0.65,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setAnimPx(v),
      onComplete: () => {
        setAnimPx(null);
        requestAnimationFrame(() => {
          anchor.current = null;
        });
      },
    });
  };

  const pan = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * 320, behavior: reduced ? "auto" : "smooth" });

  /* ── Drag to pan with a mouse; touch and trackpads scroll natively ── */
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current;
    if (!el) return;
    if ((e.target as Element).closest("[role=dialog]")) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.x;
      if (Math.abs(dx) > 4) {
        drag.current.moved = true;
        el.dataset.dragging = "";
      }
      el.scrollLeft = drag.current.left - dx;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      delete el.dataset.dragging;
      setTimeout(() => {
        drag.current = null;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ── Keys: Escape closes the card ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (w: WorldId, m: MomentId) => {
    setWorldId(w);
    setMoment(m);
    setFollowId(null);
    setOpenId(null);
    setHoverId(null);
    setZoom(m === "arrived" ? "whole" : "near");
    placedFor.current = "";
  };

  const follow = (id: string | null) => {
    setFollowId((cur) => (cur === id ? null : id));
    setOpenId(null);
  };

  const preview = hoverId ? sc.stations.find((st) => st.id === hoverId) ?? null : null;
  const open = openId ? sc.stations.find((st) => st.id === openId) ?? null : null;
  const openH = open ? L.stations.find((h) => h.station.id === open.id) ?? null : null;

  const moved = sc.stations.find((st) => st.movedFrom);
  const planned = sc.stations.some((st) => !st.firm && dayNum(st.date) > dayNum(sc.today));
  const lineWord = sc.lines.length === 1 ? "One line" : `${["", "One", "Two", "Three", "Four", "Five"][sc.lines.length]} lines`;

  let summary: string;
  if (done) summary = `${sc.terminus.title} came on ${longDate(sc.terminus.date)}. Every stop on the way is kept here.`;
  else if (moved) summary = `One stop moved later: ${moved.title} is now on ${dayMonth(moved.date)}. ${sc.terminus.title} is still ${dayMonth(sc.terminus.date)}.`;
  else if (moment === "early") summary = `It's early days. Most of the line is still a plan, and the dashed stretches will firm up as things are booked.`;
  else summary = `${lineWord} of work, all heading for ${dayMonth(sc.terminus.date)}. ${reached} of ${total} stops reached so far${next ? `, and ${next.title.toLowerCase()} is next, ${relative(sc.today, next.date)}` : ""}.`;

  const cardProps = {
    sc,
    nextId,
    followId,
    onClose: () => setOpenId(null),
    onFollow: (id: string) => follow(id),
  };

  // Where the desktop card sits: beside its stop, flipped near the end.
  let cardPos: { left: number; top: number } | null = null;
  if (openH) {
    const y = openH.points[0].y;
    const left = openH.x + 26 + 320 > L.width ? openH.x - 26 - 320 : openH.x + 26;
    const canvasH = Math.max(L.height, MIN_MAP_H);
    const offset = (canvasH - L.height) / 2;
    cardPos = { left: Math.max(8, left), top: Math.max(8, Math.min(y + offset - 70, canvasH - 290)) };
  }

  return (
    <div className={s.root} data-arrived={done ? "" : undefined} data-c6-root="">
      <div className={s.page}>
        <header className={s.head}>
          <div className={s.headText}>
            <p className={s.eyebrow}>{done ? "A keepsake of the way here" : sc.eyebrow}</p>
            <h1 className={s.h1}>{sc.h1}</h1>
            <p className={s.summary}>{summary}</p>
            <p className={s.byline}>
              Shared by {sc.sharedBy}
              <span aria-hidden="true"> · </span>
              {sc.updated}
            </p>
          </div>
          <div className={s.boardDesk}>
            <Board sc={sc} followId={followId} preview={preview} />
          </div>
        </header>

        <div className={s.boardPhone}>
          <Board sc={sc} followId={followId} preview={null} compact />
        </div>

        {sc.lines.length > 1 ? (
          <nav className={s.follow} aria-label="Follow a line">
            <span className={s.followLabel}>Follow a line</span>
            <div className={s.followChips}>
              {sc.lines.map((l) => {
                const c = reachedCount(sc, l.id);
                const on = followId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={s.followChip}
                    aria-pressed={on}
                    data-dim={followId && !on ? "" : undefined}
                    onClick={() => follow(l.id)}
                    title={l.whoFor}
                  >
                    <LineSwatch color={l.color} />
                    <span className={s.followName}>{l.name}</span>
                    <span className={s.followCount}>
                      <span className={s.num}>{c.done}</span>/<span className={s.num}>{c.total}</span>
                    </span>
                  </button>
                );
              })}
              {followId ? (
                <button type="button" className={s.linkBtn} onClick={() => follow(null)}>
                  Show every line
                </button>
              ) : null}
            </div>
          </nav>
        ) : null}

        <section className={s.mapFrame} aria-label="The map">
          <div className={s.mapDesk}>
            <div className={s.mapBar}>
              <p className={s.mapHint}>
                {canZoom && zoom === "near" ? "Drag, scroll sideways or use the arrow keys to move along the line." : "The whole line, start to finish."}
              </p>
              <div className={s.mapTools}>
                {canZoom && zoom === "near" ? (
                  <>
                    <button type="button" className={s.iconBtn} onClick={() => pan(-1)} aria-label="Move earlier">
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M10 3.5L5.5 8l4.5 4.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button type="button" className={s.iconBtn} onClick={() => pan(1)} aria-label="Move later">
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M6 3.5L10.5 8 6 12.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                ) : null}
                {canZoom ? (
                  <button type="button" className={s.toolBtn} onClick={toggleZoom} aria-pressed={zoom === "whole"}>
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      {zoom === "near" ? (
                        <path d="M2.5 6V3.5a1 1 0 011-1H6M10 2.5h2.5a1 1 0 011 1V6M13.5 10v2.5a1 1 0 01-1 1H10M6 13.5H3.5a1 1 0 01-1-1V10" strokeWidth="1.5" strokeLinecap="round" />
                      ) : (
                        <path d="M6 2.5V5a1 1 0 01-1 1H2.5M13.5 6H11a1 1 0 01-1-1V2.5M10 13.5V11a1 1 0 011-1h2.5M2.5 10H5a1 1 0 011 1v2.5" strokeWidth="1.5" strokeLinecap="round" />
                      )}
                    </svg>
                    {zoom === "near" ? "Show the whole line" : done ? "Look closer" : "Back to today"}
                  </button>
                ) : null}
                {done ? (
                  <button type="button" className={s.toolBtn} onClick={() => window.print()}>
                    Print the map
                  </button>
                ) : null}
              </div>
            </div>
            <div
              ref={scroller}
              data-c6-scroller=""
              className={s.scroller}
              tabIndex={0}
              role="region"
              aria-label="Map, move along it with the arrow keys"
              data-pannable={canZoom && zoom === "near" ? "" : undefined}
              onPointerDown={onPointerDown}
              onClickCapture={(e) => {
                if (drag.current?.moved) {
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }
                const t = e.target as Element;
                if (!t.closest("[data-station]") && !t.closest("[role=dialog]")) setOpenId(null);
              }}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  pan(e.key === "ArrowLeft" ? -1 : 1);
                }
              }}
            >
              <div className={s.canvas} style={{ width: L.width, height: Math.max(L.height, MIN_MAP_H) }}>
                <MapH
                  key={key}
                  L={L}
                  sc={sc}
                  nextId={nextId}
                  followId={followId}
                  hoverId={hoverId}
                  openId={openId}
                  reduced={reduced}
                  onHover={setHoverId}
                  onOpen={(id) => setOpenId((cur) => (cur === id ? null : id))}
                />
                <AnimatePresence>
                  {open && cardPos && !phone ? (
                    <motion.div
                      key={open.id}
                      className={s.cardPop}
                      style={{ left: cardPos.left, top: cardPos.top }}
                      initial={reduced ? false : { opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <StationCard {...cardProps} st={open} id="c6-card" />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className={s.mapPhone} ref={phoneBox}>
            <MapV
              key={key}
              V={V}
              sc={sc}
              nextId={nextId}
              followId={followId}
              hoverId={null}
              openId={openId}
              reduced={reduced}
              onHover={() => {}}
              onOpen={(id) => setOpenId(id)}
            />
          </div>
          <Key planned={planned} />
        </section>

        <StopList sc={sc} nextId={nextId} followId={followId} onOpen={(id) => setOpenId(id)} onFollow={(id) => setFollowId(id)} />

        <footer className={s.foot}>
          <p className={s.footShared}>
            Shared with you by {sc.sharedBy}. This page updates as plans change, so the link always shows the latest.
          </p>
          <p className={s.footMark}>
            <StudioMark />
            Made with Signal Studio
          </p>
        </footer>
      </div>

      <AnimatePresence>
        {open && phone ? (
          <motion.div key="sheet" className={s.sheetWrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.2 }}>
            <button type="button" className={s.scrim} aria-label="Close" onClick={() => setOpenId(null)} />
            <motion.div
              className={s.sheet}
              initial={reduced ? false : { y: 40 }}
              animate={{ y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: 40 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <span className={s.sheetGrip} aria-hidden="true" />
              <StationCard {...cardProps} st={open} id="c6-sheet" />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ConceptBar worldId={worldId} moment={moment} onChange={choose} />
    </div>
  );
}

/* ── Reviewer controls (concept only, not part of the shared page) ── */

function ConceptBar({ worldId, moment, onChange }: { worldId: WorldId; moment: MomentId; onChange: (w: WorldId, m: MomentId) => void }) {
  return (
    <details className={s.concept} data-concept-bar="">
      <summary className={s.conceptTag}>
        Concept preview · {WORLD_LABEL[worldId]} · {MOMENTS.find((m) => m.id === moment)?.label}
      </summary>
      <div className={s.conceptBody}>
      <label className={s.conceptField}>
        <span className={s.conceptLabel}>Story</span>
        <select className={s.conceptSelect} value={worldId} onChange={(e) => onChange(e.target.value as WorldId, moment)} data-concept="world">
          {WORLD_ORDER.map((w) => (
            <option key={w} value={w}>
              {WORLD_LABEL[w]}
            </option>
          ))}
        </select>
      </label>
      <label className={s.conceptField}>
        <span className={s.conceptLabel}>Moment</span>
        <select className={s.conceptSelect} value={moment} onChange={(e) => onChange(worldId, e.target.value as MomentId)} data-concept="moment">
          {MOMENTS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      </div>
    </details>
  );
}
