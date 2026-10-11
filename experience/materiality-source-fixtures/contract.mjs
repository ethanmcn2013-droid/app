import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const fixtureDefines = Object.freeze({ 'process.env.NODE_ENV': '"production"', 'process.env': '{}' });
export const navigationSeamSource = 'import React from "react";export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}';

export function fixtureInputReceipt(inputs, root) {
  const inputHashes = {}, virtualInputs = {};
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  for (const name of Object.keys(inputs)) {
    if (name === '<define:process.env>') {
      virtualInputs[name] = { kind: 'esbuild-define', value: fixtureDefines['process.env'], sha256: digest(fixtureDefines['process.env']) };
    } else if (name === 'local:link') {
      virtualInputs[name] = { kind: 'local-navigation-seam', source: navigationSeamSource, sha256: digest(navigationSeamSource) };
    } else {
      if (name.startsWith('<') || name.startsWith('local:')) throw Error('Undeclared virtual bundle input: ' + name);
      // A missing real input must fail rather than disappear from provenance.
      inputHashes[name] = digest(readFileSync(path.resolve(root, name)));
    }
  }
  return { inputHashes, virtualInputs, defines: fixtureDefines, definesSha256: digest(JSON.stringify(fixtureDefines)) };
}

export const componentSources = Object.freeze({
  'tasks.state.app-project-loading': 'src/app/app/project/loading.tsx',
  'tasks.state.app-home-loading': 'src/app/app/home/loading.tsx',
  'tasks.state.app-home-error': 'src/app/app/home/error.tsx',
  'tasks.state.app-tasks-loading': 'src/app/app/tasks/loading.tsx',
  'tasks.state.app-analytics-loading': 'src/app/app/analytics/loading.tsx',
  'tasks.state.app-analytics-error': 'src/app/app/analytics/error.tsx',
  'tasks.state.app-tools-loading': 'src/app/app/tools/loading.tsx',
  'tasks.state.app-files-loading': 'src/app/app/files/loading.tsx',
  'tasks.state.app-files-error': 'src/app/app/files/error.tsx',
});

export function componentDocumentHead(id) {
  if (!Object.hasOwn(componentSources, id)) throw Error('Unknown component document');
  return `<title>${id} · local component fixture</title>`;
}

export function assertFixtureEnvironment(env, origin) {
  const url = new URL(origin);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || !url.port ||
      env.TASKS_MATERIALITY_FIXTURE !== '1' || env.VERCEL_ENV !== 'preview' || env.VERCEL === '1' ||
      env.SIGNAL_ACCESS_MODE !== 'demo') {
    throw new Error('Materiality fixture requires an explicit loopback-only synthetic Preview launch');
  }
}

export function componentIdForPath(pathname) {
  if (!pathname.startsWith('/materiality/')) return null;
  const id = pathname.slice('/materiality/'.length);
  return Object.hasOwn(componentSources, id) ? id : null;
}
