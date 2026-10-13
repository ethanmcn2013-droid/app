"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShellIcon } from "@/components/shell/shell-icons";
import {
  MEAL_LABEL,
  MEAL_VALUES,
  NO_FILTER,
  RSVP_LABEL,
  RSVP_VALUES,
  filterHouseholds,
  guestName,
  guestTotals,
  householdRsvp,
  initials,
  type Guest,
  type GuestFilter,
  type Household,
  type Meal,
  type Rsvp,
} from "@/lib/wedding/guests";
import {
  addGuestAction,
  addHouseholdAction,
  deleteGuestAction,
  deleteHouseholdAction,
  importGuestsAction,
  setHouseholdRsvpAction,
  updateGuestAction,
  updateHouseholdAction,
  type WeddingGuestResult,
} from "@/server/actions/wedding-guests";
import { AddGuestsDialog, CatererDialog, HouseholdDialog, ImportDialog, localHousehold } from "./guest-dialogs";
import styles from "./wedding.module.css";

/**
 * The guest list (Wedding tools, 12 Oct 2026). One invitation per household,
 * one reply per person. Replies, meals and dietary needs change in place;
 * everything else about a household opens in its own panel.
 *
 * Changes show at once and are saved behind them. A save that fails puts the
 * list back as it was and says so. The sample list changes only on screen.
 */

type Dialog = null | "add" | "import" | "caterer" | Readonly<{ household: string }>;
type Notice = Readonly<{ tone: "info" | "error"; text: string }> | null;

export type GuestListProps = Readonly<{
  projectId: string;
  projectName: string;
  households: readonly Household[];
  weddingDate: string | null;
  today: string;
  sample: boolean;
}>;

