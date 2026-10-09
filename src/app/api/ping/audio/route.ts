import { createPingAudioHttp } from "@/server/ping/http";
import { authenticatePingTypedActor, getPingTypedSession } from "@/server/ping/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createPingAudioHttp({ authenticate: authenticatePingTypedActor, session: getPingTypedSession });
