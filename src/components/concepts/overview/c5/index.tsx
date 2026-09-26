"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LINES, LINE_BY_ID, TERMINUS, TODAY, WEEK_AGO, day, fmtDay, getModel, type LineId, type Variant } from "./data";
import { RouteMap } from "./route-map";
import { NetworkMap } from "./network-map";
import { Arrived, ArrivalPanel, LineStrip, NetworkUpdates, NextStops, ServiceUpdates, StarterRoutes, WrapUp } from "./rail";
import { PhoneView } from "./phone";
import { JourneyCard } from "./cards";
import { IconChevron, IconPause, IconPlay, IconRoute } from "./icons";
import styles from "./c5.module.css";

/**
 * Overview, concept 5: the route map.
 *
 * A project is a set of workstreams converging on one destination. Each
 * workstream is a line, milestones are stops, people ride their lines, and a
 * held stop visibly holds up everything downstream of it.
 */

const VARIANTS: Array<{ id: Variant; label: string; hint: string }> = [
  { id: "live", label: "Today", hint: "One line held, one stop late" },
  { id: "good", label: "Good service", hint: "Everything on time" },
  { id: "empty", label: "No stops yet", hint: "A new project with a depot" },
  { id: "after", label: "The day after", hint: "Every stop reached" },
];

const REPLAY_EVENTS = [
  { at: day(7, 13), text: "Band set list agreed", line: "suppliers" as LineId },
  { at: day(7, 14), text: "Tonic and olives slipped past their date", line: "food" as LineId },
  { at: day(7, 15), text: "Deposit settled", line: "admin" as LineId },
  { at: day(7, 15) + 0.5, text: "Open day reached, nine couples through", line: "venue" as LineId },
  { at: day(7, 16), text: "14 more RSVPs in", line: "guests" as LineId },
];

const REPLAY_MS = 6000;
/** Narrower than this and the map scrolls sideways rather than squeezing. */
const MIN_MAP_W = 560;

