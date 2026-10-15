import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";

export type ChatNavigationTarget = Readonly<{ projectId?: ProjectId; projectName?: string; rootId?: string; messageId?: string; messageSeq?: number; demoId?: string }>;
const identifier = (value: string | null): value is string => value !== null && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);

/** Shape checks only. The authenticated server still authorizes every read. */
export function parseFloatingChatTarget(params: URLSearchParams): ChatNavigationTarget | null {
  if (params.toString().length > 2_048) return null;
  const allowed = new Set(["projectId", "rootId", "messageId", "messageSeq", "c"]);
  const keys = [...params.keys()];
  if (keys.some((key) => !allowed.has(key)) || new Set(keys).size !== keys.length) return null;
  const projectId = params.has("projectId") ? parseProjectId(params.get("projectId")) : undefined;
  const rootId = params.get("rootId"); const messageId = params.get("messageId"); const demoId = params.get("c"); const seq = params.get("messageSeq");
  if ((params.has("projectId") && !projectId) || (rootId !== null && !identifier(rootId)) || (messageId !== null && !identifier(messageId)) ||
      (demoId !== null && !identifier(demoId)) || ((rootId !== null || messageId !== null) && !projectId) ||
      (seq !== null && (!messageId || !/^[1-9]\d{0,14}$/.test(seq))) || (demoId !== null && projectId)) return null;
  return { ...(projectId ? { projectId } : {}), ...(rootId ? { rootId } : {}), ...(messageId ? { messageId } : {}),
    ...(seq ? { messageSeq: Number(seq) } : {}), ...(demoId ? { demoId } : {}) };
}

export function chatNavigationKey(version: number, target: ChatNavigationTarget): string {
  return JSON.stringify([version, target.projectId ?? null, target.rootId ?? null, target.messageId ?? null, target.messageSeq ?? null]);
}

export function shouldFocusChatTarget(input: { visible: boolean; ready: boolean; targetId?: string; found: boolean; alreadyFocused: boolean; requestedRoot?: string; currentRoot: string | null }): boolean {
  return input.visible && input.ready && !!input.targetId && input.found && !input.alreadyFocused && (!input.requestedRoot || input.currentRoot === input.requestedRoot);
}
