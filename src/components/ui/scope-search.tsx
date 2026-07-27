"use client";

/**
 * ScopeSearch — the suite's typed argument-chip search primitive.
 *
 * The Delight Layer's worked example (Phase 0/1): adapted from the
 * component-lab Command Palette's chip mechanic, re-skinned to the Signal
 * Studio design system — light-locked, Geist, DS tokens, one indigo accent,
 * calm motion that honours prefers-reduced-motion.
 *
 * The idea: a single text input filters a list, but a typed facet token
 * ("assignee:", "@", "#", "status:") turns into a CHIP painted before the
 * input. Chips are AND-combined filters; the free text that follows narrows
 * within them. One tab stop — the input — for the whole interaction:
 *
 *   · Typing a facet trigger enters "facet mode": the caller shows that
 *     facet's options instead of results, and the same input filters them.
 *   · Picking an option stages it as a chip and clears the trigger text.
 *   · Backspace on an empty query pops the last chip. Chips never join the
 *     tab order but are clickable to remove.
 *
 * This file is domain-agnostic: it knows facets, options and chips, not
 * tasks or rooms. Callers derive facets from their own live data and render
 * the results list themselves. That keeps the second use a reuse, not a copy.
 */

import { Fragment, useMemo, type ReactNode, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

export type ScopeOption = {
  /** Stable identity used in the chip and in the caller's filter. */
  value: string;
  label: string;
  /** Solid dot colour (status lanes, person tint). */
  dot?: string;
  /** Two-letter monogram (person facets). */
  initials?: string;
  /** Trailing muted count/aside. */
  hint?: string;
};

export type ScopeFacet = {
  /** Canonical key, e.g. "assignee" | "tag" | "status". */
  key: string;
  /** Human label shown on the chip's leading segment. */
  label: string;
  /** Placeholder shown while picking this facet's value. */
  prompt: string;
  /** Row glyph treatment for this facet's options. */
  kind: "person" | "dot" | "plain";
  options: ScopeOption[];
  /** Words that, followed by ":", enter this facet. Includes `key`. */
  triggers: string[];
  /** Optional single-char prefix (e.g. "@", "#") that enters this facet. */
  sigil?: string;
};

export type ScopeChip = {
  facetKey: string;
  value: string;
  label: string;
  dot?: string;
  initials?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** What the input currently resolves to when the caller renders its list. */
export type ScopePending = { facet: ScopeFacet; optionQuery: string } | null;

/**
 * Parse the raw query into a pending facet (if the user typed a trigger) or
 * null (free-text mode). Sigils and `key:` prefixes both enter facet mode;
 * the text after them becomes the option filter.
 */
export function matchFacetTrigger(
  query: string,
  facets: ScopeFacet[],
): ScopePending {
  if (!query) return null;
  for (const facet of facets) {
    if (facet.sigil && query.startsWith(facet.sigil)) {
      return { facet, optionQuery: query.slice(facet.sigil.length) };
    }
  }
  const colon = query.indexOf(":");
  if (colon > 0) {
    const raw = query.slice(0, colon).trim().toLowerCase();
    const facet = facets.find((f) => f.triggers.includes(raw));
    if (facet) return { facet, optionQuery: query.slice(colon + 1) };
  }
  return null;
}

function optionMatches(option: ScopeOption, q: string): boolean {
  if (!q) return true;
  return option.label.toLowerCase().includes(q.trim().toLowerCase());
}

/**
 * Derive the pending facet and its filtered, not-yet-selected options.
 * Pure — safe to call every render.
 */
export function useScopeSearch(
  facets: ScopeFacet[],
  chips: ScopeChip[],
  query: string,
): { pending: ScopePending; options: ScopeOption[] } {
  return useMemo(() => {
    const pending = matchFacetTrigger(query, facets);
    if (!pending) return { pending: null, options: [] };
    const taken = new Set(
      chips.filter((c) => c.facetKey === pending.facet.key).map((c) => c.value),
    );
    const options = pending.facet.options.filter(
      (o) => !taken.has(o.value) && optionMatches(o, pending.optionQuery),
    );
    return { pending, options };
  }, [facets, chips, query]);
}

/** Turn a picked option into a chip. */
export function optionToChip(facet: ScopeFacet, option: ScopeOption): ScopeChip {
  return {
    facetKey: facet.key,
    value: option.value,
    label: option.label,
    dot: option.dot,
    initials: option.initials,
  };
}

/** AND across facets, OR within a facet — the standard filter semantics. */
export function chipsPredicate<T>(
  chips: ScopeChip[],
  read: (facetKey: string, item: T) => string[],
): (item: T) => boolean {
  if (chips.length === 0) return () => true;
  const byFacet = new Map<string, Set<string>>();
  for (const chip of chips) {
    const set = byFacet.get(chip.facetKey) ?? new Set<string>();
    set.add(chip.value);
    byFacet.set(chip.facetKey, set);
  }
  return (item: T) => {
    for (const [facetKey, values] of byFacet) {
      const has = read(facetKey, item);
      if (!has.some((v) => values.has(v))) return false;
    }
    return true;
  };
}

function Monogram({ text }: { text: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full bg-bg-sunken text-[8px] font-semibold tracking-[0.02em] text-ink-soft"
    >
      {text}
    </span>
  );
}

function Dot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 flex-none rounded-full"
      style={{ background: color ?? "var(--brand)" }}
    />
  );
}

