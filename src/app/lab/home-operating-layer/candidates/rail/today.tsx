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
 * THE QUIET DAY. `quiet.line` is the day's verdict, at reading size, and it
 * opens the read on every Today where no notice stands — it refuses the all
 * clear and names what stopped it. When the read itself broke, the notice
 * under the meridian is the verdict and the quiet line stands down, because
 * its first reason is the same refusal the notice just stated and the page
 * does not say one fact twice on its two loudest lines. On the one world in
 * thirteen where the read genuinely was quiet, the line says so plainly,
 * still refuses the all clear, and the page then ends — the two rules close
 * up around that single sentence instead of holding open a screen and a half
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
  FIRST_RUN_RECORD_LABEL,
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
  timeFallback,
  selectedKey,
  closeHref,
}: {
  row: TodayRow;
  rank: string | null;
  /** What an absent time prints. Below the horizon it is nothing at all. */
  timeFallback?: string | null;
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
      fallback={timeFallback}
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
  belowTheLine = false,
  selectedKey,
  closeHref,
}: {
  section: TodaySection;
  /** True only on Today's three decisions. The briefing is uncapped. */
  ranked: boolean;
  /**
   * True where the section sits past the horizon, or is the not-asking section
   * inside the briefing. An entry there with no time gets an empty gutter, not
   * "No date": a finished item's body already says why it is here, and a
   * dateless claim printed beside "Finished in the last day" reads as the axis
   * arguing with the row. Off the clock, the gutter goes quiet.
   */
  belowTheLine?: boolean;
  selectedKey: string | null;
  closeHref: string;
}) {
  if (section.rows.length === 0 && section.suppressedLine === null) return null;
  return (
    <Band_
      id={`mr-h-${section.id}`}
      heading={section.heading}
      note={ranked ? RANK_NOTE : section.windowLine}
    >
      {section.rows.length > 0 ? (
        <Entries>
          {section.rows.map((row, index) => (
            <TodayEntry
              key={row.key}
              row={row}
              rank={ranked ? String(index + 1).padStart(2, "0") : null}
              timeFallback={belowTheLine ? null : undefined}
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
  const rest = accountOf(today.disclosures, worst);
  const hasBelow = (beyondSection?.rows.length ?? 0) > 0;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      /* A first screen claims no window: nothing looked fourteen days ahead,
         because nothing looked. */
      horizonLine={firstRun ? null : window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
        ) : (
          <>
            {/* The day's verdict — printed only while no notice is standing
                above it. When a read breaks, the notice under the meridian is
                the verdict, and a second sentence restating the same refusal
                ("one source did not answer in full") one line beneath it was
                the same fact twice on the page's two loudest lines. */}
            {worst === null ? <p className="mr-day">{today.quiet.line}</p> : null}
            {today.selectionMissingLine ? (
              <Notice state="partial">{today.selectionMissingLine}</Notice>
            ) : null}
            {/* On the one genuinely quiet world the verdict sentence IS the
                day, and the rules close up around it alone. The generic empty
                caption is for every other empty read — a narrowed scope, a
                filtered morning — where no quiet sentence stands. */}
            {shown === 0 && !today.quiet.readIsQuiet ? (
              <EmptyField>Nothing is asking for you inside this read.</EmptyField>
            ) : null}
            {inside.map((section) => (
              <Section
                key={section.id}
                section={section}
                ranked={section.id === RANKED}
                selectedKey={selectedKey}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        rest.length > 0 ? (
          <TheRead label={firstRun ? FIRST_RUN_RECORD_LABEL : undefined}>
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
                belowTheLine
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
  const rest = accountOf(briefing.disclosures, worst);

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={firstRun ? null : window_}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
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
                belowTheLine={section.id === BELOW_THE_LINE}
                selectedKey={null}
                closeHref={closeHref}
              />
            ))}
          </>
        )
      }
      record={
        rest.length > 0 ? (
          <TheRead label={firstRun ? FIRST_RUN_RECORD_LABEL : undefined}>
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
            {/* The instant of the read is on the meridian, where it always is.
                An earlier draft restated it here as a labelled field, which was
                the same sentence at both ends of one page. */}
            <Label>Where you were</Label>
            <p className="mr-onward">
              <a className="mr-onward-link" href={briefing.returnHref}>
                {briefing.returnLabel}
              </a>
            </p>
          </>
        )
      }
    />
  );
}
