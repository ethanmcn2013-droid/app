"use client";

import { AnimatePresence, motion } from "motion/react";
import { UPCOMING, nodeById, projectById, type Conn, type Filter, type LedgerItem } from "./data";
import { plural, summary } from "./model";
import { Icon, NodeGlyph } from "./glyphs";
import { Swatch, cx } from "./parts";
import s from "./c6.module.css";

function Entry({ item, conn, onHover, onOpen, hot }: { item: LedgerItem | (typeof UPCOMING)[number]; conn: Conn; onHover: (id: string | null) => void; onOpen: (id: string) => void; hot: boolean }) {
  const from = nodeById(conn.from);
  const to = nodeById(conn.to);
  const fresh = item.time === "Just now";
  return (
      <button
        type="button"
        className={cx(s.entry, hot && s.entryHot, fresh && s.entryFresh)}
        onPointerEnter={() => onHover(conn.id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(conn.id)}
        onBlur={() => onHover(null)}
        onClick={() => onOpen(conn.id)}
      >
        <span className={cx(s.entryTime, s.num)}>{item.time}</span>
        <span className={s.entryBody}>
          <span className={s.entryText}>{item.text}</span>
          {item.detail && <span className={s.entryDetail}>{item.detail}</span>}
          <span className={s.entryMeta}>
            <Swatch project={conn.project} />
            <span>{conn.project ? projectById(conn.project).name : "Every Project"}</span>
            <span className={s.entryPath} aria-label={`${from.name} to ${to.name}`}>
              <NodeGlyph g={from.glyph} size={13} />
              <Icon name="arrow" size={10} />
              <NodeGlyph g={to.glyph} size={13} />
            </span>
            {"grouped" in item && item.grouped && <span className={s.groupPill}>Grouped · about 40 a day</span>}
          </span>
        </span>
      </button>
  );
}

export function TodayLedger({
  items,
  conns,
  filter,
  hi,
  empty,
  onHover,
  onOpen,
  onClearFilter,
}: {
  items: LedgerItem[];
  conns: Conn[];
  filter: Filter;
  hi: string[];
  empty: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  onClearFilter: () => void;
}) {
  const byId = new Map(conns.map((c) => [c.id, c]));
  const inScope = (id: string) => {
    const c = byId.get(id);
    return Boolean(c) && (filter === "all" || c!.project === filter || c!.project === null);
  };
  const shown = items.filter((i) => inScope(i.conn));
  const upcoming = empty ? [] : UPCOMING.filter((u) => inScope(u.conn) && byId.get(u.conn)?.status === "live");
  const sum = summary(conns, filter);

  return (
    <section className={s.ledger} aria-labelledby="c6-today">
      <header className={s.ledgerHead}>
        <h2 id="c6-today" className={s.ledgerTitle}>
          Today
        </h2>
        <span className={s.ledgerDate}>Friday 25 September</span>
      </header>
      {!empty && (
        <p className={cx(s.ledgerSum, s.num)}>
          {plural(sum.inToday, "thing", "things")} came in and {sum.outToday} went out
          {filter !== "all" && <> for {projectById(filter).name}</>}.
        </p>
      )}
      {filter !== "all" && (
        <p className={s.ledgerScope}>
          <Swatch project={filter} />
          <span>Showing {projectById(filter).name} and anything shared.</span>
          <button type="button" className={s.linkBtn} onClick={onClearFilter}>
            Show all
          </button>
        </p>
      )}

      {upcoming.length > 0 && (
        <>
          <h3 className={s.ledgerGroup}>Later today</h3>
          <ul className={s.entries}>
            {upcoming.map((u) => (
              <li key={u.id} className={s.entryItem}>
                <Entry item={u} conn={byId.get(u.conn)!} onHover={onHover} onOpen={onOpen} hot={hi.includes(u.conn)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={s.ledgerGroup}>{empty ? "So far" : "Earlier today"}</h3>
      {shown.length === 0 ? (
        <p className={s.ledgerEmpty}>{empty ? "Nothing has come in yet. Once something is connected, every email, reply and photo that arrives shows up here." : "Nothing came in for this Project today."}</p>
      ) : (
        <ul className={s.entries}>
          <AnimatePresence initial={false}>
            {shown.map((it) => (
              <motion.li key={it.id} className={s.entryItem} layout="position" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <Entry item={it} conn={byId.get(it.conn)!} onHover={onHover} onOpen={onOpen} hot={hi.includes(it.conn)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {!empty && <p className={s.ledgerFoot}>Point at a line of the ledger to see its route on the map.</p>}
    </section>
  );
}
