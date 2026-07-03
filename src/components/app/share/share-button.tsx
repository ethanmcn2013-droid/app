"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  createShareLinkAction,
  listShareLinkAnalyticsAction,
  listShareLinksAction,
  revokeShareLinkAction,
  type ShareLinkAnalyticsSummary,
  type ShareLinkSummary,
  type ShareMode,
  type ShareView,
} from "@/server/actions/share";

const EXPIRY_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: "1 day", days: 1 },
  { label: "1 week", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Never", days: null },
];

const MODE_OPTIONS: Array<{
  mode: ShareMode;
  label: string;
  body: string;
}> = [
  {
    mode: "view",
    label: "View only",
    body: "Read-only. Edits prompt sign-up.",
  },
  {
    mode: "comment",
    label: "Comment",
    body: "Guests can drop comments without signing in.",
  },
  {
    mode: "edit",
    label: "Edit",
    body: "Full collaborator. Best for trusted invitees.",
  },
];

/**
 * Item 6, Share is now a first-class surface, not a secondary action.
 * The trigger label is unchanged ("Share") but the popover leads with
 * reassuring copy: anyone with the link can read, no account needed.
 * The "Generate magic link" CTA is the primary action; the mode/expiry
 * options are still there for power users but the default (view, 7 days)
 * covers 90% of sharing intent without any configuration.
 */
