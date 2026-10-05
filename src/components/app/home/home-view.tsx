import Link from "next/link";
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { buildProjectUrl } from "@/lib/projects/project-url";
import type { HomeData } from "@/app/app/home/home-data";
import { ShellIcon } from "@/components/shell/shell-icons";
import { isDemoMode } from "@/lib/access-mode";
import { greetingForHour } from "@/lib/home/home-board";
import { loadHomeBoard } from "@/server/home/home-board-read";
import { HomeBoardView } from "./home-board";
import { HomeTabs } from "./home-tabs";
import styles from "./home.module.css";

/**
 * Home v3 (5 October 2026): the authenticated front door, opening on what
 * needs the reader today.
 *
 * The route still decides who may be here and which Project the chrome names
 * (`HomeData`, from the one authorized briefing read). The page itself is
 * drawn from `loadHomeBoard`: the reader's own late and due-today work, what
 * is waiting, the next big day and every Project they can open, all from the
 * same authorized Project list the Projects page reads.
 *
 * Server component. Ticking a task, Undo and Nudge live in `home-board.tsx`.
 */
type OkHome = Extract<HomeData, { kind: "ok" }>;

export async function HomeView({ data }: { data: OkHome }) {
  const board = await loadHomeBoard();
  if (!board) return <HomeBoardUnavailable overviewHref={data.briefingHref} />;
  return (
    <HomeBoardView
      board={board}
      overviewHref={data.briefingHref}
      // Review runs on a pinned morning, so its greeting is pinned with it.
      pinnedGreeting={isDemoMode() ? greetingForHour(9) : null}
    />
  );
}

/** The Project list could not be read. Nothing is guessed; the ways on stay open. */
function HomeBoardUnavailable({ overviewHref }: { overviewHref: string }) {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.tabsRow}>
          <HomeTabs current="home" overviewHref={overviewHref} />
        </div>
        <div className={styles.centered}>
          <h1 className={styles.h1}>Home could not read your work just now</h1>
          <p className={styles.centeredText}>Nothing has changed. Try again in a moment, or go straight to your tasks.</p>
          <div className={styles.centeredActions}>
            <Link className={styles.primary} href="/app/tasks">
              Open Tasks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tasks proved this Project exists, but Signal could not read its Home yet. */
export function HomeProjectUnavailable({ project }: { project: ProjectSummary }) {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.centered}>
          <h1 className={styles.h1}>Home is not ready yet</h1>
          <p className={styles.centeredText}>
            We could not read {project.name} for Home right now. Your project is still there in Tasks.
          </p>
          <div className={styles.centeredActions}>
            <Link className={styles.primary} href={buildProjectUrl({ surface: "tasks" }, project.id)}>
              Open Tasks
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
          <h1 className={styles.h1}>Welcome to Signal Studio</h1>
          <p className={styles.centeredText}>
            Home shows what needs you across your work, and it fills as your work does. Set up your workspace to begin.
          </p>
          <div className={styles.centeredActions}>
            <Link href="/welcome" className={styles.primary}>
              Set up your workspace
            </Link>
          </div>
          <ul className={styles.productList}>
            {products.map((product) => (
              <li key={product.href}>
                <Link href={product.href} className={styles.productLink}>
                  <span className={styles.productIcon}>{product.icon}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.productName}>{product.name}</span>
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
