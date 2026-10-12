"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ShellIcon } from "@/components/shell/shell-icons";
import {
  GROUP_MAX,
  HOUSEHOLD_NAME_MAX,
  NAME_MAX,
  NOTES_MAX,
  catererCsv,
  defaultHouseholdName,
  groupImport,
  guestName,
  guestTotals,
  parseGuestImport,
  type Guest,
  type Household,
  type InvitedTo,
  type HouseholdPatch,
  type NewHouseholdInput,
} from "@/lib/wedding/guests";
import styles from "./wedding.module.css";

/** A household as it will look once saved, shown while the save runs. */
export function localHousehold(input: NewHouseholdInput): Household {
  const id = `local-${Math.random().toString(36).slice(2)}`;
  const guests: Guest[] = input.guests
    .filter((g) => g.firstName.trim())
    .map((g, i) => ({
      id: `${id}-${i}`,
      householdId: id,
      firstName: g.firstName.trim(),
      lastName: g.lastName?.trim() || null,
      rsvp: "awaiting",
      meal: g.isChild ? "child" : "not_provided",
      dietary: null,
      isChild: g.isChild === true,
      plusOneOf: null,
    }));
  if (input.unnamedPlusOne && guests[0]) {
    guests.push({ id: `${id}-plus`, householdId: id, firstName: null, lastName: null, rsvp: "awaiting", meal: "not_provided", dietary: null, isChild: false, plusOneOf: guests[0].id });
  }
  return {
    id,
    name: input.name?.trim() || defaultHouseholdName(input.guests.filter((g) => g.firstName.trim())),
    email: input.email?.trim() || null,
    phone: null,
    address: null,
    groupLabel: input.groupLabel?.trim() || null,
    invitedTo: input.invitedTo ?? "day",
    invitation: "not_sent",
    notes: null,
    guests,
  };
}

// ── The shared frame ─────────────────────────────────────────────────────

