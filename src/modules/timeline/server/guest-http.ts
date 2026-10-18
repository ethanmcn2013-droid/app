import 'server-only';
import {createGuestFollowService,createGuestFollowStore,guestDigest,guestSigningAvailable,verifyGuestSubscriberProof,resolveGuestSubscriberWith,type FollowResult} from './guest-services';
import {master3CalendarLinks,renderMaster3Ics,type GuestTimelineServices} from '../lib/master3-calendar';
import type {AudienceTimelineDto} from '../lib/audience-timeline';
export type GuestHttpPorts={resolve:(token:string)=>Promise<{kind:string;dto?:AudienceTimelineDto}>;follow:ReturnType<typeof createGuestFollowService>;followAvailable:()=>Promise<boolean>;managementExpiry?:(token:string)=>Promise<Date|null>;now?:()=>Date};
const managementCookieName=(token:string)=>'timeline_follow_'+guestDigest(token).slice(0,24);
function managementCookie(request:Request,token:string){const name=managementCookieName(token)+'=';const values=(request.headers.get('cookie')??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name));if(values.length!==1)return undefined;const value=values[0].slice(name.length);return /^[A-Za-z0-9_-]{43}$/.test(value)?value:undefined;}
const headers={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const error=(code:string,message:string,status=400)=>Response.json({ok:false,code,message},{status,headers});
async function boundedGuestText(request:Request,limit:number):Promise<string|null>{
 if(Number(request.headers.get('content-length'))>limit)return null;if(!request.body)return '';const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)return null;chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}finally{await reader.cancel();}
}
export function createGuestHttpHandler(ports:GuestHttpPorts){return async(request:Request,token:string,operation:'services'|'calendar'|'follow'|'confirm'|'unsubscribe'|'undo')=>{
 try{
  const resolved=await ports.resolve(token);if(resolved.kind!=='ok'||!resolved.dto)return error('share_unavailable','This shared timeline is unavailable.',404);
  if(operation==='services'){if(request.method!=='GET')return error('method_not_allowed','Use GET.',405);const calendar=master3CalendarLinks(resolved.dto,token),origin=new URL(request.url).origin;const key=managementCookie(request,token),status=key?await ports.follow.request(token,{operation:'status',managementToken:key}):null;const body:GuestTimelineServices={available:true,followAvailable:await ports.followAvailable(),...(status?.ok&&status.state!=='check_email'&&status.emailHint?{followStatus:{state:status.state,emailHint:status.emailHint}}:{}),calendar:calendar?{...calendar,icsHref:new URL(calendar.icsHref,origin).href,feedHref:new URL(calendar.feedHref,origin).href.replace(/^https?:/,'webcal:')}:null};return Response.json(body,{headers});}
  if(operation==='calendar'){if(request.method!=='GET')return error('method_not_allowed','Use GET.',405);return new Response(renderMaster3Ics(resolved.dto),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="timeline.ics"'}});}
  if(request.method!=='POST')return error('method_not_allowed','Use POST.',405);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return error('origin_invalid','This request could not be verified.',403);
  const text=await boundedGuestText(request,4096);if(text===null)return error('request_too_large','This request is too large.',413);
  let body:Record<string,unknown>;try{body=JSON.parse(text);}catch{return error('request_invalid','This request could not be read.');}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['operation','email','managementToken','key'].includes(k))||Object.values(body).some(v=>typeof v!=='string'))return error('request_invalid','This request could not be read.');
  let result:FollowResult;
  if(operation==='follow'){if(!['subscribe','resend','change_email','status'].includes(String(body.operation)))return error('request_invalid','Choose a follow action.');const managementToken=body.managementToken||managementCookie(request,token);result=await ports.follow.request(token,{...body,...(managementToken?{managementToken}:{})} as {operation:'subscribe'|'resend'|'change_email'|'status';email?:string;managementToken?:string});}
  else {const key=body.key||(operation==='unsubscribe'?managementCookie(request,token):undefined);if(typeof key!=='string')return error('request_invalid','This link is unavailable.');result=await ports.follow[operation](token,key);}
  const response=Response.json(result,{status:result.ok?200:['delivery_unavailable','delivery_unknown'].includes(result.code)?503:result.code==='rate_limited'?429:400,headers});
  if(result.ok&&result.managementToken&&ports.managementExpiry){const now=ports.now?.()??new Date(),expiry=await ports.managementExpiry(token),seconds=expiry?Math.floor((Math.min(expiry.getTime(),now.getTime()+86400000)-now.getTime())/1000):0;if(seconds>0)response.headers.append('Set-Cookie',`${managementCookieName(token)}=${result.managementToken}; HttpOnly; SameSite=Lax; Path=/api/timeline/share/${encodeURIComponent(token)}/; Max-Age=${seconds}${process.env.NODE_ENV==='production'||new URL(request.url).protocol==='https:'?'; Secure':''}`);}
  return response;
 }catch{return error('service_unavailable','This service is unavailable right now.',503);}
};}
const html=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function handleTimelineGuestRequest(request:Request,token:string,operation:Parameters<ReturnType<typeof createGuestHttpHandler>>[2]):Promise<Response>{
 const [{db},{resolveAudienceTimeline},{emailConfigured,sendEmail},{TIMELINE_PUBLIC_ORIGIN},{checkRateLimit,getClientIp,isRedisConfigured},{isDemoMode}]=await Promise.all([import('./db/timeline-client'),import('./audience-timeline'),import('@/server/email'),import('@/lib/product-urls'),import('../lib/rate-limit'),import('@/lib/access-mode')]);
 const ready=()=>!isDemoMode()&&emailConfigured&&Boolean(process.env.CRON_SECRET)&&guestSigningAvailable(process.env.TIMELINE_FOLLOW_SIGNING_SECRET)&&(process.env.NODE_ENV!=='production'||isRedisConfigured());
 const service=createGuestFollowService({store:createGuestFollowStore(db),resolve:resolveAudienceTimeline,origin:TIMELINE_PUBLIC_ORIGIN,deliveryAvailable:ready,limit:async identity=>{const ip=await getClientIp();return (await checkRateLimit('timeline-follow-email',identity,1,3600)).allowed&&(await checkRateLimit('timeline-follow-ip',ip,5,3600)).allowed;},send:async input=>{
  if(!ready())return {kind:'failed'};const result=await sendEmail({to:input.to,subject:input.subject,text:`Confirm that you want updates for ${input.label}: ${input.confirmationUrl}\n\nManage this follow: ${input.manageUrl}`,html:`<p>Confirm that you want updates for ${html(input.label)}.</p><p><a href="${html(input.confirmationUrl)}">Confirm follow</a></p><p><a href="${html(input.manageUrl)}">Manage this follow</a></p>`});return result.ok&&result.id&&result.id!=='dev-no-resend'?{kind:'sent',providerMessageId:result.id}:{kind:'unknown'};
 }});
 return createGuestHttpHandler({resolve:resolveAudienceTimeline,follow:service,managementExpiry:async share=>{const [{audienceShares},{eq,and}]=await Promise.all([import('./db/timeline-schema'),import('drizzle-orm')]);const row=(await db.select({expiresAt:audienceShares.expiresAt}).from(audienceShares).where(and(eq(audienceShares.tokenHash,guestDigest(share)),eq(audienceShares.state,'active'))).limit(1))[0];return row?(row.expiresAt??new Date(Date.now()+86400000)):null;},followAvailable:async()=>{if(!ready())return false;try{return await (await import('./master3-settings')).master3SchemaAvailable();}catch{return false;}}})(request,token,operation);
}
/** Signed subscriber routes use the same live share policy; no raw share token is persisted. */
export async function resolveGuestSubscriber(proof:string,purpose:'view'|'unsubscribe',allowUnsubscribed=false){
 if(!verifyGuestSubscriberProof(proof,process.env.TIMELINE_FOLLOW_SIGNING_SECRET,purpose))return null;
 const [{db},{timelineGuestSubscriptions},{eq},{resolveAudienceTimelineDigest}]=await Promise.all([import('./db/timeline-client'),import('./db/timeline-schema'),import('drizzle-orm'),import('./audience-timeline')]);
 return resolveGuestSubscriberWith({secret:process.env.TIMELINE_FOLLOW_SIGNING_SECRET,findSubscription:async id=>(await db.select().from(timelineGuestSubscriptions).where(eq(timelineGuestSubscriptions.id,id)).limit(1))[0]??null,resolveDigest:resolveAudienceTimelineDigest},proof,purpose,allowUnsubscribed);
}
export async function unsubscribeGuestSubscriber(proof:string):Promise<FollowResult>{
 const current=await resolveGuestSubscriber(proof,'unsubscribe');if(!current)return {ok:false,code:'link_unavailable',message:'This follow link is unavailable.'};
 const [{db},{randomBytes,randomUUID}]=await Promise.all([import('./db/timeline-client'),import('node:crypto')]);const undo=randomBytes(32).toString('base64url'),now=new Date(),until=new Date(now.getTime()+10000),store=createGuestFollowStore(db);const {guestDigest}=await import('./guest-services');
 if(!await store.update(current.subscription.id,current.subscription.deliveryAttemptId,{state:'unsubscribed',undoTokenHash:guestDigest(undo),undoUntil:until,deliveryAttemptId:randomUUID(),updatedAt:now}))return {ok:false,code:'request_conflict',message:'This request changed.'};return {ok:true,state:'unsubscribed',undoToken:undo,undoUntil:until.toISOString()};
}
export async function undoGuestSubscriber(proof:string,key:string):Promise<FollowResult>{
 const current=await resolveGuestSubscriber(proof,'unsubscribe',true);if(!current)return {ok:false,code:'link_unavailable',message:'This follow link is unavailable.'};
 const [{db},{guestDigest},{hashesEqual},{randomUUID}]=await Promise.all([import('./db/timeline-client'),import('./guest-services'),import('../lib/audience-timeline'),import('node:crypto')]);const r=current.subscription,now=new Date();if(!/^[A-Za-z0-9_-]{43}$/.test(key)||r.state!=='unsubscribed'||!r.undoTokenHash||!hashesEqual(guestDigest(key),r.undoTokenHash)||!r.undoUntil||r.undoUntil<=now)return {ok:false,code:'undo_expired',message:'Undo is no longer available.'};
 if(!await createGuestFollowStore(db).update(r.id,r.deliveryAttemptId,{state:'confirmed',undoTokenHash:null,undoUntil:null,updatedAt:now,deliveryAttemptId:randomUUID()}))return {ok:false,code:'request_conflict',message:'This request changed.'};return {ok:true,state:'confirmed'};
}
export async function handleSignedGuestMutation(request:Request,operation:'unsubscribe'|'undo'){
 try{if(request.method!=='POST')return error('method_not_allowed','Use POST.',405);const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return error('origin_invalid','This request could not be verified.',403);const text=await boundedGuestText(request,2048);if(text===null)return error('request_too_large','This request is too large.',413);const body=JSON.parse(text);if(!body||typeof body.proof!=='string'||Object.keys(body).some(k=>!['proof','key'].includes(k)))return error('request_invalid','This request could not be read.');const result=operation==='unsubscribe'?await unsubscribeGuestSubscriber(body.proof):await undoGuestSubscriber(body.proof,body.key??'');return Response.json(result,{status:result.ok?200:400,headers});}catch{return error('service_unavailable','This service is unavailable right now.',503);}
}
export async function handleGuestReminders(request:Request):Promise<Response>{
 const secret=process.env.CRON_SECRET,authorization=request.headers.get('authorization')??'';
 if(!secret)return error('delivery_unavailable','Reminder delivery is unavailable.',503);
 const {createHash,timingSafeEqual}=await import('node:crypto');const expected=createHash('sha256').update('Bearer '+secret).digest(),actual=createHash('sha256').update(authorization).digest();if(!timingSafeEqual(expected,actual))return error('unauthorized','This request is unavailable.',401);
 if(!['GET','POST'].includes(request.method))return error('method_not_allowed','Use GET or POST.',405);
 try{
  const [{db},{createGuestSubscriberLinks},{TIMELINE_PUBLIC_ORIGIN},{scheduleGuestReminders,dispatchDueGuestNotifications,createGuestNotificationTransport},{resolveAudienceTimelineDigest},{isDemoMode}]=await Promise.all([import('./db/timeline-client'),import('./guest-services'),import('@/lib/product-urls'),import('./guest-notifications'),import('./audience-timeline'),import('@/lib/access-mode')]);
  if(isDemoMode())return error('delivery_unavailable','Reminder delivery is unavailable.',503);
  const {cleanupGuestSubscriptions}=await import('./guest-services');const cleanup=await cleanupGuestSubscriptions(db);
  if(!guestSigningAvailable(process.env.TIMELINE_FOLLOW_SIGNING_SECRET))return Response.json({ok:true,cleanup,deliveryConfigured:false},{headers});
  const transport=await createGuestNotificationTransport();if(!transport.configured)return Response.json({ok:true,cleanup,deliveryConfigured:false},{headers});
  const now=new Date(),scheduled=await scheduleGuestReminders(db,now),delivery=await dispatchDueGuestNotifications({database:db,transport,links:createGuestSubscriberLinks({secret:process.env.TIMELINE_FOLLOW_SIGNING_SECRET,origin:TIMELINE_PUBLIC_ORIGIN}),authorize:async({shareTokenHash,publicationId}:{shareTokenHash:string;publicationId:string})=>(await resolveAudienceTimelineDigest(shareTokenHash,publicationId)).kind==='ok',limit:20});
  return Response.json({ok:true,cleanup,scheduled,delivery},{headers});
 }catch{return error('service_unavailable','Reminder delivery is unavailable right now.',503);}
}
/** Server composition helper: no network request and no private-preview fallback. */
export async function getTimelineGuestServices(shareToken:string):Promise<GuestTimelineServices|null>{
 // Optional guest services must never take the readable public artifact down.
 try{const {TIMELINE_PUBLIC_ORIGIN}=await import('@/lib/product-urls');const response=await handleTimelineGuestRequest(new Request(TIMELINE_PUBLIC_ORIGIN+'/api/timeline/share/'+encodeURIComponent(shareToken)+'/services'),shareToken,'services');return response.ok?await response.json():null;}catch{return null;}
}
