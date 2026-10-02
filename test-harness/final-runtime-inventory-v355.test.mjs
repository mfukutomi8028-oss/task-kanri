import test from 'node:test';
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

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function inspectAsset(asset) {
  const source = read(asset);
  return {
    asset,
    bytes: Buffer.byteLength(source, 'utf8'),
    mutationObservers: count(source, /new\s+MutationObserver\s*\(/g),
    documentAdds: count(source, /document\.addEventListener\s*\(/g),
    documentRemoves: count(source, /document\.removeEventListener\s*\(/g),
    windowAdds: count(source, /window\.addEventListener\s*\(/g),
    windowRemoves: count(source, /window\.removeEventListener\s*\(/g),
    mediaAdds: count(source, /(?:matchMedia\([^)]*\)|\bmedia\w*)\.addEventListener\s*\(/g),
    intervals: count(source, /\bsetInterval\s*\(/g),
    timeouts: count(source, /\b(?:window\.)?setTimeout\s*\(/g),
    animationFrames: count(source, /\brequestAnimationFrame\s*\(/g)
  };
}

function activeInventory() {
  const manifest = read('release-manifest.js');
  const dynamicScripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');
  const assets = ['release-manifest.js', 'app.js', 'config.js', ...dynamicScripts, ...mobileScripts];
  assert.equal(new Set(assets).size, assets.length, 'active JavaScript inventory must not contain duplicates');
  for (const asset of assets) assert.ok(fs.existsSync(path.join(ROOT, asset)), `active runtime asset is missing: ${asset}`);
  return assets.map(inspectAsset);
}

test('Ver.355 audit refreshes every active JavaScript runtime wakeup owner at Release 292+', () => {
  const inventory = activeInventory();
  const keys = [
    'mutationObservers', 'documentAdds', 'documentRemoves', 'windowAdds', 'windowRemoves',
    'mediaAdds', 'intervals', 'timeouts', 'animationFrames'
  ];
  const totals = Object.fromEntries(keys.map(key => [key, 0]));
  for (const item of inventory) for (const key of keys) totals[key] += item[key];

  const owners = inventory.filter(item => keys.some(key => item[key] > 0));
  console.log('V355_RUNTIME_OWNER_SUMMARY', JSON.stringify(owners));
  console.log('V355_RUNTIME_TOTALS', JSON.stringify(totals));

  const names = new Set(inventory.map(item => item.asset));
  for (const expected of [
    'list-column-sort-v229.js', 'desktop-sidebar-v242.js', 'comment-mentions-v191.js',
    'comment-reactions-v191.js', 'work-features-v167.js', 'mobile-shell-v234.js',
    'comments-tabs-v149.js', 'archive-ui-v182.js', 'reminders-v152.js'
  ]) assert.ok(names.has(expected), `${expected} must remain in the active runtime inventory`);
});

test('Ver.355 audit keeps the Ver.346-354 comment reaction cleanup boundaries intact', () => {
  const reactions = read('comment-reactions-v191.js');
  assert.match(reactions, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(reactions, /root\.addEventListener\(['"]click['"]/);
  assert.match(reactions, /root\.addEventListener\(['"]submit['"]/);
  assert.match(reactions, /root\.addEventListener\(['"]keydown['"]/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"]submit['"]/);
  assert.doesNotMatch(reactions, /document\.addEventListener\(['"]keydown['"]/);
  assert.match(reactions, /document\.addEventListener\(['"]click['"],\s*handlePickerOutsideClick/);
  assert.match(reactions, /document\.removeEventListener\(['"]click['"],\s*handlePickerOutsideClick/);
  assert.match(reactions, /pickerOutsideClickBound/);
  assert.match(reactions, /mutationTouchesCommentSurfaceV354/);
  assert.match(reactions, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Ver.355 audit does not reopen already justified polling owners by static count alone', () => {
  const dependencies = read('dependencies-v149.js');
  const savedViews = read('saved-views-v148.js');
  const completion = read('completion-unpin-v150.js');
  const inboxEvents = read('inbox-events-v183.js');
  const reminders = read('reminders-v152.js');
  const insights = read('insights-v148.js');

  assert.doesNotMatch(dependencies, /\bsetInterval\s*\(/, 'dependency 60s polling must stay retired');
  assert.doesNotMatch(savedViews, /\bsetInterval\s*\(/, 'saved-view dormant polling must stay retired');
  assert.match(completion, /\bsetInterval\s*\(/, 'local completion repair fallback remains intentional');
  assert.match(completion, /1500/, 'completion fallback keeps its audited 1500ms cadence');
  assert.match(inboxEvents, /\bsetInterval\s*\(/, 'local inbox task-snapshot fallback remains intentional');
  assert.match(inboxEvents, /1500/, 'inbox fallback keeps its audited 1500ms cadence');
  assert.match(reminders, /setInterval\(schedule,\s*30000\)/, 'reminder due-time detection remains time-driven');
  assert.match(insights, /setInterval\(schedule,\s*60000\)/, 'relative timing display remains minute-driven');
});

test('Ver.355 audit isolates comments-tabs subtree observation as the next narrow wakeup candidate', () => {
  const tabs = read('comments-tabs-v149.js');
  assert.match(tabs, /const\s+root\s*=\s*document\.getElementById\(['"]detailBody['"]\)/);
  assert.match(tabs, /new\s+MutationObserver\([\s\S]*?\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(tabs, /detail\.querySelector\(['"]:scope > \.task-detail-tabs-v149['"]\)\)return/);

  const archive = read('archive-ui-v182.js');
  assert.match(archive, /setInterval\(autoArchive,\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/);
  assert.match(archive, /AUTO_ARCHIVE_DAYS\s*=\s*90/);
});

test('Ver.355 audit is evidence-only and keeps release inventory synchronized with responsibility baseline', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 292);
  assert.equal(String(responsibilities.baselineRelease), release);
});
