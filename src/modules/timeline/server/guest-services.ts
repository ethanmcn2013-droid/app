import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AudienceTimelineDto } from '../lib/audience-timeline';
export type GuestFollowRecord={id:string;publicationId:string;shareTokenHash:string;email:string;emailHash:string;state:'pending'|'confirmed'|'unsubscribed';confirmationTokenHash:string|null;confirmationExpiresAt:Date|null;unsubscribeTokenHash:string|null;undoTokenHash:string|null;undoUntil:Date|null;confirmedAt:Date|null;lastConfirmationSentAt:Date|null;deliveryState:'pending'|'sending'|'sent'|'failed'|'unknown';deliveryAttemptId:string|null;providerMessageId:string|null;createdAt:Date;updatedAt:Date};
export interface GuestFollowStore{
 findEmail(shareHash:string,emailHash:string):Promise<GuestFollowRecord|null>;
 findToken(shareHash:string,field:'confirmationTokenHash'|'unsubscribeTokenHash'|'undoTokenHash',hash:string):Promise<GuestFollowRecord|null>;
 insert(record:GuestFollowRecord):Promise<boolean>;
 update(id:string,expectedAttempt:string|null,patch:Partial<GuestFollowRecord>):Promise<boolean>;
}
export type FollowResult={ok:true;state:'pending'|'confirmed'|'unsubscribed'|'check_email';emailHint?:string;confirmationSent?:boolean;managementToken?:string;undoToken?:string;undoUntil?:string;retryAfterSeconds?:number}|{ok:false;code:string;message:string;managementToken?:string};
/** Only authorized management responses use this deliberately coarse hint. */
export const guestEmailHint=(email:string)=>{const [local,domain]=email.split('@');return `${local.slice(0,1)}***@${domain.slice(0,1)}***`;};
export type GuestFollowPorts={store:GuestFollowStore;resolve:(shareToken:string)=>Promise<{kind:string;dto?:AudienceTimelineDto}>;deliveryAvailable:()=>boolean;limit:(identity:string)=>Promise<boolean>;send:(input:{to:string;label:string;confirmationUrl:string;manageUrl:string;attemptId:string})=>Promise<{kind:'sent';providerMessageId:string}|{kind:'failed'|'unknown'}>;origin:string;now?:()=>Date;token?:()=>string;id?:()=>string};
export const guestDigest=(v:string)=>createHash('sha256').update(v).digest('hex');
const tokenShape=(v:string)=>/^[A-Za-z0-9_-]{43}$/.test(v);
const normalizeEmail=(v:string)=>v.trim().toLowerCase();
const validEmail=(v:string)=>v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)&&!/[\r\n]/.test(v);
const failure=(code:string,message:string):FollowResult=>({ok:false,code,message});
/** Every operation resolves the live public share first; tokens alone never bypass revocation. */
export function createGuestFollowService(ports:GuestFollowPorts){
 const now=ports.now??(()=>new Date()),token=ports.token??(()=>randomBytes(32).toString('base64url')),id=ports.id??randomUUID;
 async function access(shareToken:string){if(!tokenShape(shareToken))return null;const resolved=await ports.resolve(shareToken);return resolved.kind==='ok'&&resolved.dto?{dto:resolved.dto,shareHash:guestDigest(shareToken)}:null;}
 async function managed(shareHash:string,key:string,field:'confirmationTokenHash'|'unsubscribeTokenHash'|'undoTokenHash'){if(!tokenShape(key))return null;return ports.store.findToken(shareHash,field,guestDigest(key));}
 return {
 async request(shareToken:string,input:{operation:'subscribe'|'resend'|'change_email'|'status';email?:string;managementToken?:string}):Promise<FollowResult>{
  const a=await access(shareToken);if(!a)return failure('share_unavailable','This shared timeline is unavailable.');
  const current=input.managementToken?await managed(a.shareHash,input.managementToken,'unsubscribeTokenHash'):null;
  if(input.managementToken&&!current)return failure('link_unavailable','This follow link is unavailable.');
  if(input.operation==='status'){if(!current)return failure('link_unavailable','This follow link is unavailable.');if(current.deliveryState==='unknown'||current.deliveryState==='sending')return failure('delivery_unknown','Delivery could not be confirmed. Use the email link if it arrives.');return {ok:true,state:current.state,emailHint:guestEmailHint(current.email)};}
  if(input.operation!=='subscribe'&&!current)return failure('link_unavailable','Use the link in your confirmation email to manage this follow.');
  if(input.operation==='resend'&&current?.state==='confirmed')return {ok:true,state:'confirmed',confirmationSent:false};
  if(!ports.deliveryAvailable())return failure('delivery_unavailable','Email confirmation is unavailable right now.');
  if(current&&(current.deliveryState==='unknown'||current.deliveryState==='sending'))return failure('delivery_unknown','Delivery could not be confirmed. Use the email link if it arrives.');
  const email=normalizeEmail(input.operation==='resend'?current!.email:input.email??'');if(!validEmail(email))return failure('email_invalid','Enter a valid email address.');
  const timestamp=now();if(input.operation==='resend'&&current?.lastConfirmationSentAt&&timestamp.getTime()-current.lastConfirmationSentAt.getTime()<3600000)return {ok:false,code:'cooldown',message:'Wait an hour before sending another confirmation.'};
  const emailHash=guestDigest(email);if(!await ports.limit(a.shareHash+':'+emailHash))return failure('rate_limited','Too many requests. Try again later.');
  const existing=await ports.store.findEmail(a.shareHash,emailHash);if(existing&&existing.id!==current?.id)return {ok:true,state:'check_email',confirmationSent:false};
  const confirmation=token(),management=input.managementToken??token(),attempt=id();
  const patch:Partial<GuestFollowRecord>={email,emailHash,state:'pending',confirmationTokenHash:guestDigest(confirmation),confirmationExpiresAt:new Date(timestamp.getTime()+86400000),unsubscribeTokenHash:guestDigest(management),undoTokenHash:null,undoUntil:null,confirmedAt:null,lastConfirmationSentAt:timestamp,deliveryState:'sending',deliveryAttemptId:attempt,providerMessageId:null,updatedAt:timestamp};
  const record:GuestFollowRecord={id:id(),publicationId:a.dto.publicationId,shareTokenHash:a.shareHash,email,emailHash,state:'pending',confirmationTokenHash:null,confirmationExpiresAt:null,unsubscribeTokenHash:null,undoTokenHash:null,undoUntil:null,confirmedAt:null,lastConfirmationSentAt:null,deliveryState:'pending',deliveryAttemptId:null,providerMessageId:null,createdAt:timestamp,updatedAt:timestamp,...patch};
  const saved=current?await ports.store.update(current.id,current.deliveryAttemptId,patch):await ports.store.insert(record);if(!saved)return failure('request_conflict','This request changed. Check its status before trying again.');
  const recordId=current?.id??record.id,base=ports.origin.replace(/\/$/,'')+'/s/'+encodeURIComponent(shareToken)+'/follow/';
  let sent:Awaited<ReturnType<GuestFollowPorts['send']>>;try{sent=await ports.send({to:email,label:a.dto.label,confirmationUrl:base+'confirm?key='+encodeURIComponent(confirmation),manageUrl:base+'unsubscribe?key='+encodeURIComponent(management),attemptId:attempt});}catch{sent={kind:'unknown'};}
  const real=sent.kind==='sent'&&!!sent.providerMessageId&&sent.providerMessageId!=='dev-no-resend';const settled=await ports.store.update(recordId,attempt,{deliveryState:real?'sent':sent.kind==='failed'?'failed':'unknown',providerMessageId:sent.kind==='sent'?sent.providerMessageId:null,updatedAt:now()});
  if(!settled)return failure('delivery_unknown','The delivery result could not be saved. Use the email link if it arrives.');
  if(!real)return {ok:false,code:sent.kind==='failed'?'delivery_failed':'delivery_unknown',message:sent.kind==='failed'?'The confirmation could not be sent.':'Delivery could not be confirmed. Use the email link if it arrives.',managementToken:management};
  return {ok:true,state:'pending',confirmationSent:true,managementToken:management,retryAfterSeconds:3600};
 },
 async confirm(shareToken:string,key:string):Promise<FollowResult>{const a=await access(shareToken);if(!a)return failure('share_unavailable','This shared timeline is unavailable.');if(!ports.deliveryAvailable())return failure('delivery_unavailable','Email updates are unavailable right now.');const r=await managed(a.shareHash,key,'confirmationTokenHash');const t=now();if(!r||r.state!=='pending'||r.deliveryState!=='sent'||!r.confirmationExpiresAt||r.confirmationExpiresAt<=t)return failure('link_unavailable','This confirmation link has expired or is unavailable.');if(!await ports.store.update(r.id,r.deliveryAttemptId,{state:'confirmed',confirmedAt:t,confirmationTokenHash:null,confirmationExpiresAt:null,updatedAt:t,deliveryAttemptId:id()}))return failure('request_conflict','This request changed.');return {ok:true,state:'confirmed'};},
 async unsubscribe(shareToken:string,key:string):Promise<FollowResult>{const a=await access(shareToken);if(!a)return failure('share_unavailable','This shared timeline is unavailable.');const r=await managed(a.shareHash,key,'unsubscribeTokenHash');if(!r)return failure('link_unavailable','This follow link is unavailable.');if(r.state==='unsubscribed')return {ok:true,state:'unsubscribed'};const undo=token(),t=now(),until=new Date(t.getTime()+10000);if(!await ports.store.update(r.id,r.deliveryAttemptId,{state:'unsubscribed',undoTokenHash:guestDigest(undo),undoUntil:until,updatedAt:t,deliveryAttemptId:id()}))return failure('request_conflict','This request changed.');return {ok:true,state:'unsubscribed',undoToken:undo,undoUntil:until.toISOString()};},
 async undo(shareToken:string,key:string):Promise<FollowResult>{const a=await access(shareToken);if(!a)return failure('share_unavailable','This shared timeline is unavailable.');const r=await managed(a.shareHash,key,'undoTokenHash');const t=now();if(!r||r.state!=='unsubscribed'||!r.undoUntil||r.undoUntil<=t)return failure('undo_expired','Undo is no longer available.');const state=r.confirmedAt?'confirmed':'pending';if(!await ports.store.update(r.id,r.deliveryAttemptId,{state,undoTokenHash:null,undoUntil:null,updatedAt:t,deliveryAttemptId:id()}))return failure('request_conflict','This request changed.');return {ok:true,state};},
 };
}
import { and, eq, isNull, lte, inArray, or } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as guestSchema from './db/timeline-schema';
export function createGuestFollowStore(database:LibSQLDatabase<typeof guestSchema>):GuestFollowStore{
 const table=guestSchema.timelineGuestSubscriptions;
 return {
  async findEmail(shareHash,emailHash){return (await database.select().from(table).where(and(eq(table.shareTokenHash,shareHash),eq(table.emailHash,emailHash))).limit(1))[0]??null;},
  async findToken(shareHash,field,hash){return (await database.select().from(table).where(and(eq(table.shareTokenHash,shareHash),eq(table[field],hash))).limit(1))[0]??null;},
  async insert(record){return (await database.insert(table).values(record).onConflictDoNothing().returning({id:table.id})).length===1;},
  async update(recordId,attempt,patch){return (await database.update(table).set(patch).where(and(eq(table.id,recordId),attempt===null?isNull(table.deliveryAttemptId):eq(table.deliveryAttemptId,attempt))).returning({id:table.id})).length===1;},
 };
}
import { createHmac, timingSafeEqual } from 'node:crypto';
export type GuestSubscriberPurpose='view'|'unsubscribe';
export function guestSigningAvailable(secret:string|undefined):boolean{return typeof secret==='string'&&secret.length>=32&&secret.length<=512;}
export function verifyGuestSubscriberProof(proof:string,secret:string|undefined,purpose:GuestSubscriberPurpose,now=new Date()):{subscriptionId:string;expiresAt:Date}|null{
 try{if(!guestSigningAvailable(secret)||proof.length>1024||!/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.test(proof))return null;const [payload,signature]=proof.split('.'),expected=createHmac('sha256',secret!).update('timeline-follow-v1:'+payload).digest(),actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const value=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='e,p,s,v'||value.v!==1||value.p!==purpose||typeof value.s!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(value.s)||!Number.isSafeInteger(value.e)||value.e<=Math.floor(now.getTime()/1000))return null;return {subscriptionId:value.s,expiresAt:new Date(value.e*1000)};}catch{return null;}
}
export function createGuestSubscriberLinks({secret,origin}:{secret:string|undefined;origin:string}){
 return {deliveryLink({subscriptionId,purpose,expiresAt}:{subscriptionId:string;purpose:GuestSubscriberPurpose;expiresAt:Date}):string{
  if(!guestSigningAvailable(secret)||!/^[A-Za-z0-9_-]{1,160}$/.test(subscriptionId)||!['view','unsubscribe'].includes(purpose)||!Number.isFinite(expiresAt.getTime()))throw new Error('guest_links_unavailable');
  const payload=Buffer.from(JSON.stringify({v:1,s:subscriptionId,p:purpose,e:Math.floor(expiresAt.getTime()/1000)})).toString('base64url'),signature=createHmac('sha256',secret!).update('timeline-follow-v1:'+payload).digest('base64url');return origin.replace(/\/$/,'')+'/s/follow/'+purpose+'?proof='+payload+'.'+signature;
 }};
}
export async function resolveGuestSubscriberWith(ports:{secret:string|undefined;findSubscription:(id:string)=>Promise<GuestFollowRecord|null>;resolveDigest:(hash:string,publicationId:string)=>Promise<{kind:string;dto?:AudienceTimelineDto}>;now?:()=>Date},proof:string,purpose:GuestSubscriberPurpose,allowUnsubscribed=false):Promise<{subscription:GuestFollowRecord;dto:AudienceTimelineDto}|null>{
 const verified=verifyGuestSubscriberProof(proof,ports.secret,purpose,ports.now?.()??new Date());if(!verified)return null;const subscription=await ports.findSubscription(verified.subscriptionId);if(!subscription||(subscription.state!=='confirmed'&&!(allowUnsubscribed&&purpose==='unsubscribe'&&subscription.state==='unsubscribed'))||subscription.deliveryState!=='sent')return null;
 const resolved=await ports.resolveDigest(subscription.shareTokenHash,subscription.publicationId);return resolved.kind==='ok'&&resolved.dto?.publicationId===subscription.publicationId?{subscription,dto:resolved.dto}:null;
}
/** Bounded privacy cleanup, independent of whether email delivery is configured. */
export async function cleanupGuestSubscriptions(database:LibSQLDatabase<typeof guestSchema>,now=new Date(),limit=100):Promise<number>{
 if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new TypeError('Invalid cleanup limit');
 const t=guestSchema.timelineGuestSubscriptions,expired=or(and(eq(t.state,'pending'),lte(t.confirmationExpiresAt,now)),and(eq(t.state,'unsubscribed'),lte(t.updatedAt,new Date(now.getTime()-30*86400000))));
 const ids=(await database.select({id:t.id}).from(t).where(expired).limit(limit)).map(r=>r.id);if(!ids.length)return 0;
 return (await database.delete(t).where(and(inArray(t.id,ids),expired)).returning({id:t.id})).length;
}
