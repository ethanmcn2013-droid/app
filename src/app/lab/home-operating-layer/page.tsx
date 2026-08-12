import { requireLabReviewer } from "@/lib/home-layer/lab/guard";

/**
 * Placeholder for the Home operating-layer design lab (Wave 3).
 *
 * It exists now so the guard above it is testable now: something has to be
 * behind the door before you can prove the door is shut. It renders no data,
 * fetches nothing, imports no client, and will be replaced by the four
 * directions once they are built.
 *
 * ── Why the guard is called here as well as in the layout ──────────────────
 *
 * Not defence in depth for its own sake. Measured, on this page, at this base:
 * with the guard ONLY in the layout, `GET /lab/home-operating-layer` returned
 * a correct 404 whose response body still contained the complete React Server
 * Component payload of this page — every heading and paragraph, serialised
 * into the flight data. The layout threw `notFound()`, and the page had
 * already been rendered alongside it. A layout guard withholds the rendered
 * screen, not the render.
 *
 * That is survivable for a placeholder. It is not survivable for the actual
 * lab, which will render fixture data in permission-limited, partial and
 * guest-limited states. So every page in this family awaits the guard itself
 * and therefore never produces a payload at all. The contract test enforces
 * it on every page added here later, because the next person will not know
 * this happened.
 *
 * The rule this page inherits, and every page added beside it keeps: fixture
 * data only. No database client, no provider credential, no server action, no
 * job, no export. That is enforced statically by
 * src/lib/home-layer/lab/lab-isolation-contract.test.mjs, which walks the
 * import graph of this whole route family and fails on any of them.
 */

export default async function HomeOperatingLayerLabPlaceholder() {
  await requireLabReviewer();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6 py-24">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
        Protected lab
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Home operating layer
      </h1>
      <p className="text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
        The four design directions are not built yet. This page stands in for
        them so the access guard around this route can be proven before there
        is anything worth protecting.
      </p>
      <p className="text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
        Everything under this route shows made-up sample content. It never
        reads a real account, and it is never part of the live product.
      </p>
      <p className="text-sm leading-relaxed text-neutral-500">
        You are seeing this because the review flag is on and your account is on
        the reviewer list. Everyone else gets a page not found.
      </p>
    </main>
  );
}
