/**
 * Home, rendered without the app.
 *
 * Review mode has a few sample Projects, so this page stands in for the
 * accounts that matter: `busy`, `behind`, `monday`, `none` (no Projects),
 * `notarget`, `unread` (the finish history could not be read), `chatoff`,
 * `unavailable`, `loading` and `error`. It mounts the real `HomeBentoView`
 * over `homeBentoFixture()`; `home.mjs` bundles it with the real styles and
 * tokens and stubs only the seams that need a server. It is not a route and
 * ships nowhere.
 */

import { createRoot } from "react-dom/client";
import { HomeBentoUnavailable, HomeBentoView } from "../../src/components/app/home/bento/home-bento-view";
import HomeLoading from "../../src/app/app/home/loading";
import HomeError from "../../src/app/app/home/error";
import { buildHomeBento } from "../../src/lib/home/home-bento";
import { homeBentoFixture, type HomeBentoFixtureState } from "../../src/lib/home/home-bento.fixture";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "./fixture.css";

const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "busy";
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";

function Frame() {
  if (state === "loading") return <HomeLoading />;
  if (state === "error") return <HomeError error={Object.assign(new Error("fixture"), { digest: "1482059931" })} reset={() => {}} />;
  if (state === "unavailable") return <HomeBentoUnavailable />;
  const model = buildHomeBento({ ...homeBentoFixture(state as HomeBentoFixtureState), greetingHour: 9 });
  return <HomeBentoView model={model} />;
}

createRoot(document.getElementById("root")!).render(
  <div className="fixture-shell">
    <main className="fixture-page fixture-page-flush">
      <Frame />
    </main>
  </div>,
);
