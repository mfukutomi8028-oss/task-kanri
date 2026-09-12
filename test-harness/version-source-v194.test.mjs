import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = fs.readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const stable = fs.readFileSync(new URL('../stable-fixes-v108.js', import.meta.url), 'utf8');
const displayLock = fs.readFileSync(new URL('../version-display-lock.js', import.meta.url), 'utf8');

test('Ver.194 manifest is the release-version source and preserves foundation script order', () => {
  assert.match(manifest, /version:\s*["']194["']/);
  assert.match(manifest, /const VERSION = ["']194["']/);

  const stableIndex = manifest.indexOf('"stable-fixes-v108.js"');
  const dateIndex = manifest.indexOf('"date-keyboard-fix-v127.js"', stableIndex + 1);
  const todayIndex = manifest.indexOf('"schedule-today-lock-v129.js"', dateIndex + 1);
  const sortIndex = manifest.indexOf('"list-sort-v131.js"', todayIndex + 1);
  const versionIndex = manifest.indexOf('"version-display-lock.js"', sortIndex + 1);
  assert.ok(stableIndex >= 0 && stableIndex < dateIndex && dateIndex < todayIndex && todayIndex < sortIndex && sortIndex < versionIndex);
});

test('stable fixes no longer owns or writes a legacy release version', () => {
  assert.doesNotMatch(stable, /const VERSION\s*=\s*["']122["']/);
  assert.doesNotMatch(stable, /WORK_BOARD_VERSION\s*=/);
  assert.match(stable, /WORK_BOARD_RELEASE\?\.version/);

  for (const preservedResponsibility of [
    'patchStatusTabAutoScroll',
    'patchStatusManager',
    'patchDateInputs',
    'patchScheduleRangeLabel',
    'applyTodayFilters'
  ]) {
    assert.match(stable, new RegExp(`function ${preservedResponsibility}\\(`));
  }
});

test('version display lock derives displayed and compatibility versions from the manifest release', () => {
  assert.match(displayLock, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(displayLock, /window\.WORK_BOARD_VERSION\s*=\s*version/);
  assert.doesNotMatch(displayLock, /["']122["']/);
});
