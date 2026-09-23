/** EX-02 test process only. Never mounted as a Next route or deployed. */
import { createServer } from "node:http";
import { openConversationSpikeStore } from "./transaction-store.mjs";

const store = await openConversationSpikeStore({ databasePath: process.argv[2], foreignKeys: false });
const stats = { readRequests: 0, sendRequests: 0, refused: 0, failures: 0 };
let previousOperation = Promise.resolve();
let queued = 0;
async function onConnection(operation) {
  if (queued >= 256) throw new Error("synthetic_capacity_reached");
  queued++;
  const previous = previousOperation;
  let release;
  previousOperation = new Promise((resolve) => { release = resolve; });
  await previous;
  try { return await operation(); } finally { queued--; release(); }
}
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Content-Type", "application/json");
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    let result;
    // Actor headers are synthetic fixtures, NOT authentication. Real Clerk is untested.
    if (request.method === "GET" && url.pathname === "/changes") {
      stats.readRequests++;
      result = await onConnection(() => store.readChanges({
        actorId: String(request.headers["x-fixture-actor"] ?? ""),
        projectId: url.searchParams.get("projectId"), conversationId: url.searchParams.get("conversationId"),
        afterChangeSeq: Number(url.searchParams.get("afterChangeSeq") ?? 0), limit: 100,
      }));
    } else if (request.method === "POST" && url.pathname === "/send") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 65_536) throw new Error("too_large");
      }
      stats.sendRequests++;
      result = await onConnection(() => store.send(JSON.parse(body)));
    } else if (request.method === "GET" && url.pathname === "/stats") {
      result = { ...stats, store: store.counters };
    } else { response.statusCode = 404; result = { ok: false, code: "unavailable" }; }
    if (result.ok === false) stats.refused++;
    response.end(JSON.stringify(result));
  } catch {
    stats.failures++;
    response.statusCode = 500;
    response.end(JSON.stringify({ ok: false, code: "temporarily_unavailable" }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.send?.({ port: server.address().port, pid: process.pid });
process.on("message", (message) => {
  if (message === "close") {
    server.close(() => { store.close(); process.exit(0); });
    server.closeIdleConnections();
  }
});
process.on("disconnect", () => { server.close(); store.close(); process.exit(0); });
