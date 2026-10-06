/**
 * The Tasks views (board, list, calendar) with a busy, a sparse and an empty
 * project, rendered without the app.
 *
 * Review mode has one small sample project, so this page stands in for the
 * others. It mounts the real `TasksWorkspace` (the shared header, the tools
 * row and each view) over the in-memory task store the design lab already
 * uses, with the lab's fixed 48-task set pinned to 16 July 2026. `run.mjs`
 * bundles it with the real styles and the v3 tokens and stubs only the seams
 * that need a server or the shell (listed there). It is not a route and
 * ships nowhere.
 *
 * `?view=` is board (default), list or calendar. `?state=` is busy
 * (default), sparse (nine tasks, like a first project), empty, readonly or
 * loading. `?theme=dark` sets the dark tokens.
 */

import { createRoot } from "react-dom/client";
import { TasksWorkspace } from "../../src/components/tasks/tasks-workspace";
import { BoardSkeleton, CalendarSkeleton, HeaderSkeleton, ListSkeleton } from "../../src/components/tasks/skeletons";
import { LabStoreProvider } from "../../src/components/hybrid/store";
import { RoomToolsProvider } from "../../src/components/app/room/room-tools-context";
import { tasksForDataset } from "../../src/components/hybrid/fixtures-dataset";
import type { LabTask } from "../../src/components/hybrid/types";
import "../../src/ds/v3.css";
import "./fixture.css";

type Probe = { opened: Array<string | null>; pushed: string[]; toasts: string[]; composed: unknown[] };
type Record = { id: string; updatedAt: Date; idleDays?: number; seq: number };
declare global {
  interface Window {
    tasksProbe: Probe;
    tasksFixture: { records: Record[] };
  }
}

const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "busy";
const view = (params.get("view") ?? "board") as "board" | "list" | "calendar";
if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
window.tasksProbe = { opened: [], pushed: [], toasts: [], composed: [] };

/* The lab set keeps its ids, dates, people and stages; only the words are a
   venue's, so the page reads like the product does for the people it is for. */
const TITLES = [
  "Agree the winter price list",
  "Order the heating manifold",
  "Reprint the faded welcome sign",
  "Hire extra glassware for the launch evening",
  "Tell October couples about the scaffold",
  "Two quotes for the sound system",
  "Order tonic and the good olives",
  "Menu tasting at The Orchard",
  "Build the Saturday run-sheet",
  "Proof the winter brochure",
  "Approve the seating plan",
  "Chase the florist deposit",
  "Confirm the band's arrival time with The Lindens",
  "Sign off the winter menu",
  "Approve the brochure copy",
  "Lay out the long table for twenty",
  "Sign off the heating quote",
  "Send Mara and Finn the thank-you note",
  "Book the Harbour Coaches shuttle",
  "Agree the photographer's shot list",
  "Walk the site with the photographer",
  "Confirm the coach pick-up times",
  "Pay The Lindens' balance",
  "Update the wedding budget",
  "Rehearsal timings with Mara and Finn",
  "Staff rota for the wedding weekend",
  "Model release forms for the photo shoot",
  "Send the fortieth birthday invitations",
  "Reprint the directional signage",
  "Plan a fallback room for the fortieth",
  "List the thirty stalls we want to fill",
  "Draft a wet-weather plan for the drinks reception",
  "Pick the rooms to shoot",
  "Guest list for the winter launch",
  "Weekly numbers for the owners",
  "Call the bank about the card machine",
  "Show-round for the June couple",
  "Test the outdoor lights before dusk",
  "Deep clean the long barn",
  "Order candles for the long table",
  "Renew the drinks licence",
  "Service the coffee machine",
  "Write the winter welcome letter",
  "Choose the Christmas market dates",
  "Mend the gate on the lower field",
  "Print the table plan",
  "Collect the linen from the laundry",
  "Thank the suppliers after the launch",
];
const NOTES = ["They asked for a reply by Friday.", "Two options on the table, pick one.", "", "Waiting on a call back.", "", "Last year's version is in Files."];

function pick(): LabTask[] {
  if (state === "empty" || state === "loading") return [];
  const source = tasksForDataset("dense").map((task, index) => ({
    ...task,
    title: TITLES[index % TITLES.length],
    description: NOTES[index % NOTES.length],
  }));
  // Sparse: nine tasks in one project, like a first week.
  return state === "sparse" ? source.filter((task) => !task.completed).slice(0, 9) : source;
}

const tasks = pick();

/* How long each started task has gone unchanged. Three have sat four days or
   more, so the header has stuck work to name; the rest changed today. */
const STILL: number[] = [9, 6, 4];
let still = 0;
window.tasksFixture = {
  records: tasks.map((task, index) => {
    const started = !task.completed && !["todo", "done"].includes(task.status);
    const idleDays = state === "busy" && started && still < STILL.length && index % 3 === 0 ? STILL[still++] : undefined;
    return { id: task.id, updatedAt: new Date("2026-07-16T08:00:00.000Z"), idleDays, seq: index + 1 };
  }),
};

function Page() {
  if (state === "loading") {
    return (
      <div className="fixture-loading" aria-busy="true" aria-label="Loading tasks">
        <div className="fixture-column">
          <HeaderSkeleton />
        </div>
        {view === "board" ? <BoardSkeleton /> : view === "list" ? <ListSkeleton /> : <CalendarSkeleton />}
      </div>
    );
  }
  return (
    <RoomToolsProvider>
      <LabStoreProvider
        initialTasks={tasks}
        initialInspectedId={null}
        readOnly={state === "readonly"}
        onInspectedChange={(id) => window.tasksProbe.opened.push(id)}
      >
        <TasksWorkspace view={view} readOnly={state === "readonly"} canManage={state !== "readonly"} />
      </LabStoreProvider>
    </RoomToolsProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <div className="fixture-shell">
    <main className="fixture-page">
      <Page />
    </main>
  </div>,
);
