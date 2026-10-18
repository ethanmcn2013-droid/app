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
import { ChatIcon } from "./chat-ui";
import styles from "./floating-chat.module.css";
import { parseFloatingChatTarget, type ChatNavigationTarget } from "./chat-navigation";
import { ChatCatalogUnavailable } from "./chat-catalog-unavailable";
import { useFloatingChatViewport } from "./use-floating-chat-viewport";

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

export function FloatingChatRoot({ actorId, actorName, projects, directMessagesEnabled, demoSnapshot, children, catalogUnavailable = false }: {
  actorId: string; actorName: string; projects: readonly { id: ProjectId; name: string }[];
  directMessagesEnabled?: boolean; demoSnapshot?: DemoMessagesSnapshot; children: ReactNode; catalogUnavailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [tab, setTab] = useState<"project" | "self">("project");
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
    if (node) { setStarted(true); setOpen(true); if (next && Object.values(next).some((value) => value !== undefined)) { setRequested(next); setNavigationVersion((version) => version + 1); setTab("project"); } }
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
    if (next) { setRequested(next); if (Object.values(next).some((value) => value !== undefined)) setNavigationVersion((version) => version + 1); setTab("project"); }
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
    const measure = () => element.style.setProperty("--signal-floating-chat-width", `${panel.current?.getBoundingClientRect().width ?? 760}px`);
    measure(); const observer = new ResizeObserver(measure); if (panel.current) observer.observe(panel.current);
    return () => { observer.disconnect(); delete element.dataset.floatingChatOpen; element.style.removeProperty("--signal-floating-chat-width"); };
  }, [visible, page]);

  return <Context.Provider value={context}>{children}
    {!bare && !visible ? <button aria-label="Open chat" title="Open chat" className={styles.launcher} onClick={() => show()} ref={launcher} type="button"><ChatIcon.thread size={22} /></button> : null}
    {mobile && visible && !page ? <button aria-label="Close chat" className={styles.scrim} onClick={close} tabIndex={-1} type="button" /> : null}
    {started ? <div aria-label="Chat" aria-modal={mobile && !page ? true : undefined} id={page ? "app-main-content" : undefined} className={styles.panel} data-full={page ? "" : undefined} hidden={!visible} inert={!visible} onKeyDown={(event) => {
      if (event.key === "Escape" && !event.defaultPrevented && !page) close();
      if (event.key === "Tab" && mobile && !page && !(event.target as Element).closest("dialog[open]")) {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],textarea:not(:disabled),summary,[tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }} ref={panel} role={page ? "main" : mobile ? "dialog" : "region"} style={page ? bounds : viewportBounds} tabIndex={-1}>
      <div className={styles.head}><div className={styles.tabs} aria-label="Chat type"><button aria-pressed={tab === "project"} onClick={() => setTab("project")} type="button">Conversations</button><button aria-pressed={tab === "self"} onClick={() => setTab("self")} type="button">{actorName} <span>(you)</span></button></div><div className={styles.headActions}>{!page ? <Link aria-label="Open chat in full view" data-chat-full-page href="/app/messages" title="Full view"><ChatIcon.panel /></Link> : null}{!page ? <button aria-label="Close chat" onClick={close} title="Close chat · your draft stays here" type="button"><ChatIcon.close /></button> : null}</div></div>
      <div className={styles.body} hidden={tab !== "project"} inert={tab !== "project"}>{demoSnapshot
        ? <DemoMessagesApp embedded requestedConversationId={requested.demoId} snapshot={demoSnapshot} visible={visible && tab === "project"} />
        : catalogUnavailable || pageCatalogUnavailable ? <ChatCatalogUnavailable className={styles.personalIntro} retrying={catalogRetrying} onRetry={() => startCatalogRetry(() => router.refresh())} />
        : <ConversationWorkspace actorId={actorId} directMessagesEnabled={directMessagesEnabled} initialProjectId={requested.projectId} initialRootId={requested.rootId} initialMessageId={requested.messageId} initialMessageSeq={requested.messageSeq} navigationVersion={navigationVersion} projects={availableProjects} visible={visible && tab === "project"} />}</div>
      <div className={styles.body} hidden={tab !== "self"} inert={tab !== "self"}><PersonalChat actorId={actorId} actorName={actorName} demo={!!demoSnapshot} visible={visible && tab === "self"} /></div>
    </div> : null}
  </Context.Provider>;
}
