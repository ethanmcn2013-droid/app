"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";

type WorkspaceOption = Readonly<{
  id: string;
  name: string;
}>;

/** Persistent workspace choice across every Tasks view. */
export function WorkspaceContextBar({
  activeWorkspaceId,
  workspaces,
}: {
  activeWorkspaceId: string;
  workspaces: readonly WorkspaceOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(activeWorkspaceId);

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft/70 bg-bg px-4 sm:px-6">
      <label className="flex min-w-0 items-center gap-2 text-[12px] text-ink-quiet">
        <span className="hidden sm:inline">Workspace</span>
        <select
          aria-label="Current workspace"
          value={value}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            startTransition(async () => {
              await selectWorkspaceAction(next);
              router.refresh();
            });
          }}
          className="min-h-9 max-w-[min(70vw,24rem)] rounded-lg border border-line-soft bg-bg-elevated px-3 text-[13px] font-medium text-ink outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-wait disabled:opacity-60"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      <a
        href="/app/your-work"
        className="rounded-md px-2 py-1.5 text-[12px] font-medium text-ink-soft outline-none transition-colors hover:bg-bg-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        Your work
      </a>
    </div>
  );
}
