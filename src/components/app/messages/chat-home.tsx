"use client";

import type { ReactNode } from "react";
import { ChatList, ProjectTile, type ChatListItem } from "./chat-ui";
import { NoteTile, PingTile } from "./chat-marks";

export type ChatHomeTarget = "ping" | "self" | `project:${string}`;

/**
 * The panel's one list: Ping and Saved notes first (yours alone), then each
 * Project's conversation. A row opens one view; each view has a way back.
 */
export function ChatHome({ projects, assistantEnabled, actions, onOpen, demo = false, projectsNotice }: {
  projects: readonly { id: string; name: string }[];
  assistantEnabled: boolean;
  /** Review mode: one seeded team chat stands in for Project conversations. */
  demo?: boolean;
  actions?: ReactNode;
  /** Shown instead of the Project list when it could not load. */
  projectsNotice?: ReactNode;
  onOpen: (target: ChatHomeTarget) => void;
}) {
  const yours: ChatListItem[] = [
    ...(assistantEnabled ? [{ id: "ping", title: "Ping", leading: <PingTile size={36} />, preview: "Plans, tasks and catch-ups · only you see what you ask" }] : []),
    { id: "self", title: "Saved notes", leading: <NoteTile size={36} />, preview: "Only you can see this" },
  ];
  const rooms: ChatListItem[] = demo ? [{ id: "project:demo", title: "Team chat", leading: <ProjectTile id="demo" name="Team chat" size={36} />, preview: "Preview conversations" }] : projects.map((project) => ({ id: `project:${project.id}`, title: project.name, leading: <ProjectTile id={project.id} name={project.name} size={36} />, preview: "Project conversation" }));
  return <ChatList title="Chat" headerAction={actions} sections={[
    { id: "yours", label: "Yours", items: yours },
    { id: "projects", label: "Projects", items: rooms, empty: projectsNotice ?? "Add a Project to start a Project conversation." },
  ]} onSelect={(id) => onOpen(id as ChatHomeTarget)} />;
}
