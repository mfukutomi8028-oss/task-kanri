// Ver.486: prevent retired sidebar screenshots from returning without a visual owner.
// Keep all active visual-suite baselines; this audit never mutates source or data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
const SIDEBAR_SPEC = 'sidebar-visual.spec.mjs';
const SIDEBAR_SNAPSHOTS = SIDEBAR_SPEC + '-snapshots';
const RETIRED_SIDEBAR_FILES = Object.freeze([
  'sidebar-1366-collapsed-linux.png',
  'sidebar-1366-expanded-linux.png',
  'sidebar-1366-pinned-linux.png',
  'sidebar-861-collapsed-linux.png',
  'sidebar-861-expanded-linux.png',
  'sidebar-980-collapsed-linux.png',
  'sidebar-980-expanded-linux.png',
  'sidebar-980-pinned-linux.png'
]);
const ACTIVE_SNAPSHOT_OWNERS = Object.freeze([
  'icon-visual.spec.mjs',
  'mobile-regression-v187.spec.mjs',
  'task-toolbar-visual.spec.mjs',
  'workflow-inbox-archive-visual.spec.mjs',
  'workspace-density-v188.spec.mjs'
]);

function snapshotSuites() {
  return fs.readdirSync(TESTS, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith('.spec.mjs-snapshots'))
    .map(entry => {
      const owner = entry.name.slice(0, -'-snapshots'.length);
      const location = path.join(TESTS, entry.name);
      const snapshots = fs.readdirSync(location, { withFileTypes: true })
        .filter(image => image.isFile() && image.name.endsWith('.png'))
        .map(image => image.name).sort();
      return { owner, directory: entry.name, snapshots };
    })
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

test('Ver.486: unused sidebar screenshot baselines are retired, but geometry regressions remain', () => {
  const source = fs.readFileSync(path.join(TESTS, SIDEBAR_SPEC), 'utf8');
  assert.doesNotMatch(source, /\.toHaveScreenshot\s*\(|\.toMatchSnapshot\s*\(/,
    'sidebar visual suite no longer uses any screenshot baselines');
  assert.match(source, /const DESKTOP_CASES = \[1366, 981, 980, 861\]/);
  assert.match(source, /sidebar geometry: /);
  assert.match(source, /sidebar presentation: /);
  assert.match(source, /sidebar boundary: 860px returns to non-desktop layout/);
  assert.match(source, /sidebar geometry remains stable with detail-open/);

  assert.equal(fs.existsSync(path.join(TESTS, SIDEBAR_SNAPSHOTS)), false,
    'an obsolete sidebar baseline directory must not be tracked');
  for (const name of RETIRED_SIDEBAR_FILES) {
    assert.equal(fs.existsSync(path.join(TESTS, SIDEBAR_SNAPSHOTS, name)), false, name);
  }
  assert.equal(RETIRED_SIDEBAR_FILES.length, 8);
});

test('Ver.486: all remaining screenshot directories belong to active Playwright visual suites', () => {
  const suites = snapshotSuites();
  assert.deepEqual(suites.map(row => row.owner).sort(),
    [...ACTIVE_SNAPSHOT_OWNERS].sort(),
    'unknown/orphaned snapshot suite requires manual ownership review');
  let count = 0;
  for (const suite of suites) {
    const owner = path.join(TESTS, suite.owner);
    assert.ok(fs.existsSync(owner), 'visual snapshot owner is missing: ' + suite.owner);
    const source = fs.readFileSync(owner, 'utf8');
    assert.match(source, /\.toHaveScreenshot\s*\(|\.toMatchSnapshot\s*\(/,
      'visual suite no longer consumes baselines: ' + suite.owner);
    assert.ok(suite.snapshots.length > 0, 'visual suite has no baselines: ' + suite.owner);
    count += suite.snapshots.length;
  }
  assert.equal(count, 50, 'remaining visual baselines changed unexpectedly');
});
