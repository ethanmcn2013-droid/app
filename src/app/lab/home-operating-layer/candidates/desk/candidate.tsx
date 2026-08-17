/**
 * SIGNAL DESK — variant 4.
 *
 * THE THESIS. Home is not a page you read, it is a surface you sit at. So there
 * is a desk and there is a sheet on it: the canvas is warm and full-bleed, the
 * read sits on a sheet of the estate's own white paper laid on top of it, and
 * the work is ruled onto that sheet by a single vertical line — the spine —
 * that stays in exactly the same place in all five modes. Moving from Today to
 * Inbox to My work to Analytics changes the marks hanging on the line; it does
 * not change the furniture around them. That is the whole of the spatial
 * continuity, and it costs one pixel of width.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROUND 5 · THE WARM GROUND. THE CALL IS TO DROP IT, AND HERE IS THE ARGUMENT.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The brief put it as a choice with no third option: a warmed canvas is a
 * genuine register deviation, the design tokens are vendored and `ds:check`
 * forbids local overrides, so the warmth has to be ratified as an explicit
 * register amendment or dropped. It also carried the seam note: Home on warm
 * ground and the three products on white is a visible join in a suite meant to
 * read as one system.
 *
 * WHAT THE WARMTH ACTUALLY WAS, because the argument turns on the number. Round
 * 2 warmed the whole canvas including the text. Round 3 pulled it off the text
 * and into the surround, leaving `color-mix(in srgb, var(--paper) 93%, #b98a3c)`
 * behind the sheet. That resolves to #faf7f1. Against the estate's own recessed
 * surface, `--paper-deep` at #f4f4f5, it is a difference of about four points of
 * red and nine of blue: a tint most readers could not name if you showed them
 * both and asked. It was warm in the way a room is warm, not in the way a colour
 * is warm.
 *
 * SO WHAT WAS BEING BOUGHT, AND AT WHAT PRICE. What it bought was one director's
 * "real pro-attention move at 7am", and I think that was true. What it cost was
 * three things stacked on top of each other: a register amendment that a whole
 * programme would have to carry for one lab variant, a hue that `ds:check` has
 * an opinion about and that no other product shares, and a visible join every
 * time a founder leaves Home for Tasks. Three standing costs for a tint that
 * cannot be identified without a colour picker is a bad trade, and it stays a
 * bad trade however much I liked it.
 *
 * SO IT IS DROPPED, AND THE THESIS IS NOT. The thesis was never the hue. It was
 * the two planes: a desk that is not the paper, so "where I am in the app" and
 * "what this page says" are materially different surfaces before a word is read.
 * A director scored that 9 and named it: "the only direction that separates the
 * two levels by ground rather than by a rule." That device does not need an
 * invented colour. It needs a step, and the estate already ships a ratified,
 * theme-aware one. The desk is `--paper-deep` now.
 *
 * THE THREE THINGS THAT CHANGE, and none of them is a retreat:
 *   1. Nothing to ratify. The direction declares no literal colour at all, so
 *      there is no register amendment, no `ds:check` exposure, and no local
 *      override anywhere in it.
 *   2. The seam closes. The ground under Home is the same recessed surface
 *      Notes, Tasks and Timeline already use for their own recessed planes.
 *   3. The two planes get FURTHER apart. #f4f4f5 against #ffffff is a wider step
 *      than #faf7f1 was, so the thing being protected is stronger after the
 *      change than before it.
 *
 * WHAT IS LOST, said rather than buried: the 7am warmth. I am not pretending it
 * was nothing. If the register is ever amended to admit a warm neutral across
 * the whole estate, this direction should be the first thing to use it, and the
 * two-plane structure is already built to take it: one token, one line.
 *
 * The one sentence to hold on to: a register amendment is a thing a whole
 * company carries. A tint nobody can name is not worth one.
 *
 * THE SIGNATURE, AND WHY IT IS EARNED. A line that breaks where the read broke.
 * It is drawn twice on every page and it is the only device here that carries
 * meaning without a word or a colour:
 *
 *   ACROSS, under the headline, as the readline. An unbroken rule is a read
 *   that finished. A rule with a hole cut in it is a read that answered for
 *   part of what was asked. A rule that runs a third of the way and stops is a
 *   source that refused. Three silhouettes, told apart from across a room,
 *   before a word is read, and still told apart with every colour removed.
 *
 *   DOWN, beside the entries, as the spine. An entry whose project did not
 *   resolve paints a gap over the line and puts a dashed diamond in the gap.
 *
 * That is the governing rule of this whole programme — unknown stays unknown, a
 * quiet day and a broken provider must look different — drawn instead of
 * written. The line also draws itself once on arrival: one element, one scaleY,
 * 340ms, nothing else on the page moves.
 *
 * WHAT ROUND 1 GOT WRONG, and what changed. The state used to be a tinted band
 * that appeared in every world, including the healthy one, so its presence
 * signalled nothing and partial coverage and total provider failure arrived as
 * the same picture. The band is gone. A complete read now carries no strip at
 * all, only an unbroken rule; a limited read carries the shell's own sentence
 * for what happened, at the top, where the reader is standing. Limits that are
 * true every single day are no longer raised as if they were news; they are
 * named in the metadata line and printed in full at the foot.
 *
 * WHAT THE WIDTH IS FOR, which LAB_BRIEF Amendment 1 now requires an answer to.
 * The full width is the desk. The measure is the sheet. The left desk carries
 * the read's own index, with a count against every section, so the shape of the
 * read — three ranked decisions, then two, then four, then four — is legible
 * before a single row is scrolled. The index is absent when a read has fewer
 * than two sections, so a quiet day and a first morning keep a bare desk, and
 * the emptiness is the material rather than an unmade decision.
 *
 * WHAT IT COSTS. The spine wants a left gutter on every entry, which is 36px of
 * width this direction never gets back — at 320px it drops to 28px and the
 * measure is tight.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT SPENDS AT RUNTIME, MEASURED. Round 4: "Desk's apparent zero client
 * cost is a false measurement, and it is the direction with the largest hidden
 * bill... Until that number exists, Desk's budget claim is unevidenced." Fair,
 * and the bill is now itemised rather than denied.
 *
 * ONE client module, `dispositions.tsx`, which carries every row disposition on
 * Inbox and My work. Bundled with esbuild at the app's own browser targets,
 * minified, `react` external because the shared runtime already carries it:
 *
 *   minified          5,056 bytes   4.94 KB
 *   minified + gzip   1,952 bytes   1.91 KB
 *
 * against the three ceilings the programme actually has:
 *
 *   shared_runtime  246.1 / 247 KB   + 0 bytes. A route-local island never
 *                                     enters the shared chunk, so the 0.9 KB of
 *                                     programme headroom is untouched.
 *   largest_chunk    62.5 / 63 KB    + 0 bytes, same reason.
 *   total_client_js 898.8 / 940 KB   + 1.91 KB, which is 4.6% of the 41.2 KB of
 *                                     remaining slack.
 *
 * And the stylesheet, which round 4 measured as a source file rather than as
 * shipped bytes. Run through Lightning CSS, the minifier Next 16 uses, at the
 * same targets: 69.6 KB of source becomes 25.9 KB minified and 4.74 KB gzip.
 * Round 4 recorded 16.4 KB gzip and 2.6x the leanest direction; the shipped
 * figure is 4.74 KB and 1.28x, below two of the other three. Comments are the
 * difference, and comments do not ship.
 *
 * Everything else in this folder is a server component: five modes, thirteen
 * worlds, every disclosure, the whole chrome, the index, the legend and the foot
 * render with no JavaScript at all. Depth is still `<details>`, selection is
 * still the URL, motion is still one CSS animation.
 *
 * THE HYDRATION CEILING, because bytes are only half of it. One island per row,
 * never two: `RowDispositions` owns both the strip and the row's live state
 * words, so the fifty-event scale queue instantiates fifty components rather
 * than a hundred. Today, Analytics, the briefing and the whole of the shell
 * instantiate zero.
 *
 * WHAT IS STILL UNPROVEN, and it is not fixable inside a lab: this is a bundle
 * measurement, not a `perf:budgets` run against a production build. It proves
 * the size of what this direction adds. It does not prove the whole programme
 * still fits, and `pnpm build` is the only thing that can.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HomeCandidate, HomeCandidateProps } from "@/lib/home-layer/lab-shell";
import { AnalyticsMode, analyticsRead } from "./analytics";
import { DeskHead, type ModeRead } from "./chrome";
import { InboxMode } from "./inbox";
import { MyWorkMode } from "./my-work";
import { readVerdict } from "./parts";
import { BriefingMode, TodayMode } from "./today";
import "./desk.css";

const Desk: HomeCandidate = (props: HomeCandidateProps) => {
  const { chrome, copy, state } = props;

  /**
   * How every mode's read went, not only this one.
   *
   * Read health used to be visible for the mode you were standing in and nowhere
   * else, so a founder on Today could not tell that Inbox had not been read and
   * took every mode change blind. Today's `unsupported` set is deliberately not
   * folded in: a kind of work with no source at all is a standing fact about the
   * product, not a fact about this morning, and treating the two the same is
   * what made the old band furniture.
   *
   * Analytics goes through its own derivation because every source can answer in
   * full and the page can still be unable to say something. One function serves
   * the tab row and the Analytics readline, so the two can never disagree.
   */
  const modeRead: Record<string, ModeRead> = {
    today: readVerdict(props.today.state, props.today.disclosures, copy),
    inbox: readVerdict(props.inbox.state, props.inbox.disclosures, copy),
    "my-work": readVerdict(props.myWork.state, props.myWork.disclosures, copy),
    analytics: analyticsRead(props.analytics, copy).verdict,
  };

  /* The sheet is ONE measure in every mode. Round 1 widened the whole page for
     Analytics, which moved the masthead with it and made the frame look
     unresolved between modes; the widening now belongs to the Project ledger
     alone, which is the one thing on any of these pages that has to account for
     every project rather than say something. */
  return (
    <div className="dk" data-mode={state.mode}>
      <a className="dk-skip" href="#app-main-content">
        {chrome.skipLinkLabel}
      </a>

      <DeskHead
        chrome={chrome}
        copy={copy}
        homeHref={props.hrefFor({ mode: "today", item: null, event: null })}
        badgeName={props.inbox.badge.accessibleName}
        badgeCoverage={props.inbox.badge.coverage}
        modeRead={modeRead}
        depth={
          state.mode === "briefing"
            ? {
                parentHref: props.briefing.returnHref,
                selfHref: props.hrefFor({}),
                label: copy.modeNames.briefing,
              }
            : null
        }
      />

      <main className="dk-main" id="app-main-content" tabIndex={-1}>
        <div className="dk-page dk-frame">
          {/* Pattern (b) of D-HX02: the mode name is a VISIBLE eyebrow inside
              the h1, so the accessible text starts with the mode and the
              expressive line still leads the page for everybody else. */}
          <h1 className="dk-h1">
            <span className="dk-eyebrow">{chrome.modeEyebrow}</span>
            <span className="dk-h1-line">{chrome.h1Line}</span>
          </h1>

          {state.mode === "inbox" ? <InboxMode {...props} /> : null}
          {state.mode === "my-work" ? <MyWorkMode {...props} /> : null}
          {state.mode === "analytics" ? <AnalyticsMode {...props} /> : null}
          {state.mode === "briefing" ? <BriefingMode {...props} /> : null}
          {state.mode === "today" ? <TodayMode {...props} /> : null}
        </div>
      </main>
    </div>
  );
};

export default Desk;
