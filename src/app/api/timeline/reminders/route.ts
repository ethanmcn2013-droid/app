import { handleGuestReminders } from "@/modules/timeline/server/guest-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const GET = handleGuestReminders;
