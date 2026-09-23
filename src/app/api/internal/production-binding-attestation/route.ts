import {
  attestProductionRuntimeBindings,
  hiddenAttestationResponse,
} from "@/server/release/production-binding-attestation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// /api/internal/* is already a public proxy class for service bearers. This
// route adds no proxy exemption and independently refuses every unmarked or
// unauthenticated request before reading its body or any binding.
export async function POST(request: Request): Promise<Response> {
  return attestProductionRuntimeBindings(request, process.env);
}

export function GET(): Response { return hiddenAttestationResponse(); }
export function HEAD(): Response { return hiddenAttestationResponse(); }
export function OPTIONS(): Response { return hiddenAttestationResponse(); }
export function PUT(): Response { return hiddenAttestationResponse(); }
export function PATCH(): Response { return hiddenAttestationResponse(); }
export function DELETE(): Response { return hiddenAttestationResponse(); }
