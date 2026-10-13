import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readJson = file => JSON.parse(read(file));

// This is an audit detector, NOT an acceptance test for authorization.
// Literal open rules are recorded as a known HIGH-risk repository baseline;
// production Firebase Console deployment state has not been inspected.
function unconditionalGrants(node, prefix = '') {
  const found = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return found;
  for (const [key, value] of Object.entries(node)) {
    if ((key === '.read' || key === '.write') &&
      (value === true || (typeof value === 'string' && value.trim() === 'true'))) {
      found.push(prefix + '/' + key);
    } else if (!key.startsWith('.') && value !== null && typeof value === 'object') {
      found.push(...unconditionalGrants(value, prefix + '/' + key));
    }
  }
  return found.sort();
}

test('Ver.449 risk detector identifies unconditional grants but does not label conditional rules safe', () => {
  const insecure = { rooms: { '$roomId': { '.read': 'true', '.write': true } } };
  assert.deepEqual(unconditionalGrants(insecure), ['/rooms/$roomId/.read', '/rooms/$roomId/.write']);
  const conditional = { rooms: { '$roomId': {
    '.read': 'auth != null && auth.uid === $roomId',
    '.write': 'auth != null && auth.uid === $roomId'
  } } };
  assert.deepEqual(unconditionalGrants(conditional), []);
  // An empty detector result does NOT prove a conditional rule is secure.
});

test('Ver.449 detects the HIGH-risk repository room rule without querying the live database', () => {
  const file = readJson('firebase-rules.json');
  const room = file.rules?.rooms?.['$roomId'];
  assert.ok(room, 'room access-control node disappeared; revisit audit');
  assert.deepEqual(unconditionalGrants(file.rules),
    ['/rooms/$roomId/.read', '/rooms/$roomId/.write'],
    'known rule baseline changed; review source/deployment and update the audit');
  assert.equal(room['.read'], true, 'baseline room read must be independently reviewed if changed');
  assert.equal(room['.write'], true, 'baseline room write must be independently reviewed if changed');
  assert.deepEqual(room.tasks?.['.indexOn'], ['status', 'assignee', 'priority', 'dueDate', 'updatedAt']);
  console.log('VER449_FIREBASE_ACCESS_AUDIT ' + JSON.stringify({
    severity: 'HIGH_UNVERIFIED_DEPLOYMENT',
    scope: 'repository-rule-definition-only',
    openRulePaths: unconditionalGrants(file.rules),
    liveRulesInspected: false,
    productionDataTouched: false
  }));
});

test('Ver.449 separates intentionally open demo emulator fixtures from production authorization', () => {
  const firebase = readJson('firebase.json');
  const testRules = readJson('database.rules.test.json');
  const pkg = readJson('package.json');
  assert.equal(firebase.database?.rules, 'database.rules.test.json');
  assert.equal(firebase.emulators?.database?.host, '127.0.0.1');
  assert.equal(firebase.emulators?.database?.port, 9000);
  assert.deepEqual(unconditionalGrants(testRules.rules), ['/.read', '/.write']);
  assert.match(pkg.scripts?.['test:firebase'] || '', /emulators:exec/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--only database/);
  assert.match(pkg.scripts?.['test:firebase'] || '', /--project demo-task-kanri/);
  // The CLI configuration points at an all-open test file; it must never be
  // mistaken for a production deployment policy.
});

test('Ver.449 records client-selected room and display name are not Firebase Auth identity', () => {
  const app = read('app.js');
  assert.match(app, /const ROOM_ID = getRoomId\(\);/);
  assert.match(app, /params\.get\("room"\)/);
  assert.match(app, /localStorage\.getItem\("systemTaskRoomId"\)/);
  assert.match(app, /currentUser:\s*localStorage\.getItem\("systemTaskUser"\)/);
  assert.match(app, /function setupFirebase\(\)|async function setupFirebase\(\)/);
  assert.match(app, /import\("https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-database\.js"\)/);
  assert.doesNotMatch(app, /firebase-auth\.js/,
    'Auth library adoption changes the current threat model and requires review');
});

test('Ver.449 records room-wide writes and room-scoped personal data subscriptions', () => {
  const app = read('app.js');
  const workflow = read('workflow-v152.js');
  assert.match(app, /state\.roomRef\s*=\s*ref\(db,/);
  assert.match(app, /runTransaction\(state\.roomRef,\s*current/);
  assert.match(app, /onValue\(state\.todosRef,/);
  assert.match(app, /onValue\(state\.metaRef,/);
  assert.match(app, /runTransaction\(state\.todosRef,\s*current/);
  assert.match(workflow, /workflowV152/);
  assert.match(workflow, /r\.onValue\(root,/);
  assert.match(workflow, /data\.inbox/);
  assert.match(workflow, /function userKey|const userKey/);
});

test('Ver.449 risk documentation and follow-up are explicit, while production Rules stay unchanged', () => {
  const note = read('docs/FIREBASE_ACCESS_BOUNDARY_AUDIT_V449.md');
  const readme = read('README.md');
  const pkg = readJson('package.json');
  assert.match(note, /Security Issue \[#368\]/);
  assert.match(note, /HIGH_UNVERIFIED_DEPLOYMENT/);
  assert.match(note, /本番適用状態/);
  assert.match(note, /database\.rules\.test\.json/);
  assert.match(note, /個人ToDo/);
  assert.match(note, /Emulator/);
  assert.match(note, /backup|バックアップ|復元テスト/);
  assert.match(note, /old|旧クライアント|旧キャッシュ/);
  assert.match(readme, /患者情報/);
  assert.ok(pkg.scripts['test:protocol'].includes('firebase-access-boundary-v449.test.mjs'),
    'Ver.449 audit was not registered in standard protocol CI');
  console.log('VER449_FIREBASE_ACCESS_MIGRATION_GATE ' + JSON.stringify({
    issue: 368,
    migrationApproval: 'NOT_GRANTED',
    targetAuthorizationTestsRun: false,
    repositoryAuditOnly: true
  }));
});
