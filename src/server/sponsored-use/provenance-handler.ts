import "server-only";
import { authenticateUsageRequest, hashEpoch, USAGE_PATHS, usageResponse } from "@/lib/sponsored-use/service-auth";
import type { db } from "@/server/db";
import { readUsageEligiblePage, readUsageEventProof, type CanonicalClaimReader } from "./provenance";
export type ProvenanceConfig = { enabled:boolean; salt:string; secret:string; issuanceSecret?:string; now?:number };
export function provenanceHandler(database:typeof db,readClaim:CanonicalClaimReader,config:ProvenanceConfig) {
  return async (request:Request):Promise<Response> => {
    if(!config.enabled || config.salt.length<16) return usageResponse(503,{ok:false});
    const auth = await authenticateUsageRequest(request,USAGE_PATHS.provenance,
      {secret:config.secret,issuanceSecret:config.issuanceSecret,epoch:hashEpoch(config.salt),now:config.now});
    if(!auth.ok) return usageResponse(401,{ok:false});
    const p = auth.payload as Record<string,unknown> | null;
    if(!p || typeof p!=="object" || Array.isArray(p)) return usageResponse(400,{ok:false});
    try {
      // One snapshot for receipt, exact claim, membership and both deletion fences.
      const result=await database.transaction(async tx=>{
        if(Object.keys(p).length===1 && typeof p.eventId==="string" && /^[a-f0-9-]{36}$/.test(p.eventId))
          return {proof:await readUsageEventProof(tx,readClaim,p.eventId,config.salt,config.now ?? Date.now())};
        if(Object.keys(p).length===2 && typeof p.issuanceId==="string" && /^vi-[a-f0-9]{32}$/.test(p.issuanceId) &&
          p.cursor==="0")
          return readUsageEligiblePage(tx,readClaim,p.issuanceId,Number(p.cursor),config.salt);
        return null;
      },{behavior:"deferred"});
      return result ? usageResponse(200,result) : usageResponse(400,{ok:false});
    } catch { return usageResponse(503,{ok:false}); }
  };
}