/**
 * The chip row: the search glyph, the applied chips, and the one input.
 * Presentational — the caller owns query/chip state and the results list.
 */
export function ScopeChipRow({
  facets,
  chips,
  query,
  onQueryChange,
  onRemoveChip,
  onKeyDown,
  inputRef,
  listId,
  activeOptionId,
  placeholder = "Search, jump or create…",
  trailing,
}: {
  facets: ScopeFacet[];
  chips: ScopeChip[];
  query: string;
  onQueryChange: (value: string) => void;
  onRemoveChip: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  /** id of the listbox the input controls, for the combobox a11y pattern. */
  listId?: string;
  /** id of the row currently highlighted, so screen readers follow the keys. */
  activeOptionId?: string;
  placeholder?: string;
  trailing?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const pending = matchFacetTrigger(query, facets);
  const activePlaceholder = pending ? pending.facet.prompt : placeholder;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-4 py-3"
      onClick={() => inputRef.current?.focus()}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="flex-none text-ink-quiet"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      {chips.map((chip, index) => {
        const facet = facets.find((f) => f.key === chip.facetKey);
        return (
          <motion.button
            key={`${chip.facetKey}:${chip.value}`}
            type="button"
            tabIndex={-1}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveChip(index);
            }}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={`Remove filter ${facet?.label ?? chip.facetKey} ${chip.label}`}
            className="group/chip inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-bg-sunken/70 py-1 pl-2 pr-1.5 text-[12px] leading-none text-ink transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
          >
            <span className="text-ink-quiet">{facet?.label ?? chip.facetKey}</span>
            {chip.dot ? <Dot color={chip.dot} /> : null}
            {chip.initials ? <Monogram text={chip.initials} /> : null}
            <span className="font-medium">{chip.label}</span>
            <span
              aria-hidden="true"
              className="text-ink-faint transition-colors group-hover/chip:text-ink"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </span>
          </motion.button>
        );
      })}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={activePlaceholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-[15px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
      />

      {trailing}
    </div>
  );
}

/**
 * One option row shown while picking a facet's value (person / dot / plain).
 * Mirrors the results-row rhythm so the list reads as one surface.
 */
export function ScopeOptionRow({
  id,
  facet,
  option,
  active,
  onHover,
  onClick,
}: {
  id?: string;
  facet: ScopeFacet;
  option: ScopeOption;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={
        "flex cursor-pointer items-center gap-2.5 px-4 py-2 transition-colors " +
        (active ? "bg-brand-soft/40" : "hover:bg-bg-sunken/40")
      }
    >
      {facet.kind === "person" ? (
        <Monogram text={option.initials ?? option.label.slice(0, 2).toUpperCase()} />
      ) : facet.kind === "dot" ? (
        <Dot color={option.dot} />
      ) : (
        <span className="inline-block h-2 w-2 flex-none rounded-full bg-ink-faint" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
        {option.label}
      </span>
      {option.hint ? (
        <span className="flex-none text-[11px] tabular-nums text-ink-quiet">
          {option.hint}
        </span>
      ) : null}
      <span
        className={
          "font-mono text-[10px] tabular-nums transition-opacity " +
          (active ? "text-brand opacity-100" : "text-ink-faint opacity-0")
        }
      >
        ↵
      </span>
    </li>
  );
}

/** A quiet legend for the facet triggers — shown in the empty state. */
export function ScopeFacetLegend({ facets }: { facets: ScopeFacet[] }) {
  return (
    <Fragment>
      {facets.map((facet, index) => (
        <Fragment key={facet.key}>
          {index > 0 ? <span className="text-ink-faint"> · </span> : null}
          <span className="font-mono text-ink-soft">
            {facet.sigil ?? `${facet.key}:`}
          </span>{" "}
          <span className="text-ink-quiet">{facet.label.toLowerCase()}</span>
        </Fragment>
      ))}
    </Fragment>
  );
}
