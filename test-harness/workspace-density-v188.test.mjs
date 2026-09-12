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

test('Ver.188 retires the mixed workspace-density assets but keeps legacy files for cached manifests', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');

  assert.match(manifest, /version:\s*"188"/, 'release manifest must identify Ver.188');

  const currentStyle = 'ui-core-density-v188.css';
  const currentScript = 'core-view-density-v188.js';
  for (const name of [currentStyle]) {
    assert.equal(styles.filter(item => item === name).length, 1, `${name} must load exactly once`);
    assert.ok(required.includes(name), `${name} must remain required`);
  }
  for (const name of [currentScript]) {
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must load exactly once`);
    assert.ok(required.includes(name), `${name} must remain required`);
  }

  for (const legacy of ['ui-v176.css', 'workspace-density-v176.js']) {
    assert.ok(!styles.includes(legacy), `${legacy} must not remain an active style`);
    assert.ok(!scripts.includes(legacy), `${legacy} must not remain an active script`);
    assert.ok(!required.includes(legacy), `${legacy} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `${legacy} must remain physically available for cached manifests`);
  }
});

test('Ver.188 assigns compact presentation to owning features and limits the remaining observer scope', () => {
  const todoCss = read('ui-v145.css');
  const todoJs = read('todo-tools-v145.js');
  assert.match(todoCss, /body\.todo-mode \.todo-tools-v145/);
  assert.match(todoCss, /\.todo-tools-actions-v176/);
  assert.match(todoJs, /function compactHeaderIntoTools\(/);
  assert.match(todoJs, /todo-tools-actions-v176/);

  const memoCss = read('ui-v168.css');
  const memoJs = read('work-features-ui-v168.js');
  assert.match(memoCss, /body\.work-memo-mode-v167 \.work-memo-tools-v167/);
  assert.match(memoCss, /\.work-memo-new-v176/);
  assert.match(memoJs, /function patchMemoDensity\(/);
  assert.match(memoJs, /work-memo-new-v176/);

  const coreCss = read('ui-core-density-v188.css');
  const coreJs = read('core-view-density-v188.js');
  assert.match(coreCss, /body\.today-mode \.activity-panel \.activity-actions/);
  assert.match(coreCss, /body\.schedule-mode \.schedule-toolbar-v176/);
  assert.match(coreJs, /observeRoot\('todayView'\)/);
  assert.match(coreJs, /observeRoot\('scheduleView'\)/);
  assert.match(coreJs, /__WB_CORE_VIEW_DENSITY_V188__/);
  assert.doesNotMatch(coreJs, /observe\(document\.body/,
    'Ver.188 density layer must not restore the old document.body-wide MutationObserver');
});
