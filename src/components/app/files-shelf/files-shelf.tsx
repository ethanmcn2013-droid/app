"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { formatAddedDate, type ProjectFile } from "@/lib/projects/project-files";
import { FilePreview } from "@/components/app/files/files-preview";
import {
  SOURCE_NAME,
  dateGroups,
  describeSources,
  fileLabel,
  matchReason,
  matchesQuery,
  queryWords,
  shelfTypeOf,
  shortWho,
  sourceOf,
  summarySentence,
  typeChips,
  typeCount,
  whereLong,
  whereShort,
  type ShelfSource,
  type ShelfType,
} from "./shelf-model";
import { FileName, Folder, Lit, Placeholder, ShelfIcon, SourceMark } from "./shelf-parts";
import styles from "./files-shelf.module.css";

/**
 * Files, Sources + shelf (operators only, behind `filesSourcesShelfEnabled`).
 *
 * Home is three folders by where files live (In Signal, Google Drive, Links),
 * the dashed Add files folder that points to Tasks (files are added from a
 * task; this page has no upload), and Latest additions as one row of cards or
 * a newest-first list. A folder opens with `?source=`, so its address can be
 * shared; inside it, type chips narrow (only when two or more types exist).
 * Search reads names, tasks, people, kinds and sources, and every card says
 * why it matched by lighting the words where they were found.
 *
 * Keys: each group (folders, cards, rows) is one Tab stop with arrows, Home
 * and End inside it. Enter previews a file and Enter again opens it. Escape
 * clears the search first, then the preview, then leaves the folder. `/`
 * moves to the search box. The preview docks beside the files on a wide
 * window and is a sheet on a narrow one (the Files page's own `FilePreview`).
 */

type Layout = "cards" | "list";

const SOURCE_KEYS: readonly string[] = ["signal", "drive", "links", "add"];

/** The same width the shared preview docks at (files.module.css). */
const DOCK_QUERY = "(min-width: 1280px)";

type PendingFocus =
  | { kind: "item"; id: string }
  | { kind: "folder"; source: ShelfSource }
  | { kind: "first" }
  | { kind: "search" };

function openFile(file: ProjectFile) {
  if (!file.href) return;
  if (file.external) window.open(file.href, "_blank", "noopener,noreferrer");
  else window.location.assign(file.href);
}

function visibleItems(group: HTMLElement): HTMLElement[] {
  return [...group.querySelectorAll<HTMLElement>("[data-item]")].filter((el) => el.getClientRects().length > 0);
}

/** Arrows, Home and End inside one group. Grids move by row on Up and Down. */
function rove(event: React.KeyboardEvent<HTMLElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const group = event.currentTarget;
  const current = (event.target as HTMLElement).closest<HTMLElement>("[data-item]");
  if (!current || !group.contains(current)) return;
  const items = visibleItems(group);
  const at = items.indexOf(current);
  if (at === -1) return;
  let next = at;
  const axis = group.dataset.axis;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = items.length - 1;
  else if (event.key === "ArrowLeft") next = axis === "v" ? at : Math.max(0, at - 1);
  else if (event.key === "ArrowRight") next = axis === "v" ? at : Math.min(items.length - 1, at + 1);
  else if (axis === "grid") {
    const box = current.getBoundingClientRect();
    const centre = box.left + box.width / 2;
    const down = event.key === "ArrowDown";
    const rows = items.filter((item) => {
      const top = item.getBoundingClientRect().top;
      return down ? top > box.top + 4 : top < box.top - 4;
    });
    if (rows.length > 0) {
      const rowTop = down
        ? Math.min(...rows.map((item) => item.getBoundingClientRect().top))
        : Math.max(...rows.map((item) => item.getBoundingClientRect().top));
      const row = rows.filter((item) => Math.abs(item.getBoundingClientRect().top - rowTop) < 4);
      const nearest = row.reduce((best, item) => {
        const r = item.getBoundingClientRect();
        const b = best.getBoundingClientRect();
        return Math.abs(r.left + r.width / 2 - centre) < Math.abs(b.left + b.width / 2 - centre) ? item : best;
      });
      next = items.indexOf(nearest);
    }
  } else if (axis === "h") {
    return;
  } else {
    next = event.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
  }
  event.preventDefault();
  items[next]?.focus();
}

