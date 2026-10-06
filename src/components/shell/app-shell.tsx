"use client";

/**
 * Signal Studio v3 app shell: one persistent sidebar + top bar for every /app
 * page. Replaces the per-product studio bar, icon rail, bottom tab bar and the
 * Tasks floor's own spine and dock (redesign sprint, 24 Sep 2026).
 *
 * Chrome-free routes (/s/*, the Timeline owner preview) still render bare.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isBareChromePath } from "@/lib/bare-artifact-path";
import {
  STUDIO_CREATE_EVENT,
  STUDIO_PALETTE_EVENT,
} from "@/components/studio-bar/studio-chrome-context";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { AUTOMATIONS_APP_PATH, automationPath, suiteSurfaceFromAppPath } from "@/lib/product-urls";
import {
  CREATE_LABEL,
  CREATE_PROJECT_HREF,
  CREATE_PROJECT_READY_ATTRIBUTE,
  createKindForPath,
  SHELL_CREATE_ATTRIBUTE,
  SHELL_CREATE_PROJECT_EVENT,
} from "@/lib/shell-create";
import {
  applyThemeChoice,
  readThemeChoice,
  subscribeThemeChoice,
  type ThemeChoice,
} from "@/lib/theme-mode";
import { updateUserPreferencesAction } from "@/server/actions/preferences";
import { ShellIcon } from "./shell-icons";
import { crumbsForPath } from "./shell-nav";
import { AppsLauncher } from "./launcher/apps-launcher";
import styles from "./shell.module.css";

type ShellState = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (!value) {
    return { collapsed: false, toggleCollapsed: () => {}, mobileOpen: false, setMobileOpen: () => {} };
  }
  return value;
}

const COLLAPSE_KEY = "signal:v3:sidebar-collapsed";
const COLLAPSE_EVENT = "signal:v3:sidebar";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Below 900px the sidebar is a drawer, and a drawer is always the full
 * sidebar: a rail saved on a wide window must not hide the drawer's labels.
 */
const DRAWER_QUERY = "(max-width: 899px)";
function readDrawer(): boolean {
  return window.matchMedia(DRAWER_QUERY).matches;
}
function subscribeDrawer(onChange: () => void) {
  const query = window.matchMedia(DRAWER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** ⌘K on a Mac, Ctrl K everywhere else. The server and first paint say ⌘K. */
const noSubscribe = () => () => {};
export function useShortcutLabel(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

/**
 * Whether this viewer can use Chat. The sidebar is told by the server and
 * marks itself; anything else in the shell reads that mark when it opens, so
 * a Chat link is offered on exactly the condition the Chat row is.
 */
export const CHAT_ENABLED_ATTRIBUTE = "data-chat-enabled";
export function chatEnabled(): boolean {
  return document.querySelector(`[data-shell="v3"] [${CHAT_ENABLED_ATTRIBUTE}]`) !== null;
}

export function openPalette(query = "") {
  window.dispatchEvent(new CustomEvent(STUDIO_PALETTE_EVENT, { detail: { query } }));
}

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const bare = isBareChromePath(pathname);
  // Saved per browser; the server and first paint render expanded.
  const savedCollapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const drawer = useSyncExternalStore(subscribeDrawer, readDrawer, () => false);
  const collapsed = savedCollapsed && !drawer;
  const [mobileOpen, setMobileOpen] = useState(false);
  // Navigating closes the mobile drawer (adjusted during render, not in an effect).
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapsed = useCallback(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, readCollapsed() ? "0" : "1");
    } catch {
      /* storage unavailable: the toggle cannot persist */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, []);

  const state = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen],
  );

  if (bare) return <>{children}</>;

  return (
    <ShellContext.Provider value={state}>
      <div
        className={`${styles.shell} v3-focus`}
        data-shell="v3"
        data-collapsed={collapsed ? "" : undefined}
        data-mobile-open={mobileOpen ? "" : undefined}
      >
        {sidebar}
        <div className={styles.scrim} onClick={() => setMobileOpen(false)} aria-hidden="true" />
        <div className={styles.main}>
          <Topbar />
          <div className={styles.content} data-shell-content="">
            {children}
          </div>
        </div>
      </div>
    </ShellContext.Provider>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Topbar() {
  const pathname = usePathname() ?? "";
  const { setMobileOpen } = useShell();
  const crumbs = crumbsForPath(pathname);
  const surface = suiteSurfaceFromAppPath(pathname) ?? "home";
  const shortcut = useShortcutLabel();

  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={`${styles.iconButton} ${styles.menuButton}`}
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        <ShellIcon.menu />
      </button>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} style={{ display: "contents" }}>
              {index > 0 ? <span className={styles.crumbSep} aria-hidden="true">/</span> : null}
              {last || !crumb.href ? (
                <span className={last ? styles.crumbCurrent : undefined} aria-current={last ? "page" : undefined}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href}>{crumb.label}</Link>
              )}
            </span>
          );
        })}
      </nav>
      <div className={styles.topActions}>
        <button type="button" className={styles.topSearch} onClick={() => openPalette()} aria-label="Search or jump to">
          <ShellIcon.search />
          <span>Search or jump to…</span>
          <kbd className={styles.kbd}>{shortcut}</kbd>
        </button>
        <Link href="/app/inbox" className={styles.iconButton} aria-label="Inbox">
          <ShellIcon.bell />
        </Link>
        <AppsLauncher />
        <NewMenu />
        <UserButtonWithSuite current={surface} />
      </div>
    </header>
  );
}

