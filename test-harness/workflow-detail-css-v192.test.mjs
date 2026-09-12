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

const pairs = [
  ['ui-v148.css', 'ui-workflow-insights-v192.css'],
  ['ui-v149.css', 'ui-task-prerequisites-comments-v192.css'],
  ['ui-v150.css', 'ui-task-relations-reminders-v192.css'],
  ['ui-v151.css', 'ui-task-detail-responsive-v192.css'],
  ['ui-v154.css', 'ui-task-detail-tools-v192.css']
];

const current = pairs.map(([, next]) => next);
const legacy = pairs.map(([old]) => old);

test('Ver.192 activates feature-owned workflow/detail CSS and retires generic v148-v154 names', () => {
  const manifest = read('release-manifest.js');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1]);
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.ok(version >= 192, 'Ver.192 CSS ownership must remain active in later releases');

  for (const name of current) {
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must be active exactly once`);
    assert.ok(required.includes(name), `${name} must be required`);
  }
  for (const name of legacy) {
    assert.ok(!styles.includes(name), `${name} must not remain dynamically active`);
    assert.ok(!required.includes(name), `${name} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, name)), `${name} must remain physically available for cached manifests`);
  }

  assert.ok(styles.indexOf('ui-workflow-insights-v192.css') < styles.indexOf('ui-task-prerequisites-comments-v192.css'));
  assert.ok(styles.indexOf('ui-task-prerequisites-comments-v192.css') < styles.indexOf('ui-task-relations-reminders-v192.css'));
  assert.ok(styles.indexOf('ui-task-relations-reminders-v192.css') < styles.indexOf('ui-task-detail-responsive-v192.css'));
  assert.ok(styles.indexOf('ui-task-detail-responsive-v192.css') < styles.indexOf('ui-workflow-detail-v186.css'));
  assert.ok(styles.indexOf('ui-inbox-archive-v186.css') < styles.indexOf('ui-task-detail-tools-v192.css'));
  assert.ok(styles.indexOf('ui-task-detail-tools-v192.css') < styles.indexOf('ui-comment-mentions-v191.css'));
});

test('Ver.192 workflow/detail CSS bodies are byte-equivalent to the proven legacy assets', () => {
  for (const [oldName, newName] of pairs) {
    assert.equal(read(newName), read(oldName), `${newName} must stay byte-equivalent to ${oldName}`);
  }
});

test('Ver.192 changes presentation ownership only and keeps workflow/detail JavaScript sidecars unchanged', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const sidecars = [
    'saved-views-v148.js',
    'insights-v148.js',
    'dependencies-v149.js',
    'comments-tabs-v149.js',
    'workflow-core-v150.js',
    'completion-unpin-v150.js',
    'workflow-v152.js',
    'relationships-v152.js',
    'reminders-v152.js',
    'detail-layout-v154.js'
  ];

  for (const name of sidecars) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must remain active exactly once`);
    assert.ok(required.includes(name), `${name} must remain required`);
  }
  assert.equal(scripts.filter(name => /v192\.js$/.test(name)).length, 0,
    'Ver.192 must not introduce a new workflow/detail JavaScript execution path');
});
