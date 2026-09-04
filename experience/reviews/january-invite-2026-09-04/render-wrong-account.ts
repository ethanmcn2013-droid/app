// Run from the App worktree with the adjacent register.mjs loaded via --import.
// SSRs the actual invitation main, then uses chrome/styles from the actual local
// Next page. Scripts are removed: this is a static rendering review, not Clerk
// authentication or a substitute for the 25 behavioral tests.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

async function main() {
  process.env.SIGNAL_ACCESS_MODE = 'production';
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = 'production';
  const { default: InvitePage } = await import('../../../src/app/invite/[token]/page');
  const tree = await InvitePage({ params: Promise.resolve({ token: 'review-wrong-account' }) });
  const mainElement = React.Children.toArray(tree.props.children).find(
    node => React.isValidElement(node) && node.type === 'main',
  );
  assert(mainElement);
  const markup = renderToStaticMarkup(mainElement);
  assert(markup.includes('other@example.invalid'));
  assert(markup.includes('Sign out and use the invited account'));
  assert(!markup.includes('invited@example.invalid'));
  assert(!markup.includes('Accept invite'));
  createRequire(import.meta.url)('./boundaries.cjs').assertConsumed();
  const origin = 'http://127.0.0.1:4357';
  const response = await fetch(`${origin}/invite/review-valid`);
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  html = html.replace(/<main\b[\s\S]*?<\/main>/, markup)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace('<head>', `<head><base href="${origin}/">`)
    .replace('<title>Signal Studio</title>', '<title>Wrong-account invitation · synthetic source review</title>');
  writeFileSync('experience/reviews/january-invite-2026-09-04/wrong-account.html', html);
  createServer((request, reply) => {
    if (request.url !== '/invite/review-wrong-account') {
      reply.writeHead(404).end(); return;
    }
    reply.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
  }).listen(4358, '127.0.0.1', () => console.log('Synthetic actual-source review ready: http://127.0.0.1:4358/invite/review-wrong-account'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
