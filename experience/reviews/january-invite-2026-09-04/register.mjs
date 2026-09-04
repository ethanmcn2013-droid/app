// Review-only import boundaries. The production source is never rewritten.
import { registerHooks } from 'node:module';
const boundary = new URL('./boundaries.cjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['server-only', 'client-only', '@clerk/nextjs/server', '@clerk/nextjs',
      '@/server/db', '@/components/marketing/site-nav', '@/components/marketing/site-footer'].includes(specifier)
      || (specifier === './accept-button' && context.parentURL?.endsWith('/invite/[token]/page.tsx'))) {
      return { url: boundary, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
