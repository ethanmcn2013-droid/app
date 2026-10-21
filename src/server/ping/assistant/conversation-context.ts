import "server-only";

import type { AssistantRequest } from "@/lib/ping/assistant/contract";
import type { AssistantSource, AssistantSourceScope } from "@/lib/ping/assistant/release2";
import { isProjectId } from "@/lib/projects/project-ref";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
import { createConversationService } from "@/server/conversations/service";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { createMessageAttentionService, type DirectedAttention } from "@/server/conversations/attention";

const SOURCE_LIMIT = 30;
const SOURCE_CHARACTER_LIMIT = 24_000;
const MESSAGE_CHARACTER_LIMIT = 4_000;
const NEEDS_YOU_LIMIT = 10;
const ACCOUNT_PROJECT_LIMIT = 3;
const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export class AssistantContextUnavailableError extends Error {
  constructor() { super("assistant_context_unavailable"); this.name = "AssistantContextUnavailableError"; }
}

export type AssistantNeedsYouItem = Readonly<{
  ref: string;
  projectName: string;
  unseen: boolean;
  createdAt: string;
}>;

type SourceRequest = AssistantRequest & Readonly<{ source?: AssistantSourceScope }>;
type Services = Readonly<{
  conversation: ReturnType<typeof createConversationService>;
  taskDiscussion: ReturnType<typeof createTaskDiscussionService>;
  attention: ReturnType<typeof createMessageAttentionService>;
}>;

function validSourceScope(value: unknown): value is AssistantSourceScope {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  if (source.kind === "conversation") return typeof source.conversationId === "string" && PROJECT_ID_PATTERN.test(source.conversationId);
  if (source.kind === "task_discussion") return typeof source.taskId === "string" && PROJECT_ID_PATTERN.test(source.taskId);
  return false;
}

function messageHref(projectId: string, itemId: string, createSeq: number, rootId: string | null, directConversationId?:string): string {
  const query = new URLSearchParams({ projectId, messageId: itemId, messageSeq: String(createSeq) });
  if (rootId) query.set("rootId", rootId);
  if(directConversationId)query.set('conversationId',directConversationId);
  return `/app/messages?${query.toString()}`;
}

function commentHref(projectId: string, itemId: string): string {
  return `/app/task/${encodeURIComponent(projectId)}#comment-${encodeURIComponent(itemId)}`;
}

function safeText(value: unknown, max = MESSAGE_CHARACTER_LIMIT): string | null {
  if (typeof value !== "string") return null;
  if (!value.trim() || value.length > max) return null;
  return value;
}

function iso(timestamp: number, unit: "ms" | "seconds" = "ms"): string {
  const value = unit === "seconds" ? timestamp * 1_000 : timestamp;
  return Number.isFinite(value) ? new Date(value).toISOString() : new Date(0).toISOString();
}

function sourceKey(kind: AssistantSource["kind"], scopeId: string, itemId: string): string {
  return `${kind}\u0000${scopeId}\u0000${itemId}`;
}

/**
 * Builds a bounded, authorized source pack using the same conversation services
 * as the chat UI. Reading context never opens or creates a discussion.
 */
export function createAssistantConversationContext(adapter: ConversationDatabaseAdapter, options: { directMessagesEnabled?: boolean } = {}) {
  return createAssistantConversationContextFromServices({
    conversation: createConversationService(adapter, { directMessagesEnabled: options.directMessagesEnabled === true }),
    taskDiscussion: createTaskDiscussionService(adapter),
    attention: createMessageAttentionService(adapter),
  }, options);
}

