import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { tasks, workspaces } from "@/server/db/schema";
import { parseTaskInput } from "@/lib/nlp/parse-task-input";
import { verifyLegacyNotesAssertion } from "@/server/cross-product-assertion";
import { resolveNotesExtractAccess } from "@/server/notes-extract-access";

/**
 * Legacy Notes -> Tasks v1 receiver retained as an immutable rollback seam.
 * New Hybrid extracts use /api/notes-extract/v2. Do not add v2 acceptance here:
 * keeping the protocols on separate routes prevents downgrade ambiguity.
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
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://tasks.signalstudio.ie"
  ).replace(/\/+$/, "");
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

  let assertion: ReturnType<typeof verifyLegacyNotesAssertion>;
  try {
    assertion = verifyLegacyNotesAssertion(match[1]!, secret);
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
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const requestedWorkspaceId =
    typeof payload.workspaceId === "string" ? payload.workspaceId.trim() : "";

  if (!noteId) return bad("Missing required field: noteId");
  if (!body) return bad("Missing required field: body");
  if (!requestedWorkspaceId) return bad("Missing required field: workspaceId");
  if (body.length > 280) return bad("body is longer than 280 characters");

  if (assertion.noteId !== noteId) return bad("Unauthorized", 401);
  if (assertion.workspaceId !== requestedWorkspaceId) {
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
    if (existing.workspaceId !== requestedWorkspaceId) {
      return bad("This note was already sent to another Tasks workspace", 409);
    }
    const ws = await loadWorkspaceMeta(existing.workspaceId);
    return NextResponse.json({
      taskId: existing.id,
      workspaceName: ws?.name ?? "Tasks",
      workspaceSlug: ws?.slug ?? "",
      taskUrl: `${siteOrigin()}/app/tasks?taskId=${encodeURIComponent(existing.id)}`,
      created: false,
    });
  }

  const workspaceId = access.workspaceId;
  const ws = await loadWorkspaceMeta(workspaceId);

  const [maxRow] = await db
    .select({ max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(and(eq(tasks.lane, "todo"), eq(tasks.workspaceId, workspaceId)));
  const position = (maxRow?.max ?? 0) + 1.0;

  const taskId = `t-${(
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  ).slice(0, 8)}`;
  const parsed = parseTaskInput(body);
  await db.insert(tasks).values({
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
  });

  return NextResponse.json({
    taskId,
    workspaceName: ws?.name ?? "Tasks",
    workspaceSlug: ws?.slug ?? "",
    taskUrl: `${siteOrigin()}/app/tasks?taskId=${encodeURIComponent(taskId)}`,
    created: true,
  });
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
