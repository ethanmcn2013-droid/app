"use client";

import { motion } from "motion/react";
import { useState } from "react";
import s from "./ledger.module.css";
import { OWNERS, PEOPLE, TEMPLATES, addDays, capFirst, fmtDate, fmtRelative, parseDate, templateForKind, TODAY, type KindId, type PersonId } from "./data";
import { Kbd } from "./parts";

export type Draft = { name: string; kind: KindId; date: string; owner: PersonId; template?: string };

const BLANK = "blank";

export function CreateRow({
  initialKind = "event",
  initialName = "",
  initialTemplate,
  onCommit,
  onCancel,
  hero,
}: {
  initialKind?: KindId;
  initialName?: string;
  initialTemplate?: string;
  onCommit: (d: Draft) => void;
  onCancel: () => void;
  hero?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [tpl, setTpl] = useState<string>(initialTemplate ?? templateForKind(initialKind) ?? BLANK);
  const chosen = TEMPLATES.find((t) => t.id === tpl);
  const kind: KindId = chosen?.kind ?? initialKind;
  const [dateText, setDateText] = useState("");
  const [owner, setOwner] = useState<PersonId>("orla");
  const [tried, setTried] = useState(false);
  const parsed = dateText ? parseDate(dateText) : null;
  const date = parsed ?? addDays(TODAY, 30);

  const commit = () => {
    if (!name.trim()) {
      setTried(true);
      return;
    }
    onCommit({ name: name.trim(), kind, date, owner, template: chosen?.id });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <motion.div
      className={s.createRow}
      data-hero={hero || undefined}
      initial={hero ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      onKeyDown={onKey}
      role="row"
    >
      <div className={s.createFields} role="gridcell">
        <span className={s.createSwatch} aria-hidden="true" />
        <input
          autoFocus
          className={s.createName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={hero ? "Name your first project" : "Project name"}
          aria-label="Project name"
          aria-invalid={tried && !name.trim()}
        />
        <label className={s.createField}>
          <span className={s.srOnly}>Start from</span>
          <select className={s.createSelect} value={tpl} onChange={(e) => setTpl(e.target.value)} title="What the project starts with">
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}, {t.tasks} tasks
              </option>
            ))}
            <option value={BLANK}>Blank, no tasks</option>
          </select>
        </label>
        <label className={s.createField} data-wide>
          <span className={s.srOnly}>Date</span>
          <input
            className={s.createDate}
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
            placeholder="Date, like 12 dec"
          />
          <span className={s.createParsed} data-miss={(dateText && !parsed) || undefined}>
            {dateText && !parsed ? "?" : `${fmtDate(date)}`}
          </span>
        </label>
        <label className={s.createField}>
          <span className={s.srOnly}>Lead</span>
          <select className={s.createSelect} value={owner} onChange={(e) => setOwner(e.target.value as PersonId)}>
            {OWNERS.map((p) => (
              <option key={p} value={p}>
                {PEOPLE[p].short}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.createHint}>
        {tried && !name.trim() ? (
          <span className={s.createErr}>Give it a name first.</span>
        ) : (
          <span>
            {chosen ? `Starts with ${chosen.tasks} ${chosen.name.toLowerCase()} tasks, dated back from the day. ` : "Starts empty. "}
            {parsed ? `${capFirst(fmtRelative(date))}. ` : dateText ? "Try “fri”, “12 dec” or “in 3 weeks”. " : ""}
            <Kbd>tab</Kbd> next field <Kbd>↵</Kbd> create{!hero && <> <Kbd>esc</Kbd> cancel</>}
          </span>
        )}
        {hero && (
          <button type="button" className={s.btnPrimarySm} onClick={commit}>
            Create project
          </button>
        )}
      </div>
    </motion.div>
  );
}
