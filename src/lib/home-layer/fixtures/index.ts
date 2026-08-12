/**
 * Home fixture universe · the public surface.
 *
 * ONE import for every consumer: the Wave 3 lab, the Wave 5 to Wave 8 mode
 * implementations, the browser journeys and the evidence harness. A consumer
 * that reaches past this barrel into a sibling module is a consumer that can
 * drift from the rest, which is the failure this file exists to prevent.
 *
 * WHAT IS IN HERE. Identifiers, presentation facts and pure derivations. No
 * auth, no database, no framework import, no server action, no clock read, no
 * network. `lab-isolation-contract.test.mjs` walks the transitive import
 * graph from `src/app/lab/home-operating-layer/**` and fails on any of those,
 * so this family is what the lab is allowed to consume.
 *
 * A FIXTURE NEVER GRANTS ANYTHING. Production access still resolves through
 * the normal membership checks. The roles, capabilities and permission states
 * below describe what a correct render SHOWS; they do not authorize a read.
 */

export * from "./clock";
export * from "./source-ref";
export * from "./notes";
export * from "./projects";
export * from "./today";
export * from "./derive";
export * from "./inbox";
export * from "./my-work";
export * from "./analytics";
export * from "./scenarios";
