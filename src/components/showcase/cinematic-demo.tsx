"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, LayoutGroup, AnimatePresence, useReducedMotion } from "motion/react";
import { EASE_OUT_EXPO, MOTION_BASE, MOTION_MODERATE } from "@/lib/motion";
import { LANES, SEED_TASKS, USERS, type Task, type UserId } from "@/lib/data";
import {
  DOMAINS,
  buildDomainSeed,
  shorten,
  type DomainId,
} from "@/lib/domains";
import { TaskCard } from "./task-card";
import { DemoSurface } from "./demo-surface";
import { CursorsLayer } from "./cursors-layer";
import { GhostCard } from "./ghost-card";
import { ActivityFeed } from "./activity-feed";
import { AiNudge } from "./ai-nudge";
import { Sparkline } from "./sparkline";
import { Celebration } from "./celebration";
import { Avatar } from "./avatar";
import type { DemoState, ViewMode } from "./types";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const initialCursor = (x: number, y: number) => ({
  x,
  y,
  visible: false,
  grabbing: false,
  reading: false,
  justArrived: false,
});

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

export function CinematicDemo({
  domain = "wedding",
}: {
  domain?: DomainId;
} = {}) {
  const pack = DOMAINS[domain];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const pausedRef = useRef(false);
  const aliveRef = useRef(true);
  const currentStateRef = useRef<DemoState | null>(null);

  const [state, setState] = useState<DemoState>(() => ({
    view: "board",
    tasks: buildDomainSeed(domain, SEED_TASKS),
    // commentBodies[1] (not [0]) so the static teammate note differs
    // from the line the scripted scene types live (demoCommentText),
    // and falls back to [0] for any pack with a single body.
    staticComment: pack.commentBodies[1] ?? pack.commentBodies[0],
    cursors: {
      chloe: initialCursor(140, 60),
      david: initialCursor(360, 60),
      alex: initialCursor(620, 60),
      ada: initialCursor(0, 0),
      marcus: initialCursor(0, 0),
    },
    pickedTaskId: null,
    pickedBy: null,
    ghostX: 0,
    ghostY: 0,
    openCommentTaskId: null,
    typingFromUser: null,
    typingProgress: 0,
    postedComment: null,
    reactions: [],
    activity: [],
    nudgeOpen: false,
    nudgeTask: null,
    nudgeStage: "idle",
    burndown: [12, 11, 11, 10, 10, 9, 9, 8],
    dependencyHighlight: null,
    completedFlash: null,
    scene: "boot",
    filterByAssignee: null,
  }));

  const [celebration, setCelebration] = useState<{
    visible: boolean;
    origin: { x: number; y: number } | null;
  }>({ visible: false, origin: null });

  useEffect(() => setMounted(true), []);

  // --- Helpers operating on state ---

  const getRect = useCallback((taskId: string) => {
    const el = cardRefs.current.get(taskId);
    if (!el || !surfaceRef.current) return null;
    const r = el.getBoundingClientRect();
    const s = surfaceRef.current.getBoundingClientRect();
    return {
      left: r.left - s.left,
      top: r.top - s.top,
      width: r.width,
      height: r.height,
    };
  }, []);

  const moveCursor = useCallback(
    (
      user: UserId,
      x: number,
      y: number,
      opts?: Partial<DemoState["cursors"][UserId]>,
    ) => {
      setState((s) => ({
        ...s,
        cursors: {
          ...s.cursors,
          [user]: {
            ...s.cursors[user],
            x,
            y,
            visible: true,
            ...opts,
          },
        },
      }));
    },
    [],
  );

  const setCursorState = useCallback(
    (user: UserId, opts: Partial<DemoState["cursors"][UserId]>) => {
      setState((s) => ({
        ...s,
        cursors: {
          ...s.cursors,
          [user]: { ...s.cursors[user], ...opts },
        },
      }));
    },
    [],
  );

  const moveCursorToCard = useCallback(
    async (
      user: UserId,
      taskId: string,
      anchor: "center" | "right" = "center",
    ) => {
      const r = getRect(taskId);
      if (!r) return;
      const x =
        anchor === "right" ? r.left + r.width - 32 : r.left + r.width / 2 - 8;
      const y = r.top + r.height / 2 - 8;
      moveCursor(user, x, y, { visible: true });
      await wait(720);
    },
    [getRect, moveCursor],
  );

  const pushActivity = useCallback(
    (user: UserId, verb: string, target: string) => {
      setState((s) => ({
        ...s,
        activity: [
          ...s.activity,
          { id: makeId(), user, verb, target },
        ].slice(-8),
      }));
    },
    [],
  );

  const pickUp = useCallback(
    (user: UserId, taskId: string) => {
      const r = getRect(taskId);
      setState((s) => ({
        ...s,
        pickedTaskId: taskId,
        pickedBy: user,
        ghostX: r?.left ?? 0,
        ghostY: r?.top ?? 0,
        cursors: {
          ...s.cursors,
          [user]: { ...s.cursors[user], grabbing: true },
        },
      }));
    },
    [getRect],
  );

  const moveGhostTo = useCallback(
    async (user: UserId, x: number, y: number) => {
      setState((s) => ({
        ...s,
        ghostX: x,
        ghostY: y,
        cursors: {
          ...s.cursors,
          [user]: { ...s.cursors[user], x: x + 110, y: y + 18 },
        },
      }));
      await wait(800);
    },
    [],
  );

  const drop = useCallback(
    (user: UserId, targetLane: Task["lane"]) => {
      setState((s) => {
        const taskId = s.pickedTaskId;
        if (!taskId) return s;
        const updatedTasks = s.tasks.map((t) =>
          t.id === taskId ? { ...t, lane: targetLane, idleDays: undefined } : t,
        );
        return {
          ...s,
          tasks: updatedTasks,
          pickedTaskId: null,
          pickedBy: null,
          cursors: {
            ...s.cursors,
            [user]: { ...s.cursors[user], grabbing: false },
          },
        };
      });
    },
    [],
  );

  const triggerCelebration = useCallback(
    (x: number, y: number) => {
      setCelebration({ visible: true, origin: { x, y } });
      setTimeout(() => {
        setCelebration({ visible: false, origin: null });
      }, 1600);
    },
    [],
  );

  // --- Scene runner ---

  useEffect(() => {
    // Under prefers-reduced-motion the demo renders a static representative
    // frame (all 4 lanes visible, tasks in place) — no frozen mid-animation,
    // no timing loops. The scene runner only starts for users who have not
    // opted out of motion.
    if (!mounted || prefersReducedMotion) return;
    aliveRef.current = true;
    pausedRef.current = paused;

    const waitWhilePaused = async () => {
      while (pausedRef.current && aliveRef.current) await wait(120);
    };

    const run = async () => {
      // Initial settle — cursors arrive with their labels visible
      // (justArrived) for ~900ms so the eye reads who's here, then
      // the labels fade and we're at rest.
      await wait(700);
      setState((s) => ({
        ...s,
        cursors: {
          ...s.cursors,
          chloe: {
            ...s.cursors.chloe,
            visible: true,
            label: "Chloe",
            justArrived: true,
          },
          david: {
            ...s.cursors.david,
            visible: true,
            label: "David",
            justArrived: true,
          },
          alex: {
            ...s.cursors.alex,
            visible: true,
            label: "Alex",
            justArrived: true,
          },
        },
      }));
      await wait(900);
      setState((s) => ({
        ...s,
        cursors: {
          ...s.cursors,
          chloe: { ...s.cursors.chloe, justArrived: false },
          david: { ...s.cursors.david, justArrived: false },
          alex: { ...s.cursors.alex, justArrived: false },
        },
      }));

      while (aliveRef.current) {
        await waitWhilePaused();

        // ────── Scene A: Carry & celebrate ──────
        await sceneCarry();
        if (!aliveRef.current) return;
        await sceneSettle();
        if (!aliveRef.current) return;
        await waitWhilePaused();

        // ────── Scene B: Inline comment thread ──────
        await sceneComment();
        if (!aliveRef.current) return;
        await sceneSettle();
        if (!aliveRef.current) return;
        await waitWhilePaused();

        // ────── Scene C: View morph (board → list → timeline → board) ──────
        await sceneViewMorph();
        if (!aliveRef.current) return;
        await sceneSettle();
        if (!aliveRef.current) return;
        await waitWhilePaused();

        // ────── Scene D: stuck-work prompt ──────
        await sceneNudge();
        if (!aliveRef.current) return;
        await sceneSettle();
        if (!aliveRef.current) return;
        await waitWhilePaused();

        // ────── Scene E: Dependency reveal ──────
        await sceneDependency();
        if (!aliveRef.current) return;
        await sceneSettle(2000);
        if (!aliveRef.current) return;
        await waitWhilePaused();
      }
    };

    /**
     * The room breathes. Sets `scene: "settle"` and gently drifts each
     * cursor toward a nearby random point so the demo reads alive
     * rather than dead. No state mutations to tasks, overlays, or
     * activity feed — those keep their last value visible.
     */
    const sceneSettle = async (durationMs = 1600) => {
      setState((s) => ({ ...s, scene: "settle" }));
      const startedAt = Date.now();
      const driftEvery = 700;
      while (Date.now() - startedAt < durationMs && aliveRef.current) {
        // Drift each visible cursor to a small offset relative to its
        // current position. Spring physics handle the easing.
        setState((s) => {
          const next = { ...s.cursors };
          (Object.keys(next) as UserId[]).forEach((id) => {
            const c = next[id];
            if (!c.visible) return;
            next[id] = {
              ...c,
              x: c.x + (Math.random() - 0.5) * 60,
              y: c.y + (Math.random() - 0.5) * 32,
            };
          });
          return { ...s, cursors: next };
        });
        await wait(Math.min(driftEvery, durationMs - (Date.now() - startedAt)));
      }
    };

    const sceneCarry = async () => {
      // Guard: carry mutates board state; if we ever schedule it
      // outside board mode, bail clean rather than tearing the morph.
      if (currentStateRef.current && currentStateRef.current.view !== "board")
        return;
      setState((s) => ({ ...s, scene: "carry" }));

      // Pick the first todo card and have David carry it to Doing
      const targetId = "t-101";
      const dest: Task["lane"] = "doing";

      // David moves to the card
      await moveCursorToCard("david", targetId);

      // Pick up
      pickUp("david", targetId);
      await wait(220);

      // Glide to the doing column area
      const doingCol = document.querySelector(
        `[data-lane="doing"]`,
      ) as HTMLElement | null;
      if (doingCol && surfaceRef.current) {
        const cr = doingCol.getBoundingClientRect();
        const sr = surfaceRef.current.getBoundingClientRect();
        const x = cr.left - sr.left + 18;
        const y = cr.top - sr.top + 56;
        await moveGhostTo("david", x, y);
      } else {
        await wait(700);
      }

      drop("david", dest);
      {
        const t = currentStateRef.current?.tasks.find((x) => x.id === "t-101");
        pushActivity("david", "moved to In progress", shorten(t?.title ?? "this task"));
      }
      await wait(900);

      // Move another (alex pushes a review item to done with celebration)
      const reviewToDone = "t-303";
      await moveCursorToCard("alex", reviewToDone);
      pickUp("alex", reviewToDone);
      await wait(200);

      const doneCol = document.querySelector(
        `[data-lane="done"]`,
      ) as HTMLElement | null;
      if (doneCol && surfaceRef.current) {
        const cr = doneCol.getBoundingClientRect();
        const sr = surfaceRef.current.getBoundingClientRect();
        const x = cr.left - sr.left + 18;
        const y = cr.top - sr.top + 56;
        await moveGhostTo("alex", x, y);
        drop("alex", "done");

        // Celebration burst at column header
        const headerEl = doneCol.querySelector("[data-lane-header]");
        if (headerEl) {
          const hr = headerEl.getBoundingClientRect();
          triggerCelebration(hr.left - sr.left + 60, hr.top - sr.top + 18);
        }
        {
          const t = currentStateRef.current?.tasks.find((x) => x.id === "t-303");
          pushActivity("alex", "completed", shorten(t?.title ?? "this task"));
        }
        // Tick burndown
        setState((s) => ({
          ...s,
          burndown: [...s.burndown.slice(1), s.burndown[s.burndown.length - 1] - 1],
        }));
      } else {
        drop("alex", "done");
      }

      await wait(1500);
    };

    const sceneComment = async () => {
      setState((s) => ({ ...s, scene: "comment", openCommentTaskId: null }));
      const taskId = "t-202";

      // Chloe glides to the card and opens the thread
      await moveCursorToCard("chloe", taskId);

      setState((s) => ({
        ...s,
        openCommentTaskId: taskId,
        cursors: {
          ...s.cursors,
          chloe: { ...s.cursors.chloe, reading: true },
        },
      }));
      await wait(900);

      // Show typing
      setState((s) => ({
        ...s,
        typingFromUser: "chloe",
        typingProgress: 0,
        postedComment: null,
      }));

      const text = pack.demoCommentText;
      for (let i = 1; i <= text.length; i += 2) {
        await wait(40);
        setState((s) => ({
          ...s,
          typingProgress: i / text.length,
        }));
      }
      await wait(160);

      setState((s) => ({
        ...s,
        typingFromUser: null,
        postedComment: { user: "chloe", text },
        cursors: {
          ...s.cursors,
          chloe: { ...s.cursors.chloe, reading: false },
        },
      }));
      {
        const t = currentStateRef.current?.tasks.find((x) => x.id === "t-202");
        pushActivity("chloe", "commented on", shorten(t?.title ?? "this task"));
      }
      await wait(1500);

      setState((s) => ({
        ...s,
        openCommentTaskId: null,
        postedComment: null,
      }));
      await wait(700);
    };

    const sceneViewMorph = async () => {
      // Defensive guard: never trigger a morph while a card is in-flight
      // (ghost-card lives outside the LayoutGroup and would desync).
      if (currentStateRef.current?.pickedTaskId) return;
      setState((s) => ({ ...s, scene: "morph" }));

      // Float Alex's cursor up to the view switcher tabs
      const switchEl = document.querySelector('[data-tab="list"]') as HTMLElement | null;
      if (switchEl && surfaceRef.current) {
        const sr = surfaceRef.current.getBoundingClientRect();
        const tr = switchEl.getBoundingClientRect();
        moveCursor("alex", tr.left - sr.left + 24, tr.top - sr.top + 12, {
          grabbing: false,
          reading: false,
        });
      }
      await wait(700);

      setState((s) => ({ ...s, view: "list" }));
      pushActivity("alex", "switched to", "List view");
      await wait(2200);

      const tlEl = document.querySelector('[data-tab="timeline"]') as HTMLElement | null;
      if (tlEl && surfaceRef.current) {
        const sr = surfaceRef.current.getBoundingClientRect();
        const tr = tlEl.getBoundingClientRect();
        moveCursor("alex", tr.left - sr.left + 24, tr.top - sr.top + 12);
      }
      await wait(700);
      setState((s) => ({ ...s, view: "timeline" }));
      pushActivity("alex", "switched to", "Timeline view");
      await wait(2400);

      const bdEl = document.querySelector('[data-tab="board"]') as HTMLElement | null;
      if (bdEl && surfaceRef.current) {
        const sr = surfaceRef.current.getBoundingClientRect();
        const tr = bdEl.getBoundingClientRect();
        moveCursor("alex", tr.left - sr.left + 24, tr.top - sr.top + 12);
      }
      await wait(700);
      setState((s) => ({ ...s, view: "board" }));
      await wait(800);
    };

    const sceneNudge = async () => {
      const t202 = currentStateRef.current?.tasks.find((x) => x.id === "t-202");
      setState((s) => ({
        ...s,
        scene: "nudge",
        nudgeOpen: true,
        nudgeTask: shorten(t202?.title ?? "this task", 28),
        nudgeStage: "open",
      }));
      await wait(2200);

      // Chloe clicks Send
      // Move chloe's cursor toward the nudge button area (center top of demo)
      if (surfaceRef.current) {
        const sr = surfaceRef.current.getBoundingClientRect();
        moveCursor(
          "chloe",
          sr.width / 2 - 30,
          sr.height * 0.18 + 56,
          { grabbing: false, reading: false },
        );
      }
      await wait(700);
      setCursorState("chloe", { grabbing: true });
      setState((s) => ({ ...s, nudgeStage: "sending" }));
      await wait(900);
      setState((s) => ({ ...s, nudgeStage: "sent" }));
      setCursorState("chloe", { grabbing: false });
      pushActivity(
        "chloe",
        "nudged",
        `David on ${shorten(t202?.title ?? "this task")}`,
      );
      await wait(1100);
      setState((s) => ({
        ...s,
        nudgeOpen: false,
        nudgeStage: "idle",
        nudgeTask: null,
      }));
      await wait(500);
    };

    const sceneDependency = async () => {
      setState((s) => ({
        ...s,
        scene: "dependency",
        dependencyHighlight: ["t-201", "t-202"],
      }));

      // Quick glide of david's cursor between the two cards
      await moveCursorToCard("david", "t-201", "right");
      await wait(450);
      await moveCursorToCard("david", "t-202", "right");
      await wait(900);

      setState((s) => ({ ...s, dependencyHighlight: null }));
      {
        const t201 = currentStateRef.current?.tasks.find((x) => x.id === "t-201");
        const t202 = currentStateRef.current?.tasks.find((x) => x.id === "t-202");
        pushActivity(
          "david",
          "linked dependency",
          `${shorten(t201?.title ?? "task", 14)} → ${shorten(t202?.title ?? "task", 14)}`,
        );
      }
      await wait(700);
    };

    run();

    return () => {
      aliveRef.current = false;
    };
  }, [
    mounted,
    paused,
    moveCursor,
    moveCursorToCard,
    pickUp,
    drop,
    moveGhostTo,
    pushActivity,
    setCursorState,
    triggerCelebration,
  ]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Mirror state into a ref so scene functions (running outside React's
  // render path inside the run() async loop) can read fresh values
  // without becoming stale closures.
  useEffect(() => {
    currentStateRef.current = state;
  }, [state]);

  // Hover parallax (subtle depth shift on mouse position)
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setParallax({ x: px * 8, y: py * 6 });
  };

  const pickedTask = useMemo(
    () =>
      state.pickedTaskId
        ? state.tasks.find((t) => t.id === state.pickedTaskId) ?? null
        : null,
    [state.pickedTaskId, state.tasks],
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseMove={handleMouseMove}
    >
      {/* Floating depth shadow */}
      <div
        className="pointer-events-none absolute inset-x-10 -bottom-8 h-24 rounded-[40px] opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(20,21,26,0.22), transparent 65%)",
        }}
      />
      <motion.div
        className="relative z-10 overflow-hidden rounded-[20px] border border-line bg-bg-elevated"
        style={{
          boxShadow:
            "0 60px 120px -40px rgba(20,21,26,0.32), 0 18px 40px -16px rgba(20,21,26,0.18), 0 0 0 1px rgba(20,21,26,0.04)",
          transform: `perspective(1600px) rotateX(${parallax.y * -0.18}deg) rotateY(${parallax.x * 0.18}deg)`,
          transformStyle: "preserve-3d",
        }}
        transition={{ type: "spring", stiffness: 80, damping: 18 }}
      >
        {/* Top chrome */}
        <div className="flex items-center justify-between border-b border-line-soft bg-bg-elevated px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="block h-2.5 w-2.5 rounded-full bg-[#fc615b]" />
              <span className="block h-2.5 w-2.5 rounded-full bg-[#fcc12c]" />
              <span className="block h-2.5 w-2.5 rounded-full bg-[#34c84a]" />
            </div>
            <div className="ml-3 flex items-center gap-1.5 rounded-md bg-bg-sunken px-2 py-0.5 text-[11px] text-ink-quiet">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {pack.workspaceUrl}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PresenceStrip />
            <button type="button" aria-hidden="true" tabIndex={-1} className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-bg-sunken">
              Share
            </button>
          </div>
        </div>

        {/* Sub header: title + view tabs */}
        <div className="flex items-end justify-between border-b border-line-soft px-5 pb-2 pt-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-ink-quiet">
              <span>Workspace</span>
              <span>›</span>
              <motion.span
                key={pack.workspaceCrumb}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION_BASE, ease: EASE_OUT_EXPO }}
              >
                {pack.workspaceCrumb}
              </motion.span>
            </div>
            <motion.h3
              key={pack.workspaceTitle}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: MOTION_MODERATE, ease: EASE_OUT_EXPO }}
              className="mt-1 text-[19px] font-semibold tracking-tight"
            >
              {pack.workspaceTitle}
            </motion.h3>
          </div>
          <ViewTabs view={state.view} />
        </div>

        {/* Surface */}
        <div
          ref={surfaceRef}
          className="relative h-[500px] overflow-hidden bg-gradient-to-b from-white to-bg-sunken/40"
        >
          <LayoutGroup>
            <DemoSurface state={state} cardRefs={cardRefs} />
          </LayoutGroup>

          {/* Sparkline open-work overlay */}
          <div className="pointer-events-none absolute right-5 top-3 z-[40] flex items-center gap-2 rounded-lg border border-line-soft bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-quiet">
              Open work
            </div>
            <Sparkline values={state.burndown} />
          </div>

          <CursorsLayer cursors={state.cursors} />

          <GhostCard
            task={pickedTask}
            user={state.pickedBy}
            x={state.ghostX}
            y={state.ghostY}
            visible={!!state.pickedTaskId}
          />

          <AiNudge
            open={state.nudgeOpen}
            stage={state.nudgeStage}
            taskTitle={state.nudgeTask ?? ""}
            user="David"
          />

          <Celebration
            visible={celebration.visible}
            origin={celebration.origin}
          />

          <ActivityFeed items={state.activity} />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-line-soft bg-white px-4 py-1.5 text-[10.5px] text-ink-quiet">
          <span className="flex items-center gap-1.5">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Demo
          </span>
          <span aria-hidden data-debug-scene={state.scene} />
        </div>
      </motion.div>

      {/* Bottom controls: pause / restart — hidden under prefers-reduced-motion
          because the scene runner is also gated off; the control would be a
          ghost that does nothing for those users. */}
      {!prefersReducedMotion && (
        <div className="mt-4 flex items-center justify-center gap-3 text-[12px] text-ink-quiet">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 transition-colors hover:bg-bg-sunken"
          >
            {paused ? (
              <>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </>
            )}
          </button>
          <span className="text-ink-soft">A self-running demo. Interact any time.</span>
        </div>
      )}
    </div>
  );
}

