export function isTerminalTaskTransition(
  kind: string,
  payload: unknown,
): boolean {
  const value = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  return (kind === "toggleComplete" || kind === "move") && value.to === "done";
}
