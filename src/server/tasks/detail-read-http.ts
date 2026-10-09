import "server-only";

type Section = "subtasks" | "resources" | "conversation";

type Readers = Readonly<{
  subtasks: (taskId: string) => Promise<unknown>;
  resources: (taskId: string) => Promise<unknown>;
  conversation: (taskId: string) => Promise<unknown>;
}>;

const MAX_BODY_BYTES = 512;
// Stored Task ids may be explicitly supplied by older writers. The streamed
// request limit bounds them without adding a new charset/length constraint.
const validTaskId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function refusal(status: number): Response {
  return new Response(null, { status, headers: PRIVATE_HEADERS });
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Each request invokes the existing action's live identity and stored-task fences. */
export function createTaskDetailReadHttp(readers: Readers) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.search || url.hash) return refusal(405);
    if (request.headers.get("origin") !== url.origin ||
        request.headers.get("sec-fetch-site") !== "same-origin") return refusal(403);
    if (request.headers.get("content-type")?.toLowerCase() !== "application/json") return refusal(415);
    const declared = request.headers.get("content-length");
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) return refusal(413);

    let input: unknown;
    try {
      const text = await readBoundedBody(request);
      if (text === null) return refusal(413);
      input = JSON.parse(text);
    } catch {
      return refusal(400);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) return refusal(400);
    const fields = Object.keys(input);
    if (fields.length !== 2 || !fields.includes("section") || !fields.includes("taskId")) return refusal(400);
    const body = input as Record<string, unknown>;
    if ((body.section !== "subtasks" && body.section !== "resources" && body.section !== "conversation") ||
        !validTaskId(body.taskId)) return refusal(400);

    try {
      const value = await readers[body.section as Section](body.taskId);
      return Response.json({ value }, { headers: PRIVATE_HEADERS });
    } catch {
      return refusal(500);
    }
  };
}
