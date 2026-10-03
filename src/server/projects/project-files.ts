import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments, resources, tasks, users } from "@/server/db/schema";
import { userDisplayName } from "@/lib/user-display-name";
import { isDemoMode } from "@/lib/access-mode";
import { demoTasks } from "@/server/demo/tasks-demo";
import type { ProjectId } from "@/lib/projects/project-ref";

/**
 * Files: every upload and link attached to a task in one Project.
 *
 * The caller passes a Project already proved openable by the route boundary
 * (`resolveProjectForRoute`). Every row is joined through its task and kept
 * only when that task belongs to the same Project, so a resource row with a
 * stale or missing workspace id can never surface in another Project's list.
 * Opening a file reuses the task panel's routes: uploads stream through the
 * authenticated `/api/attachments/[id]`, which re-checks access per request.
 */

export type ProjectFileKind = "document" | "image" | "sheet" | "slides" | "design" | "code" | "link" | "file";

export type ProjectFile = Readonly<{
  id: string;
  title: string;
  kind: ProjectFileKind;
  storage: "signal" | "google_drive" | "link";
  /** Where opening the file goes; null while an upload is still pending. */
  href: string | null;
  external: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  taskId: string;
  taskTitle: string;
  addedByName: string | null;
  /** Unix seconds. */
  addedAt: number;
}>;

const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

function safeHttpUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function safeDriveUrl(raw: string | null): string | null {
  const href = safeHttpUrl(raw);
  if (!href) return null;
  const url = new URL(href);
  return url.protocol === "https:" && DRIVE_HOSTS.has(url.hostname) && !url.port ? href : null;
}

export function fileKindFor(input: { provider: string; mimeType: string | null; title: string; isLink: boolean }): ProjectFileKind {
  const provider = input.provider;
  if (provider === "google_doc") return "document";
  if (provider === "google_sheet") return "sheet";
  if (provider === "google_slides") return "slides";
  if (provider === "figma") return "design";
  if (provider === "github") return "code";
  const mime = input.mimeType ?? "";
  const name = input.title.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|svg)$/.test(name)) return "image";
  if (/spreadsheet|excel|csv/.test(mime) || /\.(xlsx?|csv|numbers)$/.test(name)) return "sheet";
  if (/presentation|powerpoint/.test(mime) || /\.(pptx?|key)$/.test(name)) return "slides";
  if (/pdf|word|document|text\//.test(mime) || /\.(pdf|docx?|txt|md|pages|rtf)$/.test(name)) return "document";
  return input.isLink ? "link" : "file";
}

