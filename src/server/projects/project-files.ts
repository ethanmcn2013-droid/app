import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { attachments, resources, tasks, users, workspaceMembers } from "@/server/db/schema";
import { userDisplayName } from "@/lib/user-display-name";
import { isDemoMode } from "@/lib/access-mode";
import { demoTasks } from "@/server/demo/tasks-demo";
import type { ProjectId } from "@/lib/projects/project-ref";
import {
  FILES_READ_LIMIT,
  type ProjectFile,
  type ProjectFileKind,
  type ProjectFilesRead,
} from "@/lib/projects/project-files";

export type { ProjectFile, ProjectFileKind, ProjectFilesRead } from "@/lib/projects/project-files";

/**
 * Files: every upload and link attached to a task in one Project.
 *
 * The caller passes a Project already proved openable by the route boundary
 * (`resolveProjectForRoute`). Every row is joined through its task and kept
 * only when that task belongs to the same Project, so a resource row with a
 * stale or missing workspace id can never surface in another Project's list.
 * Opening a file reuses the task panel's routes: uploads stream through the
 * authenticated `/api/attachments/[id]`, which re-checks access per request.
 *
 * The read is bounded: each of the two sources is read newest first up to
 * `FILES_READ_LIMIT` rows, and past that the page says older files are not
 * listed. Files on archived tasks are left out unless the caller asks for
 * them, matching every board view. A person is named only while they are a
 * current member of this Project; anyone else who added a file reads as a
 * former member, as on Analytics. Read-only: nothing here writes.
 */

/** The review clock the sample files are dated against, in Unix seconds. */
const DEMO_FILES_NOW_SECONDS = Math.floor(Date.parse("2026-07-16T08:00:00.000Z") / 1000);

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

export type ProjectFilesOptions = Readonly<{
  /** Also list files that sit on archived tasks. Off unless asked. */
  includeArchived?: boolean;
}>;

type Database = typeof db;

export async function loadProjectFiles(workspaceId: ProjectId, options: ProjectFilesOptions = {}): Promise<ProjectFilesRead> {
  const includesArchived = options.includeArchived === true;
  if (isDemoMode()) return { files: demoProjectFiles(), truncated: false, includesArchived, readAt: DEMO_FILES_NOW_SECONDS };
  return readProjectFilesWith(db, workspaceId, { includeArchived: includesArchived });
}

/** The read itself, over any database handle, so a test can prove its scope. */
export async function readProjectFilesWith(
  database: Database,
  workspaceId: string,
  options: ProjectFilesOptions = {},
  limit: number = FILES_READ_LIMIT,
): Promise<ProjectFilesRead> {
  const includesArchived = options.includeArchived === true;
  const liveTask = includesArchived ? undefined : isNull(tasks.archivedAt);

  const [resourceRead, attachmentRead, memberRows] = await Promise.all([
    database
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
        taskArchivedAt: tasks.archivedAt,
      })
      .from(resources)
      .innerJoin(tasks, eq(tasks.id, resources.taskId))
      .where(and(eq(resources.workspaceId, workspaceId), eq(tasks.workspaceId, workspaceId), liveTask))
      .orderBy(desc(resources.addedAt), desc(resources.id))
      .limit(limit + 1),
    database
      .select({
        id: attachments.id,
        filename: attachments.filename,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        uploaderUserId: attachments.uploaderUserId,
        createdAt: attachments.createdAt,
        taskId: attachments.taskId,
        taskTitle: tasks.title,
        taskArchivedAt: tasks.archivedAt,
      })
      .from(attachments)
      .innerJoin(tasks, eq(tasks.id, attachments.taskId))
      .where(and(eq(tasks.workspaceId, workspaceId), liveTask))
      .orderBy(desc(attachments.createdAt), desc(attachments.id))
      .limit(limit + 1),
    // Names only for current members of this Project.
    database
      .select({ id: workspaceMembers.userId, name: users.name, handle: users.handle, email: users.email })
      .from(workspaceMembers)
      .leftJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
  ]);

  const truncated = resourceRead.length > limit || attachmentRead.length > limit;
  const resourceRows = resourceRead.slice(0, limit);
  const mirrored = new Set(resourceRows.map((row) => row.id));
  const attachmentRows = attachmentRead.slice(0, limit);
  const attachmentSeconds = (row: { createdAt: Date | null }) => Math.floor((row.createdAt?.getTime() ?? Date.now()) / 1000);

  const members = new Map(
    memberRows.map((row) => [
      row.id,
      userDisplayName({ name: row.name ?? null, handle: row.handle ?? null, email: row.email ?? null }) ?? "Member",
    ]),
  );
  const addedBy = (userId: string | null) => ({
    addedByName: userId ? members.get(userId) ?? null : null,
    addedByFormer: userId ? !members.has(userId) : false,
  });

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
      taskArchived: row.taskArchivedAt != null,
      ...addedBy(row.addedByUserId),
      addedAt: row.addedAt,
    };
  });

  const fromAttachments: ProjectFile[] = attachmentRows
    .filter((row) => !mirrored.has(`res-${row.id}`))
    .map((row) => ({
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
      taskArchived: row.taskArchivedAt != null,
      ...addedBy(row.uploaderUserId),
      addedAt: attachmentSeconds(row),
    }));

  let files = [...fromResources, ...fromAttachments].sort((a, b) => b.addedAt - a.addedAt || a.id.localeCompare(b.id));
  if (truncated) {
    // A source that was cut short may be missing files older than its last
    // row, so nothing older than that point is shown from the other source
    // either: the list stays a true newest-first run with no gaps.
    const floors: number[] = [];
    if (resourceRead.length > limit) floors.push(resourceRows.at(-1)!.addedAt);
    if (attachmentRead.length > limit) floors.push(attachmentSeconds(attachmentRows.at(-1)!));
    const floor = Math.max(...floors);
    files = files.filter((file) => file.addedAt >= floor);
  }
  return { files, truncated, includesArchived, readAt: Math.floor(Date.now() / 1000) };
}

/**
 * Review and demo mode have no database. The fixture hangs a believable set
 * of files on the demo Project's own tasks; hrefs are null (nothing to
 * download), which the view renders as "Preview only".
 */
function demoProjectFiles(): ProjectFile[] {
  const byId = new Map(demoTasks().map((task) => [task.id, task.title]));
  const now = DEMO_FILES_NOW_SECONDS;
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
      taskArchived: false,
      addedByName: "Orla",
      addedByFormer: false,
      addedAt: now - hoursAgo * hour,
    }));
}
