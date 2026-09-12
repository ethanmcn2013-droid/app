import assert from "node:assert/strict";
import test from "node:test";
import { ConversationPoller, type PollClock } from "./polling";

function clockFixture() {
  let callback: (() => void) | null = null;
  let delay = -1;
  const clock: PollClock = {
    set: (fn, ms) => { callback = fn; delay = ms; return 1 as unknown as ReturnType<typeof setTimeout>; },
    clear: () => { callback = null; delay = -1; },
  };
  return { clock, delay: () => delay, fire: async () => {
    const fn = callback; callback = null; delay = -1; fn?.();
    await Promise.resolve(); await Promise.resolve();
  } };
}
const scope = { actorId: "alice", projectId: "project-a", conversationId: "room-a" };

test("visible active polls each second, list each 15 seconds, hidden/stop pause", async () => {
  const fixture = clockFixture(); let reads = 0;
  const poller = new ConversationPoller({ clock: fixture.clock, random: () => 0.5, poll: async () => ++reads, apply: () => {} });
  poller.configure(scope, true);
  await fixture.fire(); assert.equal(reads, 1); assert.equal(fixture.delay(), 1_000);
  poller.configure(scope, true, false);
  await fixture.fire(); assert.equal(fixture.delay(), 15_000);
  poller.configure(scope, false); await fixture.fire(); assert.equal(reads, 2); assert.equal(fixture.delay(), -1);
  poller.configure(scope, true); poller.stop(); await fixture.fire(); assert.equal(reads, 2);
});

test("scope change aborts stale response and never overlaps even when transport ignores abort", async () => {
  const fixture = clockFixture(); const applied: number[] = []; let reads = 0; let signal: AbortSignal | null = null;
  let release: (value: number) => void = () => {};
  const poller = new ConversationPoller({ clock: fixture.clock,
    poll: async (_scope, requestSignal) => { reads++; signal = requestSignal; return await new Promise<number>((resolve) => { release = resolve; }); },
    apply: (value) => applied.push(value),
  });
  poller.configure(scope, true); await fixture.fire();
  poller.configure({ ...scope, actorId: "bob" }, true); await fixture.fire();
  assert.equal(reads, 1); assert.equal((signal as AbortSignal | null)?.aborted, true);
  release(1); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(applied, []); assert.equal(fixture.delay(), 0);
  await fixture.fire(); assert.equal(reads, 2);
  release(2); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(applied, [2]); poller.stop();
});

test("failed requests back off with a hard 30-second ceiling; success resets", async () => {
  const fixture = clockFixture(); let failing = true; const failures: number[] = [];
  const poller = new ConversationPoller({ clock: fixture.clock, random: () => 0.5,
    poll: async () => { if (failing) throw new Error("synthetic offline"); return 1; },
    apply: () => {}, onFailure: (count) => failures.push(count),
  });
  poller.configure(scope, true);
  for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) { await fixture.fire(); assert.equal(fixture.delay(), delay); }
  assert.deepEqual(failures, [1, 2, 3, 4, 5, 6]);
  failing = false; await fixture.fire(); assert.equal(fixture.delay(), 1_000); poller.stop();
});
