"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { Dialog } from "@/components/primitives/dialog";
import {
  runRemoveAllSampleDataAction,
  runRemoveSampleSetAction,
  runSeedSampleSetAction,
  type SampleDataRun,
} from "@/server/actions/sample-data";
import type { SampleConfirmation, SampleDataView, SampleOutcome } from "@/lib/sample-data/copy";
import { SectionHeader } from "../settings-app";
import { Badge, Callout, DialogBody, SettingsGroup, SettingsRow, ui } from "../settings-ui";

type Step = { copy: SampleConfirmation; danger: boolean; run: () => Promise<SampleDataRun> };

/**
 * Operator only. The server builds everything this shows (`SampleDataView`)
 * and hands it over only to an operator; every action re-checks that on the
 * server. This component decides nothing about access and holds no copy.
 */
export function SampleDataSection({
  initialView,
  activeProjectId,
}: {
  initialView: SampleDataView;
  /** The Project Settings is open on, to leave it if removal deletes it. */
  activeProjectId: string | null;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [step, setStep] = useState<Step | null>(null);
  const [outcome, setOutcome] = useState<SampleOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (!step) return;
    const run = step.run;
    setStep(null);
    setOutcome(null);
    startTransition(async () => {
      let next: SampleOutcome = { tone: "danger", title: "That didn’t work", body: "Nothing was changed. Try again in a moment." };
      let gone = false;
      try {
        const done = await run();
        next = done.outcome;
        if (done.view) {
          gone = activeProjectId !== null && view.presentIds.includes(activeProjectId) && !done.view.presentIds.includes(activeProjectId);
          setView(done.view);
        }
      } catch {
        // Keep the fixed failure outcome above.
      }
      setOutcome(next);
      toast(next.title, { tone: next.tone === "success" ? "success" : "error", body: next.body });
      // Settings was open on a Project that no longer exists.
      if (gone) router.push("/app/home");
      router.refresh();
    });
  }

  return (
    <div>
      <SectionHeader title={view.navLabel} description={view.description} />

      {outcome ? (
        <div className="mb-6">
          <Callout tone={outcome.tone} role={outcome.tone === "danger" ? "alert" : "status"}>
            <p className="font-medium text-[color:var(--v3-text)]">{outcome.title}</p>
            <p className="mt-0.5">{outcome.body}</p>
            {outcome.skipped?.length ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[color:var(--v3-text)]">
                {outcome.skipped.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
          </Callout>
        </div>
      ) : null}

      <SettingsGroup title="Sets" description={view.setsDescription} labelledBy="sample-sets-title">
        {view.sets.map((set) => (
          <SettingsRow
            key={set.id}
            label={set.label}
            meta={set.badge ? <Badge tone={set.badge.tone}>{set.badge.text}</Badge> : null}
            description={
              <>
                {set.blurb}
                <span className="mt-1 block tabular-nums text-[color:var(--v3-text-3)]">{set.counts}</span>
              </>
            }
          >
            {set.add ? (
              <button
                type="button"
                onClick={() => setStep({ copy: set.add!, danger: false, run: () => runSeedSampleSetAction(set.id) })}
                disabled={pending}
                className={ui.button}
              >
                {set.add.confirm}
              </button>
            ) : null}
            {set.remove ? (
              <button
                type="button"
                onClick={() => setStep({ copy: set.remove!, danger: true, run: () => runRemoveSampleSetAction(set.id) })}
                disabled={pending}
                className={ui.danger}
              >
                Remove
              </button>
            ) : null}
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup tone="danger">
        <SettingsRow label="Remove all sample data" description={view.removeAll.description}>
          <button
            type="button"
            onClick={() => setStep({ copy: view.removeAll.confirm!, danger: true, run: runRemoveAllSampleDataAction })}
            disabled={pending || !view.removeAll.confirm}
            className={ui.danger}
          >
            Remove all
          </button>
        </SettingsRow>
      </SettingsGroup>

      <p className="mt-4 max-w-[620px] px-0.5 text-[12.5px] leading-[1.55] text-[color:var(--v3-text-3)]" aria-live="polite">
        {pending ? "Working on it…" : view.footnote}
      </p>

      <Dialog open={step !== null} onClose={() => setStep(null)} labelledBy="sample-confirm-title" width={480}>
        {step ? (
          <DialogBody
            titleId="sample-confirm-title"
            tone={step.danger ? "danger" : undefined}
            title={step.copy.title}
            actions={
              <>
                <button type="button" onClick={() => setStep(null)} className={ui.button}>
                  {step.danger ? "Keep it" : "Never mind"}
                </button>
                <button type="button" onClick={confirm} className={step.danger ? ui.dangerSolid : ui.primary}>
                  {step.copy.confirm}
                </button>
              </>
            }
          >
            <p>{step.copy.lead}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[color:var(--v3-text)]">
              {step.copy.names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-2">{step.copy.detail}</p>
          </DialogBody>
        ) : null}
      </Dialog>
    </div>
  );
}
