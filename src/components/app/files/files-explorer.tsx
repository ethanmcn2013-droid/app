"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  EMPTY_SCOPE,
  FILE_KIND_LABEL,
  addedByLabel,
  describeFiles,
  formatAddedDate,
  groupTotal,
  queryTerms,
  scopeIsEmpty,
  searchFiles,
  sourceLabel,
  type FileChip,
  type FileScope,
  type ProjectFile,
} from "@/lib/projects/project-files";
import { FileGlyph, FilesIcon, Marked } from "./files-parts";
import { FilePreview } from "./files-preview";
import styles from "./files.module.css";

/**
 * The working part of Files: one search box, a row of ways to narrow, the
 * files, and a preview of the chosen one.
 *
 * The search reads file names, kinds, the task each file sits on and who
 * added it. It matches words; it does not read inside files or answer
 * questions. Everything is worked out in the browser from the rows the server
 * already sent (`searchFiles`), so typing never waits on the network.
 *
 * Keys: `/` moves to the search box; Down from the box enters the list; Up
 * and Down walk it; Enter or Space on a row chooses it; Escape in the box
 * clears it. On a wide page the chosen file is shown beside the list; on a
 * narrow one it opens as a sheet.
 */

type Layout = "list" | "grid";

/** The page column is wide enough to dock the preview beside the list. */
const DOCK_QUERY = "(min-width: 1280px)";

function chipActive(chip: FileChip, scope: FileScope): boolean {
  if (chip.scope.recent) return scope.recent;
  if (chip.scope.kind) return scope.kind === chip.scope.kind;
  if (chip.scope.person !== undefined) return scope.person === chip.scope.person;
  return false;
}

function toggleChip(chip: FileChip, scope: FileScope): FileScope {
  if (chip.scope.recent) return { ...scope, recent: !scope.recent };
  if (chip.scope.kind) return { ...scope, kind: scope.kind === chip.scope.kind ? "all" : chip.scope.kind };
  if (chip.scope.person !== undefined) return { ...scope, person: scope.person === chip.scope.person ? null : chip.scope.person ?? null };
  return scope;
}

