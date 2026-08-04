import { notFound } from "next/navigation";
import {
  resolveShareLink,
  viewerIsWorkspaceMember,
} from "@/server/db/queries";
import { ShareBoard } from "@/components/app/share/share-board";
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

  // Owner-preview affordance only; never rendered for ordinary recipients.
  // The check never throws for anonymous visitors.
  const viewerIsMember = await viewerIsWorkspaceMember(data.workspaceId);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg">
      {viewerIsMember ? (
        <div className="flex items-center justify-center gap-2 border-b border-line-soft bg-bg-sunken px-6 py-1.5 text-[12px] text-ink-soft">
          You are viewing the shared version.
          <a
            href="/app/tasks"
            className="font-medium text-ink underline underline-offset-2 hover:text-ink-soft"
          >
            Return to workspace
          </a>
        </div>
      ) : null}
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
          {!viewerIsMember ? (
            <a
              href="/app/tasks"
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
          ) : null}
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ShareBoard columns={data.columns} tasks={data.tasks} />
      </main>
      <footer className="flex items-center justify-between border-t border-line-soft px-6 py-2.5">
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-ink-faint">
          Shared from {data.workspaceTitle}
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.02em] text-ink-faint">
          A Signal Studio product
        </span>
      </footer>
    </div>
  );
}
