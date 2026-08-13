/**
 * Context Rail · My work.
 *
 * A ledger, deliberately, and the rhythm is the whole design. Four groups in a
 * fixed order the reader can learn once (Waiting, Now, Next, Later), one row
 * per responsibility, every row the same shape, dates aligned down one edge so
 * the eye can run the column without reading it. No board, no grid, no cards:
 * a card grid turns sixty responsibilities into sixty objects to look at, and
 * this mode exists to be scanned rather than looked at.
 *
 * The right edge carries the date because the date is the only field that is
 * comparable between two rows. Everything else about a row is qualitative and
 * stays in the flow of the row, at reading weight.
 *
 * WHAT IS ON THE SURFACE. Coverage, the time zone the day boundaries were
 * drawn in, and the finished items that were filtered out. All three qualify
 * every count on the page, so none of them sits behind a disclosure: a reader
 * who cannot see that one project did not answer is reading a list that looks
 * complete.
 */

import type { HomeCandidateProps, MyWorkRowView } from "@/lib/home-layer/lab-shell";
import {
  Actions,
  Facts,
  Label,
  Masthead,
  Meta,
  Notice,
  Notices,
  Prov,
  When,
} from "./parts";

const DETAIL_ID = "rl-detail";

function WorkRow({
  row,
  selected,
  closeHref,
}: {
  row: MyWorkRowView;
  selected: boolean;
  closeHref: string;
}) {
  return (
    <li className="rl-work" data-selected={selected ? "yes" : undefined}>
      <div className="rl-work-main">
        <a className="rl-work-link" href={`${row.href}#${DETAIL_ID}`}>
          {row.title}
        </a>
        <Meta
          items={[
            <Prov key="prov" provenance={row.provenance} />,
            row.columnLabel,
            row.isMilestone ? "Milestone" : null,
          ]}
        />
        {row.waitingLine ? <p className="rl-work-note">{row.waitingLine}</p> : null}
        {row.coAssigneeLine ? <p className="rl-work-note">{row.coAssigneeLine}</p> : null}
      </div>
      <div className="rl-work-when">
        {row.due ? <When when={row.due} /> : null}
        {row.dueUnparsedLine ? (
          <span className="rl-work-unparsed">{row.dueUnparsedLine}</span>
        ) : null}
      </div>
      {selected ? (
        <div className="rl-selected" id={DETAIL_ID} tabIndex={-1}>
          <Facts
            rows={[
              ["Why it is here", row.groupReasonLine],
              ["Where this lives", row.sourcePath],
            ]}
          />
          <Actions actions={row.actions} heading="What you can do" />
          <a className="rl-close" href={closeHref}>
            Close this item
          </a>
        </div>
      ) : null}
    </li>
  );
}

export function MyWorkMode(props: HomeCandidateProps) {
  const { myWork, chrome, hrefFor } = props;
  const closeHref = hrefFor({ item: null });
  const filled = myWork.groups.filter((group) => group.rows.length > 0);
  const qualifiers = [myWork.coverageLine, myWork.timeZoneLine, myWork.doneExcludedLine].filter(
    (line): line is string => line !== null,
  );

  return (
    <>
      <Masthead eyebrow={chrome.modeEyebrow} line={myWork.headline} />

      <Notices items={myWork.disclosures} heading="What Home could not read" />
      {myWork.selectionMissingLine ? (
        <Notice tone="scope">{myWork.selectionMissingLine}</Notice>
      ) : null}

      {qualifiers.length > 0 ? (
        <div className="rl-qualifiers">
          <Label>About this list</Label>
          <ul className="rl-qualifier-list">
            {qualifiers.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {filled.map((group) => (
        <section className="rl-block" key={group.id} aria-labelledby={`rl-h-${group.id}`}>
          <h2 className="rl-h2" id={`rl-h-${group.id}`}>
            {group.heading}
            <span className="rl-h2-count">{group.rows.length}</span>
          </h2>
          {group.note ? <p className="rl-group-note">{group.note}</p> : null}
          <ul className="rl-work-list">
            {group.rows.map((row) => (
              <WorkRow
                key={row.key}
                row={row}
                selected={myWork.selection !== null && myWork.selection.key === row.key}
                closeHref={closeHref}
              />
            ))}
          </ul>
        </section>
      ))}

      {filled.length === 0 && myWork.emptyLine ? (
        <p className="rl-empty">{myWork.emptyLine}</p>
      ) : null}

      {myWork.moreHref && myWork.moreLabel ? (
        <p className="rl-more">
          <a className="rl-inline-link" href={myWork.moreHref}>
            {myWork.moreLabel}
          </a>
        </p>
      ) : null}

      <p className="rl-read-line rl-block-foot">{chrome.asOf.line}</p>
    </>
  );
}
