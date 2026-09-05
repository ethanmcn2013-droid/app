"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DataPrivacy } from "./profile/data-privacy";
import { projectRecoveryPath, type ProjectRecovery, type RecoveryActionResult, type RecoveryCursor } from "@/lib/projects/recovery";

const control = "inline-flex min-h-[44px] items-center justify-center rounded-md border border-line bg-bg-elevated px-3 py-2 text-[12.5px] font-medium text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const card = "mt-5 rounded-lg border border-line-soft bg-bg-elevated p-5";

export function ProjectRecoveryPanel({ recovery, cursor = {}, action, preview = false }: {
  recovery: ProjectRecovery;
  cursor?: RecoveryCursor;
  action: (form: FormData) => Promise<RecoveryActionResult>;
  preview?: boolean;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleted, setDeleted] = useState(false);
  const { tasks, timeline, projectId } = recovery;

  async function perform(operation: string, values: Record<string, string> = {}) {
    if (busy.current || !projectId || preview) return;
    busy.current = true;
    setPending(true); setMessage(""); setError(false);
    const form = new FormData();
    form.set("projectId", projectId); form.set("operation", operation);
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    try {
      const result = await action(form);
      if (!result.ok) { setError(true); setMessage(result.message); return; }
      if (result.deleted) { setDeleted(true); setMessage("Project deleted."); router.refresh(); }
      else { setMessage("Access withdrawn. The controls are refreshing."); router.refresh(); }
    } catch { setError(true); setMessage("That change could not be completed. Try again."); }
    finally { busy.current = false; setPending(false); }
  }

  function more(section: keyof RecoveryCursor, next: number | null) {
    return projectId && next ? <a className={control} href={projectRecoveryPath(projectId, { ...cursor, [section]: next })}>More {section === "publications" ? "publications" : section === "files" ? "files" : "shared links"}</a> : null;
  }

  return <div aria-busy={pending}>
    <h1 className="text-[22px] font-semibold tracking-tight text-ink">Project recovery</h1>
    <p className="mt-2 text-[13px] leading-relaxed text-ink-quiet">Recover your files, withdraw public access or remove a project you own. These controls do not load the project’s tasks or published content.</p>
    {preview ? <p role="status" className="mt-4 text-[13px] text-ink-soft">Recovery controls are read-only in this preview.</p> : null}
    {message ? <p role={error ? "alert" : "status"} className="mt-4 rounded-md border border-line p-3 text-[13px] text-ink">{message}</p> : null}
    {pending ? <p role="status" className="mt-2 text-[13px] text-ink-soft">Saving…</p> : null}
    {!deleted && tasks.kind === "unavailable" && timeline.kind === "unavailable" ? <section className={card}>
      <h2 className="text-[15px] font-semibold text-ink">Project controls aren’t available</h2>
      <p className="mt-2 text-[13px] text-ink-quiet">Check this link and your account, or refresh to try again. Your account settings remain available below.</p>
      <button className={`${control} mt-3`} onClick={() => router.refresh()} disabled={pending}>Refresh recovery</button>
    </section> : null}
    {!deleted && tasks.kind === "ready" ? <>
      <section className={card}>
        <h2 className="text-[16px] font-semibold text-ink">{tasks.project.name}</h2>
        {tasks.project.archived ? <p className="mt-1 text-[12px] text-ink-quiet">Archived project</p> : null}
        {tasks.deletionPending ? <p role="status" className="mt-3 text-[13px] text-ink">Project removal is still in progress. The primary owner can retry below.</p> : null}
        <p className="mt-3 text-[13px] text-ink-quiet">Public board: {tasks.published ? "published" : "not published"}.</p>
        {tasks.canUnpublish ? <button className={`${control} mt-3`} disabled={pending || !tasks.published || tasks.deletionPending} onClick={() => perform("unpublish-board")}>Unpublish board</button> : null}
        <h3 className="mt-5 text-[14px] font-semibold text-ink">Shared Tasks links</h3>
        {!tasks.links.items.length ? <p className="mt-2 text-[13px] text-ink-quiet">No links on this page.</p> : null}
        <ul className="mt-2 divide-y divide-line-soft">{tasks.links.items.map(link => <li key={link.fingerprint} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="text-[13px] text-ink-soft">Created {link.createdAt.slice(0, 10)} · {link.state}</span>
          <button className={control} disabled={pending || link.state === "revoked" || tasks.deletionPending} onClick={() => perform("revoke-task-link", { row: String(link.row), fingerprint: link.fingerprint })}>Revoke link</button>
        </li>)}</ul>
        {more("links", tasks.links.next)}
      </section>
      {tasks.canDelete ? <section className={card}>
        <h2 className="text-[15px] font-semibold text-ink">Uploaded files</h2>
        <p className="mt-2 text-[13px] text-ink-quiet">Download files stored in this project individually. Google Drive files stay in Drive; this is not a Drive backup. Each download checks your current access again.</p>
        <ul className="mt-3 space-y-2">{tasks.files.items.map(file => <li key={file.id}>
          <a className={`${control} max-w-full break-all text-left`} href={`/api/attachments/${encodeURIComponent(file.id)}`} download>Download {file.filename}</a>
        </li>)}</ul>
        {!tasks.files.items.length ? <p className="mt-3 text-[13px] text-ink-quiet">No uploaded files on this page.</p> : null}
        <div className="mt-3">{more("files", tasks.files.next)}</div>
      </section> : null}
    </> : null}
    {!deleted && tasks.kind === "unavailable" && timeline.kind === "ready" ? <p role="status" className="mt-5 text-[13px] text-ink-quiet">Tasks recovery controls aren’t available for this account and project. Refresh to try again.</p> : null}
    {timeline.kind === "unavailable" && tasks.kind === "ready" ? <p role="status" className="mt-5 text-[13px] text-ink-quiet">Timeline recovery controls aren’t available for this account and project. Refresh to try again.</p> : null}
    {timeline.kind === "ready" ? <section className={card}>
      <h2 className="text-[15px] font-semibold text-ink">Published Timeline controls</h2>
      <p className="mt-2 text-[13px] text-ink-quiet">These publications belong to your Timeline account and record this project as their source. Revoke every active link for a publication, or unpublish it. No published content is loaded here.</p>
      <ul className="mt-3 divide-y divide-line-soft">{timeline.publications.items.map(publication => <li key={publication.id} className="py-3">
        <p className="text-[13px] text-ink-soft">Created {publication.createdAt.slice(0, 10)} · {publication.state}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={control} disabled={pending} onClick={() => perform("revoke-timeline", { publicationId: publication.id })}>Revoke publication links</button>
          <button className={control} disabled={pending || publication.state === "unpublished"} onClick={() => perform("unpublish-timeline", { publicationId: publication.id })}>Unpublish Timeline</button>
        </div>
      </li>)}</ul>
      {more("publications", timeline.publications.next)}
    </section> : null}
    {!deleted && tasks.kind === "ready" && tasks.canDelete ? <section className={card}>
      <h2 className="text-[15px] font-semibold text-ink">Delete this project</h2>
      <p className="mt-2 text-[13px] text-ink-quiet">Only the primary owner can permanently remove it. Download what you need first. If removal cannot finish, the project is not reported as deleted; return here to retry.</p>
      <label className="mt-4 block text-[13px] text-ink" htmlFor="recovery-confirmation">Type “{tasks.project.name}” to confirm</label>
      <input id="recovery-confirmation" className="mt-2 block min-h-[44px] w-full rounded-md border border-line bg-bg-elevated px-3 text-[14px] text-ink" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={pending} autoComplete="off" />
      <button className={`${control} mt-3`} disabled={pending || confirmation !== tasks.project.name} onClick={() => perform("delete-project", { confirmation })}>{tasks.deletionPending ? "Retry project removal" : "Delete project"}</button>
    </section> : null}
    <DataPrivacy />
    <p className="mt-4"><a className={control} href="/settings/profile">Account settings and deletion</a></p>
  </div>;
}
