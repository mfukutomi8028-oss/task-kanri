import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const env = { ...process.env, WORK_BOARD_FIREBASE_E2E: '1' };

function runCase({ spec, grep = '' }) {
  const args = [cli, 'test', spec, '--workers=1'];
  if (grep) args.push('--grep', grep);

  const result = spawnSync(
    process.execPath,
    args,
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

// Firebase clients leave asynchronous listeners/WebSockets behind until the
// Playwright process exits. Run each write-heavy E2E case in its own process so
// the next seed + initial RTDB subscription starts from a clean browser runtime.
// Assertions and the shared Emulator remain unchanged.
const cases = [
  { spec: 'tests/firebase-emulator-write.spec.mjs', grep: 'boots in remote-online mode' },
  { spec: 'tests/firebase-emulator-write.spec.mjs', grep: 'archives and restores' },
  { spec: 'tests/firebase-emulator-write.spec.mjs', grep: 'writes personal inbox events' },
  { spec: 'tests/firebase-emulator-write.spec.mjs', grep: 'generates an assignee notification' },
  { spec: 'tests/firebase-emulator-write.spec.mjs', grep: 'keeps one idempotent inbox event' },
  { spec: 'tests/firebase-emulator-duplicate.spec.mjs' },
  { spec: 'tests/firebase-emulator-todo.spec.mjs', grep: 'adds a personal ToDo' },
  { spec: 'tests/firebase-emulator-todo.spec.mjs', grep: 'completes a ToDo' },
  { spec: 'tests/firebase-emulator-todo.spec.mjs', grep: 'edits ToDo title and memo' },
  { spec: 'tests/firebase-emulator-todo.spec.mjs', grep: 'promotes a ToDo into a task' },
  { spec: 'tests/firebase-emulator-todo.spec.mjs', grep: 'shows a Firebase-synchronized prior completion' },
  { spec: 'tests/firebase-emulator-work-features.spec.mjs', grep: 'adds a shared business memo' },
  { spec: 'tests/firebase-emulator-work-features.spec.mjs', grep: 'edits a shared business memo' },
  { spec: 'tests/firebase-emulator-work-features.spec.mjs', grep: 'deletes a shared business memo' },
  { spec: 'tests/firebase-emulator-work-features.spec.mjs', grep: 'saves a future task start date' },
  { spec: 'tests/firebase-emulator-work-features-audit-v244.spec.mjs', grep: 'stale business-memo revision is rejected' },
  { spec: 'tests/firebase-emulator-work-features-audit-v244.spec.mjs', grep: 'guarded orphan cleanup removes a start record' },
  { spec: 'tests/firebase-emulator-work-features-audit-v244.spec.mjs', grep: 'guarded orphan cleanup preserves a start record' },
  { spec: 'tests/firebase-emulator-workflow-audit-v245.spec.mjs', grep: 'v150 dependency child transaction preserves unrelated workflow records' },
  { spec: 'tests/firebase-emulator-workflow-audit-v245.spec.mjs', grep: 'current v152 reminder writer can overwrite a newer remote reminder' },
  { spec: 'tests/firebase-emulator-user-comments.spec.mjs', grep: 'adds a shared user' },
  { spec: 'tests/firebase-emulator-user-comments.spec.mjs', grep: 'keeps one user and one meta revision increment' },
  { spec: 'tests/firebase-emulator-user-comments.spec.mjs', grep: 'adds a comment reaction' },
  { spec: 'tests/firebase-emulator-user-comments.spec.mjs', grep: 'removes only the current user' },
  { spec: 'tests/firebase-emulator-comment-replies-v215.spec.mjs' },
  { spec: 'tests/firebase-emulator-comment-notifications-v235.spec.mjs' },
  { spec: 'tests/firebase-emulator-schedule-copy-v225.spec.mjs' },
  { spec: 'tests/firebase-emulator-bulk-actions-v243.spec.mjs', grep: 'remote non-delete bulk commits atomically' },
  { spec: 'tests/firebase-emulator-bulk-actions-v243.spec.mjs', grep: 'remote bulk complete preserves recurring-child semantics' },
  { spec: 'tests/firebase-emulator-bulk-actions-v243.spec.mjs', grep: 'remote bulk delete delegates to canonical cleanup' },
  { spec: 'tests/firebase-emulator-bulk-actions-v243.spec.mjs', grep: 'reassigned knowledge is preserved' }
];

for (const testCase of cases) {
  const status = runCase(testCase);
  if (status !== 0) process.exit(status);
}

process.exit(0);
