"use client";

import { useId, useRef, useState, useEffect, useSyncExternalStore, useTransition } from "react";
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
import { createRetainedSubmission } from "@/lib/onboarding/retained-submission";
import type { UpdateSegmentInput } from "@/server/actions/onboarding";
import { updateSegmentAction } from "@/server/actions/onboarding";
import { TASKS_PUBLIC_DOMAIN } from "@/lib/product-urls";
import { SectionHeader } from "../settings-app";
import { formatCents, isProjectCurrency, PROJECT_CURRENCIES } from "@/lib/money";
import {
  setProjectBudgetAction,
  setProjectCurrencyAction,
} from "@/server/actions/settings";
import type { SettingsWorkspace } from "../settings-app";
import {
  Badge,
  Callout,
  DialogBody,
  Hint,
  Select,
  SettingsGroup,
  SettingsRow,
  cx,
  ui,
} from "../settings-ui";

const DOMAIN_IDS = new Set<DomainId>(DOMAIN_ORDER);

function isDomainId(s: string | null | undefined): s is DomainId {
  return !!s && DOMAIN_IDS.has(s as DomainId);
}

const subscribeNever = () => () => {};

function fmtDate(iso: string | null, serverSnapshot = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(serverSnapshot ? "en-IE" : undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(serverSnapshot ? { timeZone: "UTC" } : {}),
  });
}

