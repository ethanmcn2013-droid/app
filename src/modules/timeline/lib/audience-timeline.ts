import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const AUDIENCE_TIMELINE_DTO_VERSION = 1 as const;
export const AUDIENCE_KINDS = ["class", "module", "couple"] as const;
export const AUDIENCE_ITEM_STATES = [
  "covered",
  "now",
  "next",
  "later",
  "cancelled",
] as const;

export type AudienceKind = (typeof AUDIENCE_KINDS)[number];
export type AudienceItemState = (typeof AUDIENCE_ITEM_STATES)[number];

export type AudienceTimelineItemDto = Readonly<{
  publicId: string;
  title: string;
  date?: string;
  state: AudienceItemState;
}>;

export type AudienceTimelineSectionDto = Readonly<{
  state: AudienceItemState;
  label: string;
  items: readonly AudienceTimelineItemDto[];
}>;

export type AudienceTimelineDto = Readonly<{
  version: typeof AUDIENCE_TIMELINE_DTO_VERSION;
  audienceKind: AudienceKind;
  publicationId: string;
  label: string;
  ownerDisplayLabel?: string;
  primaryDate?: Readonly<{ label: string; date: string }>;
  lastUpdatedAt: string;
  today: string;
  sections: readonly AudienceTimelineSectionDto[];
}>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const TOP_LEVEL_KEYS = new Set([
  "version",
  "audienceKind",
  "publicationId",
  "label",
  "ownerDisplayLabel",
  "primaryDate",
  "lastUpdatedAt",
  "today",
  "sections",
]);
const PRIMARY_DATE_KEYS = new Set(["label", "date"]);
const SECTION_KEYS = new Set(["state", "label", "items"]);
const ITEM_KEYS = new Set(["publicId", "title", "date", "state"]);
const FORBIDDEN_KEYS = new Set([
  "workspaceId",
  "workspaceSlug",
  "userId",
  "sourceId",
  "sourceRef",
  "sourceRelation",
  "sourceDigest",
  "ownerEmail",
  "sponsor",
  "membership",
  "description",
  "attachments",
  "comments",
  "notes",
  "audit",
  "privateMetadata",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new TypeError(`${path}.${key} is forbidden`);
    if (!allowed.has(key)) throw new TypeError(`${path}.${key} is not allowlisted`);
  }
}

function requiredString(value: unknown, path: string, max = 240): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new TypeError(`${path} must be a non-empty string no longer than ${max} characters`);
  }
  return value;
}

function calendarDate(value: unknown, path: string): string {
  const date = requiredString(value, path, 10);
  if (!DATE_RE.test(date)) throw new TypeError(`${path} must be YYYY-MM-DD`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new TypeError(`${path} is not a real calendar date`);
  }
  return date;
}

function audienceKind(value: unknown, path: string): AudienceKind {
  if (!AUDIENCE_KINDS.includes(value as AudienceKind)) {
    throw new TypeError(`${path} is not an audience kind`);
  }
  return value as AudienceKind;
}

function itemState(value: unknown, path: string): AudienceItemState {
  if (!AUDIENCE_ITEM_STATES.includes(value as AudienceItemState)) {
    throw new TypeError(`${path} is not an audience item state`);
  }
  return value as AudienceItemState;
}

/** Runtime boundary: rejects unknown keys as well as known private fields. */
export function validateAudienceTimelineDto(value: unknown): AudienceTimelineDto {
  if (!isRecord(value)) throw new TypeError("Audience timeline DTO must be an object");
  exactKeys(value, TOP_LEVEL_KEYS, "timeline");
  if (value.version !== AUDIENCE_TIMELINE_DTO_VERSION) {
    throw new TypeError("timeline.version is unsupported");
  }

  const dto: {
    version: typeof AUDIENCE_TIMELINE_DTO_VERSION;
    audienceKind: AudienceKind;
    publicationId: string;
    label: string;
    ownerDisplayLabel?: string;
    primaryDate?: { label: string; date: string };
    lastUpdatedAt: string;
    today: string;
    sections: AudienceTimelineSectionDto[];
  } = {
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: audienceKind(value.audienceKind, "timeline.audienceKind"),
    publicationId: requiredString(value.publicationId, "timeline.publicationId", 80),
    label: requiredString(value.label, "timeline.label", 120),
    lastUpdatedAt: requiredString(value.lastUpdatedAt, "timeline.lastUpdatedAt", 40),
    today: calendarDate(value.today, "timeline.today"),
    sections: [],
  };

  if (Number.isNaN(Date.parse(dto.lastUpdatedAt))) {
    throw new TypeError("timeline.lastUpdatedAt must be an ISO instant");
  }
  if (value.ownerDisplayLabel !== undefined) {
    dto.ownerDisplayLabel = requiredString(
      value.ownerDisplayLabel,
      "timeline.ownerDisplayLabel",
      80,
    );
  }
  if (value.primaryDate !== undefined) {
    if (!isRecord(value.primaryDate)) throw new TypeError("timeline.primaryDate must be an object");
    exactKeys(value.primaryDate, PRIMARY_DATE_KEYS, "timeline.primaryDate");
    dto.primaryDate = {
      label: requiredString(value.primaryDate.label, "timeline.primaryDate.label", 40),
      date: calendarDate(value.primaryDate.date, "timeline.primaryDate.date"),
    };
  }
  if (!Array.isArray(value.sections)) throw new TypeError("timeline.sections must be an array");

  dto.sections = value.sections.map((section, sectionIndex) => {
    if (!isRecord(section)) throw new TypeError(`timeline.sections[${sectionIndex}] must be an object`);
    exactKeys(section, SECTION_KEYS, `timeline.sections[${sectionIndex}]`);
    const state = itemState(section.state, `timeline.sections[${sectionIndex}].state`);
    if (!Array.isArray(section.items)) {
      throw new TypeError(`timeline.sections[${sectionIndex}].items must be an array`);
    }
    return {
      state,
      label: requiredString(section.label, `timeline.sections[${sectionIndex}].label`, 40),
      items: section.items.map((item, itemIndex) => {
        const path = `timeline.sections[${sectionIndex}].items[${itemIndex}]`;
        if (!isRecord(item)) throw new TypeError(`${path} must be an object`);
        exactKeys(item, ITEM_KEYS, path);
        const mapped: { publicId: string; title: string; date?: string; state: AudienceItemState } = {
          publicId: requiredString(item.publicId, `${path}.publicId`, 80),
          title: requiredString(item.title, `${path}.title`, 180),
          state: itemState(item.state, `${path}.state`),
        };
        if (mapped.state !== state) throw new TypeError(`${path}.state must match its section`);
        if (item.date !== undefined) mapped.date = calendarDate(item.date, `${path}.date`);
        return mapped;
      }),
    };
  });

  return dto;
}

