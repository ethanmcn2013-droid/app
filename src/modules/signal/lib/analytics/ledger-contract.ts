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
 * The accounting: what Signal took in, what it surfaced, what it cleared.
 *
 * The product's whole claim is that it is a filter, so a numerator without a
 * denominator is an assertion rather than a receipt. `read` is the number of
 * source items examined in scope; `surfaced` is what crossed the attention
 * rules; `cleared` is the remainder and is never negative.
 */
export interface SignalLedgerReadCounts {
  /** Source items examined in scope. */
  read: number;
  /** Items that crossed a rule, before any display cap. Synthetic rows
   *  (overload, crowded-week) are readings OF items already counted, so
   *  they are never counted here as items in their own right. */
  flagged: number;
  /** Source items represented by the entries actually on screen. Counted in
   *  items, not rows: two rows that merged still stand for two items. */
  shown: number;
  /** Items that crossed nothing. `read = flagged + cleared` exactly, so a
   *  reader who subtracts on the page always lands on a true number. */
  cleared: number;
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
  /** Null when the source could not report how much it examined. */
  readCounts: SignalLedgerReadCounts | null;
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
   * Total source items examined in scope. Omit when the engine cannot
   * report it; the accounting is then withheld rather than guessed.
   */
  readCount?: number | null;
  /**
   * How many items crossed a rule, counted before any display cap. Callers
   * that cap their candidates before building (the legacy engine caps at
   * three per bucket) MUST pass this, or work that was merely held back
   * would be counted as cleared. Falls back to `candidates.length`.
   */
  triggeredCount?: number | null;
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
  "/app/home",
  // Legacy briefing base: serialized actions minted before the Home
  // consolidation may still carry it; the route permanently redirects.
  "/app/signal",
] as const;

const COVERAGE_COPY: Readonly<
  Record<
    Exclude<BuildSignalLedgerInput["coverageStatus"], "complete">,
    { headline: string; body: string; note: string }
  >
> = {
  // Each body states what IS true of the read, in that order: what is on
  // the page, then what is still unknown. The earlier copy did the
  // opposite. Every body was built around "Signal is not calling the rest
  // clear" / "nothing here is being called current" / "Nothing is being
  // called clear", which defends the implementation to the reader instead
  // of telling them where they stand, and puts the word "clear" in front
  // of them three times on a page whose point is that it is not. The
  // unavailable body also sent them to a refresh that does not exist:
  // there is no refresh control anywhere in Signal, and the settings page
  // says the read happens when you open Signal.
  partial: {
    headline: "Signal has only part of the picture.",
    body: "What is below came from the sources that answered. The rest is still unread, not clear.",
    note: "One source did not answer. This read covers the rest.",
  },
  stale: {
    headline: "This read is older than today.",
    body: "The last full read of these sources ran earlier than it should have. What is below is that read, not this moment.",
    note: "This is an older read, not today’s.",
  },
  unavailable: {
    headline: "Signal cannot reach the work right now.",
    body: "The sources are out of reach, so everything in scope is still unread. Signal will have a read once they answer.",
    note: "The sources are out of reach. An empty page here would not be the truth.",
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
                  "No item in this scope crossed Signal’s attention rules.",
                360,
              ),
          };

  // The accounting must close in front of the reader: read = flagged +
  // cleared, with `shown` a subset of `flagged`. An earlier shape published
  // only read/surfaced/cleared, which left the work held back by the display
  // cap unnamed, so a reader who subtracted found a hole on the one page
  // whose whole claim is that its arithmetic can be checked.
  const reportedFlagged = nonNegativeInteger(
    typeof input.triggeredCount === "number" &&
      Number.isFinite(input.triggeredCount)
      ? input.triggeredCount
      : input.candidates.length,
  );
  // Counted in items, not rows: merged rows still stand for every item that
  // fed them, so the header can never say "1 shown" over a row reading
  // "2 items".
  const shown = entries.reduce(
    (total, entry) => total + nonNegativeInteger(entry.receipt.evidenceCount),
    0,
  );
  // The invariants this type publishes are enforced here, not trusted from the
  // caller. Two real callers broke them: the progressive adapter caps its
  // observations and passes no pre-cap total, and a synthetic row contributes
  // to `shown` while being deliberately excluded from `flagged`. Either way
  // the published `shown <= flagged` went false and the strip drew a partition
  // that could not exist. Anything on screen demonstrably crossed a rule, so
  // `shown` is the floor for `flagged`, and `cleared` follows from it.
  const flagged = Math.max(reportedFlagged, shown);
  const readCounts =
    typeof input.readCount === "number" && Number.isFinite(input.readCount)
      ? {
          read: Math.max(nonNegativeInteger(input.readCount), flagged),
          flagged,
          shown,
          cleared: Math.max(
            0,
            Math.max(nonNegativeInteger(input.readCount), flagged) - flagged,
          ),
        }
      : null;

  return {
    version: SIGNAL_LEDGER_VERSION,
    readCounts,
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
