import {notFound} from 'next/navigation';
import {resolveAudienceTimeline} from '@/modules/timeline/server/audience-timeline';
import {TimelineFollowAction} from '@/modules/timeline/components/artifact/timeline-follow';
export const dynamic='force-dynamic';export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{key?:string}>}){const {token}=await params;const {key}=await searchParams;if(!key||! /^[A-Za-z0-9_-]{43}$/.test(key))notFound();const r=await resolveAudienceTimeline(token);if(r.kind!=='ok')notFound();return <TimelineFollowAction endpoint={'/api/timeline/share/'+encodeURIComponent(token)+'/unsubscribe'} undoEndpoint={'/api/timeline/share/'+encodeURIComponent(token)+'/undo'} linkKey={key} label='Stop following this timeline' actionLabel='Stop following'/>;}
