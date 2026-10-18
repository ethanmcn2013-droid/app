import {handleSignedGuestMutation} from '@/modules/timeline/server/guest-http';
export const dynamic='force-dynamic';export async function POST(request:Request){return handleSignedGuestMutation(request,'undo');}