export function GuestList({ projectId, projectName, households: initial, weddingDate, today, sample }: GuestListProps) {
  const router = useRouter();
  const [households, setHouseholds] = useState<readonly Household[]>(initial);
  const [filter, setFilter] = useState<GuestFilter>(NO_FILTER);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [, startRefresh] = useTransition();

  // A fresh server read replaces the local copy (after a save, or a teammate's).
  const [read, setRead] = useState(initial);
  if (read !== initial) {
    setRead(initial);
    setHouseholds(initial);
  }

  const totals = useMemo(() => guestTotals(households), [households]);
  const shown = useMemo(() => filterHouseholds(households, filter), [households, filter]);
  const groups = useMemo(() => [...new Set(households.map((h) => h.groupLabel).filter((g): g is string => Boolean(g)))].sort(), [households]);
  const filtered = filter !== NO_FILTER && (filter.query.trim() !== "" || filter.rsvp !== "all" || filter.meal !== "all" || filter.invitedTo !== "all");
  const shownPeople = shown.reduce((n, h) => n + h.guests.length, 0);

  /**
   * Shows a change now, then saves it. In the sample the change stays on
   * screen only; elsewhere a refusal restores the list as it was.
   */
  async function change(next: (list: readonly Household[]) => readonly Household[], save: () => Promise<WeddingGuestResult<unknown>>): Promise<boolean> {
    const before = households;
    setHouseholds(next(before));
    if (sample) {
      setNotice({ tone: "info", text: "This is a sample guest list. Changes show here but aren’t saved." });
      return true;
    }
    const result = await save();
    if (!result.ok) {
      setHouseholds(before);
      setNotice({ tone: "error", text: result.message });
      return false;
    }
    setNotice(null);
    startRefresh(() => router.refresh());
    return true;
  }

  const mapGuest = (id: string, patch: Partial<Guest>) => (list: readonly Household[]) =>
    list.map((h) => (h.guests.some((g) => g.id === id) ? { ...h, guests: h.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) } : h));
  const mapHousehold = (id: string, patch: (h: Household) => Household) => (list: readonly Household[]) =>
    list.map((h) => (h.id === id ? patch(h) : h));

  const actions = {
    setRsvp: (guest: Guest, rsvp: Rsvp) => change(mapGuest(guest.id, { rsvp }), () => updateGuestAction(projectId, guest.id, { rsvp })),
    setMeal: (guest: Guest, meal: Meal) => change(mapGuest(guest.id, { meal }), () => updateGuestAction(projectId, guest.id, { meal })),
    setDietary: (guest: Guest, dietary: string) => {
      const value = dietary.trim() || null;
      if (value === (guest.dietary ?? null)) return Promise.resolve(true);
      return change(mapGuest(guest.id, { dietary: value }), () => updateGuestAction(projectId, guest.id, { dietary: value }));
    },
    setHouseholdRsvp: (household: Household, rsvp: Rsvp) =>
      change(mapHousehold(household.id, (h) => ({ ...h, guests: h.guests.map((g) => ({ ...g, rsvp })) })), () => setHouseholdRsvpAction(projectId, household.id, rsvp)),
  };

  const open = typeof dialog === "object" && dialog !== null ? households.find((h) => h.id === dialog.household) ?? null : null;
  const countdown = describeCountdown(weddingDate, today);

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <p className={styles.eyebrow}>Wedding tools</p>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Guest list</h1>
              <span className={styles.scope}>
                <i aria-hidden="true" />
                {projectName}
              </span>
              {countdown ? <span className={styles.countdown}>{countdown}</span> : null}
            </div>
            <p className={styles.summary}>
              {totals.people > 0 ? (
                <>
                  <span>{plural(totals.people, "guest")} in {plural(totals.households, "household")}</span>
                  {totals.evening > 0 ? <span>{totals.evening} for the evening only</span> : null}
                  {totals.children > 0 ? <span>{plural(totals.children, "child", "children")}</span> : null}
                </>
              ) : (
                <span>Everyone you are inviting, who has replied, and what they will eat.</span>
              )}
            </p>
          </div>
          <div className={styles.headActions}>
            {totals.people > 0 ? (
              <>
                <button type="button" className={styles.btn} onClick={() => setDialog("import")}>
                  <UploadIcon />
                  Import
                </button>
                <button type="button" className={styles.btn} onClick={() => setDialog("caterer")}>
                  <DownloadIcon />
                  Caterer&rsquo;s list
                </button>
              </>
            ) : null}
            <button type="button" className={styles.btnPrimary} onClick={() => setDialog("add")}>
              <ShellIcon.plus size={14} />
              Add guests
            </button>
          </div>
        </header>

        {notice ? (
          <p className={notice.tone === "error" ? styles.noticeError : styles.notice} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.tone === "error" ? <ShellIcon.alert size={14} /> : <InfoIcon />}
            <span>{notice.text}</span>
            <button type="button" className={styles.noticeClose} onClick={() => setNotice(null)} aria-label="Dismiss">
              <ShellIcon.close size={12} />
            </button>
          </p>
        ) : null}

        {totals.people === 0 ? (
          <EmptyList onAdd={() => setDialog("add")} onImport={() => setDialog("import")} />
        ) : (
          <>
            <Replies totals={totals} filter={filter} onFilter={setFilter} />
            <Toolbar filter={filter} onFilter={setFilter} />
            <p className={styles.resultLine} aria-live="polite">
              {filtered ? (
                <>
                  Showing {plural(shownPeople, "guest")} of {totals.people}.{" "}
                  <button type="button" className={styles.linkBtn} onClick={() => setFilter(NO_FILTER)}>
                    Show everyone
                  </button>
                </>
              ) : (
                <>Each household is one invitation. Change a reply, meal or dietary need right here.</>
              )}
            </p>
            {shown.length === 0 ? (
              <section className={styles.noMatch}>
                <h2>No one matches</h2>
                <p>Try another name, or show everyone again.</p>
                <button type="button" className={styles.btn} onClick={() => setFilter(NO_FILTER)}>
                  Show everyone
                </button>
              </section>
            ) : (
              <ol className={styles.households}>
                {shown.map((household) => {
                  const full = households.find((h) => h.id === household.id) ?? household;
                  return (
                    <HouseholdCard
                      key={household.id}
                      household={household}
                      full={full}
                      actions={actions}
                      onOpen={() => setDialog({ household: household.id })}
                    />
                  );
                })}
              </ol>
            )}
          </>
        )}

        <AddGuestsDialog
          open={dialog === "add"}
          groups={groups}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const ok = await change((list) => [...list, localHousehold(input)], () => addHouseholdAction(projectId, input));
            if (ok) setDialog(null);
            return ok;
          }}
        />
        <ImportDialog
          open={dialog === "import"}
          onClose={() => setDialog(null)}
          onSubmit={async (text, preview) => {
            const ok = await change((list) => [...list, ...preview.map(localHousehold)], () => importGuestsAction(projectId, text));
            if (ok) {
              setDialog(null);
              const people = preview.reduce((n, g) => n + g.guests.length, 0);
              if (!sample) setNotice({ tone: "info", text: `Added ${plural(people, "guest")} in ${plural(preview.length, "household")}.` });
            }
            return ok;
          }}
        />
        <CatererDialog open={dialog === "caterer"} households={households} projectName={projectName} onClose={() => setDialog(null)} />
        <HouseholdDialog
          household={open}
          groups={groups}
          onClose={() => setDialog(null)}
          onSave={(patch) =>
            change(mapHousehold(open!.id, (h) => ({ ...h, ...patch, name: patch.name?.trim() || h.name })), () => updateHouseholdAction(projectId, open!.id, patch))
          }
          onRename={(guest, firstName, lastName) =>
            change(mapGuest(guest.id, { firstName: firstName.trim() || null, lastName: lastName.trim() || null }), () =>
              updateGuestAction(projectId, guest.id, { firstName, lastName }),
            )
          }
          onChild={(guest, isChild) => change(mapGuest(guest.id, { isChild }), () => updateGuestAction(projectId, guest.id, { isChild }))}
          onAddPerson={(input) => {
            const id = `local-${Math.random().toString(36).slice(2)}`;
            const guest: Guest = {
              id,
              householdId: open!.id,
              firstName: input.firstName?.trim() || null,
              lastName: input.lastName?.trim() || null,
              rsvp: "awaiting",
              meal: input.isChild ? "child" : "not_provided",
              dietary: null,
              isChild: input.isChild === true,
              plusOneOf: input.plusOneOf ?? null,
            };
            return change(mapHousehold(open!.id, (h) => ({ ...h, guests: [...h.guests, guest] })), () => addGuestAction(projectId, open!.id, input));
          }}
          onRemovePerson={async (guest) => {
            const last = open!.guests.filter((g) => g.id !== guest.id && g.plusOneOf !== guest.id).length === 0;
            const ok = await change(
              (list) =>
                list
                  .map((h) =>
                    h.id === open!.id
                      ? { ...h, guests: h.guests.filter((g) => g.id !== guest.id && !(g.plusOneOf === guest.id && !g.firstName)).map((g) => (g.plusOneOf === guest.id ? { ...g, plusOneOf: null } : g)) }
                      : h,
                  )
                  .filter((h) => h.guests.length > 0),
              () => deleteGuestAction(projectId, guest.id),
            );
            if (ok && last) setDialog(null);
            return ok;
          }}
          onRemoveHousehold={async () => {
            const id = open!.id;
            const ok = await change((list) => list.filter((h) => h.id !== id), () => deleteHouseholdAction(projectId, id));
            if (ok) setDialog(null);
            return ok;
          }}
        />
      </div>
    </div>
  );
}

