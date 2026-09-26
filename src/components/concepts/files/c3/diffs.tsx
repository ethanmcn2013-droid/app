"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LinkThumb, LogoArt, PhotoThumb, WelcomeArt } from "./art";
import { PEOPLE, euro, type Diff, type FeedEvent } from "./data";
import { Avatar, ClientTag, Icon } from "./parts";
import s from "./c3.module.css";

/**
 * Inline differences. Every event shows what actually changed, drawn the
 * way a person would explain it: struck prices, guests moving tables,
 * added and removed lines, a before and after wipe.
 */

export function DiffView({ ev, large }: { ev: FeedEvent; large?: boolean }) {
  const d = ev.diff;
  switch (d.type) {
    case "price":
      return <PriceDiff d={d} />;
    case "seating":
      return <SeatingDiff d={d} />;
    case "text":
      return <TextDiff d={d} />;
    case "wipe":
      return <Wipe d={d} large={large} />;
    case "art":
      return (
        <figure className={s.artFigure}>
          <div className={s.artFrame}>{d.art === "welcome" ? <WelcomeArt v={d.variant} /> : <LogoArt v={4} />}</div>
          <figcaption className={s.caption}>{d.caption}</figcaption>
        </figure>
      );
    case "comments":
      return <Comments d={d} startOpen={large} />;
    case "link":
      return <LinkCard d={d} />;
    case "photos":
      return <Photos d={d} />;
    case "sheet":
      return <SheetDiff d={d} />;
    case "rename":
      return (
        <div className={s.rename}>
          <span className={s.renameOld}>{d.from}</span>
          <Icon name="arrow" size={14} className={s.arrowIcon} />
          <span className={s.renameNew}>{d.to}</span>
        </div>
      );
    case "facts":
      return (
        <div className={s.facts}>
          <dl className={s.factGrid}>
            {d.facts.map((f) => (
              <div key={f.label} className={s.fact}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className={s.factNote}>
            <Icon name="sparkle" size={12} /> {d.note}
          </p>
        </div>
      );
    case "outline":
      return (
        <ol className={s.outline}>
          {d.headings.map((h, i) => (
            <li key={h.title} className={s.outlineRow}>
              <span className={s.outlineNum}>{i + 1}</span>
              <span className={s.outlineTitle}>{h.title}</span>
              <span className={s.outlinePages}>p. {h.pages}</span>
            </li>
          ))}
        </ol>
      );
    case "tables":
      return <TablesGlance guests={d.guests} tables={d.tables} />;
  }
}

/* ── price ──────────────────────────────────────────────────────── */

function delta(from?: number, to?: number) {
  if (from === undefined && to !== undefined) return { text: "New", tone: "up" as const };
  if (to === undefined && from !== undefined) return { text: `−${euro(from)}`, tone: "down" as const };
  if (from === undefined || to === undefined || from === to) return null;
  const diff = to - from;
  const sign = diff > 0 ? "+" : "−";
  return { text: `${sign}${euro(Math.round(Math.abs(diff) * 100) / 100)}`, tone: diff > 0 ? ("up" as const) : ("down" as const) };
}

function PriceDiff({ d }: { d: Extract<Diff, { type: "price" }> }) {
  const hasTotal = d.total.from !== undefined && d.total.to !== undefined;
  const t = delta(d.total.from, d.total.to);
  return (
    <div className={s.price}>
      <div className={s.priceHead}>
        <span>Line</span>
        <span className={s.num}>{d.fromLabel}</span>
        <span className={s.num}>{d.toLabel}</span>
        <span className={s.num}>Change</span>
      </div>
      {d.rows.map((r) => {
        const dl = delta(r.from, r.to);
        const removed = r.to === undefined;
        const same = r.from === r.to;
        return (
          <div key={r.label} className={`${s.priceRow} ${same ? s.priceSame : ""}`}>
            <span className={`${s.priceLabel} ${removed ? s.struck : ""}`}>
              {r.label}
              {removed && <span className={s.removedTag}>Removed</span>}
            </span>
            <span className={`${s.num} ${same ? "" : s.oldNum}`}>{r.from !== undefined ? euro(r.from) : ""}</span>
            <span className={`${s.num} ${same ? "" : s.newNum}`}>{r.to !== undefined ? euro(r.to) : "—"}</span>
            <span className={`${s.num} ${dl ? (dl.tone === "down" ? s.down : s.up) : s.flat}`}>{dl ? dl.text : "No change"}</span>
          </div>
        );
      })}
      {hasTotal && t && (
        <div className={s.priceTotal}>
          <span>Total</span>
          <span className={s.totalFigures}>
            <s className={s.totalOld}>{euro(d.total.from!)}</s>
            <Icon name="arrow" size={14} className={s.arrowIcon} />
            <strong className={s.totalNew}>{euro(d.total.to!)}</strong>
          </span>
          <span className={`${s.totalDelta} ${t.tone === "down" ? s.totalDown : s.totalUp}`}>{t.text}</span>
        </div>
      )}
    </div>
  );
}

/* ── seating ────────────────────────────────────────────────────── */

function SeatingDiff({ d }: { d: Extract<Diff, { type: "seating" }> }) {
  const [bursts, setBursts] = useState(false);
  const tables = Array.from(new Set(d.moves.flatMap((m) => [m.from, m.to]))).sort((a, b) => a - b);
  return (
    <div className={s.seating}>
      {d.noisy && (
        <div className={s.noisy}>
          <div className={s.noisyTop}>
            <span className={s.noisyCount}>
              <strong>{d.noisy.edits} edits</strong> between {d.noisy.span}, summarised into one change
            </span>
            <button type="button" className={s.linkBtn} onClick={() => setBursts((b) => !b)} aria-expanded={bursts}>
              {bursts ? "Hide the three sittings" : "Show the three sittings"}
              <Icon name="chevron" size={12} className={bursts ? s.flip : ""} />
            </button>
          </div>
          <div className={s.ticks} aria-hidden>
            {d.noisy.ticks.map((t, i) => (
              <span key={i} className={s.tick} style={{ left: `${((t / 215) * 100).toFixed(3)}%` }} />
            ))}
          </div>
          <div className={s.tickScale} aria-hidden>
            {[
              ["13:10", 0],
              ["14:00", 50],
              ["15:00", 110],
              ["16:00", 170],
              ["16:45", 215],
            ].map(([label, m]) => (
              <span key={label} style={{ left: `${((Number(m) / 215) * 100).toFixed(3)}%` }}>
                {label}
              </span>
            ))}
          </div>
          {bursts && (
            <ol className={s.bursts}>
              {d.noisy.bursts.map((b) => (
                <li key={b.when} className={s.burst}>
                  <span className={s.burstWhen}>{b.when}</span>
                  <span className={s.burstText}>{b.text}</span>
                  <span className={s.burstCount}>{b.count} edits</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <div className={s.moves} role="table" aria-label="Guests who moved">
        <div className={s.movesHead} role="row">
          <span role="columnheader">Guest</span>
          <span role="columnheader">Was at</span>
          <span aria-hidden />
          <span role="columnheader">Now at</span>
        </div>
        {d.moves.map((m, i) => (
          <div key={m.guest} className={s.moveRow} role="row" style={{ "--i": i } as CSSProperties}>
            <span className={s.guest} role="cell">
              {m.guest}
            </span>
            <span role="cell">
              <span className={s.tableOld}>Table {m.from}</span>
            </span>
            <span className={s.moveArrow} aria-hidden>
              <svg width="44" height="10" viewBox="0 0 44 10">
                <path d="M1 5h38M35 1.5L40.5 5 35 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span role="cell">
              <span className={s.tableNew}>Table {m.to}</span>
            </span>
          </div>
        ))}
      </div>
      <div className={s.tableStrip} aria-label="Tables affected">
        {tables.map((t) => {
          const inn = d.moves.filter((m) => m.to === t).length;
          const out = d.moves.filter((m) => m.from === t).length;
          return (
            <span key={t} className={s.tableChip}>
              <span className={s.tableChipName}>Table {t}</span>
              {inn > 0 && <span className={s.tIn}>+{inn}</span>}
              {out > 0 && <span className={s.tOut}>−{out}</span>}
            </span>
          );
        })}
      </div>
      {d.notes.length > 0 && (
        <ul className={s.notes}>
          {d.notes.map((n) => (
            <li key={n}>
              <span className={s.plus} aria-hidden>
                +
              </span>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── text ───────────────────────────────────────────────────────── */

function TextDiff({ d }: { d: Extract<Diff, { type: "text" }> }) {
  const added = d.lines.filter((l) => l.k === "+").length;
  const removed = d.lines.filter((l) => l.k === "-").length;
  return (
    <div className={s.text}>
      <div className={s.textHead}>
        <span>
          {d.fromLabel} to {d.toLabel}
        </span>
        <span className={s.textStats}>
          <span className={s.statAdd}>{added} added</span>
          <span className={s.statDel}>{removed} removed</span>
        </span>
      </div>
      <div className={s.lines}>
        {d.lines.map((l, i) =>
          l.k === "fold" ? (
            <div key={i} className={s.fold}>
              {l.n} lines unchanged
            </div>
          ) : (
            <div key={i} className={`${s.line} ${l.k === "+" ? s.lineAdd : l.k === "-" ? s.lineDel : ""}`}>
              <span className={s.gutter} aria-hidden>
                {l.k === " " ? "" : l.k === "+" ? "+" : "−"}
              </span>
              <span className={s.lineText}>
                {l.k === "+" && <span className={s.srOnly}>Added: </span>}
                {l.k === "-" && <span className={s.srOnly}>Removed: </span>}
                {l.t}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ── before and after wipe ──────────────────────────────────────── */

function Wipe({ d, large }: { d: Extract<Diff, { type: "wipe" }>; large?: boolean }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const swept = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || large) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || swept.current) return;
        swept.current = true;
        const start = performance.now();
        const frames = (now: number) => {
          const t = Math.min(1, (now - start) / 1400);
          // 50 → 78 → 50: a gentle hint that the divider moves.
          const e = Math.sin(t * Math.PI);
          setPos(50 + e * 28 * (1 - t * 0.2));
          if (t < 1) raf = requestAnimationFrame(frames);
          else setPos(50);
        };
        raf = requestAnimationFrame(frames);
      },
      { threshold: 0.8 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [large]);

  const Art = (v: "a" | "b") =>
    d.art === "welcome" ? <WelcomeArt v={v === "a" ? 1 : 2} /> : <LogoArt v={v === "a" ? 4 : 5} />;

  return (
    <div className={`${s.wipe} ${large ? s.wipeLarge : ""}`} ref={ref} style={{ "--pos": `${pos}%` } as CSSProperties}>
      <div className={s.wipeLayer}>{Art("a")}</div>
      <div className={`${s.wipeLayer} ${s.wipeAfter}`}>{Art("b")}</div>
      <span className={`${s.wipeTag} ${s.wipeTagL}`}>{d.fromLabel}</span>
      <span className={`${s.wipeTag} ${s.wipeTagR}`}>{d.toLabel}</span>
      <span className={s.wipeHandle} aria-hidden>
        <span className={s.wipeKnob}>
          <svg width="18" height="10" viewBox="0 0 18 10">
            <path d="M5 1L1 5l4 4M13 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
      <input
        className={s.wipeRange}
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => {
          swept.current = true;
          setPos(Number(e.target.value));
        }}
        aria-label={`Compare ${d.fromLabel} and ${d.toLabel}`}
        aria-valuetext={`${Math.round(pos)}% ${d.fromLabel}, ${100 - Math.round(pos)}% ${d.toLabel}`}
      />
    </div>
  );
}

/* ── comments ───────────────────────────────────────────────────── */

function Comments({ d, startOpen }: { d: Extract<Diff, { type: "comments" }>; startOpen?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const [resolved, setResolved] = useState(false);
  const people = Array.from(new Set(d.comments.map((c) => c.by)));
  return (
    <div className={s.comments}>
      <blockquote className={s.quote}>
        <span className={s.quoteMark} aria-hidden />
        {d.quote}
      </blockquote>
      <button type="button" className={s.threadToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={s.stack}>
          {people.map((p) => (
            <Avatar key={p} id={p} size={20} ring />
          ))}
        </span>
        <span>
          {PEOPLE[people[0]].name} left {d.comments.length} comments
          {resolved && <span className={s.resolvedTag}>Resolved</span>}
        </span>
        <Icon name="chevron" size={14} className={`${s.threadChevron} ${open ? s.flip : ""}`} />
      </button>
      <div className={`${s.collapse} ${open ? "" : s.collapsed}`}>
        <div className={s.collapseInner}>
          <ul className={s.commentList}>
            {d.comments.map((c, i) => (
              <li key={i} className={s.comment}>
                <Avatar id={c.by} size={24} />
                <div>
                  <div className={s.commentMeta}>
                    <strong>{PEOPLE[c.by].name}</strong>
                    {PEOPLE[c.by].client && <ClientTag />}
                    <span>{c.at}</span>
                  </div>
                  <p className={s.commentText}>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className={s.commentActions}>
            <span className={s.fakeReply}>Reply in Google Drive</span>
            <button type="button" className={s.ghostBtn} onClick={() => setResolved((r) => !r)}>
              {resolved ? "Reopen" : "Resolve thread"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── link ───────────────────────────────────────────────────────── */

function LinkCard({ d }: { d: Extract<Diff, { type: "link" }> }) {
  return (
    <div className={s.unfurl}>
      <div className={s.unfurlThumb}>
        <LinkThumb />
      </div>
      <div className={s.unfurlBody}>
        <span className={s.unfurlDomain}>
          <span className={s.favicon} aria-hidden>
            H
          </span>
          {d.domain}
        </span>
        <strong className={s.unfurlTitle}>{d.title}</strong>
        <span className={s.unfurlDesc}>{d.description}</span>
        <span className={s.unfurlUrl}>{d.url}</span>
      </div>
    </div>
  );
}

/* ── photos ─────────────────────────────────────────────────────── */

function Photos({ d }: { d: Extract<Diff, { type: "photos" }> }) {
  const shown = 7;
  return (
    <div className={s.photos}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={`${s.photo} ${d.starred.includes(i) ? s.photoStar : ""}`}>
          <PhotoThumb i={i} />
          {d.starred.includes(i) && (
            <span className={s.starBadge} aria-label="Starred for the menu">
              <Icon name="star" size={10} />
            </span>
          )}
        </span>
      ))}
      <span className={s.photoMore}>+{d.count - shown}</span>
    </div>
  );
}

/* ── sheet ──────────────────────────────────────────────────────── */

function SheetDiff({ d }: { d: Extract<Diff, { type: "sheet" }> }) {
  return (
    <div className={s.sheetWrap}>
      <table className={s.sheet}>
        <thead>
          <tr>
            {d.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) =>
                typeof c === "string" ? (
                  <td key={j} className={j === 0 ? s.sheetKey : ""}>
                    {c}
                  </td>
                ) : (
                  <td key={j} className={s.cellChanged}>
                    <s className={s.cellOld}>{c.from}</s>
                    <span className={s.cellNew}>{c.to}</span>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── seating plan at a glance ───────────────────────────────────── */

function TablesGlance({ guests, tables }: { guests: number; tables: number }) {
  return (
    <div className={s.glance}>
      <div className={s.glanceTables} aria-hidden>
        {Array.from({ length: tables }, (_, t) => (
          <svg key={t} width="44" height="44" viewBox="0 0 44 44" className={s.glanceTable}>
            <circle cx="22" cy="22" r="11" className={s.glanceTop} />
            {Array.from({ length: 10 }, (_, k) => {
              const a = (k / 10) * Math.PI * 2;
              return <circle key={k} cx={(22 + Math.cos(a) * 17).toFixed(2)} cy={(22 + Math.sin(a) * 17).toFixed(2)} r="2.6" className={s.glanceSeat} />;
            })}
            <text x="22" y="25.5" textAnchor="middle" className={s.glanceNum}>
              {t + 1}
            </text>
          </svg>
        ))}
      </div>
      <p className={s.glanceText}>
        {guests} guests across {tables} tables. Every confirmed guest has a seat.
      </p>
    </div>
  );
}
