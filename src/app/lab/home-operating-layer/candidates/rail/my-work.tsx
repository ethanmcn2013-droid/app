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
  FirstRun,
  HORIZON_MARK,
  Meta,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  ScopeAccount,
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
  const reason = row.groupReasonLine === groupNote ? null : row.groupReasonLine;
  return (
    <Entry time={timeOf(row)} overdue={row.due?.overdue ?? false} selected={open}>
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
      {/* Only where it explains the grouping. Outside Waiting the only line
          this field carries is a project-level fact about a missing waiting
          column, which the read already discloses once rather than on every
          row it touches. */}
      {row.group === "waiting" && row.waitingLine ? (
        <p className="mr-warn" data-band="waiting">
          {row.waitingLine}
        </p>
      ) : null}
      {row.coAssigneeLine ? <p className="mr-aside">{row.coAssigneeLine}</p> : null}
      {open ? (
        <div className="mr-detail">
          <SourcePath path={row.sourcePath} close={closeHref} />
          <Actions actions={row.actions} />
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

  return (
    <Chronology
      when={chrome.asOf.line}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={later?.note ?? null}
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
              <EmptyField>
                Nothing you are carrying falls between now and the edge of this read.
              </EmptyField>
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
        <TheRead>
          <Notices items={accountOf(myWork.disclosures, worst)} />
          {myWork.coverageLine ? <p className="mr-account">{myWork.coverageLine}</p> : null}
          {myWork.timeZoneLine ? <p className="mr-account">{myWork.timeZoneLine}</p> : null}
          {myWork.doneExcludedLine ? (
            <p className="mr-account">{myWork.doneExcludedLine}</p>
          ) : null}
          <ScopeAccount
            scopeLabel={chrome.scope.label}
            coverageLine={chrome.scope.coverageLine}
          />
          <p className="mr-active">{chrome.activeProject.line}</p>
        </TheRead>
      }
      beyond={
        <>
          <p className="mr-beyond-caption">
            Nothing below this line is due inside the read above.
          </p>
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
      }
    />
  );
}
