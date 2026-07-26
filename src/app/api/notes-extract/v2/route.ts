import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { tasks, workspaces } from "@/server/db/schema";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";
import {
  assertNotesAssertionBindings,
  verifyNotesAssertion,
} from "@/server/cross-product-assertion";
import { resolveNotesExtractAccess } from "@/server/notes-extract-access";
import {
  approvedBodySha256,
  classifyNotesExtractReplay,
  validateExactApprovedBody,
  type ExistingNotesExtractIdentity,
} from "@/server/notes-extract-idempotency";
import { insertOrReadNotesExtractTask } from "@/server/notes-extract-store";

/**
 * Cross-repo Notes -> Tasks exact extract endpoint (v2,
 * 2026-05-12). Notes calls this from its server action when a user
 * presses "Send to Tasks" on a drafted extract. The body is the
 * creator-authored extract wording, never the raw note body.
 *
 * Auth: a short-lived, audience-bound HMAC assertion minted by Notes.
 * The v2 assertion binds the immutable Clerk subject, note id, destination,
 * and SHA-256 of the exact approved wording. V1 assertions fail closed.
 *
 * Idempotency: source_note_id uniquely binds the authenticated subject and
 * note id. Replays additionally require the same workspace and the same exact
 * approved-body SHA-256; legacy or mismatched rows fail closed with 409.
 *
 * Workspace selection: the assertion binds an explicit destination. Current
 * membership is required before either an idempotent task or workspace
 * metadata can be returned; absent membership receives an opaque 401.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExtractPayload = {
  noteId: string;
  body: string;
  workspaceId: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function siteOrigin(): string {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://tasks.signalstudio.ie"
  ).trim();
  try {
    const candidate = new URL(
      configured.includes("://") ? configured : `https://${configured}`,
    );
    if (candidate.protocol !== "https:" && candidate.hostname !== "localhost") {
      throw new Error("unsafe Tasks site origin");
    }
    return candidate.origin;
  } catch {
    return "https://tasks.signalstudio.ie";
  }
}

function replayConflict(
  existing: ExistingNotesExtractIdentity,
  input: { workspaceId: string; body: string; bodySha256: string },
): NextResponse | null {
  const decision = classifyNotesExtractReplay(existing, input);
  if (decision.kind === "match") return null;
  if (decision.kind === "workspace-mismatch") {
    return bad("This note was already sent to another Tasks workspace", 409);
  }
  if (decision.kind === "legacy-unverifiable") {
    return bad(
      "This note was sent before exact retry verification was available. Open the existing Task instead.",
      409,
    );
  }
  return bad("This note was already sent with different approved wording", 409);
}

async function success(
  task: ExistingNotesExtractIdentity,
  created: boolean,
) {
  if (!task.workspaceId || !task.sourceNoteExtractSha256) {
    return bad("This Notes receipt cannot be verified", 409);
  }
  const ws = await loadWorkspaceMeta(task.workspaceId);
  return NextResponse.json({
    taskId: task.id,
    workspaceName: ws?.name ?? "Tasks",
    workspaceSlug: ws?.slug ?? "",
    taskUrl: `${siteOrigin()}/app/tasks?taskId=${encodeURIComponent(task.id)}`,
    acceptedBodySha256: task.sourceNoteExtractSha256,
    created,
  });
}

export async function POST(req: Request) {
  const secret = process.env.NOTES_TO_TASKS_SECRET;
  if (!secret) {
    return bad("Server is not configured for cross-repo extracts", 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return bad("Unauthorized", 401);
  }

  let assertion: ReturnType<typeof verifyNotesAssertion>;
  try {
    assertion = verifyNotesAssertion(match[1]!, secret);
  } catch {
    return bad("Unauthorized", 401);
  }

  let payload: Partial<ExtractPayload>;
  try {
    payload = (await req.json()) as Partial<ExtractPayload>;
  } catch {
    return bad("Invalid JSON body");
  }

  const noteId = typeof payload.noteId === "string" ? payload.noteId.trim() : "";
  let body: string;
  try {
    body = validateExactApprovedBody(payload.body);
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Invalid body");
  }
  const bodySha256 = approvedBodySha256(body);
  const requestedWorkspaceId =
    typeof payload.workspaceId === "string" ? payload.workspaceId.trim() : "";

  if (!noteId) return bad("Missing required field: noteId");
  if (!requestedWorkspaceId) return bad("Missing required field: workspaceId");

  try {
    assertNotesAssertionBindings(assertion, {
      noteId,
      workspaceId: requestedWorkspaceId,
      approvedBodySha256: bodySha256,
    });
  } catch {
    return bad("Unauthorized", 401);
  }
  const userId = assertion.sub;

  const sourceNoteId = `${userId}:${noteId}`;

  const access = await resolveNotesExtractAccess(db, {
    userId,
    requestedWorkspaceId,
    sourceNoteId,
  });
  if (access.kind === "denied") {
    return bad("Unauthorized", 401);
  }

  const existing = access.existing;
  if (existing) {
    const conflict = replayConflict(existing, {
      workspaceId: requestedWorkspaceId,
      body,
      bodySha256,
    });
    return conflict ?? success(existing, false);
  }

  const workspaceId = access.workspaceId;

  // Next position in the default "todo" lane.
  const [maxRow] = await db
    .select({ max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(and(eq(tasks.lane, "todo"), eq(tasks.workspaceId, workspaceId)));
  const position = (maxRow?.max ?? 0) + 1.0;

  const taskId = `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;

  // No static description, the `↩ From Notes` chip in the detail-panel
  // header (rendered when `sourceNoteId` is set) carries the provenance.
  // Prior decorative prose was duplicative chrome dressed as content.
  // Run the creator's extract wording through the same quick-add parser
  // Tasks uses everywhere, so a Notes extract that includes a date or a
  // #tag ("call florist friday #claire-wedding") lands as a properly dated,
  // tagged task instead of a flat title. Keeps Notes free of date/tag
  // pickers (its anti-configuration brand) while still setting them inline.
  const parsed = parseTaskInput(body);
  const canonical = await insertOrReadNotesExtractTask(db, {
    sourceNoteId,
    values: {
      id: taskId,
      workspaceId,
      title: parsed.title || body,
      lane: "todo",
      priority: "p2",
      assignees: [],
      due: parsed.dueLabel,
      dueAt: parsed.dueAt,
      tags: parsed.tags,
      position,
      sourceNoteId,
      sourceNoteExtractBody: body,
      sourceNoteExtractSha256: bodySha256,
    },
  });
  const conflict = replayConflict(canonical.task, {
    workspaceId,
    body,
    bodySha256,
  });
  return conflict ?? success(canonical.task, canonical.created);
}

async function loadWorkspaceMeta(workspaceId: string | null) {
  if (!workspaceId) return null;
  const [row] = await db
    .select({ name: workspaces.name, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row ?? null;
}
