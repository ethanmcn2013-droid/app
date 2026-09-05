import { db } from "@/server/db";
import { readCanonicalVenueClaim } from "@/server/venue-issuance/canonical";
import { provenanceHandler } from "@/server/sponsored-use/provenance-handler";
import { hashEpoch, usageResponse } from "@/lib/sponsored-use/service-auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  // Previous salts are optional, explicit, App-only repair keys. Never relabel
  // queued events with today's epoch.
  const previous:unknown = (()=>{try{return JSON.parse(process.env.SPONSOR_USAGE_PREVIOUS_SALTS_JSON ?? "[]");}catch{return [];}})();
  const salts=[process.env.SPONSOR_USAGE_HASH_SALT,...(Array.isArray(previous)?previous:[])].filter(
    (salt):salt is string=>typeof salt==="string" && salt.length>=16);
  const salt=salts.find(value=>hashEpoch(value)===request.headers.get("x-sponsored-use-epoch"));
  if(!salt) return usageResponse(503,{ok:false});
  return provenanceHandler(db,readCanonicalVenueClaim,{
    enabled:process.env.SPONSOR_USAGE_EVENTS==="1",salt,
    secret:process.env.SPONSOR_USAGE_SERVICE_SECRET ?? "",issuanceSecret:process.env.VENUE_ISSUANCE_SECRET,
  })(request);
}
