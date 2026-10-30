import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Firebase emulator configuration is isolated from production', () => {
  const config = JSON.parse(read('firebase.json'));
  assert.equal(config.database?.rules, 'database.rules.test.json');
  assert.equal(config.emulators?.database?.host, '127.0.0.1');
  assert.equal(config.emulators?.database?.port, 9000);
  assert.equal(config.emulators?.ui?.enabled, false);

  const rules = JSON.parse(read('database.rules.test.json'));
  assert.equal(rules.rules?.['.read'], true);
  assert.equal(rules.rules?.['.write'], true);

  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts?.['test:firebase'] || '', /emulators:exec/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--only database/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--project demo-task-kanri/);
  assert.equal(pkg.devDependencies?.['firebase-tools'], '15.30.0');
});

test('application emulator hook rejects unsafe hosts and non-test rooms', () => {
  const app = read('app.js');
  assert.match(app, /WORK_BOARD_TEST/);
  assert.match(app, /connectDatabaseEmulator\(db, host, port\)/);
  assert.match(app, /host === '127\.0\.0\.1' \|\| host === 'localhost'/);
  assert.match(app, /port < 1 \|\| port > 65535/);
  assert.match(app, /productionUrl/);
  assert.match(app, /ROOM_ID\)\.startsWith\('test-'\)/);
  assert.match(app, /test-emulator-configuration-rejected/);
});

