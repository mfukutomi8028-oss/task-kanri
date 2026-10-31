// Ver.568: audit the separation between open legacy fixtures and isolated future rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = p => JSON.parse(load(p));

test('Ver.568 preserves active legacy rules and keeps a separate demo-only candidate', () => {
  const active = json('firebase-rules.json');
  const testRules = json('database.rules.test.json');
  const cfg = json('firebase.json');
  const candidate = json('security/database.rules.v568.candidate.json');
  const isolated = json('firebase.v568.candidate.json');
  assert.equal(active.rules.rooms.$roomId['.read'], true);
  assert.equal(active.rules.rooms.$roomId['.write'], true);
  assert.equal(testRules.rules['.read'], true);
  assert.equal(cfg.database.rules, 'database.rules.test.json');
  assert.equal(isolated.database.rules, 'security/database.rules.v568.candidate.json');
  assert.equal(isolated.emulators.database.host, '127.0.0.1');
  assert.equal(isolated.emulators.database.port, 9001);
  assert.equal(candidate.rules['.read'], false);
  assert.equal(candidate.rules['.write'], false);
  assert.equal(candidate.rules.rooms, undefined, 'legacy rooms cannot be opened by this candidate');
  const grants = [];
  function walk(value, prefix = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '.read' || key === '.write') {
        if (child === true || child === 'true') grants.push(prefix + '/' + key);
      } else if (!key.startsWith('.')) {
        walk(child, prefix + '/' + key);
      }
    }
  }
  walk(candidate.rules);
  assert.deepEqual(grants, [], 'candidate cannot have unconditional access');
  assert.equal(candidate.rules.access, undefined);
  assert.equal(candidate.rules.personalV2, undefined);
  assert.equal(candidate.rules.roomsV2.$roomId.access.members.$uid['.write'], false);
  assert.equal(candidate.rules.roomsV2.$roomId['.read'], undefined);
  assert.equal(candidate.rules.roomsV2.$roomId['.write'], undefined);
  assert.equal(candidate.rules.roomsV2.$roomId.personal.$uid['.read'], undefined);
  assert.equal(candidate.rules.roomsV2.$roomId.personal.$uid['.write'], undefined);
  const taskRule = candidate.rules.roomsV2.$roomId.shared.tasks.$taskId['.write'];
  const privateRule = candidate.rules.roomsV2.$roomId.personal.$uid.todos.$todoId['.write'];
  assert.match(taskRule, /auth != null/);
  assert.match(taskRule, /root.child\('roomsV2'\).child\(\$roomId\).child\('access'\)/);
  assert.match(privateRule, /auth.uid === \$uid/);
});

test('Ver.568 candidate test cannot silently run against an arbitrary Firebase project', () => {
  const pkg = json('package.json');
  const cmd = pkg.scripts['test:rules:v568'];
  const ci = load('.github/workflows/regression-checks.yml');
  const runner = load('test-harness/security-rules-v568.mjs');
  const note = load('docs/MODERN_AUTH_RULES_MIGRATION_V568.md');
  assert.match(cmd, /--project demo-task-kanri-v568/);
  assert.match(cmd, /--config firebase.v568.candidate.json/);
  assert.match(cmd, /--only database/);
  assert.match(cmd, /node test-harness\/security-rules-v568.mjs/);
  assert.match(ci, /run: npm run test:rules:v568/);
  assert.match(runner, /projectId: 'demo-task-kanri-v568'/);
  assert.match(runner, /port: 9001/);
  assert.match(runner, /assertFails/);
  assert.match(runner, /assertSucceeds/);
  assert.match(note, /NO-GO/);
  assert.match(note, /旧クライアント/);
  assert.match(note, /バックアップ/);
  assert.match(note, /本番適用状態は未確認/);
  assert.match(note, /親のread\/write許可は子で取り消せない/);
});

