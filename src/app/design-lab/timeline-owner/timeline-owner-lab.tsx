"use client";

// Deliberately isolated from the production Timeline until a direction is selected.
import { useEffect, useMemo, useState } from "react";
import styles from "./timeline-owner-lab.module.css";

type Option = "a" | "b" | "c";
type ProjectId = "personal" | "website" | "wedding";
type Mode = "view" | "edit" | "share";
type MilestoneState = "done" | "current" | "next";

type Milestone = {
  id: string;
  title: string;
  date: string;
  displayDate: string;
  lane: string;
  state: MilestoneState;
  source: string;
  note: string;
};

type Project = {
  id: ProjectId;
  name: string;
  range: string;
  summary: string;
  updated: string;
  published: boolean;
  milestones: Milestone[];
};

const PROJECTS: Project[] = [
  {
    id: "personal",
    name: "Personal",
    range: "18 May – 17 Aug",
    summary: "A clear path through the commitments that matter this season.",
    updated: "2 minutes ago",
    published: true,
    milestones: [
      {
        id: "p1",
        title: "Course application sent",
        date: "2026-05-18",
        displayDate: "18 May",
        lane: "Started",
        state: "done",
        source: "Submit course application",
        note: "Application and supporting documents sent.",
      },
      {
        id: "p2",
        title: "Deposit saved",
        date: "2026-06-21",
        displayDate: "21 Jun",
        lane: "Money",
        state: "done",
        source: "Move €1,200 into deposit account",
        note: "The first target is held. Keep the monthly transfer running.",
      },
      {
        id: "p3",
        title: "Driving test",
        date: "2026-07-29",
        displayDate: "29 Jul",
        lane: "Next",
        state: "current",
        source: "Pass driving test",
        note: "Two lessons left. Bring the learner permit and logbook.",
      },
      {
        id: "p4",
        title: "Move into the new place",
        date: "2026-08-17",
        displayDate: "17 Aug",
        lane: "Later",
        state: "next",
        source: "Collect keys and complete move",
        note: "The public copy only needs the date and outcome.",
      },
    ],
  },
  {
    id: "website",
    name: "Studio website",
    range: "24 Jul – 12 Sep",
    summary: "Bring the four products back under one clear front door.",
    updated: "18 minutes ago",
    published: false,
    milestones: [
      {
        id: "s1",
        title: "Page structure agreed",
        date: "2026-07-24",
        displayDate: "24 Jul",
        lane: "Foundation",
        state: "done",
        source: "Lock product page structure",
        note: "One structure, with a distinct proof gesture for each product.",
      },
      {
        id: "s2",
        title: "Product motion restored",
        date: "2026-08-04",
        displayDate: "04 Aug",
        lane: "Build",
        state: "current",
        source: "Restore four hero films",
        note: "Caret, pulse, sweep and tick. Each motion explains the product.",
      },
      {
        id: "s3",
        title: "Pages ready for review",
        date: "2026-08-19",
        displayDate: "19 Aug",
        lane: "Review",
        state: "next",
        source: "Run product-page review",
        note: "Check real content, mobile behaviour and reduced motion.",
      },
      {
        id: "s4",
        title: "New front door live",
        date: "2026-09-12",
        displayDate: "12 Sep",
        lane: "Release",
        state: "next",
        source: "Publish the selected direction",
        note: "Only after the selected page proves the product honestly.",
      },
    ],
  },
  {
    id: "wedding",
    name: "Aoife & Mark",
    range: "03 Apr – 18 Oct",
    summary: "The decisions, hand-offs and final-week moments everyone needs.",
    updated: "Yesterday",
    published: true,
    milestones: [
      {
        id: "w1",
        title: "Venue confirmed",
        date: "2026-04-03",
        displayDate: "03 Apr",
        lane: "Booked",
        state: "done",
        source: "Sign venue agreement",
        note: "Glenmara House is confirmed.",
      },
      {
        id: "w2",
        title: "Guest list closes",
        date: "2026-08-16",
        displayDate: "16 Aug",
        lane: "Guests",
        state: "current",
        source: "Close final guest list",
        note: "Dietary follow-up stays private in Tasks.",
      },
      {
        id: "w3",
        title: "Final venue walk-through",
        date: "2026-10-09",
        displayDate: "09 Oct",
        lane: "Final week",
        state: "next",
        source: "Complete venue walk-through",
        note: "Confirm room setup, arrival order and supplier access.",
      },
      {
        id: "w4",
        title: "Wedding day",
        date: "2026-10-18",
        displayDate: "18 Oct",
        lane: "The day",
        state: "next",
        source: "Wedding day",
        note: "The timeline ends with the moment, not a software state.",
      },
    ],
  },
];

