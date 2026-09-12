import "server-only";
import { createClient } from "@libsql/client";
import { auth } from "@clerk/nextjs/server";
import { resolveConversationControls } from "../../lib/conversations/flags";
import { createConversationService } from "./service";
import { createLocalConversationDatabaseAdapter, createUnavailableConversationDatabaseAdapter } from "./database";

type Service = ReturnType<typeof createConversationService>;
const runtimeGlobal = globalThis as typeof globalThis & { conversationLocalRuntime?: { url: string; service: Service } };

/** Explicit local candidate only. Remote primary/session evidence is a release dependency. */
export async function getConversationService(): Promise<Service> {
  const url = process.env.TASKS_DATABASE_URL;
  if (!resolveConversationControls(process.env).internalEnabled ||
    process.env.SIGNAL_CONVERSATION_DATABASE_MODE !== "local" ||
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ||
    !url?.startsWith("file:") || url.includes(":memory:")) {
    return createConversationService(createUnavailableConversationDatabaseAdapter("unverified_environment"));
  }
  const cached = runtimeGlobal.conversationLocalRuntime;
  if (cached) {
    // A running process never changes its database underneath in-flight operations.
    if (cached.url !== url) return createConversationService(createUnavailableConversationDatabaseAdapter("runtime_configuration_changed"));
    return cached.service;
  }
  const service = createConversationService(createLocalConversationDatabaseAdapter({ client: createClient({ url }) }));
  runtimeGlobal.conversationLocalRuntime = { url, service };
  return service;
}

export async function authenticateConversationActor(): Promise<string | null> {
  if (!resolveConversationControls(process.env).internalEnabled ||
    !process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const { userId } = await auth();
  if (!userId) return null;
  return (await getConversationService()).resolveActor(userId);
}
