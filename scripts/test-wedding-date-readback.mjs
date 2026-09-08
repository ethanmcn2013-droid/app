import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const styles = path.join(root, '.next/static');
if (!existsSync(styles)) throw new Error('Build the App before the sponsored-date browser check.');
const result = spawnSync(process.execPath, ['--test', 'src/components/app/project/wedding-date-readback.browser.test.mjs'], {
  cwd: root, windowsHide: true, stdio: 'inherit', env: {
    ...process.env,
    WDATE_CSS_ROOT: process.env.WDATE_CSS_ROOT ?? styles,
    WDATE_RENDER_OUTPUT: process.env.WDATE_RENDER_OUTPUT ?? path.join(root, 'experience/output/recipient-project-work/wedding-date-readback'),
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
