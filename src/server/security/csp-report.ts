const TEXT_DECODER = new TextDecoder();

export async function readBoundedRequestText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("csp-report-too-large");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return TEXT_DECODER.decode(combined);
}

/** Reduce a potentially sensitive CSP URI to a scheme/origin category. */
export function safeCspUri(value: string | undefined): string {
  if (!value) return "unknown";
  const normalized = value.trim().toLowerCase();
  for (const special of ["inline", "eval", "self", "data", "blob", "about"]) {
    if (normalized === special || normalized.startsWith(`${special}:`)) {
      return special;
    }
  }
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "other";
  }
}

export function safeCspDirective(value: string | undefined): string {
  const directive = value?.trim().split(/\s+/, 1)[0] ?? "";
  return /^[a-z][a-z0-9-]{0,63}$/i.test(directive)
    ? directive.toLowerCase()
    : "unknown";
}
