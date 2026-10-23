import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

const workflow = read('workflow-core-v150.js');
const dependencies = read('dependencies-v149.js');
const savedViews = read('saved-views-v148.js');
const relationships = read('relationships-v152.js');
const inventory = JSON.parse(read('patch-responsibilities.json'));

test('Ver.248 product boundary stays active in Ver.248 or later releases', () => {
  const manifest = read('release-manifest.js');
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 248, `expected Ver.248 or later, got ${release}`);
  assert.match(manifest, new RegExp(`const VERSION = ["']${release}["']`));
  for (const asset of ['workflow-core-v150.js', 'dependencies-v149.js', 'saved-views-v148.js', 'relationships-v152.js']) assert.ok(manifest.includes(asset));
});

test('Ver.248 product: dependency write commits only against rendered expected base', () => {
  assert.match(workflow, /async function writeDependencies\(taskId,ids,expectedIds\)/);
  assert.match(workflow, /sameIdList\(current,expected,id\)/);
  assert.match(workflow, /conflict:true/);
  assert.match(dependencies, /writeDependencies\(task\.id,\[\.\.\.ids,id\],ids\)/);
  assert.match(dependencies, /writeDependencies\(task\.id,ids\.filter\([^\n]+,ids\)/);
});

test('Ver.248 product: saved-view write keeps exact server metadata protection after legacy UI retirement', () => {
  assert.match(workflow, /async function writeSavedView\(id,view,expectedView\)/);
  assert.match(workflow, /sameSavedViewValue\(current,expected\)/);
  assert.match(workflow, /updatedAt:Number\(item\.updatedAt\|\|0\)/);
  assert.match(workflow, /runTransaction\(target,current=>\{if\(!sameSavedViewValue\(current,expected\)\)/);
  assert.match(workflow, /writeDependencies,writeSavedView,writeRelations,writeReminder/);
  assert.doesNotMatch(savedViews, /writeSavedView\(/);
  assert.doesNotMatch(savedViews, /saveCurrentFilter/);
  assert.match(inventory.groups?.find(item => item.id === 'workflow-and-detail')?.reason || '', /Ver\.336製品/);
});

test('Ver.248 product: relation root transaction protects direct base and repairs reverse-only edges', () => {
  assert.match(workflow, /async function writeRelations\(taskId,ids,expectedIds\)/);
  assert.match(workflow, /const direct=normalizeIdList\(next\[id\],id\)/);
  assert.match(workflow, /sameIdList\(direct,expected,id\)/);
  assert.match(workflow, /Object\.entries\(next\).*map&&typeof map==='object'&&map\[id\]===true/s);
  assert.match(relationships, /writeRelations\(id,\[\.\.\.ids,other\],ids\)/);
  assert.match(relationships, /writeRelations\(id,ids\.filter\([^\n]+,ids\)/);
});

test('Ver.248 product: four emulator regressions run in isolated browser processes', () => {
  const pkg = JSON.parse(read('package.json'));
  const runner = read('test-harness/run-firebase-grep-audits-v480.mjs');
  assert.match(pkg.scripts?.['test:firebase:browser'] || '', /run-firebase-browser\.mjs && node test-harness\/run-firebase-grep-audits-v480\.mjs/);
  for (const phrase of ['stale dependency edit preserves the remote winner','stale saved view preserves newer server metadata','stale relation edit preserves newer peer','relation writer repairs a reverse-only orphan edge']) assert.ok(runner.includes(`'${phrase}'`));
  assert.match(runner, /spawnSync\(process\.execPath/);
  assert.match(runner, /WORK_BOARD_FIREBASE_E2E: '1'/);
  assert.match(runner, /--workers=1', '--grep', grep/);
  assert.match(runner, /if \(result\.error\)/);
  assert.match(runner, /if \(\(result\.status \?\? 1\) !== 0\)/);
});

test('Ver.248 product: inventory keeps the hardened workflowV148 boundary in later releases', () => {
  assert.ok(Number(inventory.baselineRelease || 0) >= 248,
    `expected responsibility baseline Ver.248 or later, got ${inventory.baselineRelease}`);
  assert.equal(inventory.groups?.find(item => item.id === 'workflow-and-detail')?.consolidation, 'consolidated-v248');
});

// Ver.519: retained unchanged Ver.332 Protocol checks after owner co-location.
{
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [dependencies, workflowCore, manifest, responsibilityText, browserProduct] = await Promise.all([
  read('dependencies-v149.js'),
  read('workflow-core-v150.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/dependencies-polling-audit-v331.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.332 product: dependency sidecar keeps event and DOM reconciliation while retiring the 60s timer', () => {
  assert.match(dependencies, /window\.addEventListener\('workflow-v148-update',schedule\)/);
  assert.match(dependencies, /window\.addEventListener\('workflow-v149-update',schedule\)/);
  assert.match(dependencies, /new MutationObserver\([\s\S]*?schedule\(\)[\s\S]*?mainContent/);
  assert.doesNotMatch(dependencies, /setInterval\(schedule,60000\)/);
  assert.match(dependencies, /window\.WorkBoardCompletionGuardV149=\{guardCompletion,blockers,wouldCycle\}/);
  assert.match(dependencies, /patch\(\);\s*\n?\}\)\(\);/);
});

test('Ver.332 product: workflow dependency writes keep explicit reconciliation events', () => {
  assert.match(workflowCore, /function emit\(\)\{persist\(\);window\.dispatchEvent\(new CustomEvent\('workflow-v148-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v149-update'\)\);window\.dispatchEvent\(new CustomEvent\('workflow-v150-update'\)\)\}/);
  assert.match(workflowCore, /function applyDependenciesLocal[\s\S]*?emit\(\)/);
  assert.match(workflowCore, /async function writeDependencies[\s\S]*?applyDependenciesLocal/);
});

test('Ver.332 product: browser regression exercises the active runtime and proves no dependency 60s timer is registered', () => {
  assert.match(browserProduct, /Number\(delay\) === 60000 && stack\.includes\('dependencies-v149\.js'\)/);
  assert.match(browserProduct, /owned60s: window\.__v332DependencyIntervals\.length/);
  assert.match(browserProduct, /toEqual\(\{ owned60s: 0 \}\)/);
  assert.match(browserProduct, /data-quick-task-status/);
  assert.match(browserProduct, /data-remove-dependency-v149/);
  assert.doesNotMatch(browserProduct, /page\.route\([^\n]*dependencies-v149\.js/);
});

test('Ver.332 product: release 283 promotion remains recorded in later aligned releases', () => {
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 283, `expected release 283 or later, got ${release}`);
  assert.equal(responsibilities.baselineRelease, String(release));

  const workflowGroup = responsibilities.groups?.find(group => group.id === 'workflow-and-detail');
  assert.match(workflowGroup?.reason || '', /Ver\.331監査/);
  assert.match(workflowGroup?.reason || '', /Ver\.332製品/);
  assert.match(workflowGroup?.reason || '', /release 283/);
});
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
