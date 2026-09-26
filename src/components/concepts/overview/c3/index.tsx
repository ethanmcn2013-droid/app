"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CAUSES, DIMENSIONS, LAST_WEEK, PEOPLE, TODAY, type DimId } from "./data";
import { Icon, MarkShape } from "./icons";
import { AtlasMatrix } from "./matrix";
import {
  buildView,
  level,
  markFor,
  peopleFor,
  previewClause,
  relatedKeys,
  remedyById,
  rowsFor,
  verdict,
  type Scope,
  type Selection,
} from "./model";
import { PeopleLoadStrip } from "./people-load";
import { PhoneAtlas } from "./phone-atlas";
import { LookFirstInline, WhyPanel } from "./why-panel";
import s from "./atlas.module.css";

type Load = [number, number, number];

function addLoads(base: Record<string, Load>, deltas: Record<string, Load> | undefined) {
  if (!deltas) return base;
  const out = { ...base };
  for (const [id, d] of Object.entries(deltas)) {
    const b = out[id];
    if (b) out[id] = [Math.max(0, b[0] + d[0]), Math.max(0, b[1] + d[1]), Math.max(0, b[2] + d[2])];
  }
  return out;
}

/** Only The Orchard has workstreams in this sample. */
const DRILLABLE = new Set(["orchard"]);

