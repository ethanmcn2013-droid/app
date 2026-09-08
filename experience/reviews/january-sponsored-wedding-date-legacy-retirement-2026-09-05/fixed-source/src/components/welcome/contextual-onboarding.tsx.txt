"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import {
  completeContextualOnboardingAction,
  savePlanningOnboardingDraftAction,
} from "@/server/actions/planning";
import type { PlanningOnboardingState } from "@/server/db/schema";
import {
  CONTEXT_TERMINOLOGY,
  DEFAULT_WORKSPACE_CONTEXT,
  type PlanningPeriodContext,
} from "@/lib/planning/context";
import { normalizeWorkspaceNames } from "@/lib/planning/input";

type Step = PlanningOnboardingState["step"];

type Draft = {
  id: string;
  revision: number;
  contextType: PlanningPeriodContext;
  state: PlanningOnboardingState;
};

const CONTEXT_OPTIONS: ReadonlyArray<{
  id: PlanningPeriodContext;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "school_year",
    eyebrow: "Teacher",
    title: "Classes across a school year",
    description: "Set up each class once. No pupil accounts or pupil data.",
  },
  {
    id: "semester",
    eyebrow: "College student",
    title: "Modules across a semester",
    description: "Each module keeps its own notes, tasks, and plan.",
  },
  {
    id: "wedding_season",
    eyebrow: "Wedding",
    title: "One private wedding workspace",
    description: "Plan towards the wedding date. Sharing stays deliberate.",
  },
  {
    id: "general",
    eyebrow: "General work",
    title: "Projects across active work",
    description: "A finite horizon without changing what your account can do.",
  },
];

