/**
 * Context Rail · Inbox.
 *
 * ── The trap this direction was handed, and the answer ─────────────────────
 *
 * A persistent left rail plus a queue plus a detail is three columns, and
 * three columns is where a rail direction usually breaks: at 1024 the detail
 * gets 380 px and every row starts dropping the provenance that D-HX08 makes
 * a hard rule.
 *
 * So the split is not a layout preference, it is a measured threshold. At
 * 1280 px the content area is 1280 − 208 rail − 64 page padding ≈ 1008, which
 * gives a 22 rem queue, a 2 rem gutter and roughly 600 px of detail: enough
 * for a title, its provenance and its outcome without wrapping into porridge.
 * Below 1280 the split is not earned, so THERE IS NO SPLIT. The queue takes
 * the full measure, and opening an event is a route that replaces it with a
 * full-width detail carrying its own way back.
 *
 * That is one composition and two behaviours, not two designs: the same DOM,
 * the same order, the same links. The narrow case is the wide case with the
 * queue stood down, which is why nothing is duplicated and nothing is hidden
 * from assistive technology that a sighted reader can see.
 *
 * ── Threads ────────────────────────────────────────────────────────────────
 *
 * The shell groups by thread and names each group with its first row's title.
 * A row repeats its own title only when it differs from the group's, which it
 * does in the guest world where two asks in one thread point at two different
 * items. That check is why the queue reads as correspondence rather than as
 * the same sentence printed twice.
 */

import type {
  HomeCandidateProps,
  InboxGroup,
  InboxRow,
} from "@/lib/home-layer/lab-shell";
import {
  Actions,
  Facts,
  Label,
  Masthead,
  Meta,
  Notice,
  Notices,
  Prov,
} from "./parts";

/** The detail panel's anchor. Opening an event moves focus and view to it. */
const DETAIL_ID = "rl-detail";

/**
 * The shell builds every lab URL; this only names the place in the page the
 * link lands on, which the shell has no opinion about because it is not part
 * of the lab's view state.
 */
const toDetail = (href: string) => `${href}#${DETAIL_ID}`;

function shownTitle(row: InboxRow): string {
  return row.title ?? row.titleFallback;
}

function EventRow({
  row,
  group,
  current,
  openLabel,
  linked,
}: {
  row: InboxRow;
  group: InboxGroup;
  current: boolean;
  openLabel: string;
  /** True when the thread heading above is already the link to this row. */
  linked: boolean;
}) {
  const title = shownTitle(row);
  return (
    <li className="rl-event" data-current={current ? "yes" : undefined}>
      <p className="rl-event-kind">{row.kindLabel}</p>
      {title === group.heading ? null : (
        <p className="rl-event-title" data-state={row.titleState}>
          {title}
        </p>
      )}
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.occurredLine,
          row.actorName,
        ]}
      />
      <p className="rl-event-state">
        <span className="rl-vis" data-vis={row.visibility}>
          {row.visibilityLabel}
        </span>
        <span className="rl-sep" aria-hidden="true">
          ·
        </span>
        <span className="rl-disp" data-disp={row.disposition}>
          {row.dispositionLabel}
        </span>
      </p>
      {row.snoozeLine ? <p className="rl-event-note">{row.snoozeLine}</p> : null}
      {row.revisionLine ? (
        <p className="rl-event-note" data-tone="freshness">
          {row.revisionLine}
        </p>
      ) : null}
      {row.attempt ? (
        <p className="rl-event-note" data-outcome={row.attempt.outcome}>
          {row.attempt.line}
        </p>
      ) : null}
      {linked ? null : (
        <a className="rl-event-open" href={toDetail(row.href)}>
          {openLabel}
        </a>
      )}
    </li>
  );
}

