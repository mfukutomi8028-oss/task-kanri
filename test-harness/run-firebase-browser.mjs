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

// Keep the original notification/archive suite in its own Playwright process.
// The duplicate merge UI performs several asynchronous side effects after its
// root update, so a separate process guarantees browser teardown before the
// next suite and prevents cross-suite Emulator timing interference.
for (const spec of [
  'tests/firebase-emulator-write.spec.mjs',
  'tests/firebase-emulator-duplicate.spec.mjs'
]) {
  const status = runSuite(spec);
  if (status !== 0) process.exit(status);
}

process.exit(0);
