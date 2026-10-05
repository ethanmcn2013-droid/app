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
import {
  QUESTION_GROUPS,
  analyticsSummary,
  answerQuestion,
  portfolioSummary,
  questionsFor,
  type Answer,
  type AnswerAction,
  type AnswerScope,
  type ProjectStanding,
  type Question,
  type QuestionId,
} from "@/lib/projects/project-analytics-questions";
import { buildWall, WALL_SORTS, type WallCard, type WallModel, type WallSort } from "@/lib/projects/project-analytics-wall";
import { formatConsoleDay, type ConsoleMark } from "@/lib/projects/project-console";
import type { AnalyticsWall } from "@/server/projects/project-analytics-wall";
import { PRIORITY_LABEL } from "@/lib/data";
import { ShellIcon } from "@/components/shell/shell-icons";
import { DueChart, DurationChart, WeeklyChart } from "./analytics-charts";
import { AskBox } from "./ask-box";
import { ScopePicker, type ScopeOption } from "./scope-picker";
import styles from "./analytics.module.css";

/**
 * Analytics v3 (the founder's preferred design, ported 5 Oct 2026).
 *
 * "Ask" is a library of plain questions, each answered by one sentence worked
 * out from real tasks, with the chart that carries the sentence underneath.
 * The ask box finds a question in that library by its words; it is not a
 * language model, and when nothing matches it says so. "All projects" is one
 * card per Project the reader can open, from the Projects page's own read.
 * The scope beside the title is every project, or one.
 *
 * Every figure comes from a pure calculation (`computeProjectAnalytics`,
 * `answerQuestion`, `buildWall`); the page adds layout, never numbers.
 *
 * Server component. Scope, part, question, range and sort are plain links in
 * the address. The ask box and the scope menu are the only client parts.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export type AnalyticsPart = "ask" | "projects";

export function parseAnalyticsPart(raw: unknown): AnalyticsPart {
  return raw === "projects" ? "projects" : "ask";
}

/** What the page covers: every project the reader can open, or one. */
export type AnalyticsScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "one"; projectId: string; name: string; standing: ProjectStanding }>;

type Address = Readonly<{
  scope: "all" | "one";
  /** The Project named in links while the scope is one. Null leaves it to the open Project. */
  projectId: string | null;
  part: AnalyticsPart;
  ask: QuestionId | null;
  range: AnalyticsRangeKey;
  sort: WallSort;
}>;

/** One address builder, so every link keeps what the reader already chose. */
function hrefFor(address: Address, change: Partial<Address> = {}): string {
  const next = { ...address, ...change };
  const params = new URLSearchParams();
  if (next.scope === "all") params.set("scope", "all");
  else if (next.projectId) params.set("workspaceId", next.projectId);
  if (next.part === "projects") {
    params.set("view", "projects");
    if (next.sort !== "look") params.set("sort", next.sort);
  } else if (next.ask) {
    params.set("ask", next.ask);
  }
  if (next.range !== DEFAULT_ANALYTICS_RANGE) params.set("range", next.range);
  const query = params.toString();
  return query ? `/app/analytics?${query}` : "/app/analytics";
}

