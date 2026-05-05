"use client";

import { USERS, type UserId } from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";

const SEED_USERS: UserId[] = ["alex", "chloe", "david", "marcus", "ada"];
const SEED_BODIES = [
  "Hero animation looks great in the latest cut 🎯",
  "Pinged finance — they'll review by EOW.",
  "Bumped this to P1 after the demo sync. Keep moving.",
  "Linking the brief — let me know if anything's unclear.",
  "Marketing has the assets. We just need the copy review.",
  "Spec is locked, building now. ETA Tuesday.",
  "Two design tweaks left, then ready for review.",
];
const SEED_TIMES = ["3h ago", "yesterday", "2d ago", "today", "this morning"];

function pick<T>(arr: T[], seed: number) {
  return arr[Math.abs(seed) % arr.length];
}

function strHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function CommentThread({ taskId }: { taskId: string }) {
  // Deterministic 3 comments per task — same id → same thread on re-open.
  const baseHash = strHash(taskId);
  const items = [0, 1, 2].map((offset) => {
    const seed = baseHash + offset * 31;
    return {
      user: pick(SEED_USERS, seed),
      body: pick(SEED_BODIES, seed * 7 + offset),
      when: pick(SEED_TIMES, seed * 13 + offset),
    };
  });

  return (
    <div className="space-y-3">
      {items.map((c, i) => {
        const u = USERS[c.user];
        return (
          <div key={i} className="flex items-start gap-2.5">
            <Avatar user={c.user} size={22} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[12.5px] font-medium text-ink">
                  {u.name}
                </span>
                <span className="text-[11px] text-ink-quiet">{c.when}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-[1.55] text-ink-soft">
                {c.body}
              </p>
            </div>
          </div>
        );
      })}
      {/* Composer placeholder — disabled in this cycle */}
      <div className="sticky bottom-0 -mx-6 mt-4 border-t border-line-soft bg-bg-elevated/95 px-6 pb-1 pt-3 backdrop-blur">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-sunken/50 px-2.5 py-1.5 text-[12.5px] text-ink-quiet">
          <Avatar user="david" size={18} />
          <span className="flex-1">Reply…</span>
          <kbd className="rounded border border-line bg-white px-1 py-0.5 text-[10px] text-ink-quiet">
            ⏎
          </kbd>
        </div>
      </div>
    </div>
  );
}
