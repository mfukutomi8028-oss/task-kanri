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
  assert.equal(candidate.rules.access.$roomId.members.$uid['.write'], false);
  assert.equal(candidate.rules.roomsV2.$roomId['.read'], undefined);
  assert.equal(candidate.rules.roomsV2.$roomId['.write'], undefined);
  assert.equal(candidate.rules.personalV2.$uid.$roomId['.read'], undefined);
  assert.equal(candidate.rules.personalV2.$uid.$roomId['.write'], undefined);
  const taskRule = candidate.rules.roomsV2.$roomId.shared.tasks.$taskId['.write'];
  const privateRule = candidate.rules.personalV2.$uid.$roomId.todos.$todoId['.write'];
  assert.match(taskRule, /auth != null/);
  assert.match(taskRule, /root.child\('access'\)/);
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
  assert.match(note, /ルーム全体/);
});
