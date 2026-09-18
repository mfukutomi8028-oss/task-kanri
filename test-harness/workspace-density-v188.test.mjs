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

test('Ver.224 keeps core density CSS active while retiring the no-op JavaScript sidecar', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);

  assert.ok(release >= 224, `core density sidecar retirement requires release 224 or later, got ${release}`);

  const currentStyle = 'ui-core-density-v188.css';
  const retiredScript = 'core-view-density-v188.js';
  assert.equal(styles.filter(item => item === currentStyle).length, 1, `${currentStyle} must load exactly once`);
  assert.ok(required.includes(currentStyle), `${currentStyle} must remain required`);
  assert.equal(scripts.filter(item => item === retiredScript).length, 0, `${retiredScript} must no longer load dynamically`);
  assert.ok(!required.includes(retiredScript), `${retiredScript} must no longer be required`);
  assert.ok(fs.existsSync(path.join(ROOT, retiredScript)), `${retiredScript} must remain physically available for cached manifests and rollback`);

  for (const legacy of ['ui-v176.css', 'workspace-density-v176.js']) {
    assert.ok(!styles.includes(legacy), `${legacy} must not remain an active style`);
    assert.ok(!scripts.includes(legacy), `${legacy} must not remain an active script`);
    assert.ok(!required.includes(legacy), `${legacy} must not remain required`);
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `${legacy} must remain physically available for cached manifests`);
  }
});

test('Ver.224 keeps Today and Schedule app-owned after the density sidecar leaves active runtime', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const todoCssName = styles.includes('ui-todo-light-v189.css') ? 'ui-todo-light-v189.css' : 'ui-v145.css';
  const todoCss = read(todoCssName);
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
  const retiredCoreJs = read('core-view-density-v188.js');
  const app = read('app.js');
  assert.match(coreCss, /body\.today-mode \.activity-panel \.activity-actions/);
  assert.match(coreCss, /body\.schedule-mode \.schedule-toolbar-v176/);
  assert.doesNotMatch(retiredCoreJs, /MutationObserver/);
  assert.doesNotMatch(retiredCoreJs, /observeRoot\(/);
  assert.doesNotMatch(retiredCoreJs, /patchSchedule\s*\(/);
  assert.doesNotMatch(retiredCoreJs, /patchToday\s*\(/);
  assert.match(retiredCoreJs, /observers: Object\.freeze\(\{ today: null, schedule: null \}\)/);
  assert.match(retiredCoreJs, /__WB_CORE_VIEW_DENSITY_V188__/);
  assert.match(app, /function renderScheduleNotificationSidebar\s*\(/);
  assert.match(app, /today-action-divider-v220/);
  assert.match(app, /today-compact-action-v176/);
  assert.match(app, /function bindScheduleSearchProxy\s*\(/);
  assert.match(app, /schedule-toolbar-v176/);
  assert.match(app, /schedule-toolbar-controls-v176/);
  assert.match(app, /schedule-toolbar-utility-v176/);
  assert.match(app, /schedule-date-v176/);
  assert.match(app, /schedule-search-v176/);
  assert.doesNotMatch(app, /today-head today-head-after-activity/);
  assert.doesNotMatch(app, /class="schedule-actions"/);
  assert.doesNotMatch(app, /class="schedule-title-block"/);
});
