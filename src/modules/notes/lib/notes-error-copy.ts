/** Keep app-authored recovery guidance, but never show framework diagnostics as Notes copy. */
export function friendlyError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;

  // Production Server Action failures can arrive as a React diagnostic rather
  // than the server's safe message. The capture caller retains the exact words
  // for retry; showing the existing fallback states that truth without a raw
  // framework error or a diagnostic URL in the notebook.
  if (
    /^Minified React error #\d+\b/i.test(message) ||
    /^An error occurred in the Server Components render\b/i.test(message) ||
    /^NEXT_(?:REDIRECT|NOT_FOUND)\b/.test(message)
  ) {
    return fallback;
  }
  return message;
}
