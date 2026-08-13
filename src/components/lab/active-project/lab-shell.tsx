"use client";

/**
 * WP5 lab · the review chrome around every variant.
 *
 * Deliberately not in the house register. It is charcoal tooling wrapped
 * around a white stage so a reviewer never mistakes the instrument for the
 * work. It carries three controls and nothing else:
 *
 *   Projects — which world (no projects / one / fourteen).
 *   Screen   — desktop, or a 390x844 phone frame with simulated safe areas.
 *   State    — every row of the plan's §7.4 table, selectable.
 *
 * The state rail is the point. Each state says what to look at, and the armed
 * ones keep the surface live so the reviewer performs the switch and watches
 * the behaviour rather than reading a caption about it.
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  PROJECT_TRUTH_SCENARIOS,
  type FixtureScenarioId,
} from "@/lib/project-truth-fixture";
import { LAB_STATES, LAB_STATE_GROUPS, labState, type LabStateId } from "./states";
import { LabStyles } from "./lab-styles";

export type LabDevice = "desktop" | "phone";
export type LabMotion = "full" | "reduced";

export type LabStageContext = {
  stateId: LabStateId;
  scenario: FixtureScenarioId;
  device: LabDevice;
};

export type LabVariantKey = "a" | "b" | "c" | "w";

const SCENARIO_LABELS: Record<FixtureScenarioId, string> = {
  "zero-projects": "None",
  "one-project": "One",
  "full-catalog": "Fourteen",
};

const VARIANTS: readonly { key: LabVariantKey; label: string; title: string }[] =
  Object.freeze([
    { key: "a", label: "A", title: "Studio Bar anchor" },
    { key: "b", label: "B", title: "Canvas band" },
    { key: "c", label: "C", title: "Command-led" },
    { key: "w", label: "W", title: "The deck" },
  ]);

export function LabShell({
  variant,
  title,
  idea,
  children,
}: {
  variant: LabVariantKey;
  title: string;
  idea: string;
  children: (context: LabStageContext) => ReactNode;
}) {
  const [stateId, setStateId] = useState<LabStateId>("live");
  const [requestedScenario, setRequestedScenario] =
    useState<FixtureScenarioId>("full-catalog");
  const [device, setDevice] = useState<LabDevice>("desktop");
  const [motion, setMotion] = useState<LabMotion>("full");

  // A narrow window is a phone; the reviewer can still say otherwise.
  const [autoDevice, setAutoDevice] = useState(true);
  useEffect(() => {
    if (!autoDevice) return;
    const query = window.matchMedia("(max-width: 820px)");
    const apply = () => setDevice(query.matches ? "phone" : "desktop");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [autoDevice]);

  const state = labState(stateId);
  const scenario = state.forceScenario ?? requestedScenario;
  const scenarioForced = state.forceScenario !== undefined;

  return (
    <>
      <LabStyles />
      <div className="min-h-screen bg-[#111114] text-zinc-300">
        <header className="border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/lab/active-project"
              className="ap-r [--ap-r:6px] font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-200"
            >
              Active project lab
            </Link>
            <nav aria-label="Variants" className="flex items-center gap-1">
              {VARIANTS.map((entry) => {
                const current = entry.key === variant;
                return (
                  <Link
                    key={entry.key}
                    href={`/lab/active-project-${entry.key}`}
                    aria-current={current ? "page" : undefined}
                    title={entry.title}
                    className={[
                      "ap-r [--ap-r:6px] inline-flex min-h-[36px] min-w-[36px] items-center justify-center",
                      "rounded-md px-2.5 font-mono text-[12px] transition-colors",
                      current
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200",
                    ].join(" ")}
                  >
                    {entry.label}
                  </Link>
                );
              })}
            </nav>
            <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-zinc-400">
              <span className="font-medium text-zinc-100">{title}</span>
              <span className="mx-2 text-zinc-600">·</span>
              {idea}
            </p>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row">
          <Rail
            stateId={stateId}
            onState={setStateId}
            scenario={scenario}
            scenarioForced={scenarioForced}
            onScenario={(next) => setRequestedScenario(next)}
            device={device}
            onDevice={(next) => {
              setAutoDevice(false);
              setDevice(next);
            }}
            motion={motion}
            onMotion={setMotion}
          />

          <main className="min-w-0 flex-1">
            <p className="mb-3 text-[13px] leading-[1.5] text-zinc-400">
              <span className="font-medium text-zinc-200">{state.label}.</span>{" "}
              {state.watch}
            </p>

            <div
              className={
                device === "phone"
                  ? "flex justify-center rounded-lg bg-[#08080a] px-4 py-8"
                  : ""
              }
            >
              <div
                data-device={device}
                data-ap-motion={motion}
                className={[
                  "ap-stage relative isolate overflow-hidden bg-paper text-ink",
                  device === "phone"
                    ? "h-[844px] w-[390px] shrink-0 rounded-[38px] border-[6px] border-[#26262b] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]"
                    : "min-h-[760px] rounded-lg border border-white/10",
                ].join(" ")}
              >
                {/* Keyed on the world it is showing. Changing state or
                    scenario remounts the surface, which clears every timer and
                    every open layer, so a state can never inherit the last
                    one's tail. Changing screen or motion does not remount —
                    those are ways of looking, not different worlds. */}
                <Stage key={`${stateId}:${scenario}`}>
                  {children({ stateId, scenario, device })}
                </Stage>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

