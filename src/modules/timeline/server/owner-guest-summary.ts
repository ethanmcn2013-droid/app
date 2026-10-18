import 'server-only';
import {and,eq,gt,isNotNull,isNull,or,sql} from 'drizzle-orm';
import type {LibSQLDatabase} from 'drizzle-orm/libsql';
import * as schema from './db/timeline-schema';

/** Owner-only aggregate; no subscriber identity leaves this server boundary. */
export function createOwnerGuestSummaryStore(database:LibSQLDatabase<typeof schema>){
 async function authorized(actorId:string,workspaceSlug:string,publicationId:string){
  const p=schema.timelinePublications,w=schema.workspaces;
  return (await database.select({id:p.id}).from(p).innerJoin(w,eq(w.slug,p.workspaceSlug)).where(and(eq(p.id,publicationId),eq(p.workspaceSlug,workspaceSlug),eq(w.ownerUserId,actorId))).limit(1)).length===1;
 }
 return {authorized,async read(actorId:string,workspaceSlug:string,publicationId:string,now=new Date()):Promise<{followerCount?:number}>{
  if(!await authorized(actorId,workspaceSlug,publicationId))throw new TypeError('Timeline not found');
  const ready=await database.run(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='timeline_guest_subscriptions'`);if(!ready.rows.length)return {};
  const s=schema.timelineGuestSubscriptions,a=schema.audienceShares,p=schema.timelinePublications,w=schema.workspaces;
  const [row]=await database.select({count:sql<number>`count(distinct ${s.emailHash})`}).from(s)
   .innerJoin(a,and(eq(a.tokenHash,s.shareTokenHash),eq(a.publicationId,s.publicationId)))
   .innerJoin(p,eq(p.id,s.publicationId)).innerJoin(w,eq(w.slug,p.workspaceSlug))
   .where(and(eq(p.id,publicationId),eq(p.workspaceSlug,workspaceSlug),eq(w.ownerUserId,actorId),eq(p.state,'published'),eq(s.state,'confirmed'),eq(s.deliveryState,'sent'),isNotNull(s.confirmedAt),eq(a.state,'active'),or(isNull(a.expiresAt),gt(a.expiresAt,now))));
  return {followerCount:Number(row?.count??0)};
 }};
}

/** Pass only the requested field to the fresh-authorized atomic settings action. */
export async function saveOwnerReferralPreference(ports:{authorize:()=>Promise<boolean>;save:(form:FormData)=>Promise<{saved?:boolean;error?:string}>},scope:{workspaceSlug:string;publicationId:string},enabled:boolean):Promise<void>{
 if(typeof enabled!=='boolean'||!await ports.authorize())throw new TypeError('Timeline not found');
 const form=new FormData();form.set('workspaceSlug',scope.workspaceSlug);form.set('publicationId',scope.publicationId);form.set('referral',String(enabled));
 const result=await ports.save(form);if(!result.saved)throw new TypeError(result.error??'Those settings could not be saved. Try again.');
}
