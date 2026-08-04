"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  publishWorkspaceAction,
  unpublishWorkspaceAction,
  updateWorkspaceAction,
} from "@/server/actions/settings";
import { DOMAINS, DOMAIN_ORDER, type DomainId } from "@/lib/domains";
import {
  SEGMENTS,
  SEGMENT_ORDER,
  isPrimaryUseCase,
  type PrimaryUseCase,
} from "@/lib/onboarding/segments";
import { updateSegmentAction } from "@/server/actions/onboarding";
import { TASKS_PUBLIC_DOMAIN } from "@/lib/product-urls";
import { SectionHeader } from "../settings-app";
import { formatCents, isProjectCurrency, PROJECT_CURRENCIES } from "@/lib/money";
import {
  setProjectBudgetAction,
  setProjectCurrencyAction,
} from "@/server/actions/settings";
import type { SettingsWorkspace } from "../settings-app";

const DOMAIN_IDS = new Set<DomainId>(DOMAIN_ORDER);

function isDomainId(s: string | null | undefined): s is DomainId {
  return !!s && DOMAIN_IDS.has(s as DomainId);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function WorkspaceSection({
  workspace,
  myRole,
}: {
  workspace: SettingsWorkspace | null;
  myRole: "owner" | "member" | "none";
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  // Track which pack is actively reseeding so the card itself shows
  // "Reseeding…" rather than relying on a shared pending flag that
  // the name-save transition also uses. Cleared on success or error.
  const [reseedingDomain, setReseedingDomain] = useState<DomainId | null>(null);
  const [name, setName] = useState(workspace?.name ?? "");
  const [previousName, setPreviousName] = useState(workspace?.name);
  const [domainConfirm, setDomainConfirm] = useState<DomainId | null>(null);
  const [segmentConfirm, setSegmentConfirm] = useState<PrimaryUseCase | null>(
    null,
  );
  const [reseedingSegment, setReseedingSegment] = useState<PrimaryUseCase | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = myRole === "owner";
  const [currencyValue, setCurrencyValue] = useState<string | null>(workspace?.currency ?? null);
  const [budgetValue, setBudgetValue] = useState<number | null>(workspace?.budgetCents ?? null);
  const [budgetDraft, setBudgetDraft] = useState(
    workspace?.budgetCents != null ? String(Math.round(workspace.budgetCents / 100)) : "",
  );
  const [moneyPending, startMoneyTransition] = useTransition();

  function commitCurrency(raw: string) {
    const next = raw === "" ? null : raw;
    if (next !== null && !isProjectCurrency(next)) return;
    const previous = currencyValue;
    setCurrencyValue(next);
    startMoneyTransition(async () => {
      try {
        await setProjectCurrencyAction(next);
      } catch {
        setCurrencyValue(previous);
      }
    });
  }

  function commitBudget() {
    const trimmed = budgetDraft.trim();
    const cents = trimmed === "" ? null : Number(trimmed) * 100;
    if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
      setBudgetDraft(budgetValue != null ? String(Math.round(budgetValue / 100)) : "");
      return;
    }
    if (cents === budgetValue) return;
    const previous = budgetValue;
    setBudgetValue(cents);
    startMoneyTransition(async () => {
      try {
        await setProjectBudgetAction(cents);
      } catch {
        setBudgetValue(previous);
        setBudgetDraft(previous != null ? String(Math.round(previous / 100)) : "");
      }
    });
  }
  const currentDomain = workspace?.activeDomain;
  const currentSegment =
    workspace?.primaryUseCase && isPrimaryUseCase(workspace.primaryUseCase)
      ? workspace.primaryUseCase
      : null;

  // Keep local input in sync if a server revalidation changes the workspace.
  if (previousName !== workspace?.name) {
    setPreviousName(workspace?.name);
    setName(workspace?.name ?? "");
  }

  function commitName() {
    if (!workspace) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) return;
    startTransition(async () => {
      try {
        await updateWorkspaceAction({ name: trimmed });
        toast("Workspace renamed", { tone: "success" });
      } catch (e) {
        toast("Couldn't save", { tone: "error", body: (e as Error).message });
        setName(workspace.name);
      }
    });
  }

  function applySegment(next: PrimaryUseCase, reseed: boolean) {
    setSegmentConfirm(null);
    if (reseed) setReseedingSegment(next);
    startTransition(async () => {
      try {
        await updateSegmentAction({
          primaryUseCase: next,
          secondaryContext: workspace?.secondaryContext ?? null,
          reseed,
        });
        toast(
          reseed
            ? `Reseeded for ${SEGMENTS[next].label}`
            : `Now coordinating as ${SEGMENTS[next].label}`,
          {
            tone: "success",
            body: reseed
              ? "Board repopulated with new examples."
              : "Copy and examples will reflect your choice.",
          },
        );
      } catch (e) {
        toast("Couldn't update", {
          tone: "error",
          body: (e as Error).message,
        });
      } finally {
        setReseedingSegment(null);
      }
    });
  }

  function applyDomain(next: DomainId) {
    setDomainConfirm(null);
    setReseedingDomain(next);
    startTransition(async () => {
      try {
        await updateWorkspaceAction({ domain: next });
        toast(`Reseeded with ${DOMAINS[next].label}`, {
          tone: "success",
          body: "Board repopulated. Old tasks are gone.",
        });
      } catch (e) {
        toast("Switch failed", {
          tone: "error",
          body: (e as Error).message,
        });
      } finally {
        setReseedingDomain(null);
      }
    });
  }

  if (!workspace) {
    return (
      <div className="rounded-lg border border-line bg-bg-elevated p-6 text-[13px] text-ink-soft">
        No workspace loaded. Try refreshing.
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Workspace"
        title="The shape of your project"
        description="Rename it, swap the starter pack, or review your workspace details. Changes save instantly, no save button to forget."
      />

      <div className="space-y-4">
        {/* Name */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Name</Label>
          <Caption>What this project gets called everywhere, the header, share links, the daily digest.</Caption>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.blur();
                }
              }}
              onBlur={commitName}
              disabled={!canEdit || pending}
              className="flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-[13.5px] text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            />
            <span className="text-[11.5px] text-ink-quiet">
              {pending ? "Saving…" : canEdit ? "Tab or click out to save" : "Owner-only"}
            </span>
          </div>
        </div>

        {/* Money, narrowly (T·124): one currency label and one operator
            budget. Restated and summed against in the brief; never
            computed from; never on share, print, embed or the public
            page. */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Money</Label>
          <Caption>
            One currency for this project, and the budget you are working
            to. The brief restates what you enter and how much of the
            board it covers, nothing more.
          </Caption>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              Currency
              <select
                className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink shadow-sm focus:border-brand/60 focus:outline-none disabled:opacity-60"
                disabled={!canEdit || moneyPending}
                onChange={(event) => commitCurrency(event.target.value)}
                value={currencyValue ?? ""}
              >
                <option value="">USD (default)</option>
                {PROJECT_CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
              Budget
              <input
                className="w-36 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink shadow-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
                disabled={!canEdit || moneyPending}
                inputMode="numeric"
                onBlur={commitBudget}
                onChange={(event) => setBudgetDraft(event.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Whole amount, blank for none"
                value={budgetDraft}
              />
            </label>
            <span className="text-[11.5px] text-ink-quiet">
              {moneyPending
                ? "Saving…"
                : budgetValue != null
                  ? `Budget ${formatCents(budgetValue, currencyValue)}`
                  : canEdit
                    ? "Blank means no budget line"
                    : "Owner-only"}
            </span>
          </div>
        </div>

        {/* Coordination type */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>What you&apos;re coordinating</Label>
          <Caption>
            Changes copy and recommended examples. Choose &ldquo;update only&rdquo; to keep your tasks, or re-seed for fresh starters.
          </Caption>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SEGMENT_ORDER.map((id) => {
              const seg = SEGMENTS[id];
              const isActive = currentSegment === id;
              const isReseeding = reseedingSegment === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!canEdit || pending || isActive}
                  onClick={() => setSegmentConfirm(id)}
                  className={
                    "group rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed " +
                    (isReseeding
                      ? "border-brand/60 bg-brand-soft/40"
                      : isActive
                        ? "border-brand/40 bg-brand-soft/60"
                        : canEdit
                          ? "border-line bg-white hover:border-ink-soft/30"
                          : "border-line-soft bg-bg-sunken/30 opacity-70")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">
                      {seg.label}
                    </span>
                    {isReseeding ? (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-brand">
                        <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                        Updating…
                      </span>
                    ) : isActive ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-brand">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] leading-[1.5] text-ink-quiet">
                    {seg.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain pack */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Starter pack</Label>
          <Caption>
            Switching the pack wipes the workspace&apos;s tasks and re-seeds with the new flavor. Don&apos;t do this if you&apos;ve been working in here.
          </Caption>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DOMAIN_ORDER.map((id) => {
              const pack = DOMAINS[id];
              const isActive =
                isDomainId(currentDomain) && currentDomain === id;
              const isReseeding = reseedingDomain === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!canEdit || pending || isActive}
                  onClick={() => setDomainConfirm(id)}
                  className={
                    "group rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed " +
                    (isReseeding
                      ? "border-brand/60 bg-brand-soft/40"
                      : isActive
                        ? "border-brand/40 bg-brand-soft/60"
                        : canEdit
                          ? "border-line bg-white hover:border-ink-soft/30"
                          : "border-line-soft bg-bg-sunken/30 opacity-70")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">
                      {pack.label}
                    </span>
                    {isReseeding ? (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-brand">
                        <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                        Reseeding…
                      </span>
                    ) : isActive ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-brand">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] leading-[1.5] text-ink-quiet">
                    {pack.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Publish */}
        <PublishBlock
          workspace={workspace}
          canEdit={canEdit}
        />

        {/* Metadata */}
        <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
          <Label>Identity</Label>
          <Caption>For the record. None of this is editable.</Caption>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <Meta label="Workspace ID" value={workspace.id} mono />
            <Meta label="URL slug" value={workspace.slug} mono />
            <Meta label="Created" value={fmtDate(workspace.createdAt)} />
          </dl>
        </div>
      </div>

      <Dialog
        open={segmentConfirm !== null}
        onClose={() => setSegmentConfirm(null)}
        labelledBy="segment-confirm-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            Coordination type
          </div>
          <h3
            id="segment-confirm-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Switch to {segmentConfirm ? SEGMENTS[segmentConfirm].label : ""}?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            Update only changes copy and examples. Re-seed wipes tasks and
            loads new starters for this coordination type.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSegmentConfirm(null)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                segmentConfirm && applySegment(segmentConfirm, false)
              }
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink-soft/30"
            >
              Update only
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                segmentConfirm && applySegment(segmentConfirm, true)
              }
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-soft"
            >
              Re-seed workspace
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={domainConfirm !== null}
        onClose={() => setDomainConfirm(null)}
        labelledBy="domain-confirm-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Heads up
          </div>
          <h3
            id="domain-confirm-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Re-seed with the {domainConfirm ? DOMAINS[domainConfirm].label : ""} pack?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            This wipes every task, comment, and activity in this workspace
            and re-seeds it with the new starter pack. Members and billing
            are untouched.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDomainConfirm(null)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Keep what I have
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => domainConfirm && applyDomain(domainConfirm)}
              className="rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-60"
            >
              {reseedingDomain ? "Reseeding…" : "Re-seed it"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function PublishBlock({
  workspace,
  canEdit,
}: {
  workspace: SettingsWorkspace;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const isPublished = workspace.publishedAt !== null;

  function publish() {
    startTransition(async () => {
      try {
        await publishWorkspaceAction();
        toast("Workspace published", {
          tone: "success",
          body: "Anyone with the link can read it. Search engines are asked not to list it.",
        });
      } catch (e) {
        toast("Couldn't publish", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function unpublish() {
    startTransition(async () => {
      try {
        await unpublishWorkspaceAction();
        toast("Workspace unpublished", {
          tone: "info",
          body: "The public link returns 404 again.",
        });
      } catch (e) {
        toast("Couldn't unpublish", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${workspace.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy", { tone: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
      <Label>Publish to the web</Label>
      <Caption>
        Publishing makes a read-only version of this workspace visible
        at <code className="rounded bg-bg-sunken/80 px-1 py-0.5 text-[11.5px]">{TASKS_PUBLIC_DOMAIN}/p/{workspace.slug}</code>.
        Anyone with the link can see your tasks and lanes, no signup,
        no account. Looks like a real website, not the app.
      </Caption>

      {isPublished ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <span
              className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500"
              aria-hidden
            />
            <span className="text-[12px] font-medium text-emerald-800">
              Published {fmtDate(workspace.publishedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-line bg-white px-3 py-1.5 font-mono text-[12px] text-ink">
              /p/{workspace.slug}
            </code>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyLink}
                disabled={pending}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={`/p/${workspace.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
              >
                Open
              </a>
              <button
                type="button"
                onClick={unpublish}
                disabled={!canEdit || pending}
                className="rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
              >
                {pending ? "…" : "Unpublish"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {/* D-033 (R-031 option B) requires the publish confirmation to state
              plainly what publishing does. Until 2026-08-03 this was one button
              whose caption never mentioned search engines or what ends up on
              the page. Every line below is a fact about the shipped behaviour;
              none of it sells the feature. */}
          <div className="rounded-lg border border-line-soft bg-bg-sunken/50 px-3.5 py-3">
            <p className="text-[12px] font-medium text-ink">Before you publish</p>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-soft">
              <li>Anyone who has the link can open the page. There is no sign-in and no account.</li>
              <li>Your task titles and tags are on the page. Any names you wrote into them are on the page too.</li>
              <li>Search engines are asked not to list this page. That is a request they usually honour, not a lock.</li>
              <li>You can unpublish whenever you want. The link then returns a not-found page. Copies other people already saved stay with them.</li>
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-quiet">
              This workspace is private. Only members can see it.
            </span>
            <button
              type="button"
              onClick={publish}
              disabled={!canEdit || pending}
              className="rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-ink-soft disabled:opacity-50"
            >
              {pending ? "Publishing…" : "Publish workspace"}
            </button>
          </div>
        </div>
      )}

      {!canEdit ? (
        <p className="mt-3 text-[11.5px] text-ink-quiet">
          Only the owner can publish or unpublish.
        </p>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 max-w-[520px] text-[12.5px] leading-[1.55] text-ink-soft">
      {children}
    </p>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </dt>
      <dd
        className={
          "text-[12.5px] text-ink " +
          (mono ? "break-all font-mono" : "tabular-nums")
        }
      >
        {value}
      </dd>
    </div>
  );
}
