import Link from "next/link";
import { ShellIcon } from "@/components/shell/shell-icons";
import { CREATE_PROJECT_HREF } from "@/lib/shell-create";
import { MESSAGES_APP_PATH, PRODUCT_APP_PATHS, PROJECT_APP_PATH } from "@/lib/product-urls";
import type { HomeBento, StartFigure } from "@/lib/home/home-bento";
import { ActivityCard } from "./activity-card";
import { EnterOnce } from "./enter-once";
import { LaunchCard } from "./launch-card";
import { WeekCard } from "./week-card";
import styles from "./home-bento.module.css";

/**
 * Home (20 October 2026): the authenticated front door.
 *
 * Greeting, then four sections in a fixed order: four start cards, the
 * launch countdown and done this week side by side, then a year of activity.
 * Every figure comes from one model (`buildHomeBento`), so no two sections
 * can disagree. Server component; the charts are client islands.
 */
export function HomeBentoView({ model }: { model: HomeBento }) {
  const newUser = !model.hasProjects;
  return (
    <div className={`${styles.page} thin-scroll`}>
      <EnterOnce className={styles.inner} enterClass={styles.enter}>
        <header className={styles.head}>
          <h1 className={styles.h1}>{newUser ? "Welcome to Signal Studio" : model.greeting}</h1>
          {newUser ? (
            <p className={styles.welcome}>This is Home. It fills in as you add projects and finish tasks.</p>
          ) : (
            <p className={styles.date}>{model.dateLabel}</p>
          )}
        </header>
        <div className={styles.bento}>
          <section className={styles.cards} aria-label="Start something">
            <StartCard
              icon={<ShellIcon.tasks />}
              figure={model.start.tasks}
              empty="No tasks yet. Add your first."
              noun="Tasks"
              viewHref={PRODUCT_APP_PATHS.tasks}
              viewLabel={(n) => `View ${n} open tasks`}
              action="New task"
              actionHref={`${PRODUCT_APP_PATHS.tasks}?create=task`}
              newUser={newUser}
            />
            <StartCard
              icon={<ShellIcon.projects />}
              figure={model.start.projects}
              empty="Start one for each big piece of work"
              noun="Projects"
              viewHref={PROJECT_APP_PATH}
              viewLabel={(n) => `View ${n} active projects`}
              action="New project"
              actionHref={CREATE_PROJECT_HREF}
              newUser={newUser}
            />
            <StartCard
              icon={<ShellIcon.files />}
              figure={model.start.files}
              empty="Keep briefs and drafts in one place"
              noun="Files"
              viewHref="/app/files"
              viewLabel={(n) => `View files, ${n} added in the last 30 days`}
              action="Upload file"
              actionHref="/app/files"
              newUser={newUser}
            />
            {model.start.chatAvailable ? (
              <StartCard
                icon={<ShellIcon.messages />}
                figure={model.start.chat}
                empty="Talk it through with your team"
                noun="Chat"
              viewHref={MESSAGES_APP_PATH}
                viewLabel={(n) => `View ${n} new mentions and replies`}
                action="Start chat"
                actionHref={MESSAGES_APP_PATH}
                newUser={newUser}
              />
            ) : (
              <StartCard
                icon={<ShellIcon.notes />}
                figure={null}
                empty="Capture the thinking before it becomes tasks"
                noun="Notes"
              viewHref={PRODUCT_APP_PATHS.notes}
                viewLabel={() => "Open Notes"}
                action="New note"
                actionHref={PRODUCT_APP_PATHS.notes}
                newUser
              />
            )}
          </section>
          <LaunchCard launches={model.launches} hasProjects={model.hasProjects} projectsHref={PROJECT_APP_PATH} createProjectHref="/welcome" />
          <WeekCard week={model.week} historyKnown={model.historyKnown} hasProjects={model.hasProjects} dueThisWeek={model.dueThisWeekTotal} />
          <ActivityCard activity={model.activity} historyKnown={model.historyKnown} hasProjects={model.hasProjects} />
        </div>
      </EnterOnce>
    </div>
  );
}

function StartCard({
  icon,
  figure,
  empty,
  noun,
  viewHref,
  viewLabel,
  action,
  actionHref,
  newUser,
}: Readonly<{
  icon: React.ReactNode;
  figure: StartFigure;
  empty: string;
  noun: string;
  viewHref: string;
  viewLabel: (n: number) => string;
  action: string;
  actionHref: string;
  newUser: boolean;
}>) {
  const known = figure !== null;
  const value = known && !newUser ? figure.value : newUser ? 0 : null;
  return (
    <div className={styles.card}>
      <Link className={styles.cardLink} href={viewHref} aria-label={value === null ? `Open ${noun}. The count could not be read just now` : viewLabel(value)}>
        <span className={styles.cardIcon} aria-hidden>
          {icon}
        </span>
        <span className={styles.cardKpi}>
          <b>{value ?? "–"}</b>
          <span>
            {newUser ? empty : known ? figure.caption : "could not be read just now"}
            <span className={styles.chev} aria-hidden>
              ›
            </span>
          </span>
        </span>
      </Link>
      <Link className={styles.cardGo} href={actionHref}>
        {action}
        <ShellIcon.arrowRight />
      </Link>
    </div>
  );
}

/** The page could not read its Projects. Nothing is guessed; the way into Tasks stays open. */
export function HomeBentoUnavailable() {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <h1 className={styles.h1}>Home could not read your work just now</h1>
          <p className={styles.welcome}>Nothing has changed. Try again in a moment, or go straight to your tasks.</p>
        </header>
        <Link className={`${styles.btn} ${styles.btnPrimary}`} href={PRODUCT_APP_PATHS.tasks}>
          Open Tasks
        </Link>
      </div>
    </div>
  );
}