test('Ver.569 candidate denies invalid task schema, stale revisions and direct task deletion', () => {
  const rules = json('security/database.rules.v568.candidate.json').rules;
  const task = rules.roomsV2.$roomId.shared.tasks.$taskId;
  const runner = load('test-harness/security-rules-v568.mjs');
  const app = load('app.js');
  const merge = load('workspace-duplicate-atomic-v544.js');
  const note = load('docs/MODERN_AUTH_RULES_MIGRATION_V568.md');
  assert.match(task['.write'], /newData\.exists\(\)/);
  assert.match(task['.validate'], /newData\.hasChildren/);
  assert.match(task['.validate'], /data\.child\('revision'\)\.val\(\) \+ 1/);
  assert.match(task.title['.validate'], /length <= 120/);
  assert.match(task.revision['.validate'], /% 1 === 0/);
  assert.equal(task.$other['.validate'], false);
  for (const fragment of ['missing-revision', 'blank-title', 'long-title', 'decimal-revision', 'client-role', 'task1/title']) {
    assert.ok(runner.includes(fragment), 'Emulator test missing invalid case: ' + fragment);
  }
  assert.match(runner, /chief = env\.authenticatedContext\('chief'\)/);
  // Existing atomic writers cannot be run against the candidate Rules.
  assert.match(app, /runTransaction\(state\.roomRef, current/);
  assert.match(app, /persistPromotedTaskV559\(task, context\)/);
  assert.match(merge, /runTransaction\(roomRef,current/);
  assert.match(note, /ToDoタスク化/);
  assert.match(note, /正式公開 NO-GO/);
});

test('Ver.570 candidate keeps all data under one room with UID-private permissions', () => {
  const rules = json('security/database.rules.v568.candidate.json').rules;
  const room = rules.roomsV2.$roomId;
  const runner = load('test-harness/security-rules-v568.mjs');
  const planner = load('security/room-atomic-promotion.mjs');
  const parity = load('modern/FEATURE_PARITY.md');
  assert.equal(rules.access, undefined);
  assert.equal(rules.personalV2, undefined);
  assert.equal(room['.read'], undefined);
  assert.equal(room['.write'], undefined);
  assert.equal(room.personal.$uid['.read'], undefined);
  assert.equal(room.personal.$uid['.write'], undefined);
  assert.equal(room.operations, undefined);
  assert.match(room.shared.tasks.$taskId.description['.validate'], /length <= 2000/);
  assert.match(runner, /runTransaction\(roomRef, current =>/);
  assert.match(runner, /assertFails\(update\(dbRef\(alice/);
  assert.match(runner, /env\.withSecurityRulesDisabled\(async admin =>/);
  assert.match(planner, /role !== 'editor' && role !== 'admin'/);
  assert.match(planner, /createHash\('sha256'\)/);
  assert.match(planner, /return \{ action: 'commit', taskId: generatedTaskId, room: nextRoom \}/);
  assert.match(parity, /Ver\.570/);
});

test('Ver.571 protects UID-owned Todo revisions and keeps the real emulator room listener', () => {
  const candidate = json('security/database.rules.v568.candidate.json').rules;
  const todo = candidate.roomsV2.$roomId.personal.$uid.todos.$todoId;
  const emulator = load('test-harness/security-rules-v568.mjs');
  const classic = load('app.js');
  assert.match(todo['.write'], /auth.uid === \$uid/);
  assert.match(todo['.validate'], /newData\.child\('ownerUid'\)\.val\(\) === \$uid/);
  assert.match(todo['.validate'], /newData\.child\('revision'\)\.val\(\) === data\.child\('revision'\)\.val\(\) \+ 1/);
  assert.match(todo.text['.validate'], /length <= 100/);
  assert.match(todo.memo['.validate'], /length <= 1000/);
  assert.equal(todo.$other['.validate'], false);
  assert.match(emulator, /stopRoomRead = onValue\(roomRef,/);
  assert.match(emulator, /stopRoomRead\?\.\(\)/);
  assert.match(emulator, /Idempotent replay must not write/);
  assert.match(emulator, /ownerUid: 'bob'/);
  assert.match(emulator, /revision: 2, isAdmin: true/);
  assert.match(classic, /stopRoomRead = onValue\(state\.roomRef,/);
});


test('Ver.573 Admin SDK is exclusively configured for Auth + RTDB demo Emulators', () => {
  const pkg = json('package.json');
  const cfg = json('firebase.v568.candidate.json');
  const workflow = load('.github/workflows/regression-checks.yml');
  const adapter = load('security/firebase-admin-staging-v573.mjs');
  const integration = load('test-harness/firebase-admin-staging-v573.mjs');
  const handler = load('security/room-promotion-request-v572.mjs');
  const manifest = load('release-manifest.js');
  assert.equal(pkg.devDependencies['firebase-admin'], '14.5.0');
  assert.match(pkg.scripts['test:admin:v573'], /--only auth,database/);
  assert.match(pkg.scripts['test:admin:v573'], /--project demo-task-kanri-v568/);
  assert.match(pkg.scripts['test:admin:v573'], /--config firebase.v568.candidate.json/);
  assert.equal(cfg.emulators.auth.host, '127.0.0.1');
  assert.equal(cfg.emulators.auth.port, 9099);
  assert.match(workflow, /run: npm run test:admin:v573/);
  assert.match(adapter, /FIREBASE_AUTH_EMULATOR_HOST/);
  assert.match(adapter, /FIREBASE_DATABASE_EMULATOR_HOST/);
  assert.match(adapter, /getAuth\(app\)/);
  assert.match(adapter, /getDatabase\(app\)/);
  assert.match(adapter, /roomsV2\//);
  assert.match(integration, /accounts:signInWithPassword/);
  assert.match(integration, /createUser/);
  assert.match(integration, /updateUser/);
  assert.match(handler, /typeof result\.committed !== 'boolean'/);
  const candidate = load('test-harness/security-rules-v568.mjs');
  assert.match(candidate, /let committedTransaction;/);
  assert.match(candidate, /committedTransaction = await runTransaction/);
  assert.match(candidate, /return committedTransaction;/);
  assert.ok(workflow.indexOf('run: npm run test:rules:v568') < workflow.indexOf('run: npm run test:firebase'));
  assert.ok(workflow.indexOf('run: npm run test:admin:v573') < workflow.indexOf('run: npm run test:firebase'));
  assert.doesNotMatch(manifest, /firebase-admin-staging-v573/);
});


test('Ver.574 future API remains a non-deployed shim with explicit old-client and migration fences', () => {
  const api = load('security/room-promotion-api-v574.mjs');
  const audit = load('security/legacy-room-schema-audit-v574.mjs');
  const integration = load('test-harness/firebase-admin-staging-v573.mjs');
  const legacyRules = json('firebase-rules.json');
  const release = load('release-manifest.js');
  const oldApp = load('app.js');
  const parity = load('modern/FEATURE_PARITY.md');
  assert.match(api, /handleRoomTodoPromotionV572\(/);
  assert.match(api, /body\.schemaVersion !== PROMOTION_SCHEMA_V574/);
  assert.match(api, /ALLOWED_INTENT/);
  assert.match(api, /'cache-control': 'no-store'/);
  assert.match(api, /return response\('indeterminate'/);
  assert.match(api, /renewIdToken: true, automaticRetry: false/);
  assert.match(audit, /scope: 'legacy-read-only'/);
  assert.match(audit, /requiresLosslessTaskSchema: true/);
  assert.match(integration, /VER574_HTTP_COMPAT_AUTH_AND_REPLAY_PASSED/);
  assert.doesNotMatch(release, /room-promotion-api-v574|legacy-room-schema-audit-v574/);
  assert.match(oldApp, /state\.roomRef = ref\(db, \`rooms\/\$\{ROOM_ID\}\`\)/);
  assert.equal(legacyRules.rules.rooms.$roomId['.read'], true);
  assert.equal(legacyRules.rules.rooms.$roomId['.write'], true);
  assert.match(parity, /Ver\.574/);
});


test('Ver.575 uses the existing single Classic audit; no new production migration writer', () => {
  const audit = load('security/legacy-room-schema-audit-v574.mjs');
  const test = load('test-harness/room-promotion-api-v574.test.mjs');
  const integration = load('test-harness/firebase-admin-staging-v573.mjs');
  const app = load('app.js');
  const workflow = load('workflow-v152.js');
  const features = load('work-features-v167.js');
  const release = load('release-manifest.js');
  const parity = load('modern/FEATURE_PARITY.md');
  assert.match(audit, /export function auditLegacyRoomForV574/);
  assert.match(audit, /function inspectRelationsV575/);
  assert.match(audit, /nextRecurringTaskId/);
  assert.match(audit, /workflowV152/);
  assert.match(audit, /businessMemos/);
  assert.match(audit, /sourceSnapshotHashVerified: false/);
  assert.match(test, /Ver\.575 reads related Classic records/);
  assert.match(integration, /VER575_LEGACY_READ_ONLY_AUDIT_PASSED/);
  assert.match(app, /function normalizeTask\(task\)/);
  assert.match(app, /function normalizeSchedule\(schedule\)/);
  assert.match(workflow, /workflowV152/);
  assert.match(features, /businessMemos/);
  assert.match(parity, /Ver\.575/);
  assert.doesNotMatch(release, /legacy-room-schema-audit-v574|room-promotion-api-v574/);
});


test('Ver.576 lossless schema draft is not a migration writer, Rules, or release asset',()=>{
  const candidate=load('security/classic-lossless-schema-v576.mjs');
  const dryRun=load('test-harness/room-promotion-api-v574.test.mjs');
  const admin=load('test-harness/firebase-admin-staging-v573.mjs');
  const rules=json('security/database.rules.v568.candidate.json').rules;
  const classic=load('app.js');
  const release=load('release-manifest.js');
  const parity=load('modern/FEATURE_PARITY.md');
  assert.match(candidate, /evaluateLosslessSchemaV576/);
  assert.match(candidate, /auditLegacyRoomForV574/);
  assert.match(candidate, /roundTripVerified:true/);
  assert.match(candidate, /result:'NO_GO'/);
  assert.match(candidate, /'target-rules-incompatible'/);
  assert.match(candidate, /'identity-approval'/);
  assert.match(candidate, /'personal\/{uid}\/todos'/);
  assert.match(dryRun, /Ver\.576 preserves every Classic JSON field/);
  assert.match(admin, /VER576_LOSSLESS_SCHEMA_DRY_RUN_PASSED/);
  assert.equal(rules.roomsV2.$roomId.shared.tasks.$taskId.$other['.validate'],false);
  assert.match(classic,/state\.roomRef = ref\(db, \`rooms\/\$\{ROOM_ID\}\`\)/);
  assert.match(parity, /Ver\.576/);
  assert.doesNotMatch(release, /classic-lossless-schema-v576/);
});


test('Ver.577 draft-only Rules isolate shared, private and internal reads with no client writers',()=>{
  const v577=json('security/database.rules.v577.candidate.json');
  const cfg=json('firebase.v577.candidate.json');
  const runner=load('test-harness/security-rules-v577.mjs');
  const contract=load('security/staged-task-edit-contract-v577.mjs');
  const tests=load('test-harness/staged-task-edit-contract-v577.test.mjs');
  const pkg=json('package.json');
  const ci=load('.github/workflows/regression-checks.yml');
  const release=load('release-manifest.js');
  const old=json('security/database.rules.v568.candidate.json');
  const node=v577.rules.roomsV2.$roomId;
  assert.equal(v577.rules['.read'],false);
  assert.equal(v577.rules['.write'],false);
  assert.equal(v577.rules.rooms,undefined);
  for(const key of ['.read','.write']){
    for(const n of [node,node.shared,node.personal,node.personal.$uid])
      assert.equal(n[key],false);
  }
  const grants=[];
  const scan=x=>{
    if(!x||typeof x!=='object')return;
    for(const [k,v] of Object.entries(x)){
      if(k==='.write'&&v!==false)grants.push(v);
      if(v&&typeof v==='object'&&!Array.isArray(v))scan(v);
    }
  };
  scan(v577.rules);
  assert.deepEqual(grants,[]);
  assert.equal(node.internal['.read'],false);
  assert.equal(node.operations['.read'],false);
  for(const key of ['tasks','schedules','knowledge','businessMemos','taskStarts'])
    assert.match(node.shared[key]['.read'],/access/);
  for(const key of ['todos','inbox','reminders'])
    assert.match(node.personal.$uid[key]['.read'],/auth.uid === \$uid/);
  assert.equal(old.rules.roomsV2.$roomId.shared.tasks.$taskId.$other['.validate'],false);
  assert.equal(cfg.database.rules,'security/database.rules.v577.candidate.json');
  assert.equal(cfg.emulators.database.host,'127.0.0.1');
  assert.equal(cfg.emulators.database.port,9001);
  assert.match(pkg.scripts['test:rules:v577'],/--project demo-task-kanri-v577/);
  assert.match(pkg.scripts['test:rules:v577'],/--config firebase.v577.candidate.json/);
  assert.match(ci,/run: npm run test:rules:v577/);
  assert.match(runner,/VER577_READ_SCOPES_AND_SERVER_ONLY_WRITES_PASSED/);
  assert.match(contract,/inspectTaskEditContractV577/);
  assert.match(contract,/result:'NO_GO'/);
  assert.match(tests,/Ver\.577 draft contract preserves unknown fields/);
  assert.doesNotMatch(release,/database\.rules\.v577|staged-task-edit-contract-v577/);
});
