import type { ProjectFilesRead } from "@/lib/projects/project-files";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { parseProjectId } from "@/lib/projects/project-ref";
import { FilesShelf } from "./files-shelf";
import type { ShelfSource } from "./shelf-model";

/**
 * Files, Sources + shelf: the internal redesign of /app/files, shown only to
 * operators (`filesSourcesShelfEnabled`). It reads the same `ProjectFilesRead`
 * as `FilesView` for the same active Project and has no upload, attach,
 * delete or Drive-connect actions; files are still added from a task.
 *
 * Server component; `FilesShelf` is the only client part.
 */
export function FilesShelfView({
  projectName,
  read,
  sample,
  requestedProjectId,
  initialSource,
}: {
  projectName: string;
  read: ProjectFilesRead;
  /** Review and demo: sample files with nothing to download. */
  sample: boolean;
  /** Carried into links when the URL named the Project. */
  requestedProjectId: string | null;
  /** `?source=`, already parsed: a folder to open on arrival. */
  initialSource: ShelfSource | null;
}) {
  const projectId = parseProjectId(requestedProjectId);
  const tasksHref = projectId ? buildProjectUrl({ surface: "tasks" }, projectId, projectName) : "/app/tasks";
  return (
    <FilesShelf
      projectName={projectName}
      files={read.files}
      nowSeconds={read.readAt}
      sample={sample}
      truncated={read.truncated}
      includesArchived={read.includesArchived}
      initialSource={initialSource}
      tasksHref={tasksHref}
      requestedProjectId={requestedProjectId}
    />
  );
}
