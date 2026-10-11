import { createPingTypedHttp } from "@/server/ping/http";
import { authenticatePingTypedActor, getPingTypedSession } from "@/server/ping/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createPingTypedHttp({ authenticate: authenticatePingTypedActor, session: getPingTypedSession });
