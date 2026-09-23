"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { RailIcon } from "@/components/studio-bar/rail-icons";
import { activeCoreDestination, CORE_DESTINATIONS } from "@/lib/core-navigation";
import { MESSAGES_APP_PATH, PRODUCT_APP_PATHS, STUDIO_URL, suiteSurfaceFromAppPath } from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";

/** The Tasks runtime paints its own bottom bar with the same four destinations. */
export function MobileSuiteNav({ messagesEnabled = false }: { messagesEnabled?: boolean }) {
  const pathname = usePathname() ?? "";
  const activeKey = activeCoreDestination(pathname);
  const suiteContext = useSuiteContext();
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const messagesRoute = pathname === MESSAGES_APP_PATH || pathname.startsWith(`${MESSAGES_APP_PATH}/`);

  useEffect(() => {
    if (!moreOpen) return;
    const frame = window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMoreOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  // Project and shared work routes use the Tasks runtime's bottom bar too.
  if (suiteSurfaceFromAppPath(pathname) === "tasks" && !messagesRoute) return null;

  const notesRoute = pathname === PRODUCT_APP_PATHS.notes || pathname.startsWith(`${PRODUCT_APP_PATHS.notes}/`);
  const moreCurrent = notesRoute || messagesRoute;
  const menuLinks = [
    { label: "Notes", href: withSuiteContext(PRODUCT_APP_PATHS.notes, suiteContext) },
    { label: "Inbox", href: "/app/inbox" },
    ...(messagesEnabled ? [{ label: "Messages", href: MESSAGES_APP_PATH }] : []),
    { label: "Project and team", href: "/app/settings" },
    { label: "Account settings", href: "/settings/profile" },
  ];

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus();
    } else if (event.key === "Tab") {
      setMoreOpen(false);
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label="Signal Studio navigation"
      data-signal-bottom-nav="suite"
      className="relative z-40 flex flex-none border-t border-white/[0.08] bg-[var(--x-studio-chrome)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {moreOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="More"
          className="absolute inset-x-2 bottom-full mb-2 max-h-[70dvh] overflow-y-auto rounded-xl border border-white/[0.12] bg-[var(--x-studio-chrome-raised)] p-1.5 text-[var(--x-studio-ink)] shadow-xl"
          onKeyDown={onMenuKeyDown}
        >
          {menuLinks.map((item) => (
            <Link
              key={item.label}
              role="menuitem"
              aria-current={(item.label === "Notes" && notesRoute) || (item.label === "Messages" && messagesRoute) ? "page" : undefined}
              tabIndex={-1}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-[44px] items-center rounded-lg px-3 text-[13px] hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
            >{item.label}</Link>
          ))}
          <a
            role="menuitem"
            tabIndex={-1}
            href={STUDIO_URL}
            rel="noopener noreferrer"
            target="_blank"
            className="flex min-h-[44px] items-center rounded-lg px-3 text-[13px] hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
          >About Signal Studio ↗</a>
          <a
            role="menuitem"
            tabIndex={-1}
            href="mailto:hello@signalstudio.ie?subject=Signal%20Studio%20help"
            className="flex min-h-[44px] items-center rounded-lg px-3 text-[13px] hover:bg-white/[0.07] focus-visible:bg-white/[0.07]"
          >Contact support</a>
        </div>
      ) : null}
      {CORE_DESTINATIONS.map((destination) => {
        const active = destination.id === activeKey;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors",
              active ? "text-[var(--x-studio-ink-strong)]" : "text-[var(--x-studio-ink-quiet)] hover:bg-white/[0.05] hover:text-[var(--x-studio-ink)]",
              "focus-visible:bg-white/[0.07] focus-visible:text-white",
            ].join(" ")}
            href={withSuiteContext(destination.path, suiteContext)}
            key={destination.id}
          >
            <RailIcon name={destination.id} size={18} />
            <span className="text-[10px] font-medium leading-none">{destination.label}</span>
            {active ? <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--x-studio-accent)]" /> : null}
          </Link>
        );
      })}
      <button
        ref={triggerRef}
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={moreOpen}
        aria-controls={moreOpen ? menuId : undefined}
        data-active={moreCurrent ? "true" : undefined}
        onClick={() => setMoreOpen((open) => !open)}
        className={[
          "relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors",
          moreCurrent || moreOpen ? "text-[var(--x-studio-ink-strong)]" : "text-[var(--x-studio-ink-quiet)] hover:bg-white/[0.05] hover:text-[var(--x-studio-ink)]",
          "focus-visible:bg-white/[0.07] focus-visible:text-white",
        ].join(" ")}
      >
        <RailIcon name="more" size={18} />
        <span className="text-[10px] font-medium leading-none">More</span>
        {moreCurrent ? <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--x-studio-accent)]" /> : null}
      </button>
    </nav>
  );
}
