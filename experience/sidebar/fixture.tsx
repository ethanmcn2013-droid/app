/**
 * The sidebar for the readers review mode cannot show, rendered without the
 * app.
 *
 * Review mode has one Project with no status and the seeded conversations,
 * so `run.mjs` on a production build only ever sees "has Chat, one Project,
 * no dot". This page mounts the real `AppShell` and `AppSidebar` over fixed
 * readers instead: `one` (that same reader), `many` (twelve Projects, two
 * with a dot, one with a long name, the open one among them), `none` (no
 * Projects and no conversations yet), `no-chat` (a reader without Chat),
 * `failed` (the Projects read was refused) and `loading` (it has not
 * answered). `fixture-run.mjs` bundles it with the real styles and v3
 * tokens and stubs only the seams that need a server. It is not a route and
 * ships nowhere.
 *
 * `?state=<one|many|none|no-chat|failed|loading>`, `?theme=dark|light`,
 * `?path=/app/...` for the page you are on, `?rail=1` for the collapsed rail.
 */

import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/shell/app-shell";
import { AppSidebar } from "../../src/components/shell/app-sidebar";
import type { ChatDirectory, ChatDirectoryEntry } from "../../src/components/app/messages/messages-unread";
import type { ChooserRow } from "../../src/lib/projects/project-chooser";
import type { SidebarProjectMark } from "../../src/lib/projects/sidebar-mark";
import "../../src/ds/v3.css";
import "../project-console/fixture.css";
import "./fixture.css";

type SidebarAnswer =
  | { ok: true; rows: readonly ChooserRow[]; marks: Readonly<Record<string, SidebarProjectMark>> }
  | { ok: false; reason: "unavailable" };

declare global {
  interface Window {
    sidebarFixture: { answer: SidebarAnswer | null; currentProjectId: string | null; selected: string[] };
  }
}

const params = new URLSearchParams(window.location.search);
const state = params.get("state") ?? "one";
const theme = params.get("theme") === "light" ? "light" : "dark";
document.documentElement.dataset.theme = theme;
try {
  window.localStorage.setItem("signal:theme-mode", theme);
  window.localStorage.setItem("signal:v3:sidebar-collapsed", params.get("rail") === "1" ? "1" : "0");
} catch {
  // The rail falls back to expanded; the run says so when it checks.
}

function row(id: string, name: string, open = 4): ChooserRow {
  const words = name.split(/\s+/);
  const monogram = ((words[0]?.[0] ?? "") + (words.length > 1 ? words.at(-1)![0] : "")).toUpperCase();
  return {
    id,
    name,
    disambiguator: null,
    subtitle: `${open} open tasks`,
    accessibleName: name,
    archived: false,
    role: "owner",
    selectable: true,
    blockedReason: null,
    activeRootTaskCount: open,
    monogram,
    project: { id, name } as unknown as ChooserRow["project"],
  } as ChooserRow;
}

const ORCHARD = row("p-orchard", "The Orchard, events");
const MANY = [
  ORCHARD,
  row("p-kitchen", "Kitchen refit"),
  row("p-wedding", "Aoife and Ciarán's wedding", 18),
  row("p-term", "Autumn term, fifth year English"),
  row("p-thesis", "Thesis, chapter three"),
  row("p-launch", "Spring menu launch for the cafe and the two market stalls"),
  row("p-garden", "Community garden"),
  row("p-books", "Year-end books"),
  row("p-move", "Moving house"),
  row("p-choir", "Choir concert"),
  row("p-site", "New website"),
  row("p-trip", "Lisbon trip"),
];

const answers: Record<string, SidebarAnswer | null> = {
  one: { ok: true, rows: [ORCHARD], marks: {} },
  many: { ok: true, rows: MANY, marks: { "p-kitchen": "late", "p-launch": "risk" } },
  none: { ok: true, rows: [], marks: {} },
  "no-chat": { ok: true, rows: [ORCHARD, MANY[1]!, MANY[2]!], marks: { "p-kitchen": "late" } },
  failed: { ok: false, reason: "unavailable" },
  loading: null,
};

window.sidebarFixture = {
  answer: state in answers ? (answers[state] ?? null) : answers.one!,
  currentProjectId: state === "none" ? null : state === "many" ? "p-launch" : "p-orchard",
  selected: [],
};

function chat(id: string, kind: ChatDirectoryEntry["kind"], title: string, count = 0, extra: Partial<ChatDirectoryEntry> = {}): ChatDirectoryEntry {
  return { id, kind, title, href: `/app/messages?c=${id}`, count, unread: count > 0, ...extra };
}

const DIRECTORY: ChatDirectory = {
  channels: [chat("c-orchard", "channel", "The Orchard, events", 1), chat("c-runsheet", "task", "Build the Saturday run-sheet", 1)],
  direct: [
    chat("d-niamh", "dm", "Niamh Kelly", 1, { personId: "u-niamh", online: true }),
    chat("d-dara", "dm", "Dara Quinn", 0, { personId: "u-dara" }),
    chat("d-ciaran", "dm", "Ciarán Byrne", 0, { personId: "u-ciaran", request: true, unread: true }),
  ],
  newMessageHref: "/app/messages/new",
};
const EMPTY_DIRECTORY: ChatDirectory = { channels: [], direct: [], newMessageHref: "/app/messages/new" };

const messagesEnabled = state !== "no-chat";

createRoot(document.getElementById("root")!).render(
  <AppShell
    sidebar={
      <AppSidebar
        messagesEnabled={messagesEnabled}
        messagesUnread={messagesEnabled && state !== "none" ? 3 : 0}
        chatDirectory={messagesEnabled ? (state === "none" ? EMPTY_DIRECTORY : DIRECTORY) : null}
      />
    }
  >
    {/* Every real page has its own heading; this one stands in for it. */}
    <main className="fixture-page">
      <h1 className="sr-only">Page</h1>
    </main>
  </AppShell>,
);
