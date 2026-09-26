"use client";

import {
  LINE_BY_ID,
  LINE_STOPS,
  PEOPLE,
  TERMINUS,
  downstreamOf,
  fmtDay,
  upstreamOf,
  type LineId,
  type Model,
  type PersonPlace,
  type Station,
  type StationStatus,
} from "./data";
import { IconArrow, IconBell, IconCheck, IconClose } from "./icons";
import styles from "./c5.module.css";

export type CardSide = "left" | "right" | "below" | "above";

export const STATUS_WORD: Record<StationStatus, string> = {
  done: "Reached",
  upcoming: "Coming up",
  held: "Held",
  overdue: "Late",
  review: "In review",
  today: "Due today",
};

export function StatusChip({ status, label }: { status: StationStatus; label?: string }) {
  return (
    <span className={styles.chip} data-tone={status}>
      {status === "done" ? <IconCheck size={11} /> : <span className={styles.chipDot} aria-hidden />}
      {label ?? STATUS_WORD[status]}
    </span>
  );
}

export function Avatar({ id, size = 22 }: { id: string; size?: number }) {
  const p = PEOPLE[id];
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {p?.initials ?? "?"}
    </span>
  );
}

function names(ids: string[], stations: Record<string, Station>) {
  return ids.map((id) => stations[id]?.name).filter(Boolean) as string[];
}

/** Immediate next stops: along each line, and anything that waits on this stop. */
export function directNext(id: string, stations: Record<string, Station>) {
  const out = new Set<string>();
  for (const stops of Object.values(LINE_STOPS)) {
    const i = stops.indexOf(id);
    if (i >= 0 && i < stops.length - 1) out.add(stops[i + 1]);
  }
  for (const s of Object.values(stations)) if (s.dependsOn?.includes(id)) out.add(s.id);
  return [...out].filter((s) => stations[s]);
}

export function StationCard({
  station,
  status,
  stations,
  onClose,
  onZoom,
  pinned,
  side,
  statusOf,
  style,
}: {
  station: Station;
  status: StationStatus;
  stations: Record<string, Station>;
  onClose: () => void;
  onZoom: (l: LineId) => void;
  pinned: boolean;
  side: CardSide;
  statusOf: (s: Station) => StationStatus;
  style: React.CSSProperties;
}) {
  const owner = PEOPLE[station.owner];
  const deps = upstreamOf(station.id, stations).filter((id) => stations[id]);
  const next = directNext(station.id, stations);
  const blocks = next.length ? names(next, stations) : [TERMINUS.name];
  const held = status === "held" ? downstreamOf(station.id, stations) : [];
  return (
    <div className={styles.card} style={style} role="dialog" aria-label={`${station.name}, stop details`} data-pinned={pinned || undefined} data-side={side}>
      <div className={styles.cardLines}>
        {station.lines.map((l) => (
          <span key={l} className={styles.cardLine}>
            <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[l].color }} />
            {station.lines.length > 1 ? LINE_BY_ID[l].short : LINE_BY_ID[l].name}
          </span>
        ))}
        <span className={styles.cardHeadEnd}>
          <StatusChip status={status} />
          {pinned ? (
            <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close stop details">
              <IconClose size={13} />
            </button>
          ) : null}
        </span>
      </div>
      <h3 className={styles.cardTitle}>{station.name}</h3>
      <p className={styles.cardTask}>{station.task}</p>
      {station.note && status !== "done" ? <p className={styles.cardNote} data-tone={status}>{station.note}</p> : null}
      <dl className={styles.facts}>
        <dt>Owner</dt>
        <dd>
          <Avatar id={station.owner} size={18} /> {owner?.full}
        </dd>
        <dt>{status === "done" ? "Reached" : "Due"}</dt>
        <dd>{fmtDay(station.doneOn ?? station.date)}</dd>
        <dt>Waits on</dt>
        <dd className={styles.depList}>
          {deps.length
            ? deps.map((id) => {
                const ds = statusOf(stations[id]);
                return (
                  <span key={id} className={styles.dep} data-tone={ds}>
                    {stations[id].name}
                    {ds === "held" ? <em> · held 15 days</em> : ds === "overdue" ? <em> · late</em> : ds === "done" ? <em> · reached</em> : null}
                  </span>
                );
              })
            : "Nothing, it can start now"}
        </dd>
        <dt>{status === "held" ? "Holds up" : "Leads to"}</dt>
        <dd>{status === "held" ? `${held.length} later stops: ${names(held, stations).join(", ")}` : blocks.join(", ")}</dd>
      </dl>
      {pinned ? (
        <div className={styles.cardActions}>
          <button type="button" className={styles.btn} data-size="sm" onClick={() => onZoom(station.lines[0])}>
            Zoom to line
          </button>
          {status === "held" || status === "overdue" ? (
            <button type="button" className={styles.btn} data-size="sm" data-variant="primary">
              <IconBell size={13} /> Nudge {owner?.name}
            </button>
          ) : (
            <button type="button" className={styles.btn} data-size="sm" data-variant="primary">
              Open in Tasks <IconArrow size={13} />
            </button>
          )}
        </div>
      ) : (
        <p className={styles.cardHint}>Click to pin. Arrow keys move along the line.</p>
      )}
    </div>
  );
}