/** The injectable variant keeps tests on the canonical service interfaces. */
export function createAssistantConversationContextFromServices(services: Services, options: { directMessagesEnabled?: boolean } = {}) {
  const { conversation, taskDiscussion, attention } = services;

  async function load(actorId: string, rawRequest: AssistantRequest): Promise<{
    sources: readonly AssistantSource[];
    needsYou: readonly AssistantNeedsYouItem[];
    needsYouTotal: number;
    needsYouComplete: boolean;
    coverage: string;
  }> {
    const request = rawRequest as SourceRequest;
    const found: AssistantSource[] = [];
    const seen = new Set<string>();
    const refs = new Map<string, string>();
    let usedCharacters = 0;
    const projectConversationScopes = new Map<string, Promise<boolean>>();
    const projectAudiences = new Map<string, Promise<Awaited<ReturnType<typeof conversation.listProjectAudience>>>>();
    const dmAudiences = new Map<string, Promise<Awaited<ReturnType<typeof conversation.listDirectMessageAudience>>>>();

    async function isProjectConversation(projectId: string, conversationId: string) {
      const key = `${projectId}\u0000${conversationId}`;
      let pending = projectConversationScopes.get(key);
      if (!pending) {
        pending = conversation.getProjectConversation({ actorId, projectId: projectId as ProjectId })
          .then(result => result.ok && result.value?.conversationId === conversationId);
        projectConversationScopes.set(key, pending);
      }
      return pending;
    }

    const add = (source: Omit<AssistantSource, "ref"> | null) => {
      if (!source) return null;
      const key = sourceKey(source.kind, source.scopeId, source.itemId);
      if (seen.has(key)) return refs.get(key) ?? null;
      if (found.length >= SOURCE_LIMIT) return null;
      const length = source.body.length;
      if (usedCharacters + length > SOURCE_CHARACTER_LIMIT) return null;
      const ref = `source-${found.length + 1}`;
      const next = { ...source, ref };
      found.push(next);
      seen.add(key);
      refs.set(key, ref);
      usedCharacters += length;
      return ref;
    };

    async function loadConversation(projectId: string, conversationId: string, beforeCreateSeq?: number, rootId?: string | null) {
      if (!isProjectId(projectId) || !PROJECT_ID_PATTERN.test(conversationId)) return [] as Omit<AssistantSource, "ref">[];
      const projectThread = await isProjectConversation(projectId, conversationId);
      if (!projectThread) {
        if (options.directMessagesEnabled !== true) return [] as Omit<AssistantSource, "ref">[];
        const dm = await conversation.getDirectMessage({ actorId, projectId, conversationId });
        if (!dm.ok || dm.value.canRead !== true || dm.value.lifecycle !== "active") return [] as Omit<AssistantSource, "ref">[];
      }
      const page = await conversation.getMessagePage({ actorId, projectId, conversationId, limit: SOURCE_LIMIT, ...(beforeCreateSeq ? { beforeCreateSeq } : {}), ...(rootId ? { rootId } : {}) });
      if (!page.ok) return [] as Omit<AssistantSource, "ref">[];
      const audienceKey = `${projectId}\u0000${conversationId}`;
      if (projectThread && !projectAudiences.has(audienceKey)) projectAudiences.set(audienceKey, conversation.listProjectAudience({ actorId, projectId }));
      if (!projectThread && !dmAudiences.has(audienceKey)) dmAudiences.set(audienceKey, conversation.listDirectMessageAudience({ actorId, projectId, conversationId }));
      const members = projectThread ? await projectAudiences.get(audienceKey)! : await dmAudiences.get(audienceKey)!;
      const names = new Map(members.ok ? members.value.members.map(member => [member.id, member.name]) : []);
      return page.value.messages.flatMap(message => {
        const body = safeText(message.body);
        if (!body || message.deletedAt !== null) return [];
        return [{ kind: "conversation" as const, projectId, scopeId: conversationId, itemId: message.id,
          revision: message.revision, audienceEpoch: page.value.audienceEpoch, body,
          authorName: message.authorId ? names.get(message.authorId) ?? "Project member" : "Project member",
          createdAt: iso(message.createdAt), href: messageHref(projectId, message.id, message.createSeq, message.rootId,projectThread?undefined:conversationId),
          ...((message.rootId ?? rootId) ? { rootId: message.rootId ?? rootId! } : {}) }];
      });
    }

    async function loadTaskDiscussion(projectId: string, taskId: string, beforeCreateSeq?: number) {
      if (!PROJECT_ID_PATTERN.test(projectId) || !PROJECT_ID_PATTERN.test(taskId)) return [] as AssistantSource[];
      // This list proves the task belongs to the requested, currently authorized project.
      if (!isProjectId(projectId)) return [] as Omit<AssistantSource, "ref">[];
      const listed = await taskDiscussion.listProjectDiscussions({ actorId, projectId });
      if (!listed.ok || !listed.value.some(task => task.taskId === taskId)) return [] as Omit<AssistantSource, "ref">[];
      const page = await taskDiscussion.getCommentPage({ actorId, taskId, limit: SOURCE_LIMIT, ...(beforeCreateSeq ? { beforeCreateSeq } : {}) });
      if (!page.ok) return [] as AssistantSource[];
      return page.value.comments.flatMap(comment => {
        const body = safeText(comment.body);
        if (!body || comment.deletedAt !== null) return [];
        return [{ kind: "task_discussion" as const, projectId, scopeId: taskId, itemId: comment.id,
          revision: comment.revision, audienceEpoch: page.value.audienceEpoch, body,
          authorName: comment.authorName, createdAt: iso(comment.createdAt, "seconds"), href: commentHref(taskId, comment.id) }];
      });
    }

    const needsYou: AssistantNeedsYouItem[] = [];
    let needsYouTotal = 0;
    let needsYouComplete = true;
    let coverage = "";

    // A mention inside a conversation is strictly scoped to that source. It
    // must never pick up another chat or an unrelated Needs-you item.
    if (request.source) {
      if (request.scope.kind !== "project" || !validSourceScope(request.source) || !isProjectId(request.scope.projectId)) {
        throw new AssistantContextUnavailableError();
      }
      const sources = request.source.kind === "conversation"
        ? await loadConversation(request.scope.projectId, request.source.conversationId, undefined, request.source.rootId ?? null)
        : await loadTaskDiscussion(request.scope.projectId, request.source.taskId);
      if (!sources.length) throw new AssistantContextUnavailableError();
      for (const source of sources) add(source);
      if (!found.length) throw new AssistantContextUnavailableError();
      coverage = "Only the explicitly selected conversation or task discussion was searched.";
    } else {
      // Load Needs-you first so broad history searches cannot consume the
      // source budget needed for the user's actual requests.
      const attentionResult = await attention.listDirected({ actorId, limit: 50 });
      const directed: readonly DirectedAttention[] = attentionResult.ok ? attentionResult.value : [];
      const selectedProjectId = request.scope.kind === "project" && isProjectId(request.scope.projectId) ? request.scope.projectId : null;
      if (request.scope.kind === "project" && !selectedProjectId) throw new AssistantContextUnavailableError();
      const scoped = selectedProjectId ? directed.filter(item => item.projectId === selectedProjectId) : directed;
      const candidates = scoped.slice(0, NEEDS_YOU_LIMIT);
      needsYouTotal = scoped.length;

      for (const item of candidates) {
        if (found.length >= SOURCE_LIMIT) break;
        const context = item.kind === "conversation"
          ? await loadConversation(item.projectId, item.scopeId, item.createSeq + 1, item.rootId ?? item.itemId)
          : await loadTaskDiscussion(item.projectId, item.scopeId, item.createSeq + 1);
        const source = context.find(candidate => candidate.itemId === item.itemId);
        const ref = source ? add(source) : null;
        if (ref) needsYou.push({ ref, projectName: item.projectName, unseen: item.seenAt === null, createdAt: iso(item.createdAt) });
      }
      needsYouComplete = scoped.length < 50 && scoped.length <= NEEDS_YOU_LIMIT && needsYou.length === scoped.length;

      const requestedText = request.text.normalize("NFKC").toLocaleLowerCase();
      const isNamedInRequest = (name: string) => {
        const normalized = name.normalize("NFKC").toLocaleLowerCase().trim();
        return normalized.length >= 3 && requestedText.includes(normalized);
      };

      if (selectedProjectId) {
        const scope = await conversation.getProjectConversation({ actorId, projectId: selectedProjectId });
        if (scope.ok && scope.value?.kind === "project" && scope.value.lifecycle === "active") {
          projectConversationScopes.set(`${selectedProjectId}\u0000${scope.value.conversationId}`, Promise.resolve(true));
          for (const source of await loadConversation(selectedProjectId, scope.value.conversationId)) add(source);
        }
        coverage = "Recent messages from the selected project and its top 10 Needs-you items were searched.";
      } else {
        const projects = await conversation.listProjects({ actorId });
        const catalog = projects.ok ? projects.value : [];
        const attentionProjects = new Set(candidates.map(item => item.projectId));
        const explicitlyNamed = catalog.filter(project => isNamedInRequest(project.name));
        const ranked = [...explicitlyNamed,
          ...catalog.filter(project => attentionProjects.has(project.id) && !explicitlyNamed.some(value => value.id === project.id)),
          ...catalog.filter(project => !explicitlyNamed.some(value => value.id === project.id) && !attentionProjects.has(project.id))];
        const selected: Array<{ id: ProjectId; name: string; conversationId: string }> = [];
        for (const project of ranked) {
          if (selected.length >= ACCOUNT_PROJECT_LIMIT) break;
          const scope = await conversation.getProjectConversation({ actorId, projectId: project.id });
          if (scope.ok && scope.value?.kind === "project" && scope.value.lifecycle === "active") {
            selected.push({ id: project.id, name: project.name, conversationId: scope.value.conversationId });
            projectConversationScopes.set(`${project.id}\u0000${scope.value.conversationId}`, Promise.resolve(true));
          }
        }
        for (const project of selected) {
          if (found.length >= SOURCE_LIMIT) break;
          for (const source of await loadConversation(project.id, project.conversationId)) add(source);
          if (options.directMessagesEnabled !== true || found.length >= SOURCE_LIMIT) continue;
          const direct = await conversation.listDirectMessages({ actorId, projectId: project.id });
          if (!direct.ok) continue;
          let matchingChats = 0;
          for (const dm of direct.value.slice(0, 20)) {
            if (!dm.canRead || dm.lifecycle !== "active" || !isNamedInRequest(dm.other.name)) continue;
            const items = await loadConversation(project.id, dm.conversationId);
            if (items.length) matchingChats += 1;
            for (const source of items) add(source);
            if (matchingChats >= 2 || found.length >= SOURCE_LIMIT) break;
          }
        }
        const named = selected.some(project => isNamedInRequest(project.name));
        coverage = `Needs-you: up to ${NEEDS_YOU_LIMIT} of ${needsYouTotal} current entries; account search: recent messages from ${selected.length} of up to ${catalog.length} authorized active projects${named ? ", including projects named in the request" : ""}.`;
        if (selected.length < Math.min(ACCOUNT_PROJECT_LIMIT, catalog.length)) coverage += " Some projects had no readable active conversation.";
      }
    }

    return { sources: found, needsYou, needsYouTotal, needsYouComplete, coverage };
  }

  async function validate(actorId: string, sources: readonly AssistantSource[]): Promise<boolean> {
    if (!Array.isArray(sources) || sources.length > SOURCE_LIMIT) return false;
    const conversationPages = new Map<string, Promise<Awaited<ReturnType<typeof conversation.getMessagePage>>>>();
    const projectScopes = new Map<string, Promise<boolean>>();
    const directMessageScopes = new Map<string, Promise<boolean>>();
    const discussionMemberships = new Map<string, Promise<Awaited<ReturnType<typeof taskDiscussion.listProjectDiscussions>>>>();
    const discussionPages = new Map<string, Promise<Awaited<ReturnType<typeof taskDiscussion.getCommentPage>>>>();
    for (const source of sources) {
      if (!source || !PROJECT_ID_PATTERN.test(source.projectId) || !PROJECT_ID_PATTERN.test(source.scopeId) ||
          !PROJECT_ID_PATTERN.test(source.itemId) || !Number.isSafeInteger(source.revision) || source.revision < 1 ||
          !Number.isSafeInteger(source.audienceEpoch) || source.audienceEpoch < 1 || typeof source.body !== "string") return false;
      if (source.kind === "conversation") {
        if (!isProjectId(source.projectId)) return false;
        let projectScope = projectScopes.get(`${source.projectId}\u0000${source.scopeId}`);
        if (!projectScope) {
          projectScope = conversation.getProjectConversation({ actorId, projectId: source.projectId })
            .then(result => result.ok && result.value?.conversationId === source.scopeId);
          projectScopes.set(`${source.projectId}\u0000${source.scopeId}`, projectScope);
        }
        const isProjectConversation = await projectScope;
        if (!isProjectConversation) {
          if (options.directMessagesEnabled !== true) return false;
          let dmScope = directMessageScopes.get(`${source.projectId}\u0000${source.scopeId}`);
          if (!dmScope) {
            dmScope = conversation.getDirectMessage({ actorId, projectId: source.projectId, conversationId: source.scopeId })
              .then(dm => dm.ok && dm.value.canRead === true && dm.value.lifecycle === "active");
            directMessageScopes.set(`${source.projectId}\u0000${source.scopeId}`, dmScope);
          }
          if (!await dmScope) return false;
        }
        const rootId = source.rootId;
        const key = `${source.projectId}\u0000${source.scopeId}\u0000${rootId}`;
        let pending = conversationPages.get(key);
        if (!pending) {
          pending = conversation.getMessagePage({ actorId, projectId: source.projectId, conversationId: source.scopeId, limit: 100,
            ...(rootId ? { rootId } : {}) });
          conversationPages.set(key, pending);
        }
        const page = await pending;
        if (!page.ok || page.value.audienceEpoch !== source.audienceEpoch) return false;
        const current = page.value.messages.find(message => message.id === source.itemId);
        if (!current || current.deletedAt !== null || current.revision !== source.revision || current.body !== source.body) return false;
      } else if (source.kind === "task_discussion") {
        if (!isProjectId(source.projectId)) return false;
        let members = discussionMemberships.get(source.projectId);
        if (!members) {
          members = taskDiscussion.listProjectDiscussions({ actorId, projectId: source.projectId });
          discussionMemberships.set(source.projectId, members);
        }
        const listed = await members;
        if (!listed.ok || !listed.value.some(task => task.taskId === source.scopeId)) return false;
        let pending = discussionPages.get(source.scopeId);
        if (!pending) {
          pending = taskDiscussion.getCommentPage({ actorId, taskId: source.scopeId, limit: 100 });
          discussionPages.set(source.scopeId, pending);
        }
        const page = await pending;
        if (!page.ok || page.value.audienceEpoch !== source.audienceEpoch) return false;
        const current = page.value.comments.find(comment => comment.id === source.itemId);
        if (!current || current.deletedAt !== null || current.revision !== source.revision || current.body !== source.body) return false;
      } else return false;
    }
    return true;
  }

  return { load, validate } as const;
}
