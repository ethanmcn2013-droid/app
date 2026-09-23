import "server-only";
import { createClient } from "@libsql/client";
import { auth } from "@clerk/nextjs/server";
import { isDemoMode } from "../../lib/access-mode";
import { conversationAvailability, resolveConversationControls } from "../../lib/conversations/flags";
import { createConversationService } from "./service";
import { createConversationTaskOutcomeService } from "./work-links";
import { createTaskDiscussionService } from "./task-discussion";
import { createMessageAttentionService } from "./attention";
import { createLocalConversationDatabaseAdapter, createRemoteConversationDatabaseAdapter, createUnavailableConversationDatabaseAdapter, type ConversationDatabaseAdapter } from "./database";
import { resolveConversationRuntimeTarget } from "./runtime-target";

type Service = ReturnType<typeof createConversationService>;
type TaskOutcomes = ReturnType<typeof createConversationTaskOutcomeService>;
type TaskDiscussion = ReturnType<typeof createTaskDiscussionService>;
type Attention = ReturnType<typeof createMessageAttentionService>;
type RuntimeServices = Readonly<{ conversation: Service; taskOutcomes: TaskOutcomes; taskDiscussion: TaskDiscussion; attention: Attention }>;
const runtimeGlobal = globalThis as typeof globalThis & { conversationRuntime?: { cacheKey: string; services: RuntimeServices } };

function servicesFor(adapter: ConversationDatabaseAdapter): RuntimeServices {
  const directMessagesEnabled = resolveConversationControls(process.env).directMessagesEnabled;
  return {
    conversation: createConversationService(adapter, { directMessagesEnabled }),
    taskOutcomes: createConversationTaskOutcomeService(adapter, { directMessagesEnabled }),
    taskDiscussion: createTaskDiscussionService(adapter),
    attention: createMessageAttentionService(adapter),
  };
}

function unavailableServices(reason: string): RuntimeServices {
  const adapter = createUnavailableConversationDatabaseAdapter(reason);
  return servicesFor(adapter);
}

async function getRuntimeServices(): Promise<RuntimeServices> {
  const target = resolveConversationRuntimeTarget(process.env, isDemoMode());
  if (target.mode === "unavailable") return unavailableServices(target.reason);
  const cacheKey = `${target.cacheKey}:dm=${resolveConversationControls(process.env).directMessagesEnabled}`;
  const cached = runtimeGlobal.conversationRuntime;
  if (cached) return cached.cacheKey === cacheKey ? cached.services : unavailableServices("runtime_configuration_changed");
  const client = createClient(target.mode === "remote"
    ? { url: target.url, authToken: target.authToken }
    : { url: target.url });
  const execute = (statement: string | { sql: string; args?: readonly (string | number | bigint | null | Uint8Array)[] }) =>
    client.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] });
  // Every service shares this exact adapter. A remote transaction handle is
  // also the executor for its membership proof and subsequent source write.
  const adapter = target.mode === "remote"
    ? createRemoteConversationDatabaseAdapter({ client: {
        transaction: async (mode) => {
          const transaction = await client.transaction(mode);
          return {
            execute: (statement) => transaction.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] }),
            commit: () => transaction.commit(),
            rollback: () => transaction.rollback(),
          };
        },
      } })
    : createLocalConversationDatabaseAdapter({ client: { execute } });
  const services = servicesFor(adapter);
  runtimeGlobal.conversationRuntime = { cacheKey, services };
  return services;
}

/** Remote operation is explicitly pinned; provider acceptance remains separate. */
export async function getConversationService(): Promise<Service> {
  return (await getRuntimeServices()).conversation;
}

export async function getConversationTaskOutcomeService(): Promise<TaskOutcomes> {
  return (await getRuntimeServices()).taskOutcomes;
}

export async function getTaskDiscussionService(): Promise<TaskDiscussion> {
  return (await getRuntimeServices()).taskDiscussion;
}

export async function getMessageAttentionService(): Promise<Attention> {
  return (await getRuntimeServices()).attention;
}

export async function authenticateConversationActor(mode: "read" | "write" = "read"): Promise<string | null> {
  const controls = resolveConversationControls(process.env);
  if (!controls.internalEnabled ||
    !process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const actorId = await (await getConversationService()).resolveActor(userId);
  if (!actorId) return null;
  const availability = conversationAvailability(controls, actorId);
  return availability.read && (mode === "read" || availability.send) ? actorId : null;
}
