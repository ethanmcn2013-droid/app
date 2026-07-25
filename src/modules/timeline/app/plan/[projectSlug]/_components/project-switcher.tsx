"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildTimelineProjectHref,
  type ProjectSwitcherOption,
  type TimelineQueryContext,
} from "@/modules/timeline/lib/project-switcher-model";

type ProjectSwitcherProps = Readonly<{
  currentProject: ProjectSwitcherOption;
  projects: readonly ProjectSwitcherOption[];
  context: TimelineQueryContext;
}>;

export function ProjectSwitcher({
  currentProject,
  projects,
  context,
}: ProjectSwitcherProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const currentIndex = Math.max(
    1,
    projects.findIndex((project) => project.slug === currentProject.slug) + 1,
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const allProjectsHref = buildTimelineProjectHref(null, context);

  if (projects.length <= 1) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2">
        <span className="font-medium text-ink" aria-current="page">
          {currentProject.name}
        </span>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <Link
          href={allProjectsHref}
          className="inline-flex min-h-11 items-center text-ink-soft underline decoration-line-soft underline-offset-4 transition-colors hover:text-ink"
        >
          All projects
        </Link>
      </span>
    );
  }

  const options: Array<ProjectSwitcherOption | null> = [null, ...projects];

  function openMenu(index = currentIndex) {
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    const href = buildTimelineProjectHref(option?.slug ?? null, context);
    setOpen(false);
    router.push(href);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? 0 : currentIndex);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (index) => (index + direction + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={handleBlur}
      data-project-switcher
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current project: ${currentProject.name}. Switch project.`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex min-h-11 max-w-[min(72vw,360px)] items-center gap-2 rounded-lg border border-line-soft bg-white px-3 text-left text-[13px] font-medium text-ink shadow-sm transition-colors hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <span className="truncate">{currentProject.name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Timeline projects"
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 z-40 mt-2 max-h-[min(360px,60vh)] min-w-[min(320px,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-line-soft bg-white p-1.5 shadow-[0_18px_50px_-22px_rgba(20,21,26,0.45)]"
        >
          {options.map((option, index) => {
            const isCurrent = option?.slug === currentProject.slug;
            const href = buildTimelineProjectHref(option?.slug ?? null, context);
            return (
              <Link
                key={option?.slug ?? "all-projects"}
                href={href}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="menuitem"
                aria-current={isCurrent ? "page" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-full items-center justify-between gap-5 rounded-lg px-3 text-left text-[13px] text-ink-soft outline-none transition-colors hover:bg-bg-sunken focus:bg-bg-sunken focus:text-ink"
              >
                <span className="truncate">
                  {option?.name ?? "All projects"}
                </span>
                {isCurrent ? (
                  <span
                    aria-label="Current project"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
