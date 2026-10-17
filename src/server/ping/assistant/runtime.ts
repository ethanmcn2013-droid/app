import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { isDemoMode } from "@/lib/access-mode";
import { assistantTarget, createAssistantAuthentication } from "./controls";
import { createAssistantStore } from "./store";
import { createAssistantService } from "./service";
import { createPingAssistantPlanner } from "./claude-planner";
import { assertAssistantActor, authorizeAssistantProject, getAssistantContext } from "./context";
import { executeAssistantAction } from "./actions";
import { prepareAssistantTimeline } from "./timeline";
import { createAssistantDispatcher } from "./dispatch";
import { pingTelemetrySpan } from "../telemetry";
import type { AssistantActionResult } from "@/lib/ping/assistant/contract";

type Target = NonNullable<ReturnType<typeof assistantTarget>>;
const currentTarget = () => assistantTarget(process.env, isDemoMode());
type Instance = ReturnType<typeof createInstance>;
const shared = globalThis as typeof globalThis & { pingAssistantRuntime?: { key: string; instance: Instance } };

function createInstance(target: Target) {
  const client = createClient({ url: target.url, authToken: target.authToken });
  const database = drizzle(client, { schema });
  const store = createAssistantStore(database);
  const stillCurrent = () => currentTarget()?.cacheKey === target.cacheKey;
  const transact = <T>(operation: Parameters<typeof database.transaction<T>>[0]) => {
    if (!stillCurrent()) throw new Error("assistant_configuration_changed");
    return database.transaction(operation, { behavior: "immediate" });
  };
  const key = process.env.ANTHROPIC_API_KEY;
  // One instance retains transport quarantine after a logical timeout. Changing
  // credentials requires restart; old result reads remain available meanwhile.
  const planner = key ? createPingAssistantPlanner({ apiKey: key, fetch, budget: store.budget }) : null;
  const dispatcher = createAssistantDispatcher(database);
  const service = createAssistantService({ store,
    planner: { plan: (input, signal) => {
      if (!planner || !stillCurrent() || process.env.ANTHROPIC_API_KEY !== key) throw new Error("planner_unavailable");
      return pingTelemetrySpan("prepare", () => planner.plan(input, signal ?? new AbortController().signal));
    } },
    priorTaskResult: async (actorId, request) => {
      for (const run of await store.listRuns(actorId)) {
        if (run.requestId === request.requestId) continue;
        const results = Object.values(await store.getStepResults<AssistantActionResult>(actorId, run.id));
        const prior = results.filter(result => result.kind === "create_tasks" && result.status === "completed" && result.createdTaskIds?.length &&
          (request.scope.kind !== "project" || result.projectId === request.scope.projectId)).at(-1);
        if (!prior?.projectId) continue;
        try { await transact(tx => authorizeAssistantProject(tx, actorId, prior.projectId!)); return prior; } catch { return undefined; }
      }
      return undefined;
    },
    context: (actorId, request) => transact(async tx => {
      const actor = await assertAssistantActor(tx, actorId);
      const context = await getAssistantContext(tx, actorId, request.scope.kind === "project" ? request.scope.projectId : null);
      const [preferences] = await tx.select({ timeZone: schema.userPreferences.timeZone }).from(schema.userPreferences).where(eq(schema.userPreferences.userId, actorId)).limit(1);
      let timeZone = preferences?.timeZone ?? "UTC";
      if (context.project) {
        const [period] = await tx.select({ timeZone: schema.planningPeriods.timezone }).from(schema.workspaces)
          .innerJoin(schema.planningPeriods, eq(schema.planningPeriods.id, schema.workspaces.planningPeriodId)).where(eq(schema.workspaces.id, context.project.id)).limit(1);
        timeZone = period?.timeZone ?? timeZone;
      }
      try { new Intl.DateTimeFormat("en", { timeZone }).format(); } catch { timeZone = "UTC"; }
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const day = (kind: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === kind)!.value;
      return { actorName: actor.name ?? "You", projectName: context.project?.name ?? null, projects: context.projects.map(p => ({ name: p.name })),
        members: context.members.map(m => ({ name: m.name ?? "Unnamed member" })), selectedTaskCount: request.selectedTaskIds?.length ?? 0,
        previousTaskCount: 0, referenceDate: `${day("year")}-${day("month")}-${day("day")}`, timeZone };
    }),
    authorizeView: (actorId, run) => transact(async tx => {
      try {
        await assertAssistantActor(tx, actorId);
        const projects = new Set(run.steps.flatMap(s => s.result?.projectId ? [s.result.projectId] : []));
        if (run.scope.kind === "project") projects.add(run.scope.projectId);
        for (const projectId of projects) await authorizeAssistantProject(tx, actorId, projectId);
        return true;
      } catch { return false; }
    }),
    execute: input => pingTelemetrySpan("execute", () => executeAssistantAction({ ...input, dispatch: dispatcher, deliveryTransaction: transact,
      prepareTimeline: action => prepareAssistantTimeline(action, (actorId, projectId) => transact(async tx => {
        const actor = await assertAssistantActor(tx, actorId), project = await authorizeAssistantProject(tx, actorId, projectId);
        const owner = await assertAssistantActor(tx, project.ownerUserId!);
        if (!actor.clerkId || !owner.clerkId) throw new Error("timeline_identity_unavailable");
        return { clerkId: actor.clerkId, ownerClerkId: owner.clerkId, id: project.id, slug: project.slug, name: project.name };
      })) })),
  });
  return { database, service, transact };
}

function instance(target: Target) {
  const prior = shared.pingAssistantRuntime;
  if (prior) return prior.key === target.cacheKey ? prior.instance : null;
  const created = createInstance(target); shared.pingAssistantRuntime = { key: target.cacheKey, instance: created }; return created;
}
export const authenticateAssistantActor = createAssistantAuthentication({ target: currentTarget,
  session: async () => { const session = await auth(); return { userId: session.userId, sessionId: session.sessionId }; },
  resolveActor: async (clerkId, target) => {
    const runtime = instance(target); if (!runtime) return null;
    return runtime.transact(async tx => {
      const [user] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.clerkId, clerkId)).limit(1);
      if (!user) return null;
      await assertAssistantActor(tx, user.id); return user.id;
    });
  },
});
export async function getAssistantService(actorId: string) {
  const target = currentTarget(); return target?.actors.includes(actorId) ? instance(target)?.service ?? null : null;
}
