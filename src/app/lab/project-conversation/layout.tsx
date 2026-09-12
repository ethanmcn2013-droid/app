import { Suspense, type ReactNode } from "react";
import { ConversationLabSession } from "@/components/app/messages/conversation-lab-session";

export default function ConversationLabLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p>Opening preview…</p>}><ConversationLabSession>{children}</ConversationLabSession></Suspense>;
}
