/** Local synthetic browser harness. Never imported by an application route. */
import { createServer, request as proxyRequest } from "node:http";
import { connect } from "node:net";
import { Readable } from "node:stream";
import { mkdir, mkdtemp, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createClient } from "@libsql/client";
import { createLocalConversationDatabaseAdapter, type ConversationSqlExecutor } from "../../src/server/conversations/database";
import { createConversationService } from "../../src/server/conversations/service";
import { createConversationHttp } from "../../src/server/conversations/http";
import { resolveConversationControls } from "../../src/lib/conversations/flags";

const parentDirectory = process.argv[2];
if (!parentDirectory) throw new Error("An explicit synthetic output directory is required");
const port = Number(process.argv[3] ?? "3189");
const nextPort = Number(process.argv[4] ?? "3188");
if (![port, nextPort].every((value) => Number.isInteger(value) && value >= 1024 && value <= 65535)) throw new Error("Invalid local port");
await mkdir(resolve(parentDirectory), { recursive: true });
const directory = await mkdtemp(join(resolve(parentDirectory), "browser-fixture-"));
const databasePath = join(directory, "tasks.db").replaceAll("\\", "/");
const client = createClient({ url: `file:${databasePath}` });
await client.execute("PRAGMA foreign_keys=OFF");
await client.execute("PRAGMA journal_mode=WAL");
for (const migration of (await readdir("drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort()) {
  await client.executeMultiple(await readFile(join("drizzle", migration), "utf8"));
}
const people = [["synthetic_alice", "Alice Morgan", "AM"], ["synthetic_bob", "Maya Chen", "MC"], ["synthetic_charlie", "Theo Grant", "TG"]];
for (const [id, name, initials] of people) await client.execute({ sql: "INSERT INTO users(id,clerk_id,handle,name,color,initials) VALUES(?,?,?,?,?,?)", args: [id, `clerk_${id}`, id, name, "#4f46e5", initials] });
for (const [id, name] of [["synthetic_project_a", "Website launch"], ["synthetic_project_b", "Autumn exhibition"]]) {
  await client.execute({ sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES(?,?,?,'synthetic_alice','project',?,?)", args: [id, id, name, Date.now(), Date.now()] });
  for (const [actor] of people) await client.execute({ sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES(?,?,?,?)", args: [id, actor, actor === "synthetic_alice" ? "owner" : "member", Date.now()] });
}
const adapter = createLocalConversationDatabaseAdapter({ client: client as unknown as ConversationSqlExecutor });
const service = createConversationService(adapter);
let sendsEnabled = true;
const dropNextResponse = new Set<string>();
const origin = `http://127.0.0.1:${port}`;
const server = createServer(async (incoming, outgoing) => {
  const path = new URL(incoming.url ?? "/", origin);
  if (path.pathname === "/__fixture" && incoming.method === "POST") {
    // Only the explicit local test harness owns these controls, never the product UI.
    try {
      if (incoming.headers.origin && incoming.headers.origin !== origin) { outgoing.writeHead(403); outgoing.end(); return; }
      const action = path.searchParams.get("action");
      const actorId = path.searchParams.get("actorId");
      if (action === "sends-off" || action === "sends-on") sendsEnabled = action === "sends-on";
      else if (action === "lose-response" && people.some(([id]) => id === actorId)) dropNextResponse.add(actorId!);
      else if (action === "remove" && people.some(([id]) => id === actorId)) await adapter.transaction("write", (tx) => tx.execute({ sql: "DELETE FROM workspace_members WHERE workspace_id='synthetic_project_a' AND user_id=?", args: [actorId!] }));
      else { outgoing.writeHead(400); outgoing.end(); return; }
      outgoing.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); outgoing.end('{"ok":true}');
    } catch { outgoing.writeHead(500); outgoing.end(); }
    return;
  }
  if (path.pathname === "/api/conversations") {
    const fixtureActor = typeof incoming.headers["x-fixture-actor"] === "string" ? incoming.headers["x-fixture-actor"] : null;
    const handle = createConversationHttp({
      authenticate: async () => people.some(([id]) => id === fixtureActor) ? fixtureActor : null,
      controls: () => resolveConversationControls({ SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_INTERNAL_ACTOR_IDS: people.map(([id]) => id).join(","), SIGNAL_CONVERSATION_SEND_ENABLED: String(sendsEnabled) }),
      service: async () => service,
    });
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) if (value) requestHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
    const request = new Request(path, { method: incoming.method, headers: requestHeaders,
      ...(!["GET", "HEAD"].includes(incoming.method ?? "GET") ? { body: Readable.toWeb(incoming) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
    });
    const result = await handle(request);
    if (incoming.method === "POST" && result.ok && fixtureActor && dropNextResponse.delete(fixtureActor)) {
      outgoing.destroy(); return; // The service has committed; the browser must reconcile the original ID.
    }
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    outgoing.end(Buffer.from(await result.arrayBuffer())); return;
  }
  const forwarded = proxyRequest({ hostname: "127.0.0.1", port: nextPort, path: incoming.url, method: incoming.method, headers: incoming.headers }, (result) => {
    outgoing.writeHead(result.statusCode ?? 502, result.headers); result.pipe(outgoing);
  });
  forwarded.on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end("Local preview is starting"); });
  incoming.pipe(forwarded);
});
server.on("upgrade", (request, socket, head) => {
  const upstream = connect(nextPort, "127.0.0.1", () => {
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${Object.entries(request.headers).map(([key, value]) => `${key}: ${value}`).join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream); upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy()); socket.on("error", () => upstream.destroy());
});
server.listen(port, "127.0.0.1", () => process.stdout.write(JSON.stringify({ origin, directory, synthetic: true, nextPort }) + "\n"));
process.on("SIGINT", () => server.close(() => { client.close(); process.exit(0); }));
