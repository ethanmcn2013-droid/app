"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import s from "./ledger.module.css";
import {
  PEOPLE,
  TODAY,
  addDays,
  daysFromToday,
  elapsedShare,
  fmtDate,
  fmtMilestone,
  fmtWeekday,
  isPastDue,
  netOpen,
  nextMilestone,
  openByPerson,
  statusLooksStale,
  sum,
  toTime,
  vsPlan,
  type Project,
} from "./data";
import { Avatar, Icon, Kbd, MilestoneWhen, OpenLine, StatusPill, Swatch, openSeries, trend } from "./parts";
import { FLY } from "./table";

/* ── Rows ───────────────────────────────────────────────────────────────
 * Facts are shown, never scored: a nearer date is not a weakness.
 * Measures are scored: each one has a clear "worse" direction that holds
 * across projects at different stages.
 */

type Row = {
  label: string;
  help?: string;
  /** Scored rows only. Lower is worse unless `higherIsWorse`. `undefined` sits the row out for that project. */
  score?: (p: Project) => number | undefined;
  higherIsWorse?: boolean;
  render: (p: Project, weaker: boolean) => ReactNode;
};

function pace(p: Project): number | undefined {
  const d = daysFromToday(p.date);
  if (d <= 0) return undefined;
  return (p.total - p.done) / d;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const FACTS: Row[] = [
  {
    label: "Date",
    render: (p) => (
      <span className={s.cmpValue}>
        {fmtWeekday(p.date)} {fmtDate(p.date, true)}
      </span>
    ),
  },
  {
    label: "Days left",
    render: (p) => {
      const d = daysFromToday(p.date);
      if (p.status === "wrapped") return <span className={s.cmpValue}>Wrapped</span>;
      if (d < 0) return <span className={s.cmpValue}>Date passed {plural(-d, "day")} ago</span>;
      if (d === 0) return <span className={s.cmpValue}>Today</span>;
      return <span className={s.cmpValue}>{plural(d, "day")}</span>;
    },
  },
  {
    label: "Next milestone",
    render: (p) => {
      const m = nextMilestone(p);
      return m ? (
        <span className={s.cmpValue}>
          {m.name}, <MilestoneWhen m={m} className={s.cmpSubInline} />
        </span>
      ) : (
        <span className={s.muted}>None left</span>
      );
    },
  },
];

const MEASURES: Row[] = [
  {
    label: "Ahead or behind plan",
    help: "Tasks done against a steady pace from start to date",
    score: (p) => vsPlan(p),
    render: (p, weaker) => {
      const v = vsPlan(p);
      const share = Math.round(elapsedShare(p) * 100);
      return (
        <span className={s.cmpStack}>
          <span className={s.cmpValue}>
            <span className={s.cmpBig} data-weaker={weaker || undefined}>
              {v === 0 ? "On plan" : `${plural(Math.abs(v), "task")} ${v < 0 ? "behind" : "ahead"}`}
            </span>
            {weaker && <WeakerTag />}
          </span>
          <span className={s.cmpPlan} aria-hidden="true">
            <span className={s.cmpPlanDone} style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
            <span className={s.cmpPlanMark} style={{ left: `${share}%` }} />
          </span>
          <span className={s.cmpSub}>
            {p.done} of {p.total} done, {share}% of the time gone
          </span>
        </span>
      );
    },
  },
  {
    label: "Tasks a day to finish",
    help: "Open tasks divided by days left",
    score: (p) => {
      const v = pace(p);
      return v === undefined ? undefined : Math.round(v * 10) / 10;
    },
    higherIsWorse: true,
    render: (p, weaker) => {
      const v = pace(p);
      if (v === undefined) {
        const open = p.total - p.done;
        return (
          <span className={s.cmpStack}>
            <span className={s.cmpValue}>Date passed{open > 0 ? `, ${open} open` : ""}</span>
            <span className={s.cmpSub}>Not scored</span>
          </span>
        );
      }
      return (
        <span className={s.cmpValue}>
          <span className={s.cmpBig} data-weaker={weaker || undefined}>
            {v.toFixed(1)}
          </span>{" "}
          a day
          {weaker && <WeakerTag />}
        </span>
      );
    },
  },
  {
    label: "Overdue",
    score: (p) => p.overdue,
    higherIsWorse: true,
    render: (p, weaker) => (
      <span className={s.cmpValue}>
        <span className={s.cmpBig} data-weaker={weaker || undefined}>
          {p.overdue}
        </span>{" "}
        {p.overdue === 1 ? "task" : "tasks"}
        {weaker && <WeakerTag />}
      </span>
    ),
  },
  {
    label: "Open tasks",
    help: "Change over the last 14 days",
    score: (p) => netOpen(p),
    higherIsWorse: true,
    render: (p, weaker) => {
      const d = sum(p.sparkDone);
      const a = sum(p.sparkAdded);
      const t = trend(a - d, a + d === 0);
      const series = openSeries(p.total, p.done, p.sparkDone, p.sparkAdded);
      return (
        <span className={s.cmpStack}>
          <span className={s.cmpValue}>
            <span className={s.cmpBig} data-weaker={weaker || undefined}>
              {t.dir === "down" ? "↓ " : t.dir === "up" ? "↑ " : ""}
              {t.words}
            </span>
            {weaker && <WeakerTag />}
          </span>
          <span className={s.cmpFlowLine}>
            <OpenLine series={series} width={96} height={24} />
            <span className={s.cmpSub}>
              {series[0]} open two weeks ago, {series[series.length - 1]} now. {d} done, {a} added.
            </span>
          </span>
        </span>
      );
    },
  },
  {
    label: "Busiest person",
    help: "Scored on whoever holds the most open tasks",
    score: (p) => Math.max(0, ...openByPerson(p).map((r) => r.open)),
    higherIsWorse: true,
    render: (p, weaker) => {
      const rows = openByPerson(p);
      const max = Math.max(1, ...rows.map((r) => r.open));
      const top = rows.reduce((a, b) => (b.open > a.open ? b : a), rows[0]);
      return (
        <span className={s.cmpStack}>
          <span className={s.cmpValue}>
            <span className={s.cmpBig} data-weaker={weaker || undefined}>
              {PEOPLE[top.who].short}, {top.open} open
            </span>
            {weaker && <WeakerTag />}
          </span>
          <ul className={s.cmpPeople}>
            {rows.map((r) => (
              <li key={r.who} className={s.cmpPerson} data-top={r.who === top.who || undefined}>
                <Avatar who={r.who} size={18} />
                <span className={s.cmpPersonName}>{PEOPLE[r.who].short}</span>
                <span className={s.cmpPersonBar}>
                  <span style={{ width: `${(r.open / max) * 100}%` }} />
                  <span className={s.cmpPersonBarLate} style={{ width: `${(r.overdue / max) * 100}%` }} />
                </span>
                <span className={s.cmpPersonN}>
                  {r.open} open
                  {r.overdue > 0 && <span className={s.cmpPersonLate}>, {r.overdue} late</span>}
                </span>
              </li>
            ))}
          </ul>
        </span>
      );
    },
  },
];

function WeakerTag() {
  return <span className={s.cmpWeaker}>weaker</span>;
}

/** Index of the single weakest project on a row, "even" when the values tie, or null when it can't be scored. */
function judge(ps: Project[], r: Row): { weaker: number } | "even" | null {
  if (!r.score) return null;
  const vals = ps.map((p) => r.score!(p));
  const scored = vals.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== undefined);
  if (scored.length < 2) return null;
  const target = r.higherIsWorse ? Math.max(...scored.map((x) => x.v)) : Math.min(...scored.map((x) => x.v));
  const hits = scored.filter((x) => x.v === target);
  if (hits.length === scored.length) return "even";
  if (hits.length !== 1) return null;
  return { weaker: hits[0].i };
}

