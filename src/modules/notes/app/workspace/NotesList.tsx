"use client";

/**
 * The list body: notes in day groups with sticky headers and counts, or one
 * flat run (search results, the review queue, In Tasks). Each group skips
 * layout and paint while it is off screen (`content-visibility: auto`), so a
 * notebook of five hundred notes scrolls like one of five.
 *
 * Owns no state. The rows, their handlers and their motion come from
 * NotesWorkspace, which keeps every `use-notebook` wire in one place.
 */

import type { PresentableNote } from "@/modules/notes/lib/notes-view-model";

import styles from "./notes-workspace.module.css";

export type ListSection = {
  key: string;
  /** Null for a flat list with no heading. */
  label: string | null;
  notes: readonly PresentableNote[];
};

export function NotesList({
  sections,
  renderRow,
}: {
  sections: readonly ListSection[];
  renderRow: (note: PresentableNote) => React.ReactNode;
}) {
  return (
    <>
      {sections.map((section) =>
        section.label ? (
          <section
            key={section.key}
            className={styles.group}
            aria-label={section.label}
            style={{ containIntrinsicSize: `auto ${section.notes.length * 66 + 36}px` }}
          >
            <h3 className={styles.groupLabel}>
              <span>{section.label}</span>
              <span className={styles.groupCount} aria-label={`${section.notes.length} notes`}>
                {section.notes.length}
              </span>
            </h3>
            <ul className={styles.list}>{section.notes.map(renderRow)}</ul>
          </section>
        ) : (
          <ul key={section.key} className={styles.list}>
            {section.notes.map(renderRow)}
          </ul>
        ),
      )}
    </>
  );
}
