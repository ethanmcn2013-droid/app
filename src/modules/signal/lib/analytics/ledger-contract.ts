export const SIGNAL_LEDGER_VERSION = 1 as const;
export const SIGNAL_LEDGER_MAX_ENTRIES = 3 as const;

export type SignalLedgerFreshness =
  | "fresh"
  | "stale"
  | "partial"
  | "unavailable";

export type SignalLedgerSection = "attention" | "risks";
export type SignalLedgerState = "needs_attention" | "watch";

export interface SignalLedgerAction {
  label: string;
  href: string;
}

export interface SignalLedgerReceipt {
  sourceLabel: string;
  evidenceCount: number;
  sourceCounts: {
    notes: number;
    tasks: number;
    milestones: number;
  };
  ageLabel: string | null;
  updatedAtLabel: string | null;
}

export interface SignalLedgerEntry {
  /** Presentation-safe opaque id. Never a source record id. */
  id: string;
  section: SignalLedgerSection;
  state: SignalLedgerState;
  text: string;
  detail: string | null;
  reasons: string[];
  receipt: SignalLedgerReceipt;
  primaryAction: SignalLedgerAction | null;
  evidenceHref: string | null;
}

export interface SignalLedgerEmptyState {
  kind: "healthy" | "coverage";
  headline: string;
  body: string;
}

/**
 * Versioned allowlist between Signal's authorized domain response and the
 * client renderer. It deliberately excludes source records, source ids,
 * workspace ids, Clerk ids, raw Notes, and preference state.
 */
export interface SignalLedgerDTO {
  version: typeof SIGNAL_LEDGER_VERSION;
  heading: string;
  generatedAt: string;
  generatedAtLabel: string;
  scopeLabel: string | null;
  scopeKind: "workspace" | "planningPeriod" | "project" | null;
  freshness: SignalLedgerFreshness;
  coverageNote: string | null;
  entries: SignalLedgerEntry[];
  emptyState: SignalLedgerEmptyState | null;
  closingLine: string | null;
}

export interface SignalLedgerCandidate {
  /** Seed may contain domain ids; only its hash is emitted. */
  idSeed: string;
  section: SignalLedgerSection;
  state: SignalLedgerState;
  text: string;
  detail?: string | null;
  reasons?: string[];
  receipt: SignalLedgerReceipt;
  primaryAction?: SignalLedgerAction | null;
  fallbackAction?: SignalLedgerAction | null;
  evidenceHref?: string | null;
}

export interface BuildSignalLedgerInput {
  heading: string;
  generatedAt: string;
  generatedAtLabel: string;
  scopeLabel?: string | null;
  scopeKind?: SignalLedgerDTO["scopeKind"];
  freshness: SignalLedgerFreshness;
  coverageStatus: "complete" | "partial" | "stale" | "unavailable";
  candidates: SignalLedgerCandidate[];
  healthyEmptyState?: Omit<SignalLedgerEmptyState, "kind"> | null;
  closingLine?: string | null;
  /**
   * The configured authenticated app origin. Absolute actions are accepted
   * only when they resolve to this exact origin, then serialized as relative.
   */
  allowedAppOrigin: string;
}

const PRODUCT_PATHS = [
  "/app/notes",
  "/app/tasks",
  "/app/timeline",
  "/app/signal",
] as const;

const COVERAGE_COPY: Readonly<
  Record<
    Exclude<BuildSignalLedgerInput["coverageStatus"], "complete">,
    { headline: string; body: string; note: string }
  >
> = {
  partial: {
    headline: "Signal has only part of the picture.",
    body: "Available facts are shown, but missing sources are not being treated as healthy work.",
    note: "Some connected context is unavailable. Conclusions use available facts only.",
  },
  stale: {
    headline: "Signal is waiting for a newer read.",
    body: "The latest complete source calculation is older than expected, so no all-clear is being inferred.",
    note: "This briefing is using an older calculation.",
  },
  unavailable: {
    headline: "Signal cannot read the source work right now.",
    body: "Nothing has been marked healthy while the connected sources are unavailable.",
    note: "Source data is unavailable. Signal is not substituting an empty workspace.",
  },
};

/**
 * Construct the only DTO the Quiet Briefing Ledger accepts.
 *
 * This is intentionally defensive even though the analytics engine already
 * caps and authorizes observations. The presentation boundary owns its own
 * maximum, URL allowlist, string bounds, and honest empty-state behavior.
 */
