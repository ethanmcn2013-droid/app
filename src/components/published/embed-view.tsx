import { PRIORITY_LABEL } from "@/lib/data";
import type { PublicTask } from "@/lib/data";
import {
  publicBoardColumns,
  publicColumnTasks,
  type PublicColumn,
} from "@/lib/public-board-lanes";
import type { PublishedWorkspaceProps } from "./types";

/**
 * Compact, lane-grouped task list for the iframe embed. Visually
 * distinct from the four full domain themes: no hero, no glow, no
 * brand chrome, just the workspace name as a chip header, lane
 * sections (capped at 6 tasks each with a "+ N more" overflow), and
 * a quiet "Made with Tasks" link in the bottom-right that opens the
 * full `/p/{slug}` page in a new tab.
 *
 * Targets ~480px tall by default. Background is transparent so the
 * embed inherits from whatever host page it lives on.
 */

const TASKS_PER_LANE = 6;

export function EmbedView({ workspace, tasks, columns }: PublishedWorkspaceProps) {
  const boardColumns: PublicColumn[] = columns ?? publicBoardColumns(null, tasks);
  const byColumn = new Map<string, PublicTask[]>(
    boardColumns.map((column) => [column.id, publicColumnTasks(tasks, column.id)]),
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: "100%",
        color: "#14151a",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          color: "#8b8e98",
          letterSpacing: "0.01em",
        }}
      >
        <span style={{ fontWeight: 600, color: "#14151a" }}>
          {workspace.name}
        </span>
        <span aria-hidden>·</span>
        <span>published {fmtShort(workspace.publishedAt)}</span>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {boardColumns.map((column) => {
          const list = byColumn.get(column.id) ?? [];
          if (list.length === 0) return null;
          const visible = list.slice(0, TASKS_PER_LANE);
          const overflow = list.length - visible.length;
          return (
            <section key={column.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: column.accent ?? "#c8cad1",
                  }}
                  aria-hidden
                />
                <h2
                  style={{
                    margin: 0,
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "#8b8e98",
                  }}
                >
                  {column.name}
                </h2>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "#c8cad1",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  · {list.length}
                </span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {visible.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      padding: "5px 0",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: PRIORITY_LABEL[t.priority].color,
                        transform: "translateY(-1px)",
                      }}
                      aria-hidden
                      title={PRIORITY_LABEL[t.priority].label}
                    />
                    <span
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.35,
                        color: "#14151a",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </span>
                    {t.due ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#8b8e98",
                          flexShrink: 0,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {t.due}
                      </span>
                    ) : null}
                  </li>
                ))}
                {overflow > 0 ? (
                  <li
                    style={{
                      fontSize: 11,
                      color: "#8b8e98",
                      padding: "4px 0 2px 14px",
                    }}
                  >
                    + {overflow} more
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      <footer
        style={{
          marginTop: "auto",
          paddingTop: 12,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <a
          href={`/p/${workspace.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 10.5,
            color: "#8b8e98",
            textDecoration: "none",
            letterSpacing: "0.04em",
          }}
        >
          Made with Tasks &rarr;
        </a>
      </footer>
    </div>
  );
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
