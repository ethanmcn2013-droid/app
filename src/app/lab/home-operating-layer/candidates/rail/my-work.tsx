/**
 * Meridian · My work.
 *
 * THE GROUPS ARE ALREADY A CLOCK. Waiting, Now, Next, Later is the shell's own
 * order and the shell's own definitions are temporal: held up, late or due
 * today, due in the next seven days, further out or without a date. So this
 * mode does not re-sort anything, and that is deliberate rather than lazy —
 * this repository has a contract test about display-time re-sorting of an
 * already-ordered list, and a direction that reordered a contract's groups to
 * suit its own picture would be doing the thing that test exists to catch.
 *
 * WHAT SITS WHERE. Waiting, Now and Next are inside the seven days the read
 * looked at, so they sit between the rules. Later is the group the shell itself
 * defines as further out or undated, so it sits below the horizon, under the
 * group's own note. The horizon here is genuinely the edge of the read rather
 * than a fold: past it is work the seven-day window did not reach.
 *
 * IT IS A LEDGER YOU ACT ON. Round 4 found these rows inert — no mark as done,
 * no change of owner, no link affordance on the titles — on the one mode that is
 * supposed to be a responsibility ledger. Both dispositions the shell publishes
 * now ride on every row at arrival, with refusals struck through and their
 * reasons beside them, which is where this repository's own capability model
 * makes them most legible: a seat that cannot finish work in a project says so
 * on the row it cannot finish.
 *
 * THE UNDATED ARE NOT PLACED. A row with no date prints "No date" in the
 * gutter at full weight rather than a blank, an approximation or a dash. A
 * direction whose structure is time is the one most tempted to invent a
 * position, and this is where it refuses.
 */

import type { MyWorkGroupView, MyWorkRowView } from "@/lib/home-layer/lab-shell";
import {
  Absolute,
  Actions,
  Band_,
  Chronology,
  EmptyField,
  Entries,
  Entry,
  EntryTitle,
  FIRST_RUN_RECORD_LABEL,
  FirstRun,
  HORIZON_MARK,
  LAB_LIMIT_NOTE,
  Meta,
  NO_TIME,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  sameFact,
  SourcePath,
  TheRead,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** The group the shell defines as further out, or with no date at all. */
const BELOW_THE_LINE = "later";

function timeOf(row: MyWorkRowView): string | null {
  if (row.due) return row.due.relative;
  return row.dueUnparsedLine;
}

function WorkEntry({
  row,
  groupNote,
  selectedKey,
  closeHref,
}: {
  row: MyWorkRowView;
  /**
   * The group's own note, so a row can decline to repeat it. Every row in Next
   * carries the reason "Due in the next seven days." under a heading whose note
   * is "Due in the next seven days." beside a gutter reading "Due in 5 days".
   * Three statements of one fact is not thoroughness, it is an unedited page.
   */
  groupNote: string | null;
  selectedKey: string | null;
  closeHref: string;
}) {
  const open = selectedKey !== null && selectedKey === row.key;
  const time = timeOf(row);
  /*
   * ONE FACT, ONE PLACE — decided by facts, not by string luck. Round 4 caught
   * this row printing "Parked in this project's waiting column" inline and
   * "Parked in the waiting column." immediately beneath it, and the first
   * repair reached for a string comparison that misses exactly that pair (the
   * two sentences share no containment). So the group reason now stands down
   * on structural grounds:
   *
   *   a waiting row with a waiting line   the line is strictly more precise —
   *                                       it names what is in the way, or that
   *                                       the project has no waiting column
   *   a dated row in a dated group        the gutter already IS the reason:
   *                                       "Due in 8 days" under a group whose
   *                                       own note names the boundary
   *   an unparsed date in the gutter      the source's own words are the date
   *                                       fact; "No date on it." beside them
   *                                       is the axis arguing with the row
   *
   * The string test stays only as the last net, compared against what the
   * gutter actually DISPLAYS — the fallback included, so "No date on it."
   * cannot print beside a gutter reading "No date".
   */
  const waiting = row.group === "waiting" ? row.waitingLine : null;
  const shownTime = time ?? NO_TIME;
  const reason =
    (row.group === "waiting" && waiting !== null) ||
    (row.group !== "waiting" && row.due !== null) ||
    row.dueUnparsedLine !== null ||
    sameFact(row.groupReasonLine, groupNote) ||
    sameFact(row.groupReasonLine, shownTime) ||
    sameFact(row.groupReasonLine, waiting)
      ? null
      : row.groupReasonLine;
  return (
    <Entry time={time} overdue={row.due?.overdue ?? false} selected={open}>
      <EntryTitle href={row.href}>{row.title}</EntryTitle>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          <span key="column">{row.columnLabel}</span>,
          row.due ? <Absolute key="abs" when={row.due} /> : null,
          reason ? <span key="why">{reason}</span> : null,
          row.isMilestone ? <span key="ms">Milestone</span> : null,
        ]}
      />
      {waiting ? (
        <p className="mr-warn" data-band="waiting">
          {waiting}
        </p>
      ) : null}
      {row.coAssigneeLine ? <p className="mr-aside">{row.coAssigneeLine}</p> : null}
      <Actions actions={row.actions} />
      {open ? (
        <div className="mr-detail">
          <SourcePath path={row.sourcePath} close={closeHref} />
        </div>
      ) : null}
    </Entry>
  );
}

