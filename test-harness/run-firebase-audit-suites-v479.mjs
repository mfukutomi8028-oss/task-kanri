// Ver.479: retain six full Firebase Emulator audit suites in their original order.
// Each Playwright invocation uses a fresh child process for listener isolation.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };

const suites = Object.freeze([
  'tests/firebase-emulator-reaction-reconnect-audit-v254.spec.mjs',
  'tests/firebase-emulator-firebase-singleflight-v256.spec.mjs',
  'tests/firebase-emulator-comment-notification-fallback-v259.spec.mjs',
  'tests/firebase-emulator-comment-notification-reconnect-v260.spec.mjs',
  'tests/firebase-emulator-pending-multitab-v261.spec.mjs',
  'tests/firebase-emulator-pending-cross-tab-v263.spec.mjs',
]);

for (const spec of suites) {
  const result = spawnSync(process.execPath, [cli, 'test', spec, '--workers=1'], {
    cwd: ROOT,
    stdio: 'inherit',
    env
  });
  if (result.error) { console.error(result.error); process.exit(1); }
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

process.exit(0);
