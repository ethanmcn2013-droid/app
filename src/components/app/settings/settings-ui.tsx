"use client";

/**
 * Settings v3 primitives: groups, rows, controls.
 *
 * One grammar for every settings section, in the Linear / Vercel register:
 * a sentence-case group title above a card, rows inside the card separated by
 * hairlines, the label and one plain line on the left and the control on the
 * right (stacked on narrow screens).
 *
 * Tokens only (src/ds/v3.css). Tailwind arbitrary values rather than a CSS
 * module on purpose: several sections are imported directly by node tests
 * (appearance, billing, the Drive views), and a stylesheet import would break
 * every one of them.
 *
 * Focus: the suite-wide `:focus-visible` rule in globals.css is unlayered, so
 * it outranks utilities and also rewrites border-radius to 6px. Controls
 * here restate their own radius with `!` so a focused switch stays a pill
 * and a focused card keeps its corners; text inputs trade the outline for an
 * accent border and a soft accent halo.
 */

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ── Control classes ──────────────────────────────────────────────────

const buttonBase =
  "inline-flex h-[34px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--v3-radius)] px-3 text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-[var(--v3-ease)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:rounded-[var(--v3-radius)]! focus-visible:outline-[color:var(--v3-accent)]! pointer-coarse:h-[44px]";

export const ui = {
  /** Text, email and number fields. */
  input:
    "h-[34px] w-full min-w-0 rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[var(--v3-canvas)] px-3 text-[13px] text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1)] transition-[border-color,box-shadow] duration-150 placeholder:text-[color:var(--v3-text-3)] hover:border-[color:var(--v3-border-strong)] focus:border-[color:var(--v3-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v3-accent)_22%,transparent)] focus-visible:rounded-[var(--v3-radius)]! focus-visible:outline-none! disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-[44px]",
  /** Native select; wrap it in <Select> for the chevron. */
  select:
    "h-[34px] w-full min-w-0 appearance-none rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[var(--v3-canvas)] pl-3 pr-[32px] text-[13px] text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1)] transition-[border-color,box-shadow] duration-150 hover:border-[color:var(--v3-border-strong)] focus:border-[color:var(--v3-accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--v3-accent)_22%,transparent)] focus-visible:rounded-[var(--v3-radius)]! focus-visible:outline-none! disabled:cursor-not-allowed disabled:opacity-60 pointer-coarse:h-[44px]",
  /** Quiet bordered button. */
  button: cx(
    buttonBase,
    "border border-[color:var(--v3-border)] bg-[var(--v3-surface)] text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1)] hover:border-[color:var(--v3-border-strong)] hover:bg-[var(--v3-hover)]",
  ),
  /** The one primary action in a group. */
  primary: cx(
    buttonBase,
    "border border-transparent bg-[var(--v3-accent)] text-[color:var(--v3-on-accent)] shadow-[var(--v3-shadow-1)] hover:bg-[var(--v3-accent-hover)]",
  ),
  /** Destructive, outlined: the first step of a destructive flow. */
  danger: cx(
    buttonBase,
    "border border-[color:color-mix(in_srgb,var(--v3-danger)_38%,transparent)] bg-[var(--v3-surface)] text-[color:var(--v3-danger)] shadow-[var(--v3-shadow-1)] hover:border-[color:var(--v3-danger)] hover:bg-[color-mix(in_srgb,var(--v3-danger)_8%,transparent)]",
  ),
  /** Destructive, filled: the confirming step. */
  dangerSolid: cx(
    buttonBase,
    "border border-transparent bg-[var(--v3-danger)] text-[color:var(--v3-on-accent)] shadow-[var(--v3-shadow-1)] hover:bg-[color-mix(in_srgb,var(--v3-danger)_88%,var(--v3-text))]",
  ),
  /** Text-only button for tertiary actions. */
  ghost: cx(
    buttonBase,
    "border border-transparent px-2 text-[color:var(--v3-text-2)] hover:bg-[var(--v3-hover)] hover:text-[color:var(--v3-text)]",
  ),
  /** Square icon button (remove, revoke). */
  icon:
    "inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[var(--v3-radius)] text-[color:var(--v3-text-3)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--v3-danger)_10%,transparent)] hover:text-[color:var(--v3-danger)] disabled:opacity-50 focus-visible:rounded-[var(--v3-radius)]! focus-visible:outline-[color:var(--v3-accent)]! pointer-coarse:h-[44px] pointer-coarse:w-[44px]",
  /** Inline text link. */
  link: "font-medium text-[color:var(--v3-accent)] underline decoration-[color:color-mix(in_srgb,var(--v3-accent)_35%,transparent)] underline-offset-[3px] transition-colors hover:decoration-[color:var(--v3-accent)]",
  /** Monospace value chip (ids, slugs, urls). */
  code: "rounded-[var(--v3-radius-sm)] bg-[var(--v3-sunken)] box-decoration-clone px-1.5 py-0.5 font-mono text-[12px] text-[color:var(--v3-text)]",
} as const;

