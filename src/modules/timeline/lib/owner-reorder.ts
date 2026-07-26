import type { AudienceItemState } from "@/modules/timeline/server/db/timeline-schema";

export type OwnerReorderItem = Readonly<{
  id: string;
  title: string;
  audienceState: AudienceItemState;
  hidden: boolean;
}>;

export type OwnerReorderDirection = "up" | "down";

export type OwnerKeyboardReorder = Readonly<{
  orderedIds: readonly string[];
  title: string;
  direction: OwnerReorderDirection;
  position: number;
  siblingCount: number;
}>;

/**
 * Build a deterministic keyboard reorder without changing milestone state.
 *
 * The owner surface visually groups milestones by the public state the signed
 * artifact will render. Keyboard movement therefore stays inside that visible
 * group: an arrow never appears to do nothing by moving a row behind another
 * state heading. Hidden milestones are deliberately excluded.
 */
export function buildOwnerKeyboardReorder(
  items: readonly OwnerReorderItem[],
  sourceId: string,
  direction: OwnerReorderDirection,
): OwnerKeyboardReorder | null {
  const source = items.find((item) => item.id === sourceId);
  if (!source || source.hidden) return null;

  const siblings = items.filter(
    (item) =>
      !item.hidden &&
      item.audienceState === source.audienceState,
  );
  const sourcePosition = siblings.findIndex((item) => item.id === sourceId);
  if (sourcePosition < 0) return null;

  const targetPosition =
    direction === "up" ? sourcePosition - 1 : sourcePosition + 1;
  if (targetPosition < 0 || targetPosition >= siblings.length) return null;

  const targetId = siblings[targetPosition].id;
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  const orderedIds = items.map((item) => item.id);
  [orderedIds[sourceIndex], orderedIds[targetIndex]] = [
    orderedIds[targetIndex],
    orderedIds[sourceIndex],
  ];

  return {
    orderedIds,
    title: source.title,
    direction,
    position: targetPosition + 1,
    siblingCount: siblings.length,
  };
}
