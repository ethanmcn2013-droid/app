/**
 * /app/files loading boundary. The shell is already on screen, so the wait
 * stays in the content column as a tracing of the settled page. No shimmer
 * and no invented names; static blocks satisfy reduced motion without a query.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import { FilesSkeleton } from "@/components/app/files/files-view";

export default function FilesLoading() {
  return (
    <>
      <ArrivalSettle />
      <FilesSkeleton />
    </>
  );
}
