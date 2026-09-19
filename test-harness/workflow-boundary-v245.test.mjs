import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.245 audit: workflow core and v152 remain active once in canonical load order', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 244, 'audit runs on completed Ver.244 baseline or later');
  assert.equal(scripts.filter(name => name === 'workflow-core-v150.js').length, 1);
  assert.equal(scripts.filter(name => name === 'workflow-v152.js').length, 1);
  assert.ok(scripts.indexOf('workflow-core-v150.js') < scripts.indexOf('workflow-v152.js'));
  assert.ok(required.includes('workflow-core-v150.js'));
  assert.ok(required.includes('workflow-v152.js'));
});

test('Ver.245 audit: v150 owns workflowV148 child transactions without writing canonical task bodies', () => {
  const core = read('workflow-core-v150.js');
  assert.match(core, /workflowV148\/dependencies\/\$\{taskId\}/);
  assert.match(core, /workflowV148\/savedViews\/\$\{id\}/);
  assert.match(core, /workflowV148\/relations/);
  assert.match(core, /workflowV148\/reminders\/\$\{u\}\/\$\{id\}/);
  assert.ok((core.match(/runTransaction\(/g) || []).length >= 4);
  assert.doesNotMatch(core, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
  assert.doesNotMatch(core, /MutationObserver/);
  assert.doesNotMatch(core, /addEventListener\(/);
});

test('Ver.245 audit: v152 owns workflowV152 metadata but overrides the v150 reminder writer on workflowV148', () => {
  const core = read('workflow-core-v150.js');
  const v152 = read('workflow-v152.js');

  assert.match(core, /async function writeReminder\(/);
  assert.match(v152, /async function writeReminder\(/);
  assert.match(v152, /Base\.writeReminder=writeReminder/);
  assert.match(v152, /workflowV148\/reminders\/\$\{u\}\/\$\{id\}/);
  assert.match(v152, /if\(next\)await r\.set\(target,next\);else await r\.remove\(target\)/);
  assert.match(v152, /const check=await r\.get\(target\)/);
  assert.doesNotMatch(v152, /runTransaction\(target/);

  assert.match(v152, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.match(v152, /workflowV152\/archives\/\$\{id\}/);
  assert.match(v152, /workflowV152\/duplicates\/\$\{id\}/);
  assert.doesNotMatch(v152, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
  assert.doesNotMatch(v152, /MutationObserver/);
  assert.doesNotMatch(v152, /addEventListener\(/);
});

test('Ver.245 audit: app does not directly own workflowV148 or workflowV152 persistence paths', () => {
  const app = read('app.js');
  assert.doesNotMatch(app, /workflowV148/);
  assert.doesNotMatch(app, /workflowV152/);
  assert.doesNotMatch(app, /WorkBoardWorkflowV(?:148|150|152)/);
});

test('Ver.245 audit: responsibility inventory records the reminder override as the next product boundary', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.baselineRelease, '244');
  const group = inventory.groups.find(item => item.id === 'workflow-and-detail');
  assert.ok(group);
  assert.match(group.reason, /Ver\.245監査/);
  assert.match(group.reason, /writeReminder/);
  assert.match(group.reason, /上書き/);
  const next = inventory.priorityCandidates?.[0];
  assert.ok(next);
  assert.equal(next.order, 1);
  assert.deepEqual(next.scope, ['workflow-v152.js']);
  assert.match(next.goal, /リマインダー/);
});