export async function listProjectFiles(workspaceId: ProjectId): Promise<ProjectFile[]> {
  if (isDemoMode()) return demoProjectFiles();

  const resourceRows = await db
    .select({
      id: resources.id,
      kind: resources.kind,
      provider: resources.provider,
      title: resources.title,
      url: resources.url,
      mimeType: resources.mimeType,
      sizeBytes: resources.sizeBytes,
      addedByUserId: resources.addedByUserId,
      addedAt: resources.addedAt,
      accessState: resources.accessState,
      storage: resources.storage,
      taskId: resources.taskId,
      taskTitle: tasks.title,
    })
    .from(resources)
    .innerJoin(tasks, eq(tasks.id, resources.taskId))
    .where(and(eq(resources.workspaceId, workspaceId), eq(tasks.workspaceId, workspaceId)));

  const mirrored = new Set(resourceRows.map((row) => row.id));
  const attachmentRows = (await db
    .select({
      id: attachments.id,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      uploaderUserId: attachments.uploaderUserId,
      createdAt: attachments.createdAt,
      taskId: attachments.taskId,
      taskTitle: tasks.title,
    })
    .from(attachments)
    .innerJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(eq(tasks.workspaceId, workspaceId)))
    .filter((row) => !mirrored.has(`res-${row.id}`));

  const contributorIds = [...new Set([
    ...resourceRows.map((row) => row.addedByUserId),
    ...attachmentRows.map((row) => row.uploaderUserId),
  ].filter((id): id is string => Boolean(id)))];
  const contributorRows = contributorIds.length > 0
    ? await db.select({ id: users.id, name: users.name, handle: users.handle, email: users.email })
      .from(users).where(inArray(users.id, contributorIds))
    : [];
  const names = new Map(contributorRows.map((row) => [row.id, userDisplayName(row)]));

  const fromResources: ProjectFile[] = resourceRows.map((row) => {
    const isLink = row.kind === "link";
    const isDrive = row.storage === "drive";
    const pending = row.accessState === "pending";
    const attachmentId = row.id.startsWith("res-") ? row.id.slice(4) : row.id;
    const href = isDrive
      ? safeDriveUrl(row.url)
      : isLink
        ? safeHttpUrl(row.url)
        : pending
          ? null
          : `/api/attachments/${encodeURIComponent(attachmentId)}`;
    return {
      id: row.id,
      title: row.title,
      kind: fileKindFor({ provider: row.provider, mimeType: row.mimeType, title: row.title, isLink }),
      storage: isDrive ? "google_drive" : isLink ? "link" : "signal",
      href,
      external: isLink || isDrive,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      addedByName: row.addedByUserId ? names.get(row.addedByUserId) ?? null : null,
      addedAt: row.addedAt,
    };
  });

  const fromAttachments: ProjectFile[] = attachmentRows.map((row) => ({
    id: `res-${row.id}`,
    title: row.filename,
    kind: fileKindFor({ provider: "file", mimeType: row.mimeType, title: row.filename, isLink: false }),
    storage: "signal",
    href: `/api/attachments/${encodeURIComponent(row.id)}`,
    external: false,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    addedByName: row.uploaderUserId ? names.get(row.uploaderUserId) ?? null : null,
    addedAt: Math.floor((row.createdAt?.getTime() ?? Date.now()) / 1000),
  }));

  return [...fromResources, ...fromAttachments].sort((a, b) => b.addedAt - a.addedAt);
}

/**
 * Review and demo mode have no database. The fixture hangs a believable set
 * of files on the demo Project's own tasks; hrefs are null (nothing to
 * download), which the view renders as "Preview only".
 */
function demoProjectFiles(): ProjectFile[] {
  const byId = new Map(demoTasks().map((task) => [task.id, task.title]));
  const now = Math.floor(Date.parse("2026-07-16T08:00:00.000Z") / 1000);
  const hour = 3600;
  const seed: Array<[string, string, ProjectFileKind, ProjectFile["storage"], string | null, number | null, string, number]> = [
    ["demo-f-1", "Run-sheet, Saturday v3.pdf", "document", "signal", "application/pdf", 412_000, "demo-t-05", 3],
    ["demo-f-2", "Marquee quote, Hireco.pdf", "document", "signal", "application/pdf", 188_000, "demo-t-01", 20],
    ["demo-f-3", "Seating plan, final", "sheet", "google_drive", null, null, "demo-t-07", 26],
    ["demo-f-4", "Terrace at golden hour.jpg", "image", "signal", "image/jpeg", 2_400_000, "demo-t-01", 49],
    ["demo-f-5", "Bar order, July", "sheet", "google_drive", null, null, "demo-t-06", 70],
    ["demo-f-6", "Welcome sign artwork.png", "image", "signal", "image/png", 1_150_000, "demo-t-03", 96],
    ["demo-f-7", "Recommended suppliers", "link", "link", null, null, "demo-t-08", 120],
    ["demo-f-8", "Deposit invoice, Mara & Finn.pdf", "document", "signal", "application/pdf", 96_000, "demo-t-10", 168],
  ];
  return seed
    .filter(([, , , , , , taskId]) => byId.has(taskId))
    .map(([id, title, kind, storage, mimeType, sizeBytes, taskId, hoursAgo]) => ({
      id,
      title,
      kind,
      storage,
      href: null,
      external: storage !== "signal",
      mimeType,
      sizeBytes,
      taskId,
      taskTitle: byId.get(taskId)!,
      addedByName: "Orla",
      addedAt: now - hoursAgo * hour,
    }));
}
