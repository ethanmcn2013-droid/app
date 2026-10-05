import Link from "next/link";
import { describeFiles, type ProjectFilesRead } from "@/lib/projects/project-files";
import { ShellIcon } from "@/components/shell/shell-icons";
import { FilesExplorer } from "./files-explorer";
import styles from "./files.module.css";

/**
 * Files v3 (ported from the approved design, 5 Oct 2026): one place for
 * everything attached to the Project's tasks. Files are added where the work
 * is (a task's panel); this page is where they are found again.
 *
 * The page is the header, one search box with ways to narrow, the files, and
 * a preview of the chosen one. By the founder's instruction of 5 October the
 * design's question box, sample questions, pinned searches and keys panel are
 * not here: the product does not read inside files or answer questions.
 *
 * Server component; `FilesExplorer` is the only client part.
 */
export function FilesView({
  projectName,
  read,
  sample,
  requestedProjectId,
}: {
  projectName: string;
  read: ProjectFilesRead;
  /** Review and demo: sample files with nothing to download. */
  sample: boolean;
  /** Carried into the archived-tasks link when the URL named the Project. */
  requestedProjectId: string | null;
}) {
  const { files } = read;
  const overview = describeFiles(files, read.readAt);
  const archivedParams = new URLSearchParams();
  if (requestedProjectId) archivedParams.set("workspaceId", requestedProjectId);
  if (!read.includesArchived) archivedParams.set("archived", "1");
  const archivedQuery = archivedParams.toString();
  const archivedHref = archivedQuery ? `/app/files?${archivedQuery}` : "/app/files";

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Files</h1>
              <span className={styles.scope}>
                <i aria-hidden="true" />
                {projectName}
              </span>
            </div>
            <p className={styles.summary}>
              {files.length > 0 ? (
                overview.summary.map((part) => <span key={part}>{part}</span>)
              ) : (
                <span>Everything attached to this project&rsquo;s tasks: uploads, Drive files and links.</span>
              )}
            </p>
          </div>
          <Link href="/app/tasks" className={styles.btn}>
            <ShellIcon.tasks size={14} />
            Open Tasks
          </Link>
        </header>

        {read.truncated ? (
          <p className={styles.notice} role="note">
            <ShellIcon.alert size={14} />
            <span>This project has more files than one page lists, so the oldest are not shown. Each one is still on its task.</span>
          </p>
        ) : null}

        {files.length > 0 ? (
          <FilesExplorer files={files} sample={sample} nowSeconds={read.readAt} />
        ) : (
          <FilesEmpty includesArchived={read.includesArchived} />
        )}

        {sample ? null : (
          <p className={styles.foot}>
            {read.includesArchived ? "Files on archived tasks are included. " : "Files on archived tasks are left out. "}
            <Link href={archivedHref} className={styles.footLink} scroll={false}>
              {read.includesArchived ? "Leave them out" : "Include them"}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function FilesEmpty({ includesArchived }: { includesArchived: boolean }) {
  return (
    <section className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <ShellIcon.files size={20} />
      </span>
      <h2 className={styles.emptyTitle}>No files yet</h2>
      <p className={styles.emptyBody}>
        Attach a file, a Google Drive document or a link to any task and it appears here, next to the task it belongs to.
        {includesArchived ? "" : " Files on archived tasks stay out of this list unless you include them below."}
      </p>
      <Link href="/app/tasks" className={styles.btnPrimary}>
        Open Tasks
      </Link>
    </section>
  );
}

export function FilesUnavailable() {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Files</h1>
            </div>
            <p className={styles.summary}>
              <span>Choose a project to see its files.</span>
            </p>
          </div>
        </header>
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShellIcon.projects size={20} />
          </span>
          <h2 className={styles.emptyTitle}>No project open</h2>
          <p className={styles.emptyBody}>Files belong to a project. Open one from the sidebar, or see them all in Projects.</p>
          <Link href="/app/project" className={styles.btnPrimary}>
            See projects
          </Link>
        </section>
      </div>
    </div>
  );
}