export default function HealthAtlas() {
  const [scope, setScope] = useState<Scope>("all");
  const [compare, setCompare] = useState(false);
  const [calm, setCalm] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [focus, setFocus] = useState({ r: 0, c: 0 });
  const [applied, setApplied] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [hlDim, setHlDim] = useState<DimId | null>(null);
  const [hlPerson, setHlPerson] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [help, setHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);
  const matrixRef = useRef<HTMLDivElement | null>(null);

  const rows = rowsFor(scope);
  const view = useMemo(() => buildView({ rows, calm, applied, compare, preview }), [rows, calm, applied, compare, preview]);
  // The verdict never moves under the cursor: it reads the atlas without the preview.
  const settled = useMemo(() => (preview ? buildView({ rows, calm, applied, compare, preview: null }) : view), [rows, calm, applied, compare, preview, view]);

  // Tracing: a selected cell or person, or a hovered name in the verdict.
  const traceSel = useMemo<Selection>(() => selection ?? (hlPerson ? { kind: "person", id: hlPerson } : null), [selection, hlPerson]);
  const related = useMemo(() => relatedKeys(settled, traceSel), [settled, traceSel]);
  const tracing = Boolean(traceSel);
  const selectedKey = selection?.kind === "cell" ? selection.key : null;
  const selectedCell = selectedKey ? settled.flat().find((c) => c.key === selectedKey) : null;
  const highlightPeople = selectedCell
    ? peopleFor(selectedCell.causes)
    : traceSel?.kind === "person"
      ? new Set([traceSel.id])
      : new Set<string>();

  // For each related cell, the cause it shares with the selection, in words.
  const relatedVia = (() => {
    const out = new Map<string, string>();
    const selCauses =
      traceSel?.kind === "cell"
        ? (selectedCell?.causes ?? [])
        : traceSel?.kind === "person"
          ? Object.values(CAUSES)
              .filter((c) => c.person === traceSel.id)
              .map((c) => c.id)
          : [];
    for (const c of settled.flat()) {
      if (!related.has(c.key)) continue;
      const shared = c.causes.find((x) => selCauses.includes(x));
      if (shared) out.set(c.key, CAUSES[shared]?.label ?? shared);
    }
    return out;
  })();

  const baseLoads = useMemo(() => {
    let out: Record<string, Load> = Object.fromEntries(PEOPLE.map((p) => [p.id, p.load]));
    if (calm) return out;
    for (const id of applied) out = addLoads(out, remedyById(id)?.effect.people);
    return out;
  }, [applied, calm]);
  const previewPeople = preview ? remedyById(preview)?.effect.people : undefined;
  const previewLoads = previewPeople ? addLoads(baseLoads, previewPeople) : null;
  const previewIds = new Set(Object.keys(previewPeople ?? {}));

  const v = verdict(settled, scope, compare);
  const clause = preview && !compare ? previewClause(v, verdict(view, scope, compare), scope) : null;

  const selectKey = (key: string | null) => {
    setPreview(null);
    setSelection(key ? { kind: "cell", key } : null);
    if (key) {
      for (let r = 0; r < view.length; r++) {
        const c = view[r].findIndex((x) => x.key === key);
        if (c >= 0) setFocus({ r, c });
      }
      // Where the panel docks as a drawer, lift the grid so the trace stays in view above it.
      if (window.matchMedia("(min-width: 720px) and (max-width: 1359px)").matches) {
        requestAnimationFrame(() => matrixRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      }
    }
  };
  const selectPerson = (id: string | null) => {
    setPreview(null);
    setSelection(id ? { kind: "person", id } : null);
  };
  const switchScope = (next: Scope) => {
    setScope(next);
    setSelection(null);
    setPreview(null);
    setFocus({ r: 0, c: 0 });
  };

  // Remedies are always applied from the why panel, whose applied card (with Undo)
  // is the confirmation. No toast: screen readers hear it through a quiet live region.
  const apply = (id: string) => {
    const r = remedyById(id);
    if (!r) return;
    setApplied((a) => (a.includes(id) ? a : [...a, id]));
    setAnnounce(`${r.effect.toast} The atlas has updated.`);
  };
  const undo = (id: string) => {
    const r = remedyById(id);
    setApplied((a) => a.filter((x) => x !== id));
    setAnnounce(r ? `Undone: ${r.effect.toast}` : "Undone.");
  };

  // Esc peels back one layer at a time: the selection, then the drill-in.
  const escRef = useRef({ selection, scope, help });
  useEffect(() => {
    escRef.current = { selection, scope, help };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setPreview(null);
        if (escRef.current.help) setHelp(false);
        else if (escRef.current.selection) setSelection(null);
        else if (escRef.current.scope !== "all") {
          setScope("all");
          setFocus({ r: 0, c: 0 });
        }
      } else if (e.key === "l" || e.key === "L") {
        setCompare((c) => !c);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // The help popover closes on any press outside it.
  useEffect(() => {
    if (!help) return;
    const onDown = (e: PointerEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelp(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [help]);

  // The line above the matrix: what the highlighting means right now.
  let caption: ReactNode = compare ? (
    <span className={s.compareNote}>
      Colours show last week, {LAST_WEEK.replace("Thursday ", "")}. Arrows mark what has changed since.
    </span>
  ) : (
    <>
      <span className={s.onDesk}>Choose a cell to see why it is that colour.</span>
      <span className={s.onPhone}>Tap a tile to see why it is that colour.</span>
    </>
  );
  if (traceSel?.kind === "cell" && selectedCell) {
    const causes = selectedCell.causes.map((c) => CAUSES[c]?.label).filter(Boolean) as string[];
    const rowName = rows.find((r) => r.id === selectedCell.rowId)?.name;
    const dimName = DIMENSIONS.find((d) => d.id === selectedCell.dim)?.name;
    const counts = causes.map((label) => ({ label, n: [...relatedVia.values()].filter((x) => x === label).length })).filter((c) => c.n);
    caption = causes.length ? (
      related.size ? (
        <>
          <strong>
            {rowName} · {dimName}
          </strong>
          <span>traces back to</span>
          {counts.map((c) => (
            <span key={c.label} className={s.causeChip}>
              {c.label} · {c.n + 1} cells
            </span>
          ))}
        </>
      ) : (
        <>
          <strong>
            {rowName} · {dimName}
          </strong>
          <span>has its own cause. Nothing else is affected.</span>
        </>
      )
    ) : (
      <>
        <strong>
          {rowName} · {dimName}
        </strong>
        <span>{level(selectedCell.now.tone) === 0 ? "is calm, so there is nothing to trace." : "has nothing to trace yet."}</span>
      </>
    );
  } else if (traceSel?.kind === "person") {
    const p = PEOPLE.find((x) => x.id === traceSel.id)!;
    caption = related.size ? (
      <>
        <strong>{p.isYou ? "You" : p.name}</strong>
        <span>
          {p.isYou ? "are" : "is"} behind {related.size} warm {related.size === 1 ? "cell" : "cells"}
        </span>
      </>
    ) : (
      <>
        <strong>{p.isYou ? "You" : p.name}</strong>
        <span>{p.isYou ? "are not" : "is not"} behind any warm cells.</span>
      </>
    );
  }

  // Hovering a remedy: the caption line says what it would change. The verdict never moves.
  if (clause && preview) {
    caption = (
      <>
        <span className={s.previewChip}>Preview</span>
        <span className={s.previewText}>With this change, {clause}</span>
      </>
    );
  }

  const drilled = scope !== "all" ? rowsFor("all").find((r) => r.id === scope) : null;

  return (
    <div className={`${s.root} thin-scroll`} data-calm={calm || undefined} data-open={selection ? true : undefined}>
      <div className={s.layout}>
        <div className={s.main}>
          <header className={s.header}>
            <div className={s.headTop}>
              <div className={s.titleBlock}>
                <p className={s.eyebrow}>
                  {TODAY}
                  <span aria-hidden="true"> · </span>
                  {compare ? `Showing last week, ${LAST_WEEK}` : "Checked 4 minutes ago"}
                </p>
                <h1 className={s.title}>Overview</h1>
              </div>
              <div className={s.controls}>
                <div className={s.helpWrap} ref={helpRef}>
                  <button
                    type="button"
                    className={s.helpBtn}
                    aria-expanded={help}
                    aria-controls="c3-help-pop"
                    aria-label="How to read the atlas"
                    title="How to read the atlas"
                    onClick={() => setHelp((h) => !h)}
                  >
                    <Icon.help size={16} />
                  </button>
                  {help ? <HelpPopover rows={rows} /> : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compare}
                  className={s.compare}
                  onClick={() => setCompare((c) => !c)}
                  title="Compare to last week (L)"
                >
                  <span className={s.switchTrack} aria-hidden="true">
                    <span className={s.switchThumb} />
                  </span>
                  Compare to last week
                  <kbd className={s.kbd}>L</kbd>
                </button>
              </div>
            </div>

            {drilled ? (
              <nav className={s.crumbs} aria-label="Scope">
                <button type="button" className={s.crumbBack} onClick={() => switchScope("all")}>
                  <Icon.arrow size={13} className={s.backIcon} />
                  All projects
                </button>
                <span className={s.crumbSlash} aria-hidden="true">
                  /
                </span>
                <span className={s.crumbHere} aria-current="page">
                  <span className={s.segTile} style={{ background: drilled.color }} aria-hidden="true">
                    {drilled.initials}
                  </span>
                  {drilled.name}
                  <span className={s.crumbBy}>by workstream</span>
                </span>
                <kbd className={s.kbd}>Esc</kbd>
              </nav>
            ) : null}

            <div className={s.verdictRow}>
              <MiniAtlas view={settled} />
              {v.calm ? (
                <span className={s.calmMark} aria-hidden="true">
                  <Icon.check size={16} />
                </span>
              ) : null}
              <div className={s.verdictBody}>
              <p className={s.verdict} aria-live="polite" data-calm={v.calm || undefined}>
                {v.parts.map((part, i) =>
                  "dim" in part ? (
                    <button
                      key={i}
                      type="button"
                      className={s.vWord}
                      onMouseEnter={() => setHlDim(part.dim)}
                      onMouseLeave={() => setHlDim(null)}
                      onFocus={() => setHlDim(part.dim)}
                      onBlur={() => setHlDim(null)}
                      onClick={() => {
                        const worst = settled
                          .flat()
                          .filter((c) => c.dim === part.dim)
                          .sort((a, b) => level(b.tone) - level(a.tone))[0];
                        if (worst) selectKey(worst.key);
                        setHlDim(null);
                      }}
                    >
                      {part.text}
                    </button>
                  ) : "person" in part ? (
                    <button
                      key={i}
                      type="button"
                      className={s.vWord}
                      data-person
                      onMouseEnter={() => setHlPerson(part.person)}
                      onMouseLeave={() => setHlPerson(null)}
                      onFocus={() => setHlPerson(part.person)}
                      onBlur={() => setHlPerson(null)}
                      onClick={() => {
                        selectPerson(part.person);
                        setHlPerson(null);
                      }}
                    >
                      {part.text}
                    </button>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </p>
              {v.calm && calm && !compare ? <p className={s.calmNote}>Last warm cell cleared Tuesday: Harvest supper club momentum.</p> : null}
              </div>
            </div>
          </header>

          <div className={s.toolbar}>
            <p className={s.caption} aria-live="polite">
              {caption}
              {selection ? (
                <button type="button" className={s.clear} onClick={() => selectKey(null)}>
                  Clear <kbd className={s.kbd}>Esc</kbd>
                </button>
              ) : null}
              {compare && !selection ? (
                <button type="button" className={s.clear} onClick={() => setCompare(false)}>
                  Back to today <kbd className={s.kbd}>L</kbd>
                </button>
              ) : null}
            </p>
          </div>

          <div className={s.matrixWrap} ref={matrixRef}>
            <AtlasMatrix
              rows={rows}
              view={view}
              selectedKey={selectedKey}
              related={related}
              relatedVia={relatedVia}
              tracing={tracing}
              focus={focus}
              compare={compare}
              highlightDim={hlDim}
              scopeAll={scope === "all"}
              onFocus={setFocus}
              onSelect={selectKey}
              onDrill={(id) => switchScope(id as Scope)}
              canDrill={(id) => DRILLABLE.has(id)}
            />
            <Legend />
          </div>

          <PhoneAtlas
            rows={rows}
            view={view}
            selectedKey={selectedKey}
            related={related}
            relatedVia={relatedVia}
            tracing={tracing}
            compare={compare}
            scopeAll={scope === "all"}
            onSelect={selectKey}
            onDrill={(id) => switchScope(id as Scope)}
            canDrill={(id) => DRILLABLE.has(id)}
          />

          <LookFirstInline
            rows={rows}
            view={settled}
            compare={compare}
            applied={applied}
            preview={preview}
            loads={baseLoads}
            onSelectKey={selectKey}
            onSelectPerson={selectPerson}
            onPreview={setPreview}
            onApply={apply}
            onUndo={undo}
          />

          <PeopleLoadStrip
            loads={baseLoads}
            previewLoads={previewLoads}
            previewIds={previewIds}
            highlight={previewIds.size ? new Set([...highlightPeople, ...previewIds]) : highlightPeople}
            selectedPerson={selection?.kind === "person" ? selection.id : null}
            tracing={tracing}
            onSelectPerson={selectPerson}
          />

          <footer className={s.footer}>
            <span>Sample data for this concept.</span>
            <button
              type="button"
              className={s.footBtn}
              aria-pressed={calm}
              onClick={() => {
                setCalm((c) => !c);
                setSelection(null);
                setApplied([]);
              }}
            >
              {calm ? "Back to this week" : "Show a calm week"}
            </button>
          </footer>

          <p className={s.srOnly} role="status" aria-live="polite">
            {announce}
          </p>
        </div>

        <WhyPanel
          selection={selection}
          rows={rows}
          view={settled}
          related={related}
          relatedVia={relatedVia}
          applied={applied}
          preview={preview}
          compare={compare}
          loads={baseLoads}
          onClose={() => selectKey(null)}
          onSelectKey={selectKey}
          onSelectPerson={selectPerson}
          onPreview={setPreview}
          onApply={apply}
          onUndo={undo}
        />
      </div>
    </div>
  );
}

/** The colour key sits under the grid, where the eye finishes reading it. Shapes carry the level, not colour alone. */
function Legend() {
  const steps: { tone: string; label: string; mark?: "look" | "watch" | "attention" }[] = [
    { tone: "0", label: "Calm" },
    { tone: "1", label: "Worth a look", mark: "look" },
    { tone: "2", label: "Watch", mark: "watch" },
    { tone: "3", label: "Needs attention", mark: "attention" },
  ];
  return (
    <div className={s.legendRow} aria-label="Colour key" role="group">
      <span className={s.legendNote}>The line in each cell is its last 14 days.</span>
      <ul className={s.legend}>
        {steps.map((st) => (
          <li key={st.tone} className={s.legendItem} data-tone={st.tone}>
            <span className={s.legendSwatch} aria-hidden="true">
              {st.mark ? <MarkShape mark={st.mark} size={9} /> : null}
            </span>
            {st.label}
          </li>
        ))}
        <li className={s.legendItem} data-tone="early">
          <span className={s.hatchSwatch} aria-hidden="true" />
          Too early to say
        </li>
      </ul>
    </div>
  );
}

function HelpPopover({ rows }: { rows: ReturnType<typeof rowsFor> }) {
  return (
    <div id="c3-help-pop" className={s.helpPop} role="dialog" aria-label="How to read the atlas">
      <p className={s.helpTitle}>Reading the atlas</p>
      <p className={s.howText}>
        Rows are {rows[0]?.id.startsWith("ws-") ? "workstreams" : "projects"}, columns are the six things that usually go wrong. Warmer means more
        pressure, the words say what it is, the line along the bottom is the last 14 days, and the shape where it ends says how much.
      </p>
      <dl className={s.keys}>
        <div>
          <dt>
            <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>→</kbd>
            <kbd>↓</kbd>
          </dt>
          <dd>Move between cells</dd>
        </div>
        <div>
          <dt>
            <kbd>Enter</kbd>
          </dt>
          <dd>Explain a cell</dd>
        </div>
        <div>
          <dt>
            <kbd>L</kbd>
          </dt>
          <dd>Compare to last week</dd>
        </div>
        <div>
          <dt>
            <kbd>Esc</kbd>
          </dt>
          <dd>Clear, then step back out</dd>
        </div>
      </dl>
    </div>
  );
}

/** Phone only: a thumbnail of the whole atlas, one square per cell. */
function MiniAtlas({ view }: { view: ReturnType<typeof buildView> }) {
  return (
    <span className={s.mini} aria-hidden="true" style={{ ["--rows" as string]: view.length }}>
      {view.map((row) => {
        const mark = markFor(row.map((c) => ({ tone: c.tone })));
        return row.map((c) => <span key={c.key} data-tone={c.tone === "early" ? "early" : String(c.tone)} data-mark={mark} />);
      })}
    </span>
  );
}
