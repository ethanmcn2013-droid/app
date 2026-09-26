"use client";

import { motion } from "motion/react";
import { useState } from "react";
import s from "./ledger.module.css";
import { KINDS, OWNERS, PEOPLE, addDays, fmtDate, fmtRelative, parseDate, TODAY, type KindId, type PersonId } from "./data";
import { Kbd } from "./parts";

export type Draft = { name: string; kind: KindId; date: string; owner: PersonId };

export function CreateRow({
  initialKind = "event",
  initialName = "",
  onCommit,
  onCancel,
  hero,
}: {
  initialKind?: KindId;
  initialName?: string;
  onCommit: (d: Draft) => void;
  onCancel: () => void;
  hero?: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<KindId>(initialKind);
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
    onCommit({ name: name.trim(), kind, date, owner });
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
          <span className={s.srOnly}>Kind</span>
          <select className={s.createSelect} value={kind} onChange={(e) => setKind(e.target.value as KindId)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
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
          <span className={s.srOnly}>Owner</span>
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
            {parsed ? `${fmtRelative(date)}. ` : dateText ? "Try “fri”, “12 dec” or “in 3 weeks”. " : ""}
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
