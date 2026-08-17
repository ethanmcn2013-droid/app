/**
 * Signal Desk · My work.
 *
 * The ledger, and the place the spine earns its keep. One unbroken line runs
 * from Waiting to Later; each group head crosses it with a short rule, each row
 * hangs a mark on it, and a row whose project did not answer cuts it. Sixty
 * responsibilities read as one column with four ruled breaks rather than as
 * four lists that happen to be stacked.
 *
 * Detail is in place, not in a panel. A responsibility's extra facts are four
 * short lines; routing them to a second column would be furniture, and the
 * difference between this and the Inbox's split is the point — detail behaviour
 * follows the size of the detail.
 */

import type { HomeCandidateProps, MyWorkRowView } from "@/lib/home-layer/lab-shell";
import { DeskSay, RowDispositions, WorkRow, type RowSeed } from "./dispositions";
import {
  DENSE_FROM,
  FirstRun,
  Foot,
  HOW_A_ROW_ACTS,
  indexCount,
  legendEntries,
  Meta,
  planPage,
  ReadIndex,
  ReadLine,
  readVerdict,
  SectionCaveat,
  whenPart,
  type IndexItem,
  type MarkKind,
} from "./parts";

/**
 * A responsibility has no read state and no disposition, so its seed is the
 * quiet one. What the island tracks here is whether the source has confirmed a
 * completion, which is the only thing on this mode that can change.
 */
const WORK_SEED: RowSeed = {
  read: true,
  disposition: "open",
  snoozeLine: null,
  outcome: "none",
  outcomeLine: null,
};

function markForRow(row: MyWorkRowView): MarkKind {
  if (row.provenance.projectName === null) return "broken";
  if (row.group === "waiting") return "waiting";
  if (row.due?.overdue) return "now";
  if (row.group === "now") return "now";
  if (row.group === "next") return "soon";
  return "plain";
}