function Sheet({ open, title, lead, onClose, children, busy }: { open: boolean; title: string; lead?: ReactNode; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      {open ? (
        <div className={styles.sheetBody}>
          <header className={styles.sheetHead}>
            <div>
              <h2 id={titleId}>{title}</h2>
              {lead ? <p>{lead}</p> : null}
            </div>
            <button type="button" className={styles.iconBtn} onClick={onClose} disabled={busy} aria-label="Close">
              <ShellIcon.close size={14} />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

function GroupInput({ value, onChange, groups, id }: { value: string; onChange: (v: string) => void; groups: readonly string[]; id: string }) {
  return (
    <>
      <input id={id} list={`${id}-groups`} value={value} maxLength={GROUP_MAX} placeholder="For example, Mara’s family" onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      <datalist id={`${id}-groups`}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </>
  );
}

function InvitedToChoice({ value, onChange }: { value: InvitedTo; onChange: (v: InvitedTo) => void }) {
  return (
    <fieldset className={styles.choice}>
      <legend>Invited to</legend>
      <label>
        <input type="radio" checked={value === "day"} onChange={() => onChange("day")} />
        <span>
          <strong>The whole day</strong>
          <small>Ceremony, meal and evening</small>
        </span>
      </label>
      <label>
        <input type="radio" checked={value === "evening"} onChange={() => onChange("evening")} />
        <span>
          <strong>The evening only</strong>
          <small>No seat at the meal</small>
        </span>
      </label>
    </fieldset>
  );
}

// ── Add guests ───────────────────────────────────────────────────────────

type Draft = { key: number; firstName: string; lastName: string; isChild: boolean };

export function AddGuestsDialog({ open, groups, onClose, onSubmit }: { open: boolean; groups: readonly string[]; onClose: () => void; onSubmit: (input: NewHouseholdInput) => Promise<boolean> }) {
  const base = useId();
  const [people, setPeople] = useState<Draft[]>([{ key: 0, firstName: "", lastName: "", isChild: false }]);
  const [plusOne, setPlusOne] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [email, setEmail] = useState("");
  const [invitedTo, setInvitedTo] = useState<InvitedTo>("day");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPeople([{ key: 0, firstName: "", lastName: "", isChild: false }]);
    setPlusOne(false);
    setName("");
    setEmail("");
    setInvitedTo("day");
    setError(null);
    requestAnimationFrame(() => first.current?.focus());
  }, [open]);

  const named = people.filter((p) => p.firstName.trim());
  const suggested = named.length ? defaultHouseholdName(named.map((p) => ({ firstName: p.firstName, lastName: p.lastName }))) : "";
  const count = named.length + (plusOne && named.length ? 1 : 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!named.length) {
      setError("Add at least one guest’s first name.");
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onSubmit({
      guests: named.map((p) => ({ firstName: p.firstName, lastName: p.lastName || null, isChild: p.isChild })),
      unnamedPlusOne: plusOne,
      name: name.trim() || null,
      groupLabel: group.trim() || null,
      email: email.trim() || null,
      invitedTo,
    });
    setBusy(false);
    if (!ok) setError("That didn’t save. Check the details and try again.");
  }

  return (
    <Sheet open={open} title="Add guests" lead="One invitation at a time. Add everyone it goes to, even the children." onClose={onClose} busy={busy}>
      <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.people} disabled={busy}>
          <legend>Who is invited</legend>
          {people.map((p, i) => (
            <div key={p.key} className={styles.personRow}>
              <label>
                <span className="sr-only">First name, person {i + 1}</span>
                <input
                  ref={i === 0 ? first : undefined}
                  value={p.firstName}
                  maxLength={NAME_MAX}
                  placeholder="First name"
                  autoComplete="off"
                  onChange={(e) => setPeople(people.map((q) => (q.key === p.key ? { ...q, firstName: e.target.value } : q)))}
                />
              </label>
              <label>
                <span className="sr-only">Last name, person {i + 1}</span>
                <input
                  value={p.lastName}
                  maxLength={NAME_MAX}
                  placeholder="Last name"
                  autoComplete="off"
                  onChange={(e) => setPeople(people.map((q) => (q.key === p.key ? { ...q, lastName: e.target.value } : q)))}
                />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={p.isChild} onChange={(e) => setPeople(people.map((q) => (q.key === p.key ? { ...q, isChild: e.target.checked } : q)))} />
                <span>Child</span>
              </label>
              {people.length > 1 ? (
                <button type="button" className={styles.iconBtn} aria-label={`Remove person ${i + 1}`} onClick={() => setPeople(people.filter((q) => q.key !== p.key))}>
                  <ShellIcon.close size={12} />
                </button>
              ) : (
                <span className={styles.iconSpacer} />
              )}
            </div>
          ))}
          <div className={styles.peopleActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setPeople([...people, { key: Math.max(...people.map((p) => p.key)) + 1, firstName: "", lastName: people[0]?.lastName ?? "", isChild: false }])}
              disabled={people.length >= 12}
            >
              <ShellIcon.plus size={12} />
              Another person
            </button>
            <label className={styles.check}>
              <input type="checkbox" checked={plusOne} onChange={(e) => setPlusOne(e.target.checked)} />
              <span>Plus-one, name to come</span>
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fields} disabled={busy}>
          <label htmlFor={`${base}-name`}>Household name</label>
          <input id={`${base}-name`} value={name} maxLength={HOUSEHOLD_NAME_MAX} placeholder={suggested || "For example, the Byrne household"} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <label htmlFor={`${base}-group`}>Group <small>optional</small></label>
          <GroupInput id={`${base}-group`} value={group} onChange={setGroup} groups={groups} />
          <label htmlFor={`${base}-email`}>Email for the invitation <small>optional</small></label>
          <input id={`${base}-email`} type="email" value={email} maxLength={254} placeholder="name@example.com" onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </fieldset>

        <InvitedToChoice value={invitedTo} onChange={setInvitedTo} />

        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
        <footer className={styles.sheetFoot}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy || count === 0}>
            {busy ? "Adding…" : count > 1 ? `Add ${count} guests` : "Add guest"}
          </button>
        </footer>
      </form>
    </Sheet>
  );
}

// ── Import ───────────────────────────────────────────────────────────────

