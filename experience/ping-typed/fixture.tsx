import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CurrentUserProvider } from "@/lib/auth-context";
import { DomainProvider } from "@/lib/domain-context";
import { TasksProvider, useTasksState } from "@/lib/tasks/tasks-context";
import { RoomBriefProvider } from "@/components/app/room/room-brief-context";
import { RoomToolsProvider } from "@/components/app/room/room-tools-context";
import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { createCalendarFrame } from "@/lib/calendar-frame";
import type { Task } from "@/lib/data";
import "@/ds/v3.css";
import "./fixture.css";

// Explicit browser-fixture auth and initial read adapters. Ping refresh itself
// must travel through the real panel, HTTP handler and provider hydration seam.
type Props = { actorId: string; projectId: string; tasks: Task[] };
declare global {
  interface Window {
    pingObserved: Task[];
    pingMount: (props: Props) => void;
    pingFixtureUser: string;
    pingFixtureSession: string;
  }
}
const calendarFrame = createCalendarFrame({ now: new Date("2026-10-06T09:00:00Z"), timeZone: "Europe/Dublin", source: "review" });
function revive(tasks: Task[]): Task[] {
  return tasks.map(task => {
    const next = { ...task };
    for (const field of ["dueAt", "updatedAt", "archivedAt", "completedAt"] as const) {
      const value = next[field];
      if (typeof value === "string") Object.assign(next, { [field]: new Date(value) });
    }
    return next;
  });
}
function Probe() {
  const { tasks } = useTasksState();
  useEffect(() => { window.pingObserved = tasks; }, [tasks]);
  return <output hidden data-ping-observed>{JSON.stringify(tasks.map(task => ({ id: task.id, lane: task.lane, assignees: task.assignees })))}</output>;
}
function Fixture() {
  const [props, setProps] = useState<Props | null>(null);
  useEffect(() => {
    window.pingMount = value => setProps({ ...value, tasks: revive(value.tasks) });
    void fetch("/fixture/initial").then(response => response.json()).then(window.pingMount);
  }, []);
  if (!props) return null;
  return <CurrentUserProvider user={props.actorId}>
    <DomainProvider domain="wedding" workspaceId={props.projectId} workspaceSlug={props.projectId} workspaceName="Synthetic Ping project"
      personalization={{ headline: "Plan the work", body: "An isolated synthetic project.", firstTaskExample: "A task", workspaceTitle: "Synthetic Ping project" }}
      members={[{ id: "alice", name: "Alice", initials: "AL", role: "member", color: "#555" }, { id: "bob", name: "Bob", initials: "BO", role: "member", color: "#777" }]}>
      <TasksProvider key={JSON.stringify([props.actorId, props.projectId])} actorId={props.actorId} projectId={props.projectId} initialTasks={props.tasks}>
        <RoomBriefProvider value={{ calendarFrame, periodName: null, dateWindow: null, ownerName: "Synthetic owner", purpose: "Isolated synthetic browser verification" }}>
          <RoomToolsProvider><main><HybridWorkspace view="list" canEdit canManage={false} /><Probe /></main></RoomToolsProvider>
        </RoomBriefProvider>
      </TasksProvider>
    </DomainProvider>
  </CurrentUserProvider>;
}
window.pingFixtureUser = "clerk_alice";
window.pingFixtureSession = "synthetic-browser-session";
createRoot(document.getElementById("root")!).render(<Fixture />);
