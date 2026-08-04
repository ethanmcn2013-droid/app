"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePalette } from "@/components/app/palette/command-palette";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { RailIcon } from "@/components/studio-bar/rail-icons";
import { ProjectsSidebar } from "@/components/studio-bar/projects-sidebar";
import { useCurrentUser } from "@/lib/auth-context";
import {
  HOME_APP_PATH,
  PRODUCT_APP_PATHS,
  TASKS_VIEW_PATHS,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { openTaskCount } from "@/lib/tasks/selectors";
import type { ProjectsTreeData } from "@/server/actions/projects-tree";

const VIEWS = [
  { href: TASKS_VIEW_PATHS.board, label: "Board", icon: "board" },
  { href: TASKS_VIEW_PATHS.list, label: "List", icon: "list" },
  { href: TASKS_VIEW_PATHS.timeline, label: "Schedule", icon: "timeline" },
  { href: TASKS_VIEW_PATHS.calendar, label: "Calendar", icon: "calendar" },
] as const;

const MOBILE_PRODUCTS: ReadonlyArray<{
  id: "home" | "notes" | "tasks" | "timeline";
  label: string;
  path: string;
}> = [
  { id: "home", label: "Home", path: HOME_APP_PATH },
  { id: "notes", label: "Notes", path: PRODUCT_APP_PATHS.notes },
  { id: "tasks", label: "Tasks", path: PRODUCT_APP_PATHS.tasks },
  { id: "timeline", label: "Timeline", path: PRODUCT_APP_PATHS.timeline },
];

export function AppSidebar({
  active: activeProp,
  tree,
  activeWorkspaceId,
}: {
  active?: string;
  tree: ProjectsTreeData;
  activeWorkspaceId: string;
}) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  return (
    <>
      <MobileTabBar active={active} />
      <ProjectsSidebar activeWorkspaceId={activeWorkspaceId} tree={tree} />
    </>
  );
}

type LocalIcon =
  | "inbox"
  | "user"
  | "search"
  | "board"
  | "list"
  | "timeline"
  | "calendar"
  | "views";