export default function RouteMapOverview() {
  const [scope, setScope] = useState<"project" | "all">("project");
  const [variant, setVariant] = useState<Variant>("live");
  const [focusLine, setFocusLineRaw] = useState<LineId | null>(null);
  const [impactFrom, setImpactFrom] = useState<string | null>(null);
  const [journey, setJourney] = useState(false);
  const [playT, setPlayT] = useState<number | null>(null);
  // Unknown until the canvas is measured: the map draws at its true width or not at all.
  const [W, setW] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);

  const model = useMemo(() => getModel(variant), [variant]);

  // Line focus and the journey are two views of the map: only one at a time.
  const setFocusLine = (l: LineId | null) => {
    setFocusLineRaw(l);
    if (l) setJourney(false);
  };
  const revealJourney = () =>
    requestAnimationFrame(() => document.getElementById("c5-journey")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  const toggleJourney = (open?: boolean) => {
    const next = open ?? !journey;
    setJourney(next);
    setFocusLineRaw(null);
    if (next) revealJourney();
  };
  const raf = useRef<number | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure the map so it renders at true pixel size. A callback ref, so the
  // observer follows the element itself rather than a mount-time snapshot.
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = Math.floor(el.getBoundingClientRect().width);
        if (w > 0) setW(Math.max(w, MIN_MAP_W));
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (done.current) clearTimeout(done.current);
    },
    [],
  );

  const stopPlay = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (done.current) clearTimeout(done.current);
    raf.current = null;
    setPlayT(null);
  };

  const play = () => {
    if (raf.current || playT != null) return stopPlay();
    setJourney(false);
    setFocusLine(null);
    setScope("project");
    if (variant !== "live") setVariant("live");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const raw = Math.min(1, (now - start) / REPLAY_MS);
      const t = reduce ? Math.floor(raw * 7) / 7 : raw;
      setPlayT(t);
      if (raw < 1) raf.current = requestAnimationFrame(tick);
      else {
        raf.current = null;
        done.current = setTimeout(() => setPlayT(null), 3200);
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  // Keyboard: P replays the week, J opens the journey, 1 to 5 zoom to a line.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setJourney(false);
        setFocusLineRaw(null);
        setMenu(false);
        return;
      }
      if (scope !== "project" || variant === "empty") return;
      if (e.key === "j") document.getElementById("c5-journey-btn")?.click();
      if (e.key === "p" && variant !== "after") document.getElementById("c5-play")?.click();
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        setFocusLineRaw((f) => (f === LINES[n - 1].id ? null : LINES[n - 1].id));
        setJourney(false);
      }
      if (e.key === "0") setFocusLineRaw(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scope, variant]);

  const playDay = playT == null ? null : WEEK_AGO + 7 * playT;
  const lastEvent = playDay == null ? null : [...REPLAY_EVENTS].reverse().find((e) => e.at <= playDay);
  const status: { tone: string; lead: string; rest: string; link?: string } =
    scope === "all" ? { tone: "held", lead: "Five projects running.", rest: "One is held: The Orchard, at the menu tasting." } : model.statusLine;
  const [restBefore, restAfter] = status.link ? status.rest.split(status.link) : [status.rest, ""];
  const weekDone = Object.values(model.stations).filter((s) => s.status === "done" && (s.doneOn ?? 0) > WEEK_AGO && (s.doneOn ?? 0) <= TODAY);
  const stillLines = LINES.filter((l) => !weekDone.some((s) => s.lines.includes(l.id))).map((l) => l.name);

  const pickVariant = (v: Variant) => {
    stopPlay();
    setVariant(v);
    setJourney(false);
    setFocusLineRaw(null);
    setMenu(false);
  };

  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.headRow}>
          <div className={styles.titleGroup}>
            <h1 className={styles.h1}>Overview</h1>
            <div className={styles.scope} role="radiogroup" aria-label="Scope">
              <button type="button" role="radio" aria-checked={scope === "project"} className={styles.scopeBtn} onClick={() => setScope("project")}>
                <span className={styles.projectTile} aria-hidden>
                  O
                </span>
                The Orchard
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === "all"}
                className={styles.scopeBtn}
                onClick={() => {
                  stopPlay();
                  setJourney(false);
                  setScope("all");
                }}
              >
                All projects
              </button>
            </div>
          </div>
          <div className={styles.headActions}>
            <div className={styles.menuWrap}>
              <button type="button" className={styles.btn} data-variant="ghost" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}>
                <span className={styles.muted}>State</span> {VARIANTS.find((v) => v.id === variant)?.label}
                <IconChevron size={13} />
              </button>
              {menu ? (
                <div className={styles.menu} role="menu" aria-label="Preview a state">
                  <div className={styles.menuLabel}>Preview a state of this project</div>
                  {VARIANTS.map((v) => (
                    <button key={v.id} type="button" role="menuitemradio" aria-checked={variant === v.id} className={styles.menuItem} onClick={() => pickVariant(v.id)}>
                      <span className={styles.menuItemLabel}>{v.label}</span>
                      <span className={styles.muted}>{v.hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className={styles.status} data-tone={status.tone}>
          <span className={styles.statusDot} aria-hidden />
          <span>
            <strong>{status.lead}</strong> {restBefore}
            {status.link ? (
              <>
                <button type="button" className={styles.statusLink} aria-expanded={journey} onClick={() => toggleJourney(true)}>
                  {status.link}
                </button>
                {restAfter}
              </>
            ) : null}
          </span>
        </p>
      </header>

      <div className={styles.body} data-scope={scope}>
        <section className={styles.mapCard} aria-label={scope === "all" ? "Network of all projects" : "Route map"}>
          <div className={styles.toolbar}>
            {playT != null ? (
              <div className={styles.replay} role="status" aria-live="polite">
                <span className={styles.replayDate}>{fmtDay(Math.floor(playDay!))}</span>
                <span className={styles.replayTrack}>
                  <span className={styles.replayFill} style={{ width: `${playT * 100}%` }} />
                </span>
                <span className={styles.replayEvent} key={playT >= 1 ? "summary" : (lastEvent?.text ?? "start")}>
                  {playT >= 1 ? (
                    <span className={styles.replaySummary}>
                      <strong className={styles.strong}>This week: {weekDone.length} stops reached.</strong> {stillLines.length ? `${stillLines.slice(0, 2).join(" and ")} did not reach a stop.` : ""}
                    </span>
                  ) : lastEvent ? (
                    <>
                      <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[lastEvent.line].color }} />
                      {lastEvent.text}
                    </>
                  ) : (
                    "Replaying the last seven days"
                  )}
                </span>
              </div>
            ) : (
              <div className={styles.toolbarTitle}>
                {scope === "all" ? (
                  <>
                    <strong>All lines</strong>
                    <span className={styles.muted}>5 projects · 3 people on two lines</span>
                  </>
                ) : focusLine ? (
                  <>
                    <strong>{LINE_BY_ID[focusLine].name} line</strong>
                    <button type="button" className={styles.linkBtn} onClick={() => setFocusLine(null)}>
                      Show all lines
                    </button>
                  </>
                ) : (
                  <>
                    <strong>The Orchard route</strong>
                    <span className={styles.muted}>
                      {variant === "empty" ? "No stops yet" : `${Object.keys(model.stations).length} stops on 5 lines to ${TERMINUS.name.toLowerCase()}`}
                    </span>
                  </>
                )}
              </div>
            )}
            {scope === "project" && variant !== "empty" ? (
              <div className={styles.toolbarActions}>
                <button id="c5-journey-btn" type="button" className={styles.btn} data-variant="ghost" aria-pressed={journey} onClick={() => toggleJourney()}>
                  <IconRoute size={14} /> Journey
                  <kbd className={styles.kbd}>J</kbd>
                </button>
                {variant === "after" ? null : (
                <button id="c5-play" type="button" className={styles.btn} data-variant={playT != null ? "ghost" : "solid"} onClick={play}>
                  {playT != null ? <IconPause size={13} /> : <IconPlay size={13} />}
                  {playT != null ? "Stop" : "Play the week"}
                  <kbd className={styles.kbd}>P</kbd>
                </button>
                )}
              </div>
            ) : null}
          </div>

          <div ref={measureRef} className={styles.canvas}>
            {W == null ? null : scope === "all" ? (
              <NetworkMap
                W={W}
                onOpen={() => {
                  setScope("project");
                  setVariant("live");
                }}
              />
            ) : (
              <RouteMap
                model={model}
                W={W}
                focusLine={focusLine}
                onFocusLine={setFocusLine}
                impactFrom={impactFrom}
                journey={journey}
                onJourney={(o) => toggleJourney(o)}
                playT={playT}
              />
            )}
          </div>

          {scope === "project" && variant === "empty" ? null : <Legend scope={scope} arrived={scope === "project" && variant === "after"} held={scope === "all" || variant === "live"} />}
        </section>

        <aside className={styles.rail} aria-label="Service updates and stops">
          {scope === "all" ? (
            <NetworkUpdates />
          ) : (
            <>
              {variant === "after" && !focusLine && !journey ? <ArrivalPanel total={Object.keys(model.stations).length} /> : null}
              {journey ? (
                <JourneyCard
                  model={model}
                  reached={Object.values(model.stations).filter((s) => s.status === "done").length}
                  total={Object.keys(model.stations).length}
                  daysToGo={TERMINUS.date - model.today}
                  onClose={() => setJourney(false)}
                />
              ) : focusLine ? (
                <LineStrip model={model} line={focusLine} onBack={() => setFocusLine(null)} />
              ) : (
                <ServiceUpdates model={model} onImpact={setImpactFrom} onFocusLine={setFocusLine} focusLine={focusLine} />
              )}
              {variant === "empty" ? (
                <StarterRoutes />
              ) : variant === "after" && !focusLine ? (
                <>
                  <WrapUp />
                  <Arrived model={model} />
                </>
              ) : (
                <>
                  <NextStops model={model} line={focusLine} />
                  {focusLine ? null : <Arrived model={model} />}
                </>
              )}
            </>
          )}
        </aside>

        <div className={styles.phoneOnly}>
          <PhoneView model={model} scope={scope} onImpact={setImpactFrom} />
        </div>
      </div>
    </div>
  );
}

function Legend({ scope, arrived, held }: { scope: "project" | "all"; arrived?: boolean; held: boolean }) {
  const project = scope === "project";
  return (
    <div className={styles.legend}>
      <ul className={styles.legendList} aria-label="How to read the map">
        <li>
          <svg width="16" height="16" aria-hidden>
            <circle cx="8" cy="8" r="5.5" className={styles.lgDone} />
          </svg>
          Reached
        </li>
        <li>
          <svg width="16" height="16" aria-hidden>
            <circle cx="8" cy="8" r="5" className={styles.lgOpen} />
          </svg>
          Coming up
        </li>
        {!held ? null : (
          <li>
            <svg width="30" height="16" aria-hidden>
              <path d="M 2 8 H 28" className={styles.lgHeld} />
            </svg>
            Held
          </li>
        )}
        {project && held ? (
          <li>
            <svg width="30" height="16" aria-hidden>
              <path d="M 4 8 H 26" className={styles.lgRisk} />
              <path d="M 4 8 H 26" className={styles.lgRiskLine} />
            </svg>
            Held up by it
          </li>
        ) : null}
        {project && !arrived ? (
          <li>
            <svg width="30" height="16" aria-hidden>
              <path d="M 4 8 H 26" className={styles.lgCritical} />
            </svg>
            Decides the date
          </li>
        ) : null}
        <li>
          <svg width="16" height="22" aria-hidden>
            <rect x="3" y="2" width="10" height="18" rx="5" className={styles.lgInter} />
          </svg>
          {project ? "Lines meet" : "A person on two projects"}
        </li>
        {project && !arrived ? (
          <li>
            <span className={styles.lgToken}>NB</span>
            Who is where
          </li>
        ) : null}
      </ul>
      <span className={styles.legendNote}>{project ? "Weeks narrow further out. Tab to a stop, then use the arrow keys." : "Hover a person to see the two projects they link."}</span>
    </div>
  );
}
