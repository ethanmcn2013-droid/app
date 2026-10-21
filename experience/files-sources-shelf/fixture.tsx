/**
 * Files, Sources + shelf, rendered without the app.
 *
 * The shelf is shown only to operators, and demo/review builds never show it,
 * so this page is how it is driven and captured. It mounts the real
 * `FilesShelfView` over the same fixed 42-file wedding fixture the Files and
 * Analytics check uses; `run.mjs` bundles it with the real styles and the v3
 * tokens and stubs only `next/link`. It is not a route and ships nowhere.
 *
 * `?state=busy|empty|truncated|loading`, `?source=signal|drive|links`,
 * `?archived=1`, `?theme=dark`.
 */

import { createRoot } from "react-dom/client";
import { FilesShelfView } from "../../src/components/app/files-shelf/files-shelf-view";
import { parseShelfSource } from "../../src/components/app/files-shelf/shelf-model";
import { FilesSkeleton } from "../../src/components/app/files/files-skeleton";
import { FIXTURE_NOW_SECONDS, filesFixture, filesReadFixture } from "../../src/lib/projects/project-files-analytics.fixture";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "../files-analytics/fixture.css";

const root = createRoot(document.getElementById("root")!);

function Page() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state") ?? "busy";
  if (state === "loading") return <FilesSkeleton />;
  const archived = params.get("archived") === "1";
  const all = filesFixture();
  const files =
    state === "empty"
      ? []
      : archived
        ? [{ ...all[3]!, id: "fx-archived", title: "Old run sheet.pdf", taskTitle: "Last year’s plan", taskArchived: true, addedAt: FIXTURE_NOW_SECONDS - 3600 }, ...all]
        : all;
  return (
    <FilesShelfView
      projectName="Mara & Finn’s wedding"
      read={filesReadFixture({ files, truncated: state === "truncated", includesArchived: archived })}
      sample={false}
      requestedProjectId={null}
      initialSource={parseShelfSource(params.get("source"))}
    />
  );
}

let mounted = false;

function render() {
  document.documentElement.dataset.theme = new URLSearchParams(window.location.search).get("theme") === "dark" ? "dark" : "light";
  // The shelf keeps its own state across history entries, as it does in the app.
  if (mounted) return;
  mounted = true;
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
window.fixtureRender = () => {
  mounted = false;
  root.render(<></>);
  render();
};
render();
