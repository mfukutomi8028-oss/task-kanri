// Ver.480: retain all Ver.248-251 Firebase Emulator audits and the original case order.
// Each --grep case must run in a distinct Playwright process (no shared stale listeners).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };

const cases = Object.freeze([
  { spec: 'tests/firebase-emulator-workflow-v148-audit-v248.spec.mjs', grep: 'stale dependency edit preserves the remote winner' },
  { spec: 'tests/firebase-emulator-workflow-v148-audit-v248.spec.mjs', grep: 'stale saved view preserves newer server metadata' },
  { spec: 'tests/firebase-emulator-workflow-v148-audit-v248.spec.mjs', grep: 'stale relation edit preserves newer peer' },
  { spec: 'tests/firebase-emulator-workflow-v148-audit-v248.spec.mjs', grep: 'relation writer repairs a reverse-only orphan edge' },
  { spec: 'tests/firebase-emulator-user-comment-audit-v249.spec.mjs', grep: 'concurrent distinct user registrations preserve both server additions' },
  { spec: 'tests/firebase-emulator-user-comment-audit-v249.spec.mjs', grep: 'stale add intent preserves the same-user remote reaction after reconnect' },
  { spec: 'tests/firebase-emulator-user-comment-audit-v249.spec.mjs', grep: 'stale remove intent preserves remote removal without emitting an add notification' },
  { spec: 'tests/firebase-emulator-user-comment-audit-v249.spec.mjs', grep: 'fresh reaction intent preserves another user reaction while committing' },
  { spec: 'tests/firebase-emulator-notification-idempotency-v250.spec.mjs', grep: 'reply writer and two observers converge on one inbox event across reconnect' },
  { spec: 'tests/firebase-emulator-notification-idempotency-v250.spec.mjs', grep: 'reaction writer and two observers converge per revision while a later re-add gets a new event' },
  { spec: 'tests/firebase-emulator-comment-reply-audit-v251.spec.mjs', grep: 'concurrent replies to the same parent preserve both replies, histories, revision increments, and parent reactions' },
  { spec: 'tests/firebase-emulator-comment-reply-audit-v251.spec.mjs', grep: 'reply and reaction racing on the same parent preserve both mutations and revision increments' },
]);

for (const { spec, grep } of cases) {
  const result = spawnSync(process.execPath, [cli, 'test', spec, '--workers=1', '--grep', grep], {
    cwd: ROOT,
    stdio: 'inherit',
    env
  });
  if (result.error) { console.error(result.error); process.exit(1); }
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

process.exit(0);