/** True when the Tasks runtime (and its add-task dialog) is mounted. */
function createHandlerReady(): boolean {
  return document.documentElement.hasAttribute("data-create-ready");
}

/**
 * The one create button (founder, 6 Oct 2026). Its main half starts what the
 * page you are on is about: an automation on Automations, a project on
 * Projects, otherwise a task. The small half beside it lists everything that
 * can be started, so no create path depends on where you are.
 */
function NewMenu() {
  const [open, setOpen] = useState(false);
  // Read when the menu opens, so Message is offered only where Chat is.
  const [chat, setChat] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const kind = createKindForPath(pathname);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const newTask = () => {
    setOpen(false);
    if (createHandlerReady()) {
      window.dispatchEvent(new CustomEvent(STUDIO_CREATE_EVENT));
    } else {
      router.push("/app/tasks?create=task");
    }
  };

  const newProject = () => {
    setOpen(false);
    if (document.documentElement.hasAttribute(CREATE_PROJECT_READY_ATTRIBUTE)) {
      window.dispatchEvent(new CustomEvent(SHELL_CREATE_PROJECT_EVENT));
    } else {
      router.push(CREATE_PROJECT_HREF);
    }
  };

  // A blank draft, kept in this browser like every other, then its canvas.
  // The Automations code loads when asked for, not with the shell.
  const newAutomation = () => {
    setOpen(false);
    void Promise.all([import("@/lib/automations/graph"), import("@/lib/automations/draft-store")]).then(
      ([graph, store]) => {
        const doc = graph.blankAutomation();
        store.saveDraft(doc);
        router.push(automationPath(doc.id));
      },
      () => router.push(AUTOMATIONS_APP_PATH),
    );
  };

  const start = { task: newTask, project: newProject, automation: newAutomation }[kind];

  return (
    <div
      ref={ref}
      className={styles.newSplit}
      onKeyDown={(event) => {
        // Escape hands focus back to the button the menu belongs to.
        if (event.key === "Escape" && open) buttonRef.current?.focus();
      }}
    >
      <button type="button" className={styles.newButton} aria-label={CREATE_LABEL[kind]} onClick={start} {...{ [SHELL_CREATE_ATTRIBUTE]: kind }}>
        <ShellIcon.plus />
        <span>{CREATE_LABEL[kind]}</span>
      </button>
      <button
        ref={buttonRef}
        type="button"
        className={styles.newMore}
        aria-label="New"
        title="Everything you can start"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setChat(chatEnabled());
          setOpen((value) => !value);
        }}
      >
        <ShellIcon.chevronDown size={12} />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" onClick={newTask}>
            <ShellIcon.tasks /> Task <span className={styles.menuHint}>C</span>
          </button>
          <button type="button" role="menuitem" onClick={newProject}>
            <ShellIcon.projects /> Project
          </button>
          <button type="button" role="menuitem" onClick={newAutomation}>
            <ShellIcon.automations /> Automation <span className={styles.menuHint}>Preview</span>
          </button>
          <Link href="/app/notes" role="menuitem" onClick={close}>
            <ShellIcon.notes /> Note
          </Link>
          {chat ? (
            <Link href="/app/messages" role="menuitem" onClick={close}>
              <ShellIcon.messages /> Message
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Applies the choice to the page at once, then saves it to the account. */
function chooseTheme(next: ThemeChoice) {
  applyThemeChoice(next);
  void updateUserPreferencesAction({ themeMode: next }).catch(() => {});
}

const THEME_NAMES: Record<ThemeChoice, string> = { dark: "Dark", light: "Light" };

/**
 * The theme as one small button. The app is Dark unless you choose Light;
 * each press switches to the other, and the icon shows the one in use. A
 * set-once preference, so it takes an icon's room, not a row.
 */
export function ThemeCycleButton({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, () => "dark" as ThemeChoice);
  const next: ThemeChoice = theme === "dark" ? "light" : "dark";
  const Icon = theme === "light" ? ShellIcon.sun : ShellIcon.moon;
  const label = `Theme: ${THEME_NAMES[theme]}. Switch to ${THEME_NAMES[next]}`;
  return (
    <button type="button" className={className} onClick={() => chooseTheme(next)} aria-label={label} title={label}>
      <Icon />
    </button>
  );
}

/** Dark or Light, applied instantly and saved to preferences. */
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeThemeChoice, readThemeChoice, () => "dark" as ThemeChoice);

  const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
    { value: "dark", label: "Dark", icon: <ShellIcon.moon size={14} /> },
    { value: "light", label: "Light", icon: <ShellIcon.sun size={14} /> },
  ];

  return (
    <div className={styles.segmented} role="group" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          onClick={() => chooseTheme(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
