"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wordmark } from "@/components/brand/wordmark";
import {
  cycleRoadmapStatusAction,
  setRoadmapNoteAction,
  toggleBlockerResolvedAction,
  setBlockerNoteAction,
  cycleActionItemStatusAction,
  setActionItemNoteAction,
  type RoadmapStatus,
} from "@/server/actions/roadmap";
import type { RoadmapRow } from "@/server/roadmap/sync";
import type {
  BlockerRow,
  ActionItemRow,
} from "@/server/roadmap/launch-readiness-seed";

/**
 * RoadmapView — the operator surface. Top-of-page blockers strip
 * pins the small set of user-only actions (domain, ElevenLabs,
 * handle claims, recordings, paid spend, live launch beats); each
 * blocker carries a free-text note and the count of items it
 * unblocks. Below: the 144-row 8-week calendar (filterable by kind,
 * week, blocker, status). Below that: the engineering / QA / launch-
 * readiness action-items checklist (categorized, ~95 items). All
 * notes clamped to 140 characters by both the UI and the server
 * action — accountability is single-line.
 */

type Kind =
  | "post"
  | "asset"
  | "press"
  | "paid"
  | "launch"
  | "kpi"
  | "milestone";

const KIND_META: Record<
  Kind,
  { label: string; pillBg: string; pillFg: string }
> = {
  post: {
    label: "Post",
    pillBg: "var(--indigo-50)",
    pillFg: "var(--indigo-700)",
  },
  asset: {
    label: "Asset",
    pillBg: "var(--ink-100)",
    pillFg: "var(--ink-700)",
  },
  press: {
    label: "Press",
    pillBg: "var(--roadmap-rose-bg)",
    pillFg: "var(--roadmap-rose-fg)",
  },
  paid: {
    label: "Paid",
    pillBg: "var(--roadmap-amber-bg)",
    pillFg: "var(--roadmap-amber-fg)",
  },
  launch: {
    label: "Launch",
    pillBg: "var(--roadmap-violet-bg)",
    pillFg: "var(--roadmap-violet-fg)",
  },
  kpi: {
    label: "KPI",
    pillBg: "var(--roadmap-emerald-bg)",
    pillFg: "var(--roadmap-emerald-fg)",
  },
  milestone: {
    label: "Milestone",
    pillBg: "var(--ink-100)",
    pillFg: "var(--ink-700)",
  },
};

const CHANNEL_ABBREV: Record<string, string> = {
  X: "X",
  Bluesky: "BS",
  HN: "HN",
  IH: "IH",
  YouTube: "YT",
  LinkedIn: "LI",
  "r/SideProject": "r/SP",
  "r/SaaS": "r/SaaS",
  "r/freelance": "r/free",
  "r/productivity": "r/prod",
  "Product Hunt": "PH",
  "Indie Hackers": "IH",
  "Designer News": "DN",
  "Sidebar.io": "Sb",
  Refind: "Rf",
  "PH back-channel": "PH",
};

const BLOCKER_KIND_META: Record<
  string,
  { tone: string; bg: string; fg: string }
> = {
  purchase: {
    tone: "amber",
    bg: "var(--roadmap-amber-bg)",
    fg: "var(--roadmap-amber-fg)",
  },
  account: {
    tone: "indigo",
    bg: "var(--indigo-50)",
    fg: "var(--indigo-700)",
  },
  recording: {
    tone: "violet",
    bg: "var(--roadmap-violet-bg)",
    fg: "var(--roadmap-violet-fg)",
  },
  config: {
    tone: "stone",
    bg: "var(--ink-100)",
    fg: "var(--ink-700)",
  },
  "ad-spend": {
    tone: "amber",
    bg: "var(--roadmap-amber-bg)",
    fg: "var(--roadmap-amber-fg)",
  },
  "launch-beat": {
    tone: "rose",
    bg: "var(--roadmap-rose-bg)",
    fg: "var(--roadmap-rose-fg)",
  },
  auth: {
    tone: "indigo",
    bg: "var(--indigo-50)",
    fg: "var(--indigo-700)",
  },
  kpi: {
    tone: "emerald",
    bg: "var(--roadmap-emerald-bg)",
    fg: "var(--roadmap-emerald-fg)",
  },
};

const PRIORITY_META: Record<
  "P0" | "P1" | "P2",
  { bg: string; fg: string; label: string }
> = {
  P0: {
    bg: "var(--roadmap-red-bg)",
    fg: "var(--roadmap-red-fg)",
    label: "P0",
  },
  P1: {
    bg: "var(--roadmap-amber-bg)",
    fg: "var(--roadmap-amber-fg)",
    label: "P1",
  },
  P2: { bg: "var(--ink-100)", fg: "var(--ink-600)", label: "P2" },
};

const LAUNCH_DATE_HN = "2026-06-16";
const LAUNCH_DATE_PH = "2026-06-23";
const LAUNCH_DATE_IH = "2026-06-24";

const NOTE_MAX = 140;

/* ── Advisory + source-file derivation ──────────────────────────
   Every row in the page should answer "why am I here?" in one
   sentence. Roadmap rows don't carry a description column; this
   function derives an advisory from kind + channel + date. Source
   file is the markdown the verbatim body lives in (post-week-N.md,
   press-drafts.md, launch-day-*.md). */

function roadmapAdvisory(row: RoadmapRow): string {
  if (row.kind === "launch") {
    if (row.channel === "HN") return "Live Show HN beat. Hour-by-hour playbook in docs/launch-day-show-hn.md. The single biggest organic acquisition lever in the 8 weeks.";
    if (row.channel === "Product Hunt") return "Live PH beat. Hour-by-hour playbook in docs/launch-day-product-hunt.md. Reply within 15 min for the first 6 hrs.";
    if (row.channel === "Indie Hackers") return "IH milestone post Wed 06-24. Body staged in docs/posts-week-7.md, references HN+PH numbers from the prior two days.";
    return "Live launch beat — playbook in docs/launch-day-*.md.";
  }
  if (row.kind === "press") return "Press touchpoint. Drafted in docs/press-drafts.md (or its 14-day Gantt mirror). Send 2026-06-08 (T-7 to Show HN), one sender, no BCC.";
  if (row.kind === "paid") {
    if ((row.format ?? "").toLowerCase().includes("reddit")) return "$300 Reddit Ads on r/weddingplanning + r/wedding. Kill if CPA >$5/signup by day 4 OR zero $79 conversions by day 7.";
    if ((row.format ?? "").toLowerCase().includes("ig") || (row.format ?? "").toLowerCase().includes("instagram")) return "$200 IG boost via wedding micro-influencer (15–50k). Kill if <200 clicks in 72h OR <5 signups from 1k clicks.";
    return "Paid spend with kill-criteria — see gtm-plan.md §8.";
  }
  if (row.kind === "kpi") return "Monday standup-with-yourself. Five numbers (free signups · paid · HN front-page mins · PH rank EOD · /p/ count) into docs/kpi-log.md.";
  if (row.kind === "asset") return "Pre-launch asset. One-time work; once shipped it compounds across the calendar.";
  if (row.kind === "post") {
    const ch = row.channel ?? "channel";
    return `Scheduled ${ch} drop · ${row.postingTime ?? "time TBD"}. Verbatim body in docs/posts-week-${row.week}.md. Paste, post, tick.`;
  }
  return "";
}

