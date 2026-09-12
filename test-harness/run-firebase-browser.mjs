import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };

function runSuite(spec) {
  const result = spawnSync(
    process.execPath,
    [cli, 'test', spec, '--workers=1'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env
    }
  );

  if (result.error) {
    console.error(result.error);
    return 1;
  }
  return result.status ?? 1;
}

// Keep write-heavy feature suites in separate Playwright processes. Browser,
// WebSocket, and delayed sidecar work are fully torn down between suites so
// one workflow cannot leak timing state into the next Emulator boundary.
for (const spec of [
  'tests/firebase-emulator-write.spec.mjs',
  'tests/firebase-emulator-duplicate.spec.mjs',
  'tests/firebase-emulator-todo.spec.mjs'
]) {
  const status = runSuite(spec);
  if (status !== 0) process.exit(status);
}

process.exit(0);