export function AnalyticsView({
  scope,
  analytics,
  projects,
  part,
  ask,
  sort,
  everyProject,
  wall,
  linkProjectId,
}: {
  scope: AnalyticsScope;
  /** The calculation for the scope: one project's tasks, or all of them together. */
  analytics: ProjectAnalytics;
  /** Active projects the reader can open, for the scope menu. Empty when they are not listed. */
  projects: ReadonlyArray<Readonly<{ id: string; name: string }>>;
  part: AnalyticsPart;
  /** Null is the list of questions. */
  ask: QuestionId | null;
  sort: WallSort;
  /** False when Projects are not listed, which leaves Analytics to the open one. */
  everyProject: boolean;
  /** Read when the scope is every project, or "All projects" is on screen. */
  wall: AnalyticsWall | null;
  /** The Project to name in links while the scope is one; null leaves it to the open Project. */
  linkProjectId: string | null;
}) {
  const a = analytics;
  const shownPart: AnalyticsPart = everyProject && wall !== null ? part : "ask";
  const address: Address = { scope: scope.kind, projectId: linkProjectId, part: shownPart, ask, range: a.range.key, sort };
  const wallModel = wall?.kind === "ready" ? buildWall(wall.projects, wall.today ?? a.today, sort) : null;
  const acrossAll = scope.kind === "all" || shownPart === "projects";
  const summary = acrossAll && wallModel ? portfolioSummary(wallModel, a) : a.hasTasks ? analyticsSummary(a) : [];

  const options: ScopeOption[] = everyProject
    ? [
        { key: "all", href: hrefFor(address, { scope: "all", projectId: null }), label: "All projects", note: `${projects.length} active`, current: scope.kind === "all" },
        ...projects.map((project) => ({
          key: project.id,
          href: hrefFor(address, { scope: "one", projectId: project.id, part: "ask" }),
          label: project.name,
          current: scope.kind === "one" && scope.projectId === project.id,
        })),
      ]
    : [];

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Analytics</h1>
            <ScopePicker
              label={scope.kind === "all" ? "All projects" : scope.name}
              note={scope.kind === "all" ? `${projects.length} active` : undefined}
              options={projects.length > 1 ? options : []}
            />
          </div>
          <p className={styles.summary}>
            {summary.length > 0 ? (
              summary.map((item, index) => (
                <span key={index} data-tone={item.tone}>
                  {item.text}
                </span>
              ))
            ) : (
              <span>{acrossAll ? "How every project you can open is doing." : "How work is moving in this project."}</span>
            )}
          </p>
        </header>

        {everyProject ? (
          <nav className={styles.parts} aria-label="Analytics">
            <Link href={hrefFor(address, { part: "ask", ask: null })} aria-current={shownPart === "ask" ? "page" : undefined} scroll={false}>
              <ShellIcon.search size={14} />
              Ask
            </Link>
            <Link href={hrefFor(address, { part: "projects" })} aria-current={shownPart === "projects" ? "page" : undefined} scroll={false}>
              <ShellIcon.projects size={14} />
              All projects
            </Link>
          </nav>
        ) : null}

        {shownPart === "projects" && wall ? (
          <Wall wall={wall} model={wallModel} address={address} />
        ) : a.hasTasks ? (
          <Ask analytics={a} scope={scope} wallModel={wallModel} address={address} hasWall={everyProject} />
        ) : (
          <AnalyticsEmpty acrossAll={scope.kind === "all"} />
        )}
      </div>
    </div>
  );
}

// ── Ask ──────────────────────────────────────────────────────────────────

/** The questions whose chart covers the chosen range, so the switch means something. */
const RANGED: ReadonlySet<QuestionId> = new Set(["who", "slip", "long"]);

function actionHref(action: AnswerAction, address: Address): string {
  switch (action.kind) {
    case "question":
      return hrefFor(address, { part: "ask", ask: action.target as QuestionId });
    case "task":
      return `/app/task/${encodeURIComponent(action.target ?? "")}`;
    case "timeline":
      return "/app/timeline";
    case "projects":
      return hrefFor(address, { part: "projects" });
    default:
      return "/app/tasks";
  }
}

/** A small drawing of the chart each question opens. Decoration only. */
function Glyph({ id }: { id: QuestionId }) {
  const shapes: Record<QuestionId, ReactNode> = {
    shape: <path d="M2 6c8 0 12 14 20 14 5 0 6-10 10-16v18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
    week: (
      <>
        <path d="M4 20 34 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="4" cy="20" r="2.5" fill="currentColor" />
        <circle cx="34" cy="8" r="2.5" fill="currentColor" />
      </>
    ),
    who: (
      <>
        <rect x="2" y="4" width="34" height="5" rx="2" fill="currentColor" />
        <rect x="2" y="12" width="22" height="5" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="2" y="20" width="12" height="5" rx="2" fill="currentColor" opacity="0.3" />
      </>
    ),
    next: (
      <>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={2 + i * 7.5} y="4" width="5.5" height="20" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={i === 0 ? 1 : 0.5} />
        ))}
        <rect x="3.5" y="14" width="2.5" height="8" rx="1" fill="currentColor" />
      </>
    ),
    slip: (
      <>
        <rect x="2" y="5" width="30" height="5" rx="2" fill="currentColor" />
        <rect x="2" y="13" width="18" height="5" rx="2" fill="currentColor" opacity="0.55" />
        <rect x="2" y="21" width="10" height="5" rx="2" fill="currentColor" opacity="0.3" />
      </>
    ),
    late: (
      <>
        <path d="M2 14h34" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <circle cx="9" cy="14" r="2.6" fill="currentColor" />
        <circle cx="18" cy="14" r="2.6" fill="currentColor" />
        <circle cx="31" cy="14" r="2.6" fill="currentColor" opacity="0.5" />
      </>
    ),
    where: (
      <>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x={2 + i * 6} y="4" width="4" height="4" rx="1" fill="currentColor" />
            <rect x={2 + i * 6} y="10" width="4" height="4" rx="1" fill="currentColor" opacity={i < 4 ? 1 : 0.35} />
            <rect x={2 + i * 6} y="16" width="4" height="4" rx="1" fill="currentColor" opacity={i < 2 ? 1 : 0.35} />
          </g>
        ))}
      </>
    ),
    long: (
      <>
        <path d="M2 14h34" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <rect x="9" y="11" width="16" height="6" rx="3" fill="currentColor" opacity="0.5" />
        <circle cx="15" cy="14" r="3" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg className={styles.glyph} width="38" height="28" viewBox="0 0 38 28" aria-hidden="true" focusable="false">
      {shapes[id]}
    </svg>
  );
}

