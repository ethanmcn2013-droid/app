import type { DirectionProps, ReviewProject, ReviewTask } from "../data";
import styles from "./direction.module.css";

function projectForTask(projects: readonly ReviewProject[], projectId: string) {
  return projects.find((project) => project.id === projectId);
}

function TaskRow({
  task,
  projects,
  onOpenTask,
  onOpenProject,
}: {
  task: ReviewTask;
  projects: readonly ReviewProject[];
  onOpenTask: (id: string) => void;
  onOpenProject: (id: string) => void;
}) {
  const project = projectForTask(projects, task.projectId);

  return (
    <li className={styles.taskRow}>
      <button
        className={styles.taskButton}
        onClick={() => onOpenTask(task.id)}
        type="button"
      >
        <span className={styles.taskTitle}>{task.title}</span>
        <span className={styles.taskContext}>{task.context}</span>
        <span className={styles.taskMeta}>
          <span>{task.owner === "You" ? "Your task" : `With ${task.owner}`}</span>
          <span aria-hidden="true" className={styles.metaDot} />
          <span>{task.due}</span>
        </span>
      </button>
      {project ? (
        <button
          aria-label={`Open project ${project.name}`}
          className={styles.projectLink}
          onClick={() => onOpenProject(project.id)}
          type="button"
        >
          {project.name}
        </button>
      ) : null}
    </li>
  );
}