test('browser emulator suites use demo projects, test rooms, and block production RTDB hosts', () => {
  const suite = read('tests/firebase-emulator-write.spec.mjs');
  const duplicateSuite = read('tests/firebase-emulator-duplicate.spec.mjs');
  const todoSuite = read('tests/firebase-emulator-todo.spec.mjs');
  const workSuite = read('tests/firebase-emulator-work-features.spec.mjs');
  const workAuditSuite = read('tests/firebase-emulator-work-features-audit-v244.spec.mjs');
  const workflowAuditSuite = read('tests/firebase-emulator-workflow-audit-v245.spec.mjs');
  const archiveDuplicateAuditSuite = read('tests/firebase-emulator-archive-duplicate-audit-v246.spec.mjs');
  const inboxAuditSuite = read('tests/firebase-emulator-workflow-inbox-audit-v247.spec.mjs');
  const userCommentSuite = read('tests/firebase-emulator-user-comments.spec.mjs');
  const replySuite = read('tests/firebase-emulator-comment-replies-v215.spec.mjs');
  const notificationSuite = read('tests/firebase-emulator-comment-notifications-v235.spec.mjs');
  const scheduleCopySuite = read('tests/firebase-emulator-schedule-copy-v225.spec.mjs');
  const bulkSuite = read('tests/firebase-emulator-bulk-actions-v243.spec.mjs');
  const runner = read('test-harness/run-firebase-browser.mjs');

  for (const source of [suite, duplicateSuite, todoSuite, workSuite, userCommentSuite, replySuite, notificationSuite, scheduleCopySuite]) {
    assert.match(source, /demo-task-kanri/);
    assert.match(source, /test-firebase-emulator/);
    assert.match(source, /127\.0\.0\.1/);
    assert.match(source, /firebaseio\\\.com\|firebasedatabase\\\.app/);
    assert.match(source, /WORK_BOARD_TEST/);
    assert.match(source, /productionRequests/);
  }

  assert.match(workAuditSuite, /demo-task-kanri/);
  assert.match(workAuditSuite, /test-work-features-audit-v244/);
  assert.match(workAuditSuite, /127\.0\.0\.1/);
  assert.match(workAuditSuite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(workAuditSuite, /WORK_BOARD_TEST/);
  assert.match(workAuditSuite, /productionRequests/);

  assert.match(workflowAuditSuite, /demo-task-kanri/);
  assert.match(workflowAuditSuite, /test-workflow-audit-v245/);
  assert.match(workflowAuditSuite, /127\.0\.0\.1/);
  assert.match(workflowAuditSuite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(workflowAuditSuite, /WORK_BOARD_TEST/);
  assert.match(workflowAuditSuite, /productionRequests/);

  assert.match(archiveDuplicateAuditSuite, /demo-task-kanri/);
  assert.match(archiveDuplicateAuditSuite, /test-archive-duplicate-audit-v246/);
  assert.match(archiveDuplicateAuditSuite, /127\.0\.0\.1/);
  assert.match(archiveDuplicateAuditSuite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(archiveDuplicateAuditSuite, /WORK_BOARD_TEST/);
  assert.match(archiveDuplicateAuditSuite, /productionRequests/);

  assert.match(inboxAuditSuite, /demo-task-kanri/);
  assert.match(inboxAuditSuite, /test-workflow-inbox-audit-v247/);
  assert.match(inboxAuditSuite, /127\.0\.0\.1/);
  assert.match(inboxAuditSuite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(inboxAuditSuite, /WORK_BOARD_TEST/);
  assert.match(inboxAuditSuite, /productionRequests/);
  assert.match(inboxAuditSuite, /goOffline/);
  assert.match(inboxAuditSuite, /goOnline/);

  assert.match(bulkSuite, /demo-task-kanri/);
  assert.match(bulkSuite, /test-bulk-actions-v243/);
  assert.match(bulkSuite, /127\.0\.0\.1/);
  assert.match(bulkSuite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(bulkSuite, /WORK_BOARD_TEST/);
  assert.match(bulkSuite, /productionRequests/);

  assert.match(suite, /test-firebase-emulator-e2e/);
  assert.match(duplicateSuite, /test-firebase-emulator-e2e/);
  assert.match(todoSuite, /test-firebase-emulator-todo-e2e/);
  assert.match(workSuite, /test-firebase-emulator-work-features-e2e/);
  assert.match(userCommentSuite, /test-firebase-emulator-user-comments-e2e/);
  assert.match(replySuite, /test-firebase-emulator-comment-replies-v215/);
  assert.match(notificationSuite, /test-firebase-emulator-comment-notifications-v235/);
  assert.match(scheduleCopySuite, /test-firebase-emulator-schedule-copy-v225/);

  assert.match(runner, /firebase-emulator-write\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-duplicate\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-todo\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-work-features\.spec\.mjs/);
  assert.equal((runner.match(/firebase-emulator-work-features-audit-v244\.spec\.mjs/g) || []).length, 3);
  assert.equal((runner.match(/firebase-emulator-workflow-audit-v245\.spec\.mjs/g) || []).length, 2);
  assert.equal((runner.match(/firebase-emulator-archive-duplicate-audit-v246\.spec\.mjs/g) || []).length, 2);
  assert.equal((runner.match(/firebase-emulator-workflow-inbox-audit-v247\.spec\.mjs/g) || []).length, 1);
  assert.match(runner, /firebase-emulator-user-comments\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-comment-replies-v215\.spec\.mjs/);
  assert.equal((runner.match(/firebase-emulator-comment-notifications-v235\.spec\.mjs/g) || []).length, 1);
  assert.equal((runner.match(/firebase-emulator-schedule-copy-v225\.spec\.mjs/g) || []).length, 1);
  assert.equal((runner.match(/firebase-emulator-bulk-actions-v243\.spec\.mjs/g) || []).length, 4);
  assert.equal((runner.match(/firebase-emulator-modern-todo-v558\.spec\.mjs/g) || []).length, 5);
  assert.equal((runner.match(/firebase-emulator-modern-task-v560\.spec\.mjs/g) || []).length, 8);
  assert.equal((runner.match(/\{\s*spec:/g) || []).length, 47);
  assert.match(runner, /stale business-memo revision is rejected/);
  assert.match(runner, /guarded orphan cleanup removes a start record/);
  assert.match(runner, /guarded orphan cleanup preserves a start record/);
  assert.match(runner, /v150 dependency child transaction preserves unrelated workflow records/);
  assert.match(runner, /stale reminder save and clear preserve the remote winner/);
  assert.match(runner, /stale archive restore preserves the remote winner/);
  assert.match(runner, /stale duplicate merge preserves the remote target/);
  assert.match(runner, /mark-all preserves later arrivals and stale read toggles preserve the remote winner/);
  assert.match(runner, /remote non-delete bulk commits atomically/);
  assert.match(runner, /remote bulk complete preserves recurring-child semantics/);
  assert.match(runner, /remote bulk delete delegates to canonical cleanup/);
  assert.match(runner, /reassigned knowledge is preserved/);

  assert.match(duplicateSuite, /workflowV152\/duplicates/);
  assert.match(duplicateSuite, /workflowV152\/archives/);
  assert.match(duplicateSuite, /data-merge-duplicate-v153/);
  assert.match(duplicateSuite, /data-open-canonical-v153/);
  assert.match(todoSuite, /todo-add-button/);
  assert.match(todoSuite, /todo-state-toggle-v144/);
  assert.match(todoSuite, /todo-detail-save/);
  assert.match(todoSuite, /todo-promote-button/);
  assert.match(todoSuite, /todo-history-v146/);
  assert.match(workSuite, /businessMemos/);
  assert.match(workSuite, /taskStarts/);
  assert.match(workSuite, /data-work-memo-layout/);
  assert.match(workSuite, /data-reserved-task-open/);
  assert.match(workAuditSuite, /workMemoRevisionV167/);
  assert.match(workAuditSuite, /別端末の更新/);
  assert.match(workAuditSuite, /orphan-start-v244/);
  assert.match(workAuditSuite, /valid-start-v244/);
  assert.match(workflowAuditSuite, /workflowV148\/dependencies/);
  assert.match(workflowAuditSuite, /workflowV148\/reminders/);
  assert.match(workflowAuditSuite, /remote-newer/);
  assert.match(workflowAuditSuite, /client-stale/);
  assert.match(workflowAuditSuite, /client-fresh/);
  assert.match(workflowAuditSuite, /conflict/);
  assert.match(archiveDuplicateAuditSuite, /workflowV152\/archives/);
  assert.match(archiveDuplicateAuditSuite, /remote-rearchive/);
  assert.match(archiveDuplicateAuditSuite, /REMOTE_WINNER_DESCRIPTION_V246/);
  assert.match(archiveDuplicateAuditSuite, /new Proxy\(real/);
  assert.match(archiveDuplicateAuditSuite, /runTransaction/);
  assert.match(archiveDuplicateAuditSuite, /conflict/);
  assert.match(archiveDuplicateAuditSuite, /WorkBoardDuplicateV182\.mergeDuplicate/);
  assert.match(inboxAuditSuite, /workflowV152\/inbox/);
  assert.match(inboxAuditSuite, /arrives-after-click-v247/);
  assert.match(inboxAuditSuite, /stale-read-toggle-v247/);
  assert.match(inboxAuditSuite, /markAllInboxRead/);
  assert.match(inboxAuditSuite, /markInboxRead/);
  assert.match(inboxAuditSuite, /conflict: true/);
  assert.match(userCommentSuite, /rooms\/\$\{ROOM\}\/meta/);
  assert.match(userCommentSuite, /_revisions/);
  assert.match(userCommentSuite, /userColors/);
  assert.match(userCommentSuite, /comment-reaction-choice-v165/);
  assert.match(userCommentSuite, /comment-reaction-chip-v165/);
  assert.match(userCommentSuite, /reactions/);
  assert.match(replySuite, /replyTo/);
  assert.match(replySuite, /revision:\s*8/);
  assert.match(notificationSuite, /type === 'reply'/);
  assert.match(notificationSuite, /type === 'reaction'/);
  assert.match(notificationSuite, /data-inbox-category-v235/);
  assert.match(scheduleCopySuite, /scheduleCopyMethod/);
  assert.match(scheduleCopySuite, /3件の予定をコピーしました/);
  assert.match(scheduleCopySuite, /revision\)\.toBe\(4\)/);
  assert.match(scheduleCopySuite, /revision\)\.toBe\(1\)/);
  assert.match(bulkSuite, /data-bulk-action/);
  assert.match(bulkSuite, /WorkBoardBulkV243/);
  assert.match(bulkSuite, /waitForKnowledgeCache/);
  assert.match(bulkSuite, /reassigned knowledge is preserved/);
});
test('Ver.479 executes every formerly separate Firebase audit suite with process isolation', () => {
  const script = JSON.parse(read('package.json')).scripts?.['test:firebase:browser'] || '';
  const runnerPath = 'test-harness/run-firebase-audit-suites-v479.mjs';
  const runner = read(runnerPath);
  const expected = [
    'tests/firebase-emulator-reaction-reconnect-audit-v254.spec.mjs',
    'tests/firebase-emulator-firebase-singleflight-v256.spec.mjs',
    'tests/firebase-emulator-comment-notification-fallback-v259.spec.mjs',
    'tests/firebase-emulator-comment-notification-reconnect-v260.spec.mjs',
    'tests/firebase-emulator-pending-multitab-v261.spec.mjs',
    'tests/firebase-emulator-pending-cross-tab-v263.spec.mjs',
  ];
  const actual = [...runner.matchAll(/'tests\/firebase-emulator-[^']+\.spec\.mjs'/g)]
    .map(m => m[0].slice(1, -1));
  assert.deepEqual(actual, expected, 'Firebase audit suite inventory changed');
  assert.equal((script.match(/node test-harness\/run-firebase-audit-suites-v479\.mjs/g) || []).length, 1);
  assert.ok(script.indexOf('run-firebase-grep-audits-v480.mjs') < script.indexOf('run-firebase-audit-suites-v479.mjs'));
  for (const version of ['254', '256', '259', '260', '261', '263']) {
    const retired = 'test-harness/run-firebase-v' + version + '-audit.mjs';
    assert.equal(fs.existsSync(path.join(ROOT, retired)), false, 'retired duplicate runner restored: ' + retired);
    assert.ok(!script.includes(retired), 'package still invokes retired runner: ' + retired);
  }
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E: '1'/);
  assert.match(runner, /spawnSync\(process\.execPath, \[cli, 'test', spec, '--workers=1'\]/);
  assert.match(runner, /cwd: ROOT/);
  assert.match(runner, /stdio: 'inherit'/);
  assert.match(runner, /if \(result\.error\)/);
  assert.match(runner, /if \(\(result\.status \?\? 1\) !== 0\) process\.exit/);
});
test('Ver.480 keeps all 12 Firebase grep cases in exact order with isolated processes', () => {
  const pkg = JSON.parse(read('package.json'));
  const script = pkg.scripts?.['test:firebase:browser'] || '';
  const runner = read('test-harness/run-firebase-grep-audits-v480.mjs');
  const expected = [
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
  ];
  const actual = [...runner.matchAll(/\{\s*spec: '([^']+)', grep: '([^']+)'\s*\}/g)]
    .map(match => ({ spec: match[1], grep: match[2] }));
  assert.deepEqual(actual, expected, 'The 12 independent Firebase audit cases changed');
  assert.deepEqual(script.split(' && '), [
    'node test-harness/run-firebase-browser.mjs',
    'node test-harness/run-firebase-grep-audits-v480.mjs',
    'node test-harness/run-firebase-audit-suites-v479.mjs',
  ], 'Firebase audit entrypoint order changed');
  for (const version of ['248', '249', '250', '251']) {
    const retired = 'test-harness/run-firebase-v' + version + '-audit.mjs';
    assert.equal(fs.existsSync(path.join(ROOT, retired)), false, 'retired runner restored: ' + retired);
    assert.ok(!script.includes(retired), 'old runner remains registered: ' + retired);
  }
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E: '1'/);
  assert.match(runner, /spawnSync\(process\.execPath, \[cli, 'test', spec, '--workers=1', '--grep', grep\]/);
  assert.match(runner, /cwd: ROOT/);
  assert.match(runner, /stdio: 'inherit'/);
  assert.match(runner, /if \(result\.error\)/);
  assert.match(runner, /if \(\(result\.status \?\? 1\) !== 0\) process\.exit/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--project demo-task-kanri/);
});
