"use client";

/**
 * WP5 lab · the chooser's semantics, shared by every variant.
 *
 * Plan §7.2 locks the accessibility semantics and lets the lab select
 * composition and visual treatment. So this hook owns the parts that must not
 * differ — roles, keys, active descendant, the listbox/combobox threshold,
 * typeahead, the debounced count announcement — and owns no markup at all.
 * Each variant renders its own rows, its own groups and its own container.
 *
 * Plan §7.3, in order:
 *   · under 8 active Projects, a listbox with character typeahead;
 *   · at 8 or more, a real combobox controlling the listbox, with debounced
 *     result-count announcements;
 *   · Arrow keys, Home/End, Enter, Escape, active descendant, stable focus;
 *   · `aria-selected` on the committed Project only;
 *   · Archived collapsed, and never reachable through the ordinary switch.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FixtureProjectId } from "@/lib/project-truth-fixture";
import {
  filterCatalog,
  resultCountMessage,
  typeaheadIndex,
  type LabCatalog,
  type LabGroup,
  type LabRow,
} from "./model";

const TYPEAHEAD_RESET_MS = 700;
const COUNT_ANNOUNCE_MS = 250;

export type ChooserGroup = LabGroup & { headingId: string };

export type Chooser = Readonly<{
  mode: "listbox" | "combobox";
  query: string;
  setQuery: (value: string) => void;
  /** Groups after filtering, with the archived group folded away when shut. */
  groups: readonly ChooserGroup[];
  /** Every row a key press can reach, in visual order. */
  rows: readonly LabRow[];
  activeIndex: number;
  activeRow: LabRow | null;
  setActiveIndex: (index: number) => void;
  archivedOpen: boolean;
  toggleArchived: () => void;
  archivedCount: number;
  hasArchived: boolean;
  listboxId: string;
  inputId: string;
  optionId: (id: FixtureProjectId) => string;
  groupHeadingId: (id: string) => string;
  /** Announced politely, debounced, only once the reviewer has typed. */
  countMessage: string;
  onKeyDown: (event: React.KeyboardEvent) => void;
  registerRow: (id: FixtureProjectId, node: HTMLElement | null) => void;
  choose: (row: LabRow) => void;
  isCommitted: (row: LabRow) => boolean;
}>;

export function useChooser({
  catalog,
  committedId,
  onChoose,
  onOpenArchived,
  onDismiss,
  open,
}: {
  catalog: LabCatalog;
  committedId: FixtureProjectId | null;
  onChoose: (row: LabRow) => void;
  onOpenArchived?: (row: LabRow) => void;
  onDismiss: () => void;
  open: boolean;
}): Chooser {
  const base = useId();
  const [query, setQueryRaw] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [activeIndexRaw, setActiveIndex] = useState(0);
  const [countMessage, setCountMessage] = useState("");
  const [typed, setTyped] = useState(false);

  const typeahead = useRef({ buffer: "", at: 0 });
  const rowNodes = useRef(new Map<string, HTMLElement>());

  const filtered = useMemo(() => filterCatalog(catalog, query), [catalog, query]);

  const groups = useMemo<ChooserGroup[]>(
    () =>
      filtered.groups.map((group) => ({
        ...group,
        headingId: `${base}-group-${group.id}`,
      })),
    [filtered.groups, base],
  );

  // Archived rows are only reachable by key once the disclosure is open.
  const rows = useMemo(
    () =>
      groups.flatMap((group) =>
        group.kind === "archived" && !archivedOpen ? [] : group.rows,
      ),
    [groups, archivedOpen],
  );

  const archivedGroup = groups.find((group) => group.kind === "archived");

  // Filtering moves the ground under the active row. Clamped where it is read
  // rather than written back through an effect, so there is no render where
  // the active descendant points at a row that is no longer there.
  const activeIndex = rows.length === 0 ? 0 : Math.min(activeIndexRaw, rows.length - 1);

  // Opening lands on the committed Project, which is where the eye already is.
  //
  // Adjusted during render against a previous-value sentinel rather than in an
  // effect: setting state synchronously inside an effect costs an extra render
  // pass and is what the hooks lint rule refuses. This is the sanctioned shape.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQueryRaw("");
      setArchivedOpen(false);
      setTyped(false);
      setCountMessage("");
      const index = catalog.rows.findIndex((row) => row.id === committedId);
      setActiveIndex(index >= 0 ? index : 0);
    }
  }

  useEffect(() => {
    if (!typed) return;
    const id = window.setTimeout(
      () => setCountMessage(resultCountMessage(rows.length)),
      COUNT_ANNOUNCE_MS,
    );
    return () => window.clearTimeout(id);
  }, [rows.length, typed, query]);

  // Active descendant does not scroll anything on its own.
  useEffect(() => {
    const row = rows[activeIndex];
    if (!row) return;
    rowNodes.current.get(row.id)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, rows]);

  const setQuery = useCallback((value: string) => {
    setQueryRaw(value);
    setTyped(true);
    setActiveIndex(0);
  }, []);

  const registerRow = useCallback((id: FixtureProjectId, node: HTMLElement | null) => {
    if (node) rowNodes.current.set(id, node);
    else rowNodes.current.delete(id);
  }, []);

  const choose = useCallback(
    (row: LabRow) => {
      // Archived Projects never travel through the ordinary switch (ADR §5).
      if (row.archived) onOpenArchived?.(row);
      else onChoose(row);
    },
    [onChoose, onOpenArchived],
  );

  const move = useCallback(
    (next: number) => {
      if (rows.length === 0) return;
      setActiveIndex(Math.max(0, Math.min(rows.length - 1, next)));
    },
    [rows.length],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          move(activeIndex + 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          move(activeIndex - 1);
          return;
        case "Home":
          event.preventDefault();
          move(0);
          return;
        case "End":
          event.preventDefault();
          move(rows.length - 1);
          return;
        case "Enter": {
          const row = rows[activeIndex];
          if (!row) return;
          event.preventDefault();
          choose(row);
          return;
        }
        case "Escape":
          event.preventDefault();
          onDismiss();
          return;
        default:
          break;
      }

      // Character typeahead, listbox mode only. The combobox has an input;
      // typing there filters, which is the same job done better.
      if (catalog.mode !== "listbox") return;
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const now = Date.now();
      const state = typeahead.current;
      state.buffer = now - state.at > TYPEAHEAD_RESET_MS ? event.key : state.buffer + event.key;
      state.at = now;
      const found = typeaheadIndex(rows, state.buffer, activeIndex);
      if (found !== null) {
        event.preventDefault();
        setActiveIndex(found);
      }
    },
    [activeIndex, rows, move, choose, onDismiss, catalog.mode],
  );

  return {
    mode: catalog.mode,
    query,
    setQuery,
    groups,
    rows,
    activeIndex,
    activeRow: rows[activeIndex] ?? null,
    setActiveIndex,
    archivedOpen,
    toggleArchived: () => setArchivedOpen((value) => !value),
    archivedCount: archivedGroup?.rows.length ?? catalog.archivedCount,
    hasArchived: Boolean(archivedGroup),
    listboxId: `${base}-listbox`,
    inputId: `${base}-input`,
    optionId: (id) => `${base}-option-${id}`,
    groupHeadingId: (id) => `${base}-group-${id}`,
    countMessage,
    onKeyDown,
    registerRow,
    choose,
    isCommitted: (row) => row.id === committedId,
  };
}
