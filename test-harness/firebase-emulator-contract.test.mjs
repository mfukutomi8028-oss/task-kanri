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
  assert.match(suite, /demo-task-kanri/);
  assert.match(suite, /test-firebase-emulator-e2e/);
  assert.match(suite, /127\.0\.0\.1/);
  assert.match(suite, /firebaseio\\\.com\|firebasedatabase\\\.app/);
  assert.match(suite, /WORK_BOARD_TEST/);
  assert.match(suite, /productionRequests/);
});
