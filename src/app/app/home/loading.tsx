/**
 * /app/home loading boundary. Loading canon (pitch 10): chrome exists,
 * so loading stays in the content region — a tracing of the settled
 * page, no full-screen takeover, no shimmer (Timeline-canonical only),
 * no fake items. Server component, zero JS, no animation — static
 * blocks satisfy reduced motion without a media query.
 *
 * Reserve floor: header + the Today's Signal label + one row-height
 * block. Home settles with one to three rows; reserving one and growing
 * by whole rows is the correct direction to be wrong in.
 *
 * Hand-off (wave 7): ArrivalSettle rides beside the tracing and gives the
 * page that replaces it one whole-surface opacity settle rather than a cut.
 * See src/components/system/arrival-settle.tsx.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";

export default function HomeLoading() {
  const bar = (width: string, height = 12) => (
    <span
      aria-hidden
      style={{
        display: "block",
        width,
        height,
        borderRadius: 4,
        background: "var(--bg-sunken, rgba(20,21,26,0.06))",
      }}
    />
  );

  return (
    <>
      <ArrivalSettle />
      <div className="thin-scroll flex-1 overflow-auto bg-bg px-5 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-[760px]" role="status" aria-label="Opening Home">
          <div className="mb-9 space-y-3">
            {bar("14ch", 10)}
            {bar("11ch", 22)}
            {bar("18ch", 11)}
          </div>
          <div className="space-y-3">
            {bar("13ch", 10)}
            <div className="space-y-2 border-t border-line-soft pt-4">
              {bar("60%", 14)}
              {bar("82%", 12)}
              {bar("30%", 10)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
