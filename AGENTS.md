<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# End-of-cycle ritual

After a cycle ships in Tasks (Vercel deploy succeeded, CHANGELOG entry written, phase.md bumped), run:

```bash
node scripts/log-cycle.mjs \
  --cycle <N> \
  --title "<one-line headline>" \
  --date YYYY-MM-DD \
  --description "<one-paragraph what-and-why>"
```

This pushes a row into the shared Roadmap Turso DB so `ethanmcnamara.com/roadmap` stays accurate across all three products. The wrapper delegates to the canonical `log-cycle.ts` in `~/Projects/personal/ethanmcnamara`.

Don't pass `--project` — it's forced to `tasks` in the wrapper.
