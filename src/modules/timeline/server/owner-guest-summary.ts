import 'server-only';
import {and,eq,gt,isNotNull,isNull,or,sql} from 'drizzle-orm';
import type {LibSQLDatabase} from 'drizzle-orm/libsql';
import * as schema from './db/timeline-schema';
import {validateMaster3ProjectSettings,type Master3ProjectSettings} from '../lib/master3-presentation';

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

/** Freshly load current settings, then delegate to the existing authorized save action. */
export async function saveOwnerReferralPreference(ports:{authorize:()=>Promise<boolean>;load:()=>Promise<Master3ProjectSettings|undefined>;save:(form:FormData)=>Promise<{saved?:boolean;error?:string}>},scope:{workspaceSlug:string;publicationId:string},enabled:boolean):Promise<void>{
 if(typeof enabled!=='boolean'||!await ports.authorize())throw new TypeError('Timeline not found');
 const current=validateMaster3ProjectSettings(await ports.load()??{}),form=new FormData();
 form.set('workspaceSlug',scope.workspaceSlug);form.set('publicationId',scope.publicationId);
 function append(prefix:string,value:unknown){if(value===true)form.set(prefix,'on');else if(typeof value==='string'||typeof value==='number')form.set(prefix,String(value));else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))append(prefix+'.'+key,child);}
 append('presentation',{...current.presentation,referral:enabled});for(const [id,item] of Object.entries(current.items??{}))append('item.'+id,item);
 const result=await ports.save(form);if(!result.saved)throw new TypeError(result.error??'Those settings could not be saved. Try again.');
}
