"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import { clearAllTasksAction } from "@/server/actions/seed";
import { deleteWorkspaceAction } from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";

export function DangerSection({
  myRole,
  workspaceName,
}: {
  myRole: "owner" | "member" | "none";
  workspaceName: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const isOwner = myRole === "owner";

  function clearAllTasks() {
    setClearOpen(false);
    startTransition(async () => {
      try {
        await clearAllTasksAction();
        toast("Tasks cleared", {
          tone: "success",
          body: "Workspace is back to empty. Members and billing untouched.",
        });
      } catch (e) {
        toast("Couldn't clear", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function deleteWorkspace() {
    if (confirmText !== workspaceName) return;
    setDeleteOpen(false);
    setConfirmText("");
    startTransition(async () => {
      try {
        await deleteWorkspaceAction();
        toast("Workspace deleted", { tone: "success" });
        // Bounce to /app — the layout will re-resolve the active
        // workspace (or punt to /welcome for fresh users).
        router.push("/app/board");
        router.refresh();
      } catch (e) {
        toast("Couldn't delete", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Danger zone"
        title="Things you can't undo"
        description="The button-colored-red kind. We make you confirm because we're not in the business of regret."
      />

      <div className="space-y-4">
        {/* Clear tasks */}
        <DangerCard
          title="Clear all tasks"
          description="Wipes every task, comment, and activity in this workspace. Members, billing, and the workspace itself stick around. The starter pack stays cleared until you re-seed."
          buttonLabel="Clear tasks"
          disabled={pending || !isOwner}
          tone="amber"
          onClick={() => setClearOpen(true)}
          gateNote={!isOwner ? "Only the owner can do this." : null}
        />

        {/* Delete workspace */}
        {isOwner ? (
          <DangerCard
            title="Delete this workspace"
            description={
              "Erases the workspace and everything in it — tasks, comments, members, share links, the whole shape. There is no undo."
            }
            buttonLabel="Delete workspace"
            disabled={pending}
            tone="rose"
            onClick={() => setDeleteOpen(true)}
          />
        ) : (
          <div className="rounded-xl border border-line-soft bg-bg-sunken/40 p-5 text-[12.5px] text-ink-quiet">
            Only the owner sees the delete-workspace control. That&apos;s
            on purpose.
          </div>
        )}
      </div>

      {/* Clear-tasks confirmation */}
      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        labelledBy="clear-tasks-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Confirm
          </div>
          <h3
            id="clear-tasks-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Clear every task in {workspaceName}?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            All tasks, comments, and activity in this workspace get
            deleted. Members and billing are untouched. The starter
            pack resets so you can pick a fresh one.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setClearOpen(false)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Never mind
            </button>
            <button
              type="button"
              onClick={clearAllTasks}
              disabled={pending}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
            >
              {pending ? "Clearing…" : "Clear all tasks"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete-workspace confirmation — type-to-confirm */}
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText("");
        }}
        labelledBy="delete-ws-title"
        width={460}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose-700">
            Final answer required
          </div>
          <h3
            id="delete-ws-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Delete {workspaceName}?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            This wipes the workspace and everything inside it.
            Type{" "}
            <span className="rounded bg-bg-sunken px-1 py-0.5 font-mono text-[12px] text-ink">
              {workspaceName}
            </span>{" "}
            to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspaceName}
            className="mt-3 w-full rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(false);
                setConfirmText("");
              }}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={deleteWorkspace}
              disabled={pending || confirmText !== workspaceName}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function DangerCard({
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
  tone,
  gateNote,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "amber" | "rose";
  gateNote?: string | null;
}) {
  const ring =
    tone === "rose"
      ? "border-rose-200 bg-rose-50/40"
      : "border-amber-200 bg-amber-50/40";
  const button =
    tone === "rose"
      ? "border-rose-300 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50"
      : "border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-50";
  return (
    <div
      className={
        "flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-start sm:justify-between " +
        ring
      }
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        <p className="mt-1 max-w-[560px] text-[12.5px] leading-[1.55] text-ink-soft">
          {description}
        </p>
        {gateNote ? (
          <p className="mt-1.5 text-[11.5px] text-ink-quiet">{gateNote}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          "flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 " +
          button
        }
      >
        {buttonLabel}
      </button>
    </div>
  );
}