export function MyWorkMode(props: HomeCandidateProps) {
  const { myWork, copy, chrome, firstRun } = props;
  const openKey = myWork.selection?.key ?? null;
  const closeHref = props.hrefFor({ mode: "my-work", item: null });
  const verdict = readVerdict(myWork.state, myWork.disclosures, copy);
  const limited = verdict.klass === "partial" || verdict.klass === "refused";

  /**
   * A waiting line that is a fact about the PROJECT rather than about the row
   * is printed once.
   *
   * "This project has no waiting column" is true of every row in that project,
   * and the anchor world prints it on four consecutive rows. Repeating a
   * project-level fact per row reads as four separate problems. It renders on
   * the first row it applies to and is stated in full in the notes at the foot,
   * so nothing is lost and the ledger stays a ledger.
   */
  const saidAlready = new Set<string>();
  const waitingLineFor = (projectId: string | null, line: string | null): string | null => {
    if (!line) return null;
    const key = `${projectId ?? "none"}::${line}`;
    if (saidAlready.has(key)) return null;
    saidAlready.add(key);
    return line;
  };

  /**
   * Four kinds, four different true statements. `no-projects` is not empty,
   * `identity-unresolved` is not empty, and `unavailable` is not empty. Only
   * `emptyLine` may say there is nothing here.
   */
  const kindLine =
    myWork.kind === "no-projects"
      ? "There is no project here yet, so there is nothing for this list to read."
      : myWork.kind === "identity-unresolved"
        ? "Who you are could not be matched against the source, so this list cannot be built."
        : myWork.kind === "unavailable"
          ? "This list could not be read. Nothing here is a count of zero."
          : myWork.rowsShown === 0
            ? myWork.emptyLine
            : null;

  if (firstRun) {
    return (
      <>
        <ReadLine
          verdict={verdict}
          chrome={chrome}
          standing={[]}
          statusLabel={chrome.statusRegionLabel}
          lead={firstRun.line}
        />
        <FirstRun view={firstRun} />
        <Foot copy={copy} disclosures={[]} />
      </>
    );
  }

  const marks = new Set<MarkKind>();
  const everyRow: MyWorkRowView[] = [];
  for (const group of myWork.groups) {
    for (const row of group.rows) {
      marks.add(markForRow(row));
      everyRow.push(row);
    }
  }
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  /* Same rule as the Inbox, and it bites harder here: the scale world puts
     sixty responsibilities in this ledger, and "Your seat cannot finish work in
     this project" is one sentence about a seat, not sixty sentences about sixty
     rows. Planned across the whole ledger, in reading order, before a row is
     drawn. */
  const plans = planPage(everyRow.map((row) => ({ key: row.key, actions: row.actions })));
  const refusesFirst = props.world.id === "action_failure";

  const indexItems: readonly IndexItem[] = [
    ...myWork.groups
      .filter((group) => group.rows.length > 0)
      .map((group) => ({
        id: `dk-group-${group.id}`,
        label: group.heading,
        count: indexCount(group.rows.length),
        lead: group.id === "now",
      })),
    { id: "dk-mywork-reading", label: "About this list", count: null },
  ];

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={[]}
        statusLabel={chrome.statusRegionLabel}
        legendHref={legendHref}
        say={<DeskSay />}
      />

      {kindLine ? <p className="dk-lead">{kindLine}</p> : null}
      {myWork.selectionMissingLine ? (
        <p className="dk-lead">{myWork.selectionMissingLine}</p>
      ) : null}

      <div className="dk-column" data-indexed={indexItems.length > 1 ? "true" : undefined}>
        <ReadIndex label="Groups in this ledger" items={indexItems} />

        {myWork.groups.map((group) => {
          if (group.rows.length === 0) return null;
          const id = `dk-group-${group.id}`;
          return (
            <section className="dk-section" id={id} key={group.id} aria-labelledby={`${id}-heading`}>
              <h2 className="dk-h2" id={`${id}-heading`}>
                {group.heading}
              </h2>
              {group.note ? <p className="dk-note">{group.note}</p> : null}
              <ul className="dk-entries">
                {group.rows.map((row) => {
                  const open = openKey !== null && row.key === openKey;
                  const waiting = waitingLineFor(row.provenance.projectId, row.waitingLine);
                  return (
                    /* The row owns its own `<li>` so a confirmed completion can
                       strike its title: no CSS combinator reaches back up from a
                       later sibling to an earlier one. Still one island per row,
                       just starting an element higher. */
                    <WorkRow
                      key={row.key}
                      rowKey={row.key}
                      mark={markForRow(row)}
                      id={open ? "dk-open-item" : undefined}
                    >
                      <h3 className="dk-title dk-title-sm">
                        <a href={open ? closeHref : row.href} aria-current={open ? "true" : undefined}>
                          {row.title}
                        </a>
                      </h3>
                      <Meta
                        parts={[
                          row.provenance.text,
                          whenPart(row.due),
                          row.dueUnparsedLine,
                          row.columnLabel,
                          row.isMilestone ? "A milestone" : null,
                        ]}
                      />
                      {waiting ? <p className="dk-said">{waiting}</p> : null}
                      {row.coAssigneeLine ? (
                        <p className="dk-said dk-said-quiet">{row.coAssigneeLine}</p>
                      ) : null}

                      {open ? (
                        <div className="dk-open">
                          <dl>
                            <dt>Why it is in {group.heading}</dt>
                            <dd>{row.groupReasonLine}</dd>
                            <dt>Where it lives</dt>
                            <dd>{row.provenance.text}</dd>
                            <dt>The route back to the source</dt>
                            <dd className="dk-path">{row.sourcePath}</dd>
                          </dl>
                        </div>
                      ) : null}

                      {/*
                        What this responsibility offers, on the row, at arrival,
                        as controls. A seat that cannot finish work in a project
                        says so here rather than after an interaction.

                        An opened row uses the SAME page plan as a shut one, and
                        that is deliberate. Unlike the Inbox, opening a
                        responsibility here expands it in place rather than
                        moving it into a panel, so it is still a row in the same
                        ledger and the page's reason ledger still owns its
                        explanations. Giving it a private plan would have printed
                        a reason under a second id while other rows went on
                        pointing at the first, which is how an `aria-describedby`
                        ends up aimed at nothing.
                      */}
                      <RowDispositions
                        rowKey={row.key}
                        title={row.title}
                        seed={WORK_SEED}
                        plans={plans.get(row.key) ?? []}
                        snoozeOptions={[]}
                        refusesFirst={refusesFirst}
                        variant={open ? "detail" : "row"}
                        staticMeta={null}
                      />
                    </WorkRow>
                  );
                })}
              </ul>
              <SectionCaveat limited={limited} />
            </section>
          );
        })}

        <section
          className="dk-section"
          id="dk-mywork-reading"
          aria-labelledby="dk-mywork-reading-heading"
        >
          <h2 className="dk-h2" id="dk-mywork-reading-heading">
            About this list
          </h2>
          {myWork.coverageLine ? <p className="dk-note">{myWork.coverageLine}</p> : null}
          {myWork.timeZoneLine ? <p className="dk-note">{myWork.timeZoneLine}</p> : null}
          {myWork.doneExcludedLine ? <p className="dk-note">{myWork.doneExcludedLine}</p> : null}
          {/* A count is only a count when the list was actually read. Where the
              projection did not resolve, the reason above stands on its own and
              no zero is printed under it. */}
          {myWork.kind === "ready" ? (
            <p className="dk-note">
              {myWork.rowsShown === 1
                ? "One item is shown here."
                : `${myWork.rowsShown} items are shown here.`}
            </p>
          ) : null}
          {/* The scaffold builds this "see the rest" href as the current URL,
              so it has nowhere to go. The fact that more exists is what the
              reader is owed, so the fact renders and the dead control does not. */}
          {myWork.moreLabel ? (
            <p className="dk-note">
              More items follow the ones shown here. The lab holds one page of them.
            </p>
          ) : null}
        </section>
      </div>

      <Foot
        copy={copy}
        disclosures={myWork.disclosures}
        marks={marks}
        extra={[
          kindLine,
          myWork.rowsShown > 0 ? HOW_A_ROW_ACTS : null,
          everyRow.length >= DENSE_FROM
            ? `This ledger holds ${everyRow.length} responsibilities, so a reason that closes an action is printed once with the number of rows it covers rather than repeated under every one of them. Every row still carries every action, and a screen reader still reads the reason on all of them.`
            : null,
        ]}
      />
    </>
  );
}
