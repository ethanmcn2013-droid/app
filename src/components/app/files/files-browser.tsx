"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectFile, ProjectFileKind } from "@/server/projects/project-files";
import { formatAddedDate, formatBytes } from "./files-format";
import styles from "./files.module.css";

type Filter = "all" | "document" | "image" | "sheet" | "link";
type Layout = "list" | "grid";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "document", label: "Documents" },
  { value: "image", label: "Images" },
  { value: "sheet", label: "Sheets" },
  { value: "link", label: "Links" },
];

const KIND_LABEL: Record<ProjectFileKind, string> = {
  document: "Document",
  image: "Image",
  sheet: "Sheet",
  slides: "Slides",
  design: "Design",
  code: "Code",
  link: "Link",
  file: "File",
};

/** Filters group the long tail: slides with sheets' office cousins, the rest as links. */
function filterOf(file: ProjectFile): Filter {
  if (file.kind === "document") return "document";
  if (file.kind === "image") return "image";
  if (file.kind === "sheet" || file.kind === "slides") return "sheet";
  if (file.storage === "link" || file.kind === "link" || file.kind === "design" || file.kind === "code") return "link";
  return "document";
}

function sourceLabel(file: ProjectFile): string {
  if (file.storage === "google_drive") return "Google Drive";
  if (file.storage === "link") {
    if (!file.href) return "Link";
    try {
      return new URL(file.href).hostname.replace(/^www\./, "");
    } catch {
      return "Link";
    }
  }
  return file.sizeBytes ? formatBytes(file.sizeBytes) : "Upload";
}

export function FilesBrowser({ files, preview }: { files: readonly ProjectFile[]; preview: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<Layout>("list");

  const counts = useMemo(() => {
    const next: Record<Filter, number> = { all: files.length, document: 0, image: 0, sheet: 0, link: 0 };
    for (const file of files) next[filterOf(file)] += 1;
    return next;
  }, [files]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((file) =>
      (filter === "all" || filterOf(file) === filter) &&
      (!needle || file.title.toLowerCase().includes(needle) || file.taskTitle.toLowerCase().includes(needle)),
    );
  }, [files, filter, query]);

  return (
    <section className={styles.browser} aria-label="Files">
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="File type">
          {FILTERS.filter((item) => item.value === "all" || counts[item.value] > 0).map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span className={styles.segCount}>{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <label className={styles.search}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files or tasks"
              aria-label="Search files or tasks"
            />
          </label>
          <div className={styles.segmented} role="group" aria-label="Layout">
            <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")} aria-label="List">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
              </svg>
            </button>
            <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} aria-label="Grid">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
                <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
                <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
                <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {preview ? (
        <p className={styles.previewNote}>Sample files. In your projects, each one opens or downloads from here.</p>
      ) : null}

      {visible.length === 0 ? (
        <p className={styles.noMatch}>No files match. Try another word or type.</p>
      ) : layout === "list" ? (
        <div className={styles.table} role="table" aria-label="Files">
          <div className={styles.tableHead} role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Task</span>
            <span role="columnheader" className={styles.colAdded}>Added</span>
            <span role="columnheader" className={styles.colSource}>Source</span>
          </div>
          {visible.map((file) => (
            <div key={file.id} className={styles.tableRow} role="row">
              <span role="cell" className={styles.nameCell}>
                <FileIcon kind={file.kind} />
                <span className={styles.nameText}>
                  <FileName file={file} />
                  <span className={styles.kindLabel}>{KIND_LABEL[file.kind]}</span>
                </span>
              </span>
              <span role="cell" className={styles.taskCell}>
                <Link href={`/app/task/${encodeURIComponent(file.taskId)}`}>{file.taskTitle}</Link>
              </span>
              <span role="cell" className={`${styles.muted} ${styles.colAdded}`}>
                {formatAddedDate(file.addedAt)}
                {file.addedByName ? ` · ${file.addedByName}` : ""}
              </span>
              <span role="cell" className={`${styles.muted} ${styles.colSource}`}>{sourceLabel(file)}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((file) => (
            <li key={file.id} className={styles.tile}>
              <div className={styles.tileArt} data-kind={file.kind}>
                <FileIcon kind={file.kind} large />
              </div>
              <div className={styles.tileBody}>
                <FileName file={file} />
                <Link href={`/app/task/${encodeURIComponent(file.taskId)}`} className={styles.tileTask}>
                  {file.taskTitle}
                </Link>
                <span className={styles.tileMeta}>
                  {sourceLabel(file)} · {formatAddedDate(file.addedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FileName({ file }: { file: ProjectFile }) {
  if (!file.href) return <span className={styles.fileName}>{file.title}</span>;
  return (
    <a
      href={file.href}
      className={`${styles.fileName} ${styles.fileLink}`}
      {...(file.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {file.title}
    </a>
  );
}

function FileIcon({ kind, large = false }: { kind: ProjectFileKind; large?: boolean }) {
  const size = large ? 22 : 16;
  const path = {
    document: <><path d="M4 1.75h5.5L12.5 4.75v9.5H4z" /><path d="M9.5 1.75v3h3M6 8h4.5M6 10.5h4.5" /></>,
    image: <><rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" /><circle cx="6" cy="6.5" r="1.25" /><path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5 2.5 2.5" /></>,
    sheet: <><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" /><path d="M2.25 6.25h11.5M2.25 10h11.5M6.25 2.25v11.5" /></>,
    slides: <><rect x="2" y="3" width="12" height="8" rx="1.25" /><path d="M8 11v2.5M5.5 13.5h5" /></>,
    design: <><circle cx="8" cy="8" r="5.75" /><path d="M8 2.25v11.5M2.25 8h11.5" /></>,
    code: <><path d="m5.5 5-3 3 3 3M10.5 5l3 3-3 3" /></>,
    link: <><path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l1.9-1.9a2.75 2.75 0 0 0-3.9-3.9l-.6.6" /><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-1.9 1.9a2.75 2.75 0 0 0 3.9 3.9l.6-.6" /></>,
    file: <><path d="M4 1.75h5.5L12.5 4.75v9.5H4z" /><path d="M9.5 1.75v3h3" /></>,
  }[kind];
  return (
    <span className={large ? styles.iconLarge : styles.icon} data-kind={kind} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </span>
  );
}
