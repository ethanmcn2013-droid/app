import Link from "next/link";
import {
  LAB_INDEX_ROUTE,
  LAB_STATES,
  VARIANTS,
  type LabStateId,
  type VariantId,
} from "@/lib/analytics-lab/model";

/**
 * The reviewer's instrument, deliberately not part of any composition.
 *
 * It is dark, fixed to the foot of the window, and shares no type or colour
 * with the work above it, so nothing here can be mistaken for a design
 * decision inside a variant. Two menus — composition and state — both plain
 * `<details>` elements, so switching needs no client JavaScript, survives
 * with JavaScript off, and is reachable by keyboard without a focus trap to
 * get wrong.
 *
 * Every state is a real URL, so a reviewer can send a link to the exact
 * screen they are talking about.
 */

type Props = {
  variant: VariantId;
  state: LabStateId;
  /** What this state exists to put on screen, shown next to the state name. */
  proves: string;
};

function stateHref(route: string, state: LabStateId): string {
  return state === "today" ? route : `${route}?state=${state}`;
}

export function AnalyticsLabChrome({ variant, state, proves }: Props) {
  const current = VARIANTS.find((v) => v.id === variant);
  const currentState = LAB_STATES.find((s) => s.id === state);

  return (
    <div className="sticky bottom-0 z-50 mt-16 print:hidden">
      <div className="border-t border-white/10 bg-zinc-950 text-zinc-300">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Lab
          </span>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-[11px] tracking-[0.02em] text-zinc-100 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400">
              <span className="text-zinc-500">Composition</span>
              <span>{current?.name ?? "—"}</span>
              <span aria-hidden="true" className="text-zinc-600">
                &#9662;
              </span>
            </summary>
            <div className="absolute bottom-full left-0 mb-2 w-[320px] rounded-[10px] border border-white/10 bg-zinc-900 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              <Link
                href={LAB_INDEX_ROUTE}
                className="block rounded-[6px] px-3 py-2 text-[13px] text-zinc-300 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              >
                All five, side by side
              </Link>
              {VARIANTS.map((v) => (
                <Link
                  key={v.id}
                  href={stateHref(v.route, state)}
                  aria-current={v.id === variant ? "page" : undefined}
                  className={`block rounded-[6px] px-3 py-2 text-[13px] hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none ${
                    v.id === variant ? "bg-white/10 text-white" : "text-zinc-300"
                  }`}
                >
                  {v.name}
                </Link>
              ))}
            </div>
          </details>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[4px] px-2 py-1.5 font-mono text-[11px] tracking-[0.02em] text-zinc-100 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-400">
              <span className="text-zinc-500">State</span>
              <span>{currentState?.label ?? "—"}</span>
              <span aria-hidden="true" className="text-zinc-600">
                &#9662;
              </span>
            </summary>
            <div className="absolute bottom-full left-0 mb-2 max-h-[70vh] w-[420px] overflow-y-auto rounded-[10px] border border-white/10 bg-zinc-900 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
              {LAB_STATES.map((s) => (
                <Link
                  key={s.id}
                  href={stateHref(current?.route ?? LAB_INDEX_ROUTE, s.id)}
                  aria-current={s.id === state ? "page" : undefined}
                  className={`block rounded-[6px] px-3 py-2 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none ${
                    s.id === state ? "bg-white/10" : ""
                  }`}
                >
                  <span
                    className={`block text-[13px] ${s.id === state ? "text-white" : "text-zinc-200"}`}
                  >
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-[1.45] text-zinc-500">
                    {s.proves}
                  </span>
                </Link>
              ))}
            </div>
          </details>

          <p className="ml-auto hidden max-w-[440px] text-[11px] leading-[1.45] text-zinc-500 lg:block">
            {proves}
          </p>
        </div>
      </div>
    </div>
  );
}
