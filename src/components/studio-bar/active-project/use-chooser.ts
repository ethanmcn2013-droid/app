"use client";

/**
 * The chooser's semantics — ported from the WP5 lab, unchanged in substance.
 *
 * The lab locked these so every variant argued about composition and visual
 * treatment rather than about roles and keys: the listbox/combobox threshold,
 * active descendant, typeahead, the debounced count announcement, and
 * `aria-selected` on the committed Project only. The founder selected variant
 * A; the semantics it was selected with come with it.
 *
 * Owns no markup. The control renders its own rows, groups and container.
 *
 * Plan §7.3, in order:
 *   · under 8 active Projects, a listbox with character typeahead;
 *   · at 8 or more, a real combobox controlling the listbox, with debounced
 *     result-count announcements;
 *   · Arrow keys, Home/End, Enter, Escape, active descendant, stable focus;
 *   · `aria-selected` on the committed Project only;
 *   · Archived collapsed, and never reachable through the ordinary switch.
 *
 * One production rule the lab had no reason to carry: an ambiguous Project is
 * reachable by key and by pointer, and refuses on activation. Skipping it would
 * make the list disagree with the arrow keys; disabling it would remove the one
 * place the reason can be read.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ProjectId } from "@/lib/projects/project-ref";
import {
  filterChooserCatalog,
  resultCountMessage,
  typeaheadIndex,
  type ChooserCatalog,
  type ChooserGroup,
  type ChooserRow,
} from "@/lib/projects/project-chooser";

const TYPEAHEAD_RESET_MS = 700;
const COUNT_ANNOUNCE_MS = 250;

export type ChooserGroupView = ChooserGroup & { headingId: string };

export type Chooser = Readonly<{
  mode: "listbox" | "combobox";
  query: string;
  setQuery: (value: string) => void;
  /** Groups after filtering, with the archived group folded away when shut. */
  groups: readonly ChooserGroupView[];
  /** Every row a key press can reach, in visual order. */
  rows: readonly ChooserRow[];
  activeIndex: number;
  activeRow: ChooserRow | null;
  setActiveIndex: (index: number) => void;
  archivedOpen: boolean;
  toggleArchived: () => void;
  archivedCount: number;
  hasArchived: boolean;
  listboxId: string;
  inputId: string;
  optionId: (id: ProjectId) => string;
  /** Announced politely, debounced, only once the person has typed. */
  countMessage: string;
  onKeyDown: (event: React.KeyboardEvent) => void;
  registerRow: (id: ProjectId, node: HTMLElement | null) => void;
  choose: (row: ChooserRow) => void;
  isCommitted: (row: ChooserRow) => boolean;
}>;

export function useChooser({
  catalog,
  committedId,
  onChoose,
  onOpenArchived,
  onBlocked,
  onDismiss,
  open,
}: {
  catalog: ChooserCatalog;
  committedId: ProjectId | null;
  onChoose: (row: ChooserRow) => void;
  onOpenArchived?: (row: ChooserRow) => void;
  /** An ambiguous row was activated. The control states the reason. */
  onBlocked?: (row: ChooserRow) => void;
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

  const filtered = useMemo(
    () => filterChooserCatalog(catalog, query),
    [catalog, query],
  );

  const groups = useMemo<ChooserGroupView[]>(
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
  // rather than written back through an effect, so there is no render where the
  // active descendant points at a row that is no longer there.
  const activeIndex = rows.length === 0 ? 0 : Math.min(activeIndexRaw, rows.length - 1);

  // Opening lands on the committed Project, which is where the eye already is.
  //
  // Adjusted during render against a previous-value sentinel rather than in an
  // effect: setting state synchronously inside an effect costs an extra render
  // pass and is what this repo's hooks lint rule refuses.
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

  const registerRow = useCallback((id: ProjectId, node: HTMLElement | null) => {
    if (node) rowNodes.current.set(id, node);
    else rowNodes.current.delete(id);
  }, []);

  const choose = useCallback(
    (row: ChooserRow) => {
      // An ambiguous Project refuses here rather than being skipped or
      // disabled: the row must stay reachable so its reason can be read.
      if (!row.selectable) {
        onBlocked?.(row);
        return;
      }
      // Archived Projects never travel through the ordinary switch (ADR §5).
      if (row.archived) onOpenArchived?.(row);
      else onChoose(row);
    },
    [onChoose, onOpenArchived, onBlocked],
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
      state.buffer =
        now - state.at > TYPEAHEAD_RESET_MS ? event.key : state.buffer + event.key;
      state.at = now;
      const found = typeaheadIndex(rows, state.buffer, activeIndex);
      if (found !== null) {
        event.preventDefault();
        setActiveIndex(found);
      }
    },
    [activeIndex, rows, move, choose, onDismiss, catalog.mode],
  );

  const toggleArchived = useCallback(() => setArchivedOpen((value) => !value), []);

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
    toggleArchived,
    archivedCount: archivedGroup?.rows.length ?? catalog.archivedCount,
    hasArchived: Boolean(archivedGroup),
    listboxId: `${base}-listbox`,
    inputId: `${base}-input`,
    optionId: (id) => `${base}-option-${id}`,
    countMessage,
    onKeyDown,
    registerRow,
    choose,
    isCommitted: (row) => row.id === committedId,
  };
}