function Ask({
  analytics: a,
  scope,
  wallModel,
  address,
  hasWall,
}: {
  analytics: ProjectAnalytics;
  scope: AnalyticsScope;
  wallModel: WallModel | null;
  address: Address;
  hasWall: boolean;
}) {
  const questions = questionsFor(scope.kind, a);
  const hrefs = Object.fromEntries(questions.map((question) => [question.id, hrefFor(address, { part: "ask", ask: question.id })]));
  const asked = questions.find((question) => question.id === address.ask) ?? null;
  const answerScope: AnswerScope = scope.kind === "all" ? { kind: "all", wall: wallModel } : { kind: "one", standing: scope.standing };
  return (
    <>
      {a.coverage.truncated || a.coverage.columnsUnreadable ? <CoverageNotice analytics={a} /> : null}
      <AskBox
        questions={questions}
        hrefs={hrefs}
        placeholder={scope.kind === "all" ? "What do you want to know across your projects?" : `What do you want to know about ${scope.name}?`}
        helper={asked ? undefined : "Plain answers from your tasks, dates and history. Pick a question, or type to find one."}
      />
      {asked ? (
        <AnswerView answer={answerQuestion(asked.id, a, answerScope)} analytics={a} wallModel={wallModel} address={address} hasWall={hasWall} />
      ) : (
        <Starters questions={questions} hrefs={hrefs} />
      )}
      <Method analytics={a} acrossAll={scope.kind === "all"} />
    </>
  );
}

