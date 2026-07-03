import { ShareTargetQuickAdd } from "@/components/app/share-target-quick-add";

/**
 * iOS / Android PWA share-target receiver.
 *
 * The manifest declares this route under `share_target.action` with
 * `method: "GET"` so the system arrives here as a normal navigation
 * carrying `?title=...&url=...&text=...`. We read those on the server
 * and hand them to a thin client component that owns the modal UX.
 *
 * The route is intentionally reachable by direct URL too, useful for
 * dev probing without an actual share-sheet round-trip.
 */
export default async function ShareTargetPage({
  searchParams,
}: {
  searchParams: Promise<{
    title?: string | string[];
    url?: string | string[];
    text?: string | string[];
  }>;
}) {
  const sp = await searchParams;

  const pick = (v: string | string[] | undefined): string => {
    if (Array.isArray(v)) return v[0] ?? "";
    return v ?? "";
  };

  const title = pick(sp.title).trim();
  const url = pick(sp.url).trim();
  const text = pick(sp.text).trim();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <ShareTargetQuickAdd title={title} url={url} text={text} />
    </main>
  );
}
