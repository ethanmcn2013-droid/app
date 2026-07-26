import type {
  BriefingResponse,
  SignalObservation,
} from "./contracts";
import {
  buildSignalLedger,
  type SignalLedgerCandidate,
  type SignalLedgerDTO,
  type SignalLedgerSection,
} from "./ledger-contract";
import type { Briefing, BriefItem } from "../briefing/types";
import { ageNote, graceNote, summaryLine } from "../briefing/voice";

interface SharedLedgerOptions {
  generatedAtLabel: string;
  scopeLabel?: string | null;
  allowedAppOrigin: string;
}

export interface LegacyLedgerOptions extends SharedLedgerOptions {
  scopeKind?: "workspace" | "planningPeriod" | null;
}

export interface ProgressiveLedgerOptions extends SharedLedgerOptions {
  evidenceHref: (observationId: string) => string;
}

interface LegacyGroup {
  key: string;
  section: SignalLedgerSection;
  items: BriefItem[];
}

/**
 * Convert the current production briefing into the protected ledger DTO.
 * Hidden legacy buckets, user ids, source ids, read-state keys, and focus
 * projections never cross this boundary.
 */
export function ledgerFromLegacyBriefing(
  briefing: Briefing,
  options: LegacyLedgerOptions,
): SignalLedgerDTO {
  const groups = groupLegacyBriefItems(briefing);
  const candidates = groups.map((group): SignalLedgerCandidate => {
    const first = group.items[0]!;
    const maxAge = Math.max(
      0,
      ...group.items.map((item) => item.ageDays ?? 0),
    );

    return {
      idSeed: `legacy:${group.key}`,
      section: group.section,
      state: group.section === "attention" ? "needs_attention" : "watch",
      text: first.text,
      reasons: unique(group.items.flatMap((item) => item.reasons)),
      receipt: {
        sourceLabel: first.sourceLabel,
        evidenceCount: group.items.length,
        sourceCounts: {
          notes: 0,
          tasks: group.items.length,
          milestones: 0,
        },
        ageLabel: maxAge >= 2 ? ageNote(first.trigger, maxAge) : null,
        updatedAtLabel: null,
      },
      primaryAction: { label: "Review in Tasks", href: "/app/tasks" },
      fallbackAction: { label: "Open Tasks", href: "/app/tasks" },
      evidenceHref: null,
    };
  });

  return buildSignalLedger({
    heading:
      summaryLine(briefing) || "A short read of what deserves attention.",
    generatedAt: new Date(briefing.generatedAt).toISOString(),
    generatedAtLabel: options.generatedAtLabel,
    scopeLabel: options.scopeLabel,
    scopeKind: options.scopeKind,
    freshness: "fresh",
    coverageStatus: "complete",
    candidates,
    healthyEmptyState: {
      headline:
        briefing.emptyStateHeadline ??
        "Nothing needs your attention right now.",
      body:
        briefing.emptyStateBody ??
        "No item in this scope crossed Signal's attention rules.",
    },
    closingLine: graceNote(briefing),
    allowedAppOrigin: options.allowedAppOrigin,
  });
}

/**
 * Convert the deterministic progressive engine response without serializing
 * its inline SourceReference records. Evidence remains behind the separately
 * authorized observation drawer.
 */
export function ledgerFromProgressiveBriefing(
  briefing: BriefingResponse,
  options: ProgressiveLedgerOptions,
): SignalLedgerDTO {
  const candidates = briefing.observations.map(
    (observation): SignalLedgerCandidate => ({
      idSeed: `progressive:${observation.ruleVersion}:${observation.issueKey}:${observation.id}`,
      section:
        observation.state === "needs_attention" ? "attention" : "risks",
      state:
        observation.state === "needs_attention"
          ? "needs_attention"
          : "watch",
      text: observation.title,
      detail: observation.summary,
      reasons: unique([
        observation.whyItMatters,
        ...observation.reasons,
      ]),
      receipt: {
        sourceLabel: sourceLabel(observation, options.scopeLabel),
        evidenceCount: observation.evidenceCount,
        sourceCounts: observation.sourceCounts,
        ageLabel: null,
        updatedAtLabel: formatInstant(
          observation.updatedAt,
          briefing.meta.period.timezone,
        ),
      },
      primaryAction:
        observation.actions.find((action) => action.primary) ?? null,
      fallbackAction: fallbackAction(observation),
      evidenceHref: options.evidenceHref(observation.id),
    }),
  );

  return buildSignalLedger({
    heading: observationHeading(candidates.length),
    generatedAt: briefing.meta.calculatedAt,
    generatedAtLabel: options.generatedAtLabel,
    scopeLabel: options.scopeLabel,
    scopeKind:
      briefing.meta.scope.type === "project"
        ? "project"
        : "workspace",
    freshness: briefing.meta.freshness,
    coverageStatus: briefing.meta.coverage.status,
    candidates,
    healthyEmptyState: briefing.emptyState,
    closingLine: "That's the read. The rest can wait.",
    allowedAppOrigin: options.allowedAppOrigin,
  });
}

export function groupLegacyBriefItems(briefing: Briefing): LegacyGroup[] {
  const rows: Array<{
    section: SignalLedgerSection;
    item: BriefItem;
  }> = [
    ...briefing.needsAttention.map((item) => ({
      section: "attention" as const,
      item,
    })),
    ...briefing.quietRisks.map((item) => ({
      section: "risks" as const,
      item,
    })),
  ];
  const groups = new Map<string, LegacyGroup>();

  for (const row of rows) {
    const key = [
      row.section,
      row.item.trigger,
      normalized(row.item.text),
      normalized(row.item.sourceLabel),
      row.item.workspaceId ?? "",
      row.item.planningPeriodId ?? "",
    ].join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(row.item);
    } else {
      groups.set(key, { key, section: row.section, items: [row.item] });
    }
  }

  return [...groups.values()];
}

function observationHeading(count: number): string {
  if (count === 1) return "One thing genuinely needs you.";
  if (count > 1) return `${Math.min(count, 3)} things genuinely need you.`;
  return "A short read of what deserves attention.";
}

function sourceLabel(
  observation: SignalObservation,
  scopeLabel?: string | null,
): string {
  const sources = [
    observation.sourceCounts.notes > 0 ? "Notes" : null,
    observation.sourceCounts.tasks > 0 ? "Tasks" : null,
    observation.sourceCounts.milestones > 0 ? "Timeline" : null,
  ].filter((value): value is string => Boolean(value));
  const base = sources.length > 0 ? sources.join(" + ") : "Connected work";
  return scopeLabel ? `${base} · ${scopeLabel}` : base;
}

function fallbackAction(
  observation: SignalObservation,
): SignalLedgerCandidate["fallbackAction"] {
  if (observation.sourceCounts.tasks > 0) {
    return { label: "Review in Tasks", href: "/app/tasks" };
  }
  if (observation.sourceCounts.milestones > 0) {
    return { label: "Open Timeline", href: "/app/timeline" };
  }
  if (observation.sourceCounts.notes > 0) {
    return { label: "Open Notes", href: "/app/notes" };
  }
  return { label: "Keep reading", href: "/app/signal" };
}

function formatInstant(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "Update time unavailable";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(instant);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(instant);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-IE").replace(/\s+/g, " ");
}
