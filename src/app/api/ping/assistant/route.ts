import { createAssistantHttp } from "@/server/ping/assistant/http";
import { authenticateAssistantActor, getAssistantService } from "@/server/ping/assistant/runtime";
import { withPingTelemetry } from "@/server/ping/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const handle = createAssistantHttp({ authenticate: authenticateAssistantActor, service: getAssistantService });
export const GET = (request: Request) => withPingTelemetry(request, () => handle(request));
export const POST = (request: Request) => withPingTelemetry(request, () => handle(request));
