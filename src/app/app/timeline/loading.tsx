/**
 * /app/timeline loading boundary — the module-local Timeline loader, plus
 * the suite's arrival settle (wave 7).
 *
 * The loader itself is untouched and still owned by the module. What is
 * added here is the hand-off: ArrivalSettle rides beside it and gives the
 * Timeline surface one whole-surface opacity settle when this boundary
 * yields. See src/components/system/arrival-settle.tsx.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import TimelineModuleLoading from "@/modules/timeline/app/loading";

export default function TimelineLoading() {
  return (
    <>
      <ArrivalSettle />
      <TimelineModuleLoading />
    </>
  );
}
