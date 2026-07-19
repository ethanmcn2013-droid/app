"use client";

// The workspace brief header from the approved Option-B design lab, extracted
// into its own module so the hybrid interior can use it without pulling in the
// full Option-B shell (product rail, projects sidebar) that production replaces
// with its own chrome. Renders the real workspace name from DomainProvider.

import { useDomain } from "@/lib/domain-context";
import { isTaskOverdue } from "../../dates";
import { useLabStore } from "../../store";
import type { LabTask } from "../../types";
import { Icon } from "../../shared/icons";
import { TaskOpenButton } from "../../shared/task-ui";
import styles from "./option-b.module.css";

/** Pull the part of the workspace title before " · " for the H1. */
function shortenWorkspaceTitle(value: string): string {
  const index = value.indexOf(" · ");
  return index > 0 ? value.slice(0, index) : value;
}

export function WorkspaceBrief({ tasks, showMilestones = true }: { tasks: LabTask[]; showMilestones?: boolean }) {
  const store = useLabStore();
  const domain = useDomain();
  const workspaceName = domain.boardName ?? shortenWorkspaceTitle(domain.workspaceTitle);
  const completed = store.tasks.filter((task) => task.completed).length;
  const overdue = store.tasks.filter(isTaskOverdue).length;
  const unscheduled = store.tasks.filter((task) => task.schedule.kind === "unscheduled").length;
  const milestones = store.tasks.filter((task) => task.schedule.kind === "milestone").sort((a, b) => {
    const aDate = a.schedule.kind === "milestone" ? a.schedule.on : "";
    const bDate = b.schedule.kind === "milestone" ? b.schedule.on : "";
    return aDate.localeCompare(bDate);
  }).slice(0, 3);
  const progress = store.tasks.length === 0 ? 0 : Math.round((completed / store.tasks.length) * 100);
  return (
    <header className={styles.workspaceBrief} data-milestones={showMilestones ? undefined : "off"}>
      <div className={styles.workspaceIdentity}>
        <div className={styles.workspacePath}><span>Workspace</span><Icon name="chevron-right" size={12} /><strong>{workspaceName}</strong></div>
        <h1>{workspaceName}</h1>
        <p>Everything for this workspace in one view. Every task should leave a clear next handoff.</p>
        <div className={styles.workspaceMeta}><span>{store.tasks.length} tasks</span><span>{completed} complete</span>{overdue > 0 ? <span>{overdue} overdue</span> : null}</div>
      </div>
      <section aria-label="Workspace progress" className={styles.workspaceProgress}>
        <div><span>Progress</span><strong>{progress}%</strong></div>
        <progress aria-label={`${completed} of ${store.tasks.length} tasks complete`} max={Math.max(1, store.tasks.length)} value={completed} />
        <dl>
          <div><dt>Complete</dt><dd>{completed}/{store.tasks.length}</dd></div>
          <div><dt>Overdue</dt><dd data-alert={overdue > 0 || undefined}>{overdue}</dd></div>
          <div><dt>No date</dt><dd>{unscheduled}</dd></div>
        </dl>
      </section>
      {showMilestones ? <section aria-label="Milestones" className={styles.workspaceMilestones}>
        <span>Milestones</span>
        <ol>
          {milestones.map((task) => <li data-task-id={task.id} key={task.id}><time dateTime={task.schedule.kind === "milestone" ? task.schedule.on : undefined}>{task.schedule.kind === "milestone" ? task.schedule.on.slice(5).replace("-", "/") : ""}</time><TaskOpenButton task={task} /></li>)}
          {milestones.length === 0 ? <li><time>No date</time><strong>No milestones yet</strong></li> : null}
        </ol>
        {tasks.length !== store.tasks.length ? <small>{tasks.length} of {store.tasks.length} tasks in the current view</small> : <small>Purpose, progress, and commitments stay in view.</small>}
      </section> : null}
    </header>
  );
}
