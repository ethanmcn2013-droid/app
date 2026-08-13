import Link from "next/link";
import { TRUTH_CLASS_LABEL, type LabView } from "@/lib/analytics-lab/model";

/**
 * The route to the observations the top three pushed out of view.
 *
 * WHY THIS IS SHARED RATHER THAN DRAWN FIVE TIMES. §8 vetoes "a top-three
 * brief that conceals the existence of other observations", and disclosing a
 * count without a way to reach them satisfies only half of that. Rendering it
 * once means a composition cannot quietly lose the route while keeping the
 * sentence that promises it — which is exactly what happened in the first cut
 * of this lab, in all five variants at once.
 *
 * The suppressed observations carry the same grammar as the shown ones. Being
 * ranked fourth is not a reason to tell the reader less about them.
 */

type Props = {
  view: LabView;
  /** `wire` matches the wildcard's own palette; everything else uses the system. */
  tone?: "signal" | "wire";
};

export function SuppressedObservations({ view, tone = "signal" }: Props) {
  const rest = view.observations.slice(3);
  if (rest.length === 0) return null;

  const t =
    tone === "wire"
      ? {
          summary:
            "text-wire-ink underline underline-offset-4 hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp",
          divide: "divide-wire-rule border-y border-wire-rule",
          claim: "text-wire-ink",
          body: "text-wire-soft",
          faint: "text-wire-faint",
          link: "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp",
        }
      : {
          summary:
            "text-ink underline decoration-dotted underline-offset-4 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          divide: "divide-hairline-soft border-y border-hairline-soft",
          claim: "text-ink",
          body: "text-ink-soft",
          faint: "text-ink-faint",
          link: "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        };

  return (
    <details id="review-all" className="group mt-6">
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-2 text-[13px] outline-none ${t.summary}`}
      >
        <span>{view.suppression.reviewAllLabel}</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
      </summary>

      <p className={`mt-3 max-w-[62ch] text-[13px] leading-[1.6] ${t.faint}`}>
        {view.suppression.disclosure} They are shown here in full, with the same
        grammar as the three above.
      </p>

      <ol className={`mt-4 divide-y ${t.divide}`}>
        {rest.map((o) => (
          <li key={o.id} className="py-4">
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className={`font-mono text-[11px] tabular-nums ${t.faint}`}
              >
                {String(o.rank).padStart(2, "0")}
              </span>
              <h4 className={`max-w-[58ch] text-[15px] leading-[1.5] ${t.claim}`}>
                {o.claim}
              </h4>
            </div>
            <div className="mt-2 pl-[27px]">
              <p className={`max-w-[62ch] text-[13px] leading-[1.6] ${t.body}`}>
                {o.changed} {o.matters}
              </p>
              <p className={`mt-1.5 max-w-[62ch] text-[13px] leading-[1.6] ${t.claim}`}>
                {o.action.text}
                {o.action.rule ? (
                  <span className={`mt-0.5 block text-[12px] leading-[1.5] ${t.faint}`}>
                    Suggested by a rule, not by a person: {o.action.rule}
                  </span>
                ) : null}
              </p>
              {o.limitation ? (
                <p className={`mt-1.5 max-w-[62ch] text-[12px] leading-[1.55] ${t.faint}`}>
                  {o.limitation}
                </p>
              ) : null}
              <p className={`mt-1.5 font-mono text-[11px] ${t.faint}`}>
                {TRUTH_CLASS_LABEL[o.truthClass]} &middot; {o.coverage}{" "}
                {o.freshness}
              </p>
              <ul className="mt-2 space-y-1.5">
                {o.evidence.map((ev) => (
                  <li key={ev.id}>
                    <Link href={ev.route} className={`block outline-none ${t.link}`}>
                      <span className={`block text-[13px] leading-[1.45] ${t.body}`}>
                        {ev.title}
                      </span>
                      <span className={`block font-mono text-[10px] ${t.faint}`}>
                        {ev.source} &middot; {ev.meta}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
