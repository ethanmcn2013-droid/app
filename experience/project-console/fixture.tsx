/**
 * The Projects console with a busy account, rendered without the app.
 *
 * Review mode has one sample Project, so this page stands in for an account
 * with twelve. It mounts the real `ProjectsIndex` (the page's header, view
 * switcher, search and Console) over `consoleFixture()`; `run.mjs` bundles it
 * with the real styles and tokens and stubs only the seams that need a
 * server (see the stub list there). It is not a route and ships nowhere.
 *
 * `?state=` picks the account: `busy` (default), `partial` (the extra reads
 * failed), `calm` (nothing flagged), `one` (a single Project), `none` (no
 * active Projects). `?theme=dark` sets the dark tokens.
 */

import { createRoot } from "react-dom/client";
import { ProjectsIndex } from "../../src/components/app/project/projects-hub";
import { ProjectsFirstRun } from "../../src/components/app/project/projects-first-run";
import { ProjectConsoleSkeleton } from "../../src/components/app/project/project-console-skeleton";
import { consoleFixture } from "../../src/lib/projects/project-console.fixture";
import { monogramOf, type ChooserRow } from "../../src/lib/projects/project-chooser";
import type { ProjectHub, ProjectHubCard } from "../../src/lib/projects/project-hub";
import type { ConsoleFacts, ConsoleProjectInput } from "../../src/lib/projects/project-console";
import "../../src/ds/v3.css";
import "./fixture.css";

type Probe = { selected: Array<{ id: string; surface: string }>; pushed: string[]; nudged: string[]; toasts: string[] };
declare global {
  interface Window {
    consoleProbe: Probe;
  }
}

const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "busy";
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
window.consoleProbe = { selected: [], pushed: [], nudged: [], toasts: [] };

const { today, projects: all } = consoleFixture();
const OPEN_ID = "p-keane";

function pick(): ConsoleProjectInput[] {
  if (state === "none") return [];
  if (state === "one") return all.filter((project) => project.id === OPEN_ID);
  if (state === "calm") {
    return all
      .filter((project) => ["p-keane", "p-garden", "p-newyear", "p-harvest", "p-summer"].includes(project.id))
      .map((project) => (project.stats ? { ...project, stats: { ...project.stats, overdue: 0 }, facts: project.facts ? { ...project.facts, oldestLate: null } : null } : project));
  }
  return all;
}

function toRow(project: ConsoleProjectInput): ChooserRow {
  const id = project.id as ChooserRow["id"];
  return {
    id,
    name: project.name,
    disambiguator: null,
    subtitle: "",
    accessibleName: project.name,
    archived: false,
    role: project.role,
    selectable: project.selectable,
    blockedReason: project.blockedReason,
    activeRootTaskCount: project.openCount,
    monogram: monogramOf(project.name),
    project: { id, name: project.name, role: project.role } as ChooserRow["project"],
  };
}

const projects = pick();
const cards: ProjectHubCard[] = projects.map((project) => ({ row: toRow(project), stats: project.stats }));
const byProject: Record<string, ConsoleFacts> = {};
for (const project of projects) if (project.facts) byProject[project.id] = project.facts;
const hub: ProjectHub = {
  kind: "ready",
  cards,
  archived: [],
  truncated: false,
  statsUnavailable: false,
  console: state === "partial" ? null : { today, byProject },
};

// The open Project's card and row read the overview's own figures.
const open = all.find((project) => project.id === OPEN_ID)!;
const data = {
  workspaceId: projects.some((project) => project.id === OPEN_ID) ? OPEN_ID : "p-archived",
  slug: "keane-legal-retreat",
  displayName: open.name,
  purpose: null,
  createdAt: null,
  ownerUserId: "u-orla",
  isOwner: true,
  members: [],
  taskStats: { total: open.stats!.total, complete: open.stats!.complete, overdue: open.stats!.overdue, undated: 0, progressPct: 33 },
  milestones: [],
  recentEvents: [],
  declaredStatus: open.stats!.status,
  targetDate: open.stats!.targetDate,
  program: null,
  todayIso: today,
} as unknown as Parameters<typeof ProjectsIndex>[0]["data"];

const activeProject = {
  enabled: true,
  pending: null,
  lastError: null,
  refusal: null,
  selectProject: (project: { id: string }, destination: { surface: string }) => {
    window.consoleProbe.selected.push({ id: project.id, surface: destination.surface });
    return { kind: "started" };
  },
} as unknown as Parameters<typeof ProjectsIndex>[0]["activeProject"];

function Frame() {
  if (state === "first-run") {
    return (
      <div className="fixture-shell" data-first-run="">
        <ProjectsFirstRun />
      </div>
    );
  }
  return (
    <div className="fixture-shell">
      <main className="fixture-page">
        <div className="fixture-inner">
          {state === "loading" ? (
            <ProjectConsoleSkeleton rows={4} />
          ) : (
            <ProjectsIndex
              hub={hub}
              data={data}
              declared={{ status: open.stats!.status, targetDate: open.stats!.targetDate }}
              activeProject={activeProject}
              initialView="console"
              initialFilter="all"
            />
          )}
          <div id="project-overview" className="fixture-overview">
            The open project’s overview sits here on the real page.
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Frame />);
