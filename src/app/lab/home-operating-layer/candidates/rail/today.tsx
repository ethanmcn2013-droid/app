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
 *   Below the horizon   Moving well · what nothing produces yet · the whole
 *                       day in order
 *
 * Moving well is below the line because nothing in it is asking for the reader
 * inside this read. That is the honest reading of the section and it is also
 * what keeps Today short: the three ranked decisions are the first thing under
 * the meridian at every width, and the material that needs nothing is past the
 * fold by construction rather than by a cap.
 *
 * THE THREE DECISIONS CARRY THEIR RANK. "At most three ranked decisions" is the
 * product's central claim and round 4 found this the only direction where the
 * three could be read as the first three of a longer list rather than as an
 * editor's top three. The rank is printed on the body rather than in the gutter,
 * because the gutter is the clock and a rank is not a time.
 *
 * THE QUIET DAY. `quiet.line` is printed on every Today, in every world, at
 * reading size. It is the sentence that refuses the all clear and names what
 * stopped it, and it is the difference between a short page and an abandoned
 * one. On the one world in thirteen where the read genuinely was quiet, it says
 * so plainly, still refuses the all clear, and the page then ends — the two
 * rules close up around one sentence instead of holding open a screen and a half
 * of reserved canvas.
 */

import type { TodaySection, TodayRow } from "@/lib/home-layer/lab-shell";
import {
  Absolute,
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
  sameFact,
  SourcePath,
  takenFrom,
  TheRead,
  Unsupported,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** The one section that is not asking for the reader inside this read. */
const BELOW_THE_LINE = "movingWell";

/** The one section that is ranked rather than merely ordered. */
const RANKED = "todaysSignal";

/** Named on the section rather than inferred from the count of rows under it. */
const RANK_NOTE = "At most three, in the order Signal ranked them.";

/** Where an entry sits on the clock, taken from the shell and never composed. */
function timeOf(row: TodayRow): string | null {
  if (row.due) return row.due.relative;
  return row.idleLine;
}

function TodayEntry({
  row,
  rank,
  selectedKey,
  closeHref,
}: {
  row: TodayRow;
  rank: string | null;
  selectedKey: string | null;
  closeHref: string;
}) {
  const open = selectedKey !== null && selectedKey === row.key;
  const time = timeOf(row);
  /* "Due in 5 days" in the gutter and "Due in 5 days." in the body is the same
     fact twice with nothing added, which is what round 4 read as an unedited
     page. Where the rule that fired says only what the clock already says, the
     clock keeps it. */
  const reason = sameFact(row.reason, time) ? null : row.reason;
  return (
    <Entry
      time={time}
      overdue={row.due?.overdue ?? false}
      selected={open}
      rank={rank}
    >
      <EntryTitle href={row.href}>{row.title}</EntryTitle>
      {reason ? <p className="mr-why">{reason}</p> : null}
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
        </div>
      ) : null}
    </Entry>
  );
}

function Section({
  section,
  ranked,
  caveat,
  selectedKey,
  closeHref,
}: {
  section: TodaySection;
  /** True only on Today's three decisions. The briefing is uncapped. */
  ranked: boolean;
  /**
   * WHAT THIS LIST WAS DRAWN FROM WHEN SOMETHING REFUSED. Round 4 found the
   * failure screen printing ranked lists with no caveat anywhere near them, so
   * a reader who scrolled past the notice met a short list presented as a whole
   * one. On a refused read every section carries the shell's own coverage
   * sentence directly under its heading.
   */
  caveat: string | null;
  selectedKey: string | null;
  closeHref: string;
}) {
  if (section.rows.length === 0 && section.suppressedLine === null) return null;
  return (
    <Band_
      id={`mr-h-${section.id}`}
      heading={section.heading}
      note={ranked ? RANK_NOTE : section.windowLine}
      caveat={caveat}
    >
      {section.rows.length > 0 ? (
        <Entries>
          {section.rows.map((row, index) => (
            <TodayEntry
              key={row.key}
              row={row}
              rank={ranked ? String(index + 1).padStart(2, "0") : null}
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
  /* On a first screen the honest sentence leads the main column rather than
     sitting in the account nobody reads first. */
  const setup = firstRun
    ? (today.disclosures.find((item) => item.tone === "setup") ?? null)
    : null;
  const rest = accountOf(today.disclosures, worst ?? setup);
  const hasBelow = (beyondSection?.rows.length ?? 0) > 0;
  const caveat = here.refused ? chrome.scope.coverageLine : null;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} lead={setup?.text ?? null} />
        ) : (
          <>
            <p className="mr-day">{today.quiet.line}</p>
            {today.selectionMissingLine ? (
              <Notice state="partial">{today.selectionMissingLine}</Notice>
            ) : null}
            {shown === 0 ? (
              <EmptyField>Nothing is asking for you inside this read.</EmptyField>
            ) : null}
            {inside.map((section) => (
              <Section
                key={section.id}
                section={section}
                ranked={section.id === RANKED}
                caveat={caveat}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        rest.length > 0 ? (
          <TheRead>
            <Notices items={rest} />
          </TheRead>
        ) : null
      }
      beyond={
        firstRun ? null : (
          <>
            {hasBelow ? (
              <p className="mr-beyond-caption">
                Nothing below this line is asking for you inside this read.
              </p>
            ) : null}
            {beyondSection ? (
              <Section
                section={beyondSection}
                ranked={false}
                caveat={caveat}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ) : null}
            <Unsupported items={today.unsupported} />
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
 * Nothing is held back here, so no section carries a cap sentence, no section
 * carries a rank note, and the whole of Moving well comes back above the
 * horizon: at this depth the page is not trying to protect a fold, it is trying
 * to be complete.
 */
export function BriefingMode({ props, here }: ModeArgs) {
  const { briefing, chrome, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(briefing.disclosures)[0] ?? null);
  const closeHref = props.hrefFor({ item: null });
  const window_ =
    briefing.sections.find((section) => section.windowLine !== null)?.windowLine ?? null;
  const shown = briefing.sections.reduce((total, section) => total + section.rows.length, 0);
  const setup = firstRun
    ? (briefing.disclosures.find((item) => item.tone === "setup") ?? null)
    : null;
  const rest = accountOf(briefing.disclosures, worst ?? setup);
  const caveat = here.refused ? chrome.scope.coverageLine : null;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} lead={setup?.text ?? null} />
        ) : (
          <>
            {shown === 0 ? (
              <EmptyField>Nothing is asking for you inside this read.</EmptyField>
            ) : null}
            {briefing.sections.map((section) => (
              <Section
                key={section.id}
                section={section}
                ranked={false}
                caveat={caveat}
                selectedKey={null}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        rest.length > 0 ? (
          <TheRead>
            <Notices items={rest} />
          </TheRead>
        ) : null
      }
      beyond={
        firstRun ? null : (
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
        )
      }
    />
  );
}
