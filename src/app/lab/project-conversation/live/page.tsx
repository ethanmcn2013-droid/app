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

export default async function LiveProjectConversationLab({ searchParams }: { searchParams: Promise<{ actor?: string | string[] }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const requested = (await searchParams).actor;
  const fixtureActor = typeof requested === "string" && requested in actors ? requested as keyof typeof actors : "alice";
  return <div style={{ height: "100dvh", background: "white" }}><ConversationWorkspace actorId={actors[fixtureActor]} fixtureActor={actors[fixtureActor]} projects={projects} /></div>;
}
