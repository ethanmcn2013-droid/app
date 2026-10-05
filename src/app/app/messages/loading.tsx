import { ChatSkeleton } from "@/components/app/messages/chat-ui";

/** The conversation frame, drawn at once while the conversations load. */
export default function MessagesLoading() {
  return <ChatSkeleton />;
}
