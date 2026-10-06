"use client";

import { useEffect, useId, useRef } from "react";
import { KIND_LABEL, stepType, type StepField } from "@/lib/automations/catalogue";
import {
  MAX_PATHS,
  MIN_PATHS,
  canConnect,
  findStep,
  newId,
  outgoing,
  portsOf,
  type Automation,
  type Condition,
  type Step,
  type StepPatch,
} from "@/lib/automations/graph";
import { AutoIcon } from "./automation-icons";
import styles from "./automations.module.css";

export type PanelFocus = "first" | "note";

/**
 * The edit panel: a column on the right of a wide canvas, a sheet from the
 * bottom on a phone. Everything the pointer can do to a step on the canvas
 * can be done here with the keyboard, including connecting it to another
 * step and removing a connection.
 */
export function StepPanel({
  doc,
  steps,
  focus,
  onPatch,
  onConditions,
  onConnect,
  onDisconnect,
  onDuplicate,
  onDelete,
  onClose,
}: {
  doc: Automation;
  /** The selected steps; one shows its fields, several show what can be done to all. */
  steps: readonly Step[];
  focus: Readonly<{ at: PanelFocus; n: number }>;
  onPatch: (id: string, patch: StepPatch, tag: string) => void;
  onConditions: (id: string, conditions: readonly Condition[], tag: string | null) => void;
  onConnect: (from: string, port: string, to: string) => void;
  onDisconnect: (linkId: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const step = steps.length === 1 ? steps[0]! : null;
  const stepId = step?.id ?? null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const target = focus.at === "note" ? root.querySelector<HTMLElement>("[data-field='note']") : root.querySelector<HTMLElement>("[data-field='title']");
    (target ?? root.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
  }, [focus, stepId]);

  return (
    <aside
      ref={rootRef}
      className={styles.panel}
      aria-labelledby={titleId}
      data-own-keys=""
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <span className={styles.sheetGrip} aria-hidden="true" />
      <header className={styles.panelHead}>
        {step ? (
          <span className={styles.tile} data-kind={step.kind} aria-hidden="true">
            <AutoIcon name={stepType(step.type)?.icon ?? "split"} />
          </span>
        ) : null}
        <div className={styles.panelHeadText}>
          <span className={styles.kind}>{step ? KIND_LABEL[step.kind] : "Selection"}</span>
          <h2 id={titleId} className={styles.panelTitle}>
            {step ? "Edit this step" : `${steps.length} steps selected`}
          </h2>
        </div>
        <button type="button" className={styles.iconButton} aria-label="Close the edit panel" onClick={onClose}>
          <AutoIcon name="close" />
        </button>
      </header>

      <div className={`${styles.panelBody} thin-scroll`} data-scrolls="">
        {step ? (
          <StepFields doc={doc} step={step} onPatch={onPatch} onConditions={onConditions} onConnect={onConnect} onDisconnect={onDisconnect} />
        ) : (
          <p className={styles.panelHelp}>Drag any one of them to move them together, or use the arrow keys. Choose a single step to edit it.</p>
        )}
      </div>

      <footer className={styles.panelFoot}>
        <button type="button" className={styles.ghostButton} onClick={onDuplicate}>
          <AutoIcon name="duplicate" size={14} />
          Duplicate
        </button>
        <button type="button" className={styles.ghostButton} data-danger="" onClick={onDelete}>
          <AutoIcon name="trash" size={14} />
          Delete
        </button>
      </footer>
    </aside>
  );
}

function StepFields({
  doc,
  step,
  onPatch,
  onConditions,
  onConnect,
  onDisconnect,
}: {
  doc: Automation;
  step: Step;
  onPatch: (id: string, patch: StepPatch, tag: string) => void;
  onConditions: (id: string, conditions: readonly Condition[], tag: string | null) => void;
  onConnect: (from: string, port: string, to: string) => void;
  onDisconnect: (linkId: string) => void;
}) {
  const type = stepType(step.type);
  const base = useId();
  const written = type?.summary(step.values) ?? "";
  const setValue = (field: StepField, value: string) =>
    onPatch(step.id, { values: { ...step.values, [field.id]: value } }, `value:${step.id}:${field.id}`);

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${base}-title`}>Name</label>
        <input
          id={`${base}-title`}
          data-field="title"
          className={styles.input}
          value={step.title}
          maxLength={80}
          onChange={(event) => onPatch(step.id, { title: event.target.value }, `title:${step.id}`)}
          onBlur={() => {
            if (!step.title.trim() && type) onPatch(step.id, { title: type.title }, `title:${step.id}`);
          }}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${base}-line`}>Description</label>
        <input
          id={`${base}-line`}
          className={styles.input}
          value={step.description}
          maxLength={140}
          placeholder={written}
          aria-describedby={`${base}-line-help`}
          onChange={(event) => onPatch(step.id, { description: event.target.value }, `line:${step.id}`)}
        />
        <p id={`${base}-line-help`} className={styles.fieldHelp}>Leave this empty and it is written from the choices below.</p>
      </div>

      {type?.fields.map((field) =>
        field.kind === "text" ? (
          <div key={field.id} className={styles.field}>
            <label htmlFor={`${base}-${field.id}`}>{field.label}</label>
            <input
              id={`${base}-${field.id}`}
              className={styles.input}
              value={step.values[field.id] ?? ""}
              maxLength={field.max}
              placeholder={field.placeholder}
              onChange={(event) => setValue(field, event.target.value)}
            />
          </div>
        ) : field.options.length <= 4 ? (
          <fieldset key={field.id} className={styles.field}>
            <legend>{field.label}</legend>
            <div className={styles.choices}>
              {field.options.map((option) => (
                <label key={option} className={styles.choice}>
                  <input
                    type="radio"
                    name={`${base}-${field.id}`}
                    checked={(step.values[field.id] ?? "") === option}
                    onChange={() => setValue(field, option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div key={field.id} className={styles.field}>
            <label htmlFor={`${base}-${field.id}`}>{field.label}</label>
            <select id={`${base}-${field.id}`} className={styles.select} value={step.values[field.id] ?? ""} onChange={(event) => setValue(field, event.target.value)}>
              {field.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ),
      )}

      {step.kind === "branch" ? (
        <fieldset className={styles.field}>
          <legend>Paths</legend>
          <ul className={styles.pathEdit}>
            {step.conditions.map((condition, index) => (
              <li key={condition.id}>
                <input
                  className={styles.input}
                  value={condition.label}
                  maxLength={60}
                  aria-label={`Path ${index + 1}`}
                  onChange={(event) =>
                    onConditions(
                      step.id,
                      step.conditions.map((entry) => (entry.id === condition.id ? { ...entry, label: event.target.value } : entry)),
                      `path:${condition.id}`,
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Remove path ${index + 1}: ${condition.label}`}
                  disabled={step.conditions.length <= MIN_PATHS}
                  onClick={() => onConditions(step.id, step.conditions.filter((entry) => entry.id !== condition.id), null)}
                >
                  <AutoIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          {step.conditions.length < MAX_PATHS ? (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => onConditions(step.id, [...step.conditions, { id: newId(), label: "Another path" }], null)}
            >
              <AutoIcon name="plus" size={14} />
              Add a path
            </button>
          ) : (
            <p className={styles.fieldHelp}>A branch holds up to {MAX_PATHS} paths.</p>
          )}
        </fieldset>
      ) : null}

      <fieldset className={styles.field}>
        <legend>Leads to</legend>
        {portsOf(step).map((port) => {
          const links = outgoing(doc, step.id, port);
          const open = doc.steps.filter((other) => canConnect(doc, step.id, port, other.id).ok);
          const pathLabel = step.conditions.find((condition) => condition.id === port)?.label;
          return (
            <div key={port} className={styles.leads}>
              {pathLabel !== undefined ? <span className={styles.leadsPath}>{pathLabel || "Unnamed path"}</span> : null}
              {links.map((link) => {
                const target = findStep(doc, link.to);
                return (
                  <span key={link.id} className={styles.leadsRow}>
                    <span>{target?.title ?? "A step"}</span>
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Remove the connection to ${target?.title ?? "that step"}`}
                      onClick={() => onDisconnect(link.id)}
                    >
                      <AutoIcon name="close" size={14} />
                    </button>
                  </span>
                );
              })}
              {open.length > 0 ? (
                <select
                  className={styles.select}
                  value=""
                  aria-label={pathLabel !== undefined ? `Connect the path ${pathLabel} to a step` : "Connect to a step"}
                  onChange={(event) => {
                    if (event.target.value) onConnect(step.id, port, event.target.value);
                  }}
                >
                  <option value="">Connect to a step</option>
                  {open.map((other) => (
                    <option key={other.id} value={other.id}>{other.title}</option>
                  ))}
                </select>
              ) : links.length === 0 ? (
                <p className={styles.fieldHelp}>Nothing to connect to yet. Add another step first.</p>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor={`${base}-note`}>Note</label>
        <textarea
          id={`${base}-note`}
          data-field="note"
          className={styles.textarea}
          rows={3}
          value={step.note}
          maxLength={400}
          placeholder="Why this step is here, or what to check"
          aria-describedby={`${base}-note-help`}
          onChange={(event) => onPatch(step.id, { note: event.target.value }, `note:${step.id}`)}
        />
        <p id={`${base}-note-help`} className={styles.fieldHelp}>Kept with this draft, in this browser.</p>
      </div>
    </>
  );
}
