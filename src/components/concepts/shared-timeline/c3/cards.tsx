"use client";

/* The stationery. Every milestone is a piece of card with its own format
   and a back. Sizes are set in container units, so a card on the table
   and the same card lifted to the front are one object at two scales. */

import { motion, useReducedMotion } from "motion/react";
import { useId, useState, type ReactNode } from "react";
import {
  fmtDM,
  fmtLong,
  fmtNumeric,
  fmtShort,
  fmtWeekday,
  icsFor,
  seeded,
  yearOf,
  type Format,
  type Suite,
  type SuitePiece,
} from "./data";
import { DeckleDefs, OrchardMap, PaperClip, Postmark, SchoolMap } from "./art";
import s from "./c3.module.css";

/* ── Shapes ────────────────────────────────────────────────────────── */

export type Shape = "native" | "tall";

const NATIVE_AR: Record<Format, number> = {
  date: 7 / 5,
  letter: 5 / 7,
  reply: 7 / 5,
  ticket: 8 / 5,
  menu: 5 / 8,
  seats: 4 / 5,
  schedule: 5 / 7,
  map: 1,
  note: 1,
};
export const MAIN_AR = 5 / 7;
export const TALL_AR = 5 / 7.4;

export function aspectFor(format: Format | "main", shape: Shape) {
  if (shape === "tall") return TALL_AR;
  return format === "main" ? MAIN_AR : NATIVE_AR[format];
}

export function statusLine(p: SuitePiece) {
  if (p.placeholder) return "More to come";
  if (!p.date) return "";
  if (p.status === "done") return `${p.doneWord} ${fmtDM(p.date)}`;
  if (p.status === "next") {
    const d = p.inDays ?? 0;
    const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
    return `Next · ${fmtDM(p.date)}, ${when}`;
  }
  return fmtDM(p.date);
}

export const tilt = (id: string, spread = 2.4) => +(seeded(id, 3) * spread).toFixed(2);

/* ── The flip ──────────────────────────────────────────────────────── */

export function Flip({
  flipped,
  front,
  back,
  className,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`${s.flipper} ${className ?? ""}`}
      initial={false}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20, mass: 0.9 }}
    >
      <div className={s.face} aria-hidden={flipped} inert={flipped}>
        {front}
      </div>
      <div className={`${s.face} ${s.faceBack}`} aria-hidden={!flipped} inert={!flipped}>
        {back}
      </div>
    </motion.div>
  );
}

export function TurnButton({ onClick, back, label }: { onClick: () => void; back?: boolean; label?: string }) {
  return (
    <button type="button" className={s.turn} onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true" className={s.turnIcon}>
        <path d="M4 10a6 6 0 0 1 10.2-4.2M16 10a6 6 0 0 1-10.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14.6 2.8v3.3h-3.3M5.4 17.2v-3.3h3.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label ?? (back ? "Turn back" : "Turn over")}
    </button>
  );
}

/* ── Stamp that lands once ─────────────────────────────────────────── */

export function LandingPostmark({ piece, delay }: { piece: SuitePiece; delay: number | false }) {
  const reduce = useReducedMotion();
  if (piece.status !== "done" || !piece.date || piece.placeholder || piece.closed) return null;
  const angle = tilt(piece.id + "pm", 14) - 6;
  const animate = delay !== false && !reduce;
  return (
    <motion.div
      className={s.postmark}
      initial={animate ? { opacity: 0, scale: 1.6, rotate: angle - 12 } : false}
      animate={{ opacity: 1, scale: 1, rotate: angle }}
      transition={animate ? { delay: delay as number, type: "spring", stiffness: 520, damping: 22 } : { duration: 0 }}
    >
      <Postmark word={piece.doneWord} date={fmtShort(piece.date)} year={yearOf(piece.date)} />
    </motion.div>
  );
}

/* ── Piece fronts ──────────────────────────────────────────────────── */

function Foot({ piece, total }: { piece: SuitePiece; total: number }) {
  const line = statusLine(piece);
  return (
    <div className={s.foot}>
      <span className={s.footNo}>
        No. {piece.n}
        <span className={s.footOf}> of {total}</span>
      </span>
      {line && !piece.placeholder ? (
        <span className={s.footStatus} data-status={piece.status}>
          {piece.status === "next" ? <span className={s.nextDot} aria-hidden="true" /> : null}
          {line}
        </span>
      ) : null}
    </div>
  );
}

