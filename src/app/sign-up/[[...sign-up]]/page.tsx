import { SignUp } from "@clerk/nextjs";
import { Wordmark } from "@/components/brand/wordmark";
import { lookupSponsorByCode } from "@/server/db/venue-welcome";

export const metadata = { title: "Sign up — Tasks" };

const REDEEM_PATH = /^\/redeem\/([A-Za-z0-9-]+)\/?$/;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const sp = await searchParams;
  let sponsor: { name: string; code: string } | null = null;
  if (sp.redirect_url) {
    const match = REDEEM_PATH.exec(sp.redirect_url);
    if (match) {
      const code = match[1].toUpperCase();
      const info = await lookupSponsorByCode(code);
      if (info) sponsor = { name: info.sponsorName, code };
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
        {sponsor ? (
          <div className="mb-7 flex w-full max-w-[420px] flex-col items-center text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-quiet">
              {sponsor.name}
            </div>
            <p className="mt-2 text-[14.5px] leading-[1.5] text-ink-soft">
              Almost there. {sponsor.name} is covering your year.
            </p>
            <div className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-faint">
              Code · {sponsor.code}
            </div>
          </div>
        ) : null}
        <SignUp />
      </main>
    </div>
  );
}
