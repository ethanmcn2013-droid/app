import type { listSavedDrafts, SavedConversationScope } from "./conversation-client-model";

export function SavedDraftsPanel({ entries, onOpen, onDiscard }: {
  entries: ReturnType<typeof listSavedDrafts>;
  onOpen: (scope: SavedConversationScope) => void;
  onDiscard: (key: string) => void;
}) {
  return <section aria-label="Saved drafts" className="conversation-saved-drafts">
    <strong>Your 20 draft spaces are in use</strong>
    <p>Copy or discard a saved draft before starting another. Open a conversation to check uncertain sends or recover earlier text.</p>
    <div role="region" aria-label="Saved conversations" tabIndex={0}>{entries.map((entry, index) => <details key={entry.key}>
      <summary>Saved {entry.scope.kind === "dm" ? "private " : ""}{entry.scope.rootId ? "reply" : "conversation"} {index + 1}</summary>
      {entry.bodies.map((body, bodyIndex) => <textarea key={bodyIndex} aria-label={`Saved text ${index + 1}.${bodyIndex + 1}`} readOnly value={body} rows={3} />)}
      {entry.selectedPeople ? <p>{entry.selectedPeople} {entry.selectedPeople === 1 ? "person selected" : "people selected"} to notify.</p> : null}
      <button type="button" onClick={() => onOpen(entry.scope)}>Open saved conversation {index + 1}</button>
      <button disabled={entry.unresolved} type="button" onClick={() => onDiscard(entry.key)}>Discard saved draft {index + 1}</button>
      {entry.unresolved ? <p>Check this conversation’s uncertain sends and earlier drafts before discarding.</p> : null}
    </details>)}</div>
  </section>;
}
