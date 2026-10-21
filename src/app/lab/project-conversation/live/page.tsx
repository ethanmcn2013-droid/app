import { notFound } from "next/navigation";
import { ConversationWorkspace } from "@/components/app/messages/conversation-workspace";
import { parseProjectId } from "@/lib/projects/project-ref";

const actors = {
  alice: "synthetic_alice",
  bob: "synthetic_bob",
  charlie: "synthetic_charlie",
} as const;

const projects = [
  { id: parseProjectId("synthetic_project_a")!, name: "Website launch" },
  { id: parseProjectId("synthetic_project_b")!, name: "Autumn exhibition" },
] as const;

export default async function LiveProjectConversationLab({ searchParams }: { searchParams: Promise<{ actor?: string | string[]; panel?: string | string[] }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const requested = params.actor;
  const fixtureActor = typeof requested === "string" && requested in actors ? requested as keyof typeof actors : "alice";
  // ?panel=1 renders the floating panel's stacked layout at its real size.
  if (params.panel === "1") return <div style={{ position: "fixed", right: 24, bottom: 24, width: "min(500px, calc(100vw - 48px))", height: "min(620px, 72dvh)", border: "1px solid var(--v3-border)", borderRadius: 14, overflow: "hidden", background: "var(--v3-canvas)", display: "flex" }}><ConversationWorkspace actorId={actors[fixtureActor]} fixtureActor={actors[fixtureActor]} projects={projects} stacked /></div>;
  return <div style={{ height: "100dvh", background: "white" }}><ConversationWorkspace actorId={actors[fixtureActor]} fixtureActor={actors[fixtureActor]} projects={projects} /></div>;
}
