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
  assert.match(runner, /firebase-emulator-user-comments\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-comment-replies-v215\.spec\.mjs/);
  assert.equal((runner.match(/firebase-emulator-comment-notifications-v235\.spec\.mjs/g) || []).length, 1);
  assert.equal((runner.match(/firebase-emulator-schedule-copy-v225\.spec\.mjs/g) || []).length, 1);
  assert.equal((runner.match(/firebase-emulator-bulk-actions-v243\.spec\.mjs/g) || []).length, 3);
  assert.equal((runner.match(/\{\s*spec:/g) || []).length, 25);

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
