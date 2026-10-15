import { createPingTelemetryHttp } from "@/server/ping/telemetry-http";
import { authenticateMaintainedPingActor } from "@/server/ping/maintained-runtime";
import { pingTelemetryEnabled } from "@/server/ping/telemetry";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const POST=createPingTelemetryHttp({enabled:pingTelemetryEnabled,authenticate:authenticateMaintainedPingActor});