function sourceFileFor(row: RoadmapRow): string | null {
  if (row.kind === "post") return `docs/posts-week-${row.week}.md`;
  if (row.kind === "press") return "docs/press-drafts.md";
  if (row.kind === "launch") {
    if (row.date === "2026-06-16") return "docs/launch-day-show-hn.md";
    if (row.date === "2026-06-23") return "docs/launch-day-product-hunt.md";
    if (row.date === "2026-06-24") return "docs/posts-week-7.md";
  }
  if (row.kind === "kpi") return "docs/kpi-log.md";
  if (row.kind === "asset") {
    if ((row.body ?? "").toLowerCase().includes("hero loop"))
      return "src/components/showcase/cinematic-demo.tsx";
    if ((row.body ?? "").toLowerCase().includes("press email"))
      return "docs/press-drafts.md";
    if ((row.body ?? "").toLowerCase().includes("product hunt"))
      return "docs/product-hunt-page.md";
    return null;
  }
  return null;
}

type DrawerEntity =
  | { kind: "item"; data: RoadmapRow }
  | { kind: "blocker"; data: BlockerRow }
  | { kind: "action"; data: ActionItemRow };

interface Props {
  initialItems: RoadmapRow[];
  initialBlockers: BlockerRow[];
  initialActionItems: ActionItemRow[];
  today: string;
}

