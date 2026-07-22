export type TimelinePromotionDraft = Readonly<{
  noteId: string;
  workspaceId: string;
  title: string;
  date: string;
  completion: number;
  audienceLabel: string;
}>;

export type TimelinePromotionCommand = Readonly<{
  version: 1;
  source: { product: "notes"; noteId: string };
  workspaceId: string;
  projection: {
    title: string;
    date: string;
    completion: number;
  };
  audience: { kind: "named"; label: string };
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string, field: string, max: number): string {
  const result = value.trim();
  if (!result) throw new TypeError(`${field} is required`);
  if (result.length > max) throw new TypeError(`${field} is too long`);
  return result;
}

/**
 * Builds the only payload Notes may offer to Timeline. There is no body,
 * extractBody, user id, token, or free-form metadata slot to accidentally
 * carry private note content across the boundary.
 */
export function createTimelinePromotionCommand(
  draft: TimelinePromotionDraft,
): TimelinePromotionCommand {
  const noteId = clean(draft.noteId, "Note id", 128);
  const workspaceId = clean(draft.workspaceId, "Workspace", 128);
  const title = clean(draft.title, "Selected extract", 180);
  const date = clean(draft.date, "Date", 10);
  const audienceLabel = clean(draft.audienceLabel, "Named audience", 80);
  if (!ISO_DATE.test(date)) throw new TypeError("Date must be YYYY-MM-DD");
  if (!Number.isInteger(draft.completion) || draft.completion < 0 || draft.completion > 100) {
    throw new TypeError("Completion must be a whole number from 0 to 100");
  }
  return {
    version: 1,
    source: { product: "notes", noteId },
    workspaceId,
    projection: { title, date, completion: draft.completion },
    audience: { kind: "named", label: audienceLabel },
  };
}

export function timelinePromotionPreview(command: TimelinePromotionCommand): string {
  return `${command.projection.title} · ${command.projection.date} · ${command.projection.completion}% · for ${command.audience.label}`;
}
