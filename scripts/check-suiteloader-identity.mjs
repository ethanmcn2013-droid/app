import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const file = 'src/components/system/SuiteLoader.tsx';
const expected = 'c7a6ed22018cbe337abc8ad63d2aba4d0fa977a6853247ec22b47e675b7f3b6c';
if (!existsSync(file)) { console.error(`ERROR: ${file} not found. Run from repo root.`); process.exit(1); }
const actual = createHash('sha256').update(readFileSync(file, 'utf8').replaceAll('\r', ''), 'utf8').digest('hex');
if (actual !== expected) { console.error(`FAIL: SuiteLoader.tsx drifted. Expected ${expected}; actual ${actual}`); process.exit(1); }
console.log('OK: SuiteLoader.tsx is byte-identical to canonical reference.');
