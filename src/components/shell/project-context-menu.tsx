"use client";

import { useState, type ReactNode } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { buildProjectUrl } from "@/lib/projects/project-url";
import type { ProjectId } from "@/lib/projects/project-ref";
import { useToast } from "@/components/primitives/toast";
import styles from "./project-context-menu.module.css";

/** Both entry points use the same actions; project lifecycle stays in Settings. */
export function ProjectContextMenu({ projectId, projectName, children }: {
  projectId: ProjectId; projectName: string; children: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const project = buildProjectUrl({ surface: "project" }, projectId, projectName);
  const actions = [
    { label: "Open project", run: () => router.push(project) },
    { label: "Open Tasks", run: () => router.push(buildProjectUrl({ surface: "tasks" }, projectId, projectName)) },
    { label: "Open Timeline", run: () => router.push(buildProjectUrl({ surface: "timeline" }, projectId, projectName)) },
    { label: "Open Files", run: () => router.push(`/app/files?workspaceId=${encodeURIComponent(projectId)}`) },
    { label: "Copy project link", run: async () => {
      try {
        await navigator.clipboard.writeText(new URL(project, window.location.origin).href);
        toast("Project link copied");
      } catch { toast("Couldn't copy the link", { body: "Open the project and copy its address from your browser.", tone: "error" }); }
    } },
  ];
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className={styles.row} data-project-actions="" data-menu-open={open || undefined}>
          {children}
          <DropdownMenu.Root open={open} onOpenChange={setOpen}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className={styles.trigger} aria-label={`More options for ${projectName}`}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="8" r="1"/></svg>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className={styles.menu} sideOffset={4} collisionPadding={8} aria-label={`Actions for ${projectName}`}>
              <DropdownMenu.Label className={styles.label}>{projectName}</DropdownMenu.Label>
              {actions.map(action => <DropdownMenu.Item className={styles.action} key={action.label} onSelect={() => { void action.run(); }}>{action.label}</DropdownMenu.Item>)}
            </DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal><ContextMenu.Content className={styles.menu} collisionPadding={8} aria-label={`Actions for ${projectName}`}>
        <ContextMenu.Label className={styles.label}>{projectName}</ContextMenu.Label>
        {actions.map(action => <ContextMenu.Item className={styles.action} key={action.label} onSelect={() => { void action.run(); }}>{action.label}</ContextMenu.Item>)}
      </ContextMenu.Content></ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
