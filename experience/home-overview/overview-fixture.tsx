/**
 * The Overview's week view, rendered without the app.
 *
 * `?state=` picks the account: `busy` (a wedding with Areas, people, late
 * work, big dates and finished work), `sparse` (one Project, nine tasks, no
 * labels, nobody assigned), `empty` (no tasks), `several` (two Projects) and
 * `review` (nothing can be saved). It mounts the real `OverviewRiver` under
 * the real Home tabs; `overview.mjs` bundles it with the real styles and
 * tokens and stubs only the task actions. It is not a route and ships nowhere.
 */

import { createRoot } from "react-dom/client";
import { HOME_TABPANEL_ID, homeTabId } from "../../src/components/app/home/home-tab-ids";
import { HomeTabs } from "../../src/components/app/home/home-tabs";
import { OverviewRiver } from "../../src/components/app/home/overview/overview-river";
import { buildRiver } from "../../src/lib/home/overview-river";
import { riverFixture, type RiverFixtureState } from "../../src/lib/home/overview-river.fixture";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "./fixture.css";

type Probe = { pushed: string[]; toggled: string[]; dated: Array<{ id: string; due: string | null; dueAt: string | null }>; lanes: Record<string, string>; refuse: boolean };
declare global {
  interface Window {
    overviewProbe: Probe;
  }
}

const params = new URLSearchParams(window.location.search);
const state = (params.get("state") ?? "busy") as RiverFixtureState;
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
window.overviewProbe = { pushed: [], toggled: [], dated: [], lanes: {}, refuse: params.get("refuse") === "1" };

const river = buildRiver(riverFixture(state));
const scopes =
  state === "sparse" || state === "empty"
    ? [{ id: "p-test", name: "Test project", href: "/app/home/briefing?contextVersion=2&workspaceId=p-test", current: true }]
    : [
        { id: "p-mara", name: "Mara & Finn’s wedding", href: "/app/home/briefing?contextVersion=2&workspaceId=p-mara", current: state !== "several" },
        { id: "p-winter", name: "Winter season launch", href: "/app/home/briefing?contextVersion=2&workspaceId=p-winter", current: false },
        { id: "p-barn", name: "Barn roof and heating works", href: "/app/home/briefing?contextVersion=2&workspaceId=p-barn", current: false },
      ];

createRoot(document.getElementById("root")!).render(
  <div className="fixture-shell">
    <main className="fixture-page fixture-page-flush">
      <div className="fixture-scroll thin-scroll">
        <div className="fixture-column">
          <div className="fixture-tabs">
            <HomeTabs current="overview" />
          </div>
          <div id={HOME_TABPANEL_ID} role="tabpanel" aria-labelledby={homeTabId("overview")}>
            <OverviewRiver river={river} scopes={scopes} />
          </div>
        </div>
      </div>
    </main>
  </div>,
);