function Body({ piece }: { piece: SuitePiece }) {
  if (!piece.body) return null;
  return (
    <div className={s.detailOnly}>
      {piece.body.map((b) => (
        <p key={b} className={s.bodyText}>
          {b}
        </p>
      ))}
    </div>
  );
}

function DateFront({ piece, suite }: { piece: SuitePiece; suite: Suite }) {
  const isDay = piece.big === "day";
  const big = isDay ? fmtNumeric(suite.day) : piece.big ?? fmtNumeric(piece.date ?? suite.day);
  return (
    <div className={s.fDate}>
      <p className={s.scriptTitle}>{piece.title}</p>
      <p className={s.bigNumerals}>
        {isDay && suite.oldDay ? (
          <del className={s.bigOld}>
            {fmtNumeric(suite.oldDay)}
          </del>
        ) : null}
        {big}
      </p>
      <p className={s.leadLine}>{piece.big === "day" ? `${suite.title} · ${suite.world.place.split(",")[0]}` : piece.lead}</p>
    </div>
  );
}

function LetterFront({ piece }: { piece: SuitePiece }) {
  return (
    <div className={s.fLetter}>
      <span className={s.ornament} aria-hidden="true">
        ❦
      </span>
      <p className={s.formalTitle}>{piece.title}</p>
      <p className={s.leadItalic}>{piece.lead}</p>
      <Body piece={piece} />
    </div>
  );
}

function ReplyFront({ piece, suite }: { piece: SuitePiece; suite: Suite }) {
  const school = suite.world.id === "school";
  return (
    <div className={s.fReply}>
      <p className={s.replyBy}>
        Please reply by <span className={s.nowrap}>{piece.date ? fmtDM(piece.date) : ""}</span>
      </p>
      {piece.closed ? (
        <p className={s.overprint}>{suite.world.closedText}</p>
      ) : (
        <>
          <div className={s.formLine}>
            <span>{school ? "Family of" : "M"}</span>
            <span className={s.rule} />
          </div>
          <div className={s.boxes}>
            <span>
              <span className={s.box} aria-hidden="true" /> {school ? "will be there" : "joyfully accepts"}
            </span>
            <span>
              <span className={s.box} aria-hidden="true" /> {school ? "cannot make it" : "regretfully declines"}
            </span>
          </div>
          <div className={`${s.formLine} ${s.detailOnly}`}>
            <span>{school ? "Number coming" : "Anything we should know"}</span>
            <span className={s.rule} />
          </div>
        </>
      )}
    </div>
  );
}

function TicketFront({ piece, suite }: { piece: SuitePiece; suite: Suite }) {
  return (
    <div className={s.fTicket}>
      <div className={s.ticketMain}>
        <p className={s.scriptTitle}>{piece.title}</p>
        <p className={s.ticketPrice}>{piece.price}</p>
        <p className={s.leadLine}>{piece.lead}</p>
      </div>
      <div className={s.ticketStub} aria-hidden="true">
        <span>Admit one</span>
        <span className={s.stubNo}>{fmtShort(suite.day)}</span>
      </div>
    </div>
  );
}

function MenuFront({ piece }: { piece: SuitePiece }) {
  const out = piece.status === "done";
  const courses = piece.menu ?? [];
  return (
    <div className={s.fMenu}>
      <p className={s.formalTitle}>{piece.title}</p>
      <span className={s.menuRule} aria-hidden="true" />
      <ol className={s.courses}>
        {courses.map((c, i) => (
          <li key={c} className={!out && i > 0 ? s.courseSoon : undefined}>
            {c}
          </li>
        ))}
      </ol>
      <p className={s.leadItalic}>{piece.lead}</p>
    </div>
  );
}

