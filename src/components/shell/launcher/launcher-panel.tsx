"use client";

/**
 * The apps and tools catalogue, drawn three ways from one component: the top
 * bar popover, the phone sheet and the /app/tools page. Same data, same
 * search, same keyboard model (docs/design/v3/launcher.md §5.1).
 *
 * Popover and sheet are a combobox: focus stays in the search field and the
 * arrow keys move an active entry (aria-activedescendant) across the app grid
 * by geometry, then down through the rows. Typing collapses the sections into
 * one ranked list. The page is a page: cards are ordinary links in tab order,
 * and only a typed query turns the field into a combobox.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShellIcon } from "../shell-icons";
import {
  APP_ENTRIES,
  COMING_SOON_LABEL,
  CONNECTED_ENTRIES,
  LAUNCHER_NAME,
  TOOL_ENTRIES,
  currentAppId,
  driveRowState,
  entryDescription,
  entryKey,
  entryLabel,
  feedbackHref,
  rankLauncher,
  toolRequestHref,
  type AppEntry,
  type LauncherEntry,
  type ToolEntry,
} from "./launcher-catalog";
import { LauncherGlyph } from "./launcher-icons";
import { ToolRequestCard } from "./tool-placeholder";
import styles from "./launcher.module.css";

export type LauncherVariant = "popover" | "sheet" | "page";

type Props = {
  variant: LauncherVariant;
  /** null while the Messages gate has not answered: the slot holds its size. */
  messagesEnabled: boolean | null;
  driveFlag: boolean;
  currentPath: string;
  /** Called after an entry is chosen (popover and sheet close). */
  onNavigate?: () => void;
  /** Escape with an empty field (popover and sheet close). */
  onEscapeEmpty?: () => void;
  /** The sheet's Done button. */
  onClose?: () => void;
  searchRef?: RefObject<HTMLInputElement | null>;
  /** The sheet focuses its title on open, so the keyboard stays down. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** Tiles rise in once, on the first open per page load. */
  stagger?: boolean;
};

type Resolved = {
  entry: LauncherEntry;
  href: string | null;
  /** The pill a row carries when section context is gone. */
  pill: string | null;
};

function resolve(entry: LauncherEntry, driveFlag: boolean): Resolved {
  if (entry.kind === "app") return { entry, href: entry.href, pill: null };
  if (entry.kind === "tool") return { entry, href: `/app/tools/${entry.slug}`, pill: COMING_SOON_LABEL };
  if (entry.state === "flag") {
    const drive = driveRowState(driveFlag);
    return drive.status === "setup"
      ? { entry, href: drive.href, pill: drive.label }
      : { entry, href: null, pill: drive.label };
  }
  return { entry, href: null, pill: COMING_SOON_LABEL };
}

function hueStyle(entry: LauncherEntry, index?: number): CSSProperties | undefined {
  const style: Record<string, string | number> = {};
  if (entry.kind === "tool") style["--tool-hue"] = `var(--v3-project-${entry.identity})`;
  if (entry.kind === "app") style["--app-hue"] = `var(--v3-project-${entry.identity})`;
  if (index !== undefined) style["--i"] = Math.min(index, 8);
  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}

/** One stable DOM id per entry, so aria-activedescendant survives a re-sort. */
function optionDomId(base: string, entry: LauncherEntry): string {
  return `${base}-${entryKey(entry).replace(/[^a-z0-9-]/gi, "-")}`;
}