export function PersonCard({ place, stations, side, style }: { place: PersonPlace; stations: Record<string, Station>; side: CardSide; style: React.CSSProperties }) {
  const p = PEOPLE[place.person];
  const stops = LINE_STOPS[place.line].filter((id) => stations[id]);
  const nextId = stops[Math.min(stops.length - 1, Math.max(0, Math.ceil(place.p + 0.001)))];
  const next = stations[nextId];
  return (
    <div className={styles.card} style={style} role="tooltip" data-side={side}>
      <div className={styles.personHead}>
        <Avatar id={place.person} size={30} />
        <div>
          <div className={styles.cardTitleSm}>{p.full}</div>
          <div className={styles.muted}>
            {p.role}
          </div>
          <div className={`${styles.lineInline} ${styles.muted}`}>
            <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[place.line].color }} />
            {LINE_BY_ID[place.line].name} line
          </div>
        </div>
      </div>
      <p className={styles.cardTask}>{place.doing}</p>
      {next ? (
        <p className={styles.muted}>
          Next stop: <strong className={styles.strong}>{next.name}</strong>, {fmtDay(next.date)}
        </p>
      ) : null}
      <p className={styles.cardHint}>{place.since}</p>
    </div>
  );
}

export function ImpactCallout({ from, stations, style, onClose }: { from: Station; stations: Record<string, Station>; style: React.CSSProperties; onClose?: () => void }) {
  const held = downstreamOf(from.id, stations);
  const first = held.find((id) => stations[id].lines.length > 1) ?? held[0];
  return (
    <div className={styles.impact} style={style} role="status" data-locked={onClose ? true : undefined}>
      <div className={styles.impactHead}>
        <span className={styles.impactCount}>{held.length}</span>
        <span>
          {from.name} holds {held.length} later stops, including <strong>{stations[first]?.name}</strong>
        </span>
        {onClose ? (
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <IconClose size={13} />
          </button>
        ) : null}
      </div>
      <p className={styles.impactWhy}>{from.note}</p>
      <ol className={styles.impactList}>
        {held.map((id) => (
          <li key={id}>
            <span className={styles.lineSwatch} style={{ background: LINE_BY_ID[stations[id].lines[stations[id].lines.length - 1]].color }} />
            {stations[id].name}
            <span className={styles.muted}>{fmtDay(stations[id].date)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function JourneyCard({ model, reached, total, daysToGo, onClose }: { model: Model; reached: number; total: number; daysToGo: number; onClose: () => void }) {
  const pct = total ? Math.round((reached / total) * 100) : 0;
  const s = model.stations;
  const chain = ["f3", "f4", "f5"].filter((id) => s[id]);
  const arrived = model.variant === "after";
  const slack = model.variant === "good" ? 11 : 6;
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <section id="c5-journey" className={`${styles.panel} ${styles.journey}`} aria-label="Journey summary">
      <button type="button" className={`${styles.iconBtn} ${styles.journeyClose}`} onClick={onClose} aria-label="Close journey summary">
        <IconClose size={13} />
      </button>
      <div className={styles.journeyCol}>
        <div className={styles.journeyTop}>
          <div>
            <div className={styles.muted}>Journey to</div>
            <h3 className={styles.cardTitle}>
              {TERMINUS.name}, {fmtDay(TERMINUS.date)}
            </h3>
          </div>
        </div>
        <div className={styles.journeyStats}>
          <svg width="76" height="76" viewBox="0 0 76 76" className={styles.ring} aria-hidden>
            <circle cx="38" cy="38" r={R} className={styles.ringTrack} />
            <circle cx="38" cy="38" r={R} className={styles.ringFill} strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 38 38)" />
            <text x="38" y="43" textAnchor="middle" className={styles.ringText}>
              {pct}%
            </text>
          </svg>
          <div className={styles.journeyNums}>
            <div>
              <strong className={styles.bigNum}>{reached}</strong> <span className={styles.muted}>of {total} stops reached</span>
            </div>
            <div>
              <strong className={styles.bigNum}>{arrived ? "Arrived" : daysToGo}</strong> <span className={styles.muted}>{arrived ? "on 3 October" : "days to go"}</span>
            </div>
          </div>
        </div>
        <div className={styles.verdict} data-tone={arrived || model.variant === "good" ? "good" : "watch"}>
          <IconCheck size={14} />
          <div>
            {arrived ? (
              <strong>The deciding chain arrived on time.</strong>
            ) : (
              <>
                <strong>The deciding chain arrives on time, with {slack} days to spare.</strong>{" "}
                {model.variant === "good" ? "Every stop on it is moving." : "That runs out if the tasting slips past 7 Aug."}
              </>
            )}
          </div>
        </div>
      </div>
      <div className={styles.journeyCol}>
        <div className={styles.chainLabel}>The chain that decides the date</div>
        <ol className={styles.chain}>
          {chain.map((id) => (
            <li key={id} data-status={s[id].status}>
              <span className={styles.chainDot} />
              <span className={styles.chainName}>{s[id].name}</span>
              <span className={styles.muted}>{fmtDay(s[id].date)}</span>
            </li>
          ))}
          <li data-status="terminus">
            <span className={styles.chainDot} />
            <span className={styles.chainName}>{TERMINUS.name}</span>
            <span className={styles.muted}>{fmtDay(TERMINUS.date)}</span>
          </li>
        </ol>
        <p className={styles.cardHint}>RSVPs close on 5 Sept and feed Final numbers too. The chain is highlighted on the map.</p>
      </div>
    </section>
  );
}
