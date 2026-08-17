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
 *
 * ROUND 1 called this the best-composed page in the lab and also found a hard
 * defect in it: at 390 the lateness block collapsed into "4 days lateSunday 12
 * July", one run with no separator. The date field is now one component with
 * its own gaps at every width, and lateness is ink and a struck rule rather
 * than red. The group definitions moved out of right-aligned letterspaced caps
 * and into the margin beside the heading they explain.
 */

import type {
  HomeCandidateProps,
  MyWorkGroupView,
  MyWorkRowView,
} from "@/lib/home-layer/lab-shell";
import { TaskRowState } from "./interaction";
import { Provenance, When } from "./shell";

/**
 * The opened row keeps the group's reason and the return path. Its actions
 * left in round 5 — they sit on the row itself now, in the arrival state, so
 * the disclosure explains and the row operates.
 */
function OpenedWork({ row }: Readonly<{ row: MyWorkRowView }>) {
  return (
    <div className="ed-open">
      <h4>{row.groupReasonLine}</h4>
      <p>
        In the product this opens <span className="ed-num">{row.sourcePath}</span>, which carries
        the project with it. The lab does not leave the lab, so the path is shown rather than
        followed.
      </p>
    </div>
  );
}

function WorkRow({
  row,
  selected,
  refusesFirst,
}: Readonly<{ row: MyWorkRowView; selected: boolean; refusesFirst: boolean }>) {
  return (
    <TaskRowState
      taskKey={row.key}
      title={row.title}
      actions={row.actions}
      sourceRefusesFirst={refusesFirst}
    >
      {/* THE SPINE NAMES LINES — round 4's one-consistent-job for the margin.
          Every other mode already names its lines there (ordinals, thread
          counts, event kinds, field terms); a responsibility's name in the
          source product is `columnLabel`, so above 70rem it hangs in the spine
          beside the row it names. Below 70rem the same fact stays in the meta
          run; the two renderings swap by viewport so it is never dropped and
          never said twice. */}
      <p className="ed-work-col ed-label">{row.columnLabel}</p>

      {/* Round 2: "Put the row title above its lateness at 390." The title is
          first in the source at every width. Round 4: "bind lateness to its
          row" — above 70rem the row line strikes a dotted leader from the
          title to the ledger field at the page edge, so the figure keeps the
          shared right edge the panel protects and the eye rides a printed
          line instead of crossing open white. */}
      <div className="ed-rowline">
        <h3 className="ed-work-title">
          <a href={row.href}>{row.title}</a>
        </h3>
        <span className="ed-leader" aria-hidden="true" />
        {row.due === null ? (
          <p className="ed-work-when ed-when">
            <b>No date</b>
          </p>
        ) : (
          <When when={row.due} className="ed-work-when" />
        )}
      </div>

      <div className="ed-work-body">
        <ul className="ed-meta">
          <li>
            <Provenance provenance={row.provenance} />
          </li>
          <li className="ed-work-col-inline">{row.columnLabel}</li>
          {row.isMilestone ? <li>Milestone</li> : null}
          {row.coAssigneeLine === null ? null : <li>{row.coAssigneeLine}</li>}
        </ul>
        {row.waitingLine === null ? null : <p className="ed-why">{row.waitingLine}</p>}
        {row.dueUnparsedLine === null ? null : (
          <p className="ed-why">The date on this reads {row.dueUnparsedLine}.</p>
        )}
      </div>

      {selected ? <OpenedWork row={row} /> : null}
    </TaskRowState>
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
        {group.note === null ? null : <p className="ed-section-note">{group.note}</p>}
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
  const { myWork, world } = props;
  const refusesFirst = world.id === "action_failure";
  const selectedKey = myWork.selection?.key ?? null;

  return (
    <>
      {myWork.selectionMissingLine === null ? null : (
        <p className="ed-refused">{myWork.selectionMissingLine}</p>
      )}

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
        <p className="ed-tail">
          <a className="ed-more" href={myWork.moreHref}>
            {myWork.moreLabel}
          </a>
        </p>
      )}
    </>
  );
}
