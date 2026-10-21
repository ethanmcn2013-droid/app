import "server-only";

import type { AssistantPlannerContext, AssistantRequest } from "@/lib/ping/assistant/contract";
import type { AssistantSource, AssistantSourceScope } from "@/lib/ping/assistant/release2";
import { isProjectId } from "@/lib/projects/project-ref";
import type { ProjectId } from "@/lib/projects/project-ref";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
import { createConversationService } from "@/server/conversations/service";
import { createTaskDiscussionService } from "@/server/conversations/task-discussion";
import { createMessageAttentionService, type DirectedAttention } from "@/server/conversations/attention";

const SOURCE_LIMIT = 30;
const SOURCE_CHARACTER_LIMIT = 24_000;
const PROJECT_CHAT_CHARACTER_LIMIT = 8_000;
const DIRECT_MESSAGE_CHARACTER_LIMIT = 8_000;
const NEEDS_YOU_CHARACTER_LIMIT = 8_000;
const MESSAGE_CHARACTER_LIMIT = 4_000;
const NEEDS_YOU_LIMIT = 10;
const ACCOUNT_PROJECT_LIMIT = 3;
const DIRECT_MESSAGE_LIMIT = 3;
const DIRECT_MESSAGE_CANDIDATE_LIMIT = 30;
const PROJECT_CHAT_MESSAGE_LIMIT = 8;
const DIRECT_MESSAGE_SOURCE_LIMIT = 12;
const DIRECT_MESSAGE_MESSAGE_LIMIT = 4;
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

