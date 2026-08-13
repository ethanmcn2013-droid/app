/**
 * My work — a responsibility ledger, not a board and not a grid.
 *
 * Four groups in the projection's own order, each a run of rows with one
 * rhythm: what it is on the left at reading weight, when it is due on the right
 * in tabular figures, and the reason it sits in this group underneath in small
 * type. Nothing is boxed. The rules between rows do the work a card would.
 *
 * Detail is an in-place disclosure carried by the URL: opening a row expands it
 * where it sits, keeps its position in the ledger, and shows the source route
 * it would return you to. That is a different detail behaviour from Inbox on
 * purpose — a queue you work through wants a panel, a ledger you scan does not.
 */

import type {
  HomeCandidateProps,
  MyWorkGroupView,
  MyWorkRowView,
} from "@/lib/home-layer/lab-shell";
import { TaskActions, TaskRowState } from "./interaction";
import { Disclosures, Provenance } from "./shell";

function OpenedWork({
  row,
  refusesFirst,
}: Readonly<{ row: MyWorkRowView; refusesFirst: boolean }>) {
  return (
    <div className="ed-open">
      <h4>{row.groupReasonLine}</h4>
      <p>
        In the product this opens <span className="ed-num">{row.sourcePath}</span>, which carries
        the project with it. The lab does not leave the lab, so the path is shown rather than
        followed.
      </p>
      <TaskActions
        taskKey={row.key}
        title={row.title}
        actions={row.actions}
        sourceRefusesFirst={refusesFirst}
      />
    </div>
  );
}

function WorkRow({
  row,
  selected,
  refusesFirst,
}: Readonly<{ row: MyWorkRowView; selected: boolean; refusesFirst: boolean }>) {
  return (
    <li>
      <div className="ed-work-row">
        <TaskRowState taskKey={row.key}>
          <h3 className="ed-work-title">
            <a href={row.href}>{row.title}</a>
          </h3>
          <ul className="ed-meta">
            <li>
              <Provenance provenance={row.provenance} />
            </li>
            <li>{row.columnLabel}</li>
            {row.isMilestone ? <li>Milestone</li> : null}
            {row.coAssigneeLine === null ? null : <li>{row.coAssigneeLine}</li>}
          </ul>
          {row.waitingLine === null ? null : <p className="ed-why">{row.waitingLine}</p>}
          {row.dueUnparsedLine === null ? null : (
            <p className="ed-why">The date on this reads {row.dueUnparsedLine}.</p>
          )}
        </TaskRowState>

        {row.due === null ? (
          <p className="ed-work-when">
            <b>No date</b>
          </p>
        ) : (
          <p className="ed-work-when" data-overdue={row.due.overdue ? "true" : undefined}>
            <b>{row.due.relative}</b>
            {row.due.absolute}
          </p>
        )}
      </div>

      {selected ? <OpenedWork row={row} refusesFirst={refusesFirst} /> : null}
    </li>
  );
}

function Group({
  group,
  selectedKey,
  refusesFirst,
}: Readonly<{
  group: MyWorkGroupView;
  selectedKey: string | null;
  refusesFirst: boolean;
}>) {
  if (group.rows.length === 0) return null;
  return (
    <section className="ed-section" aria-labelledby={`ed-work-${group.id}`}>
      <div className="ed-section-head">
        <h2 id={`ed-work-${group.id}`}>{group.heading}</h2>
        {group.note === null ? null : <span className="ed-label">{group.note}</span>}
      </div>
      <ul className="ed-list ed-works">
        {group.rows.map((row) => (
          <WorkRow
            key={row.key}
            row={row}
            selected={selectedKey === row.key}
            refusesFirst={refusesFirst}
          />
        ))}
      </ul>
    </section>
  );
}

export function MyWorkMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { myWork, chrome, copy, world } = props;
  const refusesFirst = world.id === "action_failure";
  const selectedKey = myWork.selection?.key ?? null;

  return (
    <>
      {myWork.kind === "no-projects" ? (
        <p className="ed-lede">{chrome.activeProject.line}</p>
      ) : null}
      {myWork.kind === "identity-unresolved" ? (
        <p className="ed-lede">
          Home could not work out which of these people you are, so it is not showing a list of
          work rather than showing you an empty one.
        </p>
      ) : null}
      {myWork.kind === "unavailable" ? (
        <p className="ed-lede">
          Your work could not be read. Nothing here counts that as nothing to do.
        </p>
      ) : null}

      {myWork.coverageLine === null ? null : (
        <p className="ed-standing">{myWork.coverageLine}</p>
      )}

      {myWork.selectionMissingLine === null ? null : (
        <p className="ed-refused">{myWork.selectionMissingLine}</p>
      )}

      <Disclosures entries={myWork.disclosures} copy={copy} />

      {myWork.kind === "ready" && myWork.rowsShown === 0 && myWork.emptyLine !== null ? (
        <p className="ed-lede">{myWork.emptyLine}</p>
      ) : null}

      {myWork.groups.map((group) => (
        <Group
          key={group.id}
          group={group}
          selectedKey={selectedKey}
          refusesFirst={refusesFirst}
        />
      ))}

      {myWork.moreHref === null || myWork.moreLabel === null ? null : (
        <p>
          <a className="ed-more" href={myWork.moreHref}>
            {myWork.moreLabel}
          </a>
        </p>
      )}
    </>
  );
}