export function buildSignalLedger(
  input: BuildSignalLedgerInput,
): SignalLedgerDTO {
  const origin = normalizedOrigin(input.allowedAppOrigin);
  const entries = input.candidates
    .slice(0, SIGNAL_LEDGER_MAX_ENTRIES)
    .map((candidate) => {
      const primaryAction =
        safeAction(candidate.primaryAction, origin) ??
        safeAction(candidate.fallbackAction, origin);

      return {
        id: `signal-${stableHash(candidate.idSeed)}`,
        section: candidate.section,
        state: candidate.state,
        text: boundedText(candidate.text, 280),
        detail: candidate.detail
          ? boundedText(candidate.detail, 520)
          : null,
        reasons: uniqueText(candidate.reasons ?? [], 6, 280),
        receipt: {
          sourceLabel: boundedText(candidate.receipt.sourceLabel, 140),
          evidenceCount: nonNegativeInteger(
            candidate.receipt.evidenceCount,
          ),
          sourceCounts: {
            notes: nonNegativeInteger(candidate.receipt.sourceCounts.notes),
            tasks: nonNegativeInteger(candidate.receipt.sourceCounts.tasks),
            milestones: nonNegativeInteger(
              candidate.receipt.sourceCounts.milestones,
            ),
          },
          ageLabel: candidate.receipt.ageLabel
            ? boundedText(candidate.receipt.ageLabel, 100)
            : null,
          updatedAtLabel: candidate.receipt.updatedAtLabel
            ? boundedText(candidate.receipt.updatedAtLabel, 120)
            : null,
        },
        primaryAction,
        evidenceHref: safeSignalAppHref(
          candidate.evidenceHref ?? null,
          origin,
        ),
      } satisfies SignalLedgerEntry;
    });

  const coverage =
    input.coverageStatus === "complete"
      ? null
      : COVERAGE_COPY[input.coverageStatus];
  const emptyState =
    entries.length > 0
      ? null
      : coverage
        ? {
            kind: "coverage" as const,
            headline: coverage.headline,
            body: coverage.body,
          }
        : {
            kind: "healthy" as const,
            headline:
              boundedText(
                input.healthyEmptyState?.headline ??
                  "Nothing needs your attention right now.",
                180,
              ),
            body:
              boundedText(
                input.healthyEmptyState?.body ??
                  "No item in this scope crossed Signal's attention rules.",
                360,
              ),
          };

  return {
    version: SIGNAL_LEDGER_VERSION,
    heading: boundedText(
      input.heading || "A short read of what deserves attention.",
      180,
    ),
    generatedAt: validInstant(input.generatedAt),
    generatedAtLabel: boundedText(input.generatedAtLabel, 120),
    scopeLabel: input.scopeLabel
      ? boundedText(input.scopeLabel, 140)
      : null,
    scopeKind: input.scopeKind ?? null,
    freshness: input.freshness,
    coverageNote: coverage?.note ?? null,
    entries,
    emptyState,
    closingLine:
      entries.length > 0 && input.closingLine
        ? boundedText(input.closingLine, 180)
        : null,
  };
}

export function safeSignalAppHref(
  value: string | null,
  allowedAppOrigin: string,
): string | null {
  if (!value) return null;
  const origin = normalizedOrigin(allowedAppOrigin);

  try {
    const parsed = new URL(value, `${origin}/`);
    if (parsed.origin !== origin) return null;
    if (parsed.username || parsed.password) return null;
    if (!PRODUCT_PATHS.some((path) => ownsPath(parsed.pathname, path))) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function stableSignalLedgerId(seed: string): string {
  return `signal-${stableHash(seed)}`;
}

function safeAction(
  action: SignalLedgerAction | null | undefined,
  origin: string,
): SignalLedgerAction | null {
  if (!action) return null;
  const href = safeSignalAppHref(action.href, origin);
  if (!href) return null;

  const parsed = new URL(href, `${origin}/`);
  const canonicalPath = PRODUCT_PATHS.find(
    (productPath) => parsed.pathname === productPath,
  );
  // Actions cross the protected ledger DTO into the client. Only exact
  // product roots are allowed here: deep links, queries, and fragments may
  // contain source identifiers. Adapters provide a canonical product fallback.
  if (!canonicalPath || parsed.search || parsed.hash) return null;

  const label = boundedText(action.label, 80);
  return label ? { label, href: canonicalPath } : null;
}

function ownsPath(pathname: string, productPath: string): boolean {
  return pathname === productPath || pathname.startsWith(`${productPath}/`);
}

function normalizedOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "https://app.signalstudio.ie";
  }
}

function boundedText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function uniqueText(values: string[], limit: number, max: number): string[] {
  return [
    ...new Set(
      values
        .map((value) => boundedText(value, max))
        .filter((value) => value.length > 0),
    ),
  ].slice(0, limit);
}

function nonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function validInstant(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
