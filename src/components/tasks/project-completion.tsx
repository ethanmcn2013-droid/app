"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActiveWorkspace, useColumnConfig, useDomain } from "@/lib/domain-context";
import { useAuthoritativeTaskVersions } from "@/lib/tasks/tasks-context";
import { isTaskDone } from "@/lib/board-columns";
import { YOUR_WORK_APP_PATH } from "@/lib/product-urls";
import { archiveProjectAction } from "@/server/actions/planning";
import { useToast } from "@/components/primitives/toast";
import { useSurface } from "./surface";
import { Button } from "./ui";
import { justCompletedProject, type CompletionSnapshot } from "./project-completion-model";
import styles from "./project-completion.module.css";

export function ProjectCompletion() {
  const surface = useSurface();
  const project = useActiveWorkspace();
  const domain = useDomain();
  const columnConfig = useColumnConfig();
  const authoritative = useAuthoritativeTaskVersions();
  const confirmedTasks = useMemo(() => [...authoritative].map(([id, version]) => {
    const task = JSON.parse(version.signature) as { lane: string; boardColumnKey?: string | null };
    return { id, done: isTaskDone(task, columnConfig) };
  }), [authoritative, columnConfig]);
  const router = useRouter();
  const { toast } = useToast();
  const previous = useRef<CompletionSnapshot | null>(null);
  const columns = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [offer, setOffer] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const columnVersion = surface.columns.map((column) => `${column.key}:${column.isDone}`).join("|");
  const { all, isDone, readOnly } = surface;

  useEffect(() => {
    const next: CompletionSnapshot = { projectId: project?.id ?? "", tasks: confirmedTasks };
    if (project && !readOnly && columns.current === columnVersion && justCompletedProject(previous.current, next)) {
      const completed = { id: project.id, name: domain.workspaceName };
      queueMicrotask(() => { setOffer(completed); setError(null); });
    }
    if (offer && (offer.id !== next.projectId || all.some((task) => !isDone(task)) || next.tasks.some((task) => !task.done) || next.tasks.length === 0)) queueMicrotask(() => setOffer(null));
    previous.current = next;
    columns.current = columnVersion;
  }, [project, domain.workspaceName, confirmedTasks, all, isDone, readOnly, columnVersion, offer]);

  useEffect(() => {
    const node = dialog.current;
    if (offer && node && !node.open) node.showModal();
    if (!offer && node?.open) node.close();
  }, [offer]);

  const close = () => { if (!pending) setOffer(null); };
  const archive = () => {
    if (!offer || !surface.canManage || surface.readOnly || project?.id !== offer.id || surface.pulse.open !== 0 || surface.pulse.total === 0) return;
    const projectId = offer.id;
    startTransition(async () => {
      try {
        await archiveProjectAction(projectId);
        setOffer(null);
        toast("Project archived. You can restore it from Projects.");
        router.push(YOUR_WORK_APP_PATH);
      } catch {
        setError("Couldn’t archive this project. Try again, or keep it open.");
      }
    });
  };

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="project-complete-title" aria-describedby="project-complete-body"
    onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    {offer ? <>
      <div className={styles.burst} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
      <h2 id="project-complete-title">Every task is done.</h2>
      <p id="project-complete-body">{offer.name} is complete. {surface.canManage ? "Archive it to keep your workspace clear. You can restore it from Projects." : "You can keep the finished work here."}</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.actions}><Button variant="ghost" autoFocus onClick={close} disabled={pending}>Keep it open</Button>
        {surface.canManage ? <Button onClick={archive} disabled={pending}>{pending ? "Archiving…" : "Archive project"}</Button> : null}</div>
    </> : null}
  </dialog>;
}