export function FilesExplorer({
  files,
  sample,
  nowSeconds,
}: {
  files: readonly ProjectFile[];
  /** Review and demo: sample files with nothing to open. */
  sample: boolean;
  /** The server's clock, so "the last 7 days" is the same on both sides. */
  nowSeconds: number;
}) {
  const [scope, setScope] = useState<FileScope>(EMPTY_SCOPE);
  const [layout, setLayout] = useState<Layout>("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const folderRef = useRef<HTMLUListElement | null>(null);
  const breadcrumbCurrentRef = useRef<HTMLSpanElement | null>(null);
  const focusAfterNavigation = useRef<"file" | "folder" | "search" | null>(null);
  const returnFolderId = useRef<string | null>(null);
  const returnTo = useRef<string | null>(null);

  const overview = useMemo(() => describeFiles(files, nowSeconds), [files, nowSeconds]);
  const groups = useMemo(() => searchFiles(files, scope, nowSeconds), [files, scope, nowSeconds]);
  const terms = useMemo(() => queryTerms(scope.query), [scope.query]);
  const shown = useMemo(() => groups.flatMap((group) => group.files), [groups]);
  const total = groupTotal(groups);
  const narrowed = !scopeIsEmpty(scope) || selectedTaskId !== null;
  const folders = useMemo(() => {
    const allByTask = new Map<string, ProjectFile[]>();
    for (const file of files) {
      const taskFiles = allByTask.get(file.taskId) ?? [];
      taskFiles.push(file);
      allByTask.set(file.taskId, taskFiles);
    }
    const matchedByTask = new Map<string, ProjectFile[]>();
    for (const file of shown) {
      const matches = matchedByTask.get(file.taskId) ?? [];
      matches.push(file);
      matchedByTask.set(file.taskId, matches);
    }
    return [...matchedByTask.entries()].map(([taskId, matches]) => ({
      taskId,
      title: matches[0]?.taskTitle ?? "Task files",
      files: allByTask.get(taskId) ?? matches,
      matchingCount: matches.length,
    }));
  }, [files, shown]);

  // The docked preview always shows something: the chosen file while it is
  // still in the list, otherwise the first one.
  const visibleGroups = selectedTaskId ? groups.map((group) => ({ ...group, files: group.files.filter((file) => file.taskId === selectedTaskId) })).filter((group) => group.files.length > 0) : groups;
  const visibleFiles = visibleGroups.flatMap((group) => group.files);
  const chosen = visibleFiles.find((file) => file.id === chosenId) ?? visibleFiles[0] ?? null;

  useEffect(() => {
    const destination = focusAfterNavigation.current;
    if (!destination) return;
    focusAfterNavigation.current = null;

    if (destination === "file") {
      const firstFile = listRef.current?.querySelector<HTMLElement>("[data-file-row]");
      (firstFile ?? breadcrumbCurrentRef.current)?.focus();
      return;
    }

    if (destination === "folder") {
      const taskId = returnFolderId.current;
      returnFolderId.current = null;
      const folder = taskId
        ? folderRef.current?.querySelector<HTMLElement>(`[data-folder-card="${CSS.escape(taskId)}"]`)
        : null;
      (folder ?? inputRef.current)?.focus();
      return;
    }

    inputRef.current?.focus();
  }, [scope, selectedTaskId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function rowButtons(): HTMLElement[] {
    const container = folderRef.current ?? listRef.current;
    return [...(container?.querySelectorAll<HTMLElement>("[data-file-row], [data-folder-card]") ?? [])];
  }

  function choose(file: ProjectFile) {
    setChosenId(file.id);
    if (!window.matchMedia(DOCK_QUERY).matches) {
      returnTo.current = file.id;
      setSheetOpen(true);
    }
  }

  function closeSheet() {
    setSheetOpen(false);
    const id = returnTo.current;
    returnTo.current = null;
    // The row never left the page, so focus can go straight back to it.
    if (id) listRef.current?.querySelector<HTMLElement>(`[data-file-row="${CSS.escape(id)}"]`)?.focus();
  }

  function openFolder(taskId: string) {
    returnFolderId.current = taskId;
    focusAfterNavigation.current = "file";
    setSelectedTaskId(taskId);
  }

  function showAllFiles() {
    if (selectedTaskId) {
      returnFolderId.current = selectedTaskId;
      focusAfterNavigation.current = "folder";
    } else {
      focusAfterNavigation.current = "search";
    }
    setSelectedTaskId(null);
    setScope(EMPTY_SCOPE);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      const first = rowButtons()[0];
      if (first) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "Escape" && scope.query) {
      event.preventDefault();
      setScope({ ...scope, query: "" });
    }
  }

  function onListKey(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-file-row], [data-folder-card]");
    if (!row) return;
    const buttons = rowButtons();
    const at = buttons.indexOf(row);
    if (at === -1) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && at === 0) {
      inputRef.current?.focus();
      return;
    }
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? Math.min(at + 1, buttons.length - 1) : at - 1;
    buttons[next]?.focus();
  }

  const resultWords = !narrowed
    ? null
    : total === 0
      ? "No files match"
      : `${total} ${total === 1 ? "file" : "files"}${scope.query.trim() ? ` for “${scope.query.trim()}”` : ""}`;

  return (
    <div className={styles.explorer}>
      <div className={styles.dockTop}>
        <label className={`${styles.field} ${focused ? styles.fieldFocus : ""}`}>
          <FilesIcon name="search" size={18} className={styles.fieldIcon} />
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            value={scope.query}
            onChange={(event) => setScope({ ...scope, query: event.target.value })}
            onKeyDown={onInputKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Find a file by name, task or person"
            aria-label="Find a file by name, task or person"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {scope.query ? (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Clear the search"
              onClick={() => {
                setScope({ ...scope, query: "" });
                inputRef.current?.focus();
              }}
            >
              <FilesIcon name="x" size={15} />
            </button>
          ) : (
            <kbd className={styles.kbd} aria-hidden="true">/</kbd>
          )}
        </label>

        {overview.chips.length > 0 ? (
          <div className={styles.narrow} role="group" aria-label="Narrow the files">
            <span className={styles.narrowLabel} aria-hidden="true">Narrow</span>
            {overview.chips.map((chip, index) => {
              const on = chipActive(chip, scope);
              return (
                <button
                  key={chip.key}
                  type="button"
                  className={styles.chip}
                  aria-pressed={on}
                  onClick={() => setScope(toggleChip(chip, scope))}
                  style={{ "--i": index } as CSSProperties}
                >
                  <FilesIcon name={chip.icon} size={13} />
                  <span className={styles.chipText}>{chip.label}</span>
                  <span className={styles.chipCount}>{chip.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className={styles.split}>
        <section className={styles.results} aria-label="Files">
          <div className={styles.resHead}>
            <p className={styles.resCount} role="status">
              {selectedTaskId ? (
                <>
                  <strong>{visibleFiles.length}</strong> {visibleFiles.length === 1 ? "file" : "files"} in this folder
                </>
              ) : scopeIsEmpty(scope) ? (
                <><strong>{folders.length}</strong> {folders.length === 1 ? "folder" : "folders"} · {overview.total} files</>
              ) : resultWords}
              {narrowed ? (
                <button type="button" className={styles.linkBtn} onClick={showAllFiles}>
                  All files
                </button>
              ) : null}
            </p>
            {selectedTaskId ? <div className={styles.segmented} role="group" aria-label="Layout">
              <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")} aria-label="List">
                <FilesIcon name="list" />
              </button>
              <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} aria-label="Grid">
                <FilesIcon name="grid" />
              </button>
            </div> : null}
          </div>

          {selectedTaskId ? (
            <nav className={styles.folderCrumb} aria-label="File location">
              <button type="button" onClick={showAllFiles}>All files</button>
              <span aria-hidden="true">/</span>
              <span ref={breadcrumbCurrentRef} aria-current="page" tabIndex={-1}>{folders.find((folder) => folder.taskId === selectedTaskId)?.title ?? "Task files"}</span>
            </nav>
          ) : null}

          {sample ? <p className={styles.sampleNote}>Sample files. In your projects, each one opens or downloads from here.</p> : null}

          {total === 0 || (selectedTaskId !== null && visibleFiles.length === 0) ? (
            <div className={styles.noMatch}>
              <p className={styles.noMatchTitle}>
                {scope.query.trim() ? <>Nothing here is called <span>“{scope.query.trim()}”</span></> : "No files fit that"}
              </p>
              <p className={styles.noMatchBody}>
                The search looks at file names, kinds, task names and who added a file. It does not look inside files.
              </p>
              <button type="button" className={styles.btn} onClick={showAllFiles}>
                All files
              </button>
            </div>
          ) : selectedTaskId === null ? (
            <ul ref={folderRef} onKeyDown={onListKey} className={styles.folderGrid} aria-label="Folders in this project">
              {folders.map((folder, index) => (
                <li key={folder.taskId} className={styles.folderItem} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
                  <button
                    type="button"
                    className={styles.folderCard}
                    data-folder-card={folder.taskId}
                    aria-label={`${folder.title}, ${folder.matchingCount} ${folder.matchingCount === 1 ? "file" : "files"}`}
                    onClick={() => openFolder(folder.taskId)}
                  >
                    <span className={styles.folderArt} aria-hidden="true">
                      <span className={`${styles.folderSheet} ${styles.folderSheetBack}`}>
                        {folder.files[1] ? <FileGlyph kind={folder.files[1].kind} size={28} /> : null}
                      </span>
                      <span className={`${styles.folderSheet} ${styles.folderSheetFront}`}>
                        {folder.files[0] ? <FileGlyph kind={folder.files[0].kind} size={30} /> : null}
                      </span>
                      <span className={styles.folderBack} />
                      <span className={styles.folderFront} />
                    </span>
                    <span className={styles.folderInfo}>
                      <span className={styles.folderName}>{folder.title}</span>
                      <span className={styles.folderCount}>{folder.matchingCount} {folder.matchingCount === 1 ? "file" : "files"}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div ref={listRef} onKeyDown={onListKey}>
              {visibleGroups.map((group) => (
                <section key={group.id} className={styles.group} aria-labelledby={`files-group-${group.id}`}>
                  <h2 id={`files-group-${group.id}`} className={styles.groupTitle}>
                    {group.title}
                    <span className={styles.groupCount}>{group.files.length}</span>
                  </h2>
                  {layout === "list" ? (
                    <ul className={styles.rows}>
                      {group.files.map((file, index) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          terms={terms}
                          index={index}
                          current={chosen?.id === file.id}
                          onChoose={() => choose(file)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <ul className={styles.tiles}>
                      {group.files.map((file, index) => (
                        <FileTile
                          key={file.id}
                          file={file}
                          terms={terms}
                          index={index}
                          current={chosen?.id === file.id}
                          onChoose={() => choose(file)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}

          <p className={styles.stores}>
            {overview.stores.map((store) => (
              <span key={store.key}>
                <b>{store.count}</b> {store.label.toLowerCase()}
                <i>{store.note}</i>
              </span>
            ))}
          </p>
        </section>

        {chosen ? <FilePreview key={`dock-${chosen.id}`} file={chosen} mode="docked" sample={sample} /> : null}
      </div>

      {sheetOpen && chosen ? <FilePreview key={`sheet-${chosen.id}`} file={chosen} mode="sheet" sample={sample} onClose={closeSheet} /> : null}
    </div>
  );
}

function metaParts(file: ProjectFile): string[] {
  const who = addedByLabel(file);
  return [
    FILE_KIND_LABEL[file.kind],
    sourceLabel(file),
    who ? `${who}, ${formatAddedDate(file.addedAt)}` : formatAddedDate(file.addedAt),
  ].filter((part, index, all) => all.indexOf(part) === index);
}

type ItemProps = {
  file: ProjectFile;
  terms: readonly string[];
  index: number;
  current: boolean;
  onChoose: () => void;
};

function FileRow({ file, terms, index, current, onChoose }: ItemProps) {
  const who = addedByLabel(file);
  return (
    <li className={styles.row} data-current={current ? "" : undefined} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
      <button
        type="button"
        className={styles.rowMain}
        data-file-row={file.id}
        aria-current={current ? "true" : undefined}
        onClick={onChoose}
      >
        <FileGlyph kind={file.kind} />
        <span className={styles.rowBody}>
          <span className={styles.rowName}>
            <Marked text={file.title} terms={terms} />
          </span>
          <span className={styles.rowMeta}>
            <span>{FILE_KIND_LABEL[file.kind]}</span>
            {sourceLabel(file) !== FILE_KIND_LABEL[file.kind] ? <span>{sourceLabel(file)}</span> : null}
            <span>
              {who ? <><Marked text={who} terms={terms} />, </> : null}
              {formatAddedDate(file.addedAt)}
            </span>
            {file.taskArchived ? <span className={styles.tag}>Archived task</span> : null}
          </span>
        </span>
      </button>
      <Link href={`/app/task/${encodeURIComponent(file.taskId)}`} className={styles.rowTask} title={file.taskTitle}>
        <FilesIcon name="task" size={13} />
        <span><Marked text={file.taskTitle} terms={terms} /></span>
      </Link>
      {file.href ? (
        <a
          href={file.href}
          className={styles.rowOpen}
          aria-label={`${file.storage === "signal" ? "Open" : "Open in a new tab"}: ${file.title}`}
          {...(file.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <FilesIcon name={file.storage === "signal" ? "download" : "open"} size={15} />
        </a>
      ) : (
        <span className={styles.rowOpen} data-empty="" aria-hidden="true" />
      )}
    </li>
  );
}

function FileTile({ file, terms, index, current, onChoose }: ItemProps) {
  return (
    <li className={styles.tile} data-current={current ? "" : undefined} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
      <button
        type="button"
        className={styles.tileMain}
        data-file-row={file.id}
        aria-current={current ? "true" : undefined}
        onClick={onChoose}
      >
        <span className={styles.tileArt} data-kind={file.kind} aria-hidden="true">
          <FileGlyph kind={file.kind} size={44} />
        </span>
        <span className={styles.tileInfo}>
          <span className={styles.tileName}><Marked text={file.title} terms={terms} /></span>
          <span className={styles.tileMeta}>{metaParts(file).slice(1).join(" · ")}</span>
        </span>
      </button>
      <Link href={`/app/task/${encodeURIComponent(file.taskId)}`} className={styles.tileTask} title={file.taskTitle}>
        <FilesIcon name="task" size={13} />
        <span><Marked text={file.taskTitle} terms={terms} /></span>
      </Link>
    </li>
  );
}
