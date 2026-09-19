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

function bodyBetween(source, startPattern, endPattern, label) {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `${label} start must exist`);
  const tail = source.slice(start);
  const end = tail.search(endPattern);
  assert.notEqual(end, -1, `${label} end must exist`);
  return tail.slice(0, end);
}

test('Ver.245 audit: workflow core and enhancement load once in canonical order on the completed Ver.244 baseline', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 244);
  assert.equal(scripts.filter(name => name === 'workflow-core-v150.js').length, 1);
  assert.equal(scripts.filter(name => name === 'workflow-v152.js').length, 1);
  assert.ok(required.includes('workflow-core-v150.js'));
  assert.ok(required.includes('workflow-v152.js'));
  assert.ok(scripts.indexOf('workflow-core-v150.js') < scripts.indexOf('workflow-v152.js'));
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('dependencies-v149.js'));
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('relationships-v152.js'));
  assert.ok(scripts.indexOf('workflow-v152.js') < scripts.indexOf('reminders-v152.js'));
});

test('Ver.245 audit: V150 owns workflowV148 persistence and app.js does not directly own workflow sidecar paths', () => {
  const core = read('workflow-core-v150.js');
  const app = read('app.js');

  assert.match(core, /rooms\/\$\{ROOM_ID\}\/workflowV148/);
  assert.match(core, /workflowV148\/dependencies\/\$\{taskId\}/);
  assert.match(core, /workflowV148\/savedViews\/\$\{id\}/);
  assert.match(core, /workflowV148\/relations/);
  assert.match(core, /workflowV148\/reminders\/\$\{u\}\/\$\{id\}/);
  assert.match(core, /runTransaction\(target,/);
  assert.doesNotMatch(core, /rooms\/\$\{ROOM_ID\}\/tasks/,
    'workflow sidecar must not become a second owner of canonical app task records');
  assert.doesNotMatch(app, /workflowV148|workflowV152/,
    'app.js should remain the task/schedule/knowledge owner and leave workflow sidecar paths to workflow assets');
});

test('Ver.245 audit: V152 owns workflowV152 inbox/archive/duplicate data without duplicating dependency or relation writers', () => {
  const core = read('workflow-core-v150.js');
  const enhanced = read('workflow-v152.js');

  assert.match(enhanced, /rooms\/\$\{ROOM_ID\}\/workflowV152/);
  assert.match(enhanced, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.match(enhanced, /workflowV152\/archives\/\$\{id\}/);
  assert.match(enhanced, /workflowV152\/duplicates\/\$\{id\}/);
  assert.doesNotMatch(enhanced, /async function writeDependencies/);
  assert.doesNotMatch(enhanced, /async function writeRelations/);
  assert.doesNotMatch(enhanced, /async function writeSavedView/);
  assert.match(core, /async function writeDependencies/);
  assert.match(core, /async function writeRelations/);
  assert.match(core, /async function writeSavedView/);
});

test('Ver.245 audit: V152 replaces only the reminder writer and currently weakens the V150 child transaction to blind set/remove', () => {
  const core = read('workflow-core-v150.js');
  const enhanced = read('workflow-v152.js');
  const coreReminder = bodyBetween(core, /async function writeReminder\(/, /\n  load\(\);/, 'V150 writeReminder');
  const enhancedReminder = bodyBetween(enhanced, /async function writeReminder\(/, /\n  Base\.writeReminder=writeReminder;/, 'V152 writeReminder');

  assert.match(coreReminder, /runTransaction\(target,\(\)=>next/);
  assert.doesNotMatch(coreReminder, /await r\.(?:set|remove)\(/);
  assert.match(enhancedReminder, /if\(next\)await r\.set\(target,next\);else await r\.remove\(target\)/);
  assert.match(enhancedReminder, /const check=await r\.get\(target\)/);
  assert.doesNotMatch(enhancedReminder, /runTransaction/,
    'current V152 reminder writer has no compare-and-swap protection for a concurrent remote winner');
  assert.match(enhanced, /Base\.writeReminder=writeReminder/,
    'V152 intentionally replaces the V150 reminder writer for downstream consumers');
});

test('Ver.245 audit: target persistence sidecars own no DOM MutationObserver or DOM event listener', () => {
  const core = read('workflow-core-v150.js');
  const enhanced = read('workflow-v152.js');
  const relations = read('relationships-v152.js');
  const reminders = read('reminders-v152.js');

  for (const source of [core, enhanced]) {
    assert.doesNotMatch(source, /MutationObserver/);
    assert.doesNotMatch(source, /addEventListener\(/);
  }

  assert.match(relations, /document\.getElementById\('detailBody'\)/);
  assert.match(relations, /\.observe\(root,\{childList:true,subtree:true\}\)/);
  assert.match(reminders, /observe\(document\.getElementById\('mainContent'\)\)/);
  assert.match(reminders, /observe\(document\.getElementById\('detailBody'\)\)/);
  assert.doesNotMatch(relations, /observe\(document\.body/);
  assert.doesNotMatch(reminders, /observe\(document\.body/);
});

test('Ver.245 audit: inventory records the reminder race and narrows the next product candidate to workflow-v152 only', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const group = inventory.groups.find(item => item.id === 'workflow-and-detail');
  const candidate = inventory.priorityCandidates?.[0];

  assert.equal(inventory.baselineRelease, '244');
  assert.ok(group);
  assert.match(group.reason, /Ver\.245監査/);
  assert.match(group.reason, /workflowV148/);
  assert.match(group.reason, /workflowV152/);
  assert.match(group.reason, /blind set\/remove/);
  assert.deepEqual(candidate?.scope, ['workflow-v152.js']);
  assert.match(candidate?.goal || '', /リマインダー/);
  assert.match(candidate?.goal || '', /競合/);
  assert.match(candidate?.precondition || '', /Ver\.245監査PR/);
});
