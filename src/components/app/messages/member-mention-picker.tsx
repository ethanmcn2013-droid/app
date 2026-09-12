"use client";

import styles from "./conversation-workspace.module.css";

/** Selection uses authorized member IDs, never names parsed from message text. */
export function MemberMentionPicker({ members, actorId, selected, onChange }: Readonly<{
  members: readonly Readonly<{ id: string; name: string }>[]; actorId: string;
  selected: readonly string[]; onChange: (ids: readonly string[]) => void;
}>) {
  const available = members.filter((member) => member.id !== actorId);
  return <details className={styles.mentionPicker}>
    <summary>Notify people{selected.length ? ` · ${selected.length}` : ""}</summary>
    <div><p>Choose who needs to see this message.</p>{available.length ? available.map((member) => <label key={member.id}><input checked={selected.includes(member.id)} onChange={(event) => onChange(event.target.checked ? [...selected, member.id] : selected.filter((id) => id !== member.id))} type="checkbox" />{member.name}</label>) : <p>No other current participants.</p>}{selected.some((id) => !available.some((member) => member.id === id)) ? <button onClick={() => onChange(selected.filter((id) => available.some((member) => member.id === id)))} type="button">Remove unavailable people</button> : null}</div>
  </details>;
}
