import { Wordmark } from "@/components/brand/wordmark";
import { redeemCompCodeAction } from "@/server/actions/comp";
import { RedeemResultCard } from "@/components/redeem/redeem-result-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem — Tasks" };

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
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
