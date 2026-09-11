import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const result = spawnSync(
  process.execPath,
  [
    cli,
    'test',
    'tests/firebase-emulator-write.spec.mjs',
    'tests/firebase-emulator-duplicate.spec.mjs',
    '--workers=1'
  ],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' }
  }
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