function Group({
  group,
  selectedKey,
  closeHref,
  showNote = true,
}: {
  group: MyWorkGroupView;
  selectedKey: string | null;
  closeHref: string;
  /** False below the horizon, where the rule itself already carries the note. */
  showNote?: boolean;
}) {
  if (group.rows.length === 0) return null;
  return (
    <Band_
      id={`mr-h-${group.id}`}
      heading={group.heading}
      note={showNote ? group.note : null}
    >
      <Entries>
        {group.rows.map((row) => (
          <WorkEntry
            key={row.key}
            row={row}
            groupNote={group.note}
            selectedKey={selectedKey}
            closeHref={closeHref}
          />
        ))}
      </Entries>
    </Band_>
  );
}

export function MyWorkMode({ props, here }: ModeArgs) {
  const { myWork, chrome, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(myWork.disclosures)[0] ?? null);
  const selectedKey = myWork.selection?.key ?? null;
  const closeHref = props.hrefFor({ item: null });
  const inside = myWork.groups.filter((group) => group.id !== BELOW_THE_LINE);
  const later = myWork.groups.find((group) => group.id === BELOW_THE_LINE) ?? null;
  const shown = inside.reduce((total, group) => total + group.rows.length, 0);
  const rest = accountOf(myWork.disclosures, worst);
  const hasLater = (later?.rows.length ?? 0) > 0;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      /* On a first screen no seven-day window was drawn, so the horizon
         carries no note about what lies past one. */
      horizonLine={firstRun ? null : (later?.note ?? null)}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
        ) : (
          <>
            {myWork.selectionMissingLine ? (
              <Notice state="partial">{myWork.selectionMissingLine}</Notice>
            ) : null}
            {myWork.emptyLine ? <p className="mr-day">{myWork.emptyLine}</p> : null}
            {shown === 0 && !myWork.emptyLine ? (
              <EmptyField>Nothing you are carrying falls inside this read.</EmptyField>
            ) : null}
            {inside.map((group) => (
              <Group
                key={group.id}
                group={group}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        firstRun && rest.length === 0 ? null : (
          <TheRead label={firstRun ? FIRST_RUN_RECORD_LABEL : undefined}>
            <Notices items={rest} />
            {myWork.timeZoneLine ? <p className="mr-account">{myWork.timeZoneLine}</p> : null}
            {myWork.doneExcludedLine ? (
              <p className="mr-account">{myWork.doneExcludedLine}</p>
            ) : null}
            {firstRun ? null : <p className="mr-account">{LAB_LIMIT_NOTE}</p>}
          </TheRead>
        )
      }
      beyond={
        firstRun ? null : (
          <>
            {hasLater ? (
              <p className="mr-beyond-caption">
                Nothing below this line is due inside the read above.
              </p>
            ) : null}
            {later ? (
              <Group
                group={later}
                selectedKey={selectedKey}
                closeHref={closeHref}
                showNote={false}
              />
            ) : null}
            {myWork.moreHref && myWork.moreLabel ? (
              <p className="mr-onward">
                <a className="mr-onward-link" href={myWork.moreHref}>
                  {myWork.moreLabel}
                </a>
              </p>
            ) : null}
          </>
        )
      }
    />
  );
}