export function RoadmapView({
  initialItems,
  initialBlockers,
  initialActionItems,
  today,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [blockerRows, setBlockerRows] = useState(initialBlockers);
  const [actionRows, setActionRows] = useState(initialActionItems);
  const [filterKind, setFilterKind] = useState<"all" | Kind>("all");
  const [filterWeek, setFilterWeek] = useState<"all" | number>("all");
  const [filterBlocker, setFilterBlocker] = useState<string | null>(null);
  const [hidePending, setHidePending] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [drawer, setDrawer] = useState<DrawerEntity | null>(null);
  const [, startTransition] = useTransition();

  // ESC closes drawer.
  useEffect(() => {
    if (!drawer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawer(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Keep drawer state synced when the underlying entity changes
  // (status toggle from inside the drawer, note save, etc).
  useEffect(() => {
    if (!drawer) return;
    if (drawer.kind === "item") {
      const next = items.find((x) => x.id === drawer.data.id);
      if (next && next !== drawer.data) setDrawer({ kind: "item", data: next });
    } else if (drawer.kind === "blocker") {
      const next = blockerRows.find((x) => x.id === drawer.data.id);
      if (next && next !== drawer.data)
        setDrawer({ kind: "blocker", data: next });
    } else {
      const next = actionRows.find((x) => x.id === drawer.data.id);
      if (next && next !== drawer.data)
        setDrawer({ kind: "action", data: next });
    }
  }, [items, blockerRows, actionRows, drawer]);

  const counts = useMemo(() => {
    // Combined view across all three tables — the page's full surface.
    const itemTotal = items.length;
    const itemDone = items.filter((i) => i.status === "completed").length;
    const itemActive = items.filter(
      (i) => i.status === "in_progress",
    ).length;

    const actionTotal = actionRows.length;
    const actionDone = actionRows.filter(
      (a) => a.status === "completed",
    ).length;
    const actionActive = actionRows.filter(
      (a) => a.status === "in_progress",
    ).length;

    const blockerTotal = blockerRows.length;
    const blockerDone = blockerRows.filter((b) => b.resolvedAt).length;

    const combinedTotal = itemTotal + actionTotal + blockerTotal;
    const combinedDone = itemDone + actionDone + blockerDone;
    const combinedActive = itemActive + actionActive;

    return {
      itemTotal,
      itemDone,
      itemActive,
      actionTotal,
      actionDone,
      actionActive,
      blockerTotal,
      blockerDone,
      combinedTotal,
      combinedDone,
      combinedActive,
      combinedPending: combinedTotal - combinedDone - combinedActive,
      pct: combinedTotal
        ? Math.round((combinedDone / combinedTotal) * 100)
        : 0,
    };
  }, [items, actionRows, blockerRows]);

  const todayItems = useMemo(() => {
    const next7: string[] = [];
    const base = new Date(today + "T00:00:00");
    for (let d = 0; d < 7; d++) {
      const dt = new Date(base.getTime() + d * 86400000);
      next7.push(dt.toISOString().slice(0, 10));
    }
    return items
      .filter((i) => i.date && next7.includes(i.date))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  }, [items, today]);

  const byWeek = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (filterKind !== "all" && i.kind !== filterKind) return false;
      if (filterWeek !== "all" && i.week !== filterWeek) return false;
      if (hidePending && i.status === "pending") return false;
      if (hideDone && i.status === "completed") return false;
      if (q) {
        const hay =
          (i.body ?? "") +
          " " +
          (i.format ?? "") +
          " " +
          (i.channel ?? "") +
          " " +
          (i.source ?? "") +
          " " +
          (i.cta ?? "");
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const map = new Map<number, RoadmapRow[]>();
    filtered.forEach((i) => {
      if (!map.has(i.week)) map.set(i.week, []);
      map.get(i.week)!.push(i);
    });
    map.forEach((arr) => {
      arr.sort((a, b) => {
        if (a.date && b.date && a.date !== b.date)
          return a.date < b.date ? -1 : 1;
        return a.ord - b.ord;
      });
    });
    return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
  }, [items, filterKind, filterWeek, hidePending, hideDone, searchQ]);

  const weeksAvailable = useMemo(() => {
    const set = new Set<number>();
    items.forEach((i) => set.add(i.week));
    return [...set].sort((a, b) => a - b);
  }, [items]);

  const daysToHN = daysBetween(today, LAUNCH_DATE_HN);
  const daysToPH = daysBetween(today, LAUNCH_DATE_PH);

  function toggle(id: string) {
    setItems((cur) =>
      cur.map((it) => {
        if (it.id !== id) return it;
        const next: RoadmapStatus =
          it.status === "pending"
            ? "in_progress"
            : it.status === "in_progress"
              ? "completed"
              : "pending";
        return {
          ...it,
          status: next,
          completedAt: next === "completed" ? new Date() : null,
        };
      }),
    );
    startTransition(() => {
      cycleRoadmapStatusAction(id);
    });
  }

  function saveNote(id: string, note: string) {
    const clamped = note.slice(0, NOTE_MAX);
    setItems((cur) =>
      cur.map((it) =>
        it.id === id ? { ...it, note: clamped.trim() || null } : it,
      ),
    );
    startTransition(() => {
      setRoadmapNoteAction(id, clamped);
    });
  }

  function toggleBlocker(id: string) {
    setBlockerRows((cur) =>
      cur.map((b) =>
        b.id === id ? { ...b, resolvedAt: b.resolvedAt ? null : new Date() } : b,
      ),
    );
    startTransition(() => {
      toggleBlockerResolvedAction(id);
    });
  }

  function saveBlockerNote(id: string, note: string) {
    const clamped = note.slice(0, NOTE_MAX);
    setBlockerRows((cur) =>
      cur.map((b) =>
        b.id === id ? { ...b, note: clamped.trim() || null } : b,
      ),
    );
    startTransition(() => {
      setBlockerNoteAction(id, clamped);
    });
  }

  function cycleAction(id: string) {
    setActionRows((cur) =>
      cur.map((a) => {
        if (a.id !== id) return a;
        const next: RoadmapStatus =
          a.status === "pending"
            ? "in_progress"
            : a.status === "in_progress"
              ? "completed"
              : "pending";
        return {
          ...a,
          status: next,
          completedAt: next === "completed" ? new Date() : null,
        };
      }),
    );
    startTransition(() => {
      cycleActionItemStatusAction(id);
    });
  }

  function saveActionNote(id: string, note: string) {
    const clamped = note.slice(0, NOTE_MAX);
    setActionRows((cur) =>
      cur.map((a) =>
        a.id === id ? { ...a, note: clamped.trim() || null } : a,
      ),
    );
    startTransition(() => {
      setActionItemNoteAction(id, clamped);
    });
  }

  // Items unblocked count per blocker
  const unblockCountByBlocker = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      if (i.blockerId && i.status !== "completed") {
        map[i.blockerId] = (map[i.blockerId] ?? 0) + 1;
      }
    });
    actionRows.forEach((a) => {
      if (a.blockerId && a.status !== "completed") {
        map[a.blockerId] = (map[a.blockerId] ?? 0) + 1;
      }
    });
    return map;
  }, [items, actionRows]);

  const actionStats = useMemo(() => {
    const total = actionRows.length;
    const done = actionRows.filter((a) => a.status === "completed").length;
    const p0 = actionRows.filter((a) => a.priority === "P0").length;
    const p0Done = actionRows.filter(
      (a) => a.priority === "P0" && a.status === "completed",
    ).length;
    return { total, done, p0, p0Done };
  }, [actionRows]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-sans-stack)",
      }}
    >
      {/* ─── Top bar ───────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--bg) 88%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto max-w-[1240px] px-8 py-5 flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
            aria-label="Tasks home"
          >
            <Wordmark size="md" />
          </Link>
          <div
            className="text-[13px]"
            style={{ color: "var(--text-muted)" }}
          >
            GTM Roadmap · 2026-05-11 → 2026-07-05 · 8 weeks
          </div>
          <div className="ml-auto flex items-center gap-6">
            <CountdownPill
              label="Show HN"
              date={LAUNCH_DATE_HN}
              days={daysToHN}
              tone="violet"
            />
            <CountdownPill
              label="Product Hunt"
              date={LAUNCH_DATE_PH}
              days={daysToPH}
              tone="indigo"
            />
            <ProgressRing pct={counts.pct} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] px-8 py-10 grid grid-cols-[1fr_320px] gap-10">
        {/* ─── Main column ─────────────────────────────────────── */}
        <main className="min-w-0">
          {/* Headline */}
          <div className="mb-10">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-quiet, var(--text-muted))" }}
            >
              8-week go-to-market plan
            </div>
            <h1
              className="mt-3 text-[40px] leading-[1.05] font-semibold tracking-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              The other roadmap.
            </h1>
            <p
              className="mt-3 text-[15px] max-w-[640px]"
              style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
            >
              Eight weeks. Two launch beats. The plan, the work, and a check
              next to every line — kept honest by re-parsing{" "}
              <code
                className="text-[13px] px-1 py-0.5 rounded"
                style={{ background: "var(--ink-100)" }}
              >
                docs/gtm-plan.md
              </code>{" "}
              on every load.
            </p>
            <div
              className="mt-6 flex items-baseline gap-6 text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Stat label="Total" value={counts.combinedTotal} />
              <Stat
                label="Done"
                value={counts.combinedDone}
                accent="var(--status-done)"
              />
              <Stat
                label="Active"
                value={counts.combinedActive}
                accent="var(--status-progress)"
              />
              <Stat
                label="Pending"
                value={counts.combinedPending}
              />
            </div>
            <div
              className="mt-2 text-[12px] tabular-nums"
              style={{ color: "var(--text-faint)" }}
            >
              <span style={{ color: "var(--text-muted)" }}>
                {counts.itemDone}/{counts.itemTotal}
              </span>{" "}
              GTM ·{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {counts.actionDone}/{counts.actionTotal}
              </span>{" "}
              launch readiness ·{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {counts.blockerDone}/{counts.blockerTotal}
              </span>{" "}
              blockers resolved
            </div>
          </div>

          {/* ─── Blockers strip ─────────────────────────────────── */}
          <BlockersStrip
            blockers={blockerRows}
            unblockCount={unblockCountByBlocker}
            filterBlocker={filterBlocker}
            onSelectBlocker={(id) =>
              setFilterBlocker((cur) => (cur === id ? null : id))
            }
            onOpenDrawer={(b) => setDrawer({ kind: "blocker", data: b })}
            onToggle={toggleBlocker}
            onSaveNote={saveBlockerNote}
          />

          {/* Filters */}
          <div className="mb-4 mt-10 flex flex-wrap items-center gap-2">
            <KindChip
              kind="all"
              current={filterKind}
              onClick={() => setFilterKind("all")}
            />
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <KindChip
                key={k}
                kind={k}
                current={filterKind}
                onClick={() => setFilterKind(k)}
              />
            ))}
            <span
              className="mx-3 h-4 w-px"
              style={{ background: "var(--border)" }}
            />
            <button
              onClick={() => setHidePending((v) => !v)}
              className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: hidePending ? "var(--ink-900)" : "transparent",
                color: hidePending ? "var(--ink-0)" : "var(--text-muted)",
                border: `1px solid ${hidePending ? "var(--ink-900)" : "var(--border)"}`,
              }}
            >
              Hide pending
            </button>
            <button
              onClick={() => setHideDone((v) => !v)}
              className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: hideDone ? "var(--ink-900)" : "transparent",
                color: hideDone ? "var(--ink-0)" : "var(--text-muted)",
                border: `1px solid ${hideDone ? "var(--ink-900)" : "var(--border)"}`,
              }}
            >
              Hide done
            </button>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search rows…"
              className="ml-auto text-[12px] px-3 py-1.5 rounded-full focus:outline-none w-[200px]"
              style={{
                background: "transparent",
                color: "var(--text)",
                border: "1px solid var(--border)",
              }}
            />
          </div>

          {/* Week chips */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterWeek("all")}
              className="text-[11px] px-2.5 py-1 rounded-md transition-colors tabular-nums"
              style={{
                background:
                  filterWeek === "all" ? "var(--ink-800)" : "transparent",
                color:
                  filterWeek === "all" ? "var(--ink-0)" : "var(--text-faint)",
                border: `1px solid ${filterWeek === "all" ? "var(--ink-800)" : "var(--border-soft)"}`,
              }}
            >
              All weeks
            </button>
            {weeksAvailable.map((w) => (
              <button
                key={w}
                onClick={() => setFilterWeek(w)}
                className="text-[11px] px-2.5 py-1 rounded-md transition-colors tabular-nums"
                style={{
                  background:
                    filterWeek === w ? "var(--ink-800)" : "transparent",
                  color:
                    filterWeek === w
                      ? "var(--ink-0)"
                      : "var(--text-muted)",
                  border: `1px solid ${filterWeek === w ? "var(--ink-800)" : "var(--border-soft)"}`,
                }}
              >
                {w === 0 ? "Index" : `W${w}`}
              </button>
            ))}
            {filterBlocker ? (
              <button
                onClick={() => setFilterBlocker(null)}
                className="ml-2 text-[11px] px-2.5 py-1 rounded-md transition-colors"
                style={{
                  background: "var(--indigo-50)",
                  color: "var(--indigo-700)",
                  border: "1px solid var(--indigo-200)",
                }}
              >
                Filtered by blocker · clear
              </button>
            ) : null}
          </div>

          {/* Week strips */}
          <div className="space-y-12">
            {[...byWeek.entries()].map(([week, rows]) => {
              // Apply blocker filter to week rows here for display
              const filtered = filterBlocker
                ? rows.filter((r) => r.blockerId === filterBlocker)
                : rows;
              if (filtered.length === 0) return null;
              return (
                <WeekSection
                  key={week}
                  week={week}
                  rows={filtered}
                  today={today}
                  blockers={blockerRows}
                  onOpenDrawer={(r) => setDrawer({ kind: "item", data: r })}
                  onToggle={toggle}
                  onSaveNote={saveNote}
                />
              );
            })}
            {[...byWeek.values()].every(
              (rows) =>
                (filterBlocker
                  ? rows.filter((r) => r.blockerId === filterBlocker)
                  : rows
                ).length === 0,
            ) ? (
              <div
                className="text-center py-24 text-[14px] rounded-2xl"
                style={{
                  color: "var(--text-faint)",
                  border: "1px dashed var(--border)",
                }}
              >
                No items match the current filters.
              </div>
            ) : null}
          </div>

          {/* ─── Action items section ───────────────────────────── */}
          <ActionItemsSection
            actions={actionRows}
            blockers={blockerRows}
            stats={actionStats}
            filterBlocker={filterBlocker}
            onOpenDrawer={(a) => setDrawer({ kind: "action", data: a })}
            onCycle={cycleAction}
            onSaveNote={saveActionNote}
          />
        </main>

        {/* ─── Right rail ──────────────────────────────────────── */}
        <aside className="sticky top-[88px] self-start space-y-8 max-h-[calc(100vh-100px)] overflow-y-auto pb-8">
          <section>
            <div
              className="text-[11px] uppercase tracking-[0.12em] mb-3"
              style={{ color: "var(--text-faint)" }}
            >
              Next 7 days
            </div>
            <div className="space-y-1.5">
              {todayItems.length === 0 ? (
                <div
                  className="text-[13px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Quiet stretch. Use the lull.
                </div>
              ) : (
                todayItems.map((it) => (
                  <button
                    key={`r-${it.id}`}
                    onClick={() => toggle(it.id)}
                    className="w-full text-left flex items-start gap-3 group py-1.5 px-2 -mx-2 rounded-lg transition-colors"
                  >
                    <StatusDot status={it.status} />
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[12px] font-medium truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {it.body || it.format || it.channel}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {prettyDate(it.date!, today)} · {it.channel ?? "—"}
                        {it.postingTime ? ` · ${it.postingTime}` : ""}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section>
            <div
              className="text-[11px] uppercase tracking-[0.12em] mb-3"
              style={{ color: "var(--text-faint)" }}
            >
              Launch beats
            </div>
            <div className="space-y-3 text-[12px]">
              <LaunchRow
                label="Show HN"
                date={LAUNCH_DATE_HN}
                time="9:00am ET"
                days={daysToHN}
              />
              <LaunchRow
                label="Product Hunt"
                date={LAUNCH_DATE_PH}
                time="3:01am PT"
                days={daysToPH}
              />
              <LaunchRow
                label="Indie Hackers"
                date={LAUNCH_DATE_IH}
                time="9:00am ET"
                days={daysBetween(today, LAUNCH_DATE_IH)}
              />
            </div>
          </section>

          <section>
            <div
              className="text-[11px] uppercase tracking-[0.12em] mb-3"
              style={{ color: "var(--text-faint)" }}
            >
              Launch readiness
            </div>
            <div
              className="text-[13px]"
              style={{ color: "var(--text-muted)" }}
            >
              <div className="tabular-nums">
                <span style={{ color: "var(--text)" }}>
                  {actionStats.done}
                </span>
                /{actionStats.total} action items
              </div>
              <div className="tabular-nums mt-1">
                <span
                  style={{
                    color:
                      actionStats.p0Done === actionStats.p0
                        ? "var(--status-done)"
                        : "var(--roadmap-red-fg)",
                  }}
                >
                  {actionStats.p0Done}
                </span>
                /{actionStats.p0} P0 closed
              </div>
            </div>
          </section>

          <section>
            <div
              className="text-[11px] uppercase tracking-[0.12em] mb-3"
              style={{ color: "var(--text-faint)" }}
            >
              Source
            </div>
            <div
              className="text-[12px] leading-[1.6]"
              style={{ color: "var(--text-muted)" }}
            >
              <code className="text-[11px]">docs/gtm-plan.md</code> · re-parsed
              on every page load. <code className="text-[11px]">/api/roadmap.ics</code>
              {" "}feeds the calendar. <code className="text-[11px]">docs/phase-plan.md</code>
              {" "}holds the milestone map.
            </div>
          </section>
        </aside>
      </div>

      {/* ─── Drill-down drawer ─────────────────────────────────── */}
      <DetailDrawer
        entity={drawer}
        blockers={blockerRows}
        onClose={() => setDrawer(null)}
        onCycleItem={toggle}
        onSaveItemNote={saveNote}
        onToggleBlocker={toggleBlocker}
        onSaveBlockerNote={saveBlockerNote}
        onCycleAction={cycleAction}
        onSaveActionNote={saveActionNote}
      />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function DetailDrawer({
  entity,
  blockers,
  onClose,
  onCycleItem,
  onSaveItemNote,
  onToggleBlocker,
  onSaveBlockerNote,
  onCycleAction,
  onSaveActionNote,
}: {
  entity: DrawerEntity | null;
  blockers: BlockerRow[];
  onClose: () => void;
  onCycleItem: (id: string) => void;
  onSaveItemNote: (id: string, n: string) => void;
  onToggleBlocker: (id: string) => void;
  onSaveBlockerNote: (id: string, n: string) => void;
  onCycleAction: (id: string) => void;
  onSaveActionNote: (id: string, n: string) => void;
}) {
  return (
    <AnimatePresence>
      {entity ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-30"
            style={{ background: "color-mix(in oklab, var(--ink-950) 30%, transparent)" }}
          />
          <motion.aside
            key="drawer"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-[480px] overflow-y-auto"
            style={{
              background: "var(--bg-elev)",
              borderLeft: "1px solid var(--border)",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.06)",
            }}
          >
            <DrawerBody
              entity={entity}
              blockers={blockers}
              onClose={onClose}
              onCycleItem={onCycleItem}
              onSaveItemNote={onSaveItemNote}
              onToggleBlocker={onToggleBlocker}
              onSaveBlockerNote={onSaveBlockerNote}
              onCycleAction={onCycleAction}
              onSaveActionNote={onSaveActionNote}
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function DrawerBody({
  entity,
  blockers,
  onClose,
  onCycleItem,
  onSaveItemNote,
  onToggleBlocker,
  onSaveBlockerNote,
  onCycleAction,
  onSaveActionNote,
}: {
  entity: DrawerEntity;
  blockers: BlockerRow[];
  onClose: () => void;
  onCycleItem: (id: string) => void;
  onSaveItemNote: (id: string, n: string) => void;
  onToggleBlocker: (id: string) => void;
  onSaveBlockerNote: (id: string, n: string) => void;
  onCycleAction: (id: string) => void;
  onSaveActionNote: (id: string, n: string) => void;
}) {
  const blockerById = useMemo(
    () => new Map(blockers.map((b) => [b.id, b])),
    [blockers],
  );

  if (entity.kind === "item") {
    const r = entity.data;
    const blocker = r.blockerId ? blockerById.get(r.blockerId) ?? null : null;
    const advisory = roadmapAdvisory(r);
    const sourceFile = sourceFileFor(r);
    return (
      <DrawerShell
        title={r.body || r.format || r.channel || "—"}
        subtitle={`${r.kind === "post" ? "Post" : r.kind === "press" ? "Press" : r.kind === "launch" ? "Launch" : r.kind === "kpi" ? "KPI" : r.kind === "paid" ? "Paid" : "Asset"} · Week ${r.week === 0 ? "Index" : r.week}${r.date ? ` · ${r.date}` : ""}${r.day ? ` (${r.day})` : ""}`}
        onClose={onClose}
        status={r.status}
        onCycle={() => onCycleItem(r.id)}
        advisory={advisory}
        meta={[
          ["Channel", r.channel],
          ["Format", r.format],
          ["Source", r.source],
          ["CTA", r.cta],
          ["Posting time", r.postingTime],
          ["ID", r.id],
        ]}
        blocker={blocker}
        sourceFile={sourceFile}
        note={r.note ?? ""}
        onSaveNote={(n) => onSaveItemNote(r.id, n)}
      />
    );
  }
  if (entity.kind === "blocker") {
    const b = entity.data;
    return (
      <DrawerShell
        title={b.title}
        subtitle={`Blocker · ${b.kind}${b.targetDate ? ` · target ${b.targetDate}` : ""}`}
        onClose={onClose}
        status={b.resolvedAt ? "completed" : "pending"}
        onCycle={() => onToggleBlocker(b.id)}
        advisory={b.description}
        meta={[
          ["Kind", b.kind],
          ["Target", b.targetDate],
          ["ID", b.id],
          ["Resolved at", b.resolvedAt ? b.resolvedAt.toISOString().slice(0, 10) : null],
        ]}
        blocker={null}
        sourceFile={null}
        note={b.note ?? ""}
        onSaveNote={(n) => onSaveBlockerNote(b.id, n)}
      />
    );
  }
  // action
  const a = entity.data;
  const blocker = a.blockerId ? blockerById.get(a.blockerId) ?? null : null;
  return (
    <DrawerShell
      title={a.title}
      subtitle={`Action item · ${a.category} · ${a.priority}`}
      onClose={onClose}
      status={a.status}
      onCycle={() => onCycleAction(a.id)}
      advisory={a.description ?? ""}
      meta={[
        ["Category", a.category],
        ["Priority", a.priority],
        ["ID", a.id],
        ["Completed at", a.completedAt ? a.completedAt.toISOString().slice(0, 10) : null],
      ]}
      blocker={blocker}
      sourceFile={null}
      note={a.note ?? ""}
      onSaveNote={(n) => onSaveActionNote(a.id, n)}
    />
  );
}

function DrawerShell({
  title,
  subtitle,
  onClose,
  status,
  onCycle,
  advisory,
  meta,
  blocker,
  sourceFile,
  note,
  onSaveNote,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  status: RoadmapStatus;
  onCycle: () => void;
  advisory: string;
  meta: [string, string | null | undefined][];
  blocker: BlockerRow | null;
  sourceFile: string | null;
  note: string;
  onSaveNote: (n: string) => void;
}) {
  const [noteVal, setNoteVal] = useState(note);
  // Sync local note state if drawer entity changes underneath
  useEffect(() => setNoteVal(note), [note]);

  return (
    <div className="px-7 py-7">
      <div className="flex items-start gap-3 mb-1">
        <div
          className="text-[10px] uppercase tracking-[0.12em] flex-1"
          style={{ color: "var(--text-faint)" }}
        >
          {subtitle}
        </div>
        <button
          onClick={onClose}
          className="text-[13px] -mt-0.5"
          style={{ color: "var(--text-faint)" }}
          aria-label="Close"
        >
          esc · close
        </button>
      </div>
      <h2
        className="text-[22px] font-semibold tracking-tight leading-tight mb-4"
        style={{ letterSpacing: "-0.01em" }}
      >
        {title}
      </h2>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onCycle}
          className="text-[12px] px-3 py-1.5 rounded-full font-medium transition-colors"
          style={{
            background:
              status === "completed"
                ? "var(--status-done)"
                : status === "in_progress"
                  ? "var(--status-progress)"
                  : "var(--ink-100)",
            color:
              status === "pending" ? "var(--text)" : "white",
            border: "none",
          }}
        >
          {status === "completed"
            ? "✓ done · click to reopen"
            : status === "in_progress"
              ? "active · click to mark done"
              : "pending · click to start"}
        </button>
      </div>

      {advisory ? (
        <section className="mb-6">
          <div
            className="text-[10px] uppercase tracking-[0.12em] mb-2"
            style={{ color: "var(--text-faint)" }}
          >
            Why this is here
          </div>
          <div
            className="text-[13.5px] leading-[1.55]"
            style={{ color: "var(--text)" }}
          >
            {advisory}
          </div>
        </section>
      ) : null}

      {blocker ? (
        <section className="mb-6">
          <div
            className="text-[10px] uppercase tracking-[0.12em] mb-2"
            style={{ color: "var(--text-faint)" }}
          >
            Blocked by
          </div>
          <div
            className="rounded-lg px-3 py-2 text-[13px]"
            style={{
              background: blocker.resolvedAt
                ? "var(--bg)"
                : "var(--roadmap-red-bg)",
              color: blocker.resolvedAt
                ? "var(--text-muted)"
                : "var(--roadmap-red-fg)",
              border: blocker.resolvedAt
                ? "1px solid var(--border-soft)"
                : "1px solid var(--roadmap-red-border)",
            }}
          >
            <div className="font-medium">
              {blocker.title}
              {blocker.resolvedAt ? " (resolved)" : ""}
            </div>
            <div
              className="mt-0.5 text-[12px] leading-snug"
              style={{
                color: blocker.resolvedAt
                  ? "var(--text-faint)"
                  : "var(--roadmap-red-deep)",
              }}
            >
              {blocker.description}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <div
          className="text-[10px] uppercase tracking-[0.12em] mb-2"
          style={{ color: "var(--text-faint)" }}
        >
          Details
        </div>
        <dl className="text-[13px]">
          {meta
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[110px_1fr] py-1.5 border-b"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <dt
                  className="text-[12px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {k}
                </dt>
                <dd
                  className="break-words"
                  style={{ color: "var(--text)" }}
                >
                  {v}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      {sourceFile ? (
        <section className="mb-6">
          <div
            className="text-[10px] uppercase tracking-[0.12em] mb-2"
            style={{ color: "var(--text-faint)" }}
          >
            Source file
          </div>
          <code
            className="text-[12px] px-2 py-1 rounded inline-block"
            style={{ background: "var(--ink-100)", color: "var(--text)" }}
          >
            {sourceFile}
          </code>
          <div
            className="mt-1 text-[11.5px]"
            style={{ color: "var(--text-faint)" }}
          >
            Open this file in your editor for the verbatim body.
          </div>
        </section>
      ) : null}

      <section>
        <div
          className="text-[10px] uppercase tracking-[0.12em] mb-2"
          style={{ color: "var(--text-faint)" }}
        >
          Note · single sentence, max {NOTE_MAX} chars
        </div>
        <textarea
          value={noteVal}
          onChange={(e) => setNoteVal(e.target.value.slice(0, NOTE_MAX))}
          onBlur={() => onSaveNote(noteVal)}
          placeholder='e.g. "got 47 likes" or "slipped to Wed" or "card on file 5/10"'
          className="w-full text-[13px] p-3 rounded-md focus:outline-none"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            resize: "none",
            minHeight: 80,
            fontFamily: "var(--font-sans-stack)",
          }}
          maxLength={NOTE_MAX}
        />
        <div
          className="mt-1 text-[10.5px] text-right tabular-nums"
          style={{ color: "var(--text-faint)" }}
        >
          {noteVal.length}/{NOTE_MAX}
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function BlockersStrip({
  blockers,
  unblockCount,
  filterBlocker,
  onSelectBlocker,
  onOpenDrawer,
  onToggle,
  onSaveNote,
}: {
  blockers: BlockerRow[];
  unblockCount: Record<string, number>;
  filterBlocker: string | null;
  onSelectBlocker: (id: string) => void;
  onOpenDrawer: (b: BlockerRow) => void;
  onToggle: (id: string) => void;
  onSaveNote: (id: string, n: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...blockers].sort((a, b) => {
    const aDone = a.resolvedAt ? 1 : 0;
    const bDone = b.resolvedAt ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return a.ord - b.ord;
  });

  const totalActive = blockers.filter((b) => !b.resolvedAt).length;

  return (
    <section className="mb-2">
      <header className="flex items-baseline gap-3 mb-3">
        <div
          className="text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          Blockers
        </div>
        <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          {totalActive} unresolved · gating roadmap progress
        </div>
      </header>
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((b) => (
          <BlockerCard
            key={b.id}
            blocker={b}
            unblockCount={unblockCount[b.id] ?? 0}
            isFilter={filterBlocker === b.id}
            isOpen={openId === b.id}
            onSelect={() => onSelectBlocker(b.id)}
            onOpenDetail={() => onOpenDrawer(b)}
            onToggleOpen={() => setOpenId((v) => (v === b.id ? null : b.id))}
            onResolve={() => onToggle(b.id)}
            onSaveNote={(n) => onSaveNote(b.id, n)}
          />
        ))}
      </div>
    </section>
  );
}

function BlockerCard({
  blocker,
  unblockCount,
  isFilter,
  isOpen,
  onSelect,
  onOpenDetail,
  onToggleOpen,
  onResolve,
  onSaveNote,
}: {
  blocker: BlockerRow;
  unblockCount: number;
  isFilter: boolean;
  isOpen: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  onToggleOpen: () => void;
  onResolve: () => void;
  onSaveNote: (n: string) => void;
}) {
  const [noteVal, setNoteVal] = useState(blocker.note ?? "");
  const meta = BLOCKER_KIND_META[blocker.kind] ?? BLOCKER_KIND_META.config;
  const resolved = !!blocker.resolvedAt;

  return (
    <div
      className="rounded-xl px-3.5 py-3 transition-colors"
      style={{
        background: resolved ? "var(--bg)" : "var(--bg-elev)",
        border: `1px solid ${
          isFilter
            ? "var(--ink-900)"
            : resolved
              ? "var(--border-soft)"
              : "var(--border)"
        }`,
        opacity: resolved ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onResolve}
          className="mt-[2px] focus:outline-none"
          aria-label={`Resolve ${blocker.title}`}
        >
          {resolved ? (
            <span
              className="inline-flex items-center justify-center rounded-md"
              style={{
                width: 16,
                height: 16,
                background: "var(--status-done)",
                color: "white",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6.2L4.8 9 10 3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : (
            <span
              className="inline-block rounded-md"
              style={{
                width: 16,
                height: 16,
                border: `1.5px solid var(--ink-400)`,
                background: "transparent",
              }}
            />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={onSelect}
            className="text-left w-full"
          >
            <div
              className="text-[12.5px] font-semibold leading-snug"
              style={{
                color: resolved ? "var(--text-faint)" : "var(--text)",
                textDecoration: resolved ? "line-through" : "none",
                textDecorationColor: "var(--ink-300)",
              }}
            >
              {blocker.title}
            </div>
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[10.5px]"
              style={{ color: "var(--text-faint)" }}
            >
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: meta.bg, color: meta.fg }}
              >
                {blocker.kind}
              </span>
              {blocker.targetDate ? (
                <span className="tabular-nums">{blocker.targetDate}</span>
              ) : null}
              {!resolved && unblockCount > 0 ? (
                <span className="ml-auto tabular-nums">
                  unblocks {unblockCount}
                </span>
              ) : null}
            </div>
          </button>
          {blocker.note ? (
            <div
              className="mt-1.5 text-[11.5px] italic"
              style={{ color: "var(--text-muted)" }}
            >
              “{blocker.note}”
            </div>
          ) : null}
          <div className="mt-1 flex items-center gap-3 text-[10.5px]">
            <button
              onClick={onToggleOpen}
              className="underline-offset-2 hover:underline"
              style={{ color: "var(--text-faint)" }}
            >
              {isOpen
                ? "hide"
                : blocker.note
                  ? "edit note"
                  : "add note · why this is here"}
            </button>
            <button
              onClick={onOpenDetail}
              className="underline-offset-2 hover:underline ml-auto"
              style={{ color: "var(--text-faint)" }}
            >
              details →
            </button>
          </div>
          <AnimatePresence>
            {isOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-2 text-[11.5px] leading-snug"
                  style={{ color: "var(--text-muted)" }}
                >
                  {blocker.description}
                </div>
                <textarea
                  value={noteVal}
                  onChange={(e) =>
                    setNoteVal(e.target.value.slice(0, NOTE_MAX))
                  }
                  onBlur={() => {
                    onSaveNote(noteVal);
                  }}
                  placeholder='one sentence — e.g. "card on file 5/10, transferring 5/12"'
                  className="mt-2 w-full text-[12px] p-2 rounded-md focus:outline-none"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    resize: "none",
                    minHeight: 44,
                    fontFamily: "var(--font-sans-stack)",
                  }}
                  maxLength={NOTE_MAX}
                />
                <div
                  className="mt-1 text-[10px] text-right tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  {noteVal.length}/{NOTE_MAX}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

function WeekSection({
  week,
  rows,
  today,
  blockers,
  onOpenDrawer,
  onToggle,
  onSaveNote,
}: {
  week: number;
  rows: RoadmapRow[];
  today: string;
  blockers: BlockerRow[];
  onOpenDrawer: (r: RoadmapRow) => void;
  onToggle: (id: string) => void;
  onSaveNote: (id: string, n: string) => void;
}) {
  const completed = rows.filter((r) => r.status === "completed").length;
  const total = rows.length;
  const pct = total ? (completed / total) * 100 : 0;
  const theme = rows[0]?.weekTheme ?? "";
  const range = rows[0]?.weekRange ?? "";
  const isWeekZero = week === 0;
  const blockerById = useMemo(
    () => new Map(blockers.map((b) => [b.id, b])),
    [blockers],
  );

  return (
    <section>
      <header className="mb-5 flex items-baseline gap-4">
        <div
          className="text-[11px] tabular-nums uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          {isWeekZero ? "Index" : `Week ${week}`}
        </div>
        <h2
          className="text-[20px] font-semibold tracking-tight"
          style={{ letterSpacing: "-0.01em" }}
        >
          {theme || (isWeekZero ? "Press · Assets · KPI" : `Week ${week}`)}
        </h2>
        <span
          className="text-[12px]"
          style={{ color: "var(--text-faint)" }}
        >
          {range}
        </span>
        <span
          className="ml-auto text-[12px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {completed}/{total}
        </span>
      </header>

      <div
        className="h-px mb-3 rounded-full overflow-hidden"
        style={{ background: "var(--border-soft)" }}
      >
        <motion.div
          className="h-full"
          style={{ background: "var(--ink-900)" }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      <ul
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border-soft)" }}
      >
        {rows.map((r, idx) => (
          <ItemRow
            key={r.id}
            row={r}
            isLast={idx === rows.length - 1}
            isToday={r.date === today}
            blocker={r.blockerId ? blockerById.get(r.blockerId) ?? null : null}
            onOpenDrawer={() => onOpenDrawer(r)}
            onToggle={() => onToggle(r.id)}
            onSaveNote={(n) => onSaveNote(r.id, n)}
          />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({
  row,
  isLast,
  isToday,
  blocker,
  onOpenDrawer,
  onToggle,
  onSaveNote,
}: {
  row: RoadmapRow;
  isLast: boolean;
  isToday: boolean;
  blocker: BlockerRow | null;
  onOpenDrawer: () => void;
  onToggle: () => void;
  onSaveNote: (n: string) => void;
}) {
  const meta = KIND_META[row.kind as Kind] ?? KIND_META.post;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteVal, setNoteVal] = useState(row.note ?? "");

  return (
    <li
      className="group relative grid gap-3 px-4 py-3 transition-colors"
      style={{
        gridTemplateColumns: "auto 84px 56px 1fr auto",
        background: row.isLaunch
          ? "color-mix(in oklab, var(--indigo-50) 60%, var(--bg-elev))"
          : isToday
            ? "color-mix(in oklab, var(--lane-doing) 30%, var(--bg-elev))"
            : "var(--bg-elev)",
        borderBottom: isLast ? "none" : "1px solid var(--border-soft)",
      }}
    >
      <button
        onClick={onToggle}
        className="self-start mt-[3px] focus:outline-none"
        aria-label={`Toggle ${row.body ?? row.format}`}
      >
        <StatusBox status={row.status} isLaunch={row.isLaunch} />
      </button>

      <div
        className="self-start mt-[2px] text-[12px] tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        {row.date ? prettyDate(row.date, undefined, true) : "—"}
        {row.day ? (
          <span
            className="ml-1.5"
            style={{ color: "var(--text-faint)" }}
          >
            {row.day}
          </span>
        ) : null}
      </div>

      <div className="self-start mt-[1px]">
        {row.channel ? (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ background: meta.pillBg, color: meta.pillFg }}
          >
            {CHANNEL_ABBREV[row.channel] ?? row.channel.slice(0, 6)}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <button
          onClick={onOpenDrawer}
          className="block text-left w-full text-[13.5px] leading-snug hover:underline underline-offset-2 decoration-1"
          style={{
            color:
              row.status === "completed"
                ? "var(--text-faint)"
                : "var(--text)",
            textDecoration:
              row.status === "completed" ? "line-through" : "none",
            textDecorationColor: "var(--ink-300)",
          }}
        >
          {row.body || row.format || row.channel}
          {row.isLaunch ? (
            <span
              className="ml-2 align-middle text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
              style={{ background: "var(--indigo-600)", color: "white" }}
            >
              launch
            </span>
          ) : null}
          {blocker && !blocker.resolvedAt ? (
            <span
              className="ml-2 align-middle text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--roadmap-red-bg)",
                color: "var(--roadmap-red-fg)",
              }}
              title={`Blocked by: ${blocker.title}`}
            >
              ⊘ {blocker.title.slice(0, 22)}
            </span>
          ) : null}
        </button>
        <div
          className="mt-1 flex items-center gap-3 text-[11.5px]"
          style={{ color: "var(--text-faint)" }}
        >
          {row.source ? <span>src · {row.source}</span> : null}
          {row.cta ? <span>cta · {row.cta}</span> : null}
          {row.postingTime ? <span>{row.postingTime}</span> : null}
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            {row.note ? "edit note" : "add note"}
          </button>
        </div>
        <AnimatePresence>
          {noteOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <textarea
                value={noteVal}
                onChange={(e) =>
                  setNoteVal(e.target.value.slice(0, NOTE_MAX))
                }
                onBlur={() => {
                  onSaveNote(noteVal);
                  setNoteOpen(false);
                }}
                placeholder='one sentence — e.g. "got 47 likes" or "slipped to Wed"'
                className="mt-2 w-full text-[13px] p-2 rounded-md focus:outline-none"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  resize: "none",
                  minHeight: 44,
                  fontFamily: "var(--font-sans-stack)",
                }}
                autoFocus
                maxLength={NOTE_MAX}
              />
              <div
                className="mt-1 text-[10px] text-right tabular-nums"
                style={{ color: "var(--text-faint)" }}
              >
                {noteVal.length}/{NOTE_MAX}
              </div>
            </motion.div>
          ) : row.note ? (
            <div
              className="mt-1.5 text-[12px] italic px-2 py-1 rounded"
              style={{ color: "var(--text-muted)", background: "var(--bg)" }}
            >
              “{row.note}”
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        className="self-start mt-[2px] text-[10px] uppercase tracking-[0.1em] tabular-nums"
        style={{ color: "var(--text-faint)" }}
      >
        {meta.label}
      </div>
    </li>
  );
}

/* ───────────────────────────────────────────────────────────── */

function ActionItemsSection({
  actions,
  blockers,
  stats,
  filterBlocker,
  onOpenDrawer,
  onCycle,
  onSaveNote,
}: {
  actions: ActionItemRow[];
  blockers: BlockerRow[];
  stats: { total: number; done: number; p0: number; p0Done: number };
  filterBlocker: string | null;
  onOpenDrawer: (a: ActionItemRow) => void;
  onCycle: (id: string) => void;
  onSaveNote: (id: string, n: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "P0" | "P1" | "P2"
  >("all");
  const [hideDone, setHideDone] = useState(false);

  const blockerById = useMemo(
    () => new Map(blockers.map((b) => [b.id, b])),
    [blockers],
  );

  const grouped = useMemo(() => {
    const filtered = actions.filter((a) => {
      if (priorityFilter !== "all" && a.priority !== priorityFilter)
        return false;
      if (hideDone && a.status === "completed") return false;
      if (filterBlocker && a.blockerId !== filterBlocker) return false;
      return true;
    });
    const map = new Map<string, ActionItemRow[]>();
    filtered.forEach((a) => {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    });
    map.forEach((arr) => arr.sort((a, b) => a.ord - b.ord));
    return map;
  }, [actions, priorityFilter, hideDone, filterBlocker]);

  return (
    <section className="mt-20">
      <header className="mb-3 flex items-baseline gap-4">
        <div
          className="text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-faint)" }}
        >
          Action items
        </div>
        <h2
          className="text-[24px] font-semibold tracking-tight"
          style={{ letterSpacing: "-0.01em" }}
        >
          Launch readiness checklist.
        </h2>
        <span
          className="ml-auto text-[12px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {stats.done}/{stats.total} ·{" "}
          <span
            style={{
              color:
                stats.p0Done === stats.p0
                  ? "var(--status-done)"
                  : "var(--roadmap-red-fg)",
            }}
          >
            P0 {stats.p0Done}/{stats.p0}
          </span>
        </span>
      </header>
      <p
        className="mb-6 text-[13.5px] max-w-[640px]"
        style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
      >
        Engineering, QA, security, mobile, accessibility, compliance — every
        thing the GTM calendar doesn&apos;t cover. P0 must close before the
        Show HN beat on 06-16. Keep notes single-sentence so the page stays
        scannable.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["all", "P0", "P1", "P2"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
            style={{
              background:
                priorityFilter === p ? "var(--ink-900)" : "transparent",
              color:
                priorityFilter === p ? "var(--ink-0)" : "var(--text-muted)",
              border: `1px solid ${priorityFilter === p ? "var(--ink-900)" : "var(--border)"}`,
            }}
          >
            {p === "all" ? "All priorities" : p}
          </button>
        ))}
        <button
          onClick={() => setHideDone((v) => !v)}
          className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
          style={{
            background: hideDone ? "var(--ink-900)" : "transparent",
            color: hideDone ? "var(--ink-0)" : "var(--text-muted)",
            border: `1px solid ${hideDone ? "var(--ink-900)" : "var(--border)"}`,
          }}
        >
          Hide done
        </button>
      </div>

      <div className="space-y-8">
        {[...grouped.entries()].map(([category, rows]) => {
          const cKey = category;
          const isCollapsed = collapsed[cKey] ?? false;
          const cDone = rows.filter((r) => r.status === "completed").length;
          return (
            <div key={category}>
              <button
                onClick={() =>
                  setCollapsed((cur) => ({ ...cur, [cKey]: !isCollapsed }))
                }
                className="w-full flex items-baseline gap-4 mb-3 group"
              >
                <h3
                  className="text-[16px] font-semibold tracking-tight"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {category}
                </h3>
                <span
                  className="text-[12px] tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  {cDone}/{rows.length}
                </span>
                <span
                  className="ml-auto text-[12px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {isCollapsed ? "expand" : "collapse"}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed ? (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden rounded-xl"
                    style={{ border: "1px solid var(--border-soft)" }}
                  >
                    {rows.map((a, idx) => (
                      <ActionItemRow
                        key={a.id}
                        row={a}
                        isLast={idx === rows.length - 1}
                        blocker={
                          a.blockerId
                            ? blockerById.get(a.blockerId) ?? null
                            : null
                        }
                        onOpenDrawer={() => onOpenDrawer(a)}
                        onToggle={() => onCycle(a.id)}
                        onSaveNote={(n) => onSaveNote(a.id, n)}
                      />
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
        {grouped.size === 0 ? (
          <div
            className="text-center py-12 text-[14px] rounded-2xl"
            style={{
              color: "var(--text-faint)",
              border: "1px dashed var(--border)",
            }}
          >
            No action items match the current filter.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ActionItemRow({
  row,
  isLast,
  blocker,
  onOpenDrawer,
  onToggle,
  onSaveNote,
}: {
  row: ActionItemRow;
  isLast: boolean;
  blocker: BlockerRow | null;
  onOpenDrawer: () => void;
  onToggle: () => void;
  onSaveNote: (n: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteVal, setNoteVal] = useState(row.note ?? "");
  const pri = PRIORITY_META[row.priority];

  return (
    <li
      className="group relative grid gap-3 px-4 py-3 transition-colors"
      style={{
        gridTemplateColumns: "auto 36px 1fr auto",
        background: "var(--bg-elev)",
        borderBottom: isLast ? "none" : "1px solid var(--border-soft)",
      }}
    >
      <button
        onClick={onToggle}
        className="self-start mt-[3px] focus:outline-none"
        aria-label={`Toggle ${row.title}`}
      >
        <StatusBox status={row.status} isLaunch={false} />
      </button>

      <div className="self-start mt-[2px]">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
          style={{ background: pri.bg, color: pri.fg }}
        >
          {pri.label}
        </span>
      </div>

      <div className="min-w-0">
        <button
          onClick={onOpenDrawer}
          className="block text-left w-full text-[13.5px] leading-snug hover:underline underline-offset-2 decoration-1"
          style={{
            color:
              row.status === "completed"
                ? "var(--text-faint)"
                : "var(--text)",
            textDecoration:
              row.status === "completed" ? "line-through" : "none",
            textDecorationColor: "var(--ink-300)",
          }}
        >
          {row.title}
          {blocker && !blocker.resolvedAt ? (
            <span
              className="ml-2 align-middle text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--roadmap-red-bg)",
                color: "var(--roadmap-red-fg)",
              }}
              title={`Blocked by: ${blocker.title}`}
            >
              ⊘ {blocker.title.slice(0, 22)}
            </span>
          ) : null}
        </button>
        {row.description ? (
          <div
            className="mt-0.5 text-[11.5px] leading-snug"
            style={{ color: "var(--text-faint)" }}
          >
            {row.description}
          </div>
        ) : null}
        <div
          className="mt-1 flex items-center gap-3 text-[11px]"
          style={{ color: "var(--text-faint)" }}
        >
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-muted)" }}
          >
            {row.note ? "edit note" : "add note"}
          </button>
        </div>
        <AnimatePresence>
          {noteOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <textarea
                value={noteVal}
                onChange={(e) =>
                  setNoteVal(e.target.value.slice(0, NOTE_MAX))
                }
                onBlur={() => {
                  onSaveNote(noteVal);
                  setNoteOpen(false);
                }}
                placeholder='one sentence — e.g. "tested via curl, 200 + valid OG"'
                className="mt-2 w-full text-[13px] p-2 rounded-md focus:outline-none"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  resize: "none",
                  minHeight: 44,
                  fontFamily: "var(--font-sans-stack)",
                }}
                autoFocus
                maxLength={NOTE_MAX}
              />
              <div
                className="mt-1 text-[10px] text-right tabular-nums"
                style={{ color: "var(--text-faint)" }}
              >
                {noteVal.length}/{NOTE_MAX}
              </div>
            </motion.div>
          ) : row.note ? (
            <div
              className="mt-1.5 text-[12px] italic px-2 py-1 rounded"
              style={{ color: "var(--text-muted)", background: "var(--bg)" }}
            >
              “{row.note}”
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        className="self-start mt-[2px] text-[10px] uppercase tracking-[0.1em] tabular-nums"
        style={{ color: "var(--text-faint)" }}
      >
        {row.category.split(" ")[0]}
      </div>
    </li>
  );
}

/* ───────────────────────────────────────────────────────────── */

function StatusBox({
  status,
  isLaunch,
}: {
  status: RoadmapStatus;
  isLaunch: boolean;
}) {
  const sz = 18;
  const ring = isLaunch ? "var(--indigo-600)" : "var(--ink-400)";
  if (status === "completed") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md"
        style={{
          width: sz,
          height: sz,
          background: "var(--status-done)",
          color: "white",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.2L4.8 9 10 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md"
        style={{
          width: sz,
          height: sz,
          background: "var(--status-progress)",
          color: "white",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle
            cx="5"
            cy="5"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="2 2"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded-md"
      style={{
        width: sz,
        height: sz,
        border: `1.5px solid ${ring}`,
        background: "transparent",
      }}
    />
  );
}

function StatusDot({ status }: { status: RoadmapStatus }) {
  const c =
    status === "completed"
      ? "var(--status-done)"
      : status === "in_progress"
        ? "var(--status-progress)"
        : "var(--ink-300)";
  return (
    <span
      className="inline-block mt-[6px] h-[7px] w-[7px] rounded-full"
      style={{ background: c }}
    />
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="flex items-center gap-3">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <motion.circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--ink-900)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: off }}
          transition={{ type: "spring", stiffness: 120, damping: 30 }}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tabular-nums">{pct}%</div>
        <div
          className="text-[11px]"
          style={{ color: "var(--text-faint)" }}
        >
          done
        </div>
      </div>
    </div>
  );
}

function CountdownPill({
  label,
  date,
  days,
  tone,
}: {
  label: string;
  date: string;
  days: number;
  tone: "indigo" | "violet";
}) {
  const past = days < 0;
  return (
    <div className="text-right leading-tight">
      <div
        className="text-[11px]"
        style={{ color: "var(--text-faint)" }}
      >
        {label} · {date.slice(5)}
      </div>
      <div
        className="text-[13.5px] font-medium tabular-nums"
        style={{
          color: past
            ? "var(--text-faint)"
            : tone === "indigo"
              ? "var(--indigo-700)"
              : "var(--roadmap-violet-fg)",
        }}
      >
        {past ? "shipped" : days === 0 ? "today" : `T-${days}`}
      </div>
    </div>
  );
}

function LaunchRow({
  label,
  date,
  time,
  days,
}: {
  label: string;
  date: string;
  time: string;
  days: number;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="font-medium" style={{ color: "var(--text)" }}>
        {label}
      </div>
      <div
        className="text-[11px]"
        style={{ color: "var(--text-faint)" }}
      >
        {date} · {time}
      </div>
      <div
        className="ml-auto tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        {days < 0 ? "shipped" : days === 0 ? "today" : `T-${days}`}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="leading-tight">
      <span
        className="text-[24px] font-semibold tabular-nums tracking-tight"
        style={{ color: accent ?? "var(--text)" }}
      >
        {value}
      </span>
      <span
        className="ml-2 text-[12px]"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </span>
    </div>
  );
}

function KindChip({
  kind,
  current,
  onClick,
}: {
  kind: "all" | Kind;
  current: "all" | Kind;
  onClick: () => void;
}) {
  const active = current === kind;
  const label = kind === "all" ? "All" : KIND_META[kind].label;
  return (
    <button
      onClick={onClick}
      className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
      style={{
        background: active ? "var(--ink-900)" : "transparent",
        color: active ? "var(--ink-0)" : "var(--text-muted)",
        border: `1px solid ${active ? "var(--ink-900)" : "var(--border)"}`,
      }}
    >
      {label}
    </button>
  );
}

/* ───────────────────────────────────────────────────────────── */

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / 86400000);
}

function prettyDate(iso: string, today?: string, short = false): string {
  if (today && iso === today) return "Today";
  if (short) {
    return iso.slice(5);
  }
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
