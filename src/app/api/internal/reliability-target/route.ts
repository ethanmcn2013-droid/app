import { previewReliabilityAttestation } from "../../../../server/release/preview-reliability-attestation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return previewReliabilityAttestation(request, process.env);
}
