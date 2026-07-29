export type NotesDelightDecision =
  | "HOLD_STILL"
  | "IMMEDIATE"
  | "SUBTLE"
  | "STANDARD"
  | "PROTOTYPE";

export type NotesDelightArchetype =
  | "route-and-reading"
  | "capture"
  | "search"
  | "stream-detail"
  | "editing"
  | "approval"
  | "tasks-handoff"
  | "artifact-presence"
  | "decision-region"
  | "toast-lifecycle"
  | "system-state";

type LedgerEntry = {
  id: `NOTES-DEL-${string}`;
  decision: NotesDelightDecision;
  archetype: NotesDelightArchetype;
};

/**
 * Executable mirror of the approved 2026-07-29 exhaustive Notes interaction
 * ledger. HOLD_STILL and IMMEDIATE are implementation requirements: they
 * prevent later polish passes from adding motion to high-frequency writing,
 * search, error, permission, loading, or reading states.
 */
export const NOTES_DELIGHT_LEDGER = [
  { id: "NOTES-DEL-001", decision: "HOLD_STILL", archetype: "route-and-reading" },
  { id: "NOTES-DEL-002", decision: "HOLD_STILL", archetype: "capture" },
  { id: "NOTES-DEL-003", decision: "HOLD_STILL", archetype: "capture" },
  { id: "NOTES-DEL-004", decision: "IMMEDIATE", archetype: "capture" },
  { id: "NOTES-DEL-005", decision: "IMMEDIATE", archetype: "capture" },
  { id: "NOTES-DEL-006", decision: "HOLD_STILL", archetype: "capture" },
  { id: "NOTES-DEL-007", decision: "IMMEDIATE", archetype: "capture" },
  { id: "NOTES-DEL-008", decision: "SUBTLE", archetype: "artifact-presence" },
  { id: "NOTES-DEL-009", decision: "HOLD_STILL", archetype: "capture" },
  { id: "NOTES-DEL-010", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-011", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-012", decision: "STANDARD", archetype: "decision-region" },
  { id: "NOTES-DEL-013", decision: "IMMEDIATE", archetype: "search" },
  { id: "NOTES-DEL-014", decision: "IMMEDIATE", archetype: "search" },
  { id: "NOTES-DEL-015", decision: "HOLD_STILL", archetype: "search" },
  { id: "NOTES-DEL-016", decision: "IMMEDIATE", archetype: "search" },
  { id: "NOTES-DEL-017", decision: "HOLD_STILL", archetype: "stream-detail" },
  { id: "NOTES-DEL-018", decision: "IMMEDIATE", archetype: "stream-detail" },
  { id: "NOTES-DEL-019", decision: "PROTOTYPE", archetype: "stream-detail" },
  { id: "NOTES-DEL-020", decision: "PROTOTYPE", archetype: "stream-detail" },
  { id: "NOTES-DEL-021", decision: "IMMEDIATE", archetype: "editing" },
  { id: "NOTES-DEL-022", decision: "HOLD_STILL", archetype: "editing" },
  { id: "NOTES-DEL-023", decision: "STANDARD", archetype: "decision-region" },
  { id: "NOTES-DEL-024", decision: "STANDARD", archetype: "decision-region" },
  { id: "NOTES-DEL-025", decision: "IMMEDIATE", archetype: "approval" },
  { id: "NOTES-DEL-026", decision: "PROTOTYPE", archetype: "approval" },
  { id: "NOTES-DEL-027", decision: "IMMEDIATE", archetype: "approval" },
  { id: "NOTES-DEL-028", decision: "PROTOTYPE", archetype: "tasks-handoff" },
  { id: "NOTES-DEL-029", decision: "PROTOTYPE", archetype: "tasks-handoff" },
  { id: "NOTES-DEL-030", decision: "STANDARD", archetype: "decision-region" },
  { id: "NOTES-DEL-031", decision: "STANDARD", archetype: "artifact-presence" },
  { id: "NOTES-DEL-032", decision: "STANDARD", archetype: "artifact-presence" },
  { id: "NOTES-DEL-033", decision: "STANDARD", archetype: "toast-lifecycle" },
  { id: "NOTES-DEL-034", decision: "STANDARD", archetype: "artifact-presence" },
  { id: "NOTES-DEL-035", decision: "HOLD_STILL", archetype: "route-and-reading" },
  { id: "NOTES-DEL-036", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-037", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-038", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-039", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-040", decision: "STANDARD", archetype: "toast-lifecycle" },
  { id: "NOTES-DEL-041", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-042", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-043", decision: "STANDARD", archetype: "toast-lifecycle" },
  { id: "NOTES-DEL-044", decision: "HOLD_STILL", archetype: "route-and-reading" },
  { id: "NOTES-DEL-045", decision: "IMMEDIATE", archetype: "system-state" },
  { id: "NOTES-DEL-046", decision: "HOLD_STILL", archetype: "system-state" },
  { id: "NOTES-DEL-047", decision: "HOLD_STILL", archetype: "route-and-reading" },
  { id: "NOTES-DEL-048", decision: "HOLD_STILL", archetype: "system-state" },
] as const satisfies readonly LedgerEntry[];

export const NOTES_DELIGHT_DECISION_COUNTS = {
  HOLD_STILL: 21,
  IMMEDIATE: 11,
  SUBTLE: 1,
  STANDARD: 10,
  PROTOTYPE: 5,
} as const satisfies Record<NotesDelightDecision, number>;
