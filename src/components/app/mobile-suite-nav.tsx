"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { RailIcon } from "@/components/studio-bar/rail-icons";
import {
  HOME_APP_PATH,
  PRODUCT_APP_PATHS,
  suiteSurfaceFromAppPath,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";

/**
 * Mobile destinations (Signal → Home consolidation, D4): Home first,
 * then the three products. Signal is no longer a tab; the briefing lives
 * inside Home. "Project" left the shell navigation 2026-08-05 with the
 * desktop rail — the active project is reached through the Projects
 * panel and board context, and /app/project stays routable. "More"
 * stays the account cluster in the top bar.
 */
const DESTINATIONS: readonly Readonly<{
  id: "home" | "notes" | "tasks" | "timeline";
  label: string;
  path: string;
}>[] = Object.freeze([
  { id: "home", label: "Home", path: HOME_APP_PATH },
  { id: "notes", label: "Notes", path: PRODUCT_APP_PATHS.notes },
  { id: "tasks", label: "Tasks", path: PRODUCT_APP_PATHS.tasks },
  { id: "timeline", label: "Timeline", path: PRODUCT_APP_PATHS.timeline },
]);

function activeMobileKey(pathname: string): string {
  return suiteSurfaceFromAppPath(pathname);
}

/**
 * Mobile counterpart to the desktop rail.
 *
 * Tasks already owns a task-specific mobile navigation bar, so this compact
 * suite rail appears on Home and the sibling canvases. Tasks remains one
 * tap away and its account menu retains the cross-product escape hatch.
 */
export function MobileSuiteNav() {
  const pathname = usePathname() ?? "";
  const activeKey = activeMobileKey(pathname);
  const suiteContext = useSuiteContext();

  if (activeKey === "tasks") return null;

  return (
    <nav
      aria-label="Signal Studio products"
      /* Marks this as the rail that owns the foot of the mobile viewport, so
         floating chrome (the dev notice) can measure it and sit clear. */
      data-signal-bottom-nav="suite"
      className="z-40 flex flex-none border-t border-white/[0.08] bg-[var(--x-studio-chrome)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {DESTINATIONS.map((destination) => {
        const active = destination.id === activeKey;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={[
              "relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors",
              active
                ? "text-[var(--x-studio-ink-strong)]"
                : "text-[var(--x-studio-ink-quiet)] hover:bg-white/[0.05] hover:text-[var(--x-studio-ink)]",
              "focus-visible:bg-white/[0.07] focus-visible:text-white",
            ].join(" ")}
            href={withSuiteContext(destination.path, suiteContext)}
            key={destination.id}
          >
            <RailIcon name={destination.id} size={18} />
            <span className="text-[10px] font-medium leading-none">
              {destination.label}
            </span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--x-studio-accent)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
