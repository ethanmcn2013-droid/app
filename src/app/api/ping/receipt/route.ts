import { withPingTelemetry } from "@/server/ping/telemetry";
import { createPingReceiptHttp } from "@/server/ping/receipt-http";
import { authenticateMaintainedPingActor, getMaintainedPingReceipt } from "@/server/ping/maintained-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = createPingReceiptHttp({ authenticate: authenticateMaintainedPingActor, receipt: getMaintainedPingReceipt });
export const POST = (request: Request) => withPingTelemetry(request, () => handle(request));
