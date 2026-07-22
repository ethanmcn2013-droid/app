"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signalHref } from "./links";
import type { ScopeOption } from "./signal-types";

interface ContextSidebarProps {
  scopes: ScopeOption[];
  activeScope: { type: string; id: string; workspaceId: string };
}

export function ContextSidebar({ scopes, activeScope }: ContextSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace =
    scopes.find((scope) => scope.kind === "workspace" && scope.id === activeScope.workspaceId) ??
    scopes.find((scope) => scope.kind === "workspace");
  const projects = scopes.filter(
    (scope) => scope.kind === "project" && scope.workspaceId === activeScope.workspaceId,
  );

  function scopeHref(scopeType: string, scopeId: string, workspaceId: string) {
    return signalHref(pathname, searchParams, {
      scope_type: scopeType,
      scope_id: scopeId,
      workspace_id: workspaceId,
      evidence: null,
      evidence_page: null,
      page: null,
    });
  }

  return (
    <aside className="signal-context-sidebar" aria-label="Signal context">
      <span className="signal-sidebar-label">Context</span>
      <ul className="signal-context-list">
        {workspace ? (
          <li>
            <Link
              className="signal-context-link"
              href={scopeHref("workspace", workspace.id, workspace.id)}
              aria-current={activeScope.type === "workspace" ? "page" : undefined}
            >
              <span>All work</span>
              {workspace.count !== undefined ? (
                <span className="signal-context-count">{workspace.count}</span>
              ) : null}
            </Link>
          </li>
        ) : null}
        {workspace ? (
          <li>
            <Link
              className="signal-context-link"
              href={scopeHref("user", "me", workspace.id)}
              aria-current={activeScope.type === "user" ? "page" : undefined}
            >
              My work
            </Link>
          </li>
        ) : null}
      </ul>

      {projects.length > 0 ? (
        <>
          <span className="signal-sidebar-label" style={{ display: "block", marginTop: "var(--space-7)" }}>
            Projects
          </span>
          <ul className="signal-project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  className="signal-context-link"
                  href={scopeHref("project", project.id, project.workspaceId)}
                  aria-current={
                    activeScope.type === "project" && activeScope.id === project.id
                      ? "page"
                      : undefined
                  }
                >
                  <span>{project.label}</span>
                  {project.count !== undefined ? (
                    <span className="signal-context-count">{project.count}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}
