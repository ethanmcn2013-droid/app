/**
 * /app/wedding/guests loading boundary. The shell is already on screen, so
 * the wait stays in the content column as a tracing of the settled page. No
 * shimmer and no invented names; static blocks satisfy reduced motion.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import { GuestListSkeleton } from "@/components/app/wedding/wedding-states";

export default function WeddingGuestsLoading() {
  return (
    <>
      <ArrivalSettle />
      <GuestListSkeleton />
    </>
  );
}
