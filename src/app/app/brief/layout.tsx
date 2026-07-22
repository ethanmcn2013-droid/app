/**
 * /app/brief segment layout.
 *
 * Imports signal.css for the analytics path (.signal-analytics classes)
 * and brief-view styles ([data-signal-module] wrapper).
 *
 * S7: signal.css is ported as-is (.signal-analytics scoped); no globals.css
 *     changes. Brief-view styles are under [data-signal-module] wrapper.
 *     The motion dep is already present in the host package.json.
 */
import "@/modules/signal/components/signal/signal.css";

export default function BriefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