// ── Section scaffolding ──────────────────────────────────────────────

/**
 * A titled group: the title and one plain line sit above the card, the rows
 * sit inside it. `tone="danger"` tints the card edge for destructive groups.
 */
export function SettingsGroup({
  title,
  description,
  aside,
  tone,
  children,
  labelledBy,
  bare,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned meta beside the title (a count, a badge). */
  aside?: ReactNode;
  tone?: "danger";
  children: ReactNode;
  labelledBy?: string;
  /** No card: for content that is itself a set of cards (option grids). */
  bare?: boolean;
}) {
  return (
    <section aria-labelledby={labelledBy} className="mt-[32px] first:mt-0">
      {title ? (
        <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
          <div className="min-w-0">
            <h3
              id={labelledBy}
              className="text-[13.5px] font-semibold leading-5 text-[color:var(--v3-text)]"
            >
              {title}
            </h3>
            {description ? (
              <p className="mt-0.5 max-w-[620px] text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
                {description}
              </p>
            ) : null}
          </div>
          {aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null}
        </div>
      ) : null}
      {bare ? children : <div
        className={cx(
          "divide-y rounded-[var(--v3-radius-lg)] border bg-[var(--v3-surface)] shadow-[var(--v3-shadow-1)]",
          tone === "danger"
            ? "divide-[color:color-mix(in_srgb,var(--v3-danger)_18%,var(--v3-border))] border-[color:color-mix(in_srgb,var(--v3-danger)_32%,var(--v3-border))]"
            : "divide-[color:var(--v3-border)] border-[color:var(--v3-border)]",
        )}
      >
        {children}
      </div>}
    </section>
  );
}

/**
 * One setting: label and description on the left, control on the right from
 * `sm` up, stacked below. `layout="stack"` always puts the control underneath
 * (option grids, long forms).
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  layout = "inline",
  labelTone,
  meta,
}: {
  label: ReactNode;
  description?: ReactNode;
  /** When set, the label is a <label> for this control id. */
  htmlFor?: string;
  children?: ReactNode;
  layout?: "inline" | "stack";
  labelTone?: "danger";
  /** Small inline badge after the label. */
  meta?: ReactNode;
}) {
  const LabelTag = htmlFor ? "label" : "div";
  const text = (
    <div className="min-w-0 sm:max-w-[440px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LabelTag
          htmlFor={htmlFor}
          className={cx(
            "text-[13.5px] font-medium leading-5",
            labelTone === "danger"
              ? "text-[color:var(--v3-danger)]"
              : "text-[color:var(--v3-text)]",
          )}
        >
          {label}
        </LabelTag>
        {meta}
      </div>
      {description ? (
        <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[color:var(--v3-text-2)]">
          {description}
        </div>
      ) : null}
    </div>
  );

  if (layout === "stack") {
    return (
      <div className="px-4 py-4 md:px-5">
        {text}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-[32px] md:px-5">
      {text}
      {children ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Plain list row inside a group (people, sessions, activity). */
export function SettingsListRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-3 px-4 py-3 md:px-5", className)}>
      {children}
    </div>
  );
}

/** Quiet status or helper line under a control. */
export function Hint({
  children,
  tone,
  id,
}: {
  children: ReactNode;
  tone?: "danger" | "warning" | "success";
  id?: string;
}) {
  return (
    <p
      id={id}
      className={cx(
        "text-[12px] leading-[1.5]",
        tone === "danger"
          ? "text-[color:var(--v3-danger)]"
          : tone === "warning"
            ? "text-[color:color-mix(in_srgb,var(--v3-warning)_70%,var(--v3-text))]"
            : tone === "success"
              ? "text-[color:var(--v3-success)]"
              : "text-[color:var(--v3-text-3)]",
      )}
    >
      {children}
    </p>
  );
}

/** Inset note inside a row: callouts, checklists, recovery details. */
export function Callout({
  children,
  tone,
  role,
}: {
  children: ReactNode;
  tone?: "warning" | "danger" | "success";
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={cx(
        "rounded-[var(--v3-radius)] border px-3.5 py-3 text-[12.5px] leading-[1.55]",
        tone === "warning"
          ? "border-[color:color-mix(in_srgb,var(--v3-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--v3-warning)_9%,transparent)] text-[color:var(--v3-text)]"
          : tone === "danger"
            ? "border-[color:color-mix(in_srgb,var(--v3-danger)_32%,transparent)] bg-[color-mix(in_srgb,var(--v3-danger)_7%,transparent)] text-[color:var(--v3-text)]"
            : tone === "success"
              ? "border-[color:color-mix(in_srgb,var(--v3-success)_32%,transparent)] bg-[color-mix(in_srgb,var(--v3-success)_8%,transparent)] text-[color:var(--v3-text)]"
              : "border-[color:var(--v3-border)] bg-[var(--v3-sunken)] text-[color:var(--v3-text-2)]",
      )}
    >
      {children}
    </div>
  );
}

// ── Small atoms ──────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export function Badge({
  children,
  tone = "neutral",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-[20px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium leading-none tabular-nums",
        tone === "accent"
          ? "bg-[var(--v3-accent-soft)] text-[color:var(--v3-accent)]"
          : tone === "success"
            ? "bg-[color-mix(in_srgb,var(--v3-success)_14%,transparent)] text-[color:var(--v3-success)]"
            : tone === "warning"
              ? "bg-[color-mix(in_srgb,var(--v3-warning)_16%,transparent)] text-[color:color-mix(in_srgb,var(--v3-warning)_62%,var(--v3-text))]"
              : tone === "danger"
                ? "bg-[color-mix(in_srgb,var(--v3-danger)_12%,transparent)] text-[color:var(--v3-danger)]"
                : "bg-[var(--v3-sunken)] text-[color:var(--v3-text-2)] ring-1 ring-inset ring-[color:var(--v3-border)]",
      )}
    >
      {children}
    </span>
  );
}