export function ImportDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (text: string, preview: NewHouseholdInput[]) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileId = useId();
  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);
  const parsed = useMemo(() => parseGuestImport(text), [text]);
  const groups = useMemo(() => groupImport(parsed.rows), [parsed]);

  return (
    <Sheet
      open={open}
      title="Import a guest list"
      lead="Paste names from a spreadsheet, a document or a message, or choose a CSV file. One person per line."
      onClose={onClose}
      busy={busy}
    >
      <form
        className={styles.form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!groups.length) return;
          setBusy(true);
          setError(null);
          const ok = await onSubmit(text, groups);
          setBusy(false);
          if (!ok) setError("Nothing was added. Check the list and try again.");
        }}
      >
        <label className="sr-only" htmlFor={`${fileId}-paste`}>Names to import</label>
        <textarea
          id={`${fileId}-paste`}
          className={styles.paste}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"Siobhán Byrne, siobhan@example.com\nDeclan Byrne, siobhan@example.com\nConor Gallagher"}
          disabled={busy}
        />
        <div className={styles.importRow}>
          <label className={styles.ghostBtn} htmlFor={fileId}>
            <ShellIcon.files size={13} />
            Choose a file
          </label>
          <input
            id={fileId}
            className="sr-only"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 200_000) {
                setError("That file is too large. Try a list of up to 600 people.");
                return;
              }
              setText(await file.text());
              e.target.value = "";
            }}
          />
          <span className={styles.importHint}>Columns named First name, Last name, Household and Email are used if there is a header row.</span>
        </div>

        {text.trim() ? (
          <section className={styles.preview} aria-live="polite">
            <p className={styles.previewLine}>
              {parsed.rows.length ? (
                <>
                  <strong>{parsed.rows.length} {parsed.rows.length === 1 ? "person" : "people"}</strong> in {groups.length} {groups.length === 1 ? "household" : "households"}
                </>
              ) : (
                "No names found yet"
              )}
              {parsed.skipped ? <span> · {parsed.skipped} {parsed.skipped === 1 ? "line" : "lines"} skipped</span> : null}
            </p>
            <ul>
              {groups.slice(0, 6).map((g, i) => (
                <li key={i}>
                  <strong>{g.name || defaultHouseholdName(g.guests)}</strong>
                  <span>{g.guests.map((p) => [p.firstName, p.lastName].filter(Boolean).join(" ")).join(", ")}</span>
                </li>
              ))}
            </ul>
            {groups.length > 6 ? <p className={styles.previewMore}>and {groups.length - 6} more</p> : null}
          </section>
        ) : null}

        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
        <footer className={styles.sheetFoot}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className={styles.btnPrimary} disabled={busy || parsed.rows.length === 0}>
            {busy ? "Adding…" : parsed.rows.length ? `Add ${parsed.rows.length} ${parsed.rows.length === 1 ? "guest" : "guests"}` : "Add guests"}
          </button>
        </footer>
      </form>
    </Sheet>
  );
}

// ── The caterer's list ───────────────────────────────────────────────────

export function CatererDialog({ open, households, projectName, onClose }: { open: boolean; households: readonly Household[]; projectName: string; onClose: () => void }) {
  const [meal, setMeal] = useState(true);
  const [dietary, setDietary] = useState(true);
  const [household, setHousehold] = useState(false);
  const totals = guestTotals(households);

  function download() {
    const csv = catererCsv(households, { meal, dietary, household });
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Wedding"} caterer list.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Sheet open={open} title="The caterer’s list" lead="A spreadsheet of everyone attending, with what they will eat. Contact details and notes stay out of it." onClose={onClose}>
      <div className={styles.form}>
        <div className={styles.catererSummary}>
          <div><strong>{totals.attending}</strong><span>attending</span></div>
          <div><strong>{totals.mealsMissing}</strong><span>{totals.mealsMissing === 1 ? "meal" : "meals"} not chosen</span></div>
          <div><strong>{totals.dietaryAlerts}</strong><span>with dietary needs</span></div>
        </div>
        {totals.awaiting > 0 ? (
          <p className={styles.softNote}>
            {totals.awaiting} {totals.awaiting === 1 ? "guest hasn’t" : "guests haven’t"} replied yet, so {totals.awaiting === 1 ? "they’re" : "they’re"} not on this list.
          </p>
        ) : null}
        <fieldset className={styles.checks}>
          <legend>Include</legend>
          <label className={styles.check}><input type="checkbox" checked disabled /><span>Guest name</span></label>
          <label className={styles.check}><input type="checkbox" checked={meal} onChange={(e) => setMeal(e.target.checked)} /><span>Meal</span></label>
          <label className={styles.check}><input type="checkbox" checked={dietary} onChange={(e) => setDietary(e.target.checked)} /><span>Dietary needs</span></label>
          <label className={styles.check}><input type="checkbox" checked={household} onChange={(e) => setHousehold(e.target.checked)} /><span>Household</span></label>
        </fieldset>
        <footer className={styles.sheetFoot}>
          <button type="button" className={styles.btn} onClick={onClose}>Close</button>
          <button type="button" className={styles.btnPrimary} onClick={download} disabled={totals.attending === 0}>
            Download spreadsheet
          </button>
        </footer>
      </div>
    </Sheet>
  );
}

