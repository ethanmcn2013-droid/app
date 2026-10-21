"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AssistantSourceScope } from "@/lib/ping/assistant/release2";
import { PingTile } from "./chat-marks";

type TaskPingSource = Extract<AssistantSourceScope, {kind:"task_discussion"}>;
type OpenTaskPing = (input: {source:TaskPingSource;projectId:string;trigger:HTMLElement}) => void;
const PrivatePingEntryContext=createContext<OpenTaskPing|null>(null);

export function PrivatePingEntryProvider({open,children}:{open:OpenTaskPing|null;children:ReactNode}){
  return <PrivatePingEntryContext.Provider value={open}>{children}</PrivatePingEntryContext.Provider>;
}

/** A private contextual entry point. It never intercepts or sends task comments. */
export function AskPingPrivatelyForTask({taskId,projectId}:{taskId:string;projectId:string}){
  const open=useContext(PrivatePingEntryContext);
  if(!open)return null;
  return <button type="button" className="mt-1 inline-flex min-h-8 items-center gap-2 rounded-lg border border-brand px-3 text-xs font-semibold text-brand hover:bg-bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    onClick={event=>open({source:{kind:"task_discussion",taskId},projectId,trigger:event.currentTarget})}>
    <PingTile size={18} /> Ask Ping privately
  </button>;
}
