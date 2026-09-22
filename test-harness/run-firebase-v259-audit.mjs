import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };
const spec = 'tests/firebase-emulator-comment-notification-fallback-v259.spec.mjs';

const result = spawnSync(process.execPath, [cli, 'test', spec, '--workers=1'], {
  cwd: ROOT,
  stdio: 'inherit',
  env
});
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
