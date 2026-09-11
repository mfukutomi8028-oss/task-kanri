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

test('browser emulator suite uses a demo project and blocks production RTDB hosts', () => {
  const suite = read('tests/firebase-emulator-write.spec.mjs');
  const duplicateSuite = read('tests/firebase-emulator-duplicate.spec.mjs');
  const runner = read('test-harness/run-firebase-browser.mjs');

  for (const source of [suite, duplicateSuite]) {
    assert.match(source, /demo-task-kanri/);
    assert.match(source, /test-firebase-emulator-e2e/);
    assert.match(source, /127\.0\.0\.1/);
    assert.match(source, /firebaseio\\\.com\|firebasedatabase\\\.app/);
    assert.match(source, /WORK_BOARD_TEST/);
    assert.match(source, /productionRequests/);
  }

  assert.match(runner, /firebase-emulator-write\.spec\.mjs/);
  assert.match(runner, /firebase-emulator-duplicate\.spec\.mjs/);
  assert.match(duplicateSuite, /workflowV152\/duplicates/);
  assert.match(duplicateSuite, /workflowV152\/archives/);
  assert.match(duplicateSuite, /data-merge-duplicate-v153/);
  assert.match(duplicateSuite, /data-open-canonical-v153/);
});
