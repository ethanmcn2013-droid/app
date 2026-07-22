import { STUDIO_URL } from "@/lib/product-urls";
import type { Project, Task, Workspace } from "@/modules/timeline/server/db/timeline-schema";

export type SharedUpdateTone = "clear" | "attention" | "quiet";

export interface SourceTracking {
  source: string;
  segment: string;
  role: string;
  campaign: string;
  artefact: string;
}

export interface SharedUpdateProject {
  project: Project;
  total: number;
  done: number;
  doing: number;
  next: number;
  waiting: number;
  progress: number;
}

export interface SharedUpdateModel {
  state: {
    label: string;
    detail: string;
    tone: SharedUpdateTone;
  };
  summary: string;
  focus: Task[];
  needsAttention: Task[];
  nextUp: Task[];
  recentlyDone: Task[];
  nextClearStep: Task | null;
  projects: SharedUpdateProject[];
  tracking: SourceTracking;
  studioUrl: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_TRACKING: SourceTracking = {
  source: "roadmap_share",
  segment: "general",
  role: "viewer",
  campaign: "collaboration_proof",
  artefact: "shared_update",
};

export function normaliseSourceTracking(
  searchParams: SearchParams | undefined,
): SourceTracking {
  return {
    source: readParam(searchParams, "source") ?? DEFAULT_TRACKING.source,
    segment: readParam(searchParams, "segment") ?? DEFAULT_TRACKING.segment,
    role: readParam(searchParams, "role") ?? DEFAULT_TRACKING.role,
    campaign: readParam(searchParams, "campaign") ?? DEFAULT_TRACKING.campaign,
    artefact: readParam(searchParams, "artefact") ?? DEFAULT_TRACKING.artefact,
  };
}

export function buildSharedUpdate({
  workspace,
  projects,
  tasks,
  upcoming,
  searchParams,
}: {
  workspace: Workspace;
  projects: Project[];
  tasks: Task[];
  upcoming: Task[];
  searchParams?: SearchParams;
}): SharedUpdateModel {
  const visible = tasks.filter((task) => task.status !== "refused");
  const focus = visible
    .filter((task) => task.status === "in-flight")
    .sort(sortRoadmapItems)
    .slice(0, 5);
  const needsAttention = visible
    .filter((task) => task.status === "waiting")
    .sort(sortRoadmapItems)
    .slice(0, 5);
  const nextCandidates = upcoming.length
    ? upcoming
    : visible.filter((task) => task.status === "next").sort(sortRoadmapItems);
  const nextUp = nextCandidates.slice(0, 5);
  const recentlyDone = visible
    .filter((task) => task.status === "shipped")
    .sort(sortDoneItems)
    .slice(0, 5);

  const state = deriveState(visible);
  const summary = deriveSummary(workspace, state, focus, needsAttention, nextUp);
  const tracking = normaliseSourceTracking(searchParams);

  return {
    state,
    summary,
    focus,
    needsAttention,
    nextUp,
    recentlyDone,
    nextClearStep: nextUp[0] ?? focus[0] ?? null,
    projects: projects.map((project) =>
      buildProjectSnapshot(
        project,
        visible.filter((task) => task.projectSlug === project.slug),
      ),
    ),
    tracking,
    studioUrl: buildStudioUrl(tracking),
  };
}

function deriveState(tasks: Task[]): SharedUpdateModel["state"] {
  if (tasks.length === 0) {
    return {
      label: "Drafting",
      detail: "Nothing has been published yet.",
      tone: "quiet",
    };
  }

  const waiting = tasks.filter((task) => task.status === "waiting").length;
  const doing = tasks.filter((task) => task.status === "in-flight").length;
  const next = tasks.filter((task) => task.status === "next").length;

  if (waiting > 0) {
    return {
      label: "Needs attention",
      detail: pluralise(waiting, "item is", "items are") + " waiting.",
      tone: "attention",
    };
  }

  if (doing > 0) {
    return {
      label: "Moving",
      detail: pluralise(doing, "item is", "items are") + " in motion.",
      tone: "clear",
    };
  }

  if (next > 0) {
    return {
      label: "Ready for next step",
      detail: pluralise(next, "item is", "items are") + " queued next.",
      tone: "clear",
    };
  }

  return {
    label: "Mostly complete",
    detail: "The visible plan is currently quiet.",
    tone: "clear",
  };
}

function deriveSummary(
  workspace: Workspace,
  state: SharedUpdateModel["state"],
  focus: Task[],
  needsAttention: Task[],
  nextUp: Task[],
) {
  if (needsAttention.length > 0) {
    return `${workspace.name} has a clear plan, but "${needsAttention[0].title}" needs attention before the work moves cleanly again.`;
  }

  if (focus.length > 0) {
    return `${workspace.name} is moving now. The current focus is "${focus[0].title}".`;
  }

  if (nextUp.length > 0) {
    return `${workspace.name} is ready for the next visible step: "${nextUp[0].title}".`;
  }

  return `${workspace.name} is in ${state.label.toLowerCase()} state.`;
}

function buildProjectSnapshot(
  project: Project,
  tasks: Task[],
): SharedUpdateProject {
  const done = tasks.filter((task) => task.status === "shipped").length;
  const doing = tasks.filter((task) => task.status === "in-flight").length;
  const next = tasks.filter((task) => task.status === "next").length;
  const waiting = tasks.filter((task) => task.status === "waiting").length;
  const total = tasks.length;

  return {
    project,
    total,
    done,
    doing,
    next,
    waiting,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

function buildStudioUrl(tracking: SourceTracking) {
  const url = new URL(withProtocol(STUDIO_URL));
  const segmentPath = getStudioPathForSegment(tracking.segment);
  if (segmentPath) url.pathname = segmentPath;

  url.searchParams.set("source", tracking.source);
  url.searchParams.set("segment", tracking.segment);
  url.searchParams.set("role", tracking.role);
  url.searchParams.set("campaign", tracking.campaign);
  url.searchParams.set("artefact", tracking.artefact);
  return url.toString();
}

function getStudioPathForSegment(segment: string) {
  if (segment === "weddings") return "/weddings";
  return null;
}

function withProtocol(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return `https://${url}`;
}

function readParam(searchParams: SearchParams | undefined, key: string) {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function sortRoadmapItems(a: Task, b: Task) {
  const dateA = a.targetDate ?? "9999-12-31";
  const dateB = b.targetDate ?? "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return a.sortOrder - b.sortOrder;
}

function sortDoneItems(a: Task, b: Task) {
  const timeA = a.completedAt?.getTime() ?? 0;
  const timeB = b.completedAt?.getTime() ?? 0;
  if (timeA !== timeB) return timeB - timeA;
  return b.sortOrder - a.sortOrder;
}

function pluralise(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
