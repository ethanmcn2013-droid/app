import Link from "next/link";
import type { ProjectFile } from "@/server/projects/project-files";
import { ShellIcon } from "@/components/shell/shell-icons";
import { FilesBrowser } from "./files-browser";
import { formatBytes } from "./files-format";
import styles from "./files.module.css";

/**
 * Files v3: one place for everything attached to the Project's tasks.
 * Files are added where the work is (a task's panel); this page is where
 * they are found again. Server component; the browser below is the only
 * client part (search, type filter, grid or list).
 */
export function FilesView({
  projectName,
  files,
  preview,
}: {
  projectName: string;
  files: readonly ProjectFile[];
  /** Review and demo: sample files with nothing to download. */
  preview: boolean;
}) {
  const uploads = files.filter((file) => file.storage === "signal");
  const stored = uploads.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  const stats = [
    { label: "All files", value: String(files.length), note: `${new Set(files.map((file) => file.taskId)).size} tasks` },
    { label: "Uploaded", value: String(uploads.length), note: stored > 0 ? `${formatBytes(stored)} stored` : "Nothing stored yet" },
    { label: "Google Drive", value: String(files.filter((file) => file.storage === "google_drive").length), note: "Linked, not copied" },
    { label: "Links", value: String(files.filter((file) => file.storage === "link").length), note: "Web pages and tools" },
  ];

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{projectName}</p>
            <h1 className={styles.title}>Files</h1>
            <p className={styles.subtitle}>Everything attached to this project&rsquo;s tasks: uploads, Drive files and links.</p>
          </div>
          <Link href="/app/tasks" className={styles.button}>
            <ShellIcon.tasks size={14} />
            Open Tasks
          </Link>
        </header>

        {files.length > 0 ? (
          <>
            <section className={styles.stats} aria-label="Files at a glance">
              {stats.map((stat) => (
                <div key={stat.label} className={styles.stat}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={styles.statValue}>{stat.value}</span>
                  <span className={styles.statNote}>{stat.note}</span>
                </div>
              ))}
            </section>
            <FilesBrowser files={files} preview={preview} />
          </>
        ) : (
          <FilesEmpty />
        )}
      </div>
    </div>
  );
}

function FilesEmpty() {
  return (
    <section className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <ShellIcon.files size={20} />
      </span>
      <h2 className={styles.emptyTitle}>No files yet</h2>
      <p className={styles.emptyBody}>
        Attach a file, a Google Drive document or a link to any task and it appears here, next to the task it belongs to.
      </p>
      <Link href="/app/tasks" className={styles.buttonPrimary}>
        Open Tasks
      </Link>
    </section>
  );
}

export function FilesUnavailable() {
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Files</h1>
            <p className={styles.subtitle}>Choose a project to see its files.</p>
          </div>
        </header>
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShellIcon.projects size={20} />
          </span>
          <h2 className={styles.emptyTitle}>No project open</h2>
          <p className={styles.emptyBody}>Files belong to a project. Open one from the sidebar, or see them all in Projects.</p>
          <Link href="/app/project" className={styles.buttonPrimary}>
            See projects
          </Link>
        </section>
      </div>
    </div>
  );
}
