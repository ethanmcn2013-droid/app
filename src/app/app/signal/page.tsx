import { requireAppAccess } from "@/server/require-app-access";
import { SignalBriefPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signal · Signal Studio" };

export default async function SignalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccess();
  return <SignalBriefPage searchParams={searchParams} />;
}
