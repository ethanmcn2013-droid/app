/**
 * Home, rendered without the app.
 *
 * Review mode has one sample Project, so this page stands in for the accounts
 * that matter: `busy` (twelve Projects), `sparse` (one Project, nine tasks,
 * none assigned), `empty` (a Project with no tasks), `none` (no Projects),
 * `partial` (the counts could not be read), `review` (nothing can be saved or
 * sent), `loading` and `error`. It mounts the real `HomeBoardView` over
 * `homeFixture()`; `run.mjs` bundles it with the real styles and tokens and
 * stubs only the seams that need a server. It is not a route and ships nowhere.
 */

import { createRoot } from "react-dom/client";
import { HomeBoardView } from "../../src/components/app/home/home-board";
import HomeLoading from "../../src/app/app/home/loading";
import HomeError from "../../src/app/app/home/error";
import { buildHomeBoard } from "../../src/lib/home/home-board";
import { homeFixture, type HomeFixtureState } from "../../src/lib/home/home-board.fixture";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "./fixture.css";

type Probe = { pushed: string[]; nudged: string[]; toggled: string[]; lanes: Record<string, string>; refuse: boolean };
declare global {
  interface Window {
    homeProbe: Probe;
  }
}

const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "busy";
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
window.homeProbe = { pushed: [], nudged: [], toggled: [], lanes: {}, refuse: params.get("refuse") === "1" };

function Frame() {
  if (state === "loading") return <HomeLoading />;
  if (state === "error") return <HomeError error={Object.assign(new Error("fixture"), { digest: "1482059931" })} reset={() => {}} />;
  const board = buildHomeBoard(homeFixture(state as HomeFixtureState));
  return <HomeBoardView board={board} overviewHref="/app/home/briefing?contextVersion=2&workspaceId=p-mara" pinnedGreeting={params.get("hour") ? null : "Good morning"} />;
}

createRoot(document.getElementById("root")!).render(
  <div className="fixture-shell">
    <main className="fixture-page fixture-page-flush">
      <Frame />
    </main>
  </div>,
);
