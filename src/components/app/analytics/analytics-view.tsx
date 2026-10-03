import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  ANALYTICS_RANGES,
  DEFAULT_ANALYTICS_RANGE,
  formatDays,
  plural,
  type AnalyticsRangeKey,
  type ChangeLine,
  type PersonLoad,
  type ProjectAnalytics,
} from "@/lib/projects/project-analytics";
import { ShellIcon } from "@/components/shell/shell-icons";
import { DueChart, DurationChart, Sparkline, WeeklyChart } from "./analytics-charts";
import styles from "./analytics.module.css";

/**
 * Analytics v3: how work is moving in the active Project.
 *
 * Read top to bottom it answers four questions in order: how much is there
 * (the numbers), which way is it going (the weekly chart and what changed),
 * where is it now (columns and dates), and who and what is it made of
 * (people, time to finish, priority). Every figure comes from one pure
 * calculation (`computeProjectAnalytics`) over the Project's own tasks; the
 * page adds words, never numbers.
 *
 * Server component; the range switch is plain links, so there is no client JS.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export function AnalyticsView({
  projectName,
  analytics,
  requestedProjectId,
}: {
  projectName: string;
  analytics: ProjectAnalytics;
  /** Carried into the range links when the URL named the Project. */
  requestedProjectId: string | null;
}) {
  const a = analytics;
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{projectName}</p>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.subtitle}>How work is moving in this project: what got finished, what is open and what is due next.</p>
          </div>
          {a.hasTasks ? <RangeSwitch current={a.range.key} requestedProjectId={requestedProjectId} /> : null}
        </header>

        {a.hasTasks ? (
          <>
            {a.coverage.truncated || a.coverage.columnsUnreadable ? <CoverageNotice analytics={a} /> : null}
            <Kpis analytics={a} />

            <div className={styles.rowMain}>
              <TrendCard analytics={a} />
              <ChangesCard lines={a.changes} />
            </div>

            <div className={styles.rowTwo}>
              <StatusCard analytics={a} />
              <DueCard analytics={a} />
            </div>

            <div className={styles.rowThree}>
              <PeopleCard people={a.people} phrase={a.range.phrase} />
              <DurationCard analytics={a} />
              <PriorityCard analytics={a} />
            </div>

            <Method analytics={a} />
          </>
        ) : (
          <AnalyticsEmpty />
        )}
      </div>
    </div>
  );
}

// ── Range ────────────────────────────────────────────────────────────────

function rangeHref(key: AnalyticsRangeKey, requestedProjectId: string | null): string {
  const params = new URLSearchParams();
  if (requestedProjectId) params.set("workspaceId", requestedProjectId);
  if (key !== DEFAULT_ANALYTICS_RANGE) params.set("range", key);
  const query = params.toString();
  return query ? `/app/analytics?${query}` : "/app/analytics";
}

function RangeSwitch({ current, requestedProjectId }: { current: AnalyticsRangeKey; requestedProjectId: string | null }) {
  return (
    <nav className={styles.range} aria-label="Time range">
      {ANALYTICS_RANGES.map((range) => (
        <Link
          key={range.key}
          href={rangeHref(range.key, requestedProjectId)}
          aria-current={range.key === current ? "page" : undefined}
          scroll={false}
          replace
        >
          {range.label}
        </Link>
      ))}
    </nav>
  );
}

function CoverageNotice({ analytics }: { analytics: ProjectAnalytics }) {
  return (
    <p className={styles.notice} role="note">
      <ShellIcon.alert size={14} />
      <span>
        {analytics.coverage.truncated
          ? "This project has more history than one read covers, so the oldest weeks may be short. "
          : ""}
        {analytics.coverage.columnsUnreadable
          ? "The board's columns could not be read just now, so only a column called Done counts as finished."
          : ""}
      </span>
    </p>
  );
}

// ── KPI strip ────────────────────────────────────────────────────────────

type Tone = "good" | "bad" | "neutral";

