/**
 * Automations drafts, kept in this browser only.
 *
 * There is no service behind Automations yet, so a draft lives in
 * localStorage under one key. If the browser will not allow storage (private
 * windows, blocked site data) the drafts are held in memory for as long as
 * the tab is open, and the editor says so instead of claiming they are saved.
 *
 * Shaped for `useSyncExternalStore`: `subscribe`, a cached snapshot, and a
 * server snapshot that is always "not read yet".
 */
import { parseDrafts, serializeDrafts, type Automation } from "./graph";

export const DRAFTS_KEY = "signal:automations:v1";

export type DraftsSnapshot = Readonly<{
  drafts: readonly Automation[];
  /** False when the last write did not reach the browser's storage. */
  kept: boolean;
}>;

let snapshot: DraftsSnapshot | null = null;
const listeners = new Set<() => void>();

function read(): DraftsSnapshot {
  try {
    const drafts = parseDrafts(window.localStorage.getItem(DRAFTS_KEY));
    return { drafts, kept: true };
  } catch {
    return { drafts: snapshot?.drafts ?? [], kept: false };
  }
}

function write(drafts: readonly Automation[]): void {
  let kept = true;
  try {
    window.localStorage.setItem(DRAFTS_KEY, serializeDrafts(drafts));
  } catch {
    kept = false;
  }
  snapshot = { drafts, kept };
  for (const listener of listeners) listener();
}

export function getDraftsSnapshot(): DraftsSnapshot {
  if (!snapshot) snapshot = read();
  return snapshot;
}

/** Before the browser has been asked: the server and first paint. */
export function getServerDraftsSnapshot(): DraftsSnapshot | null {
  return null;
}

export function subscribeDrafts(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== DRAFTS_KEY) return;
    snapshot = read();
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveDraft(doc: Automation): void {
  const drafts = getDraftsSnapshot().drafts;
  const exists = drafts.some((draft) => draft.id === doc.id);
  write(exists ? drafts.map((draft) => (draft.id === doc.id ? doc : draft)) : [doc, ...drafts]);
}

export function deleteDraft(id: string): void {
  write(getDraftsSnapshot().drafts.filter((draft) => draft.id !== id));
}
