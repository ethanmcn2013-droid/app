/**
 * Test-process resolver for the /app access-gate runtime test.
 *
 * Two stand-ins, and only two, so that everything the test actually measures
 * is real production code:
 *
 *   - `server-only` / `client-only`: bundler guards with no meaning outside a
 *     bundle (same reasoning as register-server-only.mjs, which this file
 *     otherwise duplicates).
 *   - `@clerk/nextjs/server`: the only true external boundary. Signing a real
 *     invited collaborator into Clerk is not something a unit test can do, so
 *     currentUser() is served from globalThis instead. Access-mode resolution,
 *     the allowlist, the drizzle workspace_members query and next/navigation's
 *     redirect are all the real implementations.
 *
 * Registered with the synchronous hook API because tsx transpiles TypeScript
 * to CommonJS, so the failing lookup is a `require`, which the async
 * `module.register` loader chain does not intercept.
 *
 * Usage:
 *   node --import tsx --import ./src/test/register-gate-runtime.mjs --test <files>
 */
import { registerHooks } from "node:module";

const serverOnlyStub = new URL("./server-only-stub.cjs", import.meta.url).href;
const clerkStub = new URL("./clerk-user-stub.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    if (specifier === "@clerk/nextjs/server") {
      return { url: clerkStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
