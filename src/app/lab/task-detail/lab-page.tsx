"use client";

/**
 * LabPage — the client shell for the Phase 3 task-detail lab.
 *
 * Orchestrates three render modes (panel / focus / mobile-sim) by toggling
 * layout rather than mounting three independent component trees.
 * All state is local useState; no server actions are ever called.
 */

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { LAB_TASKS, adjacentTask, taskById } from "@/components/lab/task-detail/lab-fixtures";
import { TaskDetail } from "@/components/lab/task-detail/task-detail";
import { LabBoard } from "@/components/lab/task-detail/lab-board";
import { ResizablePanel } from "@/components/lab/task-detail/resizable-panel";

type LabShell = "panel" | "focus" | "mobile";

const MOBILE_SIM_WIDTH = 390; // iPhone 15 Pro viewport width

export function LabPage() {
  const reduce = useReducedMotion();

  // Active task id
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => LAB_TASKS[0].id);

  // Which shell the reviewer is forcing via the top chrome chips
  const [forcedShell, setForcedShell] = useState<LabShell>("panel");

  // Focus mode toggle
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Board scroll position — preserved across focus/panel transitions
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollLeft = useRef(0);

  const activeTask = activeTaskId ? taskById(activeTaskId) : null;

  // Derived shell: forcedShell=mobile always wins; focus mode takes over when active
  const effectiveShell: LabShell = forcedShell === "mobile"
    ? "mobile"
    : isFocusMode && activeTask
      ? "focus"
      : "panel";

  const openTask = useCallback((id: string) => {
    setActiveTaskId(id);
    setIsFocusMode(false);
    // Save board scroll before panel opens
    if (boardScrollRef.current) {
      savedScrollLeft.current = boardScrollRef.current.scrollLeft;
    }
  }, []);

  const closeTask = useCallback(() => {
    setActiveTaskId(null);
    setIsFocusMode(false);
    // Restore board scroll after close
    requestAnimationFrame(() => {
      if (boardScrollRef.current) {
        boardScrollRef.current.scrollLeft = savedScrollLeft.current;
      }
    });
  }, []);

  const toggleFocus = useCallback(() => {
    if (!activeTask) return;
    setIsFocusMode((v) => !v);
  }, [activeTask]);

  const navigate = useCallback((direction: "prev" | "next") => {
    if (!activeTaskId) return;
    const next = adjacentTask(activeTaskId, direction);
    if (next) setActiveTaskId(next.id);
  }, [activeTaskId]);

  // First task opens by default via the lazy useState initialiser above.

  return (
    <div
      className="flex h-screen w-full flex-col bg-[var(--x-task-canvas)] overflow-hidden"
      style={forcedShell === "mobile" ? { maxWidth: MOBILE_SIM_WIDTH, margin: "0 auto" } : undefined}
    >
      {/* ── Lab chrome ─────────────────────────────────────────────────── */}
      <LabChrome
        shell={forcedShell}
        onShellChange={(s) => {
          setForcedShell(s);
          if (s === "mobile") setIsFocusMode(false);
        }}
        isFocusActive={isFocusMode}
      />

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">

        {/* Focus mode: full-page, board hidden */}
        <AnimatePresence>
          {effectiveShell === "focus" && activeTask ? (
            <motion.div
              key="focus-overlay"
              initial={{ opacity: reduce ? 1 : 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: reduce ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-[90] bg-bg-elevated overflow-hidden flex flex-col"
            >
              <TaskDetail
                task={activeTask}
                shell="focus"
                onClose={closeTask}
                onFocusToggle={toggleFocus}
                onNavigate={navigate}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Board (always mounted, hidden behind focus overlay) */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          ref={boardScrollRef}
          aria-hidden={effectiveShell === "focus" ? "true" : undefined}
        >
          <LabBoard
            tasks={LAB_TASKS}
            activeTaskId={activeTaskId}
            onTaskClick={openTask}
          />
        </div>

        {/* Panel shell (side panel over board).
            Always mounted when forcedShell=panel so AnimatePresence
            inside ResizablePanel can play the exit slide. */}
        {forcedShell === "panel" ? (
          <ResizablePanel open={!!activeTask && !isFocusMode} onClose={closeTask}>
            {activeTask ? (
              <TaskDetail
                task={activeTask}
                shell="panel"
                onClose={closeTask}
                onFocusToggle={toggleFocus}
                onNavigate={navigate}
              />
            ) : null}
          </ResizablePanel>
        ) : null}

        {/* Mobile sim shell: full-screen within the constrained width */}
        {effectiveShell === "mobile" && activeTask ? (
          <div className="absolute inset-0 z-[81] bg-bg-elevated flex flex-col overflow-hidden">
            <TaskDetail
              task={activeTask}
              shell="mobile"
              onClose={closeTask}
              onFocusToggle={toggleFocus}
              onNavigate={navigate}
            />
          </div>
        ) : null}

        {/* Empty state (no task selected) */}
        {!activeTask && effectiveShell !== "mobile" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[13px] text-ink-quiet">Click any task card to open the detail panel</div>
              <div className="mt-1 text-[11.5px] text-ink-faint">j/k to navigate · e for focus mode · Esc to close</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lab chrome
// ─────────────────────────────────────────────────────────────────────────────

function LabChrome({
  shell,
  onShellChange,
  isFocusActive,
}: {
  shell: LabShell;
  onShellChange: (s: LabShell) => void;
  isFocusActive: boolean;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-line-soft bg-bg-elevated px-5 py-2.5"
      style={{ minHeight: 44 }}
    >
      {/* Wordmark label */}
      <div className="flex items-center gap-2.5">
        {/* Signal dot */}
        <span
          className="block h-[7px] w-[7px] rounded-full"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        <span className="text-[13px] font-semibold tracking-[-0.018em] text-ink">
          Task detail
        </span>
        <span className="text-[12px] text-ink-quiet">·</span>
        <span className="rounded-md bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium tracking-[0.04em] uppercase text-[var(--accent)]">
          lab
        </span>
        {isFocusActive ? (
          <span className="rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10px] text-ink-quiet">
            focus mode active
          </span>
        ) : null}
      </div>

      {/* Shell toggle chips + comparison link */}
      <div className="flex items-center gap-3">
        <div
          className="flex rounded-md border border-line-soft bg-bg-sunken/40 p-0.5 text-[11px]"
          role="group"
          aria-label="Shell view"
        >
          {([
            { id: "panel", label: "Panel" },
            { id: "focus", label: "Focus" },
            { id: "mobile", label: "Mobile" },
          ] as Array<{ id: LabShell; label: string }>).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onShellChange(id)}
              aria-pressed={shell === id}
              className={[
                "rounded px-2.5 py-1 font-medium capitalize transition-colors",
                shell === id
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-quiet hover:text-ink-soft",
              ].join(" ")}
            >
              {label}
              {id === "mobile" ? (
                <span className="ml-1 text-[9px] text-ink-faint">(390px)</span>
              ) : null}
            </button>
          ))}
        </div>

        <span className="hidden items-center gap-1.5 text-[11px] text-ink-quiet sm:flex">
          Compare with{" "}
          <a
            href="/app/tasks"
            className="font-medium text-[var(--accent)] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            /app/tasks
          </a>
        </span>
      </div>
    </div>
  );
}
