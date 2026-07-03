import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { redeemCompCodeAction } from "@/server/actions/comp";
import { RedeemResultCard } from "@/components/redeem/redeem-result-card";
import { getCurrentUserOrNull } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem, Tasks" };

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Couples arrive here unauthenticated from signalstudio.ie/redeem.
  // Send them through Clerk first; Clerk honors `redirect_url` and
  // returns them to this same path with a session, where the action
  // can resolve them and the welcome short-circuit in /welcome takes
  // over.
  const me = await getCurrentUserOrNull();
  if (!me) {
    const back = `/redeem/${encodeURIComponent(code)}`;
    redirect(`/sign-up?redirect_url=${encodeURIComponent(back)}`);
  }

  const result = await redeemCompCodeAction(code);
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <RedeemResultCard code={code.toUpperCase()} result={result} />
      </main>
    </div>
  );
}