function Thread({
  group,
  selectedId,
  openLabel,
}: {
  group: InboxGroup;
  selectedId: string | null;
  openLabel: string;
}) {
  /**
   * A thread of one is correspondence about a single item, so its heading is
   * the way in and there is no second control repeating it. A thread of more
   * than one names the item once and each ask carries its own way in, which is
   * what keeps ten threads from rendering twenty identical links.
   */
  const single = group.rows.length === 1 ? group.rows[0] : null;

  /**
   * A thread of five is where a queue turns into a wall. At scale there are
   * ten of them, fifty rows, and reading the tenth thread means scrolling past
   * forty asks that all point at work the reader has already seen named. So a
   * thread longer than two shows its most recent ask and folds the rest behind
   * the sentence the shell already wrote for it. Nothing is dropped, the count
   * is the shell's own, and a folded thread opens itself when the reader has
   * one of its asks open.
   */
  const rest = single ? [] : group.rows.slice(1);
  const folded = rest.length > 1;
  const first = single ?? group.rows[0];

  return (
    <li className="rl-thread" data-multi={single ? undefined : "yes"}>
      <h2 className="rl-thread-title">
        {single ? (
          <a className="rl-thread-link" href={toDetail(single.href)}>
            {group.heading}
          </a>
        ) : (
          group.heading
        )}
      </h2>
      {group.subheading && !folded ? (
        <p className="rl-thread-sub">{group.subheading}</p>
      ) : null}
      <ul className="rl-event-list">
        {(folded ? [first] : group.rows).map((row) =>
          row ? (
            <EventRow
              key={row.eventId}
              row={row}
              group={group}
              current={row.eventId === selectedId}
              openLabel={openLabel}
              linked={single !== null}
            />
          ) : null,
        )}
      </ul>
      {folded ? (
        <details
          className="rl-thread-more"
          open={rest.some((row) => row.eventId === selectedId)}
        >
          <summary className="rl-read-summary">{group.subheading}</summary>
          <ul className="rl-event-list">
            {rest.map((row) => (
              <EventRow
                key={row.eventId}
                row={row}
                group={group}
                current={row.eventId === selectedId}
                openLabel={openLabel}
                linked={false}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function Detail({
  row,
  props,
  backHref,
}: {
  row: InboxRow;
  props: HomeCandidateProps;
  backHref: string;
}) {
  return (
    <>
      <a className="rl-back" href={backHref}>
        Back to the list
      </a>
      <p className="rl-detail-kind">{row.kindLabel}</p>
      <p className="rl-detail-title" data-state={row.titleState}>
        {shownTitle(row)}
      </p>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.occurredLine,
          row.actorName,
        ]}
      />
      {row.revisionLine ? (
        <Notice tone="freshness">{row.revisionLine}</Notice>
      ) : null}
      {row.snoozeLine ? <Notice tone="freshness">{row.snoozeLine}</Notice> : null}
      {row.attempt ? (
        <div className="rl-attempt" data-outcome={row.attempt.outcome}>
          <Label>What the source said</Label>
          <p className="rl-attempt-line">{row.attempt.line}</p>
          {row.attempt.recoveryLabel ? (
            <p className="rl-attempt-recovery">{row.attempt.recoveryLabel}</p>
          ) : null}
        </div>
      ) : null}
      <Facts
        rows={[
          ["Read state", row.visibilityLabel],
          ["Where it stands", row.dispositionLabel],
          ["Where this lives", row.sourcePath],
        ]}
      />
      {/* `Open` is how the reader got here, so it is not offered again. */}
      <Actions
        actions={row.actions.filter((action) => action.id !== "open")}
        snooze={props.inbox.snoozeOptions}
        heading="What you can do"
      />
    </>
  );
}

/**
 * With nothing selected, the second column carries the read rather than an
 * empty frame. Coverage, scope and the snooze windows this Inbox uses are
 * facts the reader is owed, and putting them here means the column is never
 * furniture waiting to be filled.
 */
function QueueLedger({ props }: { props: HomeCandidateProps }) {
  const { inbox, chrome, copy } = props;
  const facts: (readonly [string, string])[] = [];
  if (inbox.badge.rendered) {
    facts.push(["Open now", inbox.badge.glyph ?? copy.unreadableCount]);
  }
  facts.push(["What Home is reading", chrome.scope.label]);
  facts.push(["State of this read", copy.states[inbox.state]]);

  return (
    <>
      <Label>This read</Label>
      <Facts rows={facts} />
      {inbox.snoozeOptions.length > 0 ? (
        <div className="rl-ledger-block">
          <Label>When a snooze comes back</Label>
          <ul className="rl-snooze-list">
            {inbox.snoozeOptions.map((option) => (
              <li className="rl-snooze" key={option.id}>
                <span className="rl-snooze-label">{option.label}</span>
                <span className="rl-snooze-when">{option.resurfaceLine}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="rl-read-line">{chrome.asOf.line}</p>
    </>
  );
}

export function InboxMode(props: HomeCandidateProps) {
  const { inbox, chrome, hrefFor } = props;
  const selection = inbox.selection;
  const backHref = hrefFor({ event: null });

  return (
    <>
      <Masthead eyebrow={chrome.modeEyebrow} line={inbox.headline} />

      <Notices items={inbox.disclosures} heading="What Home could not read" />
      {inbox.selectionMissingLine ? (
        <Notice tone="scope">{inbox.selectionMissingLine}</Notice>
      ) : null}

      <div className="rl-inbox" data-selected={selection ? "yes" : undefined}>
        <section className="rl-queue" aria-label="Everything that arrived">
          {inbox.groups.length > 0 ? (
            <ol className="rl-thread-list">
              {inbox.groups.map((group) => (
                <Thread
                  key={group.key}
                  group={group}
                  selectedId={selection?.eventId ?? null}
                  openLabel={props.copy.actions.openEvent}
                />
              ))}
            </ol>
          ) : inbox.emptyLine ? (
            <p className="rl-empty">{inbox.emptyLine}</p>
          ) : null}
        </section>

        <section
          className="rl-detail"
          id={DETAIL_ID}
          tabIndex={-1}
          aria-label={selection ? "The item you opened" : "About this read"}
        >
          <div className="rl-detail-inner">
            {selection ? (
              <Detail row={selection} props={props} backHref={backHref} />
            ) : (
              <QueueLedger props={props} />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
