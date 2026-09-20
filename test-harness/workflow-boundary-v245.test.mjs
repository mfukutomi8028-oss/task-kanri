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

test('Ver.245 product: workflow core and v152 remain active once in canonical load order', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(version >= 245, 'product contract requires Ver.245 or later');
  assert.equal(scripts.filter(name => name === 'workflow-core-v150.js').length, 1);
  assert.equal(scripts.filter(name => name === 'workflow-v152.js').length, 1);
  assert.ok(scripts.indexOf('workflow-core-v150.js') < scripts.indexOf('workflow-v152.js'));
  assert.ok(required.includes('workflow-core-v150.js'));
  assert.ok(required.includes('workflow-v152.js'));
});

test('Ver.245 product: v150 workflow child ownership remains unchanged and canonical tasks stay app-owned', () => {
  const core = read('workflow-core-v150.js');
  assert.match(core, /workflowV148\/dependencies\/\$\{(?:taskId|id)\}/);
  assert.match(core, /workflowV148\/savedViews\/\$\{(?:id|key)\}/);
  assert.match(core, /workflowV148\/relations/);
  assert.match(core, /workflowV148\/reminders\/\$\{u\}\/\$\{id\}/);
  assert.ok((core.match(/runTransaction\(/g) || []).length >= 4);
  assert.doesNotMatch(core, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
  assert.doesNotMatch(core, /MutationObserver/);
  assert.doesNotMatch(core, /addEventListener\(/);
});

test('Ver.245 product: v152 reminder writer commits only when the server value matches the expected base', () => {
  const v152 = read('workflow-v152.js');
  const writer = v152.match(/async function writeReminder\([\s\S]*?\n  \}\n  Base\.writeReminder=writeReminder/)?.[0] || '';

  assert.ok(writer, 'writeReminder must remain inspectable');
  assert.match(writer, /expectedReminder/);
  assert.match(writer, /arguments\.length>=4/);
  assert.match(writer, /r\.runTransaction\(target,current=>/);
  assert.match(writer, /sameReminderValue\(current,expected\)/);
  assert.match(writer, /tx\.snapshot/);
  assert.match(writer, /conflict:true/);
  assert.match(writer, /最新の内容を反映しました/);
  assert.doesNotMatch(writer, /r\.set\(target/);
  assert.doesNotMatch(writer, /r\.remove\(target/);
  assert.doesNotMatch(writer, /r\.get\(target/);

  assert.match(v152, /workflowV152\/inbox\/\$\{u\}\/\$\{id\}/);
  assert.match(v152, /workflowV152\/archives\/\$\{id\}/);
  assert.match(v152, /workflowV152\/duplicates\/\$\{id\}/);
  assert.doesNotMatch(v152, /rooms\/\$\{ROOM_ID\}\/tasks(?:\/|`)/);
});

test('Ver.245 product: reminder UI passes the rendered reminder as the expected write base', () => {
  const ui = read('reminders-v152.js');

  assert.match(ui, /W\.writeReminder\(id,\{at,note\},undefined,item\)/,
    'detail save must compare against the reminder rendered into the form');
  assert.match(ui, /clearOne\(id,e\.currentTarget,item\)/,
    'detail clear must compare against the reminder rendered into the form');
  assert.match(ui, /clearOne\(id,null,item\)/,
    'completed-task cleanup must retain the item it inspected as its expected base');
  assert.match(ui, /items\.find\(x=>x\.id===id\)\?\.item\|\|null/,
    'Today acknowledgement must retain the rendered reminder as its expected base');
});

test('Ver.245 product: app does not directly own workflowV148 or workflowV152 persistence paths', () => {
  const app = read('app.js');
  assert.doesNotMatch(app, /workflowV148/);
  assert.doesNotMatch(app, /workflowV152/);
  assert.doesNotMatch(app, /WorkBoardWorkflowV(?:148|150|152)/);
});

test('Ver.245 product: responsibility inventory keeps the hardened reminder boundary after later audits advance', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.ok(Number(inventory.baselineRelease || 0) >= 245);
  const group = inventory.groups.find(item => item.id === 'workflow-and-detail');
  assert.ok(group);
  const consolidatedVersion = Number(String(group.consolidation || '').match(/v(\d+)/)?.[1] || 0);
  assert.ok(consolidatedVersion >= 245, 'later workflow consolidation must not regress below Ver.245');
  assert.match(group.reason, /Ver\.245製品/);
  assert.match(group.reason, /expected base/);
  assert.match(group.reason, /transaction/);
  assert.match(group.reason, /remote winner/);
});
