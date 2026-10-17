'use client';

import { useMemo, useState } from 'react';
import type { DirectionProps, ReviewProject, ReviewTask } from '../data';
import styles from './direction.module.css';

function figure(value: number | null, noun: string) {
  return value === null ? `${noun} unavailable` : `${value} ${noun}`;
}

function projectFacts(project: ReviewProject, tasks: readonly ReviewTask[]) {
  const related = tasks.filter((task) => task.projectId === project.id);
  return { related: related.length };
}

export default function DirectionWorkbench({
  surface,
  data,
  onOpenTask,
  onOpenProject,
  onNavigate,
}: DirectionProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(data.tasks[0]?.id ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState(data.projects[0]?.id ?? '');

  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId) ?? data.tasks[0];
  const projectById = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects]);
  const filteredProjects = data.projects;
  const selectedProject = filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0];

  const targetSurface = surface === 'home' ? 'projects' : 'home';
  const targetLabel = surface === 'home' ? 'Projects' : 'Home';

  return (
    <div className={styles.workbench}>
      <header className={styles.pageHeader}>
        <div>
          <h1>{surface === 'home' ? 'Home' : 'Projects'}</h1>
          <p>{surface === 'home' ? 'Your tasks, with the project context close at hand.' : 'Find a project and pick up where the work is.'}</p>
        </div>
        <button className={styles.surfaceLink} type="button" onClick={() => onNavigate(targetSurface)}>
          {targetLabel}<span aria-hidden="true"> ↗</span>
        </button>
      </header>

      {surface === 'home' ? (
        <div className={styles.workspace}>
          <section className={styles.listPane} aria-labelledby="queue-heading">
            <div className={styles.paneHeading}>
              <div>
                <h2 id="queue-heading">Your queue</h2>
                <p>{data.tasks.length ? `${data.tasks.length} tasks to review` : 'A clear place to start'}</p>
              </div>
              <span className={styles.dayStamp}>{data.dateLabel}</span>
            </div>
            {data.tasks.length ? (
              <div className={styles.taskList} role="group" aria-label="Tasks">
                {data.tasks.map((task) => {
                  const project = projectById.get(task.projectId);
                  const selected = task.id === (selectedTask?.id ?? selectedTaskId);
                  return (
                    <button
                      className={`${styles.taskRow} ${selected ? styles.selectedRow : ''}`}
                      type="button"
                      key={task.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>{task.title}</span>
                        <span className={styles.rowProject}>{project?.name ?? 'Project unavailable'}</span>
                      </span>
                      <span className={styles.rowMeta}>
                        <span className={`${styles.timing} ${task.timing === 'Late' ? styles.late : ''}`}>{task.timing}</span>
                        <span className={styles.due}>{task.due}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyList}>
                <h3>Nothing in the queue</h3>
                <p>When a task needs your attention, it will appear here with its project context.</p>
              </div>
            )}
          </section>

          <section className={styles.detailPane} aria-labelledby="task-detail-heading" aria-live="polite">
            {selectedTask ? (
              <>
                <div className={styles.detailTopline}>
                  <span>{selectedTask.timing === 'Late' ? 'Needs attention' : 'Task context'}</span>
                  <span>{selectedTask.due}</span>
                </div>
                <h2 id="task-detail-heading" className={styles.detailTitle}>{selectedTask.title}</h2>
                <p className={styles.contextText}>{selectedTask.context}</p>
                <dl className={styles.facts}>
                  <div><dt>Project</dt><dd>{projectById.get(selectedTask.projectId)?.name ?? 'Project unavailable'}</dd></div>
                  <div><dt>Owner</dt><dd>{selectedTask.owner}</dd></div>
                  <div><dt>Timing</dt><dd>{selectedTask.timing}</dd></div>
                </dl>
                <div className={styles.detailActions}>
                  <button className={styles.primaryAction} type="button" onClick={() => onOpenTask(selectedTask.id)}>Open task</button>
                  {projectById.get(selectedTask.projectId) ? (
                    <button className={styles.secondaryAction} type="button" onClick={() => onOpenProject(selectedTask.projectId)}>Open project</button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.detailEmpty}>
                <span className={styles.detailRule} aria-hidden="true" />
                <h2 id="task-detail-heading">Task details</h2>
                <p>Select a task from your queue to see the reason, owner and timing together.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className={`${styles.workspace} ${styles.projectWorkspace}`}>
          <section className={styles.listPane} aria-labelledby="projects-heading">
            <div className={styles.paneHeading}>
              <div>
                <h2 id="projects-heading">Projects</h2>
                <p>{filteredProjects.length} of {data.projects.length} projects</p>
              </div>
            </div>
            <label className={styles.mobileProjectLabel} htmlFor="mobile-project-select">Selected project</label>
            <select
              id="mobile-project-select"
              className={styles.mobileProjectSelect}
              value={filteredProjects.some((project) => project.id === selectedProject?.id) ? selectedProject.id : filteredProjects[0]?.id ?? ''}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={!filteredProjects.length}
            >
              {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {filteredProjects.length ? (
              <div className={styles.projectList} role="group" aria-label="Projects">
                {filteredProjects.map((project) => {
                  const selected = project.id === (selectedProject?.id ?? selectedProjectId);
                  const facts = projectFacts(project, data.tasks);
                  return (
                    <button
                      className={`${styles.projectRow} ${selected ? styles.selectedRow : ''}`}
                      type="button"
                      key={project.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <span className={styles.projectRowTop}>
                        <span className={styles.projectName}>{project.name}</span>
                        <span className={`${styles.standing} ${project.standing === 'Needs attention' ? styles.attention : ''}`}>{project.standing}</span>
                      </span>
                      <span className={styles.projectPurpose}>{project.purpose}</span>
                      <span className={styles.projectRowFoot}>{figure(facts.related, 'tasks')} · {project.lead}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyList}>
                <h3>No projects yet</h3>
                <p>Projects will appear here when they are available to you.</p>
              </div>
            )}
          </section>

          <section className={styles.detailPane} aria-labelledby="project-detail-heading" aria-live="polite">
            {selectedProject ? (
              <>
                <div className={styles.detailTopline}>
                  <span>Project overview</span>
                  <span className={`${styles.standing} ${selectedProject.standing === 'Needs attention' ? styles.attention : ''}`}>{selectedProject.standing}</span>
                </div>
                <h2 id="project-detail-heading" className={styles.detailTitle}>{selectedProject.name}</h2>
                <p className={styles.contextText}>{selectedProject.purpose}</p>
                <div className={styles.nextMilestone}>
                  <span>Next up</span>
                  <strong>{selectedProject.next}</strong>
                  <time dateTime={selectedProject.nextDate}>{selectedProject.nextDateLabel}</time>
                </div>
                <dl className={styles.facts}>
                  <div><dt>Lead</dt><dd>{selectedProject.lead}</dd></div>
                  <div><dt>Tasks complete</dt><dd>{selectedProject.completed === null || selectedProject.total === null ? 'Unavailable' : `${selectedProject.completed} of ${selectedProject.total}`}</dd></div>
                  <div><dt>Late tasks</dt><dd>{figure(selectedProject.late, 'tasks')}</dd></div>
                  <div><dt>In this queue</dt><dd>{figure(projectFacts(selectedProject, data.tasks).related, 'tasks')}</dd></div>
                </dl>
                <div className={styles.detailActions}>
                  <button className={styles.primaryAction} type="button" onClick={() => onOpenProject(selectedProject.id)}>Open project</button>
                </div>
              </>
            ) : (
              <div className={styles.detailEmpty}>
                <span className={styles.detailRule} aria-hidden="true" />
                <h2 id="project-detail-heading">Project details</h2>
                <p>Select a project to see its purpose, next date and task facts.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
