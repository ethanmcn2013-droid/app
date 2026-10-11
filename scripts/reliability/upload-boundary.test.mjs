import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.resolve('package.json'));
// Use the declared ESLint package's locked gitignore parser, not an implicit
// root hoist. The root's clean-export/actual CLI verification remains separate.
const ignore = createRequire(require.resolve('eslint/package.json'))('ignore');
const matcher = ignore().add(readFileSync('.vercelignore', 'utf8'));
test('private hosted inputs and local SQLite fixtures are excluded while deploy source remains', () => {
  for (const file of ['.env.reliability-hosted.json', '.env', '.env.production', '.env.example', 'nested/.env.local',
    'tasks.db', 'fixture.db-wal', 'fixture.db-shm', 'nested/run.sqlite', 'nested/run.sqlite-wal', 'local.sqlite3', 'local.sqlite3-shm',
    'work/receipts/result.json', 'work/operator.ts']) assert.equal(matcher.ignores(file), true, file);
  for (const file of ['src/app/app/tasks/page.tsx', 'src/server/db/queries.ts', 'public/brand/mark.svg', 'src/app/v3.css',
    'package.json', 'pnpm-lock.yaml', 'next.config.ts', 'drizzle/0040_sponsored_use_project_links.sql', 'drizzle/meta/_journal.json',
    'docs/release/runtime-20261009/receiving.md', 'experience/evidence-runs/current.json', 'experience/workbench/scenario.ts',
    'nested/work/preserved.ts', 'docs/source.db-metadata.json', 'public/example.sqlite-art.svg', 'public/example.sqlite3-diagram.svg']) assert.equal(matcher.ignores(file), false, file);
});
