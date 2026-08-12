/**
 * Test-process resolver that lets the REAL lab guard execute under
 * `node --test`.
 *
 * Same technique and the same reason as `src/test/register-server-only.mjs`:
 * tsx transpiles TypeScript to CommonJS, so the failing lookups are `require`
 * calls, which the synchronous `registerHooks` API intercepts and the async
 * loader chain does not.
 *
 * Three specifiers are swapped:
 *   server-only / client-only  → empty module (no client bundle exists here)
 *   next/navigation            → notFound()/redirect() that throw tagged errors
 *   @clerk/nextjs/server       → currentUser() driven by a test global
 *
 * Nothing else is stubbed. `@/lib/access-mode` and the policy module are the
 * real ones, so what these tests exercise is the guard's actual control flow
 * over the actual rule, not a re-implementation of it.
 *
 * Usage:
 *   node --import tsx \
 *        --import ./src/lib/home-layer/lab/testing/register-lab-stubs.mjs \
 *        --test src/lib/home-layer/lab/guard.test.ts
 */
import { registerHooks } from "node:module";

const stubs = new Map([
  ["server-only", new URL("../../../../test/server-only-stub.cjs", import.meta.url).href],
  ["client-only", new URL("../../../../test/server-only-stub.cjs", import.meta.url).href],
  ["next/navigation", new URL("./next-navigation-stub.cjs", import.meta.url).href],
  ["@clerk/nextjs/server", new URL("./clerk-server-stub.cjs", import.meta.url).href],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = stubs.get(specifier);
    if (stub) return { url: stub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