/** A remount boundary and nothing else. */
function Stage({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ── The rail ────────────────────────────────────────────────────────────────

function Rail({
  stateId,
  onState,
  scenario,
  scenarioForced,
  onScenario,
  device,
  onDevice,
  motion,
  onMotion,
}: {
  stateId: LabStateId;
  onState: (id: LabStateId) => void;
  scenario: FixtureScenarioId;
  scenarioForced: boolean;
  onScenario: (id: FixtureScenarioId) => void;
  device: LabDevice;
  onDevice: (device: LabDevice) => void;
  motion: LabMotion;
  onMotion: (motion: LabMotion) => void;
}) {
  return (
    <div className="w-full shrink-0 lg:w-[264px]">
      <details
        open
        className="rounded-lg border border-white/10 bg-[#17171b] lg:open:block"
      >
        <summary className="ap-r [--ap-r:8px] cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 lg:cursor-default">
          Lab controls
        </summary>

        <div className="space-y-5 px-4 pb-4">
          <Fieldset legend="How many projects">
            {PROJECT_TRUTH_SCENARIOS.map((entry) => (
              <RailOption
                key={entry.id}
                name="scenario"
                checked={scenario === entry.id}
                disabled={scenarioForced}
                onSelect={() => onScenario(entry.id)}
                // Counts, not sentences. The fixture's own labels collide with
                // the state named "No projects" one group below, and two
                // controls reading the same words in one rail is a trap.
                label={SCENARIO_LABELS[entry.id]}
              />
            ))}
            {scenarioForced ? (
              <p className="pt-1 text-[11px] leading-[1.45] text-zinc-500">
                This state sets its own world.
              </p>
            ) : null}
          </Fieldset>

          <Fieldset legend="Screen">
            <RailOption
              name="device"
              checked={device === "desktop"}
              onSelect={() => onDevice("desktop")}
              label="Desktop"
            />
            <RailOption
              name="device"
              checked={device === "phone"}
              onSelect={() => onDevice("phone")}
              label="Phone · 390×844"
            />
          </Fieldset>

          <Fieldset legend="Motion">
            <RailOption
              name="motion"
              checked={motion === "full"}
              onSelect={() => onMotion("full")}
              label="Full"
            />
            <RailOption
              name="motion"
              checked={motion === "reduced"}
              onSelect={() => onMotion("reduced")}
              label="Reduced"
            />
          </Fieldset>

          {LAB_STATE_GROUPS.map((group) => (
            <Fieldset key={group} legend={group}>
              {LAB_STATES.filter((entry) => entry.group === group).map((entry) => (
                <RailOption
                  key={entry.id}
                  name="state"
                  checked={stateId === entry.id}
                  onSelect={() => onState(entry.id)}
                  label={entry.label}
                  badge={entry.kind === "armed" ? "do it" : "held"}
                />
              ))}
            </Fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-1">
      <legend className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function RailOption({
  name,
  checked,
  disabled,
  onSelect,
  label,
  badge,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <label
      className={[
        "flex min-h-[36px] items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
        disabled
          ? "cursor-not-allowed text-zinc-600"
          : "cursor-pointer text-zinc-300 hover:bg-white/5",
        checked && !disabled ? "bg-white/[0.07] text-zinc-50" : "",
      ].join(" ")}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="ap-r [--ap-r:999px] h-3.5 w-3.5 shrink-0 accent-[#6366f1]"
      />
      <span className="min-w-0 flex-1 leading-[1.35]">{label}</span>
      {badge ? (
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">
          {badge}
        </span>
      ) : null}
    </label>
  );
}
