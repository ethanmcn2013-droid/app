"use client";

/**
 * The frame for the integrated demo: one sidebar, one top bar and one search
 * around every chosen design, so the surfaces read as a single product.
 * Mirrors the app shell's look (src/components/shell) without its data.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { useModKeys } from "../tasks/keys";
import { JumpMenu } from "./jump";
import { DemoLinksProvider, surfaceHref, type Surface } from "./links";
import { Icon, NAV_ALL, SECTIONS, TITLES, type NavItem } from "./nav";
import { PEOPLE, VIEWER, WORKSPACE } from "./world";
import { projectIn } from "./store";
import { useDemoStore } from "./store/client";
import styles from "./demo.module.css";

type Mode = "system" | "light" | "dark";

const SUB_LABEL: Record<string, string> = {
  ledger: "List",
  covers: "Covers",
  "all-projects": "All projects",
  replay: "Replay",
};

const MODES: readonly { value: Mode; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function readMode(): Mode {
  try {
    const saved = localStorage.getItem("signal:demo:theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  return "system";
}

function applyMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme-mode");
  else root.setAttribute("data-theme-mode", mode);
  try {
    localStorage.setItem("signal:demo:theme", mode);
  } catch {}
  window.dispatchEvent(new Event("signal:theme"));
  window.dispatchEvent(new Event("signal:demo-theme"));
}

const subscribeMode = (onChange: () => void) => {
  window.addEventListener("signal:demo-theme", onChange);
  return () => window.removeEventListener("signal:demo-theme", onChange);
};

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

const me = PEOPLE.find((person) => person.id === VIEWER)!;

function Mark() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="6" fill="var(--v3-brand-ground)" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="var(--v3-brand-signal)" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="2.2" fill="var(--v3-brand-signal)" />
    </svg>
  );
}

export function DemoShell({ surface, sub, children }: { surface?: Surface; sub?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { mod } = useModKeys();
  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [jump, setJump] = useState(false);
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "system" as Mode);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  // Put back the theme this viewer picked last time, and resolve it here as
  // well: on a client-rendered page (the not-found page) the app's inline
  // theme script never runs, so the frame keeps data-theme in step itself.
  useEffect(() => {
    const saved = readMode();
    if (saved !== "system") applyMode(saved);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const chosen = readMode();
      const theme = chosen === "dark" || (chosen === "system" && media.matches) ? "dark" : "light";
      if (document.documentElement.getAttribute("data-theme") !== theme) document.documentElement.setAttribute("data-theme", theme);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("signal:demo-theme", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("signal:demo-theme", sync);
    };
  }, []);

  const returnFocus = useRef(false);
  const closeDrawer = useCallback(() => {
    returnFocus.current = true;
    setOpenOn(null);
  }, []);

  // The phone drawer is modal: focus moves in, Escape closes, and focus goes
  // back to the menu button once the page behind is no longer inert.
  useEffect(() => {
    if (!open) {
      if (returnFocus.current) menuButton.current?.focus();
      returnFocus.current = false;
      return;
    }
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDrawer]);

  // The frame owns G-then-a-letter and Ctrl/⌘ K. It listens in the capture
  // phase so a page's own single-key shortcuts never see those keys first.
  useEffect(() => {
    let armed = 0;
    const disarm = () => {
      window.clearTimeout(armed);
      armed = 0;
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setJump((value) => !value);
        return;
      }
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        disarm();
        return;
      }
      const key = event.key.toLowerCase();
      if (!armed && key === "g") {
        event.preventDefault();
        event.stopImmediatePropagation();
        armed = window.setTimeout(() => (armed = 0), 1000);
        return;
      }
      if (armed) {
        disarm();
        const hit = NAV_ALL.find((item) => item.key.toLowerCase() === key);
        // Swallow the second key either way, so a missed chord never lands on the page.
        event.preventDefault();
        event.stopImmediatePropagation();
        if (hit) router.push(surfaceHref(true, hit.surface));
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.clearTimeout(armed);
    };
  }, [router]);

  // "/" and N work on every page. A page that has its own search or its own
  // "new" claims the key (preventDefault, or by moving focus into a field);
  // anywhere else "/" opens search and N starts a new task.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key !== "/" && key !== "n") return;
      if (event.defaultPrevented) return;
      const before = document.activeElement;
      window.setTimeout(() => {
        const now = document.activeElement;
        if (event.defaultPrevented || (now !== before && isTyping(now))) return;
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        if (key === "/") setJump(true);
        else if (surface === "home" || surface === "overview" || surface === "files" || surface === "analytics") router.push(surfaceHref(true, "tasks/board", undefined, { new: "1" }));
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, surface]);

  const heading = surface ? TITLES[surface] : { title: "Not found" };
  // A project's home names the project; other sub-views name the view.
  const openProject = useDemoStore((state) => (surface === "projects" && sub ? projectIn(state, sub) : undefined));
  const subLabel = openProject ? openProject.name : sub ? SUB_LABEL[sub] : undefined;

  const onThemeKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const at = MODES.findIndex((m) => m.value === mode);
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = MODES[(at + step + MODES.length) % MODES.length];
    applyMode(next.value);
    event.currentTarget.querySelector<HTMLElement>(`[data-mode="${next.value}"]`)?.focus();
  };

  const navLink = (item: NavItem) => {
    const current = item.surface === surface;
    return (
      <Link key={item.surface} href={surfaceHref(true, item.surface)} className={styles.item} aria-current={current ? "page" : undefined} prefetch={false}>
        {item.icon}
        <span className={styles.itemLabel}>{item.label}</span>
        <kbd className={styles.hint} aria-hidden="true">
          G {item.key}
        </kbd>
      </Link>
    );
  };

  return (
    <DemoLinksProvider>
      <div className={styles.shell} data-open={open || undefined}>
        <a href="#demo-main" className={styles.skip}>
          Skip to content
        </a>
        <aside ref={drawer} className={styles.sidebar} aria-label="Signal Studio" aria-modal={open || undefined} role={open ? "dialog" : undefined}>
          <div className={styles.brandRow}>
            <Link href={surfaceHref(true, "home")} className={styles.brand} prefetch={false}>
              <Mark />
              <span className={styles.brandName}>Signal Studio</span>
            </Link>
          </div>

          <button type="button" className={styles.jump} onClick={() => setJump(true)}>
            <Icon>
              <circle cx="7" cy="7" r="4.25" />
              <path d="M10.2 10.2L13.5 13.5" />
            </Icon>
            <span>Search or ask</span>
            <kbd className={styles.kbd}>{mod} K</kbd>
          </button>

          <div className={styles.workspace}>
            <span className={styles.workspaceTile} aria-hidden="true">
              O
            </span>
            <span className={styles.workspaceName}>{WORKSPACE.name}</span>
            <span className={styles.workspaceMeta}>Kinsale</span>
          </div>

          <nav className={styles.scroll} aria-label="Products">
            {SECTIONS.map((section) => (
              <div key={section.id} className={styles.section} role="group" aria-labelledby={`nav-section-${section.id}`}>
                <div
                  id={`nav-section-${section.id}`}
                  className={styles.label}
                  data-active={section.items.some((item) => item.surface === surface) || undefined}
                >
                  {section.label}
                </div>
                {section.items.map(navLink)}
              </div>
            ))}
          </nav>

          <div className={styles.footer}>
            <div className={styles.theme} role="radiogroup" aria-label="Theme" onKeyDown={onThemeKey}>
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  data-mode={m.value}
                  aria-checked={mode === m.value}
                  tabIndex={mode === m.value ? 0 : -1}
                  className={styles.themeOption}
                  onClick={() => applyMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className={styles.account}>
              <span className={styles.avatar} style={{ background: `var(--v3-project-${me.hue})` }} aria-hidden="true">
                {me.initials}
              </span>
              <span className={styles.accountText}>
                <span className={styles.accountName}>{me.name}</span>
                <span className={styles.accountRole}>{me.role}</span>
              </span>
            </div>
          </div>
        </aside>

        <button type="button" className={styles.scrim} aria-label="Close the menu" tabIndex={-1} onClick={closeDrawer} />

        <div className={styles.main} inert={open || undefined}>
          <header className={styles.top}>
            <button
              ref={menuButton}
              type="button"
              className={styles.menuButton}
              aria-label="Open the menu"
              aria-expanded={open}
              onClick={() => setOpenOn(pathname)}
            >
              <Icon>
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
              </Icon>
            </button>
            <nav className={styles.crumbs} aria-label="You are here">
              <span className={styles.crumbRoot}>{WORKSPACE.short}</span>
              {heading.group ? (
                <>
                  <span className={styles.sep} aria-hidden="true">
                    /
                  </span>
                  <span>{heading.group}</span>
                </>
              ) : null}
              <span className={styles.sep} aria-hidden="true">
                /
              </span>
              <span className={styles.crumbCurrent} aria-current="page">
                {heading.title}
                {subLabel ? ` · ${subLabel}` : ""}
              </span>
            </nav>
            <div className={styles.topSpacer} />
            <button type="button" className={styles.topJump} onClick={() => setJump(true)} aria-label="Search or ask">
              <Icon>
                <circle cx="7" cy="7" r="4.25" />
                <path d="M10.2 10.2L13.5 13.5" />
              </Icon>
            </button>
          </header>
          <main id="demo-main" tabIndex={-1} className={styles.content} data-demo-content="">
            {children}
          </main>
        </div>

        {jump ? <JumpMenu current={surface} onClose={() => setJump(false)} /> : null}
      </div>
    </DemoLinksProvider>
  );
}
