import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('authorization rules run independently and affect final regression gate', () => {
  const workflow = read('.github/workflows/regression-checks.yml');
  const jobStart = workflow.indexOf('\n  authorization:\n');
  const firebaseStart = workflow.indexOf('\n  firebase:\n', jobStart);
  const regressionStart = workflow.indexOf('\n  regression:\n', firebaseStart);
  assert.ok(jobStart > 0 && firebaseStart > jobStart && regressionStart > firebaseStart);
  const auth = workflow.slice(jobStart, firebaseStart);
  const fb = workflow.slice(firebaseStart, regressionStart);
  for (const name of ['test:rules:v568', 'test:rules:v577', 'test:admin:v573']) {
    assert.match(auth, new RegExp('npm run ' + name.replaceAll(':', '\\:')));
    assert.doesNotMatch(fb, new RegExp('npm run ' + name.replaceAll(':', '\\:')));
  }
  assert.match(fb, /npm run test:firebase/);
  assert.match(workflow, /needs: \[protocol, browser, authorization, firebase\]/);
  assert.match(workflow, /AUTHORIZATION_RESULT: \$\{\{ needs\.authorization\.result \}\}/);
  assert.match(workflow, /test "\$AUTHORIZATION_RESULT" = "success"/);
  assert.doesNotMatch(workflow, /firebase deploy|--project task-kanri-2ad16/);
});

test('staged rules are isolated from legacy runtime and remain fail-closed', () => {
  const legacy = JSON.parse(read('firebase-rules.json'));
  const candidate = JSON.parse(read('security/database.rules.v577.candidate.json'));
  const app = read('app.js');
  const policy = read('docs/AUTH_ROLLOUT_GATE_20261106.md');
  assert.equal(legacy.rules.rooms.$roomId['.read'], true,
    'Legacy open rules need explicit migration rather than silent assertion of safety');
  assert.equal(legacy.rules.rooms.$roomId['.write'], true);
  assert.equal(candidate.rules['.read'], false);
  assert.equal(candidate.rules['.write'], false);
  assert.equal(candidate.rules.roomsV2.$roomId['.read'], false);
  assert.equal(candidate.rules.roomsV2.$roomId['.write'], false);
  assert.equal(candidate.rules.roomsV2.$roomId.shared.tasks['.write'], false);
  assert.match(app, /rooms\/\$\{ROOM_ID\}\/tasks/);
  assert.match(policy, /NO_GO/);
  assert.match(policy, /バックアップ/);
});
