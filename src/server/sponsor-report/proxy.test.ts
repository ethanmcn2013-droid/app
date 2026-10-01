import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { proxySponsorReport, readInvitationBody, sameOriginJsonPost } from "./proxy";

const secret = "synthetic-report-assertion-secret-over-32-characters";
const config = { origin: "http://localhost:3001", secret, enabled: true, now: 1_790_000_000_000 };
test("Clerk actor is freshly asserted to the exact Studio report route", async () => {
  let seen = false;
  const response = await proxySponsorReport({ actor: "clerk-synthetic", programmeId: "programme1",
    month: "2026-06", kind: "report", format: "html", method: "GET" }, { ...config, send: async request => {
    seen = true;
    assert.equal(request.url, "http://localhost:3001/api/sponsor-programmes/programme1/reports/2026-06?format=html");
    const token = request.headers.get("authorization")!.slice(7);
    const [encoded, signature] = token.split(".");
    assert.equal(signature, createHmac("sha256", secret).update(encoded).digest("base64url"));
    assert.deepEqual(JSON.parse(Buffer.from(encoded, "base64url").toString()),
      { v: 1, aud: "signal-studio.sponsor-report", sub: "clerk-synthetic", iat: 1_790_000_000, exp: 1_790_000_300 });
    return new Response("<p>synthetic report</p>", { status: 200, headers: { "Content-Type": "text/html" } });
  } });
  assert.equal(response.status, 200); assert.equal(seen, true);
  assert.equal(response.headers.get("Content-Security-Policy"), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
});
test("proxy refuses missing identity, disabled programme, unexpected origins and excess invitation body", async () => {
  let sent = 0;
  const send = async () => { sent++; return Response.json({ ok: true }); };
  assert.equal((await proxySponsorReport({ actor: "", programmeId: "p", kind: "invitations", method: "GET" }, { ...config, send })).status, 401);
  assert.equal((await proxySponsorReport({ actor: "clerk", programmeId: "p", kind: "invitations", method: "GET" }, { ...config, enabled: false, send })).status, 503);
  assert.equal((await proxySponsorReport({ actor: "clerk", programmeId: "p", kind: "invitations", method: "GET" }, { ...config, origin: "https://evil.test/path", send })).status, 503);
  assert.equal((await proxySponsorReport({ actor: "clerk", programmeId: "p", kind: "invitations", method: "POST", body: "x".repeat(2049) }, { ...config, send })).status, 400);
  assert.equal(await readInvitationBody(new Request("http://app.test", { method: "POST", body: "x".repeat(2049) })), null);
  assert.equal(sent, 0);
});
test("cookie-backed POST requires exact same origin and JSON media type", () => {
  const request = (origin: string | null, type: string) => new Request("https://app.signalstudio.ie/api/settings/sponsor-measurement",
    { method: "POST", body: '{"enabled":false}', headers: {
      ...(origin ? { Origin: origin } : {}), "Content-Type": type,
    } });
  assert.equal(sameOriginJsonPost(request("https://app.signalstudio.ie", "application/json; charset=utf-8")), true);
  assert.equal(sameOriginJsonPost(request("https://other.example", "application/json")), false);
  assert.equal(sameOriginJsonPost(request(null, "application/json")), false);
  assert.equal(sameOriginJsonPost(request("https://app.signalstudio.ie", "text/plain")), false);
});
test("oversized Studio responses stop at the byte bound", async () => {
  let cancelled = false;
  const response = await proxySponsorReport({ actor: "clerk", programmeId: "p", month: "2026-06", kind: "report", method: "GET" },
    { ...config, send: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(256_001)); },
      cancel() { cancelled = true; },
    }), { headers: { "Content-Type": "application/json" } }) });
  assert.equal(response.status, 503);
  assert.equal(cancelled, true);
});
