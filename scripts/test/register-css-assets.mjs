/** Unit-test-only CSS Module stand-in. Class names remain inspectable, but
 * this does not load styles or establish any layout/rendering evidence.
 * Synchronous hooks also intercept the CommonJS imports emitted by tsx.
 */
import { registerHooks } from "node:module";

registerHooks({
  load(url, context, nextLoad) {
    if (new URL(url).pathname.endsWith(".module.css")) {
      return {
        format: "commonjs",
        source: `module.exports = new Proxy(Object.create(null), {
          get(_target, key) {
            if (key === "__esModule") return false;
            if (key === "then") return undefined;
            return typeof key === "string" ? key : undefined;
          }
        });`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
