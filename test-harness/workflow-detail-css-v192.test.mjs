import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { LEGACY_CSS_ALIASES } from './build-pages-runtime-v382.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_BASELINE_GIT_BLOBS = Object.freeze({
  'ui-v148.css': '4cd0d028f51b2032dff719013ad61371245dea18',
  'ui-v149.css': 'a3c57fd411f2d88105a2622a8024296c3ab8cd1c',
  'ui-v150.css': '63cdee7c2c643ff79841216a63fd7978f4f4820e',
  'ui-v151.css': 'dfbf31e85777f1c1054a25c8e0a670bded74e0ca',
  'ui-v154.css': '660f2184edf3f83d20a3057e675966d103a1ff03',
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
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, `${name} must be physically retired from Git`);
    assert.equal(LEGACY_CSS_ALIASES[name], pairs.find(([old]) => old === name)?.[1], `${name} must remain available as Pages alias`);
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
    assert.equal(gitBlobSha(newName), LEGACY_BASELINE_GIT_BLOBS[oldName], `${newName} must preserve ${oldName} historical bytes`);
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
