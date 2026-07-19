import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";

// Hybrid parity (T·99, 2026-07-19): the four task views now render the approved
// design-lab "hybrid" interior 1:1 (brief + view bar + view + planning rail).
// Production's left rail and top header remain; everything inside matches the lab.
export default function ListPage() {
  return <HybridWorkspace view="list" />;
}
