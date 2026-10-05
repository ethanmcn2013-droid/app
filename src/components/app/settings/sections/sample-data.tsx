"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  getSampleDataStatusAction,
  removeAllSampleDataAction,
  removeSampleSetAction,
  seedSampleSetAction,
} from "@/server/actions/sample-data";
import type { SampleSetId, SampleSetStatus } from "@/lib/sample-data/model";
import {
  addConfirmation,
  removeAllConfirmation,
  removeConfirmation,
  sampleSetLabel,
  sampleSetState,
  seedOutcome,
  removeOutcome,
  type SampleOutcome,
} from "@/lib/sample-data/copy";
import { SectionHeader } from "../settings-app";
import { Badge, Callout, DialogBody, SettingsGroup, SettingsRow, ui } from "../settings-ui";

type Pending =
  | { kind: "add"; set: SampleSetId }
  | { kind: "remove"; set: SampleSetId }
  | { kind: "remove-all" }
  | null;

/**
 * Operator only. The page renders this section when the server says the
 * caller is an operator, and every action re-checks that on the server, so
 * this component decides nothing about access.
 */
export function SampleDataSection({
  initialStatus,
  activeProjectId,
}: {
  initialStatus: SampleSetStatus[];
  /** The Project Settings is open on, to leave it if removal deletes it. */
  activeProjectId: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [running, setRunning] = useState<Pending>(null);
  const [outcome, setOutcome] = useState<SampleOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  const anyPresent = status.some((set) => set.present.length > 0);
  const confirmSet = confirm && confirm.kind !== "remove-all" ? status.find((set) => set.summary.id === confirm.set) : undefined;

  function run(action: Exclude<Pending, null>) {
    setConfirm(null);
    setRunning(action);
    setOutcome(null);
    const removedIds =
      action.kind === "add"
        ? []
        : status
            .filter((set) => action.kind === "remove-all" || set.summary.id === action.set)
            .flatMap((set) => set.present.map((project) => project.id));
    startTransition(async () => {
      let next: SampleOutcome;
      try {
        if (action.kind === "add") {
          next = seedOutcome(await seedSampleSetAction(action.set));
        } else if (action.kind === "remove") {
          next = removeOutcome([await removeSampleSetAction(action.set)]);
        } else {
          const results = await removeAllSampleDataAction();
          next = removeOutcome(Array.isArray(results) ? results : [results]);
        }
      } catch {
        next = { tone: "danger", title: "That didn’t work", body: "Nothing was changed. Try again in a moment." };
      }
      setOutcome(next);
      toast(next.title, { tone: next.tone === "success" ? "success" : "error", body: next.body });
      try {
        const fresh = await getSampleDataStatusAction();
        if (fresh) setStatus(fresh);
      } catch {
        // The outcome above already says what happened; the list catches up
        // on the next visit.
      }
      setRunning(null);
      if (activeProjectId && removedIds.includes(activeProjectId) && next.tone === "success") {
        // Settings was open on a Project that no longer exists.
        router.push("/app/home");
      }
      router.refresh();
    });
  }

  return (
    <div>
      <SectionHeader
        title="Sample data"
        description="Add invented projects to your own account to see the product with real-looking work in it. Only operators see this section."
      />

      {outcome ? (
        <div className="mb-6">
          <Callout tone={outcome.tone} role={outcome.tone === "danger" ? "alert" : "status"}>
            <p className="font-medium text-[color:var(--v3-text)]">{outcome.title}</p>
            <p className="mt-0.5">{outcome.body}</p>
          </Callout>
        </div>
      ) : null}

      <SettingsGroup
        title="Sets"
        description="Each set is a handful of projects owned by you. Dates are set from the day you add it, so there is always work that is late, due today, due this week, later and done."
        labelledBy="sample-sets-title"
      >
        {status.map((set) => {
          const state = sampleSetState(set);
          const isRunning = running !== null && running.kind !== "remove-all" && running.set === set.summary.id;
          return (
            <SettingsRow
              key={set.summary.id}
              label={sampleSetLabel(set.summary)}
              meta={
                state.kind === "added" ? (
                  <Badge tone="success">Added</Badge>
                ) : state.kind === "partial" ? (
                  <Badge tone="warning">{state.present} of {state.total} added</Badge>
                ) : null
              }
              description={
                <>
                  {set.summary.blurb}
                  <span className="mt-1 block tabular-nums text-[color:var(--v3-text-3)]">
                    {set.summary.projects} projects, {set.summary.tasks} tasks, {set.summary.bigDates} big dates.
                  </span>
                </>
              }
            >
              {state.kind !== "added" ? (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "add", set: set.summary.id })}
                  disabled={pending}
                  className={ui.button}
                >
                  {isRunning && running?.kind === "add" ? "Adding…" : state.kind === "partial" ? "Finish adding" : "Add set"}
                </button>
              ) : null}
              {state.kind !== "none" ? (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: "remove", set: set.summary.id })}
                  disabled={pending}
                  className={ui.danger}
                >
                  {isRunning && running?.kind === "remove" ? "Removing…" : "Remove"}
                </button>
              ) : null}
            </SettingsRow>
          );
        })}
      </SettingsGroup>

      <SettingsGroup tone="danger">
        <SettingsRow
          label="Remove all sample data"
          description={
            anyPresent
              ? "Deletes every sample project you have added, and nothing else in your account."
              : "There is no sample data in your account."
          }
        >
          <button
            type="button"
            onClick={() => setConfirm({ kind: "remove-all" })}
            disabled={pending || !anyPresent}
            className={ui.danger}
          >
            {running?.kind === "remove-all" ? "Removing…" : "Remove all"}
          </button>
        </SettingsRow>
      </SettingsGroup>

      <p className="mt-4 max-w-[620px] px-0.5 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-3)]">
        Sample projects end in “· sample” and say which set they belong to in their description. Tasks marked done are
        finished at the moment you add the set, so charts show them as completed that day. Nobody is invited, nothing
        is emailed, shared or published.
      </p>

      {/* Add confirmation */}
      <Dialog
        open={confirm?.kind === "add"}
        onClose={() => setConfirm(null)}
        labelledBy="sample-add-title"
        width={480}
      >
        {confirm?.kind === "add" && confirmSet ? (
          <ConfirmBody
            titleId="sample-add-title"
            copy={addConfirmation(confirmSet)}
            cancel="Never mind"
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(confirm)}
            confirmClass={ui.primary}
          />
        ) : null}
      </Dialog>

      {/* Remove one set */}
      <Dialog
        open={confirm?.kind === "remove"}
        onClose={() => setConfirm(null)}
        labelledBy="sample-remove-title"
        width={480}
      >
        {confirm?.kind === "remove" && confirmSet ? (
          <ConfirmBody
            titleId="sample-remove-title"
            tone="danger"
            copy={removeConfirmation(confirmSet)}
            cancel="Keep it"
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(confirm)}
            confirmClass={ui.dangerSolid}
          />
        ) : null}
      </Dialog>

      {/* Remove everything */}
      <Dialog
        open={confirm?.kind === "remove-all"}
        onClose={() => setConfirm(null)}
        labelledBy="sample-remove-all-title"
        width={480}
      >
        {confirm?.kind === "remove-all" ? (
          <ConfirmBody
            titleId="sample-remove-all-title"
            tone="danger"
            copy={removeAllConfirmation(status)}
            cancel="Keep it"
            onCancel={() => setConfirm(null)}
            onConfirm={() => run(confirm)}
            confirmClass={ui.dangerSolid}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function ConfirmBody({
  titleId,
  tone,
  copy,
  cancel,
  onCancel,
  onConfirm,
  confirmClass,
}: {
  titleId: string;
  tone?: "danger";
  copy: { title: string; lead: string; names: readonly string[]; detail: string; confirm: string };
  cancel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmClass: string;
}) {
  return (
    <DialogBody
      titleId={titleId}
      tone={tone}
      title={copy.title}
      actions={
        <>
          <button type="button" onClick={onCancel} className={ui.button}>
            {cancel}
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass}>
            {copy.confirm}
          </button>
        </>
      }
    >
      <p>{copy.lead}</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[color:var(--v3-text)]">
        {copy.names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="mt-2">{copy.detail}</p>
    </DialogBody>
  );
}
