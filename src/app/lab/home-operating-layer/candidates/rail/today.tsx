/**
 * Meridian · Today, and the full briefing.
 *
 * TIME IS ALREADY THE SECTION ORDER, which is the discovery that made this
 * direction possible. `todaysSignal`, `needsReview`, `comingUp`, `movingWell`
 * is a ranking order in the contract and it is also, exactly, an order by when
 * each thing wants you: now, still waiting on you, inside the fortnight, not
 * asking at all. So nothing here re-sorts anything. The composition adopts the
 * shell's order and draws the two instants that bound it.
 *
 * WHAT SITS WHERE.
 *
 *   Between the rules   Today's signal · Needs review · Coming up
 *   Below the horizon   Moving well · how the read was accounted for · the
 *                       whole day in order
 *
 * Moving well is below the line because nothing in it is asking for the reader
 * inside this read. That is the honest reading of the section and it is also
 * what keeps Today short: the three ranked decisions are the first thing under
 * the meridian at every width, and the material that needs nothing is past the
 * fold by construction rather than by a cap.
 *
 * THE QUIET DAY. `quiet.line` is printed on every Today, in every world, at
 * reading size. It is the sentence that refuses the all clear and names what
 * stopped it, and it is the difference between a short page and an abandoned
 * one. On the one world in thirteen where the read genuinely was quiet, it says
 * so plainly and still refuses the all clear, because two platform limits are
 * still true.
 */

