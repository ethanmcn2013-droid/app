"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { buildProjectUrl, type ProjectDestination } from "@/lib/projects/project-url";
import type { ProjectId, ProjectRole } from "@/lib/projects/project-ref";
import { PROJECT_COLOR_CHANGED_EVENT, PROJECT_ROWS_CHANGED_EVENT, PROJECT_COLOR_INDICES, projectColorToken, type ProjectColorIndex } from "@/lib/projects/project-appearance";
import { archiveProjectAction, restoreProjectAction, deleteProjectAction } from "@/server/actions/planning";
import { renameProjectFromMenuAction, setProjectColorAction } from "@/server/actions/project-menu";
import { useActiveProject } from "@/components/app/active-project-provider";
import { useUnsavedWorkClaims } from "@/components/app/unsaved-work-context";
import { Dialog } from "@/components/primitives/dialog";
import { HeaderInvite } from "@/components/tasks/header-invite";
import { useToast } from "@/components/primitives/toast";
import styles from "./project-context-menu.module.css";

type Panel = "rename" | "color" | "invite" | "delete" | null;

/** Both menu entry points share canonical Project actions and the unsaved-work guard. */
export function ProjectContextMenu({ projectId, projectName, role, colorIndex, archived = false, children }: {
  projectId: ProjectId; projectName: string; role?: ProjectRole; colorIndex?: ProjectColorIndex; archived?: boolean; children: ReactNode;
}) {
  const router = useRouter();
  const active = useActiveProject();
  const claims = useUnsavedWorkClaims();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState(projectName);
  const [confirmation, setConfirmation] = useState("");
  const [color, setColor] = useState<ProjectColorIndex | null>(colorIndex ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closePanel = useCallback(() => { if (!pending) setPanel(null); }, [pending]);
  const canManage = role === "primary-owner" || role === "owner";
  const project = buildProjectUrl({ surface: "project" }, projectId, projectName);
  const refresh = () => { window.dispatchEvent(new Event(PROJECT_ROWS_CHANGED_EVENT)); router.refresh(); };
  const held = () => {
    if (!claims.length) return false;
    toast("Save your work first", { body: "Finish or save the open draft before leaving, archiving or deleting a project.", tone: "warn" });
    return true;
  };
  const go = (destination: ProjectDestination) => {
    if (held()) return;
    if (archived) { router.push(project); return; }
    if (active) active.selectProject({ id: projectId, name: projectName }, destination);
    else router.push(buildProjectUrl(destination, projectId, projectName));
  };
  const show = (next: Panel) => { setError(null); setName(projectName); setConfirmation(""); setColor(colorIndex ?? null); setPanel(next); };
  const run = (effect: () => Promise<void>) => {
    if (pending) return;
    setError(null);
    startTransition(async () => { try { await effect(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Couldn’t save. Try again."); } });
  };
  const archive = () => {
    if (held()) return;
    run(async () => {
      await archiveProjectAction(projectId);
      // Callback lives in the toast provider, surviving this archived row’s removal.
      toast("Project archived", { body: `${projectName}. Its tasks and history are kept.`, duration: 10000, action: { label: "Undo archive", onClick: () => {
        void restoreProjectAction(projectId).then(() => { refresh(); toast("Project restored"); }).catch(() => toast("Couldn’t restore the project", { body: "Try again from Projects.", tone: "error" }));
      } } });
      refresh();
      if (active?.chrome.kind === "verified" && active.chrome.project.id === projectId) router.push("/app/home");
    });
  };
  const actions = [
    { label: "Open project", run: () => go({ surface: "project" }) },
    ...(!archived ? [
    { label: "Open Tasks", run: () => go({ surface: "tasks" }) },
    { label: "Open Timeline", run: () => go({ surface: "timeline" }) },
    { label: "Open Files", run: () => { if (!held()) router.push(`/app/files?workspaceId=${encodeURIComponent(projectId)}`); } },
    ] : []),
    { label: "Copy project link", run: async () => {
      try { await navigator.clipboard.writeText(new URL(project, window.location.origin).href); toast("Project link copied"); }
      catch { toast("Couldn’t copy the link", { body: "Open the project and copy its address from your browser.", tone: "error" }); }
    } },
    ...(canManage && !archived ? [
      { label: "Change dot colour", run: () => show("color") },
      { label: "Rename", run: () => show("rename") },
      { label: "Invite people", run: () => show("invite") },
      { label: "Archive project", run: archive },
    ] : []),
    ...(canManage && archived ? [{ label: "Restore project", run: () => run(async () => { await restoreProjectAction(projectId); refresh(); toast("Project restored"); }) }] : []),
    ...(role === "primary-owner" ? [{ label: "Delete project", run: () => { if (!held()) show("delete"); } }] : []),
  ];
  return <>
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className={styles.row} data-project-actions="" data-menu-open={open || undefined} aria-busy={pending || undefined}>
          {children}
          <DropdownMenu.Root open={open} onOpenChange={setOpen}>
            <DropdownMenu.Trigger asChild><button type="button" className={styles.trigger} disabled={pending} aria-label={`More options for ${projectName}`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></svg></button></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className={styles.menu} sideOffset={4} collisionPadding={8} aria-label={`Actions for ${projectName}`}>
              <DropdownMenu.Label className={styles.label}>{projectName}</DropdownMenu.Label>
              {actions.map(action => <DropdownMenu.Item disabled={pending} className={styles.action} key={action.label} onSelect={() => { void action.run(); }}>{action.label}</DropdownMenu.Item>)}
            </DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
          {error && !panel ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal><ContextMenu.Content className={styles.menu} collisionPadding={8} aria-label={`Actions for ${projectName}`}>
        <ContextMenu.Label className={styles.label}>{projectName}</ContextMenu.Label>
        {actions.map(action => <ContextMenu.Item disabled={pending} className={styles.action} key={action.label} onSelect={() => { void action.run(); }}>{action.label}</ContextMenu.Item>)}
      </ContextMenu.Content></ContextMenu.Portal>
    </ContextMenu.Root>
    <Dialog open={panel !== null} onClose={closePanel} ariaLabel={panel === "delete" ? `Delete ${projectName}` : panel === "rename" ? `Rename ${projectName}` : panel === "color" ? `Change colour for ${projectName}` : `Invite to ${projectName}`} width={420} motionMode="instant">
      <div className={styles.panel}>
        <button type="button" disabled={pending} className={styles.close} onClick={() => setPanel(null)} aria-label="Close project action">Close</button>
        {panel === "invite" ? <HeaderInvite projectId={projectId} /> : <form onSubmit={event => {
          event.preventDefault();
          if (panel === "delete" && (confirmation !== projectName || held())) return;
          run(async () => {
            if (panel === "rename") await renameProjectFromMenuAction(projectId, name);
            else if (panel === "color") { const result = await setProjectColorAction(projectId, color); window.dispatchEvent(new CustomEvent(PROJECT_COLOR_CHANGED_EVENT, { detail: { projectId, colorIndex: result.colorIndex } })); }
            else if (panel === "delete") await deleteProjectAction(projectId);
            else return;
            setPanel(null); refresh(); toast(panel === "delete" ? "Project deleted" : panel === "rename" ? "Project renamed" : "Project colour saved");
            if (panel === "delete" && active?.chrome.kind === "verified" && active.chrome.project.id === projectId) router.push("/app/home");
          });
        }}>
          <h2>{panel === "delete" ? "Delete project?" : panel === "rename" ? "Rename project" : "Project dot colour"}</h2>
          {panel === "rename" ? <label>Project name<input value={name} onChange={event => setName(event.target.value)} maxLength={80} required disabled={pending} /></label> : panel === "color" ? <fieldset disabled={pending}><legend>Choose a colour</legend><div className={styles.palette}>{PROJECT_COLOR_INDICES.map(index => <label key={index} className={styles.swatch} style={{ background: projectColorToken(index) }}><input type="radio" name="project-color" value={index} checked={color === index} onChange={() => setColor(index)} aria-label={`Colour ${index}`} /><span aria-hidden="true">{color === index ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" /></svg> : null}</span></label>)}</div></fieldset> : <><p>This permanently deletes <strong>{projectName}</strong> and its tasks, files and history. This cannot be undone. Archive keeps them instead.</p><label>Type the project name to confirm<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={pending} /></label></>}
          <button className={styles.save} data-danger={panel === "delete" || undefined} type="submit" disabled={pending || (panel === "delete" ? confirmation !== projectName : panel === "rename" ? !name.trim() : panel === "color" ? color === null : false)}>{pending ? "Saving…" : panel === "delete" ? "Delete forever" : "Save"}</button>
        </form>}
        {error && panel ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
    </Dialog>
  </>;
}
