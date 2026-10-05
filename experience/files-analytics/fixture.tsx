/**
 * Files and Analytics with a busy, a sparse and an empty account, rendered
 * without the app.
 *
 * Review mode has eight sample files and one project, so this page stands in
 * for accounts the review build cannot show. It mounts the real `FilesView`
 * and `AnalyticsView` over fixed fixtures; `run.mjs` bundles it with the real
 * styles and v3 tokens and stubs only `next/link` (so a link changes the
 * address in place, as the router would). It is not a route and ships nowhere.
 *
 * `?surface=files|analytics`, `?state=busy|sparse|empty|loading|unavailable`
 * (Files also `truncated`; Analytics also `partial` for a wall whose extra
 * reads failed, `wall-down` for one that could not be listed, `twelve` for a
 * twelve-project wall and `no-record` for date changes that were not read),
 * plus the page's own parameters (`scope`, `workspaceId`, `ask`, `view`,
 * `sort`, `range`, `archived`). Analytics covers four projects made of the
 * busy fixture's own tasks unless `workspaceId` names one.
 * `?theme=dark` sets the dark tokens.
 */

import { createRoot } from "react-dom/client";
import { FilesSkeleton, FilesUnavailable, FilesView } from "../../src/components/app/files/files-view";
import { AnalyticsUnavailable, AnalyticsView, parseAnalyticsPart } from "../../src/components/app/analytics/analytics-view";
import AnalyticsLoading from "../../src/app/app/analytics/loading";
import { computeProjectAnalytics, parseAnalyticsRange } from "../../src/lib/projects/project-analytics";
import { NO_STANDING, parseQuestion } from "../../src/lib/projects/project-analytics-questions";
import { parseWallSort } from "../../src/lib/projects/project-analytics-wall";
import { consoleFixture } from "../../src/lib/projects/project-console.fixture";
import {
  ANALYTICS_FIXTURE_STANDING,
  FIXTURE_NOW_SECONDS,
  analyticsInputFixture,
  filesFixture,
  filesReadFixture,
  portfolioFixture,
  sparseAnalyticsInput,
} from "../../src/lib/projects/project-files-analytics.fixture";
import type { AnalyticsWall } from "../../src/server/projects/project-analytics-wall";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "./fixture.css";

const root = createRoot(document.getElementById("root")!);

function Page() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state") ?? "busy";
  const surface = params.get("surface") ?? "files";

  if (surface === "files") {
    if (state === "loading") return <FilesSkeleton />;
    if (state === "unavailable") return <FilesUnavailable />;
    const all = filesFixture();
    const files =
      state === "empty"
        ? []
        : state === "sparse"
          ? all.filter((file) => file.title === "Seating plan v4" || file.title === "Terrace at golden hour.jpg").map((file) => ({ ...file, addedByName: null }))
          : params.get("archived") === "1"
            ? [{ ...all[3]!, id: "fx-archived", title: "Old run sheet.pdf", taskTitle: "Last year’s plan", taskArchived: true, addedAt: FIXTURE_NOW_SECONDS - 3600 }, ...all]
            : all;
    return (
      <FilesView
        projectName="Mara & Finn’s wedding"
        read={filesReadFixture({ files, truncated: state === "truncated", includesArchived: params.get("archived") === "1" })}
        sample={state === "sample"}
        requestedProjectId={null}
      />
    );
  }

  if (state === "loading") return <AnalyticsLoading />;
  if (state === "unavailable") return <AnalyticsUnavailable />;
  const range = parseAnalyticsRange(params.get("range"));
  const part = parseAnalyticsPart(params.get("view"));
  const ask = parseQuestion(params.get("ask"));
  const sort = parseWallSort(params.get("sort"));
  const portfolio = portfolioFixture();
  const many = (state === "twelve" ? consoleFixture().projects.filter((project) => project.stats?.status !== "complete") : portfolio.projects).map((project) => ({
    id: project.id,
    name: project.name,
  }));

  // The founder's own account: one project, nine tasks, nobody assigned.
  if (state === "sparse" || state === "empty") {
    const only = [{ id: "p-first", name: "My first project" }];
    const analytics = computeProjectAnalytics(state === "empty" ? analyticsInputFixture({ tasks: [], range, dueChanges: [] }) : { ...sparseAnalyticsInput(), range });
    const done = analytics.status.filter((row) => row.isDone).reduce((sum, row) => sum + row.count, 0);
    const total = analytics.status.reduce((sum, row) => sum + row.count, 0);
    const wall: AnalyticsWall = {
      kind: "ready",
      today: portfolio.today,
      truncated: false,
      statsUnavailable: false,
      projects: [
        {
          id: "p-first",
          name: "My first project",
          role: "primary-owner",
          selectable: true,
          blockedReason: null,
          openCount: total - done,
          stats: { status: null, targetDate: null, purpose: null, total, complete: done, overdue: analytics.overdue.count },
          facts: { lead: { name: "Ethan", initials: "ET" }, nextDate: null, oldestLate: null, nudge: null, doneByDay: analytics.recent.days.map((day) => day.finished) },
        },
      ],
    };
    return (
      <AnalyticsView
        scope={{ kind: "one", projectId: "p-first", name: "My first project", standing: NO_STANDING }}
        analytics={analytics}
        projects={only}
        part={part}
        ask={ask}
        sort={sort}
        everyProject
        wall={part === "projects" ? wall : null}
        linkProjectId={null}
      />
    );
  }

  const wall: AnalyticsWall =
    state === "wall-down"
      ? { kind: "unavailable" }
      : {
          kind: "ready",
          today: portfolio.today,
          truncated: false,
          statsUnavailable: false,
          projects: state === "partial" ? portfolio.projects.map((project) => ({ ...project, facts: null })) : state === "twelve" ? consoleFixture().projects : portfolio.projects,
        };
  const projectId = params.get("workspaceId");
  if (projectId) {
    // One project out of several: the busy fixture, named as the one chosen.
    const chosen = many.find((project) => project.id === projectId) ?? many[0]!;
    return (
      <AnalyticsView
        scope={{ kind: "one", projectId: chosen.id, name: chosen.name, standing: ANALYTICS_FIXTURE_STANDING }}
        analytics={computeProjectAnalytics(analyticsInputFixture({ range, dueChanges: state === "no-record" ? null : undefined }))}
        projects={many}
        part={part}
        ask={ask}
        sort={sort}
        everyProject
        wall={part === "projects" ? wall : null}
        linkProjectId={chosen.id}
      />
    );
  }
  return (
    <AnalyticsView
      scope={{ kind: "all" }}
      analytics={computeProjectAnalytics({ ...portfolio.input, range, dueChanges: state === "no-record" ? null : portfolio.input.dueChanges })}
      projects={many}
      part={part}
      ask={ask}
      sort={sort}
      everyProject
      wall={wall}
      linkProjectId={null}
    />
  );
}

function render() {
  document.documentElement.dataset.theme = new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light";
  root.render(
    <div className="fixture-shell">
      <main className="fixture-main">
        <Page />
      </main>
    </div>,
  );
}

declare global {
  interface Window {
    fixtureRender: () => void;
  }
}
window.fixtureRender = render;
window.addEventListener("popstate", render);
render();
