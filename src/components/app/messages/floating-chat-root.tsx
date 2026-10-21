"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { ProjectId } from "@/lib/projects/project-ref";
import { isBareChromePath } from "@/lib/bare-artifact-path";
import { ConversationWorkspace } from "./conversation-workspace";
import { DemoMessagesApp } from "./demo-messages-app";
import type { DemoMessagesSnapshot } from "./demo-messages-model";
import { PersonalChat } from "./personal-chat";
import dynamic from "next/dynamic";
const PingPersonalAssistant = dynamic(() => import("./ping-personal-assistant").then(module => module.PingPersonalAssistant));
import { ChatHeader, ChatIcon } from "./chat-ui";
import styles from "./floating-chat.module.css";
import { parseFloatingChatTarget, type ChatNavigationTarget } from "./chat-navigation";
import { ChatCatalogUnavailable } from "./chat-catalog-unavailable";
import { useFloatingChatViewport } from "./use-floating-chat-viewport";
import { ChatHome, type ChatHomeTarget } from "./chat-home";

type RequestedConversation = ChatNavigationTarget;
type ChatContext = { registerPage: (node: HTMLDivElement | null, requested?: RequestedConversation, unavailable?: boolean) => void };
const Context = createContext<ChatContext | null>(null);
const mobileQuery = "(max-width: 679px)";
const subscribeMobile = (notify: () => void) => { const media = window.matchMedia(mobileQuery); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };

export function FloatingChatPage(props: RequestedConversation & { catalogUnavailable?: boolean }) {
  const context = useContext(Context);
  const node = useRef<HTMLDivElement>(null);
  const { projectId, projectName, rootId, messageId, messageSeq, demoId, catalogUnavailable } = props;
  useLayoutEffect(() => {
    context?.registerPage(node.current, { projectId, projectName, rootId, messageId, messageSeq, demoId }, catalogUnavailable);
    return () => context?.registerPage(null);
  }, [context, projectId, projectName, rootId, messageId, messageSeq, demoId, catalogUnavailable]);
  return <div className={styles.pageAnchor} ref={node}><h1 className={styles.srOnly}>Chat</h1>{!context ? <p>Chat is unavailable. Reload to try again.</p> : null}</div>;
}

/** Uses Clerk's already-loaded client identity; no extra server profile request. */
export function AuthenticatedFloatingChatRoot(props: Parameters<typeof FloatingChatRoot>[0]) {
  const { user } = useUser();
  return <FloatingChatRoot {...props} actorName={user?.fullName || props.actorName} />;
}