const OPTIONS: Array<{
  id: Option;
  label: string;
  name: string;
  thesis: string;
}> = [
  {
    id: "a",
    label: "A",
    name: "In context",
    thesis: "Open the current project. Keep editing one click away.",
  },
  {
    id: "b",
    label: "B",
    name: "Artifact first",
    thesis: "Let the timeline lead. Edit in a focused workbench.",
  },
  {
    id: "c",
    label: "C",
    name: "Guided path",
    thesis: "Explain what needs attention before showing every control.",
  },
];

function Icon({
  name,
  size = 16,
}: {
  name: "chevron" | "eye" | "edit" | "link" | "check" | "tasks" | "more";
  size?: number;
}) {
  const paths = {
    chevron: <path d="m7 10 5 5 5-5" />,
    eye: (
      <>
        <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
        <circle cx="12" cy="12" r="2.2" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    tasks: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8 12 2 2 5-5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function ProjectMenu({
  project,
  setProject,
  compact = false,
}: {
  project: Project;
  setProject: (project: ProjectId) => void;
  compact?: boolean;
}) {
  return (
    <label className={`${styles.projectPicker} ${compact ? styles.projectPickerCompact : ""}`}>
      <span>Timeline</span>
      <strong>{project.name}</strong>
      <Icon name="chevron" size={15} />
      <select
        aria-label="Switch project timeline"
        value={project.id}
        onChange={(event) => setProject(event.target.value as ProjectId)}
      >
        {PROJECTS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ModeSwitch({
  mode,
  setMode,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
}) {
  return (
    <div className={styles.modeSwitch} aria-label="Timeline mode">
      {(
        [
          ["view", "View", "eye"],
          ["edit", "Edit", "edit"],
          ["share", "Share", "link"],
        ] as const
      ).map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          onClick={() => setMode(id)}
        >
          <Icon name={icon} size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

function TimelineLine({
  project,
  selectedId,
  select,
  quiet = false,
}: {
  project: Project;
  selectedId: string;
  select: (id: string) => void;
  quiet?: boolean;
}) {
  return (
    <div className={`${styles.timelineLine} ${quiet ? styles.timelineLineQuiet : ""}`}>
      <div className={styles.lineRule} aria-hidden="true" />
      {project.milestones.map((milestone, index) => (
        <button
          key={milestone.id}
          type="button"
          className={styles.timelinePoint}
          data-state={milestone.state}
          data-selected={selectedId === milestone.id}
          onClick={() => select(milestone.id)}
          style={{ "--point": `${(index / (project.milestones.length - 1)) * 100}%` } as React.CSSProperties}
          aria-label={`${milestone.title}, ${milestone.displayDate}`}
        >
          <span className={styles.pointDate}>{milestone.displayDate}</span>
          <i aria-hidden="true">{milestone.state === "done" ? <Icon name="check" size={11} /> : null}</i>
          <span className={styles.pointTitle}>{milestone.title}</span>
          <small>{milestone.lane}</small>
        </button>
      ))}
    </div>
  );
}

function EditPanel({
  milestone,
  mode,
  project,
}: {
  milestone: Milestone;
  mode: Mode;
  project: Project;
}) {
  if (mode === "share") {
    return (
      <aside className={styles.inspector} aria-label="Share timeline">
        <p className={styles.inspectorEyebrow}>Public copy</p>
        <h2>Ready to send.</h2>
        <p className={styles.inspectorCopy}>
          The link contains four milestone labels, their dates and public
          states. Tasks, notes and people stay private.
        </p>
        <div className={styles.publicLink}>
          <span>timeline.signalstudio.ie/{project.id}</span>
          <button type="button" aria-label="Copy public link">
            <Icon name="link" size={14} />
          </button>
        </div>
        <button type="button" className={styles.primaryAction}>
          {project.published ? "Update public timeline" : "Publish timeline"}
        </button>
        <button type="button" className={styles.textAction}>
          Preview exactly what they see
        </button>
      </aside>
    );
  }

  if (mode === "view") {
    return (
      <aside className={styles.inspector} aria-label="Milestone detail">
        <p className={styles.inspectorEyebrow}>{milestone.lane}</p>
        <h2>{milestone.title}</h2>
        <p className={styles.inspectorDate}>{milestone.displayDate} 2026</p>
        <p className={styles.inspectorCopy}>{milestone.note}</p>
        <div className={styles.sourceNote}>
          <Icon name="tasks" size={15} />
          <span>
            From Tasks
            <strong>{milestone.source}</strong>
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.inspector} aria-label="Edit milestone">
      <div className={styles.inspectorTitleRow}>
        <p className={styles.inspectorEyebrow}>Edit milestone</p>
        <span>Saved</span>
      </div>
      <label className={styles.field}>
        <span>Public wording</span>
        <input defaultValue={milestone.title} />
      </label>
      <label className={styles.field}>
        <span>Date</span>
        <input type="date" defaultValue={milestone.date} />
      </label>
      <label className={styles.field}>
        <span>Public note</span>
        <textarea defaultValue={milestone.note} rows={4} />
      </label>
      <div className={styles.sourceNote}>
        <Icon name="tasks" size={15} />
        <span>
          Source stays in Tasks
          <strong>{milestone.source}</strong>
        </span>
      </div>
      <button type="button" className={styles.textAction}>
        Hide this milestone from the public copy
      </button>
    </aside>
  );
}

function OptionA({
  project,
  setProject,
  mode,
  setMode,
  selected,
  setSelected,
}: CanvasProps) {
  return (
    <section className={`${styles.canvas} ${styles.optionA}`} aria-label="Option A, In context">
      <header className={styles.appHeader}>
        <ProjectMenu project={project} setProject={setProject} />
        <div className={styles.headerActions}>
          <span className={styles.savedState}>Updated {project.updated}</span>
          <ModeSwitch mode={mode} setMode={setMode} />
        </div>
      </header>
      <div className={styles.aBody}>
        <main className={styles.timelineStage}>
          <div className={styles.stageHeader}>
            <div>
              <p>{project.range}</p>
              <h1>{project.name}</h1>
              <span>{project.summary}</span>
            </div>
            <button type="button" className={styles.iconButton} aria-label="More timeline actions">
              <Icon name="more" />
            </button>
          </div>
          <TimelineLine
            project={project}
            selectedId={selected.id}
            select={setSelected}
          />
          <footer className={styles.stageFooter}>
            <span>
              <i aria-hidden="true" />
              {project.published ? "Public link is live" : "Owner draft"}
            </span>
            <button type="button" onClick={() => setMode("share")}>
              Preview public timeline
            </button>
          </footer>
        </main>
        <EditPanel milestone={selected} mode={mode} project={project} />
      </div>
    </section>
  );
}

function OptionB({
  project,
  setProject,
  mode,
  setMode,
  selected,
  setSelected,
}: CanvasProps) {
  return (
    <section className={`${styles.canvas} ${styles.optionB}`} aria-label="Option B, Artifact first">
      <header className={styles.bHeader}>
        <div className={styles.bBrand}>timeline<span>.</span></div>
        <ProjectMenu project={project} setProject={setProject} compact />
        <ModeSwitch mode={mode} setMode={setMode} />
      </header>
      <main className={styles.bArtifact}>
        <div className={styles.bArtifactMeta}>
          <span>{project.range}</span>
          <span>{project.published ? "Live" : "Private draft"}</span>
        </div>
        <h1>{project.name}</h1>
        <p>{project.summary}</p>
        <TimelineLine
          project={project}
          selectedId={selected.id}
          select={setSelected}
          quiet
        />
      </main>
      <div className={styles.workbench}>
        <div className={styles.workbenchSummary}>
          <span>{mode === "edit" ? "Editing" : mode === "share" ? "Sharing" : "Selected"}</span>
          <strong>{mode === "share" ? project.name : selected.title}</strong>
          <small>
            {mode === "share"
              ? `${project.milestones.length} milestones in the public copy`
              : `${selected.displayDate} · from ${selected.source}`}
          </small>
        </div>
        <EditPanel milestone={selected} mode={mode} project={project} />
      </div>
    </section>
  );
}

function OptionC({
  project,
  setProject,
  mode,
  setMode,
  selected,
  setSelected,
}: CanvasProps) {
  const currentIndex = Math.max(
    0,
    project.milestones.findIndex((milestone) => milestone.state === "current"),
  );
  const current = project.milestones[currentIndex];
  const next = project.milestones[currentIndex + 1];
  return (
    <section className={`${styles.canvas} ${styles.optionC}`} aria-label="Option C, Guided path">
      <header className={styles.cHeader}>
        <ProjectMenu project={project} setProject={setProject} />
        <ModeSwitch mode={mode} setMode={setMode} />
      </header>
      <div className={styles.cBody}>
        <main>
          <p className={styles.cKicker}>Your timeline today</p>
          <h1>{current.title} is the next marker.</h1>
          <p className={styles.cLead}>
            {current.note} {next ? `After that, ${next.title.toLowerCase()}.` : ""}
          </p>
          <div className={styles.nowCard}>
            <div>
              <span>Now</span>
              <strong>{current.displayDate}</strong>
            </div>
            <p>{current.title}</p>
            <button type="button" onClick={() => { setSelected(current.id); setMode("edit"); }}>
              Check wording and date
            </button>
          </div>
          <section className={styles.pathList} aria-label="Milestone path">
            {project.milestones.map((milestone, index) => (
              <button
                key={milestone.id}
                type="button"
                data-state={milestone.state}
                data-selected={selected.id === milestone.id}
                onClick={() => setSelected(milestone.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <i aria-hidden="true" />
                <strong>{milestone.title}</strong>
                <small>{milestone.displayDate}</small>
              </button>
            ))}
          </section>
        </main>
        <aside className={styles.cAside}>
          <div className={styles.cReadiness}>
            <p>Public readiness</p>
            <strong>{project.published ? "Up to date" : "One review left"}</strong>
            <span>
              {project.published
                ? "The public link matches this owner draft."
                : "Read each milestone once, then publish."}
            </span>
            <button type="button" onClick={() => setMode("share")}>
              {project.published ? "Review public link" : "Prepare public link"}
            </button>
          </div>
          <EditPanel milestone={selected} mode={mode} project={project} />
        </aside>
      </div>
    </section>
  );
}

type CanvasProps = {
  project: Project;
  setProject: (id: ProjectId) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  selected: Milestone;
  setSelected: (id: string) => void;
};

export function TimelineOwnerLab({
  initialOption,
  initialProject,
}: {
  initialOption: Option;
  initialProject: ProjectId;
}) {
  const [option, setOption] = useState<Option>(initialOption);
  const [projectId, setProjectId] = useState<ProjectId>(initialProject);
  const [mode, setMode] = useState<Mode>("view");
  const project = useMemo(
    () => PROJECTS.find((item) => item.id === projectId) ?? PROJECTS[0],
    [projectId],
  );
  const [selectedId, setSelectedId] = useState(project.milestones[2]?.id ?? project.milestones[0].id);
  const selected =
    project.milestones.find((milestone) => milestone.id === selectedId) ??
    project.milestones[0];
  const optionMeta = OPTIONS.find((item) => item.id === option) ?? OPTIONS[0];

  function setProject(next: ProjectId) {
    const nextProject = PROJECTS.find((item) => item.id === next) ?? PROJECTS[0];
    setProjectId(next);
    setSelectedId(
      nextProject.milestones.find((milestone) => milestone.state === "current")?.id ??
        nextProject.milestones[0].id,
    );
    setMode("view");
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("option", option);
    url.searchParams.set("project", projectId);
    window.history.replaceState({}, "", url);
  }, [option, projectId]);

  const canvasProps: CanvasProps = {
    project,
    setProject,
    mode,
    setMode,
    selected,
    setSelected: setSelectedId,
  };

  return (
    <div className={styles.lab}>
      <header className={styles.reviewHeader}>
        <div className={styles.reviewTitle}>
          <span>Local review · Timeline owner workspace</span>
          <strong>{optionMeta.name}</strong>
          <p>{optionMeta.thesis}</p>
        </div>
        <nav className={styles.optionNav} aria-label="Timeline owner workspace options">
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={option === item.id}
              onClick={() => setOption(item.id)}
            >
              <span>{item.label}</span>
              <i>
                <strong>{item.name}</strong>
                <small>{item.thesis}</small>
              </i>
            </button>
          ))}
        </nav>
      </header>

      {option === "a" ? <OptionA {...canvasProps} /> : null}
      {option === "b" ? <OptionB {...canvasProps} /> : null}
      {option === "c" ? <OptionC {...canvasProps} /> : null}

      <footer className={styles.reviewFooter}>
        <span>Deterministic fixtures. No account or production data.</span>
        <span>Test the project switcher, View / Edit / Share and milestone selection.</span>
      </footer>
    </div>
  );
}