function Home({ props }: { props: DirectionProps }) {
  const { data, onNavigate, onOpenProject, onOpenTask } = props;
  const leadTask = data.tasks.find((task) => task.timing === "Late") ?? data.tasks[0];
  const remaining = data.tasks.filter((task) => task.id !== leadTask?.id);
  const personal = remaining.filter((task) => task.owner === "You");
  const today = personal.filter((task) => task.timing === "Today");
  const thisWeek = personal.filter((task) => task.timing === "This week");
  const waiting = personal.filter((task) => task.timing === "Waiting");
  const withOthers = remaining.filter((task) => task.owner !== "You");
  const featuredProject = leadTask
    ? projectForTask(data.projects, leadTask.projectId)
    : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.dateLine}>{data.dateLabel}</p>
          <h1 className={styles.homeTitle}>A clear place to start.</h1>
          <p className={styles.intro}>
            {data.actor}, here is what could use your attention.
          </p>
        </div>
        <button
          className={styles.textAction}
          onClick={() => onNavigate("projects")}
          type="button"
        >
          All projects <span aria-hidden="true">→</span>
        </button>
      </header>

      {data.state === "empty" || data.tasks.length === 0 ? (
        <section aria-labelledby="empty-title" className={styles.emptyState}>
          <h2 id="empty-title">A little space in the day.</h2>
          <p>There is no work to bring into today’s brief yet.</p>
          <button className={styles.secondaryAction} onClick={() => onNavigate("projects")} type="button">
            Browse projects
          </button>
        </section>
      ) : (
        <>
          {leadTask ? (
            <section aria-labelledby="featured-title" className={styles.featured}>
              <div className={styles.featuredCopy}>
                <h2 id="featured-title">{leadTask.title}</h2>
                <p className={styles.featuredContext}>{leadTask.context}</p>
                <div className={styles.featuredMeta}>
                  <span className={styles.dueTag}>{leadTask.due}</span>
                  {featuredProject ? (
                    <button
                      className={styles.inlineProject}
                      onClick={() => onOpenProject(featuredProject.id)}
                      type="button"
                    >
                      {featuredProject.name}
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                className={styles.openDecision}
                onClick={() => onOpenTask(leadTask.id)}
                type="button"
              >
                Open decision <span aria-hidden="true">↗</span>
              </button>
            </section>
          ) : null}

          <div className={styles.workColumns}>
            <section aria-labelledby="today-title" className={styles.workSection}>
              <div className={styles.sectionHeading}>
                <h2 id="today-title">On your list</h2>
              </div>
              {today.length || thisWeek.length || waiting.length ? (
                <div className={styles.groups}>
                  {today.length ? <TaskGroup label="Today" tasks={today} {...props} /> : null}
                  {thisWeek.length ? <TaskGroup label="This week" tasks={thisWeek} {...props} /> : null}
                  {waiting.length ? <TaskGroup label="Waiting" tasks={waiting} {...props} /> : null}
                </div>
              ) : (
                <p className={styles.quietNote}>No other tasks are on your list today.</p>
              )}
              {withOthers.length ? (
                <div className={styles.teamGroup}>
                  <TaskGroup label="With the team" tasks={withOthers} {...props} />
                </div>
              ) : null}
            </section>

            <aside aria-labelledby="margin-title" className={styles.margin}>
              <h2 id="margin-title">A little further out</h2>
              <p>Dates to keep in view, without crowding the day.</p>
              {data.projects.length ? (
                <ul className={styles.dateList}>
                  {data.projects.slice(0, 3).map((project) => (
                    <li key={project.id}>
                      <span className={styles.dateValue}>{project.nextDateLabel}</span>
                      <button onClick={() => onOpenProject(project.id)} type="button">
                        {project.next}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.quietNote}>Project dates will appear here.</p>
              )}
              <button className={styles.textAction} onClick={() => onNavigate("projects")} type="button">
                See your projects <span aria-hidden="true">→</span>
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function TaskGroup({
  label,
  tasks,
  ...props
}: {
  label: string;
  tasks: readonly ReviewTask[];
} & Pick<DirectionProps, "data" | "onOpenTask" | "onOpenProject" | "onNavigate">) {
  return (
    <div className={styles.taskGroup}>
      <h3>{label}</h3>
      <ul className={styles.taskList}>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            projects={props.data.projects}
            onOpenTask={props.onOpenTask}
            onOpenProject={props.onOpenProject}
          />
        ))}
      </ul>
    </div>
  );
}

function taskCount(project: ReviewProject) {
  if (project.completed === null || project.total === null || project.late === null) {
    return "Task counts not available";
  }
  return `${project.completed} of ${project.total} tasks · ${project.late} late`;
}

function Projects({ props }: { props: DirectionProps }) {
  const { data, onNavigate, onOpenProject } = props;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.dateLine}>{data.projects.length} projects in view</p>
          <h1 className={styles.projectsTitle}>Work with a name and a next step.</h1>
          <p className={styles.intro}>A directory of the work, the people around it, and what comes next.</p>
        </div>
        <button className={styles.textAction} onClick={() => onNavigate("home")} type="button">
          <span aria-hidden="true">←</span> Back to today
        </button>
      </header>

      {data.projects.length ? (
        <section aria-label="Projects" className={styles.projectDirectory}>
          <div className={styles.directoryHeader} aria-hidden="true">
            <span>Project</span>
            <span>Lead</span>
            <span>Tasks</span>
            <span>Next</span>
          </div>
          {data.projects.map((project) => (
            <article className={styles.projectRow} key={project.id}>
              <div className={styles.projectMain}>
                <button
                  className={styles.projectName}
                  onClick={() => onOpenProject(project.id)}
                  type="button"
                >
                  {project.name}
                </button>
                <p>{project.purpose}</p>
              </div>
              <div className={styles.projectLead}>
                <span aria-hidden="true" className={styles.initials}>{project.initials}</span>
                <span>{project.lead}</span>
              </div>
              <p className={styles.projectCount}>{taskCount(project)}</p>
              <div className={styles.projectNext}>
                <span>{project.nextDateLabel}</span>
                <strong>{project.next}</strong>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section aria-labelledby="projects-empty-title" className={styles.emptyState}>
          <h2 id="projects-empty-title">No projects in view yet.</h2>
          <p>When work takes shape, its name and next step will find a place here.</p>
          <button className={styles.secondaryAction} onClick={() => onNavigate("home")} type="button">
            Return to Home
          </button>
        </section>
      )}
    </div>
  );
}

export default function DirectionBrief(props: DirectionProps) {
  return props.surface === "home" ? <Home props={props} /> : <Projects props={props} />;
}