export function generateAudienceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isAudienceTokenShape(value: string): boolean {
  return TOKEN_RE.test(value);
}

export function hashAudienceToken(rawToken: string): string {
  if (!isAudienceTokenShape(rawToken)) throw new TypeError("Invalid audience token shape");
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function hashesEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export type ShareAccessState = "valid" | "invalid" | "revoked" | "rotated" | "expired";

export function resolveShareAccessState(
  share: { state: "active" | "revoked" | "rotated" | "expired"; expiresAt: Date | null } | null,
  now: Date,
): ShareAccessState {
  if (!share) return "invalid";
  if (share.state !== "active") return share.state;
  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export function validateIanaTimezone(value: string): string {
  if (!value.trim() || value.length > 80) throw new TypeError("Timezone is required");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    throw new TypeError("Timezone must be a valid IANA timezone");
  }
}

/** Convert an instant to a calendar date in the publication's named zone. */
export function calendarDateInTimeZone(
  now: Date,
  timeZone: string,
): string {
  validateIanaTimezone(timeZone);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new TypeError("Could not derive calendar date");
  return `${year}-${month}-${day}`;
}

export function safeAudienceItemState(status: string, targetDate: string | null): AudienceItemState {
  if (status === "shipped") return "covered";
  if (status === "refused") return "cancelled";
  if (status === "in-flight" || status === "waiting") return "now";
  return targetDate ? "next" : "later";
}

export type FrozenSourceItem = Readonly<{
  id: string;
  workspaceId: string;
  title: string;
  date: string | null;
  completionState: string;
}>;

export type SourceProvenance = Readonly<{
  kind: "synced" | "manual";
  sourceTasksWorkspaceId: string | null;
}>;

/** Manual nodes are authored inside this local workspace. Synced nodes must
 * carry a project-level immutable Tasks workspace mapping; a workspace-level
 * fallback cannot prove the provenance of old mixed-sync rows. */
export function assertSourceProvenance(
  provenance: SourceProvenance,
  expectedWorkspaceId: string,
): void {
  if (provenance.kind === "manual") return;
  if (provenance.sourceTasksWorkspaceId !== expectedWorkspaceId) {
    throw new TypeError("A selected synced milestone is not proven to belong to this canonical workspace");
  }
}

export type FrozenAudienceItem = Readonly<{
  sourceRelation: string;
  sourceDigest: string;
  title: string;
  calendarDate: string | null;
  state: AudienceItemState;
}>;

export function assertSameWorkspace(source: FrozenSourceItem, expectedWorkspaceId: string): void {
  if (source.workspaceId !== expectedWorkspaceId) throw new TypeError("Source item is outside the selected workspace");
}

export function digestSourceFields(input: {
  title: string;
  date: string | null;
  completionState: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify([input.title, input.date, input.completionState]), "utf8")
    .digest("hex");
}

/** Copies the three allowlisted fields and no private source payload. */
export function freezeAudienceItem(source: FrozenSourceItem, expectedWorkspaceId: string): FrozenAudienceItem {
  assertSameWorkspace(source, expectedWorkspaceId);
  return {
    sourceRelation: source.id,
    sourceDigest: digestSourceFields(source),
    title: source.title,
    calendarDate: source.date,
    state: safeAudienceItemState(source.completionState, source.date),
  };
}

export function hasSourceDiverged(
  frozenDigest: string,
  current: Pick<FrozenSourceItem, "title" | "date" | "completionState">,
): boolean {
  return !hashesEqual(frozenDigest, digestSourceFields(current));
}

export const SECTION_LABELS: Readonly<Record<AudienceItemState, string>> = {
  covered: "Covered",
  now: "Now",
  next: "Next",
  later: "Later",
  cancelled: "Cancelled",
};
