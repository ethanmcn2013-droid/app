import Link from "next/link";
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { buildProjectUrl } from "@/lib/projects/project-url";
import type {
  HomeData,
  HomeDeadlineGroup,
  HomeReviewRow,
  HomeStats,
  HomeTaskRow,
} from "@/app/app/home/home-data";
import { ShellIcon } from "@/components/shell/shell-icons";
import { isDemoMode } from "@/lib/access-mode";
import { HomeViewedPing } from "./home-analytics";
import { HomeGreeting } from "./home-greeting";
import styles from "./home.module.css";

/**
 * Home v3: the authenticated front door, as a working dashboard.
 *
 * Laid out the way people scan their work: the numbers first, then the tasks
 * in motion, with deadlines and reviews alongside. The full read across the
 * Project lives in Overview. Every figure is derived from the same authorized
 * briefing read; nothing is invented.
 *
 * Server component. The only client JS is the analytics ping and per-row
 * open events (no content in payloads).
 */
type OkHome = Extract<HomeData, { kind: "ok" }>;

const LANE_LABEL: Record<HomeTaskRow["lane"], string> = {
  next: "To do",
  "in-flight": "In progress",
  review: "In review",
  shipped: "Done",
};

const LANE_TONE: Partial<Record<HomeTaskRow["lane"], string>> = {
  "in-flight": "warning",
  review: "review",
};

