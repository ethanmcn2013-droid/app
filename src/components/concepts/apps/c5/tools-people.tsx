"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { Guest } from "./data";
import { cx, useBench } from "./ctx";
import { CloseIcon, GripIcon, LinkIcon, PlusIcon, SearchIcon, SendIcon } from "./glyphs";
import t from "./tools.module.css";

/* ── Seating: the barn, drawn to one scale ────────────────────────── */

/* Six across on a wide pane, four across when the pane is narrow, so tables stay big enough to hit. */
const layout = (cols: number) => ({ W: 96 + (cols - 1) * 99 + 72, cols });
const tablePos = (n: number, cols: number) => {
  const i = n - 1;
  const row = Math.floor(i / cols);
  const col = i % cols;
  return { x: 96 + col * 99, y: 168 + row * 108 };
};
const TR = 27;
const SR = 38;

export function SeatingBody() {
  const b = useBench();
  const [hover, setHover] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [refused, setRefused] = useState<number | null>(null);
  const [cols, setCols] = useState(6);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(el.clientWidth < 360 ? 4 : 6));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { W } = layout(cols);

  const byTable = useMemo(() => {
    const m = new Map<number, Guest[]>();
    for (const g of b.guests) if (g.table !== null) m.set(g.table, [...(m.get(g.table) ?? []), g]);
    return m;
  }, [b.guests]);

  const full = b.tables.filter((tb) => (byTable.get(tb.n)?.length ?? 0) >= tb.seats).length;
  const free = b.tables.reduce((acc, tb) => acc + Math.max(0, tb.seats - (byTable.get(tb.n)?.length ?? 0)), 0);
  const waiting = b.guests.filter((g) => g.table === null).length;
  const guestDrag = b.drag?.kind === "guest";
  const guestsOpen = b.isOpen("guests");
  const rows = Math.ceil(b.tables.length / cols);
  const height = 168 + (rows - 1) * 108 + 44 + 110;

  const onOver = (e: DragEvent, n: number) => {
    if (!guestDrag) return;
    const room = (byTable.get(n)?.length ?? 0) < (b.tables.find((x) => x.n === n)?.seats ?? 8);
    if (!room) {
      if (over !== null) setOver(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (over !== n) setOver(n);
  };
  const onDrop = (e: DragEvent, n: number) => {
    if (b.drag?.kind !== "guest") return;
    e.preventDefault();
    b.seatGuest(b.drag.id, n);
    setOver(null);
    b.setDrag(null);
  };
  const onKey = (e: KeyboardEvent, n: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      b.selectTable(b.selectedTable === n ? null : n);
    }
  };

  const tip = hover ?? null;
  const tipPos = tip ? tablePos(tip, cols) : null;

  return (
    <div className={t.body}>
      <div className={t.seatSummary}>
        <span className={t.stat}>
          <strong className={t.num}>
            {full}
            <span className={t.statOf}>/{b.tables.length}</span>
          </strong>
          tables full
        </span>
        <span className={t.stat}>
          <strong className={t.num}>{free}</strong>
          seats left
        </span>
        <span className={t.stat}>
          <strong className={t.num}>{waiting}</strong>
          waiting for a table
        </span>
      </div>
      {waiting > free && (
        <div className={t.nudge}>
          <span>
            <span className={t.num}>{waiting - free}</span> more people than seats.
          </span>
          <button type="button" className={t.softBtn} onClick={b.addTable}>
            <PlusIcon size={14} /> Add a table
          </button>
        </div>
      )}
      <div className={t.floorWrap} ref={wrapRef}>
        {guestDrag && (
          <p className={cx(t.dropHint, t.dropFloat)} role="status">
            Drop <strong>{b.drag?.label}</strong> on a table with a free seat
          </p>
        )}
        <svg viewBox={`0 0 ${W} ${height}`} className={t.floor} role="group" aria-label="Seating plan for the barn at The Orchard">
          <defs>
            <pattern id="c5-dance" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" className={t.hatch} />
            </pattern>
          </defs>
          <rect x="8" y="8" width={W - 16} height={height - 16} rx="18" className={t.barn} />
          {/* top table */}
          <g>
            <rect x={W / 2 - 150} y={38} width={300} height={40} rx="10" className={t.topTable} />
            {Array.from({ length: 8 }, (_, i) => (
              <circle key={i} cx={W / 2 - 122.5 + i * 35} cy={96} r={6} className={t.seatOn} />
            ))}
            <text x={W / 2} y={63} textAnchor="middle" className={t.floorLabel}>
              Top table: Mara, Finn and six
            </text>
          </g>
          {/* door and dance floor */}
          <rect x={8} y={height / 2 - 30} width={6} height={60} rx="3" className={t.door} />
          <text x={32} y={height / 2} textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 32 ${height / 2})`} className={t.floorSmall}>
            Door
          </text>
          <rect x={W / 2 - 110} y={height - 86} width={220} height={60} rx="10" className={t.dance} fill="url(#c5-dance)" />
          <text x={W / 2} y={height - 51} textAnchor="middle" className={t.floorSmall}>
            Dance floor
          </text>

          {b.tables.map((tb) => {
            const { x, y } = tablePos(tb.n, cols);
            const seated = byTable.get(tb.n) ?? [];
            const isFull = seated.length >= tb.seats;
            const selected = b.selectedTable === tb.n;
            const names = seated.map((g) => g.name).join(", ");
            return (
              <g
                key={tb.n}
                className={cx(t.table, selected && t.tableSel, over === tb.n && t.tableOver, guestDrag && isFull && t.tableDim, refused === tb.n && t.tableRefuse)}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Table ${tb.n}, ${seated.length} of ${tb.seats} seats taken${names ? `: ${names}` : ""}`}
                onClick={() => b.selectTable(selected ? null : tb.n)}
                onKeyDown={(e) => onKey(e, tb.n)}
                onMouseEnter={() => setHover(tb.n)}
                onMouseLeave={() => setHover((h) => (h === tb.n ? null : h))}
                onFocus={() => setHover(tb.n)}
                onBlur={() => setHover((h) => (h === tb.n ? null : h))}
                onDragOver={(e) => onOver(e, tb.n)}
                onDragEnter={() => {
                  if (guestDrag && isFull) {
                    setRefused(tb.n);
                  }
                }}
                onDragLeave={() => {
                  setOver((o) => (o === tb.n ? null : o));
                  setRefused((r) => (r === tb.n ? null : r));
                }}
                onDrop={(e) => onDrop(e, tb.n)}
              >
                <circle r={SR + 10} className={t.tableHit} />
                <circle r={TR} className={t.tableTop} />
                {Array.from({ length: tb.seats }, (_, i) => {
                  const a = (i / tb.seats) * Math.PI * 2 - Math.PI / 2;
                  return <circle key={i} cx={Math.cos(a) * SR} cy={Math.sin(a) * SR} r={5.5} className={i < seated.length ? t.seatOn : t.seatOff} />;
                })}
                <text y={1} textAnchor="middle" dominantBaseline="middle" className={t.tableNum}>
                  {tb.n}
                </text>
              </g>
            );
          })}
        </svg>
        <AnimatePresence>
          {tip && tipPos && !b.drag && (
            <motion.div
              key={tip}
              className={t.tableTip}
              style={{ left: `${Math.min(80, Math.max(20, (tipPos.x / W) * 100))}%`, top: `${((tipPos.y - SR - 12) / height) * 100}%`, x: "-50%", y: "-100%" }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              aria-hidden="true"
            >
              <strong>
                Table {tip} · <span className={t.num}>{byTable.get(tip)?.length ?? 0}</span> of 8
              </strong>
              <span className={t.tipNames}>{(byTable.get(tip) ?? []).map((g) => g.name).join(", ") || "Nobody yet. Drag someone here."}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={t.legend}>
        <span className={t.legendItem}>
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="5" className={t.seatOn} />
          </svg>
          Seated
        </span>
        <span className={t.legendItem}>
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" className={t.seatOff} />
          </svg>
          Free seat
        </span>
        <span className={t.legendHelp}>
          {guestsOpen ? (
            "Pick a table to see who is at it in Guest list."
          ) : (
            <>
              Open{" "}
              <button type="button" className={t.inlineLink} onClick={() => b.openTool("guests")}>
                Guest list
              </button>{" "}
              beside this to seat people.
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/* ── Guest list ──────────────────────────────────────────────────── */

type Filter = "waiting" | "seated" | "all";

export function GuestsBody() {
  const b = useBench();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [q, setQ] = useState("");
  const waiting = b.guests.filter((g) => g.table === null);
  const seated = b.guests.length - waiting.length;
  const sel = b.selectedTable;

  const list = b.guests.filter((g) => {
    if (sel !== null) return g.table === sel;
    if (filter === "waiting" && g.table !== null) return false;
    if (filter === "seated" && g.table === null) return false;
    return !q || g.name.toLowerCase().includes(q.toLowerCase());
  });

  const counts: Record<Filter, number> = { waiting: waiting.length, seated, all: b.guests.length };
  const labels: Record<Filter, string> = { waiting: "Waiting", seated: "Seated", all: "Everyone" };

  const onDragStart = (e: DragEvent, g: Guest) => {
    e.dataTransfer.setData("text/plain", g.name);
    e.dataTransfer.effectAllowed = "move";
    b.setDrag({ kind: "guest", id: g.id, label: g.name });
  };

  return (
    <div className={cx(t.body, t.guestBody)}>
      <AnimatePresence initial={false} mode="popLayout">
        {sel !== null ? (
          <motion.div key="linked" className={t.linked} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} role="status">
            <LinkIcon size={15} />
            <span>
              Showing <strong>Table {sel}</strong>, picked in Seating
            </span>
            <button type="button" className={t.linkedClear} onClick={() => b.selectTable(null)}>
              <CloseIcon size={13} /> Show everyone
            </button>
          </motion.div>
        ) : (
          <motion.div key="filters" className={t.guestTools} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={t.segment} role="radiogroup" aria-label="Show guests">
              {(Object.keys(labels) as Filter[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} className={t.segBtn} onClick={() => setFilter(k)}>
                  {labels[k]} <span className={t.num}>{counts[k]}</span>
                </button>
              ))}
            </div>
            <label className={t.search}>
              <SearchIcon size={15} />
              <span className={t.srOnly}>Find a guest</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest" />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {filter === "waiting" && sel === null && list.length > 0 && (
        <p className={t.helper}>
          {b.isOpen("seating") ? "Drag someone onto a table in Seating, or use the arrow to send them to one." : "Use the arrow beside a name to give them a table."}
        </p>
      )}

      <ul className={t.guestList}>
        <AnimatePresence initial={false}>
          {list.map((g) => (
            <motion.li
              key={g.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
              className={cx(t.guestRow, b.drag?.id === g.id && t.dragging)}
            >
              <div className={t.guestDrag} draggable onDragStart={(e) => onDragStart(e, g)} onDragEnd={() => b.setDrag(null)}>
                <span className={t.grip} aria-hidden="true">
                  <GripIcon size={14} />
                </span>
                <span className={t.guestAvatar} aria-hidden="true">
                  {g.name
                    .replace(/^(Aunt|Uncle|Father) /, "")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className={t.guestText}>
                  <span className={t.guestName}>{g.name}</span>
                  <span className={t.guestMeta}>
                    {g.side}
                    {g.diet ? ` · ${g.diet}` : ""}
                  </span>
                </span>
                {g.table !== null ? (
                  <button type="button" className={cx(t.tableChip, t.num)} onClick={() => b.selectTable(g.table)} aria-label={`Table ${g.table}. Show this table`}>
                    Table {g.table}
                  </button>
                ) : (
                  <span className={t.noTable}>No table yet</span>
                )}
              </div>
              <button type="button" className={t.sendBtn} onClick={() => b.openSend({ kind: "guest", id: g.id })} aria-label={`Give ${g.name} a table`} title="Give them a table">
                <SendIcon size={16} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {list.length === 0 && (
        <p className={t.emptyLine}>{filter === "waiting" && sel === null ? "Everyone has a table. Nice work." : sel !== null ? `Nobody at Table ${sel} yet. Drag someone onto it.` : "Nobody matches that."}</p>
      )}
    </div>
  );
}
