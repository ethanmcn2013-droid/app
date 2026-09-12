import "server-only";
import { createClient } from "@libsql/client";
import { auth } from "@clerk/nextjs/server";
import { resolveConversationControls } from "../../lib/conversations/flags";
import { createConversationService } from "./service";
import { createConversationTaskOutcomeService } from "./work-links";
import { createTaskDiscussionService } from "./task-discussion";
import { createLocalConversationDatabaseAdapter, createUnavailableConversationDatabaseAdapter } from "./database";

type Service = ReturnType<typeof createConversationService>;
type TaskOutcomes = ReturnType<typeof createConversationTaskOutcomeService>;
type TaskDiscussion = ReturnType<typeof createTaskDiscussionService>;
type RuntimeServices = Readonly<{ conversation: Service; taskOutcomes: TaskOutcomes; taskDiscussion: TaskDiscussion }>;
const runtimeGlobal = globalThis as typeof globalThis & { conversationLocalRuntime?: { url: string; services: RuntimeServices } };

function unavailableServices(reason: string): RuntimeServices {
  const adapter = createUnavailableConversationDatabaseAdapter(reason);
  return {
    conversation: createConversationService(adapter),
    taskOutcomes: createConversationTaskOutcomeService(adapter),
    taskDiscussion: createTaskDiscussionService(adapter),
  };
}

async function getRuntimeServices(): Promise<RuntimeServices> {
  const url = process.env.TASKS_DATABASE_URL;
  if (!resolveConversationControls(process.env).internalEnabled ||
    process.env.SIGNAL_CONVERSATION_DATABASE_MODE !== "local" ||
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ||
    !url?.startsWith("file:") || url.includes(":memory:")) return unavailableServices("unverified_environment");
  const cached = runtimeGlobal.conversationLocalRuntime;
  if (cached) return cached.url === url ? cached.services : unavailableServices("runtime_configuration_changed");
  const client = createClient({ url });
  // Both services receive this exact adapter. Local serialization therefore
  // covers one connection and one queue across message and task operations.
  const adapter = createLocalConversationDatabaseAdapter({ client: {
    execute: (statement) => client.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] }),
  } });
  const services = {
    conversation: createConversationService(adapter),
    taskOutcomes: createConversationTaskOutcomeService(adapter),
    taskDiscussion: createTaskDiscussionService(adapter),
  };
  runtimeGlobal.conversationLocalRuntime = { url, services };
  return services;
}

/** Explicit local candidate only. Remote primary/session evidence is a release dependency. */
export async function getConversationService(): Promise<Service> {
  return (await getRuntimeServices()).conversation;
}

export async function getConversationTaskOutcomeService(): Promise<TaskOutcomes> {
  return (await getRuntimeServices()).taskOutcomes;
}

export async function getTaskDiscussionService(): Promise<TaskDiscussion> {
  return (await getRuntimeServices()).taskDiscussion;
}

export async function authenticateConversationActor(): Promise<string | null> {
  if (!resolveConversationControls(process.env).internalEnabled ||
    !process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const { userId } = await auth();
  if (!userId) return null;
  return (await getConversationService()).resolveActor(userId);
}
