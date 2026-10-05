"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { chatEnabled } from "@/components/shell/app-shell";
import { ShellIcon, type ShellIconName } from "@/components/shell/shell-icons";
import { STUDIO_PALETTE_EVENT } from "@/components/studio-bar/studio-chrome-context";
import {
  BRIEFING_APP_PATH,
  HOME_APP_PATH,
  MESSAGES_APP_PATH,
  MY_WORK_APP_PATH,
  PRODUCT_APP_PATHS,
  PROJECT_APP_PATH,
  suiteSurfaceFromAppPath,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";

type SuiteDestination = Readonly<{
  id: string;
  name: string;
  promise: string;
  searchTerms: string;
  path: string;
  icon: ShellIconName;
  /** Carries the open Project across, as the sidebar's own rows do. */
  suite?: boolean;
  /** Listed only where the sidebar lists Chat. */
  requiresChat?: boolean;
}>;

/**
 * Every place the sidebar names, in the sidebar's order: the approved
 * navigation first, then what sits under "Initial setup", then Settings.
 * Search here and the sidebar agree on what exists.
 */
const DESTINATIONS: readonly SuiteDestination[] = Object.freeze([
  {
    id: "home",
    name: "Home",
    promise: "Start with what needs you.",
    searchTerms:
      "briefing risk attention daily quiet evidence signal home what matters now",
    path: HOME_APP_PATH,
    icon: "home",
    suite: true,
  },
  {
    id: "overview",
    name: "Overview",
    promise: "The wider view across your projects.",
    searchTerms: "overview briefing summary pulse status progress signal",
    path: BRIEFING_APP_PATH,
    icon: "pulse",
  },
  {
    id: "projects",
    name: "Projects",
    promise: "Every project you are part of.",
    searchTerms: "project projects events clients archive",
    path: PROJECT_APP_PATH,
    icon: "projects",
    suite: true,
  },
  {
    id: "tasks",
    name: "Tasks",
    promise: "Move the work from start to finish.",
    searchTerms: "work project board list calendar task execute",
    path: PRODUCT_APP_PATHS.tasks,
    icon: "tasks",
    suite: true,
  },
  {
    id: "timeline",
    name: "Timeline",
    promise: "See the milestones and what comes next.",
    searchTerms: "milestone plan progress publish share project",
    path: PRODUCT_APP_PATHS.timeline,
    icon: "timeline",
    suite: true,
  },
  {
    id: "files",
    name: "Files",
    promise: "Every file in one place.",
    searchTerms: "files attachments uploads photos pdf contracts documents",
    path: "/app/files",
    icon: "files",
  },
  {
    id: "analytics",
    name: "Analytics",
    promise: "See how the work is going.",
    searchTerms: "analytics reports charts stats insights numbers progress",
    path: "/app/analytics",
    icon: "analytics",
  },
  {
    id: "inbox",
    name: "Inbox",
    promise: "What is waiting for you.",
    searchTerms: "inbox notifications mentions updates waiting assigned",
    path: "/app/inbox",
    icon: "inbox",
  },
  {
    id: "my-tasks",
    name: "My tasks",
    promise: "The tasks that are yours.",
    searchTerms: "my tasks mine assigned to me your work to do",
    path: MY_WORK_APP_PATH,
    icon: "myTasks",
  },
  {
    id: "messages",
    name: "Chat",
    promise: "Talk with your team.",
    searchTerms: "chat messages conversation talk dm team channel",
    path: MESSAGES_APP_PATH,
    icon: "messages",
    requiresChat: true,
  },
  {
    id: "notes",
    name: "Notes",
    promise: "Capture a thought before it disappears.",
    searchTerms: "capture write private note thought inbox",
    path: PRODUCT_APP_PATHS.notes,
    icon: "notes",
    suite: true,
  },
  {
    id: "settings",
    name: "Settings",
    promise: "Your account, appearance and connections.",
    searchTerms: "settings preferences account profile theme appearance import",
    path: "/app/settings",
    icon: "settings",
  },
]);

/** The destination a path belongs to; the most specific path wins. */
function currentDestinationId(pathname: string): string | null {
  let best: SuiteDestination | null = null;
  for (const destination of DESTINATIONS) {
    const owns = pathname === destination.path || pathname.startsWith(`${destination.path}/`);
    if (owns && (!best || destination.path.length > best.path.length)) best = destination;
  }
  return best?.id ?? null;
}

function matches(destination: SuiteDestination, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${destination.name} ${destination.promise} ${destination.searchTerms}`
    .toLowerCase()
    .includes(normalized);
}

/**
 * Product-neutral owner for the Studio Bar command event.
 *
 * Tasks mounts its own task-aware palette inside the Tasks runtime. Every
 * other page mounts this deliberately smaller jump list so the shared
 * command field is never a dead control and never pretends to search data
 * it does not own. It lists the places the sidebar lists, nothing else.
 */
export function SuiteCommandRoot() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const suiteContext = useSuiteContext();
  const activeProduct = suiteSurfaceFromAppPath(pathname);
  // Home has no product runtime of its own, so the suite switcher owns
  // the command field there, exactly as on the sibling canvases.
  const ownsCommand = activeProduct !== "tasks";
  const currentId = currentDestinationId(pathname);
  const [open, setOpen] = useState(false);
  // Read when the palette opens: Chat is offered only where the sidebar offers it.
  const [chat, setChat] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(
    () =>
      DESTINATIONS.filter(
        (destination) => (!destination.requiresChat || chat) && matches(destination, query),
      ),
    [chat, query],
  );

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, []);

  const openCommand = useCallback(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    setActiveIndex(0);
    setChat(chatEnabled());
    setOpen(true);
  }, []);

  const navigate = useCallback(
    (destination: SuiteDestination) => {
      setOpen(false);
      if (destination.id === currentId && pathname === destination.path) {
        window.setTimeout(() => returnFocusRef.current?.focus(), 0);
        return;
      }
      router.push(
        destination.suite
          ? withSuiteContext(destination.path, suiteContext)
          : destination.path,
      );
    },
    [currentId, pathname, router, suiteContext],
  );

  useEffect(() => {
    if (!ownsCommand) return;

    const onPalette = () => openCommand();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        if (open) close();
        else openCommand();
      }
    };
    window.addEventListener(STUDIO_PALETTE_EVENT, onPalette);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(STUDIO_PALETTE_EVENT, onPalette);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open, openCommand, ownsCommand]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const layer = layerRef.current;
    const isolated = layer?.parentElement
      ? Array.from(layer.parentElement.children)
          .filter(
            (element): element is HTMLElement =>
              element instanceof HTMLElement && element !== layer,
          )
          .map((element) => ({
            element,
            inert: element.inert,
            ariaHidden: element.getAttribute("aria-hidden"),
          }))
      : [];
    document.body.style.overflow = "hidden";
    for (const snapshot of isolated) {
      snapshot.element.inert = true;
      snapshot.element.setAttribute("aria-hidden", "true");
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      for (const snapshot of isolated) {
        snapshot.element.inert = snapshot.inert;
        if (snapshot.ariaHidden === null) {
          snapshot.element.removeAttribute("aria-hidden");
        } else {
          snapshot.element.setAttribute("aria-hidden", snapshot.ariaHidden);
        }
      }
    };
  }, [open]);

  if (!ownsCommand || !open) return null;

  /** Moves the highlight and keeps it in view inside the scrolling list. */
  const moveTo = (index: number) => {
    setActiveIndex(index);
    const option = results[index];
    if (option) {
      document
        .getElementById(`suite-command-option-${option.id}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  };

  return (
    <div
      ref={layerRef}
      data-suite-command-layer
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 px-3 pt-[12vh] backdrop-blur-[2px] sm:px-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        aria-describedby="suite-command-description"
        aria-label="Search or jump to"
        aria-modal="true"
        className="w-full max-w-[640px] overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_28px_90px_-32px_rgba(10,10,12,0.45)]"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key === "ArrowDown" && results.length) {
            event.preventDefault();
            moveTo((activeIndex + 1) % results.length);
            return;
          }
          if (event.key === "ArrowUp" && results.length) {
            event.preventDefault();
            moveTo((activeIndex - 1 + results.length) % results.length);
            return;
          }
          if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            navigate(results[activeIndex]);
            return;
          }
          if (event.key === "Tab") {
            const focusable = Array.from(
              dialogRef.current?.querySelectorAll<HTMLElement>(
                'input, button, a[href], [tabindex]:not([tabindex="-1"])',
              ) ?? [],
            ).filter((element) => !element.hasAttribute("disabled"));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
        role="dialog"
      >
        <div className="flex min-h-14 items-center gap-3 border-b border-black/10 px-4">
          <ShellIcon.search size={17} />
          <input
            ref={inputRef}
            aria-activedescendant={
              results[activeIndex]
                ? `suite-command-option-${results[activeIndex].id}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls="suite-command-results"
            aria-expanded="true"
            aria-label="Find a place in Signal Studio"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] tracking-[-0.01em] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search or jump to…"
            role="combobox"
            spellCheck={false}
            value={query}
          />
          <kbd className="rounded border border-black/10 bg-black/[0.025] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-faint)]">
            Esc
          </kbd>
        </div>

        <p
          className="px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]"
          id="suite-command-description"
        >
          Signal Studio
        </p>

        <ul
          className="max-h-[min(56vh,435px)] overflow-y-auto px-2 pb-2"
          id="suite-command-results"
          role="listbox"
        >
          {results.map((destination, index) => {
            const current = destination.id === currentId;
            const Icon = ShellIcon[destination.icon];
            const selected = index === activeIndex;
            return (
              <li
                aria-selected={selected}
                className={[
                  "group flex min-h-[58px] w-full cursor-pointer items-center gap-3 rounded-[9px] px-3 text-left outline-none transition-colors",
                  selected
                    ? "bg-black/[0.055]"
                    : "hover:bg-black/[0.035]",
                ].join(" ")}
                id={`suite-command-option-${destination.id}`}
                key={destination.id}
                onClick={() => navigate(destination)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                tabIndex={-1}
              >
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border",
                      current
                        ? "border-[color-mix(in_srgb,var(--x-studio-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--x-studio-accent)_9%,white)] text-[var(--x-studio-accent)]"
                        : "border-black/10 bg-white text-[var(--ink-soft)]",
                    ].join(" ")}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
                      {destination.name}
                      {current ? (
                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-[color:var(--v3-accent-text)]">
                          Current
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-faint)]">
                      {destination.promise}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-[13px] text-[var(--ink-faint)]"
                  >
                    ↗
                  </span>
              </li>
            );
          })}
        </ul>

        {results.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-[var(--ink)]">
              Nothing matches “{query.trim()}”.
            </p>
            <p className="mt-1 text-[12px] text-[var(--ink-faint)]">
              Try Projects, Tasks, Files or Settings.
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-black/10 bg-black/[0.018] px-4 py-2 font-mono text-[9.5px] text-[var(--ink-faint)]">
          <span>↑↓ navigate · ↵ open</span>
          <span>Project context carries across</span>
        </div>
      </div>
    </div>
  );
}
