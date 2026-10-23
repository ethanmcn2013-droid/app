import Link from "next/link";
import { listNotesForRetirement } from "@/modules/notes/server/actions/retirement";
import { taskFocusPath } from "@/lib/product-urls";
import { notesHref } from "@/modules/notes/lib/notes-view-model";
import type { ProjectId } from "@/lib/projects/project-ref";
import styles from "./notes-retirement-archive.module.css";

function title(body: string) {
  return body.split(/\r?\n/).find(line => line.trim())?.trim() || "Untitled note";
}

export async function NotesRetirementArchive({ requestedNoteId, workspaceId }: { requestedNoteId: string | null; workspaceId: ProjectId | null }) {
  const notes = await listNotesForRetirement();
  const selected = requestedNoteId ? notes.find(note => note.id === requestedNoteId) : notes[0];
  const archived = notes.filter(note => note.archivedAt !== null).length;
  return <section className={styles.archive} aria-labelledby="notes-archive-title">
    <header className={styles.header}>
      <div><h1 id="notes-archive-title">Notes archive</h1><p>Your private notes are here to read and export. Editing and new captures are closed.</p></div>
      <a className={styles.export} href="/api/account/export">Export my account data</a>
    </header>
    <p className={styles.summary}>{archived} archived · {notes.length - archived} retained · Only you can read these notes. Saved notes in Chat is unchanged.</p>
    <div className={styles.columns}>
      <nav className={styles.list} aria-label="Your retained notes">
        {notes.length === 0 ? <p>No notes are stored here.</p> : notes.map(note => <Link key={note.id} href={notesHref("notebook",note.id,workspaceId)} className={styles.row} aria-current={selected?.id === note.id ? "page" : undefined}>
          <span>{title(note.body)}</span><small>{note.archivedAt === null ? "Retained · read-only" : "Archived"}</small>
        </Link>)}
      </nav>
      <article className={styles.reader} aria-label="Note contents">
        {selected ? <>
          <p className={styles.state}>{selected.archivedAt === null ? "Retained · read-only" : "Archived"}</p>
          <h2>{title(selected.body)}</h2>
          <time dateTime={new Date(selected.createdAt).toISOString()}>{new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeZone: "UTC" }).format(selected.createdAt)}</time>
          <div className={styles.body}>{selected.body}</div>
          {selected.extractBody ? <section className={styles.extract}><h3>Approved action</h3><p>{selected.extractBody}</p></section> : null}
          {selected.promotedTaskId ? <Link className={styles.task} href={taskFocusPath(selected.promotedTaskId)}>Open linked task</Link> : null}
        </> : <p>{requestedNoteId ? "This note isn’t available in your archive. Choose a note from the list." : "Your notes will appear here."}</p>}
      </article>
    </div>
  </section>;
}
