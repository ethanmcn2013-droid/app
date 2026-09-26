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
import { suiteSurfaceFromAppPath } from "@/lib/product-urls";
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
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
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
          <kbd className={styles.kbd}>⌘K</kbd>
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

function NewMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  const newTask = () => {
    setOpen(false);
    if (createHandlerReady()) {
      window.dispatchEvent(new CustomEvent(STUDIO_CREATE_EVENT));
    } else {
      router.push("/app/tasks?create=task");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={styles.newButton}
        aria-label="New"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ShellIcon.plus />
        <span>New</span>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" onClick={newTask}>
            <ShellIcon.tasks /> Task <span className={styles.menuHint}>C</span>
          </button>
          <Link href="/app/notes" role="menuitem" onClick={close}>
            <ShellIcon.notes /> Note
          </Link>
          <Link href="/app/project" role="menuitem" onClick={close}>
            <ShellIcon.projects /> Project
          </Link>
          <Link href="/app/messages" role="menuitem" onClick={close}>
            <ShellIcon.messages /> Message
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type ThemeMode = "light" | "dark" | "system";

function readThemeMode(): ThemeMode {
  const value = document.documentElement.getAttribute("data-theme-mode");
  return value === "light" || value === "dark" ? value : "system";
}

function subscribeThemeMode(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-mode"] });
  return () => observer.disconnect();
}

function chooseThemeMode(next: ThemeMode) {
  document.documentElement.setAttribute("data-theme-mode", next);
  window.dispatchEvent(new Event("signal:theme"));
  void updateUserPreferencesAction({ themeMode: next }).catch(() => {});
}

const THEME_ORDER: readonly ThemeMode[] = ["system", "light", "dark"];
const THEME_NAMES: Record<ThemeMode, string> = { system: "Match system", light: "Light", dark: "Dark" };

/**
 * The theme as one small button: each press moves to the next of Match
 * system, Light and Dark, and the icon shows the one in use. A set-once
 * preference, so it takes an icon's room, not a row.
 */
export function ThemeCycleButton({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribeThemeMode, readThemeMode, () => "system" as ThemeMode);
  const next = THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length]!;
  const Icon = mode === "light" ? ShellIcon.sun : mode === "dark" ? ShellIcon.moon : ShellIcon.monitor;
  const label = `Theme: ${THEME_NAMES[mode]}. Switch to ${THEME_NAMES[next]}`;
  return (
    <button type="button" className={className} onClick={() => chooseThemeMode(next)} aria-label={label} title={label}>
      <Icon />
    </button>
  );
}

/** Light / Dark / System, applied instantly and saved to preferences. */
export function ThemeSwitch() {
  const mode = useSyncExternalStore(subscribeThemeMode, readThemeMode, () => "system" as ThemeMode);

  const choose = (next: ThemeMode) => {
    document.documentElement.setAttribute("data-theme-mode", next);
    window.dispatchEvent(new Event("signal:theme"));
    void updateUserPreferencesAction({ themeMode: next }).catch(() => {});
  };

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <ShellIcon.sun size={14} /> },
    { value: "dark", label: "Dark", icon: <ShellIcon.moon size={14} /> },
    { value: "system", label: "System", icon: <ShellIcon.monitor size={14} /> },
  ];

  return (
    <div className={styles.segmented} role="group" aria-label="Theme">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={mode === option.value}
          onClick={() => choose(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
