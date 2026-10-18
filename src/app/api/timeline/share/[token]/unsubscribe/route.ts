import {handleTimelineGuestRequest} from '@/modules/timeline/server/guest-http';
export const dynamic='force-dynamic';export const revalidate=0;
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){const {token}=await params;return handleTimelineGuestRequest(request,token,'unsubscribe');}
