import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const EXPECTED_REPOSITORY = 'ethanmcn2013-droid/app';
export const EXPECTED_VERCEL_PROJECT = 'prj_C4rdqkS6wh9z4V0lku3tuphcNlkN';
export const REQUIRED_CHECKS = ['verify', 'registry-and-drift', 'prod migrations current'];

export function evaluateDeploymentPreflight(facts) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  check(facts.repository === EXPECTED_REPOSITORY && facts.remoteHostApproved === true, 'origin is not an approved GitHub URL for ethanmcn2013-droid/app');
  check(Array.isArray(facts.dirtyTracked) && facts.dirtyTracked.length === 0, 'tracked files are modified');
  check(Boolean(facts.head) && facts.head === facts.originMain, 'HEAD does not match origin/main');
  check(facts.vercelProject === EXPECTED_VERCEL_PROJECT && facts.expectedVercelProject === EXPECTED_VERCEL_PROJECT, 'linked Vercel project is incorrect or unconfigured');
  const checks = new Map((facts.requiredChecks ?? []).map(c => [c.name, c]));
  check(REQUIRED_CHECKS.every(name => checks.get(name)?.sha === facts.head && checks.get(name)?.conclusion === 'success'), 'required CI is missing, failed, or belongs to another commit');
  check(Boolean(facts.productionDeployment) && facts.productionDeployment === facts.expectedProductionDeployment, 'production deployment differs from custody baseline');
  check(facts.canonicalDeployment === facts.productionDeployment, 'canonical production alias does not resolve to inspected deployment');
  return { ok: failures.length === 0, failures, receipt: { ...facts, checkedAt: facts.checkedAt ?? new Date().toISOString() } };
}

export async function collectFacts({ cwd, expectedProductionDeployment, run, read = readFile }) {
  const exec = run ?? (async (file, args) => {
    const { execFile } = await import('node:child_process');
    return new Promise((resolve, reject) => execFile(file, args, { cwd }, (error, stdout) => error ? reject(error) : resolve(stdout.trim())));
  });
  const head = await exec('git', ['rev-parse', 'HEAD']);
  const [remote, originMain, status, projectText, checksText, deploymentText] = await Promise.all([
    exec('git', ['remote', 'get-url', 'origin']),
    exec('git', ['ls-remote', 'origin', 'refs/heads/main']), exec('git', ['status', '--porcelain']),
    read(path.join(cwd, '.vercel', 'project.json'), 'utf8'),
    exec('gh', ['api', `repos/${EXPECTED_REPOSITORY}/commits/${head}/check-runs?per_page=100`]),
    exec('vercel', ['api', '/v13/deployments/app.signalstudio.ie', '--scope', 'ethanmcn2013-1730s-projects'])
  ]);
  const normalizedRemote = remote.replace(/\.git$/, '');
  const remoteHostApproved = /^https:\/\/github\.com\/ethanmcn2013-droid\/app$/.test(normalizedRemote) || /^git@github\.com:ethanmcn2013-droid\/app$/.test(normalizedRemote) || /^ssh:\/\/git@github\.com\/ethanmcn2013-droid\/app$/.test(normalizedRemote);
  const repository = normalizedRemote.split(/[:/]/).slice(-2).join('/');
  const project = JSON.parse(projectText);
  const deployment = JSON.parse(deploymentText);
  const canonical = JSON.parse(deploymentText);
  const checks = JSON.parse(checksText).check_runs.map(c => ({ name: c.name, sha: c.head_sha, conclusion: c.conclusion }));
  return { repository, remoteHostApproved, head, originMain: originMain.split(/\s+/)[0], dirtyTracked: status.split(/\r?\n/).filter(x => x && !x.startsWith('??')),
    vercelProject: project.projectId, expectedVercelProject: EXPECTED_VERCEL_PROJECT, requiredChecks: checks,
    productionDeployment: canonical.id, canonicalDeployment: canonical.id,
    expectedProductionDeployment };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [expectedProductionDeployment, receiptPath] = process.argv.slice(2);
  if (!expectedProductionDeployment || !receiptPath) { console.error('Usage: node scripts/deploy-preflight.mjs <expected-production-deployment-id> <receipt.json>'); process.exit(2); }
  try {
    const facts = await collectFacts({ cwd: process.cwd(), expectedProductionDeployment });
    const result = evaluateDeploymentPreflight(facts);
    await writeFile(receiptPath, JSON.stringify(result, null, 2) + '\n');
    console.log(result.ok ? 'Deployment preflight passed.' : `Deployment refused: ${result.failures.join('; ')}`);
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(`Deployment preflight failed closed: ${error.message}`); process.exitCode = 1; }
}
