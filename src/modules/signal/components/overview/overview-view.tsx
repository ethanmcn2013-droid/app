import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ShellIcon } from "@/components/shell/shell-icons";
import type {
  OverviewFinishedRow,
  OverviewLaneCounts,
  OverviewModel,
  OverviewRunway,
  OverviewSignal,
} from "../../lib/overview/overview-model";
import { OpenInTasks, WhyThis } from "./overview-actions";
import styles from "./overview.module.css";

/**
 * Overview v3: the full read across one scope.
 *
 * Home is the glance (numbers, my tasks, deadlines). This page is the read
 * behind it, one Project at a time: how far the work has come, what needs
 * attention and why, what is at risk, the dates between now and the
 * Project's key date, what finished this week, and how Signal arrived at all
 * of it.
 *
 * Server component. The only client code is the open-in-Tasks form and the
 * "Why this" disclosure. Motion is one concert, not a swarm: the page rises
 * as a whole (CSS on server-rendered markup, transform only, so the frame
 * after the skeleton is content and never a blank page waiting for
 * hydration), the progress bar draws once, and the dates settle onto the
 * runway. No per-card stagger.
 */

const OVERVIEW_PATH_SETTINGS = "/app/home/briefing/settings/notifications";

export function OverviewView({
  model,
  scopeControl = null,
}: {
  model: OverviewModel;
  /** The project switcher, when there is another Project to choose. */
  scopeControl?: ReactNode;
}) {
  const hasSide = model.runway !== null || model.finished !== null;
  const noSignals = model.attention.length === 0 && model.risks.length === 0;

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={`${styles.inner} ${styles.rise}`}>
        <header className={styles.header}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>
              {model.dateLabel} · Read at {model.timeLabel}
            </p>
            <h1 className={styles.title}>Overview</h1>
            <p className={styles.subtitle}>
              <span className={styles.statusDot} data-tone={model.verdict.tone} aria-hidden="true" />
              {model.scopeLabel ? (
                <span className={styles.scopeName}>{model.scopeLabel}</span>
              ) : null}
              <span>{model.verdict.sentence}</span>
            </p>
          </div>
          <div className={styles.headActions}>
            {scopeControl}
            <Link href="/app/tasks" className={styles.button}>
              <ShellIcon.tasks size={14} />
              Open Tasks
            </Link>
          </div>
        </header>

        {model.coverage ? (
          <div
            role="status"
            aria-live="polite"
            className={styles.notice}
            data-tone={model.coverage.tone}
          >
            <ShellIcon.alert size={16} className={styles.noticeIcon} />
            <p>{model.coverage.note}</p>
          </div>
        ) : null}

        {model.lanes ? <Progress lanes={model.lanes} /> : null}

        <div className={styles.grid} data-single={hasSide ? undefined : ""}>
          <div className={styles.column}>
            {model.attention.length > 0 ? (
              <SignalCard
                id="overview-attention"
                title="Needs attention"
                signals={model.attention}
              />
            ) : null}
            {model.risks.length > 0 ? (
              <SignalCard
                id="overview-risks"
                title="At risk"
                signals={model.risks}
              />
            ) : null}
            {noSignals && model.emptyState ? (
              <section className={styles.card} aria-labelledby="overview-clear">
                <div className={styles.clear}>
                  <span
                    className={styles.clearGlyph}
                    data-tone={model.emptyState.kind === "coverage" ? "warning" : "success"}
                    aria-hidden="true"
                  >
                    {model.emptyState.kind === "coverage" ? (
                      <ShellIcon.alert size={18} />
                    ) : (
                      <ShellIcon.checkCircle size={18} />
                    )}
                  </span>
                  <div>
                    <h2 id="overview-clear" className={styles.clearTitle}>
                      {model.emptyState.headline}
                    </h2>
                    <p className={styles.clearBody}>{model.emptyState.body}</p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {hasSide ? (
            <div className={styles.column}>
              {model.runway ? <DatesAhead runway={model.runway} /> : null}
              {model.finished ? <Finished rows={model.finished} /> : null}
            </div>
          ) : null}
        </div>

        {model.readNote ? (
          <section className={styles.readNote} aria-labelledby="overview-read">
            <span className={styles.readIcon} aria-hidden="true">
              <InfoIcon />
            </span>
            <div>
              <h2 id="overview-read" className={styles.readTitle}>
                How this was read
              </h2>
              <p className={styles.readBody}>{model.readNote}</p>
              <p className={styles.readLinks}>
                <Link href={OVERVIEW_PATH_SETTINGS} className={styles.readLink}>
                  Briefing delivery <span aria-hidden="true">→</span>
                </Link>
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ── Progress ────────────────────────────────────────────────────────── */

const LANES: ReadonlyArray<{
  key: keyof Pick<OverviewLaneCounts, "done" | "review" | "inProgress" | "todo">;
  label: string;
  tone: string;
}> = [
  { key: "done", label: "Done", tone: "success" },
  { key: "review", label: "In review", tone: "review" },
  { key: "inProgress", label: "In progress", tone: "warning" },
  { key: "todo", label: "To do", tone: "neutral" },
];

function Progress({ lanes }: { lanes: OverviewLaneCounts }) {
  const percent = lanes.total > 0 ? Math.round((lanes.done / lanes.total) * 100) : 0;
  const summary = LANES.map((lane) => `${lanes[lane.key]} ${lane.label.toLowerCase()}`).join(", ");
  return (
    <section className={styles.progress} aria-labelledby="overview-progress">
      <div className={styles.progressLead}>
        <h2 id="overview-progress" className={styles.progressLabel}>
          Progress
        </h2>
        <p className={styles.progressValue}>
          {percent}
          <span className={styles.progressUnit}>%</span>
        </p>
        <p className={styles.progressSub}>
          {lanes.total === 0
            ? "No tasks in this scope yet"
            : `${lanes.done} of ${lanes.total} ${lanes.total === 1 ? "task" : "tasks"} done`}
        </p>
      </div>
      <div className={styles.progressBody}>
        <div className={styles.bar} role="img" aria-label={`Work in scope: ${summary}.`}>
          {lanes.total === 0 ? (
            <span className={styles.segment} data-tone="empty" style={{ flexGrow: 1 }} />
          ) : (
            LANES.filter((lane) => lanes[lane.key] > 0).map((lane) => (
              <span
                key={lane.key}
                className={styles.segment}
                data-tone={lane.tone}
                style={{ flexGrow: lanes[lane.key] }}
              />
            ))
          )}
        </div>
        <div className={styles.progressFoot}>
          {lanes.total === 0 ? (
            <p className={styles.progressNote}>Progress appears here as tasks are added.</p>
          ) : (
            <ul className={styles.legend}>
              {LANES.map((lane) => (
                <li key={lane.key} className={styles.legendItem}>
                  <span className={styles.swatch} data-tone={lane.tone} aria-hidden="true" />
                  {lane.label}
                  <span className={styles.legendCount}>{lanes[lane.key]}</span>
                </li>
              ))}
            </ul>
          )}
          {lanes.undated > 0 ? (
            <p className={styles.progressNote}>
              {lanes.undated} open {lanes.undated === 1 ? "task has" : "tasks have"} no date
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── Signals ─────────────────────────────────────────────────────────── */

function SignalCard({
  id,
  title,
  signals,
}: {
  id: string;
  title: string;
  signals: OverviewSignal[];
}) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2 id={id} className={styles.cardTitle}>
            {title}
          </h2>
          <span className={styles.count}>{signals.length}</span>
        </div>
      </div>
      <ol className={styles.signals}>
        {signals.map((signal) => (
          <SignalRow key={signal.entry.id} signal={signal} />
        ))}
      </ol>
    </section>
  );
}

function SignalRow({ signal }: { signal: OverviewSignal }) {
  const { entry, chip, age } = signal;
  const receipt = entry.receipt;
  const extras = [
    receipt.evidenceCount > 1 ? `${receipt.evidenceCount} items` : null,
    receipt.updatedAtLabel ? `updated ${receipt.updatedAtLabel}` : null,
  ].filter(Boolean);
  // "Due today." under a "Due today" chip spends a line saying nothing new.
  const detail = entry.detail && !sameWords(entry.detail, chip.label) ? entry.detail : null;

  return (
    <li className={styles.signal}>
      <div className={styles.signalBody}>
        <div className={styles.signalMeta}>
          <span className={styles.chip} data-tone={chip.tone}>
            {chip.label}
          </span>
          {age ? <span className={styles.age}>{age}</span> : null}
        </div>
        <h3 className={styles.signalTitle}>{entry.text}</h3>
        {detail ? <p className={styles.signalWhy}>{detail}</p> : null}
        <p className={styles.signalSource}>
          {receipt.sourceLabel}
          {extras.length > 0 ? ` · ${extras.join(" · ")}` : ""}
          {entry.evidenceHref ? (
            <>
              {" · "}
              <Link href={entry.evidenceHref} scroll={false} className={styles.toolLink}>
                Evidence
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className={styles.signalAction}>
        {entry.primaryAction?.href === "/app/tasks" ? (
          <OpenInTasks entryId={entry.id} label={entry.primaryAction.label} />
        ) : entry.primaryAction ? (
          <Link href={entry.primaryAction.href} className={styles.action}>
            {entry.primaryAction.label}
            <ShellIcon.arrowRight size={14} />
          </Link>
        ) : null}
      </div>
      {entry.reasons.length > 0 ? (
        <WhyThis panelId={`overview-why-${entry.id}`} reasons={entry.reasons} />
      ) : null}
    </li>
  );
}

function sameWords(a: string, b: string): boolean {
  const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim();
  return words(a) === words(b);
}

/* ── Dates ahead ─────────────────────────────────────────────────────── */

function DatesAhead({ runway }: { runway: OverviewRunway }) {
  // The late zone is a zone, not a scale: overdue work sits left of today at a
  // fixed width so one old date cannot squeeze the next few weeks to a pixel.
  const today = runway.overdue > 0 ? 0.12 : 0;
  const x = (position: number) => `${(today + (1 - today) * position) * 100}%`;
  const key = runway.keyDate;

  return (
    <section className={styles.card} aria-labelledby="overview-dates">
      <div className={styles.cardHead}>
        <h2 id="overview-dates" className={styles.cardTitle}>
          Dates ahead
        </h2>
        <Link href="/app/timeline" className={styles.cardLink}>
          Timeline <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className={styles.runway}>
        {key ? (
          <div className={styles.countdown}>
            <p className={styles.countdownValue}>
              {key.daysAway === 0 ? "Today" : key.daysAway}
              {key.daysAway > 0 ? (
                <span className={styles.countdownUnit}>{key.daysAway === 1 ? " day" : " days"}</span>
              ) : null}
            </p>
            <p className={styles.countdownLabel}>
              {key.daysAway === 0 ? "is " : "until "}
              <span className={styles.countdownName}>{key.label}</span>
              {key.project ? ` · ${key.project}` : ""}
            </p>
            <p className={styles.countdownDate}>{key.dateLabel}</p>
          </div>
        ) : (
          <p className={styles.windowLabel}>Next {runway.windowDays} days</p>
        )}

        <div className={styles.track} aria-hidden="true">
          <span className={styles.trackLine} />
          {runway.overdue > 0 ? (
            <>
              <span className={styles.trackLate} style={{ width: x(0) }} />
              <span className={styles.trackMark} data-tone="danger" style={{ left: `${today * 50}%` }} />
            </>
          ) : null}
          {runway.ticks.map((tick) => (
            <span key={tick.label} className={styles.trackTick} style={{ left: x(tick.at) }} />
          ))}
          <span className={styles.trackToday} style={{ left: x(0) }} />
          {runway.marks.map((mark, markIndex) => (
            <span
              key={markIndex}
              className={styles.trackMark}
              data-tone={mark.tone}
              style={{ left: x(mark.at), "--n": markIndex + 1 } as CSSProperties}
            />
          ))}
          {key ? (
            <span className={styles.trackEnd}>
              <FlagIcon />
            </span>
          ) : null}
        </div>
        <div className={styles.trackLabels} aria-hidden="true">
          <span className={styles.trackTodayLabel} data-offset={today > 0 ? "" : undefined} style={{ left: x(0) }}>
            Today
          </span>
          {runway.ticks.map((tick) => (
            <span key={tick.label} className={styles.trackTickLabel} style={{ left: x(tick.at) }}>
              {tick.label}
            </span>
          ))}
          <span className={styles.trackEndLabel}>{runway.endLabel}</span>
        </div>

        {runway.rows.length > 0 ? (
          <ul className={styles.dates}>
            {runway.rows.map((row) => (
              <li key={row.key}>
                <Link href={row.href} className={styles.dateRow}>
                  <span className={styles.dateDay} data-tone={row.tone}>
                    {row.day}
                  </span>
                  <span className={styles.dateTitle}>{row.title}</span>
                  {row.relative ? (
                    <span className={styles.dateRel} data-tone={row.tone}>
                      {row.relative}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>
            {key ? `Nothing is dated between now and ${key.label.toLowerCase()}.` : "Nothing is dated in this window."}
          </p>
        )}
        {runway.more > 0 ? (
          <p className={styles.more}>
            {runway.more} more {runway.more === 1 ? "date" : "dates"} in this window, on the timeline.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ── Finished this week ──────────────────────────────────────────────── */

function Finished({ rows }: { rows: OverviewFinishedRow[] }) {
  return (
    <section className={styles.card} aria-labelledby="overview-finished">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2 id="overview-finished" className={styles.cardTitle}>
            Finished this week
          </h2>
          {rows.length > 0 ? <span className={styles.count}>{rows.length}</span> : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing finished in the last seven days.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.key}>
              <Link href={row.href} className={styles.row}>
                <span className={styles.doneIcon} aria-hidden="true">
                  <DoneIcon />
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{row.title}</span>
                  <span className={styles.rowMeta}>{row.source}</span>
                </span>
                <span className={styles.rowWhen}>{row.when}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── Icons (16px, 1.5 stroke, currentColor: the shell's family) ──────── */

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7.25v3.5" />
      <path d="M8 5.25h.01" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 14V2.5" />
      <path d="M4 3h7.5l-1.75 2.75L11.5 8.5H4" />
    </svg>
  );
}

function DoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" />
      <path d="m5.5 8.1 1.75 1.75L10.5 6.5" />
    </svg>
  );
}