function Starters({ questions, hrefs }: { questions: readonly Question[]; hrefs: Readonly<Record<string, string>> }) {
  const groups = QUESTION_GROUPS.map((group) => ({ group, items: questions.filter((question) => question.group === group) })).filter(
    (entry) => entry.items.length > 0,
  );
  return (
    <div className={styles.starters} data-groups={groups.length}>
      {groups.map(({ group, items }, groupIndex) => {
        const id = `an-need-${groupIndex}`;
        return (
          <section key={group} className={styles.need} aria-labelledby={id}>
            <h2 id={id} className={styles.needTitle}>{group}</h2>
            {items.map((question, index) => (
              <Link
                key={question.id}
                href={hrefs[question.id]!}
                className={styles.starter}
                data-question={question.id}
                scroll={false}
                style={{ "--i": groupIndex + index * groups.length } as Vars}
              >
                <span className={styles.starterTop}>
                  <Glyph id={question.id} />
                </span>
                <span className={styles.starterQ}>{question.label}</span>
                <span className={styles.starterHint}>{question.hint}</span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function AnswerView({
  answer,
  analytics: a,
  wallModel,
  address,
  hasWall,
}: {
  answer: Answer;
  analytics: ProjectAnalytics;
  wallModel: WallModel | null;
  address: Address;
  hasWall: boolean;
}) {
  const actions = answer.actions.filter((action) => action.kind !== "projects" || hasWall);
  return (
    <>
      <section className={styles.answer} aria-labelledby="an-question">
        <div className={styles.answerNav}>
          <Link href={hrefFor(address, { ask: null })} className={styles.back} scroll={false}>
            <ShellIcon.chevronLeft size={14} />
            All questions
          </Link>
          {RANGED.has(answer.id) ? <RangeSwitch address={address} /> : null}
        </div>
        <h2 id="an-question" className={styles.question}>{answer.question}</h2>
        <Sentence answer={answer} />
        <div className={styles.actions}>
          {actions.map((action, index) => (
            <Link key={action.label} href={actionHref(action, address)} className={index === 0 ? styles.buttonPrimary : styles.button} scroll={false}>
              {action.label}
              {index === 0 ? <ShellIcon.arrowRight size={13} /> : null}
            </Link>
          ))}
        </div>
      </section>

      <AnswerCharts answer={answer} analytics={a} wallModel={wallModel} scope={address.scope} />
    </>
  );
}

function Sentence({ answer }: { answer: Answer }) {
  return (
    <p className={styles.sentence} data-answer={answer.id}>
      {answer.parts.map((part, index) =>
        part.taskId ? (
          <Link key={index} href={`/app/task/${encodeURIComponent(part.taskId)}`} className={styles.key} data-link="">
            {part.text}
          </Link>
        ) : part.strong ? (
          <strong key={index} className={styles.key} data-tone={part.tone}>
            {part.text}
          </strong>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function Figure({ id, title, meta, caption, children }: { id: string; title: string; meta?: ReactNode; caption: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <div>
          <h3 id={id} className={styles.cardTitle}>{title}</h3>
        </div>
        {meta}
      </div>
      <div className={styles.cardBody}>
        {children}
        <p className={styles.captionIn}>{caption}</p>
      </div>
    </section>
  );
}

function AnswerCharts({
  answer,
  analytics: a,
  wallModel,
  scope,
}: {
  answer: Answer;
  analytics: ProjectAnalytics;
  wallModel: WallModel | null;
  scope: "all" | "one";
}) {
  switch (answer.id) {
    case "late":
      return (
        <div className={styles.stackRows}>
          {a.late.length > 0 ? (
            <Figure id="an-late" title="Past their date" meta={<span className={styles.cardMeta}>{a.overdue.count} late</span>} caption={answer.caption}>
              <LateList analytics={a} />
            </Figure>
          ) : null}
          <div className={styles.rowTwo}>
            <DueCard analytics={a} />
            <PriorityCard analytics={a} />
          </div>
        </div>
      );
    case "week":
      return (
        <div className={styles.stackRows}>
          <Figure
            id="an-days"
            title="Finished each day"
            meta={<span className={styles.cardMeta}>{a.recent.finishedThisWeek} this week · {a.recent.finishedWeekBefore} the week before</span>}
            caption={answer.caption}
          >
            <DaysChart analytics={a} />
          </Figure>
          <div className={styles.rowTwo}>
            <FinishedCard analytics={a} />
            <ChangesCard lines={a.changes} />
          </div>
        </div>
      );
    case "who":
      return (
        <div className={styles.stackRows}>
          <PeopleCard people={a.people} phrase={a.range.phrase} caption={answer.caption} />
        </div>
      );
    case "next":
      return (
        <div className={styles.stackRows}>
          {a.next.tasks.length > 0 ? (
            <Figure
              id="an-next"
              title="Due in the next 7 days"
              meta={<span className={styles.cardMeta}>{a.next.count > a.next.tasks.length ? `The first ${a.next.tasks.length} of ${a.next.count}` : `${a.next.count} ${plural(a.next.count, "task")}`}</span>}
              caption={answer.caption}
            >
              <NextList analytics={a} />
            </Figure>
          ) : null}
          <div className={styles.rowTwo}>
            <DueCard analytics={a} />
            <PriorityCard analytics={a} />
          </div>
        </div>
      );
    case "slip":
      return (
        <div className={styles.stackRows}>
          <Figure
            id="an-moved"
            title="Dates changed more than once"
            meta={a.moved ? <span className={styles.cardMeta}>{a.moved.repeatCount} {plural(a.moved.repeatCount, "task")}</span> : null}
            caption={answer.caption}
          >
            <MovedList analytics={a} />
          </Figure>
        </div>
      );
    case "where":
      return (
        <div className={styles.stackRows}>
          <div className={styles.rowTwo}>
            <StatusCard analytics={a} />
            <PriorityCard analytics={a} />
          </div>
          <p className={styles.captionLoose}>{answer.caption}</p>
        </div>
      );
    case "long":
      return (
        <div className={styles.stackRows}>
          <div className={styles.rowMain}>
            <DurationCard analytics={a} caption={answer.caption} />
            <OnTimeCard analytics={a} />
          </div>
        </div>
      );
    default:
      return scope === "all" ? (
        <div className={styles.stackRows}>
          {wallModel && wallModel.cards.length > 0 ? (
            <Figure id="an-shape" title="Every active project" meta={<span className={styles.cardMeta}>{wallModel.cards.length} {plural(wallModel.cards.length, "project")}</span>} caption={answer.caption}>
              <ShapeList model={wallModel} />
            </Figure>
          ) : null}
          <div className={styles.rowTwo}>
            <DueCard analytics={a} />
            <ChangesCard lines={a.changes} />
          </div>
        </div>
      ) : (
        <div className={styles.stackRows}>
          <TrendCard analytics={a} caption={answer.caption} />
          <div className={styles.rowTwo}>
            <DueCard analytics={a} />
            <ChangesCard lines={a.changes} />
          </div>
        </div>
      );
  }
}

function ShapeList({ model }: { model: WallModel }) {
  return (
    <ul className={styles.shapeList}>
      {model.cards.map((card) => (
        <li key={card.id} className={styles.shapeRow} data-shape-row={card.id}>
          <span className={styles.shapeName}>
            {card.selectable ? (
              <Link href={`/app/analytics?workspaceId=${encodeURIComponent(card.id)}`} className={styles.lateName} scroll={false}>{card.name}</Link>
            ) : (
              <span className={styles.lateName}>{card.name}</span>
            )}
            <span className={styles.lateMeta}>{card.next ? `${card.next.when} · ${card.next.what}` : "No big date set"}</span>
          </span>
          <span className={styles.pill} data-tone={card.tone}>
            <WallMark mark={card.mark} />
            {card.markLabel}
          </span>
          <span className={styles.shapeDone}>
            {card.done ? (
              <>
                <span className={styles.track} role="img" aria-label={`${card.done.complete} of ${card.done.total} done`}>
                  {card.done.share > 0 ? <span className={styles.wallDoneFill} style={{ width: `${card.done.share * 100}%` }} /> : null}
                </span>
                <span className={styles.wallDoneText}>{card.done.complete} of {card.done.total}</span>
              </>
            ) : (
              <span className={styles.wallDoneText}>{card.open} open</span>
            )}
          </span>
          <span className={styles.lateDays} data-quiet={card.late === 0 ? "" : undefined}>
            {card.late} <span>late</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function NextList({ analytics: a }: { analytics: ProjectAnalytics }) {
  return (
    <ol className={styles.nextList}>
      {a.next.tasks.map((task, index) => (
        <li key={task.id} className={styles.nextRow}>
          <span className={styles.nextOrder} aria-hidden="true">{index + 1}</span>
          <span className={styles.lateText}>
            <Link href={`/app/task/${encodeURIComponent(task.id)}`} className={styles.lateName}>{task.title}</Link>
            <span className={styles.lateMeta}>
              {[task.project, task.owners.length > 0 ? task.owners.join(", ") : "No one assigned", `${PRIORITY_LABEL[task.priority].label} priority`].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className={styles.nextWhen} data-today={task.inDays === 0 ? "" : undefined}>
            {task.inDays === 0 ? "Today" : task.inDays === 1 ? "Tomorrow" : formatConsoleDay(task.due, a.today)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MovedList({ analytics: a }: { analytics: ProjectAnalytics }) {
  const moved = a.moved;
  if (!moved || moved.tasks.length === 0) {
    return (
      <p className={styles.cardEmpty}>
        {moved ? `No task had its date changed more than once in the last ${a.range.phrase}.` : "The record of date changes could not be read just now."}
      </p>
    );
  }
  const max = Math.max(...moved.tasks.map((task) => task.changes));
  return (
    <ul className={styles.lateList}>
      {moved.tasks.map((task, index) => (
        <li key={task.id} className={styles.lateRow}>
          <span className={styles.lateText}>
            <Link href={`/app/task/${encodeURIComponent(task.id)}`} className={styles.lateName}>{task.title}</Link>
            <span className={styles.lateMeta}>{[task.project, task.done ? "Finished since" : "Still open"].filter(Boolean).join(" · ")}</span>
          </span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.movedFill} style={{ width: `${(task.changes / max) * 100}%`, "--i": index } as Vars} />
          </span>
          <span className={styles.lateDays} data-plain="">
            {task.changes} <span>changes</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LateList({ analytics: a }: { analytics: ProjectAnalytics }) {
  const max = Math.max(1, ...a.late.map((task) => task.daysLate));
  return (
    <ul className={styles.lateList}>
      {a.late.map((task, index) => (
        <li key={task.id} className={styles.lateRow}>
          <span className={styles.lateText}>
            <Link href={`/app/task/${encodeURIComponent(task.id)}`} className={styles.lateName}>{task.title}</Link>
            <span className={styles.lateMeta}>
              {[task.project, `Due ${formatConsoleDay(task.due, a.today)}`, task.owners.length > 0 ? task.owners.join(", ") : "No one assigned"].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.lateFill} style={{ width: `${Math.max((task.daysLate / max) * 100, 3)}%`, "--i": index } as Vars} />
          </span>
          <span className={styles.lateDays}>
            {task.daysLate} <span>{plural(task.daysLate, "day")} late</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

function DaysChart({ analytics: a }: { analytics: ProjectAnalytics }) {
  const days = a.recent.days;
  const top = Math.max(1, ...days.map((day) => day.finished));
  const summary = days
    .filter((day) => day.thisWeek)
    .map((day) => `${day.isToday ? "Today" : formatConsoleDay(day.date, a.today)} ${day.finished}`)
    .join(", ");
  return (
    <div className={styles.days} role="img" aria-label={`Tasks finished each day in the last 7 days: ${summary}.`}>
      {days.map((day, index) => (
        <div
          key={day.date}
          className={styles.day}
          data-before={day.thisWeek ? undefined : ""}
          data-today={day.isToday ? "" : undefined}
          data-split={index === 7 ? "" : undefined}
          title={`${day.isToday ? "Today" : formatConsoleDay(day.date, a.today)}: ${day.finished} finished`}
        >
          <div className={styles.dayPlot}>
            {day.finished > 0 ? (
              <span className={styles.dayBar} style={{ height: `${(day.finished / top) * 100}%`, "--i": index } as Vars}>
                <span className={styles.dayValue}>{day.finished}</span>
              </span>
            ) : (
              <span className={styles.dueZero} />
            )}
          </div>
          <span className={styles.dayLabel}>
            {WEEKDAY_LETTER[day.weekday]}
            <b>{day.isToday ? "Today" : Number(day.date.slice(8))}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function FinishedCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const { finished, finishedThisWeek } = a.recent;
  return (
    <Card
      id="an-finished"
      title="Finished in the last 7 days"
      sub={finishedThisWeek > finished.length ? `The latest ${finished.length} of ${finishedThisWeek}.` : "Latest first."}
      meta={<span className={styles.cardMeta}>{finishedThisWeek} {plural(finishedThisWeek, "task")}</span>}
    >
      {finished.length === 0 ? (
        <p className={styles.cardEmpty}>Nothing was finished in the last 7 days.</p>
      ) : (
        <ul className={styles.doneList}>
          {finished.map((task) => (
            <li key={task.id}>
              <span className={styles.doneTick} aria-hidden="true">
                <ShellIcon.checkCircle size={14} />
              </span>
              <Link href={`/app/task/${encodeURIComponent(task.id)}`} className={styles.doneName}>{task.title}</Link>
              <span className={styles.doneWhen}>{formatConsoleDay(task.date, a.today)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OnTimeCard({ analytics: a }: { analytics: ProjectAnalytics }) {
  const { rate, onTime, dated, previousRate } = a.onTime;
  const median = a.timeToFinish.medianDays;
  const previous = a.timeToFinish.previousMedianDays;
  return (
    <Card id="an-ontime" title="On time" sub={`Tasks with a due date, finished in the last ${a.range.phrase}.`}>
      {rate == null && median == null ? (
        <p className={styles.cardEmpty}>Shows once tasks are finished in this period.</p>
      ) : (
        <dl className={styles.facts}>
          {rate != null ? (
            <div>
              <dt>Finished on or before the due date</dt>
              <dd>
                {onTime} of {dated}
                <span>{Math.round(rate * 100)}%</span>
              </dd>
            </div>
          ) : (
            <div>
              <dt>Finished on or before the due date</dt>
              <dd>
                <span>No dated task finished</span>
              </dd>
            </div>
          )}
          {previousRate != null ? (
            <div>
              <dt>On time in the {a.range.phrase} before</dt>
              <dd>
                <span>{Math.round(previousRate * 100)}%</span>
              </dd>
            </div>
          ) : null}
          {median != null ? (
            <div>
              <dt>Half were finished within</dt>
              <dd>{formatDays(median).toLowerCase()}</dd>
            </div>
          ) : null}
          {previous != null ? (
            <div>
              <dt>Half, in the {a.range.phrase} before</dt>
              <dd>{formatDays(previous).toLowerCase()}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </Card>
  );
}

// ── Range ────────────────────────────────────────────────────────────────

function RangeSwitch({ address }: { address: Address }) {
  return (
    <nav className={styles.range} aria-label="Time range">
      {ANALYTICS_RANGES.map((range) => (
        <Link
          key={range.key}
          href={hrefFor(address, { range: range.key })}
          aria-current={range.key === address.range ? "page" : undefined}
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

// ── Every project ────────────────────────────────────────────────────────

function WallMark({ mark }: { mark: ConsoleMark }) {
  return (
    <svg className={styles.mark} width={13} height={13} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {mark === "on_track" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : mark === "at_risk" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
        </>
      ) : mark === "past_date" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.6v3.9M8 11v.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : mark === "paused" ? (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 5.6v4.8M9.6 5.6v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />
      )}
    </svg>
  );
}

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${[...words[0]!][0] ?? ""}${[...words[1]!][0] ?? ""}` : [...(words[0] ?? "")].slice(0, 2).join("");
  return letters.toUpperCase();
}

/** A fixed tile hue per Project, from the calm half of the project palette. */
const TILE_HUES = ["var(--v3-project-1)", "var(--v3-project-2)", "var(--v3-project-3)", "var(--v3-project-4)", "var(--v3-project-9)"];

function tileHue(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return TILE_HUES[hash % TILE_HUES.length]!;
}

function Wall({ wall, model, address }: { wall: AnalyticsWall; model: WallModel | null; address: Address }) {
  if (wall.kind === "unavailable" || !model) {
    return (
      <section className={styles.empty} role="status">
        <span className={styles.emptyIcon} aria-hidden="true">
          <ShellIcon.alert size={20} />
        </span>
        <h2 className={styles.emptyTitle}>Your projects could not be listed just now</h2>
        <p className={styles.emptyBody}>Nothing was changed. Try again in a moment, or go back to the questions.</p>
        <Link href={hrefFor(address, { part: "ask", ask: null })} className={styles.buttonPrimary}>
          Back to Ask
        </Link>
      </section>
    );
  }
  if (model.cards.length === 0) {
    return (
      <section className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <ShellIcon.projects size={20} />
        </span>
        <h2 className={styles.emptyTitle}>No active projects</h2>
        <p className={styles.emptyBody}>
          {model.wrapped > 0
            ? `${model.wrapped} ${plural(model.wrapped, "project is", "projects are")} wrapped. Wrapped projects rest on the Projects page.`
            : "Start a project and its card appears here."}
        </p>
        <Link href="/app/project" className={styles.buttonPrimary}>
          See projects
        </Link>
      </section>
    );
  }
  return (
    <>
      <div className={styles.wallBar}>
        <span className={styles.wallSortLabel} id="an-sort">Sort</span>
        <nav className={styles.range} aria-labelledby="an-sort">
          {WALL_SORTS.map((sort) => (
            <Link
              key={sort.id}
              href={hrefFor(address, { sort: sort.id })}
              aria-current={sort.id === address.sort ? "page" : undefined}
              scroll={false}
              replace
            >
              {sort.label}
            </Link>
          ))}
        </nav>
        {model.weekLine ? <p className={styles.wallLine}>{model.weekLine}</p> : null}
      </div>
      {wall.statsUnavailable || wall.truncated ? (
        <p className={styles.notice} role="note">
          <ShellIcon.alert size={14} />
          <span>
            {wall.statsUnavailable ? "Task counts could not be read just now, so the cards show open tasks only. " : ""}
            {wall.truncated ? "You belong to more projects than one page lists, so some are not shown." : ""}
          </span>
        </p>
      ) : null}
      <ul className={styles.wall}>
        {model.cards.map((card, index) => (
          <li key={card.id} style={{ "--i": Math.min(index, 12) } as Vars}>
            <ProjectCard card={card} />
          </li>
        ))}
      </ul>
      {model.wrapped > 0 ? (
        <p className={styles.captionLoose}>
          {model.wrapped} wrapped {plural(model.wrapped, "project is", "projects are")} not shown here.{" "}
          <Link href="/app/project?show=wrapped" className={styles.inlineLink}>See them on Projects</Link>
        </p>
      ) : null}
    </>
  );
}

function ProjectCard({ card }: { card: WallCard }) {
  const href = card.selectable ? `/app/analytics?workspaceId=${encodeURIComponent(card.id)}` : null;
  const titleId = `an-wall-${card.id}`;
  return (
    <article className={styles.wallCard} aria-labelledby={titleId} data-wall-card={card.id}>
      <header className={styles.wallHead}>
        <span className={styles.tile} style={{ backgroundColor: tileHue(card.id) }} aria-hidden="true">
          {monogram(card.name)}
        </span>
        <span className={styles.wallTitle}>
          <h2 id={titleId} className={styles.wallName}>
            {href ? <Link href={href}>{card.name}</Link> : card.name}
          </h2>
          <span className={styles.wallLead}>{card.blockedReason && !card.selectable ? card.blockedReason : card.lead ?? "Owner not shown"}</span>
        </span>
      </header>

      <p className={styles.wallState}>
        <span className={styles.pill} data-tone={card.tone}>
          <WallMark mark={card.mark} />
          {card.markLabel}
        </span>
        {card.next ? (
          <span className={styles.wallNext} data-late={card.next.late ? "" : undefined}>
            <b>{card.next.when}</b>
            <span>{card.next.what}</span>
          </span>
        ) : (
          <span className={styles.wallNext}>
            <span>No big date set</span>
          </span>
        )}
      </p>

      {card.week ? (
        <div className={styles.wallChart}>
          <span className={styles.wallChartLabel}>Finished each day, last 14 days</span>
          <div
            className={styles.miniDays}
            role="img"
            aria-label={`${card.week.done} finished in the last 7 days, ${card.week.before} the week before`}
          >
            {card.week.days.map((count, index) => (
              <span
                key={index}
                data-before={index < 7 ? "" : undefined}
                data-zero={count === 0 ? "" : undefined}
                style={count === 0 ? undefined : { height: `${Math.max((count / card.week!.top) * 100, 12)}%` }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {card.done ? (
        <div className={styles.wallDone}>
          <span className={styles.track} role="img" aria-label={`${card.done.complete} of ${card.done.total} done`}>
            {card.done.share > 0 ? <span className={styles.wallDoneFill} style={{ width: `${card.done.share * 100}%` }} /> : null}
          </span>
          <span className={styles.wallDoneText}>
            {card.done.total === 0 ? "No tasks yet" : `${card.done.complete} of ${card.done.total} done`}
          </span>
        </div>
      ) : null}

      <dl className={styles.wallFigures}>
        <div>
          <dt>Open</dt>
          <dd>{card.open}</dd>
        </div>
        <div data-tone={card.late > 0 ? "late" : undefined}>
          <dt>Late</dt>
          <dd>{card.late}</dd>
        </div>
        {card.week ? (
          <div>
            <dt>Done in the last 7 days</dt>
            <dd>{card.week.done}</dd>
          </div>
        ) : null}
      </dl>
      {card.oldestLate ? <p className={styles.wallOldest}>Oldest late: {card.oldestLate}</p> : null}

      {href ? (
        <footer className={styles.wallFoot}>
          <Link href={href} className={styles.cardLink}>
            Ask about it <span aria-hidden="true">→</span>
          </Link>
          <Link href={`/app/tasks?workspaceId=${encodeURIComponent(card.id)}`} className={styles.cardLink}>
            Open its tasks
          </Link>
        </footer>
      ) : null}
    </article>
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
          <h3 id={id} className={styles.cardTitle}>{title}</h3>
          {sub ? <p className={styles.cardSub}>{sub}</p> : null}
        </div>
        {meta}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

function TrendCard({ analytics: a, caption }: { analytics: ProjectAnalytics; caption: string }) {
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
      <p className={styles.captionIn}>{caption}</p>
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
          <h3 id="an-changes" className={styles.cardTitle}>What changed this week</h3>
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

function PeopleCard({ people, phrase, caption }: { people: readonly PersonLoad[]; phrase: string; caption: string }) {
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
          <p className={styles.captionIn}>{caption}</p>
        </>
      )}
    </Card>
  );
}

function DurationCard({ analytics: a, caption }: { analytics: ProjectAnalytics; caption: string }) {
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
          <p className={styles.captionIn}>{caption}</p>
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

function Method({ analytics: a, acrossAll }: { analytics: ProjectAnalytics; acrossAll: boolean }) {
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
        <li>People are named only while they belong to the project a task is in. Anyone else still assigned shows as a former member.</li>
        {a.moved ? (
          <li>Date changes come from the record kept beside each task. It counts each time a due date was set or changed, not how far it moved or why.</li>
        ) : null}
        {acrossAll ? <li>Across every project, each project&rsquo;s own finished column decides what is done, and only active projects you can open are counted.</li> : null}
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

function AnalyticsEmpty({ acrossAll }: { acrossAll: boolean }) {
  return (
    <section className={styles.empty}>
      <EmptyArt />
      <h2 className={styles.emptyTitle}>Nothing to measure yet</h2>
      <p className={styles.emptyBody}>
        {acrossAll
          ? "Analytics fills in from your projects’ tasks. Add a few, finish one, and the first answers appear here."
          : "Analytics fills in from this project’s tasks. Add a few, finish one, and the first answers appear here."}
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
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Analytics</h1>
          </div>
          <p className={styles.summary}>
            <span>Choose a project to see how its work is moving.</span>
          </p>
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