export function FloatingChatRoot({ actorId, actorName, projects, directMessagesEnabled, demoSnapshot, children, catalogUnavailable = false, assistantEnabled = false }: {
  actorId: string; actorName: string; projects: readonly { id: ProjectId; name: string }[];
  directMessagesEnabled?: boolean; demoSnapshot?: DemoMessagesSnapshot; children: ReactNode; catalogUnavailable?: boolean; assistantEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  // One view at a time: the list, a Project conversation, Saved notes or Ping.
  const [view, setView] = useState<"home" | "project" | "self" | "ping">("home");
  const [assistantStarted, setAssistantStarted] = useState(false);
  const activeTab = view === "ping" && !assistantEnabled ? "home" : view;
  const [requested, setRequested] = useState<RequestedConversation>({});
  const [navigationVersion, setNavigationVersion] = useState(0);
  const router = useRouter();
  const [catalogRetrying, startCatalogRetry] = useTransition();
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const [pageCatalogUnavailable, setPageCatalogUnavailable] = useState(false);
  const [bounds, setBounds] = useState<CSSProperties | undefined>();
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const bare = isBareChromePath(pathname ?? "");
  const visible = !bare && (open || !!page);
  const viewportBounds = useFloatingChatViewport(visible && !page);
  const availableProjects = requested.projectId && requested.projectName && !projects.some((project) => project.id === requested.projectId)
    ? [...projects, { id: requested.projectId, name: requested.projectName }] : projects;
  const registerPage = useCallback((node: HTMLDivElement | null, next?: RequestedConversation, unavailable?: boolean) => {
    setPage(node);
    setPageCatalogUnavailable(!!node && !!unavailable);
    if (node) { setStarted(true); setOpen(true); if (next && Object.values(next).some((value) => value !== undefined)) { setRequested(next); setNavigationVersion((version) => version + 1); setView("project"); } }
  }, []);
  const [context] = useState(() => ({ registerPage }));
  useLayoutEffect(() => {
    if (!page) return;
    const measure = () => { const rect = page.getBoundingClientRect(); setBounds({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(page);
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [page]);

  const show = useCallback((next?: RequestedConversation) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (next) { setRequested(next); if (Object.values(next).some((value) => value !== undefined)) { setNavigationVersion((version) => version + 1); setView("project"); } }
    setStarted(true); setOpen(true);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button, textarea")?.focus());
  }, []);
  const close = () => { setOpen(false); requestAnimationFrame(() => { if (trigger.current?.isConnected && trigger.current.getClientRects().length) trigger.current.focus(); else launcher.current?.focus(); }); };

  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.hasAttribute("data-chat-full-page")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== location.origin || url.pathname !== "/app/messages") return;
      const target = parseFloatingChatTarget(url.searchParams);
      if (!target) return;
      // A Project outside the current authorized catalog follows the server
      // route, which can authorize archived history or refuse it explicitly.
      if (target.projectId && !projects.some((project) => project.id === target.projectId)) return;
      event.preventDefault();
      show(target);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [show, projects]);

  useEffect(() => {
    const element = document.documentElement;
    if (!visible || page) return;
    element.dataset.floatingChatOpen = "true";
    const measure = () => {
      const rect = panel.current?.getBoundingClientRect();
      element.style.setProperty("--signal-floating-chat-width", `${rect?.width ?? 500}px`);
      // Notifications on narrow screens fit above the actual panel, including
      // when the visual keyboard moves it without changing its width.
      element.style.setProperty("--signal-floating-chat-top", `${Math.max(0, rect?.top ?? 0)}px`);
    };
    measure(); const observer = new ResizeObserver(measure); if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      delete element.dataset.floatingChatOpen;
      element.style.removeProperty("--signal-floating-chat-width");
      element.style.removeProperty("--signal-floating-chat-top");
    };
  }, [visible, page, viewportBounds]);

  const homeRef = useRef<HTMLDivElement>(null);
  // Back returns to the list with focus on the row you came from.
  const lastRow = useRef<string | null>(null);
  const goHome = () => { setView("home"); requestAnimationFrame(() => { const row = lastRow.current ? homeRef.current?.querySelector<HTMLElement>(`[data-conversation-row="${CSS.escape(lastRow.current)}"]`) : null; (row ?? homeRef.current?.querySelector<HTMLElement>("button"))?.focus(); }); };
  const openTarget = (target: ChatHomeTarget) => {
    lastRow.current = target;
    if (target === "ping") { setAssistantStarted(true); setView("ping"); }
    else if (target === "self") setView("self");
    else if (target === "project:demo") setView("project");
    else { const projectId = target.slice("project:".length) as ProjectId; const project = availableProjects.find((value) => value.id === projectId); setRequested({ projectId, projectName: project?.name }); setNavigationVersion((version) => version + 1); setView("project"); }
  };
  const panelActions = !page ? <span className={styles.headActions}><Link aria-label="Open chat in full view" data-chat-full-page href="/app/messages" title="Full view"><ChatIcon.panel /></Link><button aria-label="Close chat" onClick={close} title="Close chat · your draft stays here" type="button"><ChatIcon.close /></button></span> : null;

  return <Context.Provider value={context}>{children}
    {!bare && !visible ? <button aria-label="Open chat" title="Open chat" className={styles.launcher} onClick={() => show()} ref={launcher} type="button"><ChatIcon.thread size={22} /></button> : null}
    {mobile && visible && !page ? <button aria-label="Close chat" className={styles.scrim} onClick={close} tabIndex={-1} type="button" /> : null}
    {started ? <div aria-label="Chat" aria-modal={mobile && !page ? true : undefined} id={page ? "app-main-content" : undefined} className={styles.panel} data-full={page ? "" : undefined} data-assistant={activeTab === "ping" ? "" : undefined} hidden={!visible} inert={!visible} onKeyDown={(event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !page) close();
      if (event.key === "Tab" && mobile && !page && !(event.target as Element).closest("dialog[open]")) {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),summary,[tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }} ref={panel} role={page ? "main" : mobile ? "dialog" : "region"} style={page ? bounds : viewportBounds} tabIndex={-1}>
      <div className={styles.body} hidden={activeTab !== "home"} inert={activeTab !== "home"} ref={homeRef}><ChatHome actions={panelActions} assistantEnabled={assistantEnabled} demo={!!demoSnapshot} projects={demoSnapshot || catalogUnavailable || pageCatalogUnavailable ? [] : availableProjects} onOpen={openTarget}
        projectsNotice={!demoSnapshot && (catalogUnavailable || pageCatalogUnavailable) ? <ChatCatalogUnavailable retrying={catalogRetrying} onRetry={() => startCatalogRetry(() => router.refresh())} /> : undefined} /></div>
      <div className={styles.body} hidden={activeTab !== "project"} inert={activeTab !== "project"}>{demoSnapshot
        ? <div className={styles.stack}><ChatHeader panel onBack={goHome} backLabel="All chats" title="Team chat" subtitle="Preview · nothing here is saved" actions={panelActions} /><DemoMessagesApp embedded requestedConversationId={requested.demoId} snapshot={demoSnapshot} visible={visible && activeTab === "project"} /></div>
        : catalogUnavailable || pageCatalogUnavailable ? <ChatCatalogUnavailable className={styles.personalIntro} retrying={catalogRetrying} onRetry={() => startCatalogRetry(() => router.refresh())} />
        : <ConversationWorkspace actorId={actorId} directMessagesEnabled={directMessagesEnabled} initialProjectId={requested.projectId} initialRootId={requested.rootId} initialMessageId={requested.messageId} initialMessageSeq={requested.messageSeq} navigationVersion={navigationVersion} projects={availableProjects} visible={visible && activeTab === "project"} stacked onBack={goHome} headerActions={panelActions} />}</div>
      {assistantEnabled && assistantStarted ? <div className={styles.body} hidden={activeTab !== "ping"} inert={activeTab !== "ping"}><PingPersonalAssistant key={actorId} actorId={actorId} projects={availableProjects} visible={visible && activeTab === "ping"} onBack={goHome} actions={panelActions} /></div> : null}
      <div className={styles.body} hidden={activeTab !== "self"} inert={activeTab !== "self"}><PersonalChat actorId={actorId} actorName={actorName} demo={!!demoSnapshot} visible={visible && activeTab === "self"} onBack={goHome} actions={panelActions} /></div>
    </div> : null}
  </Context.Provider>;
}
