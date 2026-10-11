"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BOOKINGS,
  BUDGET,
  COUNTDOWN,
  DAYPLAN,
  DEADLINES,
  DEPOSITS,
  EMAIL,
  GROUP,
  GUESTS,
  hueVar,
  NOTES,
  PRESS,
  PROOFS,
  projectById,
  ROTA,
  RUNSHEET,
  SEATING,
  SOCIAL,
  SOURCES,
  SUPPLIERS,
  SURVEY,
  toolById,
  WEATHER,
  WHATSAPP,
  type Size,
  type Widget,
} from "./data";
import { CheckIcon, Glyph, LinkIcon, PauseIcon, PlayIcon, RetryIcon, SendIcon } from "./glyphs";
import s from "./c1.module.css";

export type BodyApi = {
  notify: (msg: string) => void;
  flag: (key: string) => boolean;
  setFlag: (key: string) => void;
  retry: (wid: string) => void;
};

type Props = { w: Widget; size: Size; showProject: boolean; api: BodyApi };

const eur = (n: number) => `€${n.toLocaleString("en-IE")}`;
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/* ── dot-matrix numerals: the one place the shelf has a voice ────── */

const DOTS: Record<string, string[]> = {
  "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "00100", "00100", "00100"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["0", "0", "1", "0", "1", "0", "0"],
};

export function DotNumber({ value, pitch = 5, label }: { value: string; pitch?: number; label: string }) {
  const cols: { x: number; rows: string[] }[] = [];
  let x = 0;
  for (const ch of value) {
    const g = DOTS[ch] ?? DOTS["0"];
    cols.push({ x, rows: g });
    x += g[0].length + 1;
  }
  const width = (x - 1) * pitch;
  const r = pitch * 0.42;
  return (
    <svg className={s.dots} width={width} height={7 * pitch} viewBox={`0 0 ${width} ${7 * pitch}`} role="img" aria-label={label}>
      {cols.map((c, ci) =>
        c.rows.map((row, ri) =>
          row.split("").map((bit, bi) => (
            <circle
              key={`${ci}-${ri}-${bi}`}
              cx={(c.x + bi) * pitch + pitch / 2}
              cy={ri * pitch + pitch / 2}
              r={r}
              className={bit === "1" ? s.dotOn : s.dotOff}
            />
          )),
        ),
      )}
    </svg>
  );
}

/* ── shared bits ─────────────────────────────────────────────────── */

function Head({ w, showProject, right }: { w: Widget; showProject: boolean; right?: ReactNode }) {
  const tool = toolById(w.tool);
  const p = projectById(w.project);
  return (
    <div className={s.head}>
      <span className={s.tile} style={{ background: hueVar(tool.hue) }}>
        <Glyph id={tool.id} size={13} />
      </span>
      {showProject && (
        <span className={s.headProject}>
          <span className={s.headDot} style={{ background: hueVar(p.hue) }} aria-hidden />
          {p.name}
        </span>
      )}
      {right && <span className={s.headRight}>{right}</span>}
    </div>
  );
}

const Big = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx(s.big, className)}>{children}</div>;
const Sub = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx(s.sub, className)}>{children}</div>;

function Early({ w, showProject, text, action }: Props & { text: string; action?: ReactNode }) {
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <p className={s.early}>{text}</p>
      {action}
    </div>
  );
}