export function ContextualOnboarding({
  initialContext,
  initialDraft,
  venueSponsor,
}: {
  initialContext: PlanningPeriodContext | null;
  initialDraft: Draft | null;
  venueSponsor: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [context, setContext] = useState<PlanningPeriodContext | null>(
    initialDraft?.contextType ?? initialContext,
  );
  const [step, setStep] = useState<Step>(
    initialDraft?.state.step ?? (initialContext ? "period" : "context"),
  );
  const [draftRef, setDraftRef] = useState(
    initialDraft ? { id: initialDraft.id, revision: initialDraft.revision } : null,
  );
  const [periodName, setPeriodName] = useState(
    initialDraft?.state.periodName ??
      (initialContext ? CONTEXT_TERMINOLOGY[initialContext].defaultPlanningPeriodName : ""),
  );
  const [startDate, setStartDate] = useState(initialDraft?.state.startDate ?? "");
  const [endDate, setEndDate] = useState(initialDraft?.state.endDate ?? "");
  const [timezone] = useState(initialDraft?.state.timezone ?? "Europe/Dublin");
  const [workspaceText, setWorkspaceText] = useState(
    initialDraft?.state.workspaceNames?.join("\n") ?? "",
  );
  const [primaryDate, setPrimaryDate] = useState(
    initialDraft?.state.primaryDate ?? "",
  );
  const [primaryDateLabel, setPrimaryDateLabel] = useState(
    initialDraft?.state.primaryDateLabel ?? "",
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [sponsorConsent, setSponsorConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    try {
      const result = normalizeWorkspaceNames(workspaceText);
      return {
        names: result.names.filter((name) => !removed.includes(name)),
        duplicates: result.duplicates,
      };
    } catch {
      return { names: [] as readonly string[], duplicates: [] as readonly string[] };
    }
  }, [workspaceText, removed]);

  const stateFor = (nextStep: Step): PlanningOnboardingState => ({
    step: nextStep,
    periodName: periodName || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    timezone,
    workspaceNames: preview.names,
    primaryDate: primaryDate || undefined,
    primaryDateLabel: primaryDateLabel || undefined,
  });

  const continueTo = (nextStep: Step) => {
    if (!context) return;
    setError(null);
    startTransition(async () => {
      try {
        const saved = await savePlanningOnboardingDraftAction({
          id: draftRef?.id,
          revision: draftRef?.revision,
          contextType: context,
          state: stateFor(nextStep),
        });
        setDraftRef(saved);
        setStep(nextStep);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your progress did not save.");
      }
    });
  };

  const chooseContext = (next: PlanningPeriodContext) => {
    setContext(next);
    setPeriodName(CONTEXT_TERMINOLOGY[next].defaultPlanningPeriodName);
    setWorkspaceText("");
    setRemoved([]);
    setPrimaryDate("");
    setPrimaryDateLabel(next === "wedding_season" ? "Wedding" : "");
    setStep("period");
  };

  const complete = () => {
    if (!context || preview.names.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await completeContextualOnboardingAction({
          name: periodName,
          contextType: context,
          startDate: startDate || null,
          endDate: endDate || null,
          timezone,
          workspaceNames: [...preview.names],
          workspaceContext: DEFAULT_WORKSPACE_CONTEXT[context],
          primaryDate: primaryDate || null,
          primaryDateLabel: primaryDateLabel || null,
          draftId: draftRef?.id,
          sponsor:
            venueSponsor && sponsorConsent
              ? {
                  id: venueSponsor.id,
                  consentGranted: true,
                  activationLabel: preview.names[0],
                }
              : null,
        });
        router.push("/app/your-work");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Your workspaces were not created.");
      }
    });
  };

  const activeIndex = ["context", "period", "workspaces", "review"].indexOf(step);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark size="md" />
        <p className="text-[11px] font-medium text-ink-quiet" aria-live="polite">
          Step {activeIndex + 1} of 4
        </p>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-3xl items-center px-5 py-10 sm:px-8">
        <div className="w-full">
          {step === "context" ? (
            <ContextStep onChoose={chooseContext} />
          ) : context ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  setStep(step === "review" ? "workspaces" : step === "workspaces" ? "period" : "context")
                }
                className="mb-6 min-h-10 rounded-lg px-2 text-[13px] text-ink-soft outline-none hover:bg-bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50"
              >
                ← Back
              </button>
              {step === "period" ? (
                <PeriodStep
                  context={context}
                  periodName={periodName}
                  setPeriodName={setPeriodName}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  pending={pending}
                  onContinue={() => continueTo("workspaces")}
                />
              ) : null}
              {step === "workspaces" ? (
                <WorkspaceStep
                  context={context}
                  workspaceText={workspaceText}
                  setWorkspaceText={(value) => {
                    setWorkspaceText(value);
                    setRemoved([]);
                  }}
                  primaryDate={primaryDate}
                  setPrimaryDate={setPrimaryDate}
                  primaryDateLabel={primaryDateLabel}
                  setPrimaryDateLabel={setPrimaryDateLabel}
                  names={preview.names}
                  duplicates={preview.duplicates}
                  onRemove={(name) => setRemoved((value) => [...value, name])}
                  pending={pending}
                  onContinue={() => continueTo("review")}
                />
              ) : null}
              {step === "review" ? (
                <ReviewStep
                  context={context}
                  periodName={periodName}
                  startDate={startDate}
                  endDate={endDate}
                  names={preview.names}
                  primaryDate={primaryDate}
                  venueSponsor={venueSponsor}
                  sponsorConsent={sponsorConsent}
                  setSponsorConsent={setSponsorConsent}
                  pending={pending}
                  onComplete={complete}
                />
              ) : null}
            </>
          ) : null}
          {error ? (
            <p role="alert" className="mt-5 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function ContextStep({ onChoose }: { onChoose: (context: PlanningPeriodContext) => void }) {
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">Shape your work</p>
      <h1 className="mt-3 max-w-[18ch] text-[clamp(2.1rem,7vw,4rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
        What are you planning across?
      </h1>
      <p className="mt-4 max-w-[54ch] text-[15px] leading-6 text-ink-soft">
        This changes the words and starting structure, not what your account can create later.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {CONTEXT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChoose(option.id)}
            className="min-h-32 rounded-2xl border border-line-soft bg-bg-elevated p-5 text-left outline-none transition-colors hover:border-brand/35 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">{option.eyebrow}</span>
            <span className="mt-2 block text-[16px] font-semibold tracking-[-0.015em] text-ink">{option.title}</span>
            <span className="mt-2 block text-[13px] leading-5 text-ink-soft">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PeriodStep({
  context,
  periodName,
  setPeriodName,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  pending,
  onContinue,
}: {
  context: PlanningPeriodContext;
  periodName: string;
  setPeriodName: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  pending: boolean;
  onContinue: () => void;
}) {
  const term = CONTEXT_TERMINOLOGY[context];
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">{term.planningPeriod}</p>
      <h1 className="mt-3 text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-none tracking-[-0.045em]">Name the horizon.</h1>
      <p className="mt-4 text-[14px] leading-6 text-ink-soft">Dates make elapsed time honest. You can change them later.</p>
      <div className="mt-8 grid gap-4">
        <label className="grid gap-2 text-[13px] font-medium">
          {term.planningPeriod} name
          <input value={periodName} onChange={(event) => setPeriodName(event.target.value)} required maxLength={100} placeholder={periodNamePlaceholder(context)} className="min-h-12 rounded-xl border border-line-soft bg-bg-elevated px-4 text-[15px] outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-[13px] font-medium">Starts<input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-h-12 rounded-xl border border-line-soft bg-bg-elevated px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand/20" /></label>
          <label className="grid gap-2 text-[13px] font-medium">Ends<input type="date" required value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-h-12 rounded-xl border border-line-soft bg-bg-elevated px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand/20" /></label>
        </div>
      </div>
      <PrimaryButton disabled={pending || !periodName.trim() || !startDate || !endDate || startDate > endDate} onClick={onContinue} label={pending ? "Saving…" : "Continue"} />
    </section>
  );
}

function WorkspaceStep({
  context,
  workspaceText,
  setWorkspaceText,
  primaryDate,
  setPrimaryDate,
  primaryDateLabel,
  setPrimaryDateLabel,
  names,
  duplicates,
  onRemove,
  pending,
  onContinue,
}: {
  context: PlanningPeriodContext;
  workspaceText: string;
  setWorkspaceText: (value: string) => void;
  primaryDate: string;
  setPrimaryDate: (value: string) => void;
  primaryDateLabel: string;
  setPrimaryDateLabel: (value: string) => void;
  names: readonly string[];
  duplicates: readonly string[];
  onRemove: (name: string) => void;
  pending: boolean;
  onContinue: () => void;
}) {
  const term = CONTEXT_TERMINOLOGY[context];
  const wedding = context === "wedding_season";
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">{term.workspacePlural}</p>
      <h1 className="mt-3 text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-none tracking-[-0.045em]">
        {wedding ? "Name the wedding." : `Paste your ${term.workspacePlural.toLowerCase()}.`}
      </h1>
      <p className="mt-4 text-[14px] leading-6 text-ink-soft">
        {context === "school_year" ? "Use class names only. Signal does not need pupil names, emails, identifiers, or accounts." : wedding ? "This creates one private workspace owned by the couple." : `One line becomes one ${term.workspace.toLowerCase()}.`}
      </p>
      <label className="mt-7 grid gap-2 text-[13px] font-medium">
        {wedding ? "Couple or wedding name" : `One ${term.workspace.toLowerCase()} per line`}
        <textarea value={workspaceText} onChange={(event) => setWorkspaceText(event.target.value)} rows={wedding ? 2 : 7} placeholder={workspacePlaceholder(context)} className="rounded-xl border border-line-soft bg-bg-elevated px-4 py-3 text-[15px] leading-6 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20" />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-[13px] font-medium">{wedding ? "Wedding date" : "Shared primary date, optional"}<input type="date" required={wedding} value={primaryDate} onChange={(event) => setPrimaryDate(event.target.value)} className="min-h-12 rounded-xl border border-line-soft bg-bg-elevated px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand/20" /></label>
        <label className="grid gap-2 text-[13px] font-medium">Date label<input value={primaryDateLabel} onChange={(event) => setPrimaryDateLabel(event.target.value)} maxLength={80} placeholder={wedding ? "Wedding" : "Examinations"} className="min-h-12 rounded-xl border border-line-soft bg-bg-elevated px-4 outline-none focus-visible:ring-2 focus-visible:ring-brand/20" /></label>
      </div>
      {names.length > 0 ? (
        <div className="mt-5 rounded-xl bg-bg-sunken/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">Preview · {names.length}</p>
          <ul className="mt-3 flex flex-wrap gap-2">{names.map((name) => <li key={name} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line-soft bg-bg px-3 text-[12px]">{name}<button type="button" onClick={() => onRemove(name)} aria-label={`Remove ${name}`} className="rounded-full px-1 text-ink-quiet outline-none hover:text-danger focus-visible:ring-2 focus-visible:ring-brand/30">×</button></li>)}</ul>
          {duplicates.length > 0 ? <p className="mt-3 text-[12px] text-ink-quiet">Repeated lines will be skipped: {duplicates.join(", ")}.</p> : null}
        </div>
      ) : null}
      <PrimaryButton disabled={pending || names.length === 0 || (wedding && (names.length !== 1 || !primaryDate))} onClick={onContinue} label={pending ? "Saving…" : "Review"} />
    </section>
  );
}

function ReviewStep({ context, periodName, startDate, endDate, names, primaryDate, venueSponsor, sponsorConsent, setSponsorConsent, pending, onComplete }: { context: PlanningPeriodContext; periodName: string; startDate: string; endDate: string; names: readonly string[]; primaryDate: string; venueSponsor: { id: string; name: string } | null; sponsorConsent: boolean; setSponsorConsent: (value: boolean) => void; pending: boolean; onComplete: () => void }) {
  const term = CONTEXT_TERMINOLOGY[context];
  return (
    <section>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">Review</p>
      <h1 className="mt-3 text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-none tracking-[-0.045em]">This is the structure.</h1>
      <dl className="mt-8 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-bg-elevated">
        <ReviewRow label={term.planningPeriod} value={periodName} />
        <ReviewRow label="Dates" value={startDate || endDate ? `${startDate || "Open"} to ${endDate || "open"}` : "Not set"} />
        <ReviewRow label={term.workspacePlural} value={`${names.length} · ${names.join(", ")}`} />
        {primaryDate ? <ReviewRow label="Primary date" value={primaryDate} /> : null}
      </dl>
      {context === "school_year" ? <p className="mt-4 rounded-xl bg-bg-sunken/60 px-4 py-3 text-[12px] leading-5 text-ink-soft">No pupil data is requested or stored by this setup.</p> : null}
      {venueSponsor && context === "wedding_season" ? (
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-line-soft bg-bg-elevated p-4 text-[12px] leading-5 text-ink-soft">
          <input type="checkbox" checked={sponsorConsent} onChange={(event) => setSponsorConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
          <span><strong className="font-semibold text-ink">Activation from {venueSponsor.name}.</strong> Share only the activation label, wedding date, and activation state with the venue. The venue does not gain access to Notes, Tasks, Timeline content, members, or invitations.</span>
        </label>
      ) : null}
      <PrimaryButton disabled={pending} onClick={onComplete} label={pending ? "Creating your work…" : `Create ${names.length} ${names.length === 1 ? term.workspace : term.workspacePlural}`} />
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 px-5 py-4 sm:grid-cols-[9rem_1fr]"><dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">{label}</dt><dd className="text-[14px] text-ink">{value}</dd></div>;
}

function PrimaryButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="mt-8 min-h-12 rounded-full bg-ink px-6 text-[14px] font-medium text-white outline-none hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-50">{label}</button>;
}

function periodNamePlaceholder(context: PlanningPeriodContext): string {
  if (context === "school_year") return "2026–27";
  if (context === "semester") return "Autumn semester";
  if (context === "wedding_season") return "Weddings · 2027";
  return "Active work";
}

function workspacePlaceholder(context: PlanningPeriodContext): string {
  if (context === "school_year") return "6th Year Geography\n5th Year History\nTransition Year";
  if (context === "semester") return "Psychology\nLaw\nMarketing\nStatistics";
  if (context === "wedding_season") return "Aoife & Ciarán";
  return "Client work\nHouse move\nCommunity event";
}
