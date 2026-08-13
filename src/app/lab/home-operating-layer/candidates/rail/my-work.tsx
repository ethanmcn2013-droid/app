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
 * THE DATE COLUMN, AND HOW FAR IT MAY TRAVEL. The right edge carries the date
 * because the date is the only field that is comparable between two rows, and
 * the aligned column is what makes sixty rows scannable. But at a 46rem block
 * the lateness sat about 700px from the title it belonged to, which is too far
 * to pair by eye and too far to hold in one viewport at 400% zoom. The block
 * is now 40rem, so the pairing is roughly 560px at most and the alignment
 * survives. Below 640px the two stack, in the row's own order.
 *
 * LATENESS IS NOT RED TEXT any more. "4 days late" was set in #ef4444, which
 * is 3.76:1 on white and fails AA for running text. The words are at full ink
 * and a short red rule stands in front of them, so the mark carries the hue.
 *
 * WHAT IS ON THE SURFACE. Coverage, the time zone the day boundaries were
 * drawn in, and the finished items that were filtered out. All three qualify
 * every count on the page, so none of them sits behind a disclosure: a reader
 * who cannot see that one project did not answer is reading a list that looks
 * complete. They used to sit in a third block under their own label, below two
 * ruled notices, so about 190px of notice furniture came before any content.
 * They are now the plain lines of the same list: limits carry a rule, facts
 * carry none, and the whole preamble is one block.
 */

import type { HomeCandidateProps, MyWorkRowView } from "@/lib/home-layer/lab-shell";
import {
  Actions,
  Fields,
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
        <h3 className="rl-work-title">
          <a className="rl-work-link" href={`${row.href}#${DETAIL_ID}`}>
            {row.title}
          </a>
        </h3>
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
          <Fields
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

      <Notices
        items={myWork.disclosures}
        heading="What Home could not read"
        plain={qualifiers}
      />
      {myWork.selectionMissingLine ? (
        <Notice state="unavailable">{myWork.selectionMissingLine}</Notice>
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
