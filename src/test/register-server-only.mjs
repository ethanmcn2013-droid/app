/**
 * Test-process resolver for `server-only` / `client-only`.
 *
 * Both packages exist only to make a bad import fail at bundle time. Neither is
 * hoisted to this workspace's root (they arrive as transitive dependencies of
 * Next), so a plain `node --test` run of any module that imports one cannot
 * resolve it. In a Node test process there is no client bundle to guard, so an
 * empty module is the correct stand-in and it changes no runtime behaviour.
 *
 * Registered with the synchronous hook API on purpose: tsx transpiles
 * TypeScript to CommonJS, so the failing lookup is a `require`, which the async
 * `module.register` loader chain does not intercept.
 *
 * Usage:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test <files>
 */
import { registerHooks } from "node:module";

const stubUrl = new URL("./server-only-stub.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: stubUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