/** Native select with a drawn chevron; every prop reaches the <select>. */
export function Select({
  className,
  wrapperClassName,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <span className={cx("relative inline-flex min-w-0", wrapperClassName)}>
      <select className={cx(ui.select, className)} {...rest}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        focusable="false"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--v3-text-3)]"
      >
        <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
      </svg>
    </span>
  );
}

/**
 * Segmented control: a small radio group for two to four short choices.
 * Arrows move focus and selection together and wrap; one tab stop.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
  disabled?: boolean;
  label: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const checked = options.findIndex((o) => o.value === value);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-[34px] shrink-0 items-stretch gap-0.5 rounded-[var(--v3-radius)] bg-[var(--v3-sunken)] p-[3px] ring-1 ring-inset ring-[color:var(--v3-border)] pointer-coarse:h-[44px]"
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={index === (checked < 0 ? 0 : checked) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "min-w-[64px] rounded-[5px] px-3 text-[12.5px] font-medium transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:rounded-[5px]!",
              active
                ? "bg-[var(--v3-surface)] text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1),0_0_0_1px_var(--v3-border)]"
                : "text-[color:var(--v3-text-2)] hover:text-[color:var(--v3-text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Track and knob classes for role="switch" buttons, shared so every
 *  switch in Settings reads as one control. */
export function switchTrackClass(checked: boolean): string {
  return cx(
    "relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-200 ease-[var(--v3-ease)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:rounded-full! focus-visible:outline-[color:var(--v3-accent)]!",
    checked
      ? "bg-[var(--v3-accent)]"
      : "bg-[var(--v3-border-strong)] hover:bg-[color-mix(in_srgb,var(--v3-border-strong)_70%,var(--v3-text-3))]",
  );
}

export function switchKnobClass(checked: boolean): string {
  return cx(
    "pointer-events-none absolute left-[2px] top-[2px] h-[16px] w-[16px] rounded-full bg-[var(--v3-surface)] shadow-[var(--v3-shadow-1)] transition-transform duration-200 ease-[var(--v3-ease)]",
    checked ? "translate-x-[14px]" : "translate-x-0",
  );
}

/** Settings switch for boolean preferences. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={switchTrackClass(checked)}
    >
      <span className={switchKnobClass(checked)} aria-hidden />
    </button>
  );
}

/** Round initials avatar. */
export function Avatar({
  initials,
  color,
}: {
  initials: string | null;
  color: string | null;
}) {
  return (
    <span
      aria-hidden
      className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[color:var(--v3-on-accent)]"
      style={{ background: color ?? "var(--v3-accent)" }}
    >
      {initials ?? "?"}
    </span>
  );
}

// ── Dialog body ──────────────────────────────────────────────────────

/** Consistent body for confirmation dialogs (the Dialog primitive owns the
 *  frame, focus and escape). */
export function DialogBody({
  titleId,
  title,
  tone,
  children,
  actions,
}: {
  titleId: string;
  title: ReactNode;
  tone?: "danger" | "warning";
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="bg-[var(--v3-surface)] px-5 pb-5 pt-5">
      {tone ? (
        <span
          aria-hidden
          className={cx(
            "mb-3 flex h-[32px] w-[32px] items-center justify-center rounded-full",
            tone === "danger"
              ? "bg-[color-mix(in_srgb,var(--v3-danger)_12%,transparent)] text-[color:var(--v3-danger)]"
              : "bg-[color-mix(in_srgb,var(--v3-warning)_16%,transparent)] text-[color:color-mix(in_srgb,var(--v3-warning)_62%,var(--v3-text))]",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.4 9.5a1 1 0 0 1-.87 1.5H2.6a1 1 0 0 1-.87-1.5Z" />
            <path d="M8 6.25v2.75M8 11.1v.01" />
          </svg>
        </span>
      ) : null}
      <h3
        id={titleId}
        className="text-[16px] font-semibold leading-6 tracking-[-0.01em] text-[color:var(--v3-text)]"
      >
        {title}
      </h3>
      <div className="mt-1.5 text-[13px] leading-[1.55] text-[color:var(--v3-text-2)]">
        {children}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </div>
  );
}
