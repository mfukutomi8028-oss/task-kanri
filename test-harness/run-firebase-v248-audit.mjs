import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };
const spec = 'tests/firebase-emulator-workflow-v148-audit-v248.spec.mjs';

const cases = [
  'stale dependency edit overwrites a newer remote dependency',
  'stale saved view can replace a newer server view',
  'stale relation edit removes a newer remote peer',
  'relation writer does not repair a reverse-only orphan edge'
];

for (const grep of cases) {
  const result = spawnSync(process.execPath, [cli, 'test', spec, '--workers=1', '--grep', grep], {
    cwd: ROOT,
    stdio: 'inherit',
    env
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

process.exit(0);