export function CompareView({
  projects,
  pool,
  onChange,
  onClose,
  onOpen,
  closing,
}: {
  /** Compare is handing its glyphs and names back to the ledger rows. */
  closing?: boolean;
  projects: Project[];
  /** The ledger's current order, used by the switcher and by [ and ]. */
  pool: Project[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [picker, setPicker] = useState<number | null>(null);
  const cols = `188px repeat(${projects.length}, minmax(0, 1fr))`;
  const verdicts = MEASURES.map((m) => judge(projects, m));
  const counted = verdicts.filter((v) => v !== null).length;
  const trails = projects.map((_, i) => verdicts.filter((v) => v && v !== "even" && v.weaker === i).length);
  const most = Math.max(...trails);
  const weakest = most > 0 && trails.filter((n) => n === most).length === 1 ? projects[trails.indexOf(most)] : null;
  const ids = projects.map((p) => p.id);
  const advice = weakest ? adviceFor(weakest) : null;

  const step = (dir: 1 | -1) => {
    // Step the last column through the ledger, skipping projects already on screen.
    const col = projects.length - 1;
    const others = new Set(ids.filter((_, i) => i !== col));
    const list = pool.filter((p) => !others.has(p.id));
    if (list.length < 2) return;
    const at = list.findIndex((p) => p.id === ids[col]);
    const next = list[(at + dir + list.length) % list.length];
    onChange(ids.map((id, i) => (i === col ? next.id : id)));
  };

  const swap = (col: number, id: string) => {
    onChange(ids.map((x, i) => (i === col ? id : x)));
    setPicker(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t?.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox";
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        step(e.key === "]" ? 1 : -1);
      } else if (/^[1-3]$/.test(e.key) && Number(e.key) <= projects.length) {
        e.preventDefault();
        setPicker(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
    <motion.div
      className={s.cmpBackdrop}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: closing ? 0.12 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
    />
    <motion.section
      className={s.compare}
      aria-label="Compare projects"
      initial={{ opacity: 1 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.12 }}
      exit={{ opacity: 0, transition: { duration: 0.01 } }}
      data-closing={closing || undefined}
    >
      <div className={s.cmpTop}>
        <div className={s.cmpTitleWrap}>
          <h2 className={s.cmpTitle}>Side by side</h2>
          <p className={s.cmpLede} aria-live="polite">
            {weakest && advice ? (
              <>
                <span className={s.cmpVerdict}>{advice.lead}</span> {advice.next}
              </>
            ) : weakest ? (
              <span className={s.cmpVerdict}>
                {weakest.name} is weaker on {most} of {counted} measures.
              </span>
            ) : counted > 0 && verdicts.every((v) => v === "even" || v === null) ? (
              <span className={s.cmpVerdict}>Level on every measure.</span>
            ) : (
              <span className={s.cmpVerdict}>Neither one is clearly behind.</span>
            )}
          </p>
        </div>
        <div className={s.cmpTools}>
          <span className={s.cmpKeys}>
            <Kbd>[</Kbd>
            <Kbd>]</Kbd> step through projects
            <span className={s.cmpKeysSep} />
            <Kbd>1</Kbd>
            <Kbd>2</Kbd> swap
          </span>
          <button type="button" className={s.btnGhostSm} onClick={onClose}>
            Back to projects <Kbd>esc</Kbd>
          </button>
        </div>
      </div>

      <div className={s.cmpGrid} style={{ "--cmp-cols": cols } as CSSProperties} role="table" aria-label="Project comparison">
        <div className={s.cmpRow} data-head role="row">
          <span role="columnheader" className={s.cmpLabel} />
          {projects.map((p, i) => (
            <div key={`${i}-${p.id}`} role="columnheader" className={s.cmpHead}>
              <div key={p.id} className={s.cmpHeadInner}>
                <div className={s.cmpHeadTop}>
                  <motion.span layoutId={`c2-glyph-${p.id}`} className={s.flyGlyph} transition={FLY}>
                    <Swatch tone={p.tone} name={p.name} size={24} />
                  </motion.span>
                  <button
                    type="button"
                    className={s.cmpName}
                    aria-haspopup="listbox"
                    aria-expanded={picker === i}
                    aria-label={`${p.name}. Swap for another project (${i + 1})`}
                    onClick={() => setPicker(picker === i ? null : i)}
                  >
                    <motion.span layoutId={`c2-name-${p.id}`} className={s.cmpNameText} transition={FLY}>
                      {p.name}
                    </motion.span>
                    <Icon.chevronDown size={14} className={s.cmpNameChevron} />
                  </button>
                  <button type="button" className={s.iconBtn} aria-label={`Open ${p.name}`} title="Open project" onClick={() => onOpen(p.id)}>
                    <Icon.open size={14} />
                  </button>
                </div>
                <div className={s.cmpHeadMeta}>
                  <StatusPill status={p.status} past={isPastDue(p)} stale={!isPastDue(p) && statusLooksStale(p)} />
                  <span className={s.cmpOwner}>
                    <Avatar who={p.owner} size={18} /> {PEOPLE[p.owner].short}
                  </span>
                </div>
              </div>
              <AnimatePresence>
                {picker === i && (
                  <Picker
                    key="picker"
                    pool={pool.filter((x) => x.id === p.id || !ids.includes(x.id))}
                    current={p.id}
                    onPick={(id) => swap(i, id)}
                    onClose={() => setPicker(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className={s.cmpAxisRow} role="row">
          <div role="cell" className={s.cmpAxisCell}>
            <DayAxis projects={projects} />
          </div>
        </div>

        <div className={s.cmpSection} role="row">
          <span role="rowheader">Facts</span>
        </div>
        {FACTS.map((r) => (
          <CompareRow key={r.label} row={r} projects={projects} verdict={null} />
        ))}
        <div className={s.cmpSection} role="row">
          <span role="rowheader">Measures</span>
          <span className={s.cmpSectionNote}>The weaker value in each row is marked</span>
        </div>
        {MEASURES.map((r, k) => (
          <CompareRow key={r.label} row={r} projects={projects} verdict={verdicts[k]} />
        ))}
      </div>
    </motion.section>
    </>
  );
}

/** The one-line read of a comparison: what is behind, and where to start. */
function adviceFor(p: Project): { lead: string; next: string } | null {
  const v = vsPlan(p);
  const d = daysFromToday(p.date);
  const m = nextMilestone(p);
  const when = d < 0 ? "with its date passed" : d === 0 ? "with the date today" : `with ${plural(d, "day")} left`;
  const lead = v < 0 ? `${p.name} is ${plural(-v, "task")} behind ${when}.` : p.overdue > 0 ? `${p.name} has ${plural(p.overdue, "overdue task")} ${when}.` : null;
  if (!lead) return null;
  const next = m ? `Start with ${m.name.charAt(0).toLowerCase()}${m.name.slice(1)}, due ${fmtMilestone(m).date}.` : "Start with its overdue tasks.";
  return { lead, next };
}

function CompareRow({ row, projects, verdict }: { row: Row; projects: Project[]; verdict: ReturnType<typeof judge> }) {
  return (
    <div className={s.cmpRow} role="row">
      <span role="rowheader" className={s.cmpLabel}>
        <span className={s.cmpLabelTop}>
          {row.label}
          {verdict === "even" && <span className={s.cmpEven}>Level</span>}
        </span>
        {row.help && <span className={s.cmpHelp}>{row.help}</span>}
      </span>
      {projects.map((p, i) => {
        const weaker = !!verdict && verdict !== "even" && verdict.weaker === i;
        return (
          <div key={`${i}-${p.id}`} role="cell" className={s.cmpCell} data-weaker={weaker || undefined}>
            {row.render(p, weaker)}
          </div>
        );
      })}
    </div>
  );
}

/* ── Project switcher ──────────────────────────────────────────────── */

function Picker({ pool, current, onPick, onClose }: { pool: Project[]; current: string; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => pool.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [pool, q]);
  const at = Math.min(active, Math.max(0, list.length - 1));

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", down);
    return () => window.removeEventListener("pointerdown", down);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className={s.cmpPicker}
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
    >
      <input
        autoFocus
        className={s.cmpPickerInput}
        placeholder="Swap for…"
        aria-label="Find a project to compare"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(Math.min(list.length - 1, at + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(0, at - 1));
          } else if (e.key === "Enter" && list[at]) {
            e.preventDefault();
            onPick(list[at].id);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <ul className={s.cmpPickerList} role="listbox" aria-label="Projects">
        {list.map((p, i) => (
          <li
            key={p.id}
            role="option"
            aria-selected={i === at}
            className={s.cmpPickerItem}
            data-current={p.id === current || undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(p.id)}
          >
            <Swatch tone={p.tone} name={p.name} size={16} />
            <span className={s.cmpPickerName}>{p.name}</span>
            {p.id === current ? <span className={s.cmpPickerNow}>Showing</span> : <span className={s.cmpPickerDate}>{fmtDate(p.date)}</span>}
          </li>
        ))}
        {list.length === 0 && <li className={s.cmpPickerEmpty}>No project by that name</li>}
      </ul>
    </motion.div>
  );
}

/* ── Shared day axis ────────────────────────────────────────────────── */

function DayAxis({ projects }: { projects: Project[] }) {
  const [guide, setGuide] = useState<{ x: number; iso: string } | null>(null);
  const start = addDays(TODAY, -14);
  const endIso = projects.reduce((a, p) => (toTime(p.date) > toTime(a) ? p.date : a), TODAY);
  const end = addDays(endIso, 7);
  const span = daysFromToday(end) - daysFromToday(start);
  const x = (iso: string) => ((daysFromToday(iso) - daysFromToday(start)) / span) * 100;

  // Week ticks on Mondays, month labels on the 1st.
  const ticks: { iso: string; month?: boolean }[] = [];
  for (let i = 0; i <= span; i++) {
    const iso = addDays(start, i);
    const day = new Date(toTime(iso)).getUTCDay();
    if (iso.endsWith("-01")) ticks.push({ iso, month: true });
    else if (day === 1) ticks.push({ iso });
  }
  // A week label that lands within three days of a month label would collide with it.
  const monthDays = ticks.filter((t) => t.month).map((t) => daysFromToday(t.iso));
  for (let i = ticks.length - 1; i >= 0; i--) {
    const d = daysFromToday(ticks[i].iso);
    if (!ticks[i].month && monthDays.some((m) => Math.abs(m - d) < 3)) ticks.splice(i, 1);
  }
  const weekTickStep = span > 120 ? 2 : 1;

  return (
    <div className={s.axisWrap}>
      <div className={s.axisHead}>
        <h3 className={s.axisTitle}>Milestones on one day axis</h3>
        <span className={s.axisLegend}>
          <span className={s.axisKeyDone} /> done
          <span className={s.axisKeyOpen} /> to do
          <span className={s.axisKeyLate} /> late
          <span className={s.axisKeyToday} /> today
        </span>
      </div>
      <div className={s.axis} onMouseLeave={() => setGuide(null)}>
        <div className={s.axisScale}>
          {ticks.map((t, i) =>
            t.month || i % weekTickStep === 0 ? (
              <span key={t.iso} className={s.axisTick} data-month={t.month || undefined} style={{ left: `${x(t.iso)}%` }}>
                {t.month ? fmtDate(t.iso).split(" ")[1] : i === 0 ? fmtDate(t.iso) : fmtDate(t.iso).split(" ")[0]}
              </span>
            ) : null,
          )}
        </div>
        <div className={s.axisLanes}>
          {ticks.map((t) => (
            <span key={`g-${t.iso}`} className={s.axisGrid} data-month={t.month || undefined} style={{ left: `${x(t.iso)}%` }} />
          ))}
          <span className={s.axisToday} style={{ left: `${x(TODAY)}%` }}>
            <span className={s.axisTodayLabel}>Today</span>
          </span>
          {guide && (
            <span className={s.axisGuide} style={{ left: `${guide.x}%` }}>
              <span className={s.axisGuideLabel}>{fmtDate(guide.iso)}</span>
            </span>
          )}
          {projects.map((p, lane) => {
            const inRange = p.milestones.filter((m) => toTime(m.date) >= toTime(start));
            const earlier = p.milestones.length - inRange.length;
            // Greedy two-row labels so neighbours never collide.
            const rowsEnd = [-Infinity, -Infinity];
            const placed = [...inRange]
              .sort((a, b) => toTime(a.date) - toTime(b.date))
              .map((m) => {
                const px = x(m.date);
                const w = (m.name.length * 6.2 + 12) / 9; // rough % of a ~900px axis
                const row = px - w / 2 > rowsEnd[0] ? 0 : px - w / 2 > rowsEnd[1] ? 1 : 0;
                rowsEnd[row] = px + w / 2;
                return { m, px, row };
              });
            const pStart = toTime(p.start) > toTime(start) ? x(p.start) : 0;
            // A milestone diamond within about 12px of the end flag would sit under it; lift the flag clear.
            const near = Math.max(1, Math.round((span * 12) / 900));
            const lift = p.milestones.some((m) => Math.abs(daysFromToday(m.date) - daysFromToday(p.date)) <= near);
            return (
              <motion.div
                key={p.id}
                className={s.lane}
                style={{ "--tone": `var(--c2-id-${p.tone})` } as CSSProperties}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + lane * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <span className={s.laneName}>
                  <Swatch tone={p.tone} name={p.name} size={10} />
                  <span className={s.laneText}>
                    <span className={s.laneTitle}>{p.name}</span>
                    {earlier > 0 && <span className={s.laneEarlier}>{earlier} earlier {earlier === 1 ? "milestone" : "milestones"}</span>}
                  </span>
                </span>
                <span className={s.laneTrack} style={{ left: `${pStart}%`, width: `${x(p.date) - pStart}%` }} />
                <span className={s.laneEnd} data-lift={lift || undefined} style={{ left: `${x(p.date)}%` }} title={`${p.name}, ${fmtDate(p.date)}`}>
                  <Icon.flag size={12} />
                  <span className={s.laneEndLabel}>{fmtDate(p.date)}</span>
                </span>
                {placed.map(({ m, px, row }) => {
                  const late = !m.done && daysFromToday(m.date) < 0;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      className={s.ms}
                      data-done={m.done || undefined}
                      data-late={late || undefined}
                      data-row={row}
                      style={{ left: `${px}%` }}
                      aria-label={`${m.name}, ${fmtDate(m.date)}${m.done ? ", done" : late ? ", late" : ""}`}
                      onMouseEnter={() => setGuide({ x: px, iso: m.date })}
                      onFocus={() => setGuide({ x: px, iso: m.date })}
                    >
                      <span className={s.msDiamond} />
                      <span className={s.msLabel}>{m.name}</span>
                    </button>
                  );
                })}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
