"use client";

/**
 * Column management on the board: the column menu (rename, note, colour,
 * work limit, counts as done, fold, move, delete) and the add-column
 * button at the end of the track. Edits are optimistic and roll back on a
 * refusal (column-config.tsx). Shown only to people who manage the project.
 */

import { useState } from "react";
import { COLUMN_COLORS, COLUMN_PICKER_ORDER, type ColumnColorKey } from "@/lib/board-colors";
import { MAX_COLUMN_LIMIT, MAX_CUSTOM_COLUMNS, MAX_DESCRIPTION_LEN, MAX_NAME_LEN } from "@/lib/board-config";
import type { BoardColumn } from "@/lib/board-columns";
import { useColumnActions } from "./column-config";
import { useSurface } from "./surface";
import { columnTone } from "./status-glyph-model";
import { StatusGlyph } from "./atoms";
import { TIcon } from "./icons";
import {
  Button,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  Popover,
} from "./ui";
import styles from "./board.module.css";

type Editing = "rename" | "note" | "limit" | "delete" | null;

export function ColumnMenu({ column, count, onCollapse }: { column: BoardColumn; count: number; onCollapse: () => void }) {
  const surface = useSurface();
  const actions = useColumnActions();
  const [editing, setEditing] = useState<Editing>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const index = actions.columns.findIndex((c) => c.key === column.key);
  const left = actions.columns[index - 1];
  const right = actions.columns[index + 1];
  const manage = surface.canManage && !surface.readOnly;
  const lastDone = column.isDone && actions.columns.filter((c) => c.isDone).length === 1;

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <button ref={setAnchor} type="button" className={styles.laneButton} aria-label={`${column.name} column options`} tabIndex={-1}>
            <TIcon.more size={14} />
          </button>
        </MenuTrigger>
        <MenuContent align="end" width={236} label={`${column.name} column options`}>
          {manage ? (
            <>
              <MenuItem icon={<TIcon.pencil />} onSelect={() => setEditing("rename")}>Rename</MenuItem>
              <MenuItem icon={<TIcon.list />} onSelect={() => setEditing("note")}>{column.description ? "Edit note" : "Add a note"}</MenuItem>
              <MenuSub>
                <MenuSubTrigger icon={<span className={styles.swatchDot} style={{ background: columnTone(column.color) }} />}>Colour</MenuSubTrigger>
                <MenuSubContent width={200}>
                  {COLUMN_PICKER_ORDER.map((key) => (
                    <MenuItem
                      key={key}
                      icon={<span className={styles.swatchDot} style={{ background: columnTone(key as ColumnColorKey) }} />}
                      hint={column.color === key ? <TIcon.check size={14} /> : null}
                      onSelect={() => actions.setColor(column, key)}
                    >
                      {COLUMN_COLORS[key].label}
                    </MenuItem>
                  ))}
                </MenuSubContent>
              </MenuSub>
              <MenuItem icon={<TIcon.flag />} hint={column.limit !== undefined ? String(column.limit) : null} onSelect={() => setEditing("limit")}>
                Work limit
              </MenuItem>
              <MenuCheckboxItem
                checked={column.isDone}
                icon={<StatusGlyph spec={{ shape: "done", tone: "var(--v3-success)" }} size={15} />}
                keepOpen={false}
                onCheckedChange={() => {
                  if (!lastDone) actions.toggleDone(column);
                }}
                hint={lastDone ? "Needed" : null}
              >
                Counts as done
              </MenuCheckboxItem>
              <MenuSeparator />
            </>
          ) : null}
          <MenuItem icon={<TIcon.collapse />} onSelect={onCollapse}>Fold this column</MenuItem>
          {manage ? (
            <>
              <MenuItem icon={<TIcon.chevronLeft />} disabled={!left} onSelect={() => actions.move(column, -1)}>
                {left ? `Move before ${left.name}` : "Move left"}
              </MenuItem>
              <MenuItem icon={<TIcon.chevronRight />} disabled={!right} onSelect={() => actions.move(column, 1)}>
                {right ? `Move after ${right.name}` : "Move right"}
              </MenuItem>
              {!column.isSystem ? (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<TIcon.trash />} danger onSelect={() => setEditing("delete")}>Delete column</MenuItem>
                </>
              ) : null}
            </>
          ) : null}
        </MenuContent>
      </MenuRoot>

      <Popover open={editing === "rename"} anchor={anchor} onClose={() => setEditing(null)} label={`Rename ${column.name}`} width={280} align="end">
        <FieldForm
          label="Column name"
          initial={column.name}
          maxLength={MAX_NAME_LEN}
          submit="Rename"
          onSubmit={(value) => {
            actions.rename(column, value);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      </Popover>
      <Popover open={editing === "note"} anchor={anchor} onClose={() => setEditing(null)} label={`Note for ${column.name}`} width={300} align="end">
        <FieldForm
          label="What belongs in this column"
          initial={column.description ?? ""}
          maxLength={MAX_DESCRIPTION_LEN}
          submit="Save note"
          allowEmpty
          onSubmit={(value) => {
            actions.describe(column, value);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      </Popover>
      <Popover open={editing === "limit"} anchor={anchor} onClose={() => setEditing(null)} label={`Work limit for ${column.name}`} width={300} align="end">
        <FieldForm
          label="Work limit"
          help="A gentle ceiling. The count turns amber when the column holds more, and nothing is blocked. Leave it empty for no limit."
          initial={column.limit ? String(column.limit) : ""}
          numeric
          submit="Save limit"
          allowEmpty
          onSubmit={(value) => {
            const parsed = value.trim() === "" ? null : Number(value);
            if (parsed === null || (Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_COLUMN_LIMIT)) actions.setLimit(column, parsed);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      </Popover>
      {editing === "delete" ? <DeleteColumn column={column} count={count} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function FieldForm({
  label,
  help,
  initial,
  maxLength,
  numeric,
  submit,
  allowEmpty,
  onSubmit,
  onCancel,
}: {
  label: string;
  help?: string;
  initial: string;
  maxLength?: number;
  numeric?: boolean;
  submit: string;
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className={styles.fieldForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (!allowEmpty && !value.trim()) return;
        onSubmit(value);
      }}
    >
      <label className={styles.fieldLabel}>
        {label}
        <input
          className={styles.fieldInput}
          value={value}
          maxLength={maxLength}
          inputMode={numeric ? "numeric" : undefined}
          data-autofocus=""
          onChange={(event) => setValue(numeric ? event.target.value.replace(/[^0-9]/g, "") : event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      {help ? <p className={styles.fieldHelp}>{help}</p> : null}
      <div className={styles.fieldActions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" size="sm" type="submit" disabled={!allowEmpty && !value.trim()}>{submit}</Button>
      </div>
    </form>
  );
}

/** Delete asks first and names where the tasks go. */
function DeleteColumn({ column, count, onClose }: { column: BoardColumn; count: number; onClose: () => void }) {
  const actions = useColumnActions();
  const others = actions.columns.filter((c) => c.key !== column.key);
  const [destination, setDestination] = useState(others[0]?.key ?? "");
  const destName = others.find((c) => c.key === destination)?.name ?? "another column";
  return (
    <div className={styles.confirmScrim} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.confirm} role="alertdialog" aria-modal="true" aria-labelledby="delete-column-title" aria-describedby="delete-column-body">
        <h2 id="delete-column-title" className={styles.confirmTitle}>Delete “{column.name}”?</h2>
        <p id="delete-column-body" className={styles.confirmBody}>
          {count > 0
            ? `Its ${count} ${count === 1 ? "task moves" : "tasks move"} to ${destName}. Nothing is lost.`
            : "It has no tasks, so nothing else changes."}
        </p>
        {count > 0 ? (
          <label className={styles.fieldLabel}>
            Move its tasks to
            <select className={styles.fieldInput} value={destination} onChange={(event) => setDestination(event.target.value)}>
              {others.map((c) => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.fieldActions}>
          <Button variant="ghost" onClick={onClose} autoFocus>Keep it</Button>
          <Button
            variant="danger"
            onClick={() => {
              actions.remove(column, count > 0 ? destination : undefined);
              onClose();
            }}
          >
            Delete column
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AddColumnButton() {
  const actions = useColumnActions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const custom = actions.columns.filter((c) => !c.isSystem).length;
  const full = custom >= MAX_CUSTOM_COLUMNS;
  return (
    <div className={styles.addColumn}>
      <button
        ref={setAnchor}
        type="button"
        className={styles.addColumnButton}
        disabled={full}
        title={full ? `A board can hold ${MAX_CUSTOM_COLUMNS} columns of your own` : "Add a column"}
        aria-label="Add a column"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <TIcon.plus size={16} />
        <span className={styles.addColumnText}>Add column</span>
      </button>
      <Popover open={open} anchor={anchor} onClose={() => setOpen(false)} label="Add a column" width={280} align="end">
        <FieldForm
          label="Column name"
          help="For example Suppliers, Signed off or On hold."
          initial=""
          maxLength={MAX_NAME_LEN}
          submit="Add column"
          onSubmit={(value) => {
            actions.add(value);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </Popover>
    </div>
  );
}