function NavIcon({ kind }: { kind: LocalIcon }) {
  const common = {
    "aria-hidden": true,
    className: "h-[18px] w-[18px] flex-shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };
  if (kind === "inbox") {
    return (
      <svg {...common}>
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </svg>
    );
  }
  if (kind === "user") {
    return (
      <svg {...common}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }
  if (kind === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    );
  }
  if (kind === "board") {
    return (
      <svg {...common}>
        <rect height="18" rx="1" width="7" x="3" y="3" />
        <rect height="11" rx="1" width="7" x="14" y="3" />
      </svg>
    );
  }
  if (kind === "list") {
    return (
      <svg {...common}>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (kind === "timeline") {
    return (
      <svg {...common}>
        <rect height="3" rx="1" width="11" x="3" y="6" />
        <rect height="3" rx="1" width="13" x="7" y="11" />
        <rect height="3" rx="1" width="9" x="5" y="16" />
      </svg>
    );
  }
  if (kind === "calendar") {
    return (
      <svg {...common}>
        <rect height="18" rx="2" width="18" x="3" y="4" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
      <rect height="7" rx="1" width="7" x="14" y="14" />
    </svg>
  );
}

/**
 * The one mobile navigation surface for Tasks. It keeps the fixed suite spine
 * visible and places local work destinations in one keyboard-complete menu.
 */
function MobileTabBar({ active }: { active: string }) {
  const tasks = useTasksState();
  const me = useCurrentUser();
  const suiteContext = useSuiteContext();
  const { openPalette } = usePalette();
  const [viewsOpen, setViewsOpen] = useState(false);
  const wrapRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemsRef = useRef<HTMLElement[]>([]);
  const menuId = useId();
  const triggerId = useId();

  const inboxCount = openTaskCount(tasks);
  const myCount = openTaskCount(tasks, { user: me });
  const activeView = VIEWS.find((view) => active === view.href);
  const isViewActive = Boolean(activeView);

  const closeViews = useCallback((restoreFocus: boolean) => {
    setViewsOpen(false);
    if (restoreFocus) {
      window.setTimeout(
        () => triggerRef.current?.focus({ preventScroll: true }),
        0,
      );
    }
  }, []);

  const focusMenuItem = useCallback((index: number) => {
    const items = menuItemsRef.current.filter((item) => item.isConnected);
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus({
      preventScroll: true,
    });
  }, []);

  useEffect(() => {
    if (!viewsOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const activeIndex = Math.max(
        0,
        VIEWS.findIndex((view) => view.href === active),
      );
      focusMenuItem(activeIndex);
    });
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closeViews(false);
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeViews(true);
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [active, closeViews, focusMenuItem, viewsOpen]);

  const registerMenuItem = (element: HTMLElement | null, index: number) => {
    if (element) menuItemsRef.current[index] = element;
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = menuItemsRef.current.filter((item) => item.isConnected);
    const currentIndex = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLElement),
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    } else if (event.key === "Tab") {
      closeViews(false);
    }
  };

  return (
    <nav
      ref={wrapRef}
      aria-label="Signal Studio products and Tasks views"
      /* Marks this as the rail that owns the foot of the mobile viewport, so
         floating chrome (the dev notice) can measure it and sit clear. */
      data-signal-bottom-nav="tasks"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-white/95 shadow-[0_-16px_34px_-30px_rgba(20,21,26,0.36)] backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {viewsOpen ? (
        <div
          aria-labelledby={triggerId}
          className="absolute inset-x-2 bottom-full mb-2 max-h-[min(70dvh,430px)] overflow-y-auto rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_22px_50px_-20px_rgba(20,21,26,0.28)]"
          id={menuId}
          onKeyDown={onMenuKeyDown}
          role="menu"
        >
          <p aria-hidden="true" className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint" role="presentation">
            Tasks views
          </p>
          {VIEWS.map((view, index) => {
            const current = active === view.href;
            return (
              <Link
                ref={(element) => registerMenuItem(element, index)}
                aria-current={current ? "page" : undefined}
                className={[
                  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium outline-none transition-colors",
                  current
                    ? "bg-brand-soft text-brand"
                    : "text-ink-soft hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:text-ink",
                ].join(" ")}
                href={withSuiteContext(view.href, suiteContext)}
                key={view.href}
                onClick={() => closeViews(false)}
                role="menuitem"
                tabIndex={-1}
              >
                <NavIcon kind={view.icon} />
                <span className="flex-1">{view.label}</span>
                {current ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em]">
                    Current
                  </span>
                ) : null}
              </Link>
            );
          })}
          <div className="mx-2 my-1 h-px bg-line-soft" role="separator" />
          <p aria-hidden="true" className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint" role="presentation">
            Work
          </p>
          <Link
            ref={(element) => registerMenuItem(element, 4)}
            aria-current={active === "/app/inbox" ? "page" : undefined}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-ink-soft outline-none transition-colors hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:text-ink"
            href={withSuiteContext("/app/inbox", suiteContext)}
            onClick={() => closeViews(false)}
            role="menuitem"
            tabIndex={-1}
          >
            <NavIcon kind="inbox" />
            <span className="flex-1">Inbox</span>
            <span
              aria-label={`${inboxCount} open tasks`}
              className="font-mono text-[10px] text-ink-faint"
            >
              {inboxCount}
            </span>
          </Link>
          <Link
            ref={(element) => registerMenuItem(element, 5)}
            aria-current={active === "/app/my-tasks" ? "page" : undefined}
            className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-ink-soft outline-none transition-colors hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:text-ink"
            href={withSuiteContext("/app/my-tasks", suiteContext)}
            onClick={() => closeViews(false)}
            role="menuitem"
            tabIndex={-1}
          >
            <NavIcon kind="user" />
            <span className="flex-1">My week</span>
            <span
              aria-label={`${myCount} open tasks`}
              className="font-mono text-[10px] text-ink-faint"
            >
              {myCount}
            </span>
          </Link>
          <button
            ref={(element) => registerMenuItem(element, 6)}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-ink-soft outline-none transition-colors hover:bg-bg-sunken focus-visible:bg-bg-sunken focus-visible:text-ink"
            onClick={() => {
              closeViews(false);
              triggerRef.current?.focus({ preventScroll: true });
              openPalette();
            }}
            role="menuitem"
            tabIndex={-1}
            type="button"
          >
            <NavIcon kind="search" />
            Search tasks
          </button>
        </div>
      ) : null}

      <ul className="grid min-h-14 grid-cols-5 items-stretch px-1 pt-1">
        {MOBILE_PRODUCTS.map((product) => {
          const current = product.id === "tasks";
          return (
            <li className="min-w-0" key={product.id}>
              <Link
                aria-current={current ? "page" : undefined}
                className={[
                  "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-semibold outline-none transition-colors",
                  current
                    ? "bg-brand-soft/60 text-brand"
                    : "text-ink-quiet hover:bg-bg-sunken/70 hover:text-ink focus-visible:bg-bg-sunken/70 focus-visible:text-ink",
                ].join(" ")}
                data-product={product.id}
                href={withSuiteContext(product.path, suiteContext)}
              >
                <RailIcon name={product.id} size={17} />
                <span className="max-w-full truncate">{product.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            ref={triggerRef}
            aria-controls={viewsOpen ? menuId : undefined}
            aria-expanded={viewsOpen}
            aria-haspopup="menu"
            className={[
              "flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-semibold outline-none transition-colors",
              isViewActive || viewsOpen
                ? "bg-brand-soft/60 text-brand"
                : "text-ink-quiet hover:bg-bg-sunken/70 hover:text-ink focus-visible:bg-bg-sunken/70 focus-visible:text-ink",
            ].join(" ")}
            id={triggerId}
            onClick={() => {
              if (viewsOpen) closeViews(true);
              else setViewsOpen(true);
            }}
            type="button"
          >
            <NavIcon kind={activeView?.icon ?? "views"} />
            <span className="max-w-full truncate">
              {activeView?.label ?? "Views"}
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
