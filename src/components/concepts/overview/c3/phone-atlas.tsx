"use client";

import { DIMENSIONS, type Row, type Tone } from "./data";
import { Icon, MarkShape, ToneGlyph } from "./icons";
import { MARK_LABEL, TONE_LABEL, markFor, type ViewCell } from "./model";
import s from "./atlas.module.css";

const toneAttr = (t: Tone) => (t === "early" ? "early" : String(t));

/** Phone: the matrix transposed into one card per row, dimensions as a 3 by 2 grid of chips. */
export function PhoneAtlas(props: {
  rows: Row[];
  view: ViewCell[][];
  selectedKey: string | null;
  related: Set<string>;
  relatedVia: Map<string, string>;
  tracing: boolean;
  compare: boolean;
  scopeAll: boolean;
  onSelect: (key: string | null) => void;
  onDrill: (rowId: string) => void;
  canDrill: (rowId: string) => boolean;
}) {
  const { rows, view, selectedKey, related, tracing, compare } = props;
  return (
    <ol className={s.cards} aria-label={props.scopeAll ? "Projects" : "Workstreams"}>
      {rows.map((row, r) => {
        const mark = markFor(view[r].map((c) => ({ tone: c.tone })));
        return (
          <li key={row.id} className={s.card} style={{ ["--i" as string]: r }}>
            <div className={s.cardHead}>
              <span className={s.tile} style={{ background: row.color }} aria-hidden="true">
                {row.initials}
              </span>
              <span className={s.rowText}>
                <span className={s.rowName}>{row.name}</span>
                <span className={s.rowNext}>{row.next}</span>
              </span>
              <span className={s.mark} data-mark={mark}>
                <MarkShape mark={mark} />
                {MARK_LABEL[mark]}
              </span>
            </div>
            <div className={s.chips}>
              {view[r].map((cell, c) => {
                const d = DIMENSIONS[c];
                const selected = cell.key === selectedKey;
                const isRelated = related.has(cell.key);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    className={s.chip}
                    data-tone={toneAttr(cell.tone)}
                    data-selected={selected || undefined}
                    data-related={isRelated || undefined}
                    data-dim={(tracing && !selected && !isRelated) || undefined}
                    data-preview={cell.previewing || undefined}
                    aria-label={`${d.name}: ${cell.label}. ${TONE_LABEL(cell.tone)}.${isRelated ? " Same cause as the selected cell." : ""}${compare && cell.moved ? ` ${cell.moved === 1 ? "Warmer" : "Calmer"} today: ${cell.now.label}.` : ""}`}
                    aria-pressed={selected}
                    onClick={() => props.onSelect(selected ? null : cell.key)}
                  >
                    <span className={s.chipDim}>{d.short}</span>
                    <span className={s.chipLabel}>{cell.label}</span>
                    {cell.tone !== "early" && cell.tone > 0 ? <ToneGlyph tone={cell.tone} size={10} className={s.chipGlyph} /> : null}
                    {compare && cell.moved !== 0 ? (
                      <span className={s.chipMoved} data-moved={cell.moved} aria-hidden="true">
                        {cell.moved === 1 ? <Icon.up size={10} /> : <Icon.down size={10} />}
                        {cell.now.label}
                      </span>
                    ) : null}
                    {isRelated && !compare ? <span className={s.chipSame} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
            {props.scopeAll && props.canDrill(row.id) ? (
              <button type="button" className={s.cardDrill} onClick={() => props.onDrill(row.id)}>
                <Icon.layers size={14} />
                See it by workstream
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
