/**
 * The lab shell · the public surface.
 *
 * ONE import for a candidate:
 *
 *     import type { HomeCandidateProps } from "@/lib/home-layer/lab-shell";
 *
 * A candidate that reaches past this barrel — into `../fixtures`, into
 * `../inbox`, into `./assemble` — is a candidate that can render a number the
 * other three do not have, which is the one thing this lab may not allow. The
 * import graph under `src/app/lab/home-operating-layer/**` is walked by
 * `src/lib/home-layer/lab/lab-isolation-contract.test.mjs`, so a direct
 * fixture import is visible rather than a matter of trust.
 *
 * Nothing in this family reads a database, a provider, a cookie, a clock or
 * the network. The whole lab is a pure function of the URL.
 */

export * from "./contract";
export * from "./copy";
export * from "./lab-url";
export { assembleCandidateProps, resolveScope, scenarioScopeOf } from "./assemble";
export type { AssembleInput, ResolvedScope } from "./assemble";
