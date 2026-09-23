"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import { clearAllTasksAction, seedDomainAction } from "@/server/actions/seed";
import { deleteWorkspaceAction } from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";
import { projectRecoveryPath } from "@/lib/projects/recovery";

export function DangerSection({
  myRole,
  workspaceName,
  projectId,
}: {
  myRole: "owner" | "member" | "none";
  workspaceName: string;
  /**
   * The Project this panel was rendered for — the same one `workspaceName`
   * came from, and therefore the same one the confirm-by-typing modal asks the
   * operator to name. Passed to the destructive actions so they cannot land in
   * whichever Project the ambient cookie has drifted to since this page
   * rendered (ADR 0001 §9).
   */
  projectId: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [weddingOpen, setWeddingOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const isOwner = myRole === "owner";

  function loadWeddingDemo() {
    setWeddingOpen(false);
    startTransition(async () => {
      try {
        await seedDomainAction("wedding", projectId ?? undefined);
        toast("Wedding demo loaded", {
          tone: "success",
          body: "This workspace now holds the wedding sample tasks.",
        });
        router.refresh();
      } catch (e) {
        toast("Couldn’t load the demo", {
          tone: "error",
          body: (e as Error).message,
        });
      }
    });
  }

  function clearAllTasks() {
    setClearOpen(false);
    startTransition(async () => {
      try {
        await clearAllTasksAction(projectId ?? undefined);
        toast("Tasks cleared", {
          tone: "success",
          body: "Workspace is back to empty. Members and billing untouched.",
        });
      } catch (e) {
        toast("Couldn’t clear", {
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
        await deleteWorkspaceAction(projectId ?? undefined);
        toast("Workspace deleted", { tone: "success" });
        // Bounce to /app, the layout will re-resolve the active
        // workspace (or punt to /welcome for fresh users).
        router.push("/app/tasks");
        router.refresh();
      } catch (e) {
        toast("Couldn’t delete", {
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
        title="Things you can’t undo"
        description="The button-colored-red kind. We make you confirm because we’re not in the business of regret."
      />

      {projectId ? <p className="mb-4 text-[13px] text-ink-quiet">
        <a className="underline underline-offset-4" href={projectRecoveryPath(projectId)}>Project recovery</a> keeps export, file downloads and permitted public-access controls available outside the workspace.
      </p> : null}

      <div className="space-y-4">
        {/* Load the wedding demo */}
        <DangerCard
          title="Load the wedding demo"
          description="Replaces this workspace’s tasks with the wedding sample set (venue, vendors, run-of-show). Handy for demos and screenshots. Clears the current tasks first, so treat it like a reset."
          buttonLabel="Load wedding demo"
          disabled={pending || !isOwner}
          tone="emerald"
          onClick={() => setWeddingOpen(true)}
          gateNote={!isOwner ? "Only the owner can do this." : null}
        />

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
            title="Delete this project"
            description={
              "Erases the workspace and everything in it, tasks, comments, members, share links, the whole shape. There is no undo."
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

      {/* Load-wedding-demo confirmation */}
      <Dialog
        open={weddingOpen}
        onClose={() => setWeddingOpen(false)}
        labelledBy="wedding-demo-title"
        width={440}
      >
        <div className="px-5 py-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Confirm
          </div>
          <h3
            id="wedding-demo-title"
            className="mt-1 text-[17px] font-semibold tracking-tight"
          >
            Load the wedding demo into {workspaceName}?
          </h3>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
            This clears the current tasks and seeds the wedding sample set
            (venue, vendors, run-of-show). Members and billing are untouched.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setWeddingOpen(false)}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-ink-soft/30 hover:text-ink"
            >
              Never mind
            </button>
            <button
              type="button"
              onClick={loadWeddingDemo}
              disabled={pending}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Loading…" : "Load wedding demo"}
            </button>
          </div>
        </div>
      </Dialog>

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

      {/* Delete-workspace confirmation, type-to-confirm */}
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
  tone: "amber" | "rose" | "emerald";
  gateNote?: string | null;
}) {
  const ring =
    tone === "rose"
      ? "border-rose-200 bg-rose-50/40"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50/40"
        : "border-amber-200 bg-amber-50/40";
  const button =
    tone === "rose"
      ? "border-rose-300 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50"
      : tone === "emerald"
        ? "border-emerald-300 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
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
