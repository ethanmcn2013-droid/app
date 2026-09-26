"use client";

/**
 * The data host for the Tasks surface.
 *
 * Backs the Tasks workspace with real project data: it installs the runtime
 * people and label registries (so cards resolve faces and label names on
 * first paint) and mounts HybridStoreProvider, which routes every mutation
 * through the production dispatchers (optimistic, persisted, synced). The
 * page itself is TasksWorkspace (src/components/tasks/tasks-workspace.tsx).
 */

import { useMemo } from "react";
import { useTagDefs, useWorkspaceMembers } from "@/lib/domain-context";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import type { TasksViewId } from "@/lib/product-urls";
import { HybridStoreProvider } from "./hybrid-store";
import { setRuntimeLabels, setRuntimePeople } from "./fixtures";
import { tagToLabel, userToPerson } from "./adapter";
import type { LabLabel, LabPerson } from "./types";

export type HybridWorkspaceProps = {
  view: TasksViewId;
  /** False when the verified project does not let this person edit tasks. */
  canEdit?: boolean;
  /** True when this person manages the project (columns, invites). */
  canManage?: boolean;
  people?: LabPerson[];
  labels?: LabLabel[];
};

export function HybridWorkspace({ view, canEdit = true, canManage = true, people, labels }: HybridWorkspaceProps) {
  const tagDefs = useTagDefs();
  const memberMeta = useWorkspaceMembers();

  // Labels come from the project's tag definitions so chips render in their
  // real colours; people come from real members so the assign picker offers
  // colleagues, never fixtures. An empty roster reads as empty.
  const resolvedLabels = useMemo<LabLabel[]>(
    () => labels ?? tagDefs.map((tag) => tagToLabel(tag.name, tag.color)),
    [labels, tagDefs],
  );
  const resolvedPeople = useMemo<LabPerson[]>(
    () =>
      people ??
      memberMeta.map((member) =>
        userToPerson(member.id, {
          name: member.name,
          initials: member.initials,
          color: member.color,
          role: member.role === "owner" ? "Owner" : "",
        }),
      ),
    [people, memberMeta],
  );
  // Card and row render read these registries synchronously, so the install
  // lands before children render. The setters are idempotent and the memo is
  // keyed to the rosters, so this runs only when a roster actually changes.
  useMemo(() => {
    setRuntimeLabels(resolvedLabels);
    setRuntimePeople(resolvedPeople);
  }, [resolvedLabels, resolvedPeople]);

  return (
    <HybridStoreProvider readOnly={!canEdit}>
      <TasksWorkspace view={view} readOnly={!canEdit} canManage={canManage && canEdit} />
    </HybridStoreProvider>
  );
}