export function ShareButton({ view }: { view: ShareView }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "manage">("new");
  const [expiryDays, setExpiryDays] = useState<number | null>(7);
  const [mode, setMode] = useState<ShareMode>("view");
  const [label, setLabel] = useState("");

  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<ShareLinkSummary[] | null>(null);
  const [analytics, setAnalytics] = useState<
    ShareLinkAnalyticsSummary[] | null
  >(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside / Esc dismissal.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Refresh list when tab → manage. Pulls analytics in parallel so
  // the row sparklines and the "most-clicked" callout render in the
  // same paint as the link rows.
  const refreshLinks = useCallback(() => {
    startTransition(async () => {
      try {
        const [list, stats] = await Promise.all([
          listShareLinksAction(),
          listShareLinkAnalyticsAction(),
        ]);
        setLinks(list);
        setAnalytics(stats);
      } catch (e) {
        console.warn("share: list failed", e);
        setLinks([]);
        setAnalytics([]);
      }
    });
  }, []);
  useEffect(() => {
    if (open && tab === "manage") refreshLinks();
  }, [open, tab, refreshLinks]);

  const url =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/share/${token}`
      : "";

  function generate() {
    startTransition(async () => {
      try {
        const { token: t } = await createShareLinkAction({
          view,
          mode,
          expiresInDays: expiryDays,
          label: label.trim() || undefined,
        });
        setToken(t);
      } catch (e) {
        console.warn("share: generate failed", e);
      }
    });
  }

  function copy() {
    if (!url || !navigator.clipboard) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1100);
  }

  function reset() {
    setToken(null);
    setLabel("");
    setMode("view");
    setExpiryDays(7);
  }

  const revoke = (t: string) => {
    startTransition(async () => {
      try {
        await revokeShareLinkAction(t);
        refreshLinks();
      } catch (e) {
        console.warn("share: revoke failed", e);
      }
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* Item 6: prominent Share trigger, indigo-accented ring so it
          reads as the primary collaborative action in the header row. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand-soft px-2.5 py-1.5 text-[12px] font-medium text-brand transition-colors hover:border-brand/50 hover:bg-brand-soft"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-line-soft bg-white shadow-[0_18px_42px_-18px_rgba(20,21,26,0.32)]"
          >
            <div className="flex border-b border-line-soft bg-bg-sunken/30 px-1.5 pt-1.5">
              <TabButton
                active={tab === "new"}
                onClick={() => setTab("new")}
              >
                New link
              </TabButton>
              <TabButton
                active={tab === "manage"}
                onClick={() => setTab("manage")}
              >
                Manage
              </TabButton>
            </div>

            {tab === "new" ? (
              <div className="p-4">
                {token ? (
                  <ShareSuccess
                    url={url}
                    copied={copied}
                    onCopy={copy}
                    onReset={reset}
                    expiry={
                      expiryDays
                        ? `${expiryDays}d`
                        : "no expiry"
                    }
                    mode={mode}
                  />
                ) : (
                  <NewLinkForm
                    label={label}
                    onLabel={setLabel}
                    mode={mode}
                    onMode={setMode}
                    expiryDays={expiryDays}
                    onExpiryDays={setExpiryDays}
                    onGenerate={generate}
                    pending={pending}
                  />
                )}
              </div>
            ) : (
              <div className="max-h-[440px] overflow-y-auto p-2">
                <ManageList
                  links={links}
                  analytics={analytics}
                  pending={pending}
                  onRevoke={revoke}
                />
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-t-md px-3 py-1.5 text-[12px] font-medium transition-colors " +
        (active
          ? "bg-white text-ink shadow-[0_-1px_0_var(--line-soft)_inset]"
          : "text-ink-quiet hover:text-ink-soft")
      }
    >
      {children}
    </button>
  );
}

function NewLinkForm({
  label,
  onLabel,
  mode,
  onMode,
  expiryDays,
  onExpiryDays,
  onGenerate,
  pending,
}: {
  label: string;
  onLabel: (s: string) => void;
  mode: ShareMode;
  onMode: (m: ShareMode) => void;
  expiryDays: number | null;
  onExpiryDays: (d: number | null) => void;
  onGenerate: () => void;
  pending: boolean;
}) {
  return (
    <div>
      {/* Item 6: reassuring entry copy, "no account needed" is the key
          trust signal. Plain language, calm tone per Signal brand voice. */}
      <p className="text-[12.5px] leading-[1.55] text-ink-soft">
        Share this board with anyone, they can open it straight away, no
        account needed. Set how much they can do, then copy the link.
      </p>

      <Field label="Label (optional)">
        <input
          type="text"
          value={label}
          onChange={(e) => onLabel(e.target.value)}
          placeholder="e.g. Photographer preview"
          className="block w-full rounded-md border border-line-soft bg-white px-2 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-ink-soft/30 focus:outline-none"
        />
      </Field>

      <Field label="Guest can">
        <div className="grid gap-1">
          {MODE_OPTIONS.map((opt) => {
            const active = opt.mode === mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onMode(opt.mode)}
                className={
                  "flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors " +
                  (active
                    ? "border-brand bg-brand-soft/40"
                    : "border-line-soft hover:border-ink-soft/30")
                }
              >
                <span
                  className={
                    "mt-0.5 inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border " +
                    (active ? "border-brand bg-brand" : "border-line")
                  }
                >
                  {active ? (
                    <span className="block h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="flex-1">
                  <span className="block text-[12.5px] font-medium text-ink">
                    {opt.label}
                  </span>
                  <span className="block text-[11px] leading-[1.4] text-ink-soft">
                    {opt.body}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Expires in">
        <div className="flex flex-wrap gap-1">
          {EXPIRY_OPTIONS.map((opt) => {
            const active = opt.days === expiryDays;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => onExpiryDays(opt.days)}
                className={
                  "rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors " +
                  (active
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-soft hover:border-ink-soft/30 hover:text-ink")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      <button
        type="button"
        onClick={onGenerate}
        disabled={pending}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[12.5px] font-medium text-white transition-transform hover:-translate-y-px disabled:opacity-60"
      >
        {pending ? "Creating link…" : "Get a shareable link"}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      {children}
    </div>
  );
}

function ShareSuccess({
  url,
  copied,
  onCopy,
  onReset,
  expiry,
  mode,
}: {
  url: string;
  copied: boolean;
  onCopy: () => void;
  onReset: () => void;
  expiry: string;
  mode: ShareMode;
}) {
  return (
    <div>
      {/* Item 6: reassurance first. The key fact, no account needed, is
          the main anxiety to resolve. Copy then details. */}
      <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
        <p className="text-[12px] font-medium text-emerald-800">
          Link ready, anyone can open it, no account needed.
        </p>
        <p className="mt-0.5 text-[11px] text-emerald-700">
          {mode === "view" ? "Read only." : mode === "comment" ? "Can comment." : "Can edit."}{" "}
          Expires: {expiry}.
        </p>
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        Your link
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-line-soft bg-bg-sunken/40 px-2 py-1.5">
        <span className="block flex-1 truncate font-mono text-[11px] text-ink-soft">
          {url}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className={
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors " +
            (copied
              ? "bg-emerald-50 text-emerald-700"
              : "bg-ink text-white hover:opacity-90")
          }
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-brand transition-colors hover:underline"
        >
          Preview as guest
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3h7v7M10 14L21 3M21 14v7H3V3h7" />
          </svg>
        </a>
        <button
          type="button"
          onClick={onReset}
          className="text-[11.5px] text-ink-quiet transition-colors hover:text-ink-soft"
        >
          Generate another
        </button>
      </div>
    </div>
  );
}

function ManageList({
  links,
  analytics,
  pending,
  onRevoke,
}: {
  links: ShareLinkSummary[] | null;
  analytics: ShareLinkAnalyticsSummary[] | null;
  pending: boolean;
  onRevoke: (token: string) => void;
}) {
  if (!links) {
    return (
      <div className="px-2 py-6 text-center text-[12px] text-ink-quiet">
        Loading links…
      </div>
    );
  }
  if (links.length === 0) {
    return (
      <div className="px-2 py-8 text-center">
        <div className="text-[13px] font-medium text-ink-soft">
          No share links yet.
        </div>
        <div className="mx-auto mt-1 max-w-[36ch] text-[11.5px] leading-[1.5] text-ink-faint">
          Generate one in the New link tab and it&rsquo;ll show up here.
        </div>
      </div>
    );
  }

  // Build a fast lookup: token → analytics row.
  const statsByToken = new Map<string, ShareLinkAnalyticsSummary>();
  for (const s of analytics ?? []) statsByToken.set(s.token, s);

  // Active links power the workspace-total and most-clicked callout —
  // expired/revoked links would skew the "what's pulling traffic"
  // signal even though their lifetime visits are still real.
  const activeLinks = links.filter((l) => {
    if (l.revokedAt) return false;
    if (l.expiresAt && new Date(l.expiresAt) < new Date()) return false;
    return true;
  });
  const totalVisits = activeLinks.reduce(
    (sum, l) => sum + (statsByToken.get(l.token)?.total ?? l.visits),
    0,
  );
  const champion = pickMostClicked(activeLinks, statsByToken);

  return (
    <div>
      <WorkspaceTotal
        total={totalVisits}
        activeCount={activeLinks.length}
      />
      {champion ? <MostClickedCallout link={champion.link} visits={champion.visits} /> : null}
      <ul className="mt-1.5 space-y-1.5">
        {links.map((l) => (
          <ShareLinkRow
            key={l.token}
            link={l}
            stats={statsByToken.get(l.token) ?? null}
            pending={pending}
            onRevoke={onRevoke}
          />
        ))}
      </ul>
    </div>
  );
}

function WorkspaceTotal({
  total,
  activeCount,
}: {
  total: number;
  activeCount: number;
}) {
  const visitWord = total === 1 ? "visit" : "visits";
  const linkWord = activeCount === 1 ? "link" : "links";
  return (
    <div className="rounded-lg border border-line-soft bg-bg-sunken/30 px-3 py-2.5">
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[22px] font-semibold leading-none tracking-tight"
          style={{ color: "var(--brand)" }}
        >
          {total}
        </span>
        <span className="text-[11.5px] text-ink-soft">
          {visitWord} across {activeCount} active {linkWord}.
        </span>
      </div>
      <div className="mt-1 text-[10.5px] text-ink-quiet">
        {total === 0
          ? "Nothing to see yet, your links are still warming up."
          : "Tracked since you minted the first link."}
      </div>
    </div>
  );
}

function MostClickedCallout({
  link,
  visits,
}: {
  link: ShareLinkSummary;
  visits: number;
}) {
  const name = link.label ?? `${link.view} · ${link.mode}`;
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
      style={{
        borderColor: "color-mix(in srgb, var(--brand) 22%, transparent)",
        background:
          "color-mix(in srgb, var(--brand) 6%, white)",
      }}
    >
      <span
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, var(--brand-hi) 100%)",
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l2.39 7.36H22l-6.18 4.49L18.21 22 12 17.27 5.79 22l2.39-8.15L2 9.36h7.61z" />
        </svg>
      </span>
      <span className="flex-1 text-[11.5px] leading-tight text-ink-soft">
        <span className="font-medium text-ink">{name}</span> drew the most eyes —{" "}
        <span className="font-medium" style={{ color: "var(--brand)" }}>
          {visits} {visits === 1 ? "visit" : "visits"}
        </span>
        .
      </span>
    </div>
  );
}

/**
 * "Most clicked" only fires when ≥3 links exist and one link's
 * total is more than 2× the median, otherwise the call-out is
 * just noise (tiny sample, no real outlier).
 */
function pickMostClicked(
  links: ShareLinkSummary[],
  stats: Map<string, ShareLinkAnalyticsSummary>,
): { link: ShareLinkSummary; visits: number } | null {
  if (links.length < 3) return null;
  const totals = links.map(
    (l) => stats.get(l.token)?.total ?? l.visits,
  );
  if (totals.every((n) => n === 0)) return null;
  const median = computeMedian(totals);
  if (median <= 0) {
    // Median is zero, fall back to "any link with > 0 visits" so
    // the very first hit on a fresh workspace is still surfaced.
    const idx = totals.indexOf(Math.max(...totals));
    if (totals[idx] < 2) return null;
    return { link: links[idx], visits: totals[idx] };
  }
  const max = Math.max(...totals);
  if (max <= median * 2) return null;
  const idx = totals.indexOf(max);
  return { link: links[idx], visits: max };
}

function computeMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function ShareLinkRow({
  link,
  stats,
  pending,
  onRevoke,
}: {
  link: ShareLinkSummary;
  stats: ShareLinkAnalyticsSummary | null;
  pending: boolean;
  onRevoke: (token: string) => void;
}) {
  const status = link.revokedAt
    ? "revoked"
    : link.expiresAt && new Date(link.expiresAt) < new Date()
      ? "expired"
      : "active";
  const dotColor =
    status === "active"
      ? "#10b981"
      : status === "expired"
        ? "#d97706"
        : "#94a3b8";
  const expiryLabel = link.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "never";
  const visits = stats?.total ?? link.visits;
  const lastVisitedAt = stats?.lastVisitedAt ?? null;
  const sparkValues = stats?.last7 ?? [0, 0, 0, 0, 0, 0, 0];

  return (
    <li className="rounded-md border border-line-soft bg-white px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span
          className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        <span className="flex-1 truncate text-[12.5px] text-ink">
          {link.label ?? `${link.view} · ${link.mode}`}
        </span>
        <VisitBars values={sparkValues} />
        {status === "active" ? (
          <RevokeButton
            token={link.token}
            onRevoke={onRevoke}
            pending={pending}
          />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            {status}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-quiet">
        <span>{link.view}</span>
        <span>·</span>
        <span>{link.mode}</span>
        {visits === 0 && status === "active" ? (
          <>
            <span>·</span>
            <span>0 visits · waiting on its first guest</span>
          </>
        ) : (
          <>
            <span>·</span>
            <span>
              {visits} {visits === 1 ? "visit" : "visits"}
            </span>
            {lastVisitedAt ? (
              <>
                <span>·</span>
                <span>last {formatRelative(lastVisitedAt)}</span>
              </>
            ) : null}
            <span>·</span>
            <span>
              {link.expiresAt ? `expires ${expiryLabel}` : "no expiry"}
            </span>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * 60×16 inline bar sparkline. The shared `Sparkline` primitive draws
 * an area chart, which reads as "trend", we want "per-day count" so
 * a row of bars is more honest. Empty buckets render as a faint
 * baseline tick so the strip doesn't disappear on a fresh link.
 */
function VisitBars({ values }: { values: number[] }) {
  const width = 60;
  const height = 16;
  const max = Math.max(...values, 1);
  const slot = width / values.length;
  const barWidth = Math.max(slot - 1.5, 1.5);
  return (
    <svg
      width={width}
      height={height}
      className="flex-shrink-0"
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const x = i * slot + (slot - barWidth) / 2;
        const h = v === 0 ? 1.2 : Math.max(2, (v / max) * (height - 2));
        const y = height - h;
        const empty = v === 0;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={0.8}
            fill={empty ? "var(--line)" : "var(--brand)"}
            opacity={empty ? 0.6 : 0.85 - (values.length - 1 - i) * 0.04}
          />
        );
      })}
    </svg>
  );
}

/**
 * Two-step revoke: first click arms a 4-second window with red
 * "Confirm revoke?" copy; second click within the window fires.
 * Outside-click and timeout both cancel, feels like the GitHub
 * "delete repository" pattern but with a tighter timer because
 * link-revocation is recoverable (re-mint).
 */
function RevokeButton({
  token,
  onRevoke,
  pending,
}: {
  token: string;
  onRevoke: (token: string) => void;
  pending: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel after 4s.
  useEffect(() => {
    if (!armed) return;
    timerRef.current = setTimeout(() => setArmed(false), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [armed]);

  // Outside-click cancels.
  useEffect(() => {
    if (!armed) return;
    function handle(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setArmed(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [armed]);

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    onRevoke(token);
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors disabled:opacity-60 " +
        (armed
          ? "bg-rose-600 text-white hover:bg-rose-700"
          : "text-rose-600 hover:bg-rose-50")
      }
    >
      {armed ? "Confirm revoke?" : "Revoke"}
    </button>
  );
}

/**
 * Compact "3h ago" / "12m ago" / "2d ago" formatter. Falls back to a
 * short date when the visit is older than a week, at that point the
 * sparkline already dropped its bar so the stamp's job is just to
 * say "stale".
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
