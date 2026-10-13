import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { localOperationRequestAllowed, assertLocalOperationNotExpired } from "@/server/tasks/local-operation-policy";
import { applyLocalOperation, reconcileLocalOperation, readLocalTasks, parseLocalOperation, LocalOperationError } from "@/server/tasks/local-operation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
async function handle(request: Request, method: "create" | "title" | "reconcile" | "read") {
  if (!localOperationRequestAllowed(request)) return reply({ error: "unavailable" }, 404);
  try {
    // Ordinary Clerk verification; never accept the dev identity fallback.
    const session = await auth();
    if (!session.userId) return reply({ error: "unavailable" }, 404);
    if (!process.env.SIGNAL_LOCAL_TASK_SUBJECTS?.split(",").includes(session.userId) || session.sessionClaims?.iss !== process.env.SIGNAL_LOCAL_TASK_ISSUER || session.sessionClaims?.azp !== process.env.SIGNAL_LOCAL_TASK_ORIGIN) return reply({ error: "unavailable" }, 404);
    assertLocalOperationNotExpired();
    const [actor] = await db.select({ id: users.id }).from(users).where(and(eq(users.clerkId, session.userId), eq(users.id, session.userId))).limit(1);
    if (!actor) return reply({ error: "unavailable" }, 404);
    if (method === "read") {
      const params = new URL(request.url).searchParams;
      if ([...params.keys()].some(key => key !== "projectId" && key !== "taskId") || params.getAll("projectId").length !== 1 || params.getAll("taskId").length > 1) return reply({ error: "invalid" }, 400);
      const read = await readLocalTasks(db, actor.id, params.get("projectId")!, params.get("taskId") ?? undefined);
      assertLocalOperationNotExpired();
      return reply({ ...read, identity: { subject: session.userId, issuer: session.sessionClaims.iss, authorizedParty: session.sessionClaims.azp } });
    }
    if (request.headers.get("content-type") !== "application/json") return reply({ error: "invalid" }, 400);
    const body = await request.text();
    if (body.length > 4096) return reply({ error: "invalid" }, 400);
    let input: unknown;
    try { input = JSON.parse(body); } catch { return reply({ error: "invalid" }, 400); }
    const operation = parseLocalOperation(input);
    if (method !== "reconcile" && operation.kind !== method) return reply({ error: "invalid" }, 400);
    const result = method === "reconcile" ? await reconcileLocalOperation(db, actor.id, operation) : await applyLocalOperation(db, actor.id, operation);
    assertLocalOperationNotExpired();
    return reply(result);
  } catch (error) {
    const code = error instanceof LocalOperationError ? error.code : "unavailable";
    return reply({ error: code }, code === "invalid" ? 400 : code === "conflict" || code === "corrupt" ? 409 : 404);
  }
}
export const POST = (request: Request) => handle(request, "create");
export const PATCH = (request: Request) => handle(request, "title");
export const GET = (request: Request) => handle(request, "read");
/** Read before retry without exposing receipts through URL/query logs. */
export const PUT = (request: Request) => handle(request, "reconcile");