function PresenceStrip() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        <Avatar user="chloe" size={20} ring />
        <Avatar user="david" size={20} ring />
        <Avatar user="alex" size={20} ring />
      </div>
      <span className="text-[10.5px] text-ink-quiet">Demo workspace</span>
    </div>
  );
}

function ViewTabs({ view }: { view: ViewMode }) {
  const items: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      id: "board",
      label: "Board",
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="11" rx="1" />
        </svg>
      ),
    },
    {
      id: "list",
      label: "List",
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="6" width="11" height="3" rx="1" />
          <rect x="7" y="11" width="13" height="3" rx="1" />
          <rect x="5" y="16" width="9" height="3" rx="1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative inline-flex items-center rounded-lg bg-bg-sunken p-0.5">
      {items.map((item) => (
        <div
          key={item.id}
          data-tab={item.id}
          className={
            "relative inline-flex select-none items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
            (view === item.id
              ? "text-ink"
              : "text-ink-quiet hover:text-ink-soft")
          }
        >
          {view === item.id ? (
            <motion.span
              layoutId="tab-pill"
              className="absolute inset-0 rounded-md bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          ) : null}
          <span className="relative z-10 inline-flex items-center gap-1">
            {item.icon}
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function BoardSurface({
  state,
  cardRefs,
}: {
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  return (
    <div className="grid h-full grid-cols-4 gap-3 px-5 pt-4">
      {(["todo", "doing", "review", "done"] as const).map((laneId, idx) => {
        const lane = LANES[laneId];
        const laneTasks = state.tasks.filter((t) => t.lane === laneId);
        return (
          <motion.div
            key={laneId}
            data-lane={laneId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: MOTION_MODERATE,
              delay: idx * 0.06,
              ease: EASE_OUT_EXPO,
            }}
            className="flex flex-col gap-2 overflow-hidden rounded-xl p-2"
            style={{ background: lane.bg }}
          >
            <div
              data-lane-header
              className="flex items-center justify-between px-1.5 pb-1 pt-0.5"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[11.5px] font-medium"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
                <span className="text-[11px] text-ink-quiet">
                  {laneTasks.length}
                </span>
              </div>
              <button type="button" aria-hidden="true" tabIndex={-1} className="rounded p-0.5 text-ink-quiet hover:bg-white/60 hover:text-ink-soft">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {laneTasks.map((task) => (
                <BoardCardWrapper
                  key={task.id}
                  task={task}
                  state={state}
                  cardRefs={cardRefs}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function BoardCardWrapper({
  task,
  state,
  cardRefs,
}: {
  task: Task;
  state: DemoState;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const isPicked = state.pickedTaskId === task.id;
  const isDep =
    !!state.dependencyHighlight &&
    (state.dependencyHighlight[0] === task.id ||
      state.dependencyHighlight[1] === task.id);
  const showThread = state.openCommentTaskId === task.id;
  const pickedColor =
    isPicked && state.pickedBy ? USERS[state.pickedBy].color : null;

  return (
    <TaskCard
      task={task}
      picked={isPicked}
      pickedBy={pickedColor}
      highlightDependency={isDep}
      showInlineThread={showThread}
      staticComment={state.staticComment}
      typingUser={showThread ? state.typingFromUser : null}
      typingProgress={showThread ? state.typingProgress : 0}
      postedComment={showThread ? state.postedComment : null}
      forwardRef={(el) => {
        if (el) cardRefs.current.set(task.id, el);
        else cardRefs.current.delete(task.id);
      }}
    />
  );
}
