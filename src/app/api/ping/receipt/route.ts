import { createPingReceiptHttp } from "@/server/ping/receipt-http";
import { authenticateMaintainedPingActor, getMaintainedPingReceipt } from "@/server/ping/maintained-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createPingReceiptHttp({ authenticate: authenticateMaintainedPingActor, receipt: getMaintainedPingReceipt });
