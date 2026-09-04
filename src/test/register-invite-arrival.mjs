// Node 22's synchronous hooks intercept tsx's CommonJS imports. Keep this in
// JavaScript, as the repo's pinned Node 20 type definitions predate the API.
import { registerHooks } from "node:module";
const boundaries = new URL("./invite-arrival-boundaries.cjs", import.meta.url).href;
const guard = new URL("./server-only-stub.cjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only" || specifier === "client-only") {
      return { url: guard, shortCircuit: true };
    }
    if (specifier.endsWith(".css")) return { url: guard, shortCircuit: true };
    if (context.parentURL?.endsWith("/accept-button.tsx") &&
        ["react", "next/navigation", "@/components/primitives/toast"].includes(specifier)) {
      return { url: boundaries, shortCircuit: true };
    }
    if (["@clerk/nextjs/server", "@clerk/nextjs", "next/headers", "next/cache"].includes(specifier)) {
      return { url: boundaries, shortCircuit: true };
    }
    const resolved = nextResolve(specifier, context);
    if (/\/src\/server\/(db\/index|auth|email)\.(ts|js)$/.test(resolved.url)) {
      return { url: boundaries, shortCircuit: true };
    }
    return resolved;
  },
});
