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
  ['activity-dialog-v130.css', 'ui-activity-dialog-v193.css'],
  ['list-sort-v131.css', 'ui-task-list-sort-v193.css']
];

test('Ver.193 activates semantic activity/list presentation CSS and retires generic legacy names', () => {
  const manifest = read('release-manifest.js');
  const version = Number(manifest.match(/version:\s*"(\d+)"/)?.[1]);
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.ok(version >= 193, 'Ver.193 presentation ownership must remain active in later releases');
  assert.equal(styles[0], 'ui-activity-dialog-v193.css', 'activity dialog CSS must keep the former first dynamic-style position');
  assert.equal(styles[1], 'ui-task-list-sort-v193.css', 'list-sort CSS must keep the former second dynamic-style position');
  assert.ok(styles.indexOf('ui-task-list-sort-v193.css') < styles.indexOf('ui-todo-light-v189.css'));

  for (const [legacy, current] of pairs) {
    assert.equal(styles.filter(item => item === current).length, 1, `${current} must be active exactly once`);
    assert.ok(required.includes(current), `${current} must be required`);
    assert.ok(!styles.includes(legacy), `${legacy} must not remain dynamically active`);
    assert.ok(!required.includes(legacy), `${legacy} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `${legacy} must remain physically available for cached manifests`);
  }
});

test('Ver.193 presentation CSS bodies remain byte-equivalent to the proven legacy assets', () => {
  for (const [legacy, current] of pairs) {
    assert.equal(read(current), read(legacy), `${current} must remain byte-equivalent to ${legacy}`);
  }
});

test('Ver.193 changes CSS ownership only and preserves existing dialog/list-sort execution paths', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const html = read('index.html');
  const listSort = read('list-sort-v131.js');

  assert.match(html, /id="activityDialog" class="dialog activity-dialog"/,
    'the existing activity dialog DOM contract must remain the owner of the renamed CSS');
  assert.match(listSort, /list-sortable-header/);
  assert.match(listSort, /list-column-sort-status/);
  assert.equal(scripts.filter(item => item === 'list-sort-v131.js').length, 1,
    'the established list-sort JavaScript must remain active exactly once');
  assert.ok(required.includes('list-sort-v131.js'));
  assert.equal(scripts.filter(name => /v193\.js$/.test(name)).length, 0,
    'Ver.193 must not add a new JavaScript execution path');
});
