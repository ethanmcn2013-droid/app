import { withPingTelemetry } from "@/server/ping/telemetry";
import { createPingTypedHttp } from "@/server/ping/http";
import { authenticatePingTypedActor, getPingTypedSession } from "@/server/ping/runtime";
import { authenticateMaintainedPingActor, getMaintainedPingSession } from "@/server/ping/maintained-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A configured maintained mode never falls back to the fixture, including malformed flags.
export const POST = async (request: Request) => withPingTelemetry(request, async () => {
  const flag = process.env.PING_MAINTAINED_TYPED_ENABLED;
  const maintained = flag !== undefined;
  const unchanged = () => process.env.PING_MAINTAINED_TYPED_ENABLED === flag;
  return createPingTypedHttp({ typedOnly: () => maintained,
    authenticate: async () => {
      const actor = await (maintained ? authenticateMaintainedPingActor() : authenticatePingTypedActor());
      return unchanged() ? actor : null;
    },
    session: async () => {
      if (!unchanged()) return null;
      const session = await (maintained ? getMaintainedPingSession() : getPingTypedSession());
      return unchanged() ? session : null;
    },
  })(request);
});