export function WorkspaceSection({
  workspace,
  myRole,
}: {
  workspace: SettingsWorkspace | null;
  myRole: "owner" | "member" | "none";
}) {
  // Both server rendering and the first hydration pass use the same locale
  // and timezone. Afterwards the client snapshot honours the viewer's locale.
  const createdDate = useSyncExternalStore(
    subscribeNever,
    () => fmtDate(workspace?.createdAt ?? null),
    () => fmtDate(workspace?.createdAt ?? null, true),
  );
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
  const [failedSegment, setFailedSegment] = useState<Omit<UpdateSegmentInput, "requestId"> | null>(null);
  const segmentSubmissions = useRef<ReturnType<typeof createRetainedSubmission<Omit<UpdateSegmentInput, "requestId">>> | null>(null);
  useEffect(() => {
    if (!workspace?.id) return;
    const controller = createRetainedSubmission<Omit<UpdateSegmentInput, "requestId">>(workspace.id);
    segmentSubmissions.current = controller;
    return () => controller.dispose();
  }, [workspace?.id]);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = myRole === "owner";
  const [currencyValue, setCurrencyValue] = useState<string | null>(workspace?.currency ?? null);
  const [budgetValue, setBudgetValue] = useState<number | null>(workspace?.budgetCents ?? null);
  const [budgetDraft, setBudgetDraft] = useState(
    workspace?.budgetCents != null ? String(Math.round(workspace.budgetCents / 100)) : "",
  );
  const [moneyPending, startMoneyTransition] = useTransition();
  const ids = useId();
  const nameId = `${ids}-name`;
  const currencyId = `${ids}-currency`;
  const budgetId = `${ids}-budget`;

  function commitCurrency(raw: string) {
    const next = raw === "" ? null : raw;
    if (next !== null && !isProjectCurrency(next)) return;
    const previous = currencyValue;
    setCurrencyValue(next);
    startMoneyTransition(async () => {
      try {
        await setProjectCurrencyAction(next, workspace?.id);
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
        await setProjectBudgetAction(cents, workspace?.id);
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
        await updateWorkspaceAction({ name: trimmed, projectId: workspace?.id });
        toast("Project renamed", { tone: "success" });
      } catch (e) {
        toast("Couldn’t save", { tone: "error", body: (e as Error).message });
        setName(workspace.name);
      }
    });
  }

  function submitSegment(input: Omit<UpdateSegmentInput, "requestId">) {
    const controller = segmentSubmissions.current;
    if (!controller) return;
    setSegmentConfirm(null);
    if (input.reseed) setReseedingSegment(input.primaryUseCase);
    startTransition(async () => {
      try {
        if (await controller.run(input, updateSegmentAction)) {
          setFailedSegment(null);
          toast(`Now coordinating as ${SEGMENTS[input.primaryUseCase].label}`, {
            tone: "success",
            body: input.reseed
              ? SEGMENTS[input.primaryUseCase].templateId ? "Starter tasks added. Your existing tasks are kept." : "Board repopulated with new examples."
              : "Copy and examples will reflect your choice.",
          });
        }
      } catch {
        setFailedSegment(controller.retained() ?? input);
      } finally { setReseedingSegment(null); }
    });
  }
  function applySegment(next: PrimaryUseCase, reseed: boolean) {
    if (!workspace) return;
    submitSegment({ workspaceId: workspace.id, primaryUseCase: next, secondaryContext: workspace.secondaryContext ?? null, reseed });
  }

  function applyDomain(next: DomainId) {
    setDomainConfirm(null);
    setReseedingDomain(next);
    startTransition(async () => {
      try {
        await updateWorkspaceAction({ domain: next, projectId: workspace?.id });
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
      <div>
        <SectionHeader
          title="General"
          description="Name, money and starter content for this project."
        />
        <Callout>This project could not be loaded. Refresh the page to try again.</Callout>
      </div>
    );
  }

  const segmentLocked = failedSegment?.workspaceId === workspace.id;
  const nameStatus = pending
    ? "Saving…"
    : canEdit
      ? "Saves when you press Enter or click away."
      : "Only the owner can rename it.";
  const budgetStatus = moneyPending
    ? "Saving…"
    : budgetValue != null
      ? `Budget ${formatCents(budgetValue, currencyValue)}`
      : canEdit
        ? "Blank means no budget line."
        : "Only the owner can change this.";

  return (
    <div>
      <SectionHeader
        title="General"
        description="Name, money and starter content for this project."
      />

      <SettingsGroup>
        <SettingsRow
          label="Name"
          htmlFor={nameId}
          description="Shown in the sidebar, on share links and in the daily digest."
        >
          <div className="flex w-full flex-col gap-1.5 sm:w-[300px]">
            <input
              id={nameId}
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
              aria-describedby={`${nameId}-status`}
              className={ui.input}
            />
            <Hint id={`${nameId}-status`}>{nameStatus}</Hint>
          </div>
        </SettingsRow>
      </SettingsGroup>

      {/* Money, narrowly (T·124): one currency label and one operator
          budget. Restated and summed against in the brief; never
          computed from; never on share, print, embed or the public
          page. */}
      <SettingsGroup
        title="Money"
        description="The brief restates what you enter and how much of the board it covers, nothing more."
      >
        <SettingsRow
          label="Currency"
          htmlFor={currencyId}
          description="One currency for this project."
        >
          <Select
            id={currencyId}
            wrapperClassName="w-full sm:w-[300px]"
            disabled={!canEdit || moneyPending}
            onChange={(event) => commitCurrency(event.target.value)}
            value={currencyValue ?? ""}
          >
            <option value="">USD (default)</option>
            {PROJECT_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </Select>
        </SettingsRow>
        <SettingsRow
          label="Budget"
          htmlFor={budgetId}
          description="The amount you are working to, in whole units."
        >
          <div className="flex w-full flex-col gap-1.5 sm:w-[300px]">
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11.5px] text-[color:var(--v3-text-3)]"
              >
                {currencyValue ?? "USD"}
              </span>
              <input
                id={budgetId}
                className={cx(ui.input, "pl-[46px] tabular-nums")}
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
                placeholder="No budget"
                aria-describedby={`${budgetId}-status`}
                value={budgetDraft}
              />
            </div>
            <Hint id={`${budgetId}-status`}>{budgetStatus}</Hint>
          </div>
        </SettingsRow>
      </SettingsGroup>

      {segmentLocked && failedSegment ? (
        <div className="mt-[32px]">
          <Callout tone="warning" role="alert">
            <p className="font-medium text-[color:var(--v3-text)]">We couldn’t confirm this change.</p>
            {failedSegment.reseed && !SEGMENTS[failedSegment.primaryUseCase].templateId ? (
              <>
                <p className="mt-1.5">Check your project before starting this pack again. Retrying a reset could replace your work.</p>
                <details className="mt-3 text-[12px] text-[color:var(--v3-text-2)]"><summary className="cursor-pointer">Setup details for recovery</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11.5px]">{JSON.stringify({ version: 1, ...failedSegment }, null, 2)}</pre></details>
              </>
            ) : (
              <>
                <p className="mt-1.5">Try the same change again. Any starter tasks already added will be kept.</p>
                <button type="button" disabled={pending} onClick={() => submitSegment(failedSegment)} className={cx(ui.primary, "mt-3")}>{pending ? "Checking change…" : "Try again"}</button>
              </>
            )}
          </Callout>
        </div>
      ) : null}

      {/* Coordination type */}
      <SettingsGroup
        bare
        title="What you’re coordinating"
        description="Changes the copy and suggested examples. You choose whether your tasks stay when you switch."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {SEGMENT_ORDER.map((id) => {
            const seg = SEGMENTS[id];
            return (
              <OptionCard
                key={id}
                label={seg.label}
                description={seg.description}
                active={currentSegment === id}
                working={reseedingSegment === id ? "Updating…" : null}
                canEdit={canEdit}
                disabled={!canEdit || pending || currentSegment === id || segmentLocked}
                onClick={() => setSegmentConfirm(id)}
              />
            );
          })}
        </div>
      </SettingsGroup>

      {/* Domain pack */}
      <SettingsGroup
        bare
        title="Starter pack"
        description="Switching packs deletes every task in this project and adds the new starter set. Only do this before real work starts."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {DOMAIN_ORDER.map((id) => {
            const pack = DOMAINS[id];
            return (
              <OptionCard
                key={id}
                label={pack.label}
                description={pack.description}
                active={isDomainId(currentDomain) && currentDomain === id}
                working={reseedingDomain === id ? "Reseeding…" : null}
                canEdit={canEdit}
                disabled={!canEdit || pending || (isDomainId(currentDomain) && currentDomain === id) || segmentLocked}
                onClick={() => setDomainConfirm(id)}
              />
            );
          })}
        </div>
      </SettingsGroup>

      {/* Publish */}
      <PublishBlock
        workspace={workspace}
        canEdit={canEdit}
      />

      {/* Metadata */}
      <SettingsGroup
        title="Details"
        description="For the record. None of this can be edited."
      >
        <dl className="divide-y divide-[color:var(--v3-border)]">
          <Meta label="Project ID" value={workspace.id} mono />
          <Meta label="URL slug" value={workspace.slug} mono />
          <Meta label="Created" value={createdDate} />
        </dl>
      </SettingsGroup>

      <Dialog
        open={segmentConfirm !== null}
        onClose={() => setSegmentConfirm(null)}
        labelledBy="segment-confirm-title"
        width={440}
      >
        <DialogBody
          titleId="segment-confirm-title"
          title={<>Switch to {segmentConfirm ? SEGMENTS[segmentConfirm].label : ""}?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => setSegmentConfirm(null)}
                className={ui.ghost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  segmentConfirm && applySegment(segmentConfirm, false)
                }
                className={ui.button}
              >
                Update only
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  segmentConfirm && applySegment(segmentConfirm, true)
                }
                className={ui.primary}
              >
                Re-seed project
              </button>
            </>
          }
        >
          Update only changes copy and examples. {segmentConfirm && SEGMENTS[segmentConfirm].templateId
            ? "Re-seed adds another set of starter tasks and keeps your existing tasks."
            : "Re-seed replaces tasks with new starters for this coordination type."}
        </DialogBody>
      </Dialog>

      <Dialog
        open={domainConfirm !== null}
        onClose={() => setDomainConfirm(null)}
        labelledBy="domain-confirm-title"
        width={440}
      >
        <DialogBody
          titleId="domain-confirm-title"
          tone="warning"
          title={<>Re-seed with the {domainConfirm ? DOMAINS[domainConfirm].label : ""} pack?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => setDomainConfirm(null)}
                className={ui.button}
              >
                Keep what I have
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => domainConfirm && applyDomain(domainConfirm)}
                className={ui.dangerSolid}
              >
                {reseedingDomain ? "Reseeding…" : "Re-seed it"}
              </button>
            </>
          }
        >
          This deletes every task, comment and activity in this project and
          adds the new starter pack. Members and billing are not affected.
        </DialogBody>
      </Dialog>
    </div>
  );
}

