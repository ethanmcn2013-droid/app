import { notFound } from "next/navigation";
import { resolveShareLink } from "@/server/db/queries";
import { ShareBoard } from "@/components/app/share/share-board";
import { GuestAuthProvider } from "@/components/app/guest/guest-auth-context";
import { Wordmark } from "@/components/brand/wordmark";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data;
  try {
    data = await resolveShareLink(token);
  } catch {
    notFound();
  }
  if (!data) notFound();

  return (
    <GuestAuthProvider isGuest>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-bg">
        <header className="flex items-center justify-between border-b border-line-soft px-6 py-3">
          <div className="flex items-center gap-3">
            <Wordmark size="md" />
            <span className="text-[11.5px] text-ink-quiet">›</span>
            <div className="text-[12px] font-medium text-ink-soft">
              {data.workspaceCrumb} · {data.workspaceTitle}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink-soft">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Read-only · Shared link
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <a
                href="/app/board"
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white transition-transform hover:-translate-y-px"
              >
                Make this yours
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
              <span className="text-[10.5px] text-ink-faint">Free to start.</span>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1">
          <ShareBoard tasks={data.tasks} />
        </main>
      </div>
    </GuestAuthProvider>
  );
}