export function LauncherPanel({
  variant,
  messagesEnabled,
  driveFlag,
  currentPath,
  onNavigate,
  onEscapeEmpty,
  onClose,
  searchRef,
  titleRef,
  stagger = false,
}: Props) {
  const router = useRouter();
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = searchRef ?? ownRef;
  const bodyRef = useRef<HTMLDivElement>(null);
  const isPage = variant === "page";

  const current = currentAppId(currentPath);
  const apps = APP_ENTRIES.filter((app) => !app.requiresMessages || messagesEnabled === true);
  const messagesPending = messagesEnabled === null;
  const searchable: LauncherEntry[] = [...apps, ...CONNECTED_ENTRIES, ...TOOL_ENTRIES];
  const trimmed = query.trim();
  const ranked = trimmed ? rankLauncher(query, searchable).map((entry) => resolve(entry, driveFlag)) : null;
  const resultsId = `${baseId}-list`;

  // The highlighted entry. A query always has one (the first result, until the
  // arrows move it); without a query nothing is active until the arrows ask.
  const rankedActive = ranked
    ? (ranked.find((item) => entryKey(item.entry) === activeKey) ?? ranked[0] ?? null)
    : null;
  const activeEntry: LauncherEntry | null = ranked
    ? (rankedActive?.entry ?? null)
    : (searchable.find((entry) => entryKey(entry) === activeKey) ?? null);
  const activeDomId = activeEntry ? optionDomId(baseId, activeEntry) : undefined;
  // The page is a page: its sections are links, not a widget.
  const comboboxActive = !isPage || Boolean(ranked);

  /** A popover line that never truncates; the page keeps the full sentence. */
  const describe = (entry: LauncherEntry) =>
    !isPage && entry.kind === "tool" ? (entry.shortLine ?? entry.oneLiner) : entryDescription(entry);

  // `/` finds on the page, as it does in Notes and the palette.
  useEffect(() => {
    if (!isPage) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inputRef, isPage]);

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  /** Selectable options in DOM order (static rows are not selectable). */
  const options = () =>
    Array.from(
      bodyRef.current?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [],
    );

  const activate = (element: HTMLElement | null | undefined) => {
    const key = element?.getAttribute("data-key") ?? null;
    setActiveKey(key);
    element?.scrollIntoView({ block: "nearest" });
  };

  /** Arrow keys across the grid by geometry, then through the rows. */
  const moveInSections = (key: string): boolean => {
    const list = options();
    if (!list.length) return false;
    const index = activeDomId ? list.findIndex((element) => element.id === activeDomId) : -1;
    if (index < 0) {
      if (key === "ArrowDown" || key === "ArrowRight" || key === "Home") activate(list[0]);
      else if (key === "End") activate(list[list.length - 1]);
      else return false;
      return true;
    }
    const here = list[index]!;
    const rect = here.getBoundingClientRect();
    switch (key) {
      case "Home":
        activate(list[0]);
        return true;
      case "End":
        activate(list[list.length - 1]);
        return true;
      case "ArrowLeft":
      case "ArrowRight": {
        const sibling = list[index + (key === "ArrowRight" ? 1 : -1)];
        const sameLine =
          sibling &&
          sibling.closest("ul") === here.closest("ul") &&
          Math.abs(sibling.getBoundingClientRect().top - rect.top) < 4;
        if (sameLine) activate(sibling);
        return true;
      }
      case "ArrowDown":
      case "ArrowUp": {
        const down = key === "ArrowDown";
        const centre = rect.left + rect.width / 2;
        const lines = list
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => (down ? box.top > rect.top + 4 : box.top < rect.top - 4));
        if (!lines.length) {
          // Up from the first line hands the field back its caret.
          if (!down) setActiveKey(null);
          return true;
        }
        const edge = down
          ? Math.min(...lines.map(({ box }) => box.top))
          : Math.max(...lines.map(({ box }) => box.top));
        const line = lines.filter(({ box }) => Math.abs(box.top - edge) < 4);
        line.sort(
          (a, b) =>
            Math.abs(a.box.left + a.box.width / 2 - centre) - Math.abs(b.box.left + b.box.width / 2 - centre),
        );
        activate(line[0]!.element);
        return true;
      }
      default:
        return false;
    }
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (query) {
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
        setActiveKey(null);
        return;
      }
      if (onEscapeEmpty) {
        event.preventDefault();
        event.stopPropagation();
        onEscapeEmpty();
      }
      return;
    }
    if (ranked) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        if (!ranked.length) return;
        const index = rankedActive ? ranked.indexOf(rankedActive) : 0;
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? ranked.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + ranked.length) % ranked.length;
        const entry = ranked[next]!.entry;
        setActiveKey(entryKey(entry));
        document.getElementById(optionDomId(baseId, entry))?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (rankedActive?.href) go(rankedActive.href);
      }
      return;
    }
    if (isPage) return;
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      // Left and right belong to the caret until an entry is active.
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !activeDomId) return;
      if ((event.key === "Home" || event.key === "End") && !activeDomId) return;
      if (moveInSections(event.key)) event.preventDefault();
      return;
    }
    if (event.key === "Enter" && activeEntry) {
      const target = resolve(activeEntry, driveFlag).href;
      if (target) {
        event.preventDefault();
        go(target);
      }
    }
  };

  /** Shared props for anything the combobox can point at. */
  /** List items only carry list semantics where there is no listbox. */
  const itemRole = comboboxActive ? ("none" as const) : undefined;

  const optionProps = (item: Resolved) => {
    const key = entryKey(item.entry);
    const selected = activeEntry ? entryKey(activeEntry) === key : false;
    if (!comboboxActive) return { "data-key": key };
    return {
      id: optionDomId(baseId, item.entry),
      role: "option" as const,
      "aria-selected": selected,
      "aria-disabled": item.href ? undefined : ("true" as const),
      "data-key": key,
      "data-active": selected ? "" : undefined,
      tabIndex: -1,
      onMouseMove: () => {
        if (!selected && item.href) setActiveKey(key);
      },
    };
  };

  // ── Pieces ──────────────────────────────────────────────────────────

  const count = ranked
    ? ranked.length === 0
      ? "No results"
      : ranked.length === 1
        ? "1 result"
        : `${ranked.length} results`
    : "";

  const field = (
    <div className={styles.search} data-variant={variant}>
      <ShellIcon.search size={16} />
      <label className={styles.srOnly} htmlFor={`${baseId}-search`}>
        Find an app or tool
      </label>
      <input
        id={`${baseId}-search`}
        ref={inputRef}
        className={styles.searchInput}
        type="text"
        role={comboboxActive ? "combobox" : undefined}
        aria-autocomplete={comboboxActive ? "list" : undefined}
        aria-expanded={comboboxActive ? true : undefined}
        aria-controls={comboboxActive ? resultsId : undefined}
        aria-activedescendant={comboboxActive ? activeDomId : undefined}
        aria-keyshortcuts={isPage ? "/" : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        placeholder="Find an app or tool"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveKey(null);
        }}
        onKeyDown={onFieldKeyDown}
      />
      {query ? (
        <button
          type="button"
          className={styles.clear}
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            setActiveKey(null);
            inputRef.current?.focus();
          }}
        >
          <ShellIcon.close size={14} />
        </button>
      ) : isPage ? (
        <kbd className={styles.kbd} aria-hidden="true">
          /
        </kbd>
      ) : null}
    </div>
  );

  const pill = (text: string, tone: "soon" | "setup") => (
    <span className={styles.pill} data-tone={tone}>
      {text}
    </span>
  );

  const entryLink = (item: Resolved, className: string, children: ReactNode, extra?: Record<string, unknown>) =>
    item.href ? (
      <Link
        href={item.href}
        className={className}
        onClick={() => onNavigate?.()}
        {...optionProps(item)}
        {...extra}
      >
        {children}
      </Link>
    ) : (
      <div className={className} data-static="" {...optionProps(item)} {...extra}>
        {children}
      </div>
    );

  /** Result rows: every entry says what it is, because section context is gone. */
  const renderResult = (item: Resolved) => {
    const { entry } = item;
    return (
      <li key={entryKey(entry)} role={itemRole}>
        {entryLink(
          item,
          styles.row,
          <>
            <span className={styles.rowTile} data-tone={entry.kind} style={hueStyle(entry)}>
              <LauncherGlyph name={entry.icon} size={18} />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{entryLabel(entry)}</span>
              <span className={styles.rowDescription}>{describe(entry)}</span>
            </span>
            {item.pill ? pill(item.pill, item.href ? "setup" : "soon") : null}
            <span className={styles.enter} aria-hidden="true">
              ↵
            </span>
          </>,
        )}
      </li>
    );
  };

  const renderAppTile = (app: AppEntry, position: number) => {
    const item = resolve(app, driveFlag);
    const here = current === app.id;
    return (
      <li key={app.id} role={itemRole}>
        {entryLink(
          item,
          isPage ? styles.appCard : styles.tile,
          isPage ? (
            <>
              <span className={styles.plate} data-identity="" style={hueStyle(app)}>
                <LauncherGlyph name={app.icon} size={20} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardLabel}>{app.label}</span>
                <span className={styles.cardDescription}>{app.description}</span>
              </span>
            </>
          ) : (
            <>
              <span className={styles.plate} data-identity="" style={hueStyle(app)}>
                <LauncherGlyph name={app.icon} size={20} />
              </span>
              <span className={styles.tileLabel}>{app.label}</span>
            </>
          ),
          {
            "aria-current": here ? "page" : undefined,
            style: stagger ? ({ "--i": Math.min(position, 8) } as CSSProperties) : undefined,
            "data-stagger": stagger ? "" : undefined,
          },
        )}
      </li>
    );
  };

  /** Holds the Messages slot at its final size until the gate answers. */
  const messagesSkeleton = (
    <li key="messages-pending" role={itemRole} aria-hidden="true">
      <span className={isPage ? styles.appCardSkeleton : styles.tileSkeleton}>
        <span className={styles.plateSkeleton} />
        <span className={styles.labelSkeleton} />
      </span>
    </li>
  );

  const appTiles: ReactNode[] = [];
  APP_ENTRIES.forEach((app) => {
    if (app.requiresMessages) {
      if (messagesPending) appTiles.push(messagesSkeleton);
      else if (messagesEnabled) appTiles.push(renderAppTile(app, appTiles.length));
      return;
    }
    appTiles.push(renderAppTile(app, appTiles.length));
  });

  const renderConnected = (item: Resolved) => (
    <li key={entryKey(item.entry)} role={itemRole}>
      {entryLink(
        item,
        isPage ? styles.connectedCard : styles.row,
        <>
          <span className={styles.rowTile} data-tone="connected">
            <LauncherGlyph name={item.entry.icon} size={18} />
          </span>
          <span className={styles.rowText}>
            <span className={styles.rowLabel}>{entryLabel(item.entry)}</span>
            <span className={styles.rowDescription}>{describe(item.entry)}</span>
          </span>
          {item.pill ? pill(item.pill, item.href ? "setup" : "soon") : null}
        </>,
      )}
    </li>
  );

  /** Popover and sheet: two across, the section title already carries the status. */
  const renderToolRow = (tool: ToolEntry) => {
    const item = resolve(tool, driveFlag);
    return (
      <li key={tool.slug} role={itemRole}>
        {entryLink(
          item,
          styles.toolRow,
          <>
            <span className={styles.rowTile} data-tone="tool" style={hueStyle(tool)}>
              <LauncherGlyph name={tool.icon} size={18} />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{tool.name}</span>
              <span className={styles.rowDescription}>{describe(tool)}</span>
            </span>
          </>,
        )}
      </li>
    );
  };

  /** Page: a card with its promise and the way in, always visible. */
  const renderToolCard = (tool: ToolEntry) => {
    const item = resolve(tool, driveFlag);
    return (
      <li key={tool.slug}>
        {entryLink(
          item,
          styles.toolCard,
          <>
            <span className={styles.toolPlate} style={hueStyle(tool)}>
              <LauncherGlyph name={tool.icon} size={22} />
            </span>
            <span className={styles.cardText}>
              <span className={styles.cardLabel}>{tool.name}</span>
              <span className={styles.cardDescription}>{tool.shortLine ?? tool.oneLiner}</span>
            </span>
            <span className={styles.planLink} aria-hidden="true">
              <ShellIcon.chevronRight size={16} />
            </span>
          </>,
        )}
      </li>
    );
  };

  /**
   * One group of the launcher. Inside the combobox the whole body is a
   * listbox, which may only own groups and options: the group is a
   * labelled div, and the list wrappers step aside (role none) so every
   * option sits directly under its group. On the page there is no listbox,
   * so the group is a plain landmark section with a real heading and list.
   */
  const section = (id: string, title: string, list: ReactNode, listClass: string) =>
    comboboxActive ? (
      <div className={styles.section} role="group" aria-labelledby={`${baseId}-${id}`}>
        <div className={styles.sectionTitle} id={`${baseId}-${id}`}>
          {title}
        </div>
        <ul className={listClass} role="none">
          {list}
        </ul>
      </div>
    ) : (
      <section className={styles.section} aria-labelledby={`${baseId}-${id}`}>
        <h2 className={styles.sectionTitle} id={`${baseId}-${id}`}>
          {title}
        </h2>
        <ul className={listClass}>{list}</ul>
      </section>
    );

  const connected = CONNECTED_ENTRIES.map((entry) => resolve(entry, driveFlag));

  const body = ranked ? (
    <div className={styles.results} key="ranked">
      {ranked.length ? (
        <ul className={styles.rows} id={resultsId} role="listbox" aria-label={LAUNCHER_NAME}>
          {ranked.map(renderResult)}
        </ul>
      ) : (
        <>
          {/* The combobox still points at a listbox; it is simply empty. */}
          <div id={resultsId} role="listbox" aria-label={LAUNCHER_NAME} />
          <div className={styles.empty}>
            <span className={styles.emptyMark} aria-hidden="true">
              <ShellIcon.search size={18} />
            </span>
            <p className={styles.emptyTitle}>Nothing called “{trimmed}” yet.</p>
            <p className={styles.emptyBody}>Tell us what you would use it for and we will look at it.</p>
            <a className={styles.suggest} href={toolRequestHref(query)}>
              Suggest it
            </a>
          </div>
        </>
      )}
    </div>
  ) : (
    <div
      className={styles.sections}
      key="sections"
      id={comboboxActive ? resultsId : undefined}
      role={comboboxActive ? "listbox" : undefined}
      aria-label={comboboxActive ? LAUNCHER_NAME : undefined}
    >
      {section("apps", "Your apps", appTiles, isPage ? styles.appGrid : styles.tileGrid)}
      {section("connected", "Works with", connected.map(renderConnected), isPage ? styles.connectedGrid : styles.rows)}
      {section(
        "soon",
        COMING_SOON_LABEL,
        isPage ? (
          <>
            {TOOL_ENTRIES.map(renderToolCard)}
            <li>
              <ToolRequestCard />
            </li>
          </>
        ) : (
          TOOL_ENTRIES.map(renderToolRow)
        ),
        isPage ? styles.toolGrid : styles.toolRows,
      )}
    </div>
  );

  const liveCount = (
    <p className={ranked && ranked.length === 0 ? styles.srOnly : styles.count} role="status" aria-live="polite">
      {count}
    </p>
  );

  // ── Page ────────────────────────────────────────────────────────────

  if (isPage) {
    return (
      <div className={styles.page}>
        <div className={styles.pageInner}>
          <header className={styles.pageHeader}>
            <div className={styles.pageHeading}>
              <h1 className={styles.pageTitle}>{LAUNCHER_NAME}</h1>
              <p className={styles.pageLede}>Everything in Signal Studio, and what we are building next.</p>
            </div>
            <div className={styles.pageSearch}>
              {field}
              {liveCount}
            </div>
          </header>
          <div ref={bodyRef} className={styles.pageBody}>
            {body}
          </div>
        </div>
      </div>
    );
  }

  // ── Popover and sheet ───────────────────────────────────────────────

  const sheet = variant === "sheet";
  return (
    <div className={styles.panel} data-variant={variant}>
      <div className={styles.panelHead} data-sheet-drag={sheet ? "" : undefined}>
        <div className={styles.panelTitleRow}>
          <h2 className={styles.panelTitle} ref={titleRef} tabIndex={sheet ? -1 : undefined}>
            {LAUNCHER_NAME}
          </h2>
          {sheet ? (
            <button type="button" className={styles.done} onClick={onClose}>
              Done
            </button>
          ) : (
            <Link href="/app/tools" className={styles.seeAll} onClick={() => onNavigate?.()}>
              See all
              <ShellIcon.chevronRight size={14} />
            </Link>
          )}
        </div>
        {field}
        {liveCount}
      </div>
      <div ref={bodyRef} className={styles.panelBody}>
        {body}
      </div>
      <div className={styles.panelFoot}>
        {sheet ? (
          <Link href="/app/tools" className={styles.footLink} onClick={() => onNavigate?.()}>
            See all apps and tools
            <ShellIcon.chevronRight size={14} />
          </Link>
        ) : ranked ? null : (
          <p className={styles.footLine} aria-hidden="true">
            {activeEntry ? (
              <>
                <span className={styles.footName}>{entryLabel(activeEntry)}</span>
                {entryDescription(activeEntry)}
              </>
            ) : (
              "Type to find, or use the arrow keys."
            )}
          </p>
        )}
        <div className={styles.footRow}>
          <a href={feedbackHref()} className={styles.footLink} data-quiet="">
            Missing something? Tell us
          </a>
          {sheet ? null : (
            <span className={styles.legend} aria-hidden="true">
              <kbd className={styles.kbd}>↵</kbd>
              <span>open</span>
              <kbd className={styles.kbd}>esc</kbd>
              <span>close</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
