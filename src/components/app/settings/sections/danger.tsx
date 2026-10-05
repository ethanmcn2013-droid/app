"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import { clearAllTasksAction, seedDomainAction } from "@/server/actions/seed";
import { deleteWorkspaceAction } from "@/server/actions/settings";
import { SectionHeader } from "../settings-app";
import { DialogBody, SettingsGroup, SettingsRow, cx, ui } from "../settings-ui";
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
          body: "This project now holds the wedding sample tasks.",
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
          body: "The project is back to empty. Members and billing untouched.",
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
        toast("Project deleted", { tone: "success" });
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
        title="Danger zone"
        description="These change or remove work for everyone in this project. Each one asks you to confirm first."
      />

      {projectId ? (
        <p className="mb-6 -mt-2 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-2)]">
          <a className={ui.link} href={projectRecoveryPath(projectId)}>Project recovery</a> keeps export, file downloads and permitted public-access controls available on a page of its own.
        </p>
      ) : null}

      <SettingsGroup tone="danger">
        {/* Load the wedding demo */}
        <SettingsRow
          label="Load the wedding demo"
          description={
            <>
              Replaces this project’s tasks with the wedding sample set (venue,
              vendors, run-of-show). Handy for demos. It clears the current
              tasks first, so treat it like a reset.
              {!isOwner ? <GateNote /> : null}
            </>
          }
        >
          <button
            type="button"
            onClick={() => setWeddingOpen(true)}
            disabled={pending || !isOwner}
            className={ui.button}
          >
            Load wedding demo
          </button>
        </SettingsRow>

        {/* Clear tasks */}
        <SettingsRow
          label="Clear all tasks"
          description={
            <>
              Deletes every task, comment and activity in this project.
              Members, billing and the project itself stay. The starter pack
              stays cleared until you re-seed.
              {!isOwner ? <GateNote /> : null}
            </>
          }
        >
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            disabled={pending || !isOwner}
            className={ui.danger}
          >
            Clear tasks
          </button>
        </SettingsRow>

        {/* Delete project */}
        {isOwner ? (
          <SettingsRow
            label="Delete this project"
            labelTone="danger"
            description="Erases the project and everything in it: tasks, comments, members and share links. There is no undo."
          >
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={pending}
              className={ui.danger}
            >
              Delete project
            </button>
          </SettingsRow>
        ) : (
          <SettingsRow
            label="Delete this project"
            description="Only the owner sees the delete control. That’s on purpose."
          />
        )}
      </SettingsGroup>

      {/* Load-wedding-demo confirmation */}
      <Dialog
        open={weddingOpen}
        onClose={() => setWeddingOpen(false)}
        labelledBy="wedding-demo-title"
        width={440}
      >
        <DialogBody
          titleId="wedding-demo-title"
          tone="warning"
          title={<>Load the wedding demo into {workspaceName}?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => setWeddingOpen(false)}
                className={ui.button}
              >
                Never mind
              </button>
              <button
                type="button"
                onClick={loadWeddingDemo}
                disabled={pending}
                className={ui.primary}
              >
                {pending ? "Loading…" : "Load wedding demo"}
              </button>
            </>
          }
        >
          This clears the current tasks and adds the wedding sample set
          (venue, vendors, run-of-show). Members and billing are not affected.
        </DialogBody>
      </Dialog>

      {/* Clear-tasks confirmation */}
      <Dialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        labelledBy="clear-tasks-title"
        width={440}
      >
        <DialogBody
          titleId="clear-tasks-title"
          tone="warning"
          title={<>Clear every task in {workspaceName}?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => setClearOpen(false)}
                className={ui.button}
              >
                Never mind
              </button>
              <button
                type="button"
                onClick={clearAllTasks}
                disabled={pending}
                className={ui.dangerSolid}
              >
                {pending ? "Clearing…" : "Clear all tasks"}
              </button>
            </>
          }
        >
          All tasks, comments and activity in this project are deleted.
          Members and billing are not affected. The starter pack resets so you
          can pick a fresh one.
        </DialogBody>
      </Dialog>

      {/* Delete-project confirmation, type-to-confirm */}
      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText("");
        }}
        labelledBy="delete-ws-title"
        width={460}
      >
        <DialogBody
          titleId="delete-ws-title"
          tone="danger"
          title={<>Delete {workspaceName}?</>}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setConfirmText("");
                }}
                className={ui.button}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={deleteWorkspace}
                disabled={pending || confirmText !== workspaceName}
                className={ui.dangerSolid}
              >
                {pending ? "Deleting…" : "Delete forever"}
              </button>
            </>
          }
        >
          <p>
            This deletes the project and everything inside it. Type{" "}
            <span className={ui.code}>{workspaceName}</span>{" "}
            to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={workspaceName}
            aria-label="Project name to confirm"
            autoComplete="off"
            className={cx(ui.input, "mt-3")}
          />
        </DialogBody>
      </Dialog>
    </div>
  );
}

function GateNote() {
  return (
    <span className="mt-1 block text-[12px] text-[color:var(--v3-text-3)]">
      Only the owner can do this.
    </span>
  );
}
