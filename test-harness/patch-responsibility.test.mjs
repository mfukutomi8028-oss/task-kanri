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

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

test('patch responsibility inventory covers every dynamic patch exactly once', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const live = [...styles, ...scripts];

  const inventory = JSON.parse(read('patch-responsibilities.json'));
  assert.equal(inventory.schemaVersion, 1);
  assert.ok(Array.isArray(inventory.groups) && inventory.groups.length > 0, 'responsibility groups are required');

  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(release, 'release version must be readable from release-manifest.js');
  assert.equal(inventory.baselineRelease, release,
    'patch responsibility baseline must be updated with the active release');

  const groupIds = inventory.groups.map(group => group.id);
  assert.equal(new Set(groupIds).size, groupIds.length, 'responsibility group ids must be unique');

  const riskLevels = new Set(['low', 'medium', 'high']);
  const dispositions = new Set([
    'hold',
    'first-candidate',
    'candidate-after-write-tests',
    'candidate-after-visual-baseline',
    'consolidated-v178',
    'consolidated-v188',
    'consolidated-v189',
    'consolidated-v190',
    'consolidated-v191',
    'consolidated-v192',
    'consolidated-v193'
  ]);

  const mapped = [];
  for (const group of inventory.groups) {
    assert.ok(group.id && group.label && group.reason, `group metadata is incomplete: ${group.id || '(missing id)'}`);
    assert.ok(riskLevels.has(group.risk), `invalid risk for ${group.id}: ${group.risk}`);
    assert.ok(dispositions.has(group.consolidation),
      `invalid consolidation policy for ${group.id}: ${group.consolidation}`);
    assert.ok(Array.isArray(group.assets) && group.assets.length > 0, `group ${group.id} must contain assets`);

    for (const asset of group.assets) {
      assert.ok(/\.(?:css|js)$/.test(asset), `mapped dynamic patch must be CSS or JS: ${asset}`);
      assert.ok(fs.existsSync(path.join(ROOT, asset)), `mapped patch file is missing: ${asset}`);
      mapped.push(asset);
    }
  }

  assert.equal(new Set(mapped).size, mapped.length, 'a dynamic patch is assigned to more than one responsibility group');
  assert.deepEqual(sorted(mapped), sorted(live),
    'responsibility inventory must match dynamicStyles + dynamicScripts exactly');

  const firstCandidates = inventory.groups.filter(group => group.consolidation === 'first-candidate');
  assert.ok(firstCandidates.length <= 1, 'at most one first consolidation candidate should be declared');
  if (firstCandidates.length === 1) {
    assert.equal(firstCandidates[0].risk, 'low', 'the first consolidation candidate must remain low risk');
  }
});

test('cleanup priorities reference only live mapped patches and have unique order', () => {
  const inventory = JSON.parse(read('patch-responsibilities.json'));
  const mapped = new Set(inventory.groups.flatMap(group => group.assets));
  const priorities = inventory.priorityCandidates || [];

  assert.ok(priorities.length > 0, 'at least one cleanup priority is required');
  const orders = priorities.map(item => item.order);
  assert.equal(new Set(orders).size, orders.length, 'cleanup priority order must be unique');
  assert.equal(Math.min(...orders), 1, 'cleanup priorities must start at order 1');

  for (const item of priorities) {
    assert.ok(Number.isInteger(item.order) && item.order > 0, 'cleanup priority order must be a positive integer');
    assert.ok(item.goal && item.precondition, `cleanup priority ${item.order} needs goal and precondition`);
    assert.ok(Array.isArray(item.scope) && item.scope.length > 0, `cleanup priority ${item.order} needs a scope`);
    for (const asset of item.scope) {
      assert.ok(mapped.has(asset), `cleanup priority references an unmapped/non-live patch: ${asset}`);
    }
  }
});

test('Ver.189 splits lightweight CSS by feature while preserving write-side boundaries', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  const currentStyles = [
    'ui-todo-light-v189.css',
    'ui-task-light-v189.css',
    'ui-schedule-mobile-v189.css'
  ];
  const legacyStyles = ['ui-v144.css', 'ui-v145.css', 'ui-v146.css', 'ui-v147.css'];
  const unchangedSidecars = [
    'todo-controls-v144.js',
    'todo-tools-v145.js',
    'todo-history-v146.js',
    'task-ux-v146.js',
    'todo-preview-v147.js'
  ];

  for (const name of currentStyles) {
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.ok(required.includes(name), `${name} must be required`);
  }
  for (const name of legacyStyles) {
    assert.ok(!styles.includes(name), `${name} must not remain dynamically active`);
    assert.ok(!required.includes(name), `${name} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} must remain physically available for cached manifests`);
  }
  for (const name of unchangedSidecars) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must remain active exactly once`);
    assert.ok(required.includes(name), `${name} must remain required`);
  }

  const todo = read('ui-todo-light-v189.css');
  assert.match(todo, /todo-state-toggle-v144/);
  assert.match(todo, /todo-tools-v145/);
  assert.match(todo, /todo-history-v146/);
  assert.match(todo, /todo-preview-open-line-v147/);
  assert.doesNotMatch(todo, /body\.task-mode/);
  assert.doesNotMatch(todo, /body\.schedule-mode/);
  assert.doesNotMatch(todo, /detail-status-control-v146/);

  const task = read('ui-task-light-v189.css');
  assert.match(task, /body\.task-mode/);
  assert.match(task, /detail-status-control-v146/);
  assert.doesNotMatch(task, /todo-tools-v145/);
  assert.doesNotMatch(task, /schedule-calendar/);

  const schedule = read('ui-schedule-mobile-v189.css');
  assert.match(schedule, /schedule-calendar/);
  assert.doesNotMatch(schedule, /body\.task-mode/);
  assert.doesNotMatch(schedule, /\.todo-/);

  const app = read('app.js');
  assert.match(app, /todoPromotionContext/,
    'promotion context must remain in the base application write path');
  assert.match(app, /commitTodoRecord\('todo-promote'/,
    'promoted ToDo completion must remain on the revision-checked base write path');
  assert.match(app, /canPromoteTodo/,
    'promotion revision/owner/id guard must remain active in the base application');
});
