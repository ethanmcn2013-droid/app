import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** A real service check, not an application feature or customer-account test. */
export async function probeRedis(config, { fetchImpl = fetch, sleep = delay } = {}) {
  const endpoint = new URL(config.url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/" || !config.token?.trim()) {
    throw new Error("Redis health configuration is invalid");
  }
  const key = `signal:health:weekly:${randomUUID()}`;
  const ttl = 15;
  let commands = 0;
  async function request(path, body) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl(`${endpoint.origin}${path}`, {
            method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: controller.signal,
          });
          if (!response.ok) throw new Error("Redis health request failed");
          return await response.json();
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Redis health request timed out")); }, 1500); }),
      ]);
    } catch { throw new Error("Redis health request unavailable"); }
    finally { clearTimeout(timer); }
  }
  for (let expected = 1; expected <= 3; expected++) {
    const data = await request("/multi-exec", [["INCR", key], ["EXPIRE", key, String(ttl), "NX"]]);
    commands += 2;
    if (!Array.isArray(data) || data.length !== 2 || data.some(item => !item || "error" in item) ||
        data[0].result !== expected || data[1].result !== (expected === 1 ? 1 : 0)) throw new Error("Redis counter/expiry check failed");
  }
  const expiry = await request("", ["TTL", key]); commands++;
  if (!expiry || "error" in expiry || !Number.isInteger(expiry.result) || expiry.result < 1 || expiry.result > ttl) throw new Error("Redis expiry check failed");
  await sleep((ttl + 1) * 1000);
  const expired = await request("", ["GET", key]); commands++;
  if (!expired || "error" in expired || expired.result !== null) throw new Error("Redis expiry reset check failed");
  return { status: "passed", counterVerified: true, expiryVerified: true, commands, customerKeysTouched: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await probeRedis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
    console.log(JSON.stringify(result));
  } catch {
    // Provider errors can include request/credential details. Print only a fixed diagnostic.
    console.error("Redis weekly health check failed; inspect configuration and database status.");
    process.exitCode = 1;
  }
}
