import { readFile, writeFile } from 'node:fs/promises';

export function evaluateDeploymentPreflight(facts) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(facts.repository === 'ethanmcn2013-droid/app', 'repository is not ethanmcn2013-droid/app');
  check(Array.isArray(facts.dirtyTracked) && facts.dirtyTracked.length === 0, 'tracked files are modified');
  check(Boolean(facts.head) && facts.head === facts.originMain, 'HEAD does not match origin/main');
  check(facts.vercelProject === facts.expectedVercelProject, 'linked Vercel project is incorrect');
  check(Array.isArray(facts.requiredChecks) && facts.requiredChecks.length > 0 && facts.requiredChecks.every(c => c.sha === facts.head && c.conclusion === 'success'), 'required CI is missing, failed, or belongs to another commit');
  check(Boolean(facts.productionDeployment) && facts.productionDeployment === facts.expectedProductionDeployment, 'production deployment differs from custody baseline');
  return { ok: failures.length === 0, failures, receipt: { ...facts, checkedAt: facts.checkedAt ?? new Date().toISOString() } };
}

if (process.argv[1]?.endsWith('deploy-preflight.mjs')) {
  const [snapshotPath, receiptPath] = process.argv.slice(2);
  if (!snapshotPath || !receiptPath) { console.error('Usage: node scripts/deploy-preflight.mjs <fresh-facts.json> <receipt.json>'); process.exit(2); }
  try {
    const result = evaluateDeploymentPreflight(JSON.parse(await readFile(snapshotPath, 'utf8')));
    await writeFile(receiptPath, JSON.stringify(result, null, 2) + '\n');
    console.log(result.ok ? 'Deployment preflight passed.' : `Deployment refused: ${result.failures.join('; ')}`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(`Deployment preflight failed closed: ${error.message}`); process.exitCode = 1; }
}
