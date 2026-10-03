/**
 * Loading shapes with the final geometry, so a view settles into its
 * tracing instead of replacing it. Static under reduced motion. Server
 * safe: no hooks, no client state.
 */

import styles from "./skeletons.module.css";

function Bar({ w, h = 12, r }: { w: number | string; h?: number; r?: number }) {
  return <span className={styles.bar} style={{ width: w, height: h, borderRadius: r }} />;
}

export function HeaderSkeleton() {
  return (
    <div className={styles.header} aria-hidden="true">
      <div className={styles.row}>
        <span className={styles.tile} />
        <Bar w={140} />
        <span className={styles.spacer} />
        <span className={styles.faces}><span /><span /><span /></span>
        <Bar w={64} h={32} r={8} />
        <Bar w={112} h={32} r={8} />
      </div>
      <Bar w={120} h={28} r={6} />
      <div className={styles.row}>
        <Bar w={96} />
        <Bar w={120} h={6} r={999} />
        <Bar w={92} h={28} r={999} />
        <Bar w={104} h={28} r={999} />
        <Bar w={116} h={28} r={999} />
      </div>
      <div className={styles.row}>
        <Bar w={236} h={32} r={8} />
        <span className={styles.spacer} />
        <Bar w={220} h={32} r={8} />
        <Bar w={76} h={32} r={8} />
        <Bar w={84} h={32} r={8} />
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  const lanes = [3, 2, 2, 1, 2];
  return (
    <div className={styles.board} aria-hidden="true">
      {lanes.map((cards, lane) => (
        <div key={lane} className={styles.lane}>
          <div className={styles.row}>
            <span className={styles.glyph} />
            <Bar w={72 + (lane % 3) * 14} />
            <Bar w={14} />
          </div>
          <Bar w="70%" h={10} />
          {Array.from({ length: cards }, (_, index) => (
            <div key={index} className={styles.card}>
              <div className={styles.row}>
                <span className={styles.glyph} />
                <Bar w={`${60 + ((lane + index) % 3) * 12}%`} />
              </div>
              <div className={styles.row}>
                <Bar w={56} h={18} r={6} />
                <Bar w={64} h={18} r={6} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className={styles.list} aria-hidden="true">
      <div className={styles.listHead}>
        <Bar w={60} />
        <span className={styles.spacer} />
        <Bar w={60} />
        <Bar w={70} />
        <Bar w={50} />
        <Bar w={60} />
      </div>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className={styles.listRow}>
          <span className={styles.glyph} />
          <Bar w={`${30 + (index % 4) * 8}%`} />
          <span className={styles.spacer} />
          <Bar w={84} h={20} r={999} />
          <span className={styles.face} />
          <Bar w={64} />
          <Bar w={48} />
        </div>
      ))}
    </div>
  );
}

/** `bare` is the month alone, for inside the calendar view while its
 *  layout resolves: the real toolbar is already drawn above it. */
export function CalendarSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div className={bare ? styles.calendarBare : styles.calendar} aria-hidden="true">
      {bare ? null : (
        <div className={styles.row}>
          <Bar w={140} h={24} r={6} />
          <span className={styles.spacer} />
          <Bar w={200} h={32} r={8} />
        </div>
      )}
      <div className={bare ? undefined : styles.calendarBody}>
        <div className={styles.month}>
          {Array.from({ length: 35 }, (_, index) => (
            <span key={index} className={styles.day}>
              <Bar w={16} h={10} />
              {index % 5 === 2 ? <Bar w="80%" h={16} r={4} /> : null}
            </span>
          ))}
        </div>
        {bare ? null : (
          <div className={styles.pane}>
            <Bar w={120} h={14} />
            <Bar w="90%" h={32} r={8} />
            <Bar w="90%" h={32} r={8} />
            <Bar w="70%" h={32} r={8} />
          </div>
        )}
      </div>
      {/* A phone opens the calendar as an agenda, so it loads as one. */}
      {bare ? null : (
        <div className={styles.calendarPhone}>
          <AgendaSkeleton />
        </div>
      )}
    </div>
  );
}

export function AgendaSkeleton() {
  return (
    <div className={styles.list} aria-hidden="true">
      {Array.from({ length: 4 }, (_, group) => (
        <div key={group} className={styles.agendaGroup}>
          <Bar w={120} h={14} />
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className={styles.listRow}>
              <span className={styles.glyph} />
              <Bar w={`${40 + index * 12}%`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SheetSkeleton() {
  return (
    <div className={styles.sheet} aria-hidden="true">
      <Bar w={180} h={12} />
      <Bar w="70%" h={24} r={6} />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={styles.row}>
          <Bar w={84} />
          <Bar w={120 + (index % 3) * 30} h={24} r={6} />
        </div>
      ))}
      <Bar w="100%" h={72} r={8} />
    </div>
  );
}
