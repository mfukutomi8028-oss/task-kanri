import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { LEGACY_CSS_ALIASES } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_BASELINE_GIT_BLOBS = Object.freeze({
  'activity-dialog-v130.css': '73ff989cbbdea3fcfe6613e06e73c11909e60bcd',
  'list-sort-v131.css': '26c63abeca6dc3a931ee3e3c29b75a1514d1e9be',
});
const gitBlobSha = relative => {
  const data = fs.readFileSync(path.join(ROOT, relative));
  return createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
};

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
    assert.equal(fs.existsSync(path.join(ROOT, legacy)), false, `${legacy} must be physically retired from Git`);
    assert.equal(LEGACY_CSS_ALIASES[legacy], current, `${legacy} must be staged for cached browsers`);
  }
});

test('Ver.193 presentation CSS bodies remain byte-equivalent to the proven legacy assets', () => {
  for (const [legacy, current] of pairs) {
    assert.equal(gitBlobSha(current), LEGACY_BASELINE_GIT_BLOBS[legacy], `${current} must preserve ${legacy} historical bytes`);
  }
});

test('Ver.193 presentation contracts remain attached to the current dialog/list-sort execution owners', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const html = read('index.html');
  const listSort = read('list-column-sort-v229.js');

  assert.match(html, /id="activityDialog" class="dialog activity-dialog"/,
    'the existing activity dialog DOM contract must remain the owner of the renamed CSS');
  assert.match(listSort, /list-sortable-header/);
  assert.match(listSort, /list-column-sort-status/);
  assert.equal(scripts.filter(item => item === 'list-column-sort-v229.js').length, 1,
    'the current list-column sort JavaScript must remain active exactly once');
  assert.ok(required.includes('list-column-sort-v229.js'));
  assert.ok(!scripts.includes('list-sort-v131.js'), 'the combined legacy list-sort sidecar must stay inactive after Ver.229');
  assert.equal(scripts.filter(name => /v193\.js$/.test(name)).length, 0,
    'Ver.193 must not add a JavaScript execution path of its own');
});
