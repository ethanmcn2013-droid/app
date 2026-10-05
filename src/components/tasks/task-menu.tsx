"use client";

/**
 * The task menu: right-click, the card's "…" or the "." key. Every act a
 * card can take lives here, including Move to, which is the no-drag path
 * across the board.
 */

import { useLabStore } from "@/components/hybrid/store";
import { useTasksDispatch } from "@/lib/tasks/tasks-context";
import { useToast } from "@/components/primitives/toast";
import { taskFocusPath } from "@/lib/product-urls";
import { useSurface } from "./surface";
import { StatusGlyph, Kbd } from "./atoms";
import { TIcon } from "./icons";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "./ui";

/** The platform's command key, read when a menu opens (client only). */
function modKey(): string {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl ";
}

export function TaskMenu() {
  const surface = useSurface();
  const menu = surface.menu;
  const task = menu ? surface.all.find((t) => t.id === menu.id) : undefined;
  return (
    <MenuRoot open={Boolean(menu && task)} onOpenChange={(open) => { if (!open) surface.closeMenu(); }} modal={false}>
      <MenuTrigger asChild>
        <span
          aria-hidden="true"
          style={{ position: "fixed", left: menu?.x ?? 0, top: menu?.y ?? 0, width: 1, height: 1, pointerEvents: "none" }}
        />
      </MenuTrigger>
      {task ? <TaskMenuItems id={task.id} /> : null}
    </MenuRoot>
  );
}

function TaskMenuItems({ id }: { id: string }) {
  const surface = useSurface();
  const store = useLabStore();
  const prod = useTasksDispatch();
  const { toast } = useToast();
  const task = surface.all.find((t) => t.id === id);
  if (!task) return null;
  const done = surface.isDone(task);
  const ro = surface.readOnly;
  const anchor = () => document.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);

  return (
    <MenuContent align="start" width={232} label={`Actions for ${task.title}`}>
      <MenuItem icon={<TIcon.open />} hint={<Kbd>↵</Kbd>} onSelect={() => store.openTask(id)}>Open</MenuItem>
      {ro ? null : (
        <>
          <MenuItem icon={<TIcon.pencil />} hint={<Kbd>E</Kbd>} onSelect={() => surface.setRenaming(id)}>Rename</MenuItem>
          <MenuItem icon={<TIcon.check />} hint={<Kbd>{modKey()}↵</Kbd>} onSelect={() => surface.complete(id)}>{done ? "Reopen" : "Mark done"}</MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger icon={<TIcon.arrowRight />} hint={<Kbd>S</Kbd>}>Move to</MenuSubTrigger>
            <MenuSubContent width={220}>
              {surface.columns.map((column) => (
                <MenuItem
                  key={column.key}
                  icon={<StatusGlyph column={column} size={14} />}
                  hint={column.key === task.status ? <TIcon.check size={14} /> : null}
                  disabled={column.key === task.status}
                  onSelect={() => surface.move(id, column.key)}
                >
                  {column.name}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
          <MenuItem icon={<TIcon.person />} hint={<Kbd>A</Kbd>} onSelect={() => surface.openPicker("assignee", [id], anchor())}>Assign</MenuItem>
          <MenuItem icon={<TIcon.calendar />} hint={<Kbd>D</Kbd>} onSelect={() => surface.openPicker("due", [id], anchor())}>Due date</MenuItem>
          <MenuItem icon={<TIcon.flag />} hint={<Kbd>P</Kbd>} onSelect={() => surface.openPicker("priority", [id], anchor())}>Priority</MenuItem>
          <MenuItem icon={<TIcon.tag />} hint={<Kbd>L</Kbd>} onSelect={() => surface.openPicker("labels", [id], anchor())}>Labels</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<TIcon.duplicate />} hint={<Kbd>{modKey()}D</Kbd>} onSelect={() => store.duplicateTask(id)}>Duplicate</MenuItem>
        </>
      )}
      <MenuItem
        icon={<TIcon.link />}
        onSelect={() => {
          const url = `${window.location.origin}${taskFocusPath(id)}`;
          void navigator.clipboard.writeText(url).then(
            () => toast("Link copied", { tone: "success", body: "Anyone in this project can open it." }),
            () => toast("Couldn't copy", { tone: "error" }),
          );
        }}
      >
        Copy link
      </MenuItem>
      {ro ? null : (
        <>
          <MenuItem icon={<TIcon.archive />} onSelect={() => prod.archiveTask(id)}>Archive</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<TIcon.trash />} danger onSelect={() => surface.requestDelete([id])}>Delete</MenuItem>
        </>
      )}
    </MenuContent>
  );
}
