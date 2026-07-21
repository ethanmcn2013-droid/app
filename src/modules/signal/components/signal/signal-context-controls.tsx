"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signalHref } from "./links";
import type { FilterOption, ScopeOption } from "./signal-types";

interface SignalContextControlsProps {
  scopes: ScopeOption[];
  activeScope: { type: string; id: string; workspaceId: string };
  periodPreset: string;
  ownerOptions: FilterOption[];
  statusOptions: FilterOption[];
}

export function SignalContextControls({
  scopes,
  activeScope,
  periodPreset,
  ownerOptions,
  statusOptions,
}: SignalContextControlsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentScope = encodeScope(
    activeScope.type,
    activeScope.id,
    activeScope.workspaceId,
  );

  function update(overrides: Record<string, string | null>) {
    router.push(
      signalHref(pathname, searchParams, {
        ...overrides,
        evidence: null,
        evidence_page: null,
        page: null,
      }),
      { scroll: false },
    );
  }

  return (
    <div className="signal-controls" aria-label="Signal filters">
      <div className="signal-control">
        <label htmlFor="signal-scope">Scope</label>
        <select
          id="signal-scope"
          className="signal-select"
          value={currentScope}
          onChange={(event) => {
            const [scopeType, scopeId, workspaceId] = decodeScope(
              event.currentTarget.value,
            );
            update({
              scope_type: scopeType,
              scope_id: scopeId,
              workspace_id: workspaceId,
            });
          }}
        >
          {scopes.map((scope) => (
            <option
              key={`${scope.type}-${scope.id}`}
              value={encodeScope(scope.type, scope.id, scope.workspaceId)}
            >
              {scope.label}
            </option>
          ))}
        </select>
      </div>

      <div className="signal-control">
        <label htmlFor="signal-period">Period</label>
        <select
          id="signal-period"
          className="signal-select"
          value={periodPreset}
          onChange={(event) =>
            update({
              period: event.currentTarget.value,
              start: null,
              end: null,
            })
          }
        >
          <option value="four_weeks">Four weeks</option>
          <option value="twelve_weeks">Twelve weeks</option>
          <option value="six_months">Six months</option>
          <option value="twelve_months">Twelve months</option>
        </select>
      </div>

      {ownerOptions.length > 0 ? (
        <div className="signal-control">
          <label htmlFor="signal-owner">Owner</label>
          <select
            id="signal-owner"
            className="signal-select"
            value={searchParams.get("owner") ?? ""}
            onChange={(event) => update({ owner: event.currentTarget.value || null })}
          >
            <option value="">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner.value} value={owner.value}>
                {owner.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {statusOptions.length > 0 ? (
        <div className="signal-control">
          <label htmlFor="signal-status">Status</label>
          <select
            id="signal-status"
            className="signal-select"
            value={searchParams.get("status") ?? ""}
            onChange={(event) => update({ status: event.currentTarget.value || null })}
          >
            <option value="">All states</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function encodeScope(type: string, id: string, workspaceId: string): string {
  return JSON.stringify([type, id, workspaceId]);
}

function decodeScope(value: string): [string, string, string] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((item) => typeof item === "string")
    ) {
      return parsed as [string, string, string];
    }
  } catch {
    // A malformed option value cannot occur through the rendered control.
  }
  return ["workspace", "", ""];
}