// ── One household, in full ───────────────────────────────────────────────

export function HouseholdDialog({
  household,
  groups,
  onClose,
  onSave,
  onRename,
  onChild,
  onAddPerson,
  onRemovePerson,
  onRemoveHousehold,
}: {
  household: Household | null;
  groups: readonly string[];
  onClose: () => void;
  onSave: (patch: HouseholdPatch) => Promise<boolean>;
  onRename: (guest: Guest, firstName: string, lastName: string) => Promise<boolean>;
  onChild: (guest: Guest, isChild: boolean) => Promise<boolean>;
  onAddPerson: (input: { firstName?: string | null; lastName?: string | null; isChild?: boolean; plusOneOf?: string | null }) => Promise<boolean>;
  onRemovePerson: (guest: Guest) => Promise<boolean>;
  onRemoveHousehold: () => Promise<boolean>;
}) {
  const base = useId();
  const [form, setForm] = useState({ name: "", groupLabel: "", email: "", phone: "", address: "", notes: "", invitedTo: "day" as InvitedTo, invitation: "not_sent" as "sent" | "not_sent" });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [newPerson, setNewPerson] = useState("");
  const openId = household?.id ?? null;

  useEffect(() => {
    if (!household) return;
    setForm({
      name: household.name,
      groupLabel: household.groupLabel ?? "",
      email: household.email ?? "",
      phone: household.phone ?? "",
      address: household.address ?? "",
      notes: household.notes ?? "",
      invitedTo: household.invitedTo,
      invitation: household.invitation,
    });
    setConfirming(false);
    setNewPerson("");
    // Only when another household opens: a save must not reset the form under the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const dirty =
    household !== null &&
    (form.name !== household.name ||
      form.groupLabel !== (household.groupLabel ?? "") ||
      form.email !== (household.email ?? "") ||
      form.phone !== (household.phone ?? "") ||
      form.address !== (household.address ?? "") ||
      form.notes !== (household.notes ?? "") ||
      form.invitedTo !== household.invitedTo ||
      form.invitation !== household.invitation);

  async function run(task: () => Promise<boolean>) {
    setBusy(true);
    await task();
    setBusy(false);
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <Sheet open={household !== null} title={household?.name ?? "Household"} lead="Everyone on this invitation, and how to reach them." onClose={onClose} busy={busy}>
      {household ? (
        <div className={styles.form}>
          <section className={styles.detailPeople} aria-label="People on this invitation">
            {household.guests.map((guest) => (
              <PersonEditor key={guest.id} guest={guest} all={household.guests} busy={busy} onRename={onRename} onChild={onChild} onRemove={() => run(() => onRemovePerson(guest))} onPlusOne={() => run(() => onAddPerson({ plusOneOf: guest.id }))} />
            ))}
            <form
              className={styles.addPerson}
              onSubmit={(e) => {
                e.preventDefault();
                const parts = newPerson.trim().split(/\s+/).filter(Boolean);
                if (!parts.length) return;
                const firstName = parts.shift()!;
                void run(async () => {
                  const ok = await onAddPerson({ firstName, lastName: parts.join(" ") || null });
                  if (ok) setNewPerson("");
                  return ok;
                });
              }}
            >
              <label className="sr-only" htmlFor={`${base}-new`}>Add a person to this invitation</label>
              <input id={`${base}-new`} value={newPerson} maxLength={NAME_MAX * 2} placeholder="Add a person by name" onChange={(e) => setNewPerson(e.target.value)} disabled={busy} autoComplete="off" />
              <button type="submit" className={styles.btn} disabled={busy || !newPerson.trim()}>Add</button>
            </form>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                onSave({
                  name: form.name,
                  groupLabel: form.groupLabel,
                  email: form.email,
                  phone: form.phone,
                  address: form.address,
                  notes: form.notes,
                  invitedTo: form.invitedTo,
                  invitation: form.invitation,
                }),
              );
            }}
          >
            <fieldset className={styles.fields} disabled={busy}>
              <label htmlFor={`${base}-hn`}>Household name</label>
              <input id={`${base}-hn`} required maxLength={HOUSEHOLD_NAME_MAX} {...field("name")} autoComplete="off" />
              <label htmlFor={`${base}-group`}>Group</label>
              <GroupInput id={`${base}-group`} value={form.groupLabel} onChange={(v) => setForm({ ...form, groupLabel: v })} groups={groups} />
              <label htmlFor={`${base}-email`}>Email</label>
              <input id={`${base}-email`} type="email" maxLength={254} {...field("email")} autoComplete="off" />
              <label htmlFor={`${base}-phone`}>Phone</label>
              <input id={`${base}-phone`} type="tel" maxLength={40} {...field("phone")} autoComplete="off" />
              <label htmlFor={`${base}-address`}>Address</label>
              <textarea id={`${base}-address`} rows={2} maxLength={500} {...field("address")} />
              <label htmlFor={`${base}-notes`}>Notes <small>only you and your team see these</small></label>
              <textarea id={`${base}-notes`} rows={2} maxLength={NOTES_MAX} {...field("notes")} placeholder="Access needs, who to seat them near, anything worth remembering" />
            </fieldset>
            <InvitedToChoice value={form.invitedTo} onChange={(v) => setForm({ ...form, invitedTo: v })} />
            <label className={styles.toggle}>
              <input type="checkbox" checked={form.invitation === "sent"} onChange={(e) => setForm({ ...form, invitation: e.target.checked ? "sent" : "not_sent" })} disabled={busy} />
              <span>
                <strong>Invitation sent</strong>
                <small>Tick this once it is in the post or their inbox.</small>
              </span>
            </label>
            <footer className={styles.sheetFoot}>
              {confirming ? (
                <span className={styles.confirm}>
                  Remove {household.guests.length === 1 ? guestName(household.guests[0]!, household.guests) : `all ${household.guests.length} people`} from the list?
                  <button type="button" className={styles.dangerBtn} onClick={() => void run(onRemoveHousehold)} disabled={busy}>Remove</button>
                  <button type="button" className={styles.linkBtn} onClick={() => setConfirming(false)}>Keep</button>
                </span>
              ) : (
                <button type="button" className={styles.ghostDanger} onClick={() => setConfirming(true)} disabled={busy}>
                  Remove household
                </button>
              )}
              <span className={styles.footSpacer} />
              <button type="submit" className={styles.btnPrimary} disabled={busy || !dirty}>
                {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </Sheet>
  );
}

function PersonEditor({
  guest,
  all,
  busy,
  onRename,
  onChild,
  onRemove,
  onPlusOne,
}: {
  guest: Guest;
  all: readonly Guest[];
  busy: boolean;
  onRename: (guest: Guest, firstName: string, lastName: string) => Promise<boolean>;
  onChild: (guest: Guest, isChild: boolean) => Promise<boolean>;
  onRemove: () => void;
  onPlusOne: () => void;
}) {
  const [first, setFirst] = useState(guest.firstName ?? "");
  const [last, setLast] = useState(guest.lastName ?? "");
  useEffect(() => {
    setFirst(guest.firstName ?? "");
    setLast(guest.lastName ?? "");
  }, [guest.firstName, guest.lastName]);
  const label = guestName(guest, all);
  const hasPlusOne = all.some((g) => g.plusOneOf === guest.id);
  const commit = () => {
    if (first.trim() === (guest.firstName ?? "") && last.trim() === (guest.lastName ?? "")) return;
    if (!first.trim() && !guest.plusOneOf) {
      setFirst(guest.firstName ?? "");
      return;
    }
    void onRename(guest, first, last);
  };
  return (
    <div className={styles.personEdit}>
      <label>
        <span className="sr-only">First name of {label}</span>
        <input value={first} maxLength={NAME_MAX} placeholder={guest.plusOneOf ? "Name to come" : "First name"} onChange={(e) => setFirst(e.target.value)} onBlur={commit} disabled={busy} autoComplete="off" />
      </label>
      <label>
        <span className="sr-only">Last name of {label}</span>
        <input value={last} maxLength={NAME_MAX} placeholder="Last name" onChange={(e) => setLast(e.target.value)} onBlur={commit} disabled={busy} autoComplete="off" />
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={guest.isChild} onChange={(e) => void onChild(guest, e.target.checked)} disabled={busy} />
        <span>Child</span>
      </label>
      {!guest.plusOneOf && !hasPlusOne && !guest.isChild ? (
        <button type="button" className={styles.ghostBtn} onClick={onPlusOne} disabled={busy}>
          Plus-one
        </button>
      ) : (
        <span />
      )}
      <button type="button" className={styles.iconBtn} onClick={onRemove} disabled={busy} aria-label={`Remove ${label}`}>
        <ShellIcon.close size={12} />
      </button>
    </div>
  );
}
