/**
 * /app/timeline loading boundary: the module-local Timeline loader only.
 *
 * ArrivalSettle used to ride beside it, but it always renders an inline
 * <script>, and React raises the dev overlay ("Encountered a script tag while
 * rendering React component") when a loading boundary renders one on a
 * client navigation, such as pressing the "All projects" tab from a plan.
 * The shared fix belongs in src/components/system/arrival-settle.tsx
 * (render the script only before hydration); until then this boundary stays
 * script-free.
 */
import TimelineModuleLoading from "@/modules/timeline/app/loading";

export default function TimelineLoading() {
  return <TimelineModuleLoading />;
}