// ── Replies: the one picture of where things stand ────────────────────────

function Replies({ totals, filter, onFilter }: { totals: ReturnType<typeof guestTotals>; filter: GuestFilter; onFilter: (f: GuestFilter) => void }) {
  const parts: { key: Rsvp; n: number; tone: string }[] = [
    { key: "attending", n: totals.attending, tone: styles.toneYes },
    { key: "awaiting", n: totals.awaiting, tone: styles.toneWait },
    { key: "not_attending", n: totals.notAttending, tone: styles.toneNo },
  ];
  const pick = (rsvp: Rsvp | "all", meal: Meal | "all" = "all") => onFilter({ ...NO_FILTER, query: filter.query, rsvp, meal });
  return (
    <section className={styles.replies} aria-label="Replies so far">
      <div className={styles.replyBar} role="img" aria-label={`${totals.attending} attending, ${totals.awaiting} awaiting a reply, ${totals.notAttending} not attending`}>
        {parts.map((p) => (p.n > 0 ? <span key={p.key} className={p.tone} style={{ flexGrow: p.n }} /> : null))}
      </div>
      <div className={styles.replyStats}>
        {parts.map((p) => (
          <button
            key={p.key}
            type="button"
            className={styles.stat}
            aria-pressed={filter.rsvp === p.key}
            onClick={() => pick(filter.rsvp === p.key ? "all" : p.key)}
          >
            <span className={styles.statValue}>
              <i className={p.tone} aria-hidden="true" />
              {p.n}
            </span>
            <span className={styles.statLabel}>{p.key === "awaiting" ? "Awaiting a reply" : RSVP_LABEL[p.key]}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.stat}
          aria-pressed={filter.rsvp === "attending" && filter.meal === "not_provided"}
          onClick={() => (filter.meal === "not_provided" ? pick("all") : pick("attending", "not_provided"))}
          disabled={totals.mealsMissing === 0}
        >
          <span className={styles.statValue}>{totals.mealsMissing}</span>
          <span className={styles.statLabel}>{totals.mealsMissing === 0 ? "Every meal chosen" : "Meals still to choose"}</span>
        </button>
        <div className={styles.statStatic}>
          <span className={styles.statValue}>{totals.dietaryAlerts}</span>
          <span className={styles.statLabel}>{totals.dietaryAlerts === 1 ? "Dietary need to share" : "Dietary needs to share"}</span>
        </div>
      </div>
    </section>
  );
}

function Toolbar({ filter, onFilter }: { filter: GuestFilter; onFilter: (f: GuestFilter) => void }) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <ShellIcon.search size={15} />
        <span className="sr-only">Find a guest</span>
        <input
          type="search"
          value={filter.query}
          placeholder="Find a guest, household or group"
          onChange={(e) => onFilter({ ...filter, query: e.target.value })}
          autoComplete="off"
        />
      </label>
      <label className={styles.filterSelect}>
        <span className="sr-only">Reply</span>
        <select value={filter.rsvp} onChange={(e) => onFilter({ ...filter, rsvp: e.target.value as GuestFilter["rsvp"] })}>
          <option value="all">Every reply</option>
          {RSVP_VALUES.map((v) => (
            <option key={v} value={v}>{RSVP_LABEL[v]}</option>
          ))}
        </select>
      </label>
      <label className={styles.filterSelect}>
        <span className="sr-only">Meal</span>
        <select value={filter.meal} onChange={(e) => onFilter({ ...filter, meal: e.target.value as GuestFilter["meal"] })}>
          <option value="all">Every meal</option>
          {MEAL_VALUES.map((v) => (
            <option key={v} value={v}>{MEAL_LABEL[v]}</option>
          ))}
        </select>
      </label>
      <div className={styles.segmented} role="group" aria-label="Invited to">
        {(["all", "day", "evening"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={filter.invitedTo === v} onClick={() => onFilter({ ...filter, invitedTo: v })}>
            {v === "all" ? "Everyone" : v === "day" ? "Whole day" : "Evening"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── One invitation ──────────────────────────────────────────────────────

type RowActions = Readonly<{
  setRsvp: (guest: Guest, rsvp: Rsvp) => Promise<boolean>;
  setMeal: (guest: Guest, meal: Meal) => Promise<boolean>;
  setDietary: (guest: Guest, dietary: string) => Promise<boolean>;
  setHouseholdRsvp: (household: Household, rsvp: Rsvp) => Promise<boolean>;
}>;

function HouseholdCard({ household, full, actions, onOpen }: { household: Household; full: Household; actions: RowActions; onOpen: () => void }) {
  const together = householdRsvp(full);
  const hidden = full.guests.length - household.guests.length;
  return (
    <li className={styles.household}>
      <div className={styles.householdHead}>
        <button type="button" className={styles.householdName} onClick={onOpen} aria-label={`${household.name}: edit the household`}>
          <span className={styles.householdTitle}>{household.name}</span>
          <span className={styles.householdMeta}>
            {household.groupLabel ? <span>{household.groupLabel}</span> : null}
            {household.invitedTo === "evening" ? <span className={styles.tagEvening}>Evening only</span> : null}
            <span className={household.invitation === "sent" ? styles.tagSent : styles.tagUnsent}>
              {household.invitation === "sent" ? "Invitation sent" : "Invitation not sent"}
            </span>
          </span>
        </button>
        {full.guests.length > 1 ? (
          <label className={styles.together}>
            <span>Reply for all {full.guests.length}</span>
            <select
              value={together === "mixed" || together === "empty" ? "" : together}
              onChange={(e) => e.target.value && void actions.setHouseholdRsvp(full, e.target.value as Rsvp)}
              data-rsvp={together}
            >
              {together === "mixed" ? <option value="">Mixed replies</option> : null}
              {RSVP_VALUES.map((v) => (
                <option key={v} value={v}>{RSVP_LABEL[v]}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <ul className={styles.guests}>
        {household.guests.map((guest) => (
          <GuestRow key={guest.id} guest={guest} all={full.guests} actions={actions} />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className={styles.hiddenNote}>
          {plural(hidden, "more person", "more people")} on this invitation {hidden === 1 ? "isn’t" : "aren’t"} shown by your search.
        </p>
      ) : null}
    </li>
  );
}

function GuestRow({ guest, all, actions }: { guest: Guest; all: readonly Guest[]; actions: RowActions }) {
  const name = guestName(guest, all);
  const [dietary, setDietary] = useState(guest.dietary ?? "");
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDietary(guest.dietary ?? "");
  }, [guest.dietary]);
  const unnamed = !guest.firstName;
  return (
    <li className={styles.guest} data-rsvp={guest.rsvp}>
      <span className={styles.avatar} data-unnamed={unnamed || undefined} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={styles.guestName}>
        <span className={unnamed ? styles.nameUnnamed : undefined}>{name}</span>
        {guest.isChild ? <span className={styles.tagChild}>Child</span> : null}
      </span>
      <label className={styles.rsvp}>
        <span className="sr-only">{name}&rsquo;s reply</span>
        <i aria-hidden="true" />
        <select value={guest.rsvp} onChange={(e) => void actions.setRsvp(guest, e.target.value as Rsvp)}>
          {RSVP_VALUES.map((v) => (
            <option key={v} value={v}>{RSVP_LABEL[v]}</option>
          ))}
        </select>
      </label>
      <label className={styles.meal} data-missing={guest.rsvp === "attending" && guest.meal === "not_provided" ? true : undefined}>
        <span className="sr-only">{name}&rsquo;s meal</span>
        <select value={guest.meal} onChange={(e) => void actions.setMeal(guest, e.target.value as Meal)}>
          {MEAL_VALUES.map((v) => (
            <option key={v} value={v}>{v === "not_provided" ? "Meal not chosen" : MEAL_LABEL[v]}</option>
          ))}
        </select>
      </label>
      <label className={styles.dietary} data-filled={dietary.trim() ? true : undefined}>
        <span className="sr-only">{name}&rsquo;s dietary needs</span>
        <input
          value={dietary}
          maxLength={300}
          placeholder="Dietary needs"
          onFocus={() => (editing.current = true)}
          onChange={(e) => setDietary(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDietary(guest.dietary ?? "");
              editing.current = false;
              e.currentTarget.blur();
            }
          }}
          onBlur={() => {
            editing.current = false;
            void actions.setDietary(guest, dietary);
          }}
        />
      </label>
    </li>
  );
}

function EmptyList({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <section className={styles.empty}>
      <span className={styles.emptyArt} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <h2 className={styles.emptyTitle}>Start your guest list</h2>
      <p className={styles.emptyBody}>
        Add people by household, the way the invitations go out. Then keep track of who has replied, what they will eat and
        any dietary needs, and send the caterer a clean list when it is time.
      </p>
      <div className={styles.emptyActions}>
        <button type="button" className={styles.btnPrimary} onClick={onAdd}>
          <ShellIcon.plus size={14} />
          Add guests
        </button>
        <button type="button" className={styles.btn} onClick={onImport}>
          <UploadIcon />
          Import a list
        </button>
      </div>
      <p className={styles.emptyHint}>Already have a spreadsheet? Paste it in or choose the file, and the names are grouped into households for you.</p>
    </section>
  );
}

// ── Small parts ─────────────────────────────────────────────────────────

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "79 days to go" from two calendar dates, never instants. */
export function describeCountdown(date: string | null, today: string): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return "Tomorrow";
  if (days === 0) return "Today";
  return null;
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function UploadIcon() {
  return <Svg><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></Svg>;
}

export function DownloadIcon() {
  return <Svg><path d="M8 2.5v8M5 7.5l3 3 3-3M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" /></Svg>;
}

function InfoIcon() {
  return <Svg><circle cx="8" cy="8" r="6" /><path d="M8 7.5v3.5M8 5h.01" /></Svg>;
}
