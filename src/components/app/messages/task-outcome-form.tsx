"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationResult } from "@/lib/conversations/contracts";
import type { ProjectId } from "@/lib/projects/project-ref";
import { isCalendarDate, type CalendarDate } from "@/lib/planning/dates";
import { taskFocusPath } from "@/lib/product-urls";
import styles from "./task-outcome-form.module.css";

type Destination = Readonly<{ projectId: ProjectId; name: string; members: readonly { id: string; name: string }[] }>;
export type TaskOutcomeRequest = Readonly<{
  clientRequestId: string; sourceProjectId: ProjectId; conversationId: string; messageId: string;
  expectedRevision: number; expectedAudienceEpoch: number; destinationProjectId: ProjectId;
  title: string; ownerUserId: string; dueDate: CalendarDate;
}>;
export type TaskOutcomeResult = Readonly<{ taskId: string; workLinkId: string; clientRequestId: string; committedAt: number; taskAvailable?: boolean }>;
type Props = Readonly<{
  open: boolean; actorId: string; onClose: () => void;
  source: Pick<TaskOutcomeRequest, "sourceProjectId" | "conversationId" | "messageId" | "expectedRevision" | "expectedAudienceEpoch">;
  projects: readonly { id: ProjectId; name: string }[];
  loadDestination: (projectId: ProjectId, signal: AbortSignal) => Promise<ConversationResult<Destination>>;
  submit: (input: TaskOutcomeRequest) => Promise<ConversationResult<TaskOutcomeResult>>;
  onCreated: (result: TaskOutcomeResult) => void;
  fixture?: boolean;
}>;

/** Keep mounted while closed so an uncertain operation retains its original identity. */
export function TaskOutcomeForm(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [destinationId, setDestinationId] = useState(props.source.sourceProjectId);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [date, setDate] = useState("");
  const [attempt, setAttempt] = useState<TaskOutcomeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskOutcomeResult | null>(null);
  const [sourceChanged, setSourceChanged] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const attempted = useRef<TaskOutcomeRequest | null>(null);
  const loader = useRef(props.loadDestination);
  useEffect(() => { loader.current = props.loadDestination; }, [props.loadDestination]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (props.open && !node.open) node.showModal();
    if (!props.open && node.open) node.close();
    return () => { if (node.open) node.close(); };
  }, [props.open]);
  useEffect(() => {
    if (!props.open || attempt || result) return;
    const controller = new AbortController();
    void loader.current(destinationId, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      if (!value.ok) { setError("This Project is unavailable for a new task."); return; }
      setDestination(value.value);
      setOwner(value.value.members.some((member) => member.id === props.actorId) ? props.actorId : "");
    }).catch(() => { if (!controller.signal.aborted) setError("Could not load this Project. Choose a Project again to retry."); });
    return () => controller.abort();
  }, [attempt, destinationId, props.actorId, props.open, result]);

  async function create() {
    if (inFlight.current || result || sourceChanged) return;
    if (!attempt && (!destination || !title.trim() || !owner || !isCalendarDate(date))) return;
    const input = attempted.current ?? { ...props.source, clientRequestId: `task_${crypto.randomUUID().replaceAll("-", "")}`, destinationProjectId: destinationId, title, ownerUserId: owner, dueDate: date as CalendarDate };
    attempted.current = input; inFlight.current = true;
    setAttempt(input); setBusy(true); setError(null);
    try {
      // The receiving transport looks up this request before retrying a mutation.
      const response = await props.submit(input);
      if (!mounted.current) return;
      if (response.ok) { setResult(response.value); props.onCreated(response.value); return; }
      if (response.code === "temporarily_unavailable" || response.code === "rate_limited") {
        setError("The outcome is still unknown. Check again to recover this same task.");
      } else {
        attempted.current = null;
        setAttempt(null);
        setSourceChanged(response.code === "audience_changed" || response.code === "revision_conflict");
        setError(response.code === "audience_changed" || response.code === "revision_conflict"
          ? "The source changed. Close this form and review the message and audience before creating a task."
          : response.code === "read_only" ? "Creating tasks from messages is currently paused."
          : "This task could not be created. Check the Project, owner and source access.");
      }
    } catch { if (mounted.current) setError("The outcome is unknown. Check again before starting another task."); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  const locked = busy || attempt !== null;
  return <dialog ref={dialog} className={styles.dialog} aria-label="Create a task from this message" onCancel={(event) => { event.preventDefault(); if (!locked) props.onClose(); }}>
    <form onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <header><span>Discussion → action</span><h2>{result ? "Task created" : "Give the outcome a next step"}</h2><p>{result ? result.taskAvailable === false ? "This request created a task earlier. That task is no longer available; another task has not been created." : "The task and its source link are saved together." : "Write the task you want to create, then choose its Project, owner and date."}</p></header>
      {!result ? <fieldset disabled={locked}>
        <label>Task name<input autoComplete="off" maxLength={1000} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to happen?" /></label>
        <label>Project<select value={destinationId} onChange={(event) => { setDestination(null); setOwner(""); setError(null); setDestinationId(event.target.value as ProjectId); }}>{props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        {destination ? <p className={styles.audience}>Visible to {destination.members.length} current members of {destination.name}. The source conversation keeps its own access rules.</p> : <p className={styles.audience}>Loading the Project’s members…</p>}
        <div className={styles.fields}><label>Owner<select required value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Choose a person</option>{destination?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label>Due date<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
      </fieldset> : <p className={styles.saved}>{attempt?.title ?? title}</p>}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <footer><button type="button" onClick={props.onClose} disabled={locked && !result}>{result ? "Done" : "Cancel"}</button>{result ? (!props.fixture && result.taskAvailable !== false ? <a href={taskFocusPath(result.taskId)}>Open task</a> : null) : <button className={styles.primary} type="submit" disabled={busy || sourceChanged || (!attempt && (!destination || !title.trim() || !owner || !isCalendarDate(date)))}>{busy ? "Checking…" : attempt ? "Check outcome" : "Create task"}</button>}</footer>
    </form>
  </dialog>;
}
