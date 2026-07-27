import type { VenueMeaningfulActionV1 } from "./event-schema";

/**
 * Where a sponsored-use event goes once the product has committed the work.
 *
 * Today: nowhere. The ingest destination lives on `signal-entitlements` and is
 * reached from Studio, not from here, and the entitlements credentials are not
 * available to this deployment. Posting into a destination that does not exist
 * would put a network round-trip and a failure mode on a user's write path in
 * exchange for nothing.
 *
 * So the transport is deliberately one file. Call sites already emit through
 * `emitMeaningfulAction(input, committed, sink, env)`; when the destination
 * exists, only this file changes and no call site is touched.
 *
 * The counter is not telemetry. It exists so a test can prove a call site fired
 * without a network, and so a developer running with the flag on can see that
 * the wiring is alive.
 */

let emitted = 0;

export const noopSink = (_event: VenueMeaningfulActionV1): void => {
  emitted += 1;
};

export function emittedCount(): number {
  return emitted;
}

export function resetEmittedCount(): void {
  emitted = 0;
}

/** The sink the product call sites use. One name to change when B2 lands. */
export const sponsoredUseSink = noopSink;