function SeatsFront({ piece, suite }: { piece: SuitePiece; suite: Suite }) {
  const total = piece.seats?.total ?? 0;
  const taken = piece.closed ? total : piece.seats?.taken ?? 0;
  const cols = 12;
  const rows = Math.ceil(total / cols);
  return (
    <div className={s.fSeats}>
      <p className={s.formalTitle}>{piece.title}</p>
      <svg viewBox={`0 0 ${cols * 10} ${rows * 10 + 12}`} className={s.seatsSvg} role="img" aria-label={`${taken} of ${total} seats taken`}>
        {/* two long tables, six seats a side each way */}
        <rect x="-2" y={rows * 5 - 1} width={cols * 10 + 4} height="2" fill="var(--is-ink-3)" opacity="0.5" />
        {Array.from({ length: total }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const y = r * 10 + 5 + (r >= rows / 2 ? 6 : 0);
          return (
            <circle
              key={i}
              cx={c * 10 + 5}
              cy={y}
              r="3.2"
              fill={i < taken ? "var(--is-ink-accent)" : "none"}
              stroke="var(--is-ink-accent)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <p className={s.seatsCount}>
        {piece.closed ? (
          suite.world.closedText
        ) : (
          <>
            <span className={s.num}>{total - taken}</span> of <span className={s.num}>{total}</span> seats left
          </>
        )}
      </p>
      {!piece.closed ? <p className={s.leadItalic}>{piece.lead}</p> : null}
    </div>
  );
}

function ScheduleFront({ piece }: { piece: SuitePiece }) {
  return (
    <div className={s.fSchedule}>
      <p className={s.formalTitle}>{piece.title}</p>
      <p className={s.leadItalic}>{piece.lead}</p>
      <ol className={s.schedule}>
        {(piece.schedule ?? []).map((r) => (
          <li key={r.time + r.what}>
            {r.day ? <span className={s.schedDay}>{r.day}</span> : null}
            <span className={s.schedTime}>{r.time}</span>
            <span className={s.schedWhat}>{r.what}</span>
            <span className={s.schedWhere}>{r.where}</span>
          </li>
        ))}
      </ol>
      {piece.back.kind === "schedule" && piece.back.foot ? (
        <p className={s.schedFoot}>{piece.back.foot}</p>
      ) : null}
    </div>
  );
}

function MapFront({ piece }: { piece: SuitePiece }) {
  return (
    <div className={s.fMap}>
      <div className={s.mapFrame}>{piece.map === "school" ? <SchoolMap /> : <OrchardMap />}</div>
      <div className={s.mapText}>
        <p className={s.scriptTitle}>{piece.title}</p>
        <p className={s.leadLine}>{piece.lead}</p>
        {piece.stops ? (
          <ol className={s.stops}>
            {piece.stops.map((st, i) => (
              <li key={st.name}>
                <span className={s.stopNo}>{i + 1}</span>
                <span>
                  {st.name}
                  <span className={s.stopWhat}> · {st.what}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}

function NoteFront({ piece }: { piece: SuitePiece }) {
  return (
    <div className={s.fNote}>
      <p className={s.scriptTitle}>{piece.title}</p>
      <p className={s.noteLead}>{piece.lead}</p>
      <Body piece={piece} />
    </div>
  );
}

function PlaceholderFront() {
  return (
    <div className={s.fPlaceholder}>
      <span className={s.emboss} aria-hidden="true" />
      <p className={s.soonText}>More to come</p>
    </div>
  );
}

export function PieceFront({
  piece,
  suite,
  stampDelay,
}: {
  piece: SuitePiece;
  suite: Suite;
  stampDelay: number | false;
}) {
  const total = suite.pieces.length;
  let inner: ReactNode;
  if (piece.placeholder) inner = <PlaceholderFront />;
  else
    switch (piece.format) {
      case "date":
        inner = <DateFront piece={piece} suite={suite} />;
        break;
      case "letter":
        inner = <LetterFront piece={piece} />;
        break;
      case "reply":
        inner = <ReplyFront piece={piece} suite={suite} />;
        break;
      case "ticket":
        inner = <TicketFront piece={piece} suite={suite} />;
        break;
      case "menu":
        inner = <MenuFront piece={piece} />;
        break;
      case "seats":
        inner = <SeatsFront piece={piece} suite={suite} />;
        break;
      case "schedule":
        inner = <ScheduleFront piece={piece} />;
        break;
      case "map":
        inner = <MapFront piece={piece} />;
        break;
      case "note":
        inner = <NoteFront piece={piece} />;
        break;
    }
  return (
    <div className={s.front}>
      <div className={s.frontInner}>{inner}</div>
      <Foot piece={piece} total={total} />
      <LandingPostmark piece={piece} delay={stampDelay} />
    </div>
  );
}

/* ── Piece backs ───────────────────────────────────────────────────── */

function CalendarBack({ suite, heading, body, piece }: { suite: Suite; heading: string; body: string; piece: SuitePiece }) {
  const [reminded, setReminded] = useState(false);
  const remindOn = piece.date ? fmtDM(shiftIso(piece.date, -7)) : "";
  return (
    <>
      <p className={s.backHeading}>{heading}</p>
      <p className={s.backText}>{body}</p>
      <div className={s.backActions}>
        <a className={s.paperButton} href={icsFor(suite)} download={`${suite.world.id}.ics`}>
          Add to calendar
        </a>
        <button
          type="button"
          className={s.paperButton}
          data-on={reminded || undefined}
          aria-pressed={reminded}
          onClick={() => setReminded((r) => !r)}
          disabled={piece.closed}
        >
          {reminded ? `Reminder set for ${remindOn}` : "Get a reminder a week before"}
        </button>
      </div>
      {piece.replies ? <ReplyTally piece={piece} school={suite.world.id === "school"} /> : null}
      <p className={s.backSmall} aria-live="polite">
        {piece.closed
          ? "Replies have closed, so there is nothing left to remind you about."
          : reminded
            ? "This page will nudge you once. Tap again to cancel it."
            : `The ${suite.world.id === "supper" ? "evening" : "day"} itself is ${fmtLong(suite.day)}.`}
      </p>
    </>
  );
}

/** One hairline per guest, inked once they have replied. */
function ReplyTally({ piece, school }: { piece: SuitePiece; school: boolean }) {
  const r = piece.replies!;
  const got = piece.closed ? r.of - 3 : r.in;
  const who = school ? "families" : "guests";
  const step = 4;
  return (
    <figure className={s.tally}>
      <svg
        viewBox={`0 0 ${r.of * step} 20`}
        className={s.tallySvg}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${got} of ${r.of} ${who} have replied`}
      >
        {Array.from({ length: r.of }, (_, i) => (
          <line
            key={i}
            x1={i * step + step / 2}
            x2={i * step + step / 2}
            y1={i % 10 === 9 ? 0 : 4}
            y2={20}
            className={i < got ? s.tallyOn : s.tallyOff}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <figcaption className={s.tallyCaption}>
        <span className={s.tallyNum}>{got}</span> of {r.of} {who} {piece.closed ? "replied" : "have replied so far"}
      </figcaption>
    </figure>
  );
}

function NoteBack({ heading, body, placeholder, host }: { heading: string; body: string; placeholder: string; host: string }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const id = useId();
  if (sent)
    return (
      <>
        <p className={s.backHeading}>Tucked in</p>
        <p className={s.backText}>
          {host} will find your note with the others. Thank you for writing.
        </p>
        <blockquote className={s.sentNote}>{text}</blockquote>
        <button type="button" className={s.textLink} onClick={() => setSent(false)}>
          Change it
        </button>
      </>
    );
  return (
    <>
      <label className={s.backHeading} htmlFor={id}>
        {heading}
      </label>
      <p className={s.backText}>{body}</p>
      <textarea
        id={id}
        className={s.noteField}
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={s.backActions}>
        <button type="button" className={s.paperButton} disabled={!text.trim()} onClick={() => setSent(true)}>
          Tuck it in
        </button>
      </div>
    </>
  );
}

export function PieceBack({ piece, suite }: { piece: SuitePiece; suite: Suite }) {
  const b = piece.back;
  let inner: ReactNode = null;
  if (piece.placeholder)
    inner = (
      <>
        <p className={s.backHeading}>Not printed yet</p>
        <p className={s.backText}>
          {suite.host} will add this card when there is news. This link stays the same, so keep it somewhere handy.
        </p>
      </>
    );
  else if (b.kind === "text")
    inner = (
      <>
        <p className={s.backHeading}>{b.heading}</p>
        {b.body.map((t) => (
          <p key={t} className={s.backText}>
            {t}
          </p>
        ))}
      </>
    );
  else if (b.kind === "calendar") inner = <CalendarBack suite={suite} heading={b.heading} body={b.body} piece={piece} />;
  else if (b.kind === "note") inner = <NoteBack heading={b.heading} body={b.body} placeholder={b.placeholder.replace(suite.world.host.replace(" & ", " and "), suite.host.replace(" & ", " and "))} host={suite.host} />;
  else if (b.kind === "schedule")
    inner = (
      <>
        <p className={s.backHeading}>{b.heading}</p>
        <ol className={s.backSchedule}>
          {b.rows.map((r) => (
            <li key={r.time + r.what}>
              <span className={s.schedTime}>{r.time}</span>
              <span>{r.what}</span>
              <span className={s.schedWhere}>{r.where}</span>
            </li>
          ))}
        </ol>
        {b.foot ? <p className={s.backSmall}>{b.foot}</p> : null}
      </>
    );
  else if (b.kind === "directions")
    inner = (
      <>
        <p className={s.backHeading}>{b.heading}</p>
        <dl className={s.directions}>
          {b.rows.map((r) => (
            <div key={r.how}>
              <dt>{r.how}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  return <div className={s.back}>{inner}</div>;
}

function shiftIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/* ── Paper ─────────────────────────────────────────────────────────── */

/** The sheet itself: texture, edge, shadow, and a format for the CSS. */
export function Paper({
  format,
  shape,
  children,
  className,
  deckle,
}: {
  format: Format | "main" | "placeholder";
  shape: Shape;
  children: ReactNode;
  className?: string;
  deckle?: boolean;
}) {
  const fid = `dk${useId().replace(/:/g, "")}`;
  return (
    <div className={`${s.paper} ${className ?? ""}`} data-format={format} data-shape={shape}>
      {deckle ? <DeckleDefs id={fid} /> : null}
      <span className={s.sheet} style={deckle ? { filter: `url(#${fid})` } : undefined} aria-hidden="true" />
      {children}
    </div>
  );
}

/* ── The main card ─────────────────────────────────────────────────── */

export function MainFront({
  suite,
  asHeading,
  onTurn,
  tall,
}: {
  suite: Suite;
  asHeading: boolean;
  onTurn?: () => void;
  tall?: boolean;
}) {
  const { world, moment } = suite;
  const Title = asHeading ? "h1" : "p";
  const dayof = moment === "dayof";
  const size = suite.title.length > 28 ? "l" : suite.title.length > 13 ? "m" : undefined;
  return (
    <div className={s.main} data-dayof={dayof || undefined}>
      <span className={s.blind} aria-hidden="true">
        {suite.monogram}
      </span>
      {world.id === "school" ? <p className={s.mainKickerTop}>{world.kicker}</p> : null}
      <Title className={s.mainTitle} data-size={size}>
        {suite.title}
      </Title>
      {world.id !== "school" ? <p className={s.mainKicker}>{world.kicker}</p> : null}
      <span className={s.flourish} aria-hidden="true">
        <span />❧<span />
      </span>
      <p className={s.mainDate}>
        {suite.oldDay ? (
          <>
            <del className={s.oldDate}>{fmtLong(suite.oldDay)}</del>{" "}
          </>
        ) : null}
        <span className={s.nowrap}>{fmtLong(suite.day)}</span>
        {world.time ? <span className={s.nowrap}> · {world.time}</span> : null}
      </p>
      <p className={s.mainPlace}>{world.place}</p>
      {tall && !dayof && !suite.oldDay ? <ComingUp suite={suite} /> : null}

      {dayof ? (
        <div className={s.todayBlock}>
          <p className={s.todayWord}>Today</p>
          <ol className={s.runOrder}>
            {world.runOrder.map((r) => (
              <li key={r.time}>
                <span className={s.schedTime}>{r.time}</span>
                <span>{r.what}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <p className={s.countdown} aria-label={`${suite.daysToGo} days to go`}>
            <span className={s.countNum}>{suite.daysToGo}</span> days to go
          </p>
          <WayToTheDay suite={suite} />
          <p className={s.nextLine}>
            {suite.next ? (
              <>
                <span className={s.nextDot} aria-hidden="true" />
                Next: {suite.next.title.toLowerCase() === "the weekend" ? "the weekend begins" : suite.next.title}, {fmtDM(suite.next.date!)}
              </>
            ) : moment === "announced" ? (
              "More cards will arrive as plans are made"
            ) : (
              "Everything is ready. See you there"
            )}
          </p>
        </>
      )}
      <div className={s.mainFoot}>
        <span className={s.updated}>{world.updated}</span>
        {onTurn ? <TurnButton onClick={onTurn} label="What is done so far" /> : null}
      </div>
    </div>
  );
}

/** On a phone the main card is a whole screen: use it for what is next. */
function ComingUp({ suite }: { suite: Suite }) {
  const list = suite.pieces.filter((p) => p.date && !p.placeholder && p.status !== "done" && p.date < suite.day).slice(0, 3);
  if (!list.length) return null;
  return (
    <ol className={s.comingUp} aria-label="Coming up">
      {list.map((p) => (
        <li key={p.id} data-status={p.status}>
          <span className={s.aheadDate}>{fmtShort(p.date!)}</span>
          <span>{p.title}</span>
        </li>
      ))}
    </ol>
  );
}

/** One line from the first milestone to the day, every mark on one scale. */
function WayToTheDay({ suite }: { suite: Suite }) {
  const dated = suite.pieces.filter((p) => p.date && !p.placeholder);
  const start = Math.min(...dated.map((p) => dayIdx(p.date!)), dayIdx(suite.today));
  const end = dayIdx(suite.day);
  const pos = (iso: string) => ((dayIdx(iso) - start) / Math.max(1, end - start)) * 100;
  const now = Math.min(100, Math.max(0, pos(suite.today)));
  return (
    <div className={s.way} role="img" aria-label={`${suite.doneCount} of ${suite.datedCount} dates done, ${suite.daysToGo} days to go`}>
      <div className={s.wayTrack}>
        <span className={s.wayDone} style={{ width: `${now}%` }} />
        {dated.map((p) => (
          <span
            key={p.id}
            className={s.wayDot}
            data-status={p.status}
            style={{ left: `${Math.min(100, pos(p.date!))}%` }}
            title={`${p.title}, ${fmtDM(p.date!)}`}
          />
        ))}
        <span className={s.wayNow} style={{ left: `${now}%` }} />
        <span className={s.wayEnd} />
      </div>
      <div className={s.wayLabels}>
        <span style={{ visibility: now < 20 ? "hidden" : undefined }}>{fmtShort(dated[0]?.date ?? suite.today)}</span>
        <span className={s.wayToday} style={{ left: `${Math.min(90, Math.max(7, now))}%` }}>
          Today
        </span>
        <span style={{ visibility: now > 80 ? "hidden" : undefined }}>{fmtShort(suite.day)}</span>
      </div>
    </div>
  );
}

const dayIdx = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export function MainBack({ suite, onTurn }: { suite: Suite; onTurn?: () => void }) {
  const items = [
    ...suite.world.stamps.filter((st) => st.date <= suite.today),
    ...suite.pieces
      .filter((p) => p.status === "done" && p.date && !p.placeholder)
      .map((p) => ({ what: `${p.title} ${p.doneWord.toLowerCase()}`, date: p.date! })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const ahead = suite.pieces.filter((p) => p.date && !p.placeholder && p.status !== "done" && p.date < suite.day);
  return (
    <div className={s.mainBack}>
      <p className={s.backHeading}>Already done</p>
      <p className={s.backText}>
        {items.length} things {suite.host} have ticked off on the way to {fmtWeekday(suite.day)}.
      </p>
      <ul className={s.inkStamps} data-many={items.length > 4 || undefined}>
        {items.map((it, i) => (
          <li
            key={it.what}
            className={s.inkStamp}
            style={{ rotate: `${tilt(it.what, 5)}deg`, animationDelay: `${0.15 + i * 0.09}s` }}
          >
            <span className={s.inkWhat}>{it.what}</span>
            <span className={s.inkDate}>{fmtShort(it.date)}</span>
          </li>
        ))}
      </ul>
      {ahead.length ? (
        <div className={s.ahead}>
          <p className={s.aheadTitle}>Still to come</p>
          <ol className={s.aheadList}>
            {ahead.map((p) => (
              <li key={p.id} data-status={p.status}>
                <span className={s.aheadDate}>{fmtShort(p.date!)}</span>
                <span>{p.title}</span>
              </li>
            ))}
            <li data-status="day">
              <span className={s.aheadDate}>{fmtShort(suite.day)}</span>
              <span>The {suite.world.id === "wedding" ? "day" : "evening"} itself</span>
            </li>
          </ol>
        </div>
      ) : null}
      <div className={s.mainFoot}>
        <span className={s.updated}>{suite.world.updated}</span>
        {onTurn ? <TurnButton onClick={onTurn} back /> : null}
      </div>
    </div>
  );
}

/** The honest slip clipped over the main card when the day moves. */
export function NewDateSlip({ suite }: { suite: Suite }) {
  if (!suite.oldDay) return null;
  return (
    <div className={s.slip} role="note" aria-label="New date">
      <PaperClip />
      <p className={s.slipTitle}>New date</p>
      <p className={s.slipDate}>{fmtLong(suite.day)}</p>
      <p className={s.slipNote}>{suite.world.postponed.note}</p>
      <p className={s.slipSign}>{suite.host}</p>
    </div>
  );
}