/** "0.6 days", "1 day", "2.5 days": a difference, so never "Under a day". */
function dayDelta(days: number): string {
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

function Delta({ tone, direction, children }: { tone: Tone; direction: "up" | "down" | "flat"; children: ReactNode }) {
  return (
    <span className={styles.delta} data-tone={tone}>
      <span aria-hidden="true">{direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}</span>
      <span className="sr-only">{direction === "up" ? "Up " : direction === "down" ? "Down " : "Level, "}</span>
      {children}
    </span>
  );
}

function Kpi({
  label,
  icon,
  iconTone,
  value,
  note,
  aside,
}: {
  label: ReactNode;
  icon: ReactNode;
  iconTone?: "accent" | "good" | "bad";
  value: ReactNode;
  note: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiTop}>
        <span>{label}</span>
        <span className={styles.kpiIcon} data-tone={iconTone} aria-hidden="true">{icon}</span>
      </span>
      <span className={styles.kpiMid}>
        {value}
        {aside}
      </span>
      <span className={styles.kpiNote}>{note}</span>
    </div>
  );
}

function Kpis({ analytics: a }: { analytics: ProjectAnalytics }) {
  const period = `prior ${a.range.phrase}`;

  const finishedDiff = a.finished.count - a.finished.previous;
  const finishedNote =
    a.finished.count === 0 && a.finished.previous === 0 ? (
      <>Nothing yet in {a.range.phrase}</>
    ) : finishedDiff === 0 ? (
      <><Delta tone="neutral" direction="flat">0</Delta> vs {period}</>
    ) : (
      <>
        <Delta tone={finishedDiff > 0 ? "good" : "bad"} direction={finishedDiff > 0 ? "up" : "down"}>{Math.abs(finishedDiff)}</Delta>
        vs {period}
      </>
    );

  const median = a.timeToFinish.medianDays;
  const previousMedian = a.timeToFinish.previousMedianDays;
  const medianDiff = median != null && previousMedian != null ? median - previousMedian : null;
  const medianNote =
    median == null ? (
      <>Shows once tasks are finished</>
    ) : medianDiff == null || Math.abs(medianDiff) < 0.05 ? (
      <>Median, added to finished</>
    ) : (
      <>
        <Delta tone={medianDiff < 0 ? "good" : "bad"} direction={medianDiff < 0 ? "down" : "up"}>
          {dayDelta(Math.abs(medianDiff))}
        </Delta>
        {medianDiff < 0 ? "faster" : "slower"} than before
      </>
    );

  const rate = a.onTime.rate;
  const rateDiff = rate != null && a.onTime.previousRate != null ? Math.round((rate - a.onTime.previousRate) * 100) : null;
  const onTimeNote =
    rate == null ? (
      <>No dated tasks finished yet</>
    ) : (
      <>
        {rateDiff != null && rateDiff !== 0 ? (
          <Delta tone={rateDiff > 0 ? "good" : "bad"} direction={rateDiff > 0 ? "up" : "down"}>
            {Math.abs(rateDiff)} {plural(Math.abs(rateDiff), "point")}
          </Delta>
        ) : null}
        {a.onTime.onTime} of {a.onTime.dated} dated
      </>
    );

  return (
    <section className={styles.kpis} aria-label="Numbers at a glance">
      <Kpi
        label="Open tasks"
        icon={<ShellIcon.layers size={14} />}
        iconTone="accent"
        value={<span className={styles.kpiValue}>{a.open.count}</span>}
        note={a.open.unassigned > 0 ? `${a.open.unassigned} with no one assigned` : a.open.count > 0 ? "Everyone has an owner" : "All clear"}
      />
      <Kpi
        label={<>Finished<span className={styles.kpiRange}> · {a.range.label}</span></>}
        icon={<ShellIcon.checkCircle size={14} />}
        iconTone="good"
        value={<span className={styles.kpiValue}>{a.finished.count}</span>}
        aside={<Sparkline values={a.weeks.map((week) => week.finished)} />}
        note={finishedNote}
      />
      <Kpi
        label="Overdue"
        icon={<ShellIcon.alert size={14} />}
        iconTone={a.overdue.count > 0 ? "bad" : undefined}
        value={
          <span className={styles.kpiValue} data-tone={a.overdue.count > 0 ? "bad" : undefined}>
            {a.overdue.count}
          </span>
        }
        note={
          a.overdue.count > 0
            ? `Oldest is ${a.overdue.oldestDays} ${plural(a.overdue.oldestDays, "day")} late`
            : "Nothing past its date"
        }
      />
      <Kpi
        label="Time to finish"
        icon={<ShellIcon.clock size={14} />}
        value={
          median == null ? (
            <span className={`${styles.kpiValue} ${styles.kpiEmpty}`}>Not yet</span>
          ) : median < 1 ? (
            <span className={styles.kpiValue}>
              &lt;1<span className={styles.kpiUnit}>day</span>
            </span>
          ) : (
            <span className={styles.kpiValue}>
              {median < 10 ? Math.round(median * 10) / 10 : Math.round(median)}
              <span className={styles.kpiUnit}>{median === 1 ? "day" : "days"}</span>
            </span>
          )
        }
        note={medianNote}
      />
      <Kpi
        label="On time"
        icon={<ShellIcon.timeline size={14} />}
        value={
          rate == null ? (
            <span className={`${styles.kpiValue} ${styles.kpiEmpty}`}>Not yet</span>
          ) : (
            <span className={styles.kpiValue}>
              {Math.round(rate * 100)}
              <span className={styles.kpiUnit}>%</span>
            </span>
          )
        }
        note={onTimeNote}
      />
    </section>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────

function Card({
  id,
  title,
  sub,
  meta,
  children,
}: {
  id: string;
  title: string;
  sub?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <div>
          <h2 id={id} className={styles.cardTitle}>{title}</h2>
          {sub ? <p className={styles.cardSub}>{sub}</p> : null}
        </div>
        {meta}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

function TrendCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const net = a.added.count - a.finished.count;
  const sub =
    a.finished.count === 0
      ? `Nothing finished in the last ${a.range.phrase} yet.`
      : net > 0
        ? `${net} more ${plural(net, "task was", "tasks were")} added than finished.`
        : net < 0
          ? `${-net} more ${plural(-net, "task was", "tasks were")} finished than added.`
          : "As many tasks were added as finished.";
  return (
    <Card
      id="an-trend"
      title="Finished each week"
      sub={sub}
      meta={
        <ul className={styles.legend} aria-label="Totals for the period">
          <li className={styles.legendItem}>
            <span className={styles.legendLabel}><i className={styles.swatchBar} />Finished</span>
            <span className={styles.legendValue}>{a.finished.count}</span>
          </li>
          <li className={styles.legendItem}>
            <span className={styles.legendLabel}><i className={styles.swatchLine} />Added</span>
            <span className={styles.legendValue}>{a.added.count}</span>
          </li>
          <li className={styles.legendItem}>
            <span className={styles.legendLabel}><i className={styles.swatchDash} />Weekly average</span>
            <span className={styles.legendValue}>{Math.round(a.weeklyAverage * 10) / 10}</span>
          </li>
        </ul>
      }
    >
      <WeeklyChart weeks={a.weeks} average={a.weeklyAverage} captionId="an-trend" />
    </Card>
  );
}

function ChangeIcon({ tone }: { tone: ChangeLine["tone"] }) {
  if (tone === "good") return <ShellIcon.checkCircle size={13} />;
  if (tone === "bad") return <ShellIcon.alert size={13} />;
  return <ShellIcon.arrowRight size={12} />;
}

function ChangesCard({ lines }: { lines: readonly ChangeLine[] }) {
  return (
    <section className={styles.card} aria-labelledby="an-changes">
      <div className={styles.cardHead}>
        <div>
          <h2 id="an-changes" className={styles.cardTitle}>What changed this week</h2>
          <p className={styles.cardSub}>The last 7 days against the 7 before.</p>
        </div>
      </div>
      <ul className={styles.changes}>
        {lines.map((line, index) => (
          <li key={index} className={styles.change}>
            <span className={styles.changeIcon} data-tone={line.tone} aria-hidden="true">
              <ChangeIcon tone={line.tone} />
            </span>
            <span>
              {line.text}
              {line.task ? (
                <>
                  <Link href={`/app/task/${encodeURIComponent(line.task.id)}`} className={styles.changeLink}>
                    {line.task.title}
                  </Link>
                  {line.task.after}
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.changesFoot}>
        <Link href="/app/tasks" className={styles.cardLink}>
          Open the board <span aria-hidden="true">→</span>
        </Link>
      </p>
    </section>
  );
}

/** A rule above the first done column, so finished work reads as its own group. */
function startsDoneGroup(rows: ProjectAnalytics["status"], index: number): boolean {
  const previous = index > 0 ? rows[index - 1] : undefined;
  return Boolean(rows[index]?.isDone && previous && !previous.isDone);
}

function StatusCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const total = a.status.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...a.status.map((row) => row.count));
  return (
    <Card
      id="an-status"
      title="Where tasks are"
      sub="Every task on the board, by column."
      meta={<span className={styles.cardMeta}>{total} {plural(total, "task")}</span>}
    >
      <ul className={styles.rows}>
        {a.status.map((row, index) => (
          <li
            key={row.key}
            className={styles.hrow}
            data-tone={row.tone}
            data-done={startsDoneGroup(a.status, index) ? "" : undefined}
          >
            <span className={styles.hrowName}>
              <span className={styles.pip} aria-hidden="true" />
              <span>{row.name}</span>
            </span>
            <span className={styles.track} aria-hidden="true">
              {row.count > 0 ? (
                <span className={styles.fill} style={{ width: `${(row.count / max) * 100}%`, "--i": index } as Vars} />
              ) : null}
            </span>
            <span className={styles.hrowCount}>
              {row.count}
              <span className={styles.hrowShare}>{Math.round(row.share * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DueCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const { upcoming } = a;
  return (
    <Card
      id="an-due"
      title="Due in the next 14 days"
      sub={
        upcoming.total === 0 && upcoming.overdue === 0
          ? "Nothing open has a date in the next two weeks."
          : `${upcoming.total} due${upcoming.overdue > 0 ? `, and ${upcoming.overdue} already late` : ""}.`
      }
      meta={
        <Link href="/app/timeline" className={styles.cardLink}>
          Timeline <span aria-hidden="true">→</span>
        </Link>
      }
    >
      <DueChart days={upcoming.days} overdue={upcoming.overdue} captionId="an-due" />
    </Card>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

function PeopleCard({ people, phrase }: { people: readonly PersonLoad[]; phrase: string }) {
  const max = Math.max(1, ...people.map((person) => person.open));
  const withOpen = people.filter((person) => person.open > 0).length;
  return (
    <Card
      id="an-people"
      title="Who has what"
      sub={`Open tasks per person, and what they finished in ${phrase}.`}
      meta={<span className={styles.cardMeta}>{withOpen} {plural(withOpen, "person", "people")}</span>}
    >
      {people.length === 0 ? (
        <p className={styles.cardEmpty}>No open tasks are assigned yet.</p>
      ) : (
        <>
          <ul className={styles.people}>
            {people.map((person) => {
              const rest = person.open - person.overdue - person.dueSoon;
              const muted = person.id == null;
              const meta = [
                person.dueSoon > 0 ? `${person.dueSoon} due this week` : null,
                person.finished > 0 ? `${person.finished} finished` : null,
              ].filter((part): part is string => typeof part === "string");
              return (
                <li key={person.id ?? "none"} className={styles.person}>
                  <span className={styles.avatar} data-muted={muted ? "" : undefined} aria-hidden="true">
                    {muted ? "?" : initials(person.name)}
                  </span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>{person.name}</span>
                    <span className={styles.personMeta}>
                      {person.overdue > 0 ? <b>{person.overdue} late</b> : null}
                      {person.overdue > 0 && meta.length > 0 ? " · " : null}
                      {meta.join(" · ")}
                      {person.overdue === 0 && meta.length === 0 ? "Nothing dated" : null}
                    </span>
                  </span>
                  <span className={styles.personOpen}>
                    {person.open} <span>open</span>
                  </span>
                  <span className={styles.stack} aria-hidden="true" style={{ width: `${Math.max((person.open / max) * 100, person.open > 0 ? 4 : 0)}%` }}>
                    {person.overdue > 0 ? <span className={styles.segLate} style={{ flex: person.overdue }} /> : null}
                    {person.dueSoon > 0 ? <span className={styles.segSoon} style={{ flex: person.dueSoon }} /> : null}
                    {rest > 0 ? <span className={styles.segRest} style={{ flex: rest }} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.keyRow} aria-hidden="true">
            <span><i className={styles.segLate} />Late</span>
            <span><i className={styles.segSoon} />Due this week</span>
            <span><i className={styles.segRest} />Later or undated</span>
          </p>
        </>
      )}
    </Card>
  );
}

function DurationCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const { medianDays, sample } = a.timeToFinish;
  return (
    <Card
      id="an-duration"
      title="Time to finish"
      sub={`How long tasks finished in the last ${a.range.phrase} took.`}
      meta={sample > 0 ? <span className={styles.cardMeta}>{sample} {plural(sample, "task")}</span> : null}
    >
      {sample === 0 || medianDays == null ? (
        <p className={styles.cardEmpty}>Shows once tasks are finished in this period.</p>
      ) : (
        <>
          <DurationChart buckets={a.durations} captionId="an-duration" />
          <p className={styles.medianNote}>
            <i aria-hidden="true" />
            Half were finished within {formatDays(medianDays).toLowerCase()}.
          </p>
        </>
      )}
    </Card>
  );
}

/** The board's hue contract: red is alarm (Urgent), High is strong ink, the rest recede. */
const PRIORITY_TONE = { p0: "alert", p1: "ink", p2: "mid", p3: "faint" } as const;

function PriorityCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const open = a.priorities.reduce((sum, row) => sum + row.open, 0);
  const max = Math.max(1, ...a.priorities.map((row) => row.open));
  return (
    <Card
      id="an-priority"
      title="Open tasks by priority"
      sub="What is waiting, by how much it matters."
      meta={<span className={styles.cardMeta}>{open} open</span>}
    >
      {open === 0 ? (
        <p className={styles.cardEmpty}>No open tasks right now.</p>
      ) : (
        <ul className={styles.rows}>
          {a.priorities.map((row, index) => (
            <li key={row.priority} className={styles.hrow} data-tone={PRIORITY_TONE[row.priority]}>
              <span className={styles.hrowName}>
                <span className={styles.pip} aria-hidden="true" />
                <span>{row.label}</span>
              </span>
              <span className={styles.track} aria-hidden="true">
                {row.open > 0 ? (
                  <span className={styles.fill} style={{ width: `${(row.open / max) * 100}%`, "--i": index } as Vars} />
                ) : null}
              </span>
              <span className={styles.hrowCount}>
                {row.overdue > 0 ? <span className={styles.hrowNote}>{row.overdue} late</span> : null}
                {row.open}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Method({ analytics: a }: { analytics: ProjectAnalytics }) {
  const doneNames = a.status.filter((row) => row.isDone).map((row) => row.name);
  const doneList = doneNames.length > 0 ? doneNames.join(" or ") : "Done";
  return (
    <details className={styles.method}>
      <summary>
        <ShellIcon.chevronRight size={14} />
        How these numbers are counted
      </summary>
      <ul className={styles.methodList}>
        <li>A task counts as finished on the day it reached {doneList}. Finished tasks that were archived later still count.</li>
        <li>Open tasks are the ones in every other column. Archived tasks are not open work, so they are left out.</li>
        <li>Weeks are seven-day stretches that end today, so the latest bar is always a full week. Dates follow {a.timeZone.replace(/_/g, " ")} time.</li>
        <li>Time to finish runs from when a task was added to when it was finished. Half of tasks were quicker than the median.</li>
        <li>On time means finished on or before the due date. Tasks with no due date are left out of that figure.</li>
        <li>Subtasks count as part of their parent task, as they do on the board.</li>
        {a.coverage.finishedWithoutDate > 0 ? (
          <li>
            {a.coverage.finishedWithoutDate} finished {plural(a.coverage.finishedWithoutDate, "task has", "tasks have")} no record of when{" "}
            {plural(a.coverage.finishedWithoutDate, "it was", "they were")} finished, so {plural(a.coverage.finishedWithoutDate, "it is", "they are")} not in the weekly counts.
          </li>
        ) : null}
      </ul>
    </details>
  );
}

// ── Empty and unavailable ────────────────────────────────────────────────

function EmptyArt() {
  const heights = [14, 24, 18, 32, 26, 40];
  return (
    <span className={styles.emptyArt} aria-hidden="true">
      {heights.map((height, index) => (
        <span key={index} style={{ height, "--i": index } as Vars} />
      ))}
    </span>
  );
}

function AnalyticsEmpty() {
  return (
    <section className={styles.empty}>
      <EmptyArt />
      <h2 className={styles.emptyTitle}>Nothing to measure yet</h2>
      <p className={styles.emptyBody}>
        Analytics fills in from this project&rsquo;s tasks. Add a few, finish one, and the first numbers appear here.
      </p>
      <Link href="/app/tasks" className={styles.buttonPrimary}>
        Open Tasks
      </Link>
    </section>
  );
}

export function AnalyticsUnavailable() {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.subtitle}>Choose a project to see how its work is moving.</p>
          </div>
        </header>
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShellIcon.projects size={20} />
          </span>
          <h2 className={styles.emptyTitle}>No project open</h2>
          <p className={styles.emptyBody}>Analytics belong to a project. Open one from the sidebar, or see them all in Projects.</p>
          <Link href="/app/project" className={styles.buttonPrimary}>
            See projects
          </Link>
        </section>
      </div>
    </div>
  );
}
