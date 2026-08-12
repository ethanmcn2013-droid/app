/**
 * /app/notes loading boundary — the module-local Notes loader, plus the
 * suite's arrival settle (wave 7).
 *
 * The loader itself is untouched and still owned by the module. What is
 * added here is the hand-off: ArrivalSettle rides beside it and gives the
 * Notes surface one whole-surface opacity settle when this boundary yields,
 * so the product no longer ends its loader on a cut. See
 * src/components/system/arrival-settle.tsx.
 */
import { ArrivalSettle } from "@/components/system/arrival-settle";
import NotesModuleLoading from "@/modules/notes/app/loading";

export default function NotesLoading() {
  return (
    <>
      <ArrivalSettle />
      <NotesModuleLoading />
    </>
  );
}
