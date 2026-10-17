"use client";

import { useMemo, useState } from "react";
import type { DirectionProps, ReviewProject, ReviewTask } from "../data";
import styles from "./direction.module.css";

type Filter = "today" | "week" | "all";

type CalendarItem =
  | { kind: "task"; date: string; task: ReviewTask }
  | { kind: "milestone"; date: string; project: ReviewProject };

function dayLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function shortDay(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function taskLabel(task: ReviewTask): string {
  if (task.timing === "Late") return "Past due";
  if (task.timing === "Today") return "Today";
  return task.due;
}

function completionCopy(project: ReviewProject): string {
  if (project.completed === null || project.total === null) {
    return "Task completion not assessed yet.";
  }
  return `${project.completed} of ${project.total} tasks complete.`;
}

function SurfaceNav({ surface, onNavigate }: Pick<DirectionProps, "surface" | "onNavigate">) {
  return (
    <nav className={styles.surfaceNav} aria-label="Review another view">
      <button type="button" aria-current={surface === "home" ? "page" : undefined} onClick={() => onNavigate("home")}>Home</button>
      <button type="button" aria-current={surface === "projects" ? "page" : undefined} onClick={() => onNavigate("projects")}>Projects</button>
    </nav>
  );
}

function TaskButton({ task, onOpen }: { task: ReviewTask; onOpen: (id: string) => void }) {
  return (
    <button className={styles.taskRow} type="button" onClick={() => onOpen(task.id)}>
      <span className={styles.taskCopy}>
        <span className={styles.taskTitle}>{task.title}</span>
        <span className={styles.taskContext}>{task.context}</span>
        <span className={styles.taskOwner}>{task.owner === "You" ? "For you" : `With ${task.owner}`}</span>
      </span>
      <span className={styles.taskDue}>{taskLabel(task)}</span>
    </button>
  );
}

function HomeView({ props }: { props: DirectionProps }) {
  const { data, onOpenTask, onOpenProject } = props;
  const [filter, setFilter] = useState<Filter>("week");
  const overdue = data.tasks.filter((task) => task.timing === "Late");
  const waiting = data.tasks.filter((task) => task.timing === "Waiting");
  const today = data.tasks.filter((task) => task.timing === "Today");

  const calendar = useMemo(() => {
    const items: CalendarItem[] = [
      ...data.tasks.flatMap((task) => task.dueDate ? [{ kind: "task" as const, date: task.dueDate, task }] : []),
      ...data.projects.flatMap((project) => project.nextDate ? [{ kind: "milestone" as const, date: project.nextDate, project }] : []),
    ];
    return items
      .filter((item) => {
        if (filter === "all") return true;
        if (filter === "today") return item.date === data.today;
        return item.date >= data.today && item.date <= "2026-10-24";
      })
      .sort((a, b) => a.date.localeCompare(b.date) || Number(a.kind === "milestone") - Number(b.kind === "milestone"));
  }, [data.projects, data.tasks, data.today, filter]);

  const days = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>();
    for (const item of calendar) groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
    return [...groups.entries()];
  }, [calendar]);

  if (data.projects.length === 0 && data.tasks.length === 0) {
    return (
      <div className={styles.canvas}>
        <header className={styles.header}><div><h1>A little room ahead</h1><p className={styles.intro}>Your dates and next steps will gather here when work is added.</p><span className={styles.dateStamp}>Sunday · 18 October 2026</span></div><SurfaceNav surface="home" onNavigate={props.onNavigate} /></header>
        <section className={styles.emptyState}><span className={styles.emptyDate}>18</span><div><h2>Nothing scheduled yet</h2><p>There are no tasks or project dates in this review.</p></div></section>
      </div>
    );
  }

  return (
    <div className={styles.canvas}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>A week with room to move</h1>
          <p className={styles.intro}>A few things need you today. The rest can wait for its date.</p>
          <span className={styles.dateStamp}>Sunday · 18 October 2026</span>
        </div>
        <SurfaceNav surface="home" onNavigate={props.onNavigate} />
      </header>

      <section className={styles.todayBlock} aria-labelledby="today-heading">
        <div className={styles.todayDate}>
          <span className={styles.todayWeekday}>Sunday</span>
          <span className={styles.todayNumber}>18</span>
          <span className={styles.todayMonth}>October</span>
        </div>
        <div className={styles.todayWork}>
          <div className={styles.sectionHeading}>
            <div><h2 id="today-heading">For today</h2></div>
            <span className={styles.count}>{today.length} {today.length === 1 ? "task" : "tasks"}</span>
          </div>
          {today.length ? <div className={styles.taskList}>{today.map((task) => <TaskButton key={task.id} task={task} onOpen={onOpenTask} />)}</div> : <p className={styles.quietEmpty}>No tasks due today.</p>}
        </div>
      </section>

      <section className={styles.calendarSection} aria-labelledby="calendar-heading">
        <div className={styles.sectionHeading}>
          <div><h2 id="calendar-heading">The next dates</h2></div>
          <div className={styles.filters} role="group" aria-label="Choose how much of the calendar to show">
            {(["today", "week", "all"] as const).map((choice) => <button key={choice} type="button" aria-pressed={filter === choice} onClick={() => setFilter(choice)}>{choice === "today" ? "Today" : choice === "week" ? "This week" : "All dates"}</button>)}
          </div>
        </div>
        {days.length ? (
          <div className={styles.dayRail}>
            {days.map(([date, items], index) => (
              <section className={styles.dayColumn} key={date} aria-labelledby={`day-${date}`}>
                <div className={styles.dayHeader}><span className={styles.dayIndex}>{String(index + 1).padStart(2, "0")}</span><h3 id={`day-${date}`}>{dayLabel(date)}</h3></div>
                <div className={styles.dayItems}>
                  {items.map((item) => item.kind === "task" ? (
                    <button className={styles.calendarItem} type="button" key={item.task.id} onClick={() => onOpenTask(item.task.id)}>
                      <span className={styles.itemKind}>Task · {item.task.timing === "Late" ? "Past due" : item.task.timing === "Today" ? "Today" : "This week"}</span>
                      <span className={styles.itemTitle}>{item.task.title}</span>
                      <span className={styles.itemMeta}>{item.task.owner === "You" ? "For you" : `With ${item.task.owner}`}</span>
                    </button>
                  ) : (
                    <button className={`${styles.calendarItem} ${styles.milestoneItem}`} type="button" key={item.project.id} onClick={() => onOpenProject(item.project.id)}>
                      <span className={styles.itemKind}>Project date</span>
                      <span className={styles.itemTitle}>{item.project.next}</span>
                      <span className={styles.itemMeta}>{item.project.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : <p className={styles.quietEmpty}>No dated work in this view.</p>}
      </section>

      <div className={styles.sideNotes}>
        <section className={styles.noteSection} aria-labelledby="waiting-heading">
          <div className={styles.sectionHeading}><div><h2 id="waiting-heading">Waiting</h2></div><span className={styles.count}>{waiting.length}</span></div>
          {waiting.length ? <div className={styles.taskList}>{waiting.map((task) => <TaskButton key={task.id} task={task} onOpen={onOpenTask} />)}</div> : <p className={styles.quietEmpty}>Nothing is waiting on someone else.</p>}
        </section>
        <section className={styles.noteSection} aria-labelledby="past-due-heading">
          <div className={styles.sectionHeading}><div><h2 id="past-due-heading">Past due</h2></div><span className={styles.count}>{overdue.length}</span></div>
          {overdue.length ? <div className={styles.taskList}>{overdue.map((task) => <TaskButton key={task.id} task={task} onOpen={onOpenTask} />)}</div> : <p className={styles.quietEmpty}>No late tasks in this review.</p>}
        </section>
      </div>
      <p className={styles.undatedNote}>Undated work has its own place here when a task has no due date.</p>
    </div>
  );
}

function ProjectsView({ props }: { props: DirectionProps }) {
  const { data, onOpenProject } = props;
  if (!data.projects.length) {
    return <div className={styles.canvas}><header className={styles.header}><div><h1>Projects, at your pace</h1><p className={styles.intro}>Each project will have a place here when one is added.</p></div><SurfaceNav surface="projects" onNavigate={props.onNavigate} /></header><section className={styles.emptyState}><span className={styles.emptyDate}>—</span><div><h2>No projects to look ahead to</h2><p>This review has no project milestones or portfolio records.</p></div></section></div>;
  }

  const dated = [...data.projects]
    .filter((project): project is ReviewProject & { nextDate: string } => project.nextDate !== null)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const undated = data.projects.filter((project) => project.nextDate === null);
  const lanes = [
    { title: "This week", items: dated.filter((project) => project.nextDate >= data.today && project.nextDate <= "2026-10-24") },
    { title: "Coming up", items: dated.filter((project) => project.nextDate > "2026-10-24" && project.nextDate < "2026-11-01") },
    { title: "November", items: dated.filter((project) => project.nextDate >= "2026-11-01") },
  ].filter((lane) => lane.items.length > 0);

  return (
    <div className={styles.canvas}>
      <header className={styles.header}>
        <div><h1>Projects, at your pace</h1><p className={styles.intro}>A clear next date for each piece of work, with enough context to know why it matters.</p><span className={styles.dateStamp}>Sunday · 18 October 2026</span></div>
        <SurfaceNav surface="projects" onNavigate={props.onNavigate} />
      </header>
      <p className={styles.portfolioNote}>{dated.length} projects have a next date; {undated.length} {undated.length === 1 ? "has" : "have"} no date yet. Dates shown are milestones already on the calendar.</p>
      <div className={styles.portfolioLanes}>
        {lanes.map((lane) => <section className={styles.portfolioLane} key={lane.title} aria-labelledby={`lane-${lane.title.replaceAll(" ", "-")}`}>
          <header className={styles.laneHeader}><h2 id={`lane-${lane.title.replaceAll(" ", "-")}`}>{lane.title}</h2><span>{lane.items.length} {lane.items.length === 1 ? "project" : "projects"}</span></header>
          <div className={styles.projectList}>
            {lane.items.map((project) => <article className={styles.projectRow} key={project.id}>
              <div className={styles.projectDate}><span>{shortDay(project.nextDate)}</span><span>{project.nextDateLabel}</span></div>
              <div className={styles.projectMain}>
                <button className={styles.projectOpen} type="button" onClick={() => onOpenProject(project.id)}>{project.name}</button>
                <p className={styles.projectPurpose}>{project.purpose}</p>
                <div className={styles.projectFacts}><span>{project.next}</span><span>{project.standing}</span></div>
              </div>
              <div className={styles.projectCompletion}>
                <span className={styles.completionCopy}>{completionCopy(project)}</span>
                {project.late === null ? <span className={styles.lateCopy}>Overdue count unavailable.</span> : project.late > 0 ? <span className={styles.lateCopy}>{project.late} overdue {project.late === 1 ? "task" : "tasks"}</span> : <span className={styles.lateCopy}>No overdue tasks</span>}
              </div>
            </article>)}
          </div>
        </section>)}
      </div>
      {undated.length > 0 && <section className={styles.portfolioLane} aria-labelledby="lane-no-date"><header className={styles.laneHeader}><h2 id="lane-no-date">No date yet</h2><span>{undated.length} {undated.length === 1 ? "project" : "projects"}</span></header><div className={styles.projectList}>{undated.map((project) => <article className={styles.projectRow} key={project.id}>
        <div className={styles.projectDate}><span>No date yet</span></div>
        <div className={styles.projectMain}><button className={styles.projectOpen} type="button" onClick={() => onOpenProject(project.id)}>{project.name}</button><p className={styles.projectPurpose}>{project.purpose}</p><div className={styles.projectFacts}><span>{project.next}</span><span>{project.standing}</span></div></div>
        <div className={styles.projectCompletion}><span className={styles.completionCopy}>{completionCopy(project)}</span>{project.late === null ? <span className={styles.lateCopy}>Overdue count unavailable.</span> : project.late > 0 ? <span className={styles.lateCopy}>{project.late} overdue {project.late === 1 ? "task" : "tasks"}</span> : <span className={styles.lateCopy}>No overdue tasks</span>}</div>
      </article>)}</div></section>}
    </div>
  );
}

export default function DirectionHorizon(props: DirectionProps) {
  return props.surface === "home" ? <HomeView props={props} /> : <ProjectsView props={props} />;
}