/* ── countdown ───────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY_MONTH = 8 + 24 / 30; // 25 September

function MonthArc({ start, end }: { start: number; end: number }) {
  const W = 176;
  const SWEEP = (120 * Math.PI) / 180;
  const R = (W - 12) / (2 * Math.sin(SWEEP / 2));
  const sag = R * (1 - Math.cos(SWEEP / 2));
  const H = Math.ceil(sag) + 22;
  const c = { x: W / 2, y: R + 6 };
  const span = end - start;
  const t = (m: number) => Math.min(1, Math.max(0, (m - start) / span));
  const ang = (u: number) => Math.PI / 2 + SWEEP / 2 - SWEEP * u;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pt = (u: number, r = R) => ({ x: r2(c.x + r * Math.cos(ang(u))), y: r2(c.y - r * Math.sin(ang(u))) });
  const arc = (a: number, b: number) => {
    const p0 = pt(a);
    const p1 = pt(b);
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R.toFixed(2)} ${R.toFixed(2)} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  };
  const now = t(TODAY_MONTH);
  const ticks: number[] = [];
  for (let m = Math.ceil(start); m < end; m++) if (m > start && Math.abs(m - TODAY_MONTH) > 0.2) ticks.push(m);
  const today = pt(now);
  const a = pt(0);
  const b = pt(1);
  const left = Math.max(0, end - TODAY_MONTH);
  return (
    <svg className={s.arc} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Planning from ${MONTHS[Math.floor(start)]} to ${MONTHS[Math.floor(end)]}, about ${left < 1 ? "three weeks" : `${Math.round(left)} months`} left`}>
      <path d={arc(0, now)} className={s.arcDone} />
      <path d={arc(now, 1)} className={s.arcLeft} />
      {ticks.map((m) => {
        const u = t(m);
        const i = pt(u, R - 5);
        const o = pt(u, R);
        return <line key={m} x1={i.x} y1={i.y} x2={o.x} y2={o.y} className={m > TODAY_MONTH ? s.arcTickLeft : s.arcTick} />;
      })}
      <circle cx={a.x} cy={a.y} r={2} className={s.arcStart} />
      <circle cx={today.x} cy={today.y} r={3.5} className={s.arcNow} />
      <circle cx={b.x} cy={b.y} r={4} className={s.arcDay} />
      <text x={a.x} y={a.y + 16} textAnchor="start" className={s.arcText}>
        {MONTHS[Math.floor(start)]}
      </text>
      <text x={b.x} y={b.y + 16} textAnchor="end" className={s.arcText}>
        {MONTHS[Math.floor(end)]}
      </text>
    </svg>
  );
}

function CountdownBody({ w, size, showProject }: Props) {
  const d = COUNTDOWN[w.project];
  const p = projectById(w.project);
  const label = `${d.days} days to ${p.name}, ${d.date}`;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <div className={s.dotRow}>
            <DotNumber value={String(d.days)} pitch={5} label={label} />
            <span className={s.dotUnit}>days</span>
          </div>
          <Sub>{d.short}, {d.detail}</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={cx(s.body, size === "l" && s.bodyTall)}>
      <div className={s.split}>
        <div className={s.splitMain}>
          <Head w={w} showProject={showProject} />
          <div className={s.stackEnd}>
            <div className={s.dotRow}>
              <DotNumber value={String(d.days)} pitch={7} label={label} />
              <span className={s.dotUnit}>days</span>
            </div>
            <Sub>
              {d.date}, {d.detail}
            </Sub>
          </div>
        </div>
        <div className={s.splitAside}>
          <MonthArc start={d.startMonth} end={d.endMonth} />
          <span className={s.micro}>{d.since}</span>
        </div>
      </div>
      {size === "l" && d.left.length > 0 && (
        <ul className={s.list}>
          {d.left.map((x) => (
            <li key={x.what} className={s.listRow}>
              <span className={s.listMain}>{x.what}</span>
              <span className={cx(s.listMeta, s.num)}>by {x.by}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── guest list ──────────────────────────────────────────────────── */

function StackBar({ yes, no, waiting, invited, thick }: { yes: number; no: number; waiting: number; invited: number; thick?: boolean }) {
  const pct = (n: number) => `${(n / invited) * 100}%`;
  return (
    <div
      className={cx(s.stack, thick && s.stackThick)}
      role="img"
      aria-label={`${yes} said yes, ${no} said no, ${waiting} have not replied, of ${invited} invited`}
    >
      <span className={s.segYes} style={{ left: 0, width: pct(yes) }} />
      <span className={s.segNo} style={{ left: pct(yes), width: pct(no) }} />
      <span className={s.segWait} style={{ left: pct(yes + no), width: pct(waiting) }} />
    </div>
  );
}

