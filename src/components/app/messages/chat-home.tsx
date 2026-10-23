"use client";

import type { ReactNode } from "react";
import { ChatList, ProjectTile, type ChatListItem } from "./chat-ui";
import { NoteTile, PingTile } from "./chat-marks";
import { useHiddenConversations } from "./use-hidden-conversations";

export type ChatHomeTarget = "ping" | "self" | `project:${string}`;

/**
 * The panel's one list: Ping and Saved notes first (yours alone), then each
 * Project's conversation. A row opens one view; each view has a way back.
 */
export function ChatHome({ actorId, projects, assistantEnabled, actions, onOpen, demo = false, projectsNotice }: {
  actorId: string;
  projects: readonly { id: string; name: string }[];
  assistantEnabled: boolean;
  /** Review mode: one seeded team chat stands in for Project conversations. */
  demo?: boolean;
  actions?: ReactNode;
  /** Shown instead of the Project list when it could not load. */
  projectsNotice?: ReactNode;
  onOpen: (target: ChatHomeTarget) => void;
}) {
  const hidden = useHiddenConversations(actorId);
  const available = demo ? [{ id: "demo", name: "Team chat" }] : projects;
  const yours: ChatListItem[] = [
    ...(assistantEnabled ? [{ id: "ping", title: "Ping", leading: <PingTile size={36} />, preview: "Plans, tasks and catch-ups · only you see what you ask" }] : []),
    { id: "self", title: "Saved notes", leading: <NoteTile size={36} />, preview: "Only you can see this" },
  ];
  const rooms: ChatListItem[] = available.filter((project) => !hidden.hidden.includes(project.id)).map((project) => ({ id: `project:${project.id}`, title: project.name, leading: <ProjectTile id={project.id} name={project.name} size={36} />, preview: demo ? "Preview conversations" : "Project conversation", onHide: () => hidden.hide(project.id) }));
  const restored: ChatListItem[] = available.filter((project) => hidden.hidden.includes(project.id)).map((project) => ({ id: `restore:${project.id}`, title: `Show ${project.name}`, leading: <ProjectTile id={project.id} name={project.name} size={36} />, preview: "Restore to your Chat list" }));
  return <ChatList title="Chat" headerAction={actions} sections={[
    { id: "yours", label: "Yours", items: yours },
    { id: "projects", label: "Projects", items: rooms, empty: projectsNotice ?? (restored.length ? "Your Project conversations are hidden." : "Add a Project to start a Project conversation.") },
    ...(restored.length ? [{ id: "hidden", label: "Hidden conversations", items: restored }] : []),
  ]} onSelect={(id) => id.startsWith("restore:") ? hidden.restore(id.slice("restore:".length)) : onOpen(id as ChatHomeTarget)} />;
}