import type { TodaySection, TodayRow } from "@/lib/home-layer/lab-shell";
import {
  Absolute,
  Actions,
  Band_,
  Chronology,
  EmptyField,
  Entries,
  Entry,
  EntryTitle,
  Fields,
  FirstRun,
  HORIZON_MARK,
  Label,
  Meta,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  ScopeAccount,
  SourcePath,
  takenFrom,
  TheRead,
  Unsupported,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** The one section that is not asking for the reader inside this read. */
const BELOW_THE_LINE = "movingWell";

/** Where an entry sits on the clock, taken from the shell and never composed. */
function timeOf(row: TodayRow): string | null {
  if (row.due) return row.due.relative;
  return row.idleLine;
}

function TodayEntry({
  row,
  selectedKey,
  closeHref,
}: {
  row: TodayRow;
  selectedKey: string | null;
  closeHref: string;
}) {
  const open = selectedKey !== null && selectedKey === row.key;
  return (
    <Entry time={timeOf(row)} overdue={row.due?.overdue ?? false} selected={open}>
      <EntryTitle href={row.href}>{row.title}</EntryTitle>
      <p className="mr-why">{row.reason}</p>
      <Meta
        items={[
          <Prov key="prov" provenance={row.provenance} />,
          row.due ? <Absolute key="abs" when={row.due} /> : null,
          row.due && row.idleLine ? <span key="idle">{row.idleLine}</span> : null,
          row.isReading ? <span key="members">{takenFrom(row.memberCount)}</span> : null,
        ]}
      />
      {open ? (
        <div className="mr-detail">
          <SourcePath path={row.sourcePath} close={closeHref} />
          <Actions actions={row.actions} />
        </div>
      ) : null}
    </Entry>
  );
}

function Section({
  section,
  selectedKey,
  closeHref,
}: {
  section: TodaySection;
  selectedKey: string | null;
  closeHref: string;
}) {
  if (section.rows.length === 0 && section.suppressedLine === null) return null;
  return (
    <Band_
      id={`mr-h-${section.id}`}
      heading={section.heading}
      note={section.windowLine}
    >
      {section.rows.length > 0 ? (
        <Entries>
          {section.rows.map((row) => (
            <TodayEntry
              key={row.key}
              row={row}
              selectedKey={selectedKey}
              closeHref={closeHref}
            />
          ))}
        </Entries>
      ) : null}
      {section.suppressedLine ? (
        <p className="mr-suppressed">
          {section.suppressedLine}
          {section.moreHref && section.moreLabel ? (
            <a className="mr-inline-link" href={section.moreHref}>
              {section.moreLabel}
            </a>
          ) : null}
        </p>
      ) : null}
    </Band_>
  );
}

export function TodayMode({ props, here }: ModeArgs) {
  const { today, chrome, firstRun } = props;
  /* The one sentence that becomes the page's headline when the read did not
     finish. A first screen never takes one: nothing went wrong on it. */
  const worst = firstRun ? null : (bySeverity(today.disclosures)[0] ?? null);
  const selectedKey = today.selection?.key ?? null;
  const closeHref = props.hrefFor({ item: null });
  const inside = today.sections.filter((section) => section.id !== BELOW_THE_LINE);
  const beyondSection = today.sections.find((section) => section.id === BELOW_THE_LINE);
  const window_ =
    today.sections.find((section) => section.windowLine !== null)?.windowLine ?? null;
  const shown = inside.reduce((total, section) => total + section.rows.length, 0);

  return (
    <Chronology
      when={chrome.asOf.line}
      /* The material of the page. A refusal rules the ground under the whole
         read; a partial read leaves it open and takes the sentence only. */
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
        ) : (
          <>
            <p className="mr-day">{today.quiet.line}</p>
            {today.selectionMissingLine ? (
              <Notice state="partial">{today.selectionMissingLine}</Notice>
            ) : null}
            {shown === 0 ? (
              <EmptyField>
                Nothing stands between now and the edge of this read.
              </EmptyField>
            ) : null}
            {inside.map((section) => (
              <Section
                key={section.id}
                section={section}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        <TheRead>
          <Notices items={accountOf(today.disclosures, worst)} />
          <p className="mr-account">
            {today.accountingLine ?? today.accountingWithheldLine}
          </p>
          <ScopeAccount
            scopeLabel={chrome.scope.label}
            coverageLine={chrome.scope.coverageLine}
          />
          <Unsupported items={today.unsupported} />
          <p className="mr-active">{chrome.activeProject.line}</p>
        </TheRead>
      }
      beyond={
        firstRun ? (
          /* A reader with no Project has nothing past the line either, and a
             link to a briefing with nothing in it is a dead end dressed as a
             move. The one real move is in the first screen above. */
          <p className="mr-beyond-caption">
            Nothing has been set up yet, so there is nothing past this line.
          </p>
        ) : (
          <>
            <p className="mr-beyond-caption">
              Nothing below this line is asking for you inside this read.
            </p>
            {beyondSection ? (
              <Section
                section={beyondSection}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ) : null}
            <p className="mr-onward">
              <a className="mr-onward-link" href={today.briefingHref}>
                {today.briefingLabel}
              </a>
            </p>
          </>
        )
      }
    />
  );
}

/**
 * The full briefing. The same ranking at its full depth, so the two rules mean
 * the same thing and the reader is standing in the same day, uncapped.
 *
 * Nothing is held back here, so no section carries a cap sentence and the whole
 * of Moving well comes back above the horizon: at this depth the page is not
 * trying to protect a fold, it is trying to be complete.
 */
export function BriefingMode({ props, here }: ModeArgs) {
  const { briefing, chrome, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(briefing.disclosures)[0] ?? null);
  const closeHref = props.hrefFor({ item: null });
  const window_ =
    briefing.sections.find((section) => section.windowLine !== null)?.windowLine ?? null;
  const shown = briefing.sections.reduce((total, section) => total + section.rows.length, 0);

  return (
    <Chronology
      when={chrome.asOf.line}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
        ) : (
          <>
            {shown === 0 ? (
              <EmptyField>
                Nothing stands between now and the edge of this read.
              </EmptyField>
            ) : null}
            {briefing.sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                selectedKey={null}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        <TheRead>
          <Notices items={accountOf(briefing.disclosures, worst)} />
          <p className="mr-account">
            {briefing.accountingLine ?? briefing.accountingWithheldLine}
          </p>
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
            This is the whole read. Nothing was held back from it.
          </p>
          <Label>Where you were</Label>
          <p className="mr-onward">
            <a className="mr-onward-link" href={briefing.returnHref}>
              {briefing.returnLabel}
            </a>
          </p>
          <Fields rows={[["Read at", chrome.asOf.line]]} />
        </>
      }
    />
  );
}