function GuestsBody(props: Props) {
  const { w, size, showProject, api } = props;
  const base = GUESTS[w.project];
  const fresh = w.project === "mf" && api.flag("reply-mf");
  const g = base && fresh
    ? { ...base, yes: base.yes + 1, waiting: base.waiting - 1, waitingNames: base.waitingNames.filter((x) => !x.name.startsWith("Aunt Bernie")) }
    : base;
  if (!g) {
    const copied = api.flag(`rsvp-${w.wid}`);
    return (
      <Early
        {...props}
        text="No replies yet. Share the RSVP link."
        action={
          <button
            type="button"
            className={s.pill}
            onClick={() => {
              api.setFlag(`rsvp-${w.wid}`);
              api.notify("RSVP link copied. Replies will land on this widget.");
            }}
          >
            {copied ? <CheckIcon size={12} /> : <LinkIcon />}
            {copied ? "Link copied" : "Copy RSVP link"}
          </button>
        }
      />
    );
  }
  const chased = api.flag(`chase-${w.project}`);
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {g.yes} <span className={s.bigUnit}>yes</span>
          </Big>
          <StackBar {...g} />
          <Sub className={cx(s.num, fresh && s.freshText)}>{fresh ? "Aunt Bernie said yes, just now" : `${g.waiting} still to reply`}</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={cx(s.body, size === "l" && s.bodyTall)}>
      <Head
        w={w}
        showProject={showProject}
        right={
          fresh ? (
            <span className={s.freshChip}>
              <span className={s.freshDot} aria-hidden /> Aunt Bernie said yes
            </span>
          ) : (
            <span className={cx(s.headNote, s.num)}>{g.invited} invited</span>
          )
        }
      />
      <div className={size === "l" ? s.guestTop : s.stackEnd}>
        <div className={s.legend}>
          <span className={s.legendItem}>
            <span className={cx(s.sw, s.swYes)} aria-hidden />
            <span className={cx(s.legendNum, s.num)}>{g.yes}</span> yes
          </span>
          <span className={s.legendItem}>
            <span className={cx(s.sw, s.swNo)} aria-hidden />
            <span className={cx(s.legendNum, s.num)}>{g.no}</span> no
          </span>
          <span className={s.legendItem}>
            <span className={cx(s.sw, s.swWait)} aria-hidden />
            <span className={cx(s.legendNum, s.num)}>{g.waiting}</span> waiting
          </span>
        </div>
        <StackBar {...g} thick={size === "l"} />
      </div>
      {size === "l" && (
        <>
          <div className={s.waitHead}>Still waiting to hear from</div>
          <ul className={s.list}>
            {g.waitingNames.slice(0, 4).map((x, i) => (
              <li key={x.name} className={cx(s.listRow, i === 3 && s.roomy)}>
                <span className={s.listMain}>{x.name}</span>
                <span className={s.listMeta}>{x.party}</span>
              </li>
            ))}
          </ul>
          <div className={s.actions}>
            <button
              type="button"
              className={cx(s.pill, s.pillStrong)}
              disabled={chased}
              onClick={() => {
                api.setFlag(`chase-${w.project}`);
                api.notify(`Reminder sent to ${g.waiting} guests by email and WhatsApp.`);
              }}
            >
              {chased ? <CheckIcon size={12} /> : <SendIcon />}
              {chased ? `Chased ${g.waiting} today` : `Chase ${g.waiting} replies`}
            </button>
            <span className={cx(s.micro, s.num, s.tightOnly)}>and {g.waiting - 3} more</span>
            <span className={cx(s.micro, s.num, s.roomyOnly)}>and {g.waiting - 4} more</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── budget ──────────────────────────────────────────────────────── */

function BudgetBody({ w, size, showProject }: Props) {
  const b = BUDGET;
  const pct = (b.committed / b.total) * 100;
  const bar = (
    <div className={s.track} role="img" aria-label={`${eur(b.committed)} of ${eur(b.total)} committed`}>
      <span className={s.trackFill} style={{ width: `${pct}%` }} />
    </div>
  );
  const over = (
    <span className={s.warnChip}>
      {b.over.what} are {eur(b.over.by)} over
    </span>
  );
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>{eur(b.total - b.committed)}</Big>
          <Sub>left to spend</Sub>
          {bar}
        </div>
      </div>
    );
  }
  return (
    <div className={cx(s.body, size === "l" && s.bodyTall)}>
      <Head w={w} showProject={showProject} right={over} />
      <div className={size === "l" ? s.guestTop : s.stackEnd}>
        <div className={s.money}>
          <Big className={s.num}>{eur(b.committed)}</Big>
          <span className={cx(s.sub, s.num)}>of {eur(b.total)} committed</span>
        </div>
        {bar}
        {size === "m" && <span className={cx(s.micro, s.num)}>{eur(b.total - b.committed)} left, 4 payments still to make</span>}
      </div>
      {size === "l" && (
        <ul className={s.list}>
          {b.lines.map((l) => {
            return (
              <li key={l.what} className={s.budgetRow}>
                <span className={s.listMain}>{l.what}</span>
                <span className={s.miniTrack} aria-hidden>
                  <span className={l.spent > l.plan ? s.miniOver : s.miniFill} style={{ width: `${(l.spent / 9800) * 100}%` }} />
                  <span className={s.miniPlan} style={{ left: `${(l.plan / 9800) * 100}%` }} />
                </span>
                <span className={cx(s.listMeta, s.num, l.spent > l.plan && s.overText)}>
                  {eur(l.spent)}
                  <span className={s.srOnly}> of {eur(l.plan)} planned</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── day plan ────────────────────────────────────────────────────── */

function DayStrip() {
  const span = 16 * 60;
  return (
    <div className={s.dayStrip} role="img" aria-label="31 steps between 9am and 1am">
      {DAYPLAN.marks.map((m, i) => (
        <span key={i} className={s.dayTick} style={{ left: `${(m / span) * 100}%` }} />
      ))}
    </div>
  );
}

function DayPlanBody({ w, size, showProject }: Props) {
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {DAYPLAN.steps} <span className={s.bigUnit}>steps</span>
          </Big>
          <Sub>First at {DAYPLAN.first}</Sub>
          <DayStrip />
        </div>
      </div>
    );
  }
  const rows = size === "l" ? DAYPLAN.next : DAYPLAN.next.slice(0, 3);
  return (
    <div className={cx(s.body, size === "l" && s.bodyTall)}>
      <Head w={w} showProject={showProject} right={<span className={cx(s.headNote, s.num)}>{DAYPLAN.steps} steps</span>} />
      <ul className={s.times}>
        {rows.map((r) => (
          <li key={r.time} className={s.timeRow}>
            <span className={cx(s.time, s.num)}>{r.time}</span>
            <span className={s.listMain}>{r.what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── seating ─────────────────────────────────────────────────────── */

function SeatingBody({ w, size, showProject }: Props) {
  const t = SEATING;
  const grid = (
    <div className={s.tables} role="img" aria-label={`${t.set} of ${t.tables} tables set`}>
      {Array.from({ length: t.tables }, (_, i) => (
        <span key={i} className={t.open.includes(i + 1) ? s.tableOpen : s.tableSet} />
      ))}
    </div>
  );
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.seatWide}>
        <div>
          <Big className={s.num}>
            {t.set} <span className={s.bigUnit}>of {t.tables}</span>
          </Big>
          <Sub>tables set</Sub>
        </div>
        {grid}
        {size === "s" && <Sub className={cx(s.num, s.seatNarrow)}>{t.tables - t.set} tables still open</Sub>}
        {size === "m" && (
          <Sub className={cx(s.num, s.seatNote)}>
            Tables {t.open.join(", ")} still open. {t.unseated} guests need a seat.
          </Sub>
        )}
      </div>
    </div>
  );
}

/* ── notes ───────────────────────────────────────────────────────── */

function NotesBody(props: Props) {
  const { w, size, showProject } = props;
  const list = NOTES[w.project] ?? [];
  if (list.length === 0) return <Early {...props} text="No notes in this Project yet. The next one you write will show here." />;
  const n = size === "l" ? 4 : size === "m" ? 2 : 1;
  return (
    <div className={cx(s.body, size === "l" && s.bodyTall)}>
      <Head w={w} showProject={showProject} right={<span className={s.headNote}>{list[0].when}</span>} />
      <div className={size === "s" ? s.noteOne : s.noteList}>
        {list.slice(0, n).map((x, i) => (
          <figure key={i} className={s.note}>
            <blockquote className={size === "s" ? s.noteTextClamp : s.noteText}>{x.text}</blockquote>
            {size !== "s" && (
              <figcaption className={s.micro}>
                {x.who}, {x.when.toLowerCase() === "2h ago" ? "2 hours ago" : x.when}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

/* ── whatsapp group ──────────────────────────────────────────────── */

function WhatsAppBody(props: Props) {
  const { w, size, showProject } = props;
  const d = WHATSAPP[w.project];
  if (!d) return <Early {...props} text="Pick a group to bring in. Only you choose which one." />;
  const badge = d.unread > 0 && <span className={cx(s.badge, s.num)}>{d.unread} new</span>;
  const msgs = size === "m" ? d.msgs : d.msgs.slice(0, 1);
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={badge} />
      <div className={s.stackEnd}>
        <div className={s.chatGroup}>{d.group}</div>
        {msgs.map((m) => (
          <p key={m.who} className={size === "s" ? s.chatClamp : s.chatLine}>
            <span className={s.chatWho}>{m.who}</span> {m.text}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── email, calendar, drive, forms, gifts, photos, weather, checklist ─ */

function EmailBody({ w, size, showProject }: Props) {
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={cx(s.badge, s.num)}>{EMAIL.unread} new</span>} />
      <div className={s.stackEnd}>
        <div className={s.chatGroup}>bookings@theorchard.ie</div>
        <p className={size === "s" ? s.chatClamp : s.chatLine}>
          <span className={s.chatWho}>{EMAIL.latest.who}</span> {EMAIL.latest.text}
        </p>
      </div>
    </div>
  );
}

function WeatherBody(props: Props) {
  const d = WEATHER[props.w.project] ?? { ready: false, line: "Add a date and a place, and the forecast appears ten days out." };
  if (!d.ready) return <Early {...props} text={d.line} />;
  return (
    <div className={s.body}>
      <Head w={props.w} showProject={props.showProject} />
      <div className={s.stackEnd}>
        <Big className={s.num}>{d.temp}</Big>
        <Sub>{d.line}</Sub>
      </div>
    </div>
  );
}

function ChecklistBody(props: Props) {
  const { w, api } = props;
  const items =
    w.project === "night"
      ? []
      : [
          { t: "Float in the till", done: true },
          { t: "Candles lit by 6:45", done: false },
          { t: "Coats rail by the door", done: false },
        ];
  if (items.length === 0) {
    const added = api.flag(`check-${w.wid}`);
    return (
      <Early
        {...props}
        text={added ? "One thing on the list: Float in the till." : "Nothing on the list yet. Add the first thing."}
        action={
          !added && (
            <button type="button" className={s.pill} onClick={() => api.setFlag(`check-${w.wid}`)}>
              Add “Float in the till”
            </button>
          )
        }
      />
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={props.showProject} right={<span className={cx(s.headNote, s.num)}>1 of 3</span>} />
      <ul className={s.times}>
        {items.map((i) => (
          <li key={i.t} className={s.checkRow}>
            <span className={i.done ? s.checkDone : s.checkBox} aria-hidden>
              {i.done && <CheckIcon size={10} />}
            </span>
            <span className={cx(s.listMain, i.done && s.struck)}>{i.t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GenericEarly(props: Props) {
  const lines: Partial<Record<Widget["tool"], string>> = {
    calendar: "Connect Google or Apple Calendar to see today here.",
    drive: "Pick one Drive folder. Its newest files show here.",
    forms: "No forms yet. Make one and answers arrive as tasks.",
    gifts: "No gifts logged yet. The first one will show here.",
    photos: "The photo link opens to guests after the day.",
  };
  return <Early {...props} text={lines[props.w.tool] ?? "Nothing here yet."} />;
}

/* ── venue ───────────────────────────────────────────────────────── */

function BookingsBody({ w, size, showProject }: Props) {
  const b = BOOKINGS;
  const byDay = new Map(b.events.map((e) => [e.day, e]));
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {b.events.length} <span className={s.bigUnit}>events</span>
          </Big>
          <Sub>in {b.month}</Sub>
        </div>
      </div>
    );
  }
  if (size === "m") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} right={<span className={cx(s.headNote, s.num)}>{b.events.length} in {b.month}</span>} />
        <div className={s.stackEnd}>
          <div className={s.heatRow} role="img" aria-label={`${b.events.length} events in ${b.month}`}>
            {Array.from({ length: b.days }, (_, i) => {
              const e = byDay.get(i + 1);
              return <span key={i} className={cx(s.heatCell, e && (e.guests >= 100 ? s.heatBig : s.heatSmall))} />;
            })}
          </div>
          <Sub>Next: Saturday 3 October, Doyle 60th</Sub>
        </div>
      </div>
    );
  }
  const cells: (number | null)[] = [...Array(b.firstWeekday).fill(null), ...Array.from({ length: b.days }, (_, i) => i + 1)];
  return (
    <div className={cx(s.body, s.bodyTall)}>
      <Head w={w} showProject={showProject} right={<span className={cx(s.headNote, s.num)}>{b.events.length} events</span>} />
      <div className={s.calTitle}>{b.month}</div>
      <div className={s.cal} role="grid" aria-label={`${b.month} bookings`}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className={s.calDow} aria-hidden>
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          const e = d ? byDay.get(d) : undefined;
          return (
            <span
              key={i}
              className={cx(s.calDay, s.num, e && (e.guests >= 100 ? s.calBig : s.calSmall), !d && s.calBlank)}
              title={e ? `${e.what}, ${e.guests} guests` : undefined}
              aria-label={e ? `${d} October: ${e.what}, ${e.guests} guests` : undefined}
            >
              {d ?? ""}
            </span>
          );
        })}
      </div>
      <div className={s.calKey}>
        <span className={s.legendItem}>
          <span className={cx(s.sw, s.calBig)} aria-hidden /> 100 or more guests
        </span>
        <span className={s.legendItem}>
          <span className={cx(s.sw, s.calSmall)} aria-hidden /> Smaller events
        </span>
      </div>
    </div>
  );
}

function RunsheetBody({ w, size, showProject }: Props) {
  const r = RUNSHEET;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <div className={s.strongLine}>{r.event}</div>
          <Sub>Sat 17 Oct, load-in 8am</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={s.headNote}>{r.date}</span>} />
      <div className={s.stackEnd}>
        <div className={s.strongLine}>
          {r.event} <span className={s.sub}>· {r.line}</span>
        </div>
        <ol className={s.steps}>
          {r.steps.map((x) => (
            <li key={x.time} className={s.step}>
              <span className={cx(s.stepTime, s.num)}>{x.time}</span> <span className={s.stepWhat}>{x.what}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Faces({ list, dashed }: { list: string[]; dashed?: boolean[] }) {
  return (
    <span className={s.faces}>
      {list.map((i, k) => (
        <span key={k} className={cx(s.face, dashed?.[k] && s.faceWait)}>
          {i}
        </span>
      ))}
    </span>
  );
}

function SuppliersBody({ w, showProject }: Props) {
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <Big className={s.num}>
          {SUPPLIERS.count} <span className={s.bigUnit}>contacts</span>
        </Big>
        <Faces list={SUPPLIERS.people} />
      </div>
    </div>
  );
}

function DepositsBody({ w, size, showProject }: Props) {
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <Big className={s.num}>{eur(DEPOSITS.total)}</Big>
        <Sub className={s.num}>{DEPOSITS.count} due this week</Sub>
        {size === "m" && <Sub>{DEPOSITS.next}</Sub>}
      </div>
    </div>
  );
}

function RotaBody({ w, size, showProject }: Props) {
  const r = ROTA;
  const waiting = r.staff.filter((x) => !x.ok).length;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {r.staff.length} <span className={s.bigUnit}>on</span>
          </Big>
          <Sub className={s.num}>{waiting} still to confirm</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={s.headNote}>{r.line}</span>} />
      <div className={s.stackEnd}>
        <div className={s.money}>
          <Big className={s.num}>
            {r.staff.length} <span className={s.bigUnit}>on shift</span>
          </Big>
          <span className={cx(s.warnText, s.num)}>{waiting} still to confirm</span>
        </div>
        <Faces list={r.staff.map((x) => x.i)} dashed={r.staff.map((x) => !x.ok)} />
      </div>
    </div>
  );
}

/* ── study ───────────────────────────────────────────────────────── */

function DeadlinesBody({ w, size, showProject }: Props) {
  const d = DEADLINES;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            9 <span className={s.bigUnit}>days</span>
          </Big>
          <Sub>to the draft, 4 Oct</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <div className={s.strongLine}>{d.headline}</div>
        <div className={s.rail} role="img" aria-label="Survey closes 2 October, draft 4 October, presentation 22 October">
          <span className={s.railLine} />
          <span className={s.railNow} style={{ left: 0 }} />
          {d.steps.map((x) => (
            <span key={x.what} className={s.railStop} style={{ left: `${(x.day / d.span) * 100}%` }}>
              <span className={x.what === "Draft" ? s.railDotKey : s.railDot} />
            </span>
          ))}
        </div>
        <div className={s.railLabels}>
          <span className={s.micro}>Today</span>
          {d.steps
            .filter((x) => x.what !== "Survey closes")
            .map((x) => (
              <span key={x.what} className={cx(s.micro, s.num)} style={{ left: `${(x.day / d.span) * 100}%` }}>
                {x.what} {x.date}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function TimerBody({ w, size, showProject, api }: Props) {
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const notified = useRef(false);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          setRunning(false);
          if (!notified.current) {
            notified.current = true;
            api.notify("Time for a five-minute break.");
          }
          return 25 * 60;
        }
        return l - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, api]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const frac = 1 - left / (25 * 60);
  return (
    <div className={s.body}>
      <Head
        w={w}
        showProject={showProject}
        right={
          <button
            type="button"
            className={cx(s.round, running && s.roundOn)}
            aria-label={running ? "Pause the timer" : "Start the timer"}
            onClick={() => {
              notified.current = false;
              setRunning((r) => !r);
            }}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        }
      />
      <div className={s.stackEnd}>
        <DotNumber value={`${mm}:${ss}`} pitch={5} label={`${mm} minutes ${ss} seconds left`} />
        <div className={s.track} aria-hidden>
          <span className={s.trackFill} style={{ width: `${frac * 100}%` }} />
        </div>
        {size === "m" && <Sub>Third session today, 50 minutes so far</Sub>}
      </div>
    </div>
  );
}

function GroupBody({ w, size, showProject }: Props) {
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            4 <span className={s.bigUnit}>people</span>
          </Big>
          <Faces list={GROUP.map((g) => g.i)} />
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={s.headNote}>4 people</span>} />
      <ul className={size === "l" ? s.groupListTall : s.groupList}>
        {GROUP.map((g) => (
          <li key={g.name} className={s.groupRow}>
            <span className={s.groupLine}>
              <span className={s.groupName}>{g.name}</span> <span className={s.groupPart}>{g.part}</span>
            </span>
            <span className={s.miniTrack} role="img" aria-label={`${g.name}: ${Math.round(g.done * 100)}% done`}>
              <span className={s.miniFill} style={{ width: `${g.done * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourcesBody({ w, showProject }: Props) {
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <Big className={s.num}>{SOURCES.count}</Big>
        <Sub className={s.num}>references, {SOURCES.unread} nobody has read</Sub>
      </div>
    </div>
  );
}

function SurveyBody({ w, size, showProject }: Props) {
  const v = SURVEY;
  const max = 10;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {v.got} <span className={s.bigUnit}>of {v.need}</span>
          </Big>
          <Sub>replies so far</Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <div className={s.split}>
        <div className={s.splitMain}>
          <Head w={w} showProject={showProject} />
          <div className={s.stackEnd}>
            <Big className={s.num}>
              {v.got} <span className={s.bigUnit}>of {v.need}</span>
            </Big>
            <Sub>replies. 36 more by 2 October.</Sub>
          </div>
        </div>
        <div className={s.bars} role="img" aria-label="Replies per day over the last 14 days, between 0 and 9">
          {v.perDay.map((n, i) => (
            <span key={i} className={s.barCol}>
              <span className={s.bar} style={{ height: `${(n / max) * 100}%` }} />
            </span>
          ))}
          <span className={s.barsLabel}>Last 14 days</span>
        </div>
      </div>
    </div>
  );
}

/* ── launch ──────────────────────────────────────────────────────── */

function PressBody({ w, size, showProject }: Props) {
  const p = PRESS;
  if (size === "s") {
    return (
      <div className={s.body}>
        <Head w={w} showProject={showProject} />
        <div className={s.stackEnd}>
          <Big className={s.num}>
            {p.booked} <span className={s.bigUnit}>booked</span>
          </Big>
          <Sub className={s.num}>
            {p.replied} replies from {p.total} pitched
          </Sub>
        </div>
      </div>
    );
  }
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={cx(s.headNote, s.num)}>{p.replied} of {p.total} replied</span>} />
      <ul className={s.list}>
        {p.rows.slice(0, size === "l" ? 3 : 2).map((r) => (
          <li key={r.who} className={s.listRow}>
            <span className={s.listMain}>
              {r.who} <span className={s.listMeta}>· {r.where}</span>
            </span>
            <span className={r.state === "Feature booked" ? s.okChip : s.neutralChip}>{r.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialBody({ w, showProject }: Props) {
  const v = SOCIAL;
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} right={<span className={cx(s.headNote, s.num)}>{v.planned} planned</span>} />
      <div className={s.stackEnd}>
        <div className={s.fortnight} role="img" aria-label={`${v.planned} posts planned over the next 14 days`}>
          {v.days.map((n, i) => (
            <span key={i} className={s.fnDay}>
              <span className={s.fnDots}>
                {Array.from({ length: n }, (_, k) => (
                  <span key={k} className={s.fnDot} />
                ))}
              </span>
              <span className={s.fnLetter}>{v.letters[i]}</span>
            </span>
          ))}
        </div>
        <Sub>Next: {v.next}</Sub>
      </div>
    </div>
  );
}

function ProofsBody(props: Props) {
  const { w, showProject } = props;
  const p = PROOFS[w.project];
  if (!p) return <Early {...props} text="Nothing waiting for you. New designs from Files show here." />;
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <Big className={s.num}>
          {p.count} <span className={s.bigUnit}>to check</span>
        </Big>
        <Sub>
          {p.first}, {p.wait}
        </Sub>
      </div>
    </div>
  );
}

/* ── states ──────────────────────────────────────────────────────── */

export function LockedBody({ w, showProject }: Props) {
  return (
    <div className={cx(s.body, s.bodyLocked)}>
      <Head w={w} showProject={showProject} />
      <p className={s.early}>Turned off by {w.lockedBy} for this Project</p>
    </div>
  );
}

export function ErrorBody({ w, showProject, api }: Props) {
  const tool = toolById(w.tool);
  return (
    <div className={s.body}>
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <p className={s.early}>Could not load the {tool.name.toLowerCase()}.</p>
        <button type="button" className={s.pill} onClick={() => api.retry(w.wid)}>
          <RetryIcon />
          Try again
        </button>
      </div>
    </div>
  );
}

export function LoadingBody({ w, showProject }: Props) {
  return (
    <div className={s.body} aria-busy="true">
      <Head w={w} showProject={showProject} />
      <div className={s.stackEnd}>
        <span className={s.skel} style={{ width: "40%", height: 22 }} />
        <span className={s.skel} style={{ width: "86%" }} />
        <span className={s.srOnly}>Loading</span>
      </div>
    </div>
  );
}

/* ── registry ────────────────────────────────────────────────────── */

const BODIES: Partial<Record<Widget["tool"], (p: Props) => ReactNode>> = {
  countdown: CountdownBody,
  guests: GuestsBody,
  budget: BudgetBody,
  dayplan: DayPlanBody,
  seating: SeatingBody,
  notes: NotesBody,
  whatsapp: WhatsAppBody,
  email: EmailBody,
  weather: WeatherBody,
  checklist: ChecklistBody,
  bookings: BookingsBody,
  runsheet: RunsheetBody,
  suppliers: SuppliersBody,
  deposits: DepositsBody,
  rota: RotaBody,
  deadlines: DeadlinesBody,
  timer: TimerBody,
  groupsplit: GroupBody,
  sources: SourcesBody,
  survey: SurveyBody,
  press: PressBody,
  social: SocialBody,
  proofs: ProofsBody,
};

export function WidgetBody(props: Props) {
  if (props.w.state === "locked") return <LockedBody {...props} />;
  if (props.w.state === "error") return <ErrorBody {...props} />;
  if (props.w.state === "loading") return <LoadingBody {...props} />;
  const B = BODIES[props.w.tool] ?? GenericEarly;
  return <B {...props} />;
}