export function HomeView({ data }: { data: OkHome }) {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <HomeViewedPing />
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{formatDateLabel(data.dateLabel)}</p>
            <h1 className={styles.title}>
              <HomeGreeting serverGreeting={data.greeting} pinned={isDemoMode()} />
            </h1>
            <p className={styles.subtitle}>{summaryLine(data.stats, data.scopeLabel)}</p>
          </div>
          <div className={styles.actions}>
            <Link href={data.briefingHref} className={styles.button}>
              <ShellIcon.overview size={14} />
              Overview
            </Link>
            <Link href="/app/tasks?create=task" className={styles.buttonPrimary}>
              <ShellIcon.plus size={14} />
              New task
            </Link>
          </div>
        </header>

        <Stats stats={data.stats} />

        <div className={styles.grid}>
          <div className={styles.column}>
            <MyTasks rows={data.myTasks} total={data.stats.open} />
          </div>
          <div className={styles.column}>
            <Deadlines groups={data.deadlines} />
            {data.needsReview.length > 0 ? <NeedsReview rows={data.needsReview} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "WEDNESDAY 24 SEPTEMBER" from the loader reads as shouting here. */
function formatDateLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_match, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
}

function summaryLine(stats: HomeStats, scopeLabel: string): string {
  if (stats.overdue > 0 && stats.dueToday > 0) {
    return `${scopeLabel} · ${stats.dueToday} due today and ${stats.overdue} overdue.`;
  }
  if (stats.overdue > 0) return `${scopeLabel} · ${stats.overdue} ${stats.overdue === 1 ? "task is" : "tasks are"} overdue.`;
  if (stats.dueToday > 0) return `${scopeLabel} · ${stats.dueToday} ${stats.dueToday === 1 ? "task is" : "tasks are"} due today.`;
  return `${scopeLabel} · Nothing is due today.`;
}

function Stats({ stats }: { stats: HomeStats }) {
  const items = [
    { label: "Open tasks", value: stats.open, note: `${stats.inReview} in review`, icon: <ShellIcon.layers size={14} />, tone: "accent" },
    { label: "Due today", value: stats.dueToday, note: stats.dueToday === 0 ? "A clear day" : "Worth a look first", icon: <ShellIcon.clock size={14} />, tone: undefined },
    { label: "Overdue", value: stats.overdue, note: stats.overdue === 0 ? "Nothing slipped" : "Past their date", icon: <ShellIcon.alert size={14} />, tone: stats.overdue > 0 ? "danger" : undefined },
    { label: "Done this week", value: stats.doneThisWeek, note: "Last 7 days", icon: <ShellIcon.checkCircle size={14} />, tone: "success" },
  ];
  return (
    <section className={styles.stats} aria-label="At a glance">
      {items.map((item) => (
        <Link key={item.label} href="/app/tasks" className={styles.stat}>
          <span className={styles.statTop}>
            {item.label}
            <span className={styles.statIcon} data-tone={item.tone}>{item.icon}</span>
          </span>
          <span className={styles.statValue}>{item.value}</span>
          <span className={styles.statNote}>{item.note}</span>
        </Link>
      ))}
    </section>
  );
}

function TaskRow({ row, showLane = true }: { row: HomeTaskRow; showLane?: boolean }) {
  return (
    <Link href={row.href} className={styles.row}>
      <span className={styles.check} data-lane={row.lane} aria-hidden="true" />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{row.title}</span>
        <span className={styles.rowMeta}>
          {row.source}
          {row.priority >= 3 ? " · Urgent" : row.priority === 2 ? " · High priority" : ""}
        </span>
      </span>
      {showLane ? (
        <span className={styles.laneCell}>
          <span className={styles.pill} data-tone={LANE_TONE[row.lane]}>{LANE_LABEL[row.lane]}</span>
        </span>
      ) : null}
      <span className={styles.due} data-overdue={row.overdue ? "" : undefined}>
        {row.due ?? "No date"}
      </span>
    </Link>
  );
}

function MyTasks({ rows, total }: { rows: HomeTaskRow[]; total: number }) {
  return (
    <section className={styles.card} aria-labelledby="my-tasks">
      <div className={styles.cardHead}>
        <h2 id="my-tasks" className={styles.cardTitle}>
          My tasks <span className={styles.cardCount}>{total}</span>
        </h2>
        <Link href="/app/tasks" className={styles.cardLink}>
          Open board <span aria-hidden="true">→</span>
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>No open tasks. Add one when something needs doing.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.id}>
              <TaskRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Deadlines({ groups }: { groups: HomeDeadlineGroup[] }) {
  return (
    <section className={styles.card} aria-labelledby="deadlines">
      <div className={styles.cardHead}>
        <h2 id="deadlines" className={styles.cardTitle}>Upcoming deadlines</h2>
        <Link href="/app/timeline" className={styles.cardLink}>
          Timeline <span aria-hidden="true">→</span>
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className={styles.empty}>Nothing dated in the next two weeks.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel} data-tone={group.label === "Overdue" ? "danger" : undefined}>
              {group.label}
            </p>
            <ul className={styles.list}>
              {group.rows.map((row) => (
                <li key={row.id}>
                  <TaskRow row={row} showLane={false} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function NeedsReview({ rows }: { rows: HomeReviewRow[] }) {
  return (
    <section className={styles.card} aria-labelledby="needs-review">
      <div className={styles.cardHead}>
        <h2 id="needs-review" className={styles.cardTitle}>Needs review</h2>
      </div>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={row.href} className={styles.row}>
              <span className={styles.check} data-lane="review" aria-hidden="true" />
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{row.title}</span>
                <span className={styles.rowMeta}>{row.source}</span>
              </span>
              <span className={styles.pill} data-tone="review">
                {row.idleDays > 0 ? `Waiting ${row.idleDays}d` : "In review"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tasks proved this Project exists, but Signal could not read its Home yet. */
export function HomeProjectUnavailable({ project }: { project: ProjectSummary }) {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.centered}>
          <h1 className={styles.title}>Home isn’t ready yet.</h1>
          <p className={styles.subtitle}>
            We couldn’t read {project.name} for Home right now. Your project is still available in Tasks.
          </p>
          <div className={styles.actions} style={{ marginTop: 24 }}>
            <Link className={styles.buttonPrimary} href={buildProjectUrl({ surface: "tasks" }, project.id)}>
              Open Tasks <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * New-user Home: no workspace connected yet. Welcoming, not empty:
 * points at the guided setup and the three products.
 */
export function HomeNewUser() {
  const products = [
    { href: "/app/notes", name: "Notes", line: "Capture the thinking.", icon: <ShellIcon.notes /> },
    { href: "/app/tasks", name: "Tasks", line: "Move the work forward.", icon: <ShellIcon.tasks /> },
    { href: "/app/timeline", name: "Timeline", line: "Make the plan visible.", icon: <ShellIcon.timeline /> },
  ];
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.centered}>
          <h1 className={styles.title}>Welcome to Signal Studio.</h1>
          <p className={styles.subtitle}>
            Home shows what matters across your work, and it fills as your work does. Set up your workspace to begin.
          </p>
          <div className={styles.actions} style={{ marginTop: 24 }}>
            <Link href="/welcome" className={styles.buttonPrimary}>
              Set up your workspace <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className={styles.productList}>
            {products.map((product) => (
              <li key={product.href}>
                <Link href={product.href} className={styles.productLink}>
                  <span className={styles.productIcon}>{product.icon}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{product.name}</span>
                    <span className={styles.rowMeta}>{product.line}</span>
                  </span>
                  <ShellIcon.arrowRight />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
