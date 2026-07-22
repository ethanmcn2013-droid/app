export default function SharedTimelineLoading() {
  return (
    <main className="min-h-dvh bg-white px-[clamp(1.25rem,4vw,4.5rem)] py-8" aria-label="Loading timeline">
      <div className="h-px w-full bg-[#171717]" />
      <div className="mt-4 h-3 w-20 animate-pulse rounded-full bg-[#e7e7e7] motion-reduce:animate-none" />
      <div className="mt-[18vh] h-20 w-2/3 max-w-2xl animate-pulse rounded-2xl bg-[#f2f2f0] motion-reduce:animate-none" />
      <div className="mt-[20vh] h-px w-full bg-[#d8d8d4]" />
      <span className="sr-only">Loading shared timeline</span>
    </main>
  );
}