function OptionCard({
  label,
  description,
  active,
  working,
  canEdit,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  working: string | null;
  canEdit: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      onClick={onClick}
      className={cx(
        "group flex min-h-[72px] w-full flex-col items-start rounded-[var(--v3-radius-lg)] border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-150 disabled:cursor-not-allowed focus-visible:rounded-[var(--v3-radius-lg)]!",
        working
          ? "border-[color:color-mix(in_srgb,var(--v3-accent)_55%,transparent)] bg-[var(--v3-accent-soft)]"
          : active
            ? "border-[color:var(--v3-accent)] bg-[color-mix(in_srgb,var(--v3-accent)_6%,var(--v3-surface))] shadow-[0_0_0_1px_var(--v3-accent)]"
            : canEdit
              ? "border-[color:var(--v3-border)] bg-[var(--v3-surface)] shadow-[var(--v3-shadow-1)] hover:border-[color:var(--v3-border-strong)]"
              : "border-[color:var(--v3-border)] bg-[var(--v3-sunken)] opacity-70",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[color:var(--v3-text)]">{label}</span>
        {working ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[color:var(--v3-accent)]">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--v3-accent)]" />
            {working}
          </span>
        ) : active ? (
          <Badge tone="accent">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
            Active
          </Badge>
        ) : null}
      </span>
      <span className="mt-1 text-[12px] leading-[1.45] text-[color:var(--v3-text-2)]">
        {description}
      </span>
    </button>
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
        await publishWorkspaceAction(workspace.id);
        toast("Project published", {
          tone: "success",
          body: "Anyone with the link can read it. Search engines are asked not to list it.",
        });
      } catch (e) {
        toast("Couldn’t publish", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function unpublish() {
    startTransition(async () => {
      try {
        await unpublishWorkspaceAction(workspace.id);
        toast("Project unpublished", {
          tone: "info",
          body: "The public link returns 404 again.",
        });
      } catch (e) {
        toast("Couldn’t unpublish", {
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
      toast("Couldn’t copy", { tone: "error" });
    }
  }

  return (
    <SettingsGroup
      title="Publish to the web"
      description={
        <>
          A read-only copy of this project at{" "}
          <code className={ui.code}>{TASKS_PUBLIC_DOMAIN}/p/{workspace.slug}</code>.
          Anyone with the link can see your tasks and lanes, with no sign-in.
          It looks like a website, not the app.
        </>
      }
    >
      {isPublished ? (
        <>
          <SettingsRow
            label="Published"
            meta={<Badge tone="success">Live</Badge>}
            description={`Public since ${fmtDate(workspace.publishedAt)}.`}
          >
            <button
              type="button"
              onClick={unpublish}
              disabled={!canEdit || pending}
              className={ui.danger}
            >
              {pending ? "Unpublishing…" : "Unpublish"}
            </button>
          </SettingsRow>
          <SettingsRow
            label="Public link"
            description={<code className={cx(ui.code, "break-all")}>/p/{workspace.slug}</code>}
          >
            <button
              type="button"
              onClick={copyLink}
              disabled={pending}
              className={ui.button}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`/p/${workspace.slug}`}
              target="_blank"
              rel="noreferrer"
              className={ui.button}
            >
              Open
            </a>
          </SettingsRow>
        </>
      ) : (
        <>
          {/* D-033 (R-031 option B) requires the publish confirmation to state
              plainly what publishing does. Until 2026-08-03 this was one button
              whose caption never mentioned search engines or what ends up on
              the page. Every line below is a fact about the shipped behaviour;
              none of it sells the feature. */}
          <div className="px-4 py-4 md:px-5">
            <p className="text-[13px] font-medium text-[color:var(--v3-text)]">Before you publish</p>
            <ul className="mt-2 space-y-1.5 text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
              {[
                "Anyone who has the link can open the page. There is no sign-in and no account.",
                "Your task titles and tags are on the page. Any names you wrote into them are on the page too.",
                "Search engines are asked not to list this page. That is a request they usually honour, not a lock.",
                "You can unpublish whenever you want. The link then returns a not-found page. Copies other people already saved stay with them.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--v3-text-3)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <SettingsRow
            label="Private"
            meta={<Badge>Members only</Badge>}
            description="This project is private. Only members can see it."
          >
            <button
              type="button"
              onClick={publish}
              disabled={!canEdit || pending}
              className={ui.button}
            >
              {pending ? "Publishing…" : "Publish project"}
            </button>
          </SettingsRow>
        </>
      )}

      {!canEdit ? (
        <div className="px-4 py-3 md:px-5">
          <Hint>Only the owner can publish or unpublish.</Hint>
        </div>
      ) : null}
    </SettingsGroup>
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
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-5">
      <dt className="text-[13px] text-[color:var(--v3-text-2)]">
        {label}
      </dt>
      <dd
        className={
          "min-w-0 text-[13px] text-[color:var(--v3-text)] sm:text-right " +
          (mono ? "break-all font-mono text-[12.5px]" : "tabular-nums")
        }
      >
        {value}
      </dd>
    </div>
  );
}