function normalizedWords(value: string): string[] {
  return value.normalize("NFKC").toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function directMessageMatchesRequest(name: string, text: string): boolean {
  const requestWords = new Set(normalizedWords(text));
  return normalizedWords(name).some(word => word.length >= 3 && requestWords.has(word));
}

function boundedDisplayText(value: string, max: number): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (normalized.length <= max) return normalized;
  let prefix = normalized.slice(0, max - 1);
  if (/[\uD800-\uDBFF]$/.test(prefix)) prefix = prefix.slice(0, -1);
  return `${prefix.trimEnd()}…`;
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
    needsYou?: readonly AssistantNeedsYouItem[];
    needsYouTotal?: number;
    needsYouComplete?: boolean;
    needsYouState: "checked" | "not_checked" | "unavailable";
    selectedSource?: NonNullable<AssistantPlannerContext["selectedSource"]>;
    coverage: string;
  }> {
    const request = rawRequest as SourceRequest;
    const found: AssistantSource[] = [];
    const seen = new Set<string>();
    const refs = new Map<string, string>();
    let usedCharacters = 0;
    const usedBuckets = new Map<string, { count: number; characters: number }>();
    const projectConversationScopes = new Map<string, Promise<boolean>>();
    const projectAudiences = new Map<string, Promise<Awaited<ReturnType<typeof conversation.listProjectAudience>>>>();
    const dmAudiences = new Map<string, Promise<Awaited<ReturnType<typeof conversation.listDirectMessageAudience>>>>();
    const discussions = new Map<string, Promise<Awaited<ReturnType<typeof taskDiscussion.listProjectDiscussions>>>>();

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

    const add = (source: Omit<AssistantSource, "ref"> | null, bucket: "explicit" | "project" | "direct" | "needsYou" = "project") => {
      if (!source) return null;
      const key = sourceKey(source.kind, source.scopeId, source.itemId);
      if (seen.has(key)) return refs.get(key) ?? null;
      if (found.length >= SOURCE_LIMIT) return null;
      const current = usedBuckets.get(bucket) ?? { count: 0, characters: 0 };
      const countLimit = bucket === "explicit" ? SOURCE_LIMIT : bucket === "needsYou" ? NEEDS_YOU_LIMIT : bucket === "project" ? PROJECT_CHAT_MESSAGE_LIMIT : DIRECT_MESSAGE_SOURCE_LIMIT;
      const characterLimit = bucket === "explicit" ? SOURCE_CHARACTER_LIMIT : bucket === "needsYou" ? NEEDS_YOU_CHARACTER_LIMIT : bucket === "project" ? PROJECT_CHAT_CHARACTER_LIMIT : DIRECT_MESSAGE_CHARACTER_LIMIT;
      const length = source.body.length;
      if (usedCharacters + length > SOURCE_CHARACTER_LIMIT || current.count >= countLimit || current.characters + length > characterLimit) return null;
      const ref = `source-${found.length + 1}`;
      const next = { ...source, ref };
      found.push(next);
      seen.add(key);
      refs.set(key, ref);
      usedCharacters += length;
      usedBuckets.set(bucket, { count: current.count + 1, characters: current.characters + length });
      return ref;
    };

    async function loadConversation(projectId: string, conversationId: string, beforeCreateSeq?: number, rootId?: string | null, limit = SOURCE_LIMIT) {
      if (!isProjectId(projectId) || !PROJECT_ID_PATTERN.test(conversationId)) return [] as Omit<AssistantSource, "ref">[];
      const projectThread = await isProjectConversation(projectId, conversationId);
      if (!projectThread) {
        if (options.directMessagesEnabled !== true) return [] as Omit<AssistantSource, "ref">[];
        const dm = await conversation.getDirectMessage({ actorId, projectId, conversationId });
        if (!dm.ok || dm.value.canRead !== true || dm.value.lifecycle !== "active") return [] as Omit<AssistantSource, "ref">[];
      }
      const page = await conversation.getMessagePage({ actorId, projectId, conversationId, limit, ...(beforeCreateSeq ? { beforeCreateSeq } : {}), ...(rootId ? { rootId } : {}) });
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
      const listed = await listProjectDiscussions(projectId);
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

    function listProjectDiscussions(projectId: string) {
      let pending = discussions.get(projectId);
      if (!pending) { pending = taskDiscussion.listProjectDiscussions({ actorId, projectId }); discussions.set(projectId, pending); }
      return pending;
    }

    async function selectedSourceDescriptor(projectId: string, scope: AssistantSourceScope) {
      if (!isProjectId(projectId)) throw new AssistantContextUnavailableError();
      if (scope.kind === "task_discussion") {
        const listed = await listProjectDiscussions(projectId);
        if (!listed.ok) throw new AssistantContextUnavailableError();
        const task = listed.value.find(item => item.taskId === scope.taskId);
        if (!task) throw new AssistantContextUnavailableError();
        return { kind: "task_discussion" as const, label: boundedDisplayText(`Task discussion: ${task.title}`, 300) };
      }

      const projectThread = await isProjectConversation(projectId, scope.conversationId);
      if (!projectThread) {
        if (options.directMessagesEnabled !== true) throw new AssistantContextUnavailableError();
        const dm = await conversation.getDirectMessage({ actorId, projectId, conversationId: scope.conversationId });
        if (!dm.ok || dm.value.canRead !== true || dm.value.lifecycle !== "active") throw new AssistantContextUnavailableError();
        const audience = await conversation.listDirectMessageAudience({ actorId, projectId, conversationId: scope.conversationId });
        if (!audience.ok) throw new AssistantContextUnavailableError();
        const participants = audience.value.members.slice(0, 20).map(member => boundedDisplayText(member.id === actorId ? "You" : member.name, 120));
        return { kind: "conversation" as const, label: boundedDisplayText(`Direct message with ${dm.value.other.name}`, 300), participants };
      }

      const room = await conversation.getProjectConversation({ actorId, projectId: projectId as ProjectId });
      if (!room.ok || !room.value || room.value.conversationId !== scope.conversationId || room.value.lifecycle !== "active") throw new AssistantContextUnavailableError();
      const audience = await conversation.listProjectAudience({ actorId, projectId });
      if (!audience.ok) throw new AssistantContextUnavailableError();
      return { kind: "conversation" as const, label: boundedDisplayText(`Project conversation: ${room.value.projectName}`, 300),
        participants: audience.value.members.slice(0, 20).map(member => boundedDisplayText(member.id === actorId ? "You" : member.name, 120)) };
    }

    async function loadProjectDirectMessages(projectId: ProjectId, requestText: string): Promise<{ included: number; status: "checked" | "disabled" | "unavailable" | "not_run" }> {
      if (options.directMessagesEnabled !== true) return { included: 0, status: "disabled" };
      if (found.length >= SOURCE_LIMIT) return { included: 0, status: "not_run" };
      const listed = await conversation.listDirectMessages({ actorId, projectId, limit: DIRECT_MESSAGE_CANDIDATE_LIMIT });
      if (!listed.ok) return { included: 0, status: "unavailable" };
      const eligible = listed.value.filter(dm => dm.canRead && dm.lifecycle === "active");
      const named = eligible.filter(dm => directMessageMatchesRequest(dm.other.name, requestText));
      const chosen = [...named, ...eligible.filter(dm => !named.some(item => item.conversationId === dm.conversationId))].slice(0, DIRECT_MESSAGE_LIMIT);
      let loadedCount = 0;
      for (const dm of chosen) {
        if (found.length >= SOURCE_LIMIT) break;
        const sources = await loadConversation(projectId, dm.conversationId, undefined, null, DIRECT_MESSAGE_MESSAGE_LIMIT);
        let included = false;
        for (const source of sources) included = add(source, "direct") !== null || included;
        if (included) loadedCount += 1;
      }
      return { included: loadedCount, status: "checked" };
    }

    const needsYou: AssistantNeedsYouItem[] = [];
    let needsYouTotal = 0;
    let needsYouComplete = true;
    let needsYouState: "checked" | "not_checked" | "unavailable" = "not_checked";
    let selectedSource: NonNullable<AssistantPlannerContext["selectedSource"]> | undefined;
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
      for (const source of sources) add(source, "explicit");
      if (!found.length) throw new AssistantContextUnavailableError();
      selectedSource = await selectedSourceDescriptor(request.scope.projectId, request.source);
      coverage = "Only the explicitly selected conversation or task discussion was searched.";
    } else {
      // Load Needs-you first so broad history searches cannot consume the
      // source budget needed for the user's actual requests.
      const attentionResult = await attention.listDirected({ actorId, limit: 50 });
      const directed: readonly DirectedAttention[] = attentionResult.ok ? attentionResult.value : [];
      needsYouState = attentionResult.ok ? "checked" : "unavailable";
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
        const ref = source ? add(source, "needsYou") : null;
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
          for (const source of await loadConversation(selectedProjectId, scope.value.conversationId, undefined, null, PROJECT_CHAT_MESSAGE_LIMIT)) add(source, "project");
        }
        const directMessages = await loadProjectDirectMessages(selectedProjectId, request.text);
        const needsYouCoverage = needsYouState === "checked" ? `up to ${NEEDS_YOU_LIMIT} Needs-you items were searched` : "Needs-you could not be checked";
        const directMessageCoverage = directMessages.status === "checked"
          ? `up to ${DIRECT_MESSAGE_CANDIDATE_LIMIT} recent direct-message candidates were checked`
          : directMessages.status === "disabled" ? "direct-message search is disabled"
            : directMessages.status === "not_run" ? "direct-message search was not run because the context limit was reached"
              : "direct-message search was unavailable";
        coverage = `Recent messages from the selected project (up to ${PROJECT_CHAT_MESSAGE_LIMIT}); ${needsYouCoverage}; ${directMessageCoverage}. Only active consented messages are included, capped at ${DIRECT_MESSAGE_LIMIT} threads and ${DIRECT_MESSAGE_SOURCE_LIMIT} messages${directMessages.included ? ` (${directMessages.included} direct messages included)` : ""}.`;
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
        const directMessageSearches: Array<{ included: number; status: "checked" | "disabled" | "unavailable" | "not_run" }> = [];
        for (const project of selected) {
          if (found.length >= SOURCE_LIMIT) break;
          for (const source of await loadConversation(project.id, project.conversationId, undefined, null, PROJECT_CHAT_MESSAGE_LIMIT)) add(source, "project");
          directMessageSearches.push(await loadProjectDirectMessages(project.id, request.text));
        }
        const named = selected.some(project => isNamedInRequest(project.name));
        const needsYouCoverage = needsYouState === "checked" ? `Needs-you: up to ${NEEDS_YOU_LIMIT} of ${needsYouTotal} current entries` : "Needs-you could not be checked";
        const checkedDirectMessageSearches = directMessageSearches.filter(result => result.status === "checked").length;
        const unavailableDirectMessageSearches = directMessageSearches.filter(result => result.status === "unavailable").length;
        const disabledDirectMessageSearches = directMessageSearches.filter(result => result.status === "disabled").length;
        const notRunDirectMessageSearches = directMessageSearches.filter(result => result.status === "not_run").length;
        const directMessageCoverage = checkedDirectMessageSearches === directMessageSearches.length && directMessageSearches.length > 0
          ? `up to ${DIRECT_MESSAGE_CANDIDATE_LIMIT} recent direct-message candidates were checked in ${checkedDirectMessageSearches} selected projects`
          : unavailableDirectMessageSearches > 0
            ? `direct-message search was unavailable in ${unavailableDirectMessageSearches} selected projects${disabledDirectMessageSearches ? ` and disabled in ${disabledDirectMessageSearches}` : ""}`
            : disabledDirectMessageSearches > 0 ? "direct-message search is disabled"
              : notRunDirectMessageSearches > 0 ? "direct-message search was not run for some selected projects because the context limit was reached"
                : "direct-message search was not run";
        const includedDirectMessages = directMessageSearches.reduce((sum, result) => sum + result.included, 0);
        coverage = `${needsYouCoverage}; account search selected ${selected.length} of up to ${catalog.length} authorized active projects as candidates; source limits may stop before all selected projects are read, with up to ${PROJECT_CHAT_MESSAGE_LIMIT} project-chat messages per project; ${directMessageCoverage}. Only active consented messages are included, capped at ${DIRECT_MESSAGE_LIMIT} threads and ${DIRECT_MESSAGE_SOURCE_LIMIT} messages${includedDirectMessages ? ` (${includedDirectMessages} direct messages included)` : ""}${named ? ", including projects named in the request" : ""}.`;
        if (selected.length < Math.min(ACCOUNT_PROJECT_LIMIT, catalog.length)) coverage += " Some projects had no readable active conversation.";
      }
    }

    return { sources: found, ...(needsYouState === "checked" ? { needsYou, needsYouTotal, needsYouComplete } : {}),
      needsYouState, ...(selectedSource ? { selectedSource } : {}), coverage };
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
