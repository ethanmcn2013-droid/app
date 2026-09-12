import type { Metadata } from "next";
import { ProjectConversationPrototype } from "@/components/app/messages/prototype-shell";

export const metadata: Metadata = {
  title: "Project conversation prototype · Signal Studio",
  robots: { index: false, follow: false },
};

export default function ProjectConversationLabPage() {
  return <ProjectConversationPrototype />;
}
