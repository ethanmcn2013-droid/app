import {
  DEFAULT_WORKSPACE_CONTEXT,
  isPlanningPeriodContext,
  isWorkspaceContext,
  type PlanningPeriodContext,
  type WorkspaceContext,
} from "./context";
import {
  assertCalendarDate,
  assertIanaTimeZone,
  type CalendarDate,
} from "./dates";

export type NormalizedPeriodInput = Readonly<{
  name: string;
  contextType: PlanningPeriodContext;
  startDate: CalendarDate | null;
  endDate: CalendarDate | null;
  timezone: string;
}>;

export function cleanPlainText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean) throw new Error(`${field} is required.`);
  if (clean.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }
  return clean;
}

export function normalizePeriodInput(input: {
  name: unknown;
  contextType: unknown;
  startDate?: unknown;
  endDate?: unknown;
  timezone?: unknown;
}, options: Readonly<{ requireFinite?: boolean }> = {}): NormalizedPeriodInput {
  if (!isPlanningPeriodContext(input.contextType)) {
    throw new Error("Unknown planning period context.");
  }
  const startDate = optionalDate(input.startDate, "start date");
  const endDate = optionalDate(input.endDate, "end date");
  if (options.requireFinite && (!startDate || !endDate)) {
    throw new Error("Planning periods require a start date and an end date.");
  }
  if (startDate && endDate && startDate > endDate) {
    throw new Error("End date must be on or after start date.");
  }
  const timezone =
    input.timezone === undefined || input.timezone === ""
      ? "UTC"
      : input.timezone;
  assertIanaTimeZone(timezone);
  return {
    name: cleanPlainText(input.name, "Name", 100),
    contextType: input.contextType,
    startDate,
    endDate,
    timezone,
  };
}

export function normalizeWorkspaceNames(
  value: unknown,
  options: Readonly<{ max?: number }> = {},
): Readonly<{ names: readonly string[]; duplicates: readonly string[] }> {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const limit = options.max ?? 50;
  const names: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const name = cleanPlainText(candidate, "Workspace name", 100);
    const key = name.toLocaleLowerCase("en");
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);
    names.push(name);
    if (names.length > limit) {
      throw new Error(`Create no more than ${limit} workspaces at once.`);
    }
  }
  if (names.length === 0) throw new Error("Add at least one workspace name.");
  return { names, duplicates };
}

export function normalizeWorkspaceContext(
  value: unknown,
  periodContext: PlanningPeriodContext,
): WorkspaceContext {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_WORKSPACE_CONTEXT[periodContext];
  }
  if (!isWorkspaceContext(value)) throw new Error("Unknown workspace context.");
  return value;
}

export function optionalDate(
  value: unknown,
  field: string,
): CalendarDate | null {
  if (value === undefined || value === null || value === "") return null;
  assertCalendarDate(value, field);
  return value;
}