export function FilesShelf({
  projectName,
  files,
  nowSeconds,
  sample,
  truncated,
  includesArchived,
  initialSource,
  tasksHref,
  requestedProjectId,
}: {
  projectName: string;
  files: readonly ProjectFile[];
  nowSeconds: number;
  sample: boolean;
  truncated: boolean;
  includesArchived: boolean;
  initialSource: ShelfSource | null;
  tasksHref: string;
  requestedProjectId: string | null;
}) {
  const [source, setSource] = useState<ShelfSource | null>(initialSource);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ShelfType | null>(null);
  const [latestLayout, setLatestLayout] = useState<Layout>("cards");
  const [folderLayout, setFolderLayout] = useState<Layout>("cards");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);

  const words = useMemo(() => queryWords(query), [query]);
  const sources = useMemo(() => describeSources(files), [files]);
  const scoped = useMemo(() => (source ? files.filter((file) => sourceOf(file) === source) : files), [files, source]);
  const chips = useMemo(() => (source ? typeChips(scoped) : []), [scoped, source]);
  const matched = useMemo(() => scoped.filter((file) => matchesQuery(file, words)), [scoped, words]);
  const activeType = type !== null && chips.some((chip) => chip.type === type) ? type : null;
  const shown = useMemo(
    () => (activeType ? matched.filter((file) => shelfTypeOf(file) === activeType) : matched),
    [matched, activeType],
  );
  const chosen = chosenId ? (shown.find((file) => file.id === chosenId) ?? null) : null;
  const searching = words.length > 0;

  // Focus lands after the render that drew its target.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const root = rootRef.current;
    if (!root) return;
    let el: HTMLElement | null = null;
    if (target.kind === "item") el = root.querySelector<HTMLElement>(`[data-item][data-file-id="${CSS.escape(target.id)}"]`);
    else if (target.kind === "folder") el = root.querySelector<HTMLElement>(`[data-source-folder="${target.source}"]`);
    else if (target.kind === "first") el = root.querySelector<HTMLElement>("[data-files] [data-item]");
    if (!el || target.kind === "search") el = searchRef.current;
    el?.focus({ preventScroll: false });
  });

  // A folder's address can be shared; Back leaves it.
  useEffect(() => {
    function onPop() {
      const next = new URL(window.location.href).searchParams.get("source");
      const parsed = next === "signal" || next === "drive" || next === "links" ? next : null;
      setSource((previous) => {
        if (previous && !parsed) pendingFocus.current = { kind: "folder", source: previous };
        return parsed;
      });
      setType(null);
      setChosenId(null);
      setSheetOpen(false);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTo = useCallback((next: ShelfSource | null) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("source", next);
    else url.searchParams.delete("source");
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setSource((previous) => {
      pendingFocus.current = next ? { kind: "first" } : previous ? { kind: "folder", source: previous } : null;
      return next;
    });
    setType(null);
    setChosenId(null);
    setSheetOpen(false);
  }, []);

  function preview(file: ProjectFile) {
    setChosenId(file.id);
    if (!window.matchMedia(DOCK_QUERY).matches) setSheetOpen(true);
  }

  function closePreview() {
    const id = chosenId;
    setChosenId(null);
    setSheetOpen(false);
    if (id) pendingFocus.current = { kind: "item", id };
  }

  // Escape steps back one thing at a time: search, then preview, then folder.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") return;
      if (query) {
        event.preventDefault();
        setQuery("");
        return;
      }
      if (chosenId) {
        event.preventDefault();
        closePreview();
        return;
      }
      if (source) {
        event.preventDefault();
        goTo(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onFileKey(event: React.KeyboardEvent<HTMLElement>, file: ProjectFile) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (chosenId === file.id && (sheetOpen || window.matchMedia(DOCK_QUERY).matches)) openFile(file);
    else preview(file);
  }

  /** One Tab stop per group: the last focused item while it is still listed, else the first. */
  function tabIndexFor(group: string, id: string, ids: readonly string[]): 0 | -1 {
    const current = active[group];
    return (current !== undefined && ids.includes(current) ? current : ids[0]) === id ? 0 : -1;
  }

  function remember(group: string, id: string) {
    setActive((previous) => (previous[group] === id ? previous : { ...previous, [group]: id }));
  }

  // ── Pieces ──────────────────────────────────────────────────────────────

  function card(file: ProjectFile, group: string, ids: readonly string[], index: number) {
    const reason = searching ? matchReason(file, words) : null;
    const who = reason?.kind === "person" ? reason.text : shortWho(file);
    const showWhere = source === null || file.storage === "link";
    const current = chosen?.id === file.id;
    return (
      <li key={file.id} className={styles.cardItem} style={{ "--i": Math.min(index, 10) } as CSSProperties}>
        <button
          type="button"
          className={styles.card}
          data-item=""
          data-file-id={file.id}
          data-archived={file.taskArchived ? "" : undefined}
          aria-current={current ? "true" : undefined}
          aria-label={fileLabel(file, reason)}
          title={file.title}
          tabIndex={tabIndexFor(group, file.id, ids)}
          onFocus={() => remember(group, file.id)}
          onClick={() => preview(file)}
          onDoubleClick={() => openFile(file)}
          onKeyDown={(event) => onFileKey(event, file)}
        >
          <span className={styles.cardThumb} aria-hidden="true">
            <Placeholder file={file} />
          </span>
          <span className={styles.cardName} aria-hidden="true">
            <FileName title={file.title} words={words} />
          </span>
          <span className={styles.cardMeta} aria-hidden="true">
            {showWhere ? (
              <span className={styles.where}>
                <SourceMark source={sourceOf(file)} size={12} />
                <Lit text={whereShort(file)} words={words} />
              </span>
            ) : null}
            {file.taskArchived ? <span className={styles.flag}>Archived task</span> : <span>{formatAddedDate(file.addedAt)}</span>}
          </span>
          <span className={styles.cardMeta} aria-hidden="true">
            {who ? <span className={styles.who}><Lit text={who} words={words} /></span> : null}
            <span className={styles.ctx}><Lit text={file.taskTitle} words={words} /></span>
          </span>
        </button>
      </li>
    );
  }

  function cardGrid(list: readonly ProjectFile[], group: string, label: string, oneRow = false) {
    const ids = list.map((file) => file.id);
    return (
      <ul
        className={styles.cards}
        data-one-row={oneRow ? "" : undefined}
        data-axis="grid"
        aria-label={label}
        onKeyDown={rove}
      >
        {list.map((file, index) => card(file, group, ids, index))}
      </ul>
    );
  }

  function row(file: ProjectFile, group: string, ids: readonly string[]) {
    const current = chosen?.id === file.id;
    const reason = searching ? matchReason(file, words) : null;
    return (
      <li key={file.id}>
        <button
          type="button"
          className={styles.row}
          data-item=""
          data-file-id={file.id}
          data-archived={file.taskArchived ? "" : undefined}
          aria-current={current ? "true" : undefined}
          aria-label={fileLabel(file, reason)}
          tabIndex={tabIndexFor(group, file.id, ids)}
          onFocus={() => remember(group, file.id)}
          onClick={() => preview(file)}
          onDoubleClick={() => openFile(file)}
          onKeyDown={(event) => onFileKey(event, file)}
        >
          <span className={styles.rowName} aria-hidden="true">
            <span className={styles.rowThumb}><Placeholder file={file} /></span>
            <span className={styles.rowNameText}>
              <FileName title={file.title} words={words} />
              <span className={styles.rowSub}>
                {whereShort(file)} · {file.taskArchived ? "Archived task" : formatAddedDate(file.addedAt)}
              </span>
            </span>
          </span>
          <span className={styles.rowCell} data-col="task" aria-hidden="true"><Lit text={file.taskTitle} words={words} /></span>
          <span className={styles.rowCell} data-col="who" aria-hidden="true">{shortWho(file) ?? ""}</span>
          <span className={styles.rowCell} data-col="date" aria-hidden="true">
            {file.taskArchived ? "Archived task" : formatAddedDate(file.addedAt)}
          </span>
          <span className={styles.rowCell} data-col="where" aria-hidden="true">
            <SourceMark source={sourceOf(file)} size={12} />
            <span>{whereShort(file)}</span>
          </span>
        </button>
      </li>
    );
  }

  function rowList(groups: ReadonlyArray<{ label: string; files: readonly ProjectFile[] }>, groupKey: string) {
    return (
      <div className={styles.list}>
        <div className={styles.listHead} aria-hidden="true">
          <span>Name</span>
          <span data-col="task">Task</span>
          <span data-col="who">Added by</span>
          <span data-col="date">Added</span>
          <span data-col="where">Where</span>
        </div>
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            {groups.length > 1 || group.label !== "Files" ? <h3 className={styles.listGroup}>{group.label}</h3> : null}
            <ul className={styles.rows} data-axis="v" aria-label={group.label} onKeyDown={rove}>
              {group.files.map((file) => row(file, `${groupKey}:${group.label}`, group.files.map((entry) => entry.id)))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  function layoutSwitch(value: Layout, set: (next: Layout) => void, label: string) {
    return (
      <div className={styles.seg} role="group" aria-label={label}>
        <button type="button" aria-pressed={value === "cards"} onClick={() => set("cards")} aria-label="Cards" title="Cards">
          <ShelfIcon name="grid" />
        </button>
        <button type="button" aria-pressed={value === "list"} onClick={() => set("list")} aria-label="List" title="List">
          <ShelfIcon name="list" />
        </button>
      </div>
    );
  }

  const archivedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (requestedProjectId) params.set("workspaceId", requestedProjectId);
    if (!includesArchived) params.set("archived", "1");
    if (source) params.set("source", source);
    const text = params.toString();
    return text ? `/app/files?${text}` : "/app/files";
  }, [requestedProjectId, includesArchived, source]);

  const searchLabel = source ? `Search ${SOURCE_NAME[source]}` : "Find a file, task or person";
  const folder = source ? sources.find((entry) => entry.key === source)! : null;
  const noMatch = (
    <div className={styles.noMatch}>
      <p className={styles.noMatchTitle}>
        {searching ? <>Nothing matches <span>&ldquo;{query.trim()}&rdquo;</span></> : "No files fit that filter"}
      </p>
      <p className={styles.noMatchBody}>
        Search looks at file names, tasks, people and where files live. It does not look inside files.
      </p>
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          setQuery("");
          setType(null);
          pendingFocus.current = { kind: "search" };
        }}
      >
        Clear
      </button>
    </div>
  );

  // ── Views ───────────────────────────────────────────────────────────────

  let body: React.ReactNode;
  if (source === null && searching) {
    body = (
      <section className={styles.section} aria-labelledby="shelf-results">
        <div className={styles.sectionHead}>
          <h2 id="shelf-results" className={styles.sectionTitle}>
            <span role="status">
              {shown.length === 0 ? "No files match" : `${typeCount(null, shown.length)} matching “${query.trim()}”`}
            </span>
          </h2>
          <button type="button" className={styles.linkBtn} onClick={() => { setQuery(""); pendingFocus.current = { kind: "search" }; }}>
            Clear search
          </button>
        </div>
        <div data-files="">{shown.length === 0 ? noMatch : cardGrid(shown, "results", "Matching files")}</div>
      </section>
    );
  } else if (source === null) {
    const latest = [...files].sort((a, b) => b.addedAt - a.addedAt);
    body = (
      <>
        <ul className={styles.sources} data-axis="grid" aria-label="Where files live" onKeyDown={rove}>
          {sources.map((entry, index) => (
            <li key={entry.key} className={styles.sourceItem} style={{ "--i": index } as CSSProperties}>
              <button
                type="button"
                className={styles.source}
                data-item=""
                data-source-folder={entry.key}
                data-empty={entry.count === 0 ? "" : undefined}
                aria-label={`${entry.name}, ${typeCount(null, entry.count)}. ${entry.blurb} ${entry.fact}.`}
                tabIndex={tabIndexFor("sources", entry.key, SOURCE_KEYS)}
                onFocus={() => remember("sources", entry.key)}
                onClick={() => goTo(entry.key)}
              >
                <Folder count={entry.count} mark={<SourceMark source={entry.key} size={22} />} />
                <span className={styles.sourceText}>
                  <span className={styles.sourceName}>{entry.name}</span>
                  <span className={styles.sourceBlurb}>{entry.blurb}</span>
                  <span className={styles.sourceFact}>{entry.fact}</span>
                </span>
              </button>
            </li>
          ))}
          <li className={styles.sourceItem} style={{ "--i": 3 } as CSSProperties}>
            <Link
              href={tasksHref}
              className={styles.source}
              data-item=""
              data-add=""
              aria-label="Add files. Files are added from a task: open Tasks, choose a task and attach a file, a Google Drive file or a link."
              tabIndex={tabIndexFor("sources", "add", SOURCE_KEYS)}
              onFocus={() => remember("sources", "add")}
            >
              <Folder count={0} ghost ghostIcon={<ShelfIcon name="task" size={22} />} />
              <span className={styles.sourceText}>
                <span className={styles.sourceName}>Add files</span>
                <span className={styles.sourceBlurb}>Files are added from a task.</span>
                <span className={styles.sourceFact}>
                  <span className={styles.cta}>Open Tasks</span>
                </span>
              </span>
            </Link>
          </li>
        </ul>

        {files.length === 0 ? (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>No files yet</h2>
            <p className={styles.emptyBody}>
              Attach a file, a Google Drive document or a link to any task and it appears here, in the folder for where it lives.
              {includesArchived ? "" : " Files on archived tasks stay out unless you include them below."}
            </p>
            <Link href={tasksHref} className={styles.btnPrimary}>Open Tasks</Link>
          </section>
        ) : (
          <section className={styles.section} aria-labelledby="shelf-latest">
            <div className={styles.sectionHead}>
              <h2 id="shelf-latest" className={styles.sectionTitle}>Latest additions</h2>
              <span className={styles.sectionSub}>Newest files from every source</span>
              <span className={styles.spacer} />
              {layoutSwitch(latestLayout, setLatestLayout, "Show latest additions as")}
            </div>
            <div data-files="">
              {latestLayout === "cards"
                ? cardGrid(latest.slice(0, 12), "latest", "Latest additions", true)
                : rowList(dateGroups(latest, nowSeconds), "latest")}
            </div>
          </section>
        )}
      </>
    );
  } else {
    const filterWords = activeType || searching
      ? `Showing ${typeCount(activeType, shown.length)}${searching ? ` matching “${query.trim()}”` : ""}`
      : null;
    body = (
      <section className={styles.section} aria-labelledby="shelf-folder-title">
        <div className={styles.toolbar}>
          {chips.length > 0 ? (
            <div className={styles.seg} role="group" aria-label="Show a type of file" data-chips="">
              <button type="button" aria-pressed={activeType === null} onClick={() => setType(null)}>
                All <span className={styles.segCount}>{scoped.length}</span>
              </button>
              {chips.map((chip) => (
                <button key={chip.type} type="button" aria-pressed={activeType === chip.type} onClick={() => setType(activeType === chip.type ? null : chip.type)}>
                  {chip.label} <span className={styles.segCount}>{chip.count}</span>
                </button>
              ))}
            </div>
          ) : null}
          <span className={styles.spacer} />
          {scoped.length > 0 ? layoutSwitch(folderLayout, setFolderLayout, "Show files as") : null}
        </div>
        <p className={styles.status} role="status">
          {filterWords ? (
            <>
              <span>{filterWords}</span>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setType(null);
                  setQuery("");
                }}
              >
                Clear
              </button>
            </>
          ) : null}
        </p>
        <div data-files="">
          {scoped.length === 0 ? (
            <div className={styles.noMatch}>
              <p className={styles.noMatchTitle}>Nothing in {folder!.name} yet</p>
              <p className={styles.noMatchBody}>
                {source === "signal"
                  ? "Upload a file to a task and it is kept here."
                  : source === "drive"
                    ? "Attach a Google Drive file to a task and it appears here."
                    : "Save a link to a task and it appears here."}
              </p>
              <Link href={tasksHref} className={styles.btn}>Open Tasks</Link>
            </div>
          ) : shown.length === 0 ? (
            noMatch
          ) : folderLayout === "cards" ? (
            cardGrid(shown, `folder:${source}`, `Files in ${folder!.name}`)
          ) : (
            rowList([{ label: "Files", files: shown }], `folder:${source}`)
          )}
        </div>
      </section>
    );
  }

  return (
    <div ref={rootRef} className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          {folder ? (
            <div className={styles.headText}>
              <nav className={styles.crumb} aria-label="File location">
                <button type="button" onClick={() => goTo(null)}>Files</button>
                <ShelfIcon name="chevron" size={12} />
                <span aria-current="page">{folder.name}</span>
              </nav>
              <div className={styles.folderHead}>
                <span className={styles.folderHeadArt}>
                  <Folder count={folder.count} mark={<SourceMark source={folder.key} size={14} />} showCount={false} size="small" />
                </span>
                <div>
                  <h1 id="shelf-folder-title" className={styles.title}>{folder.name}</h1>
                  <p className={styles.summary}>
                    {typeCount(null, folder.count)} · {folder.blurb}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.headText}>
              <h1 className={styles.title}>Files</h1>
              <p className={styles.summary}>{summarySentence(files, projectName, nowSeconds)}</p>
            </div>
          )}
          <div className={styles.headTools}>
            <label className={styles.field}>
              <ShelfIcon name="search" size={16} />
              <input
                ref={searchRef}
                type="search"
                className={styles.input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    const first = rootRef.current?.querySelector<HTMLElement>("[data-files] [data-item]");
                    if (first) {
                      event.preventDefault();
                      first.focus();
                    }
                  }
                }}
                placeholder={searchLabel}
                aria-label={searchLabel}
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
              />
              {query ? (
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label="Clear the search"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <ShelfIcon name="x" size={14} />
                </button>
              ) : (
                <kbd className={styles.kbd} aria-hidden="true">/</kbd>
              )}
            </label>
          </div>
        </header>

        {truncated ? (
          <p className={styles.notice} role="note">
            This project has more files than one page lists, so the oldest are not shown. Each one is still on its task.
          </p>
        ) : null}
        {sample ? <p className={styles.notice}>Sample files. In your projects, each one opens or downloads from here.</p> : null}

        <div className={styles.split} data-preview={chosen ? "" : undefined}>
          <div className={styles.main} key={source ?? "home"}>{body}</div>
          {chosen ? (
            <FilePreview
              key={`dock-${chosen.id}`}
              file={chosen}
              mode="docked"
              sample={sample}
              onClose={closePreview}
              whereLabel={whereLong}
            />
          ) : null}
        </div>

        {sample ? null : (
          <p className={styles.foot}>
            {includesArchived ? "Files on archived tasks are included. " : "Files on archived tasks are left out. "}
            <Link href={archivedHref} className={styles.footLink} scroll={false}>
              {includesArchived ? "Leave them out" : "Include them"}
            </Link>
          </p>
        )}
      </div>

      {sheetOpen && chosen ? (
        <FilePreview key={`sheet-${chosen.id}`} file={chosen} mode="sheet" sample={sample} onClose={closePreview} whereLabel={whereLong} />
      ) : null}
    </div>
  );
}

