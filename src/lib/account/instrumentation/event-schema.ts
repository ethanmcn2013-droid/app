/**
 * venue-meaningful-action.v1 — the only shape a product may emit to describe
 * sponsored use.
 *
 * The contract is `docs/account/EVENT_SCHEMA_MEANINGFUL_ACTION_V1.md`. An event
 * says that someone holding sponsored access committed a real action in a
 * product. It carries no content, no identity, and no destination, so the
 * Account surface can prove the benefit without ever seeing the work.
 */

export const INSTRUMENTATION_VERSION = "instrumentation.v1" as const;
export const EVENT_SCHEMA_VERSION = "venue-meaningful-action.v1" as const;

export type SponsoredProduct = "notes" | "tasks" | "timeline" | "signal";

/** Allowlisted kinds per product. A kind is only valid under its own product. */
export const MEANINGFUL_ACTION_KINDS = {
  notes: ["note_created", "note_materially_edited"],
  tasks: [
    "task_created",
    "task_completed",
    "task_reopened",
    "task_reassigned",
    "task_rescheduled",
    "task_status_changed",
  ],
  timeline: [
    "timeline_curated",
    "timeline_visibility_changed",
    "timeline_published",
  ],
  signal: ["briefing_deliberately_opened", "briefing_acknowledged"],
} as const satisfies Record<SponsoredProduct, readonly string[]>;

export type MeaningfulActionKind =
  (typeof MEANINGFUL_ACTION_KINDS)[SponsoredProduct][number];

export type VenueMeaningfulActionV1 = {
  eventId: string;
  instrumentationVersion: typeof INSTRUMENTATION_VERSION;
  product: SponsoredProduct;
  kind: MeaningfulActionKind;
  occurredAt: number;
  subjectIdHash: string;
  workspaceIdHash: string;
};

const REQUIRED_KEYS = [
  "eventId",
  "instrumentationVersion",
  "product",
  "kind",
  "occurredAt",
  "subjectIdHash",
  "workspaceIdHash",
] as const;

/**
 * Keys that must never appear. Checked at every depth and rejected rather than
 * stripped: a silent strip would let a future field leak the first time someone
 * forgets this list exists.
 */
export const FORBIDDEN_FIELDS = new Set([
  "title",
  "name",
  "body",
  "content",
  "text",
  "description",
  "note",
  "comment",
  "email",
  "emailaddress",
  "phone",
  "url",
  "href",
  "path",
  "slug",
  "filename",
  "attachment",
  "clerkid",
  "userid",
  "workspaceid",
  "subjectid",
  "code",
  "accesscode",
  "token",
  "secret",
  "ip",
  "useragent",
]);

const HASH_PATTERN = /^[0-9a-f]{32}$/;

export type EventValidation =
  | { ok: true; event: VenueMeaningfulActionV1 }
  | { ok: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Walks the whole payload so a forbidden key cannot hide inside a nested object. */
function findForbiddenKey(value: unknown, depth = 0): string | null {
  if (depth > 6) return "payload nested too deeply";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenKey(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) return key;
    const found = findForbiddenKey(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

export function isAllowedKind(product: string, kind: string): boolean {
  const kinds = MEANINGFUL_ACTION_KINDS[product as SponsoredProduct] as
    | readonly string[]
    | undefined;
  return Boolean(kinds?.includes(kind));
}

/**
 * Validates a candidate event. Rejects anything that is not exactly the seven
 * contracted fields with a kind that belongs to its product.
 */
export function validateMeaningfulAction(input: unknown): EventValidation {
  if (!isPlainObject(input)) return { ok: false, reason: "event must be an object" };

  const forbidden = findForbiddenKey(input);
  if (forbidden) return { ok: false, reason: `forbidden field ${forbidden}` };

  const keys = Object.keys(input);
  const extra = keys.filter((key) => !(REQUIRED_KEYS as readonly string[]).includes(key));
  if (extra.length > 0) return { ok: false, reason: `unexpected field ${extra[0]}` };
  const missing = REQUIRED_KEYS.filter((key) => !keys.includes(key));
  if (missing.length > 0) return { ok: false, reason: `missing field ${missing[0]}` };

  const { eventId, instrumentationVersion, product, kind, occurredAt, subjectIdHash, workspaceIdHash } =
    input as Record<string, unknown>;

  if (typeof eventId !== "string" || eventId.trim() === "")
    return { ok: false, reason: "eventId must be a non-empty string" };
  if (instrumentationVersion !== INSTRUMENTATION_VERSION)
    return { ok: false, reason: "unsupported instrumentation version" };
  if (typeof product !== "string" || !(product in MEANINGFUL_ACTION_KINDS))
    return { ok: false, reason: "unknown product" };
  if (typeof kind !== "string" || !isAllowedKind(product, kind))
    return { ok: false, reason: `kind ${String(kind)} is not allowed for ${product}` };
  if (typeof occurredAt !== "number" || !Number.isFinite(occurredAt) || occurredAt <= 0)
    return { ok: false, reason: "occurredAt must be a positive timestamp" };
  if (typeof subjectIdHash !== "string" || !HASH_PATTERN.test(subjectIdHash))
    return { ok: false, reason: "subjectIdHash must be a 32-character hash" };
  if (typeof workspaceIdHash !== "string" || !HASH_PATTERN.test(workspaceIdHash))
    return { ok: false, reason: "workspaceIdHash must be a 32-character hash" };

  return {
    ok: true,
    event: {
      eventId,
      instrumentationVersion: INSTRUMENTATION_VERSION,
      product: product as SponsoredProduct,
      kind: kind as MeaningfulActionKind,
      occurredAt,
      subjectIdHash,
      workspaceIdHash,
    },
  };
}
