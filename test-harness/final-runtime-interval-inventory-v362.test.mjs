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

function countIntervals(source) {
  return [...source.matchAll(/\bsetInterval\s*\(/g)].length;
}

function activeScripts() {
  const manifest = read('release-manifest.js');
  const assets = ['release-manifest.js', 'app.js', 'config.js', ...extractStringArray(manifest, 'dynamicScripts'), ...extractStringArray(manifest, 'mobileScripts')];
  assert.equal(new Set(assets).size, assets.length, 'active JavaScript inventory must not contain duplicates');
  assets.forEach(asset => assert.ok(fs.existsSync(path.join(ROOT, asset)), `missing active asset: ${asset}`));
  return assets;
}

test('Ver.362 active runtime interval inventory is exactly four registrations', () => {
  const owners = activeScripts()
    .map(asset => ({ asset, intervals: countIntervals(read(asset)) }))
    .filter(item => item.intervals > 0)
    .sort((a, b) => a.asset.localeCompare(b.asset));

  assert.deepEqual(owners, [
    { asset: 'archive-ui-v182.js', intervals: 1 },
    { asset: 'completion-unpin-v150.js', intervals: 1 },
    { asset: 'inbox-events-v183.js', intervals: 1 },
    { asset: 'reminders-v152.js', intervals: 1 }
  ]);
  assert.equal(owners.reduce((sum, item) => sum + item.intervals, 0), 4);
});

test('Ver.362 confirms recently retired high-frequency interval owners stay retired', () => {
  for (const asset of [
    'app.js',
    'insights-v148.js',
    'dependencies-v149.js',
    'saved-views-v148.js',
    'work-features-v167.js',
    'mobile-shell-v234.js'
  ]) {
    assert.equal(countIntervals(read(asset)), 0, `${asset} must stay interval-free`);
  }
});

test('Ver.362 records the remaining interval responsibilities without weakening required fallbacks', () => {
  const completion = read('completion-unpin-v150.js');
  const inbox = read('inbox-events-v183.js');
  const reminders = read('reminders-v152.js');
  const archive = read('archive-ui-v182.js');

  assert.match(completion, /setInterval\(localRepair,1500\)/);
  assert.match(inbox, /setInterval\(\(\)=>\{[\s\S]*?processSnapshot\(map\)[\s\S]*?\},1500\)/);
  assert.match(reminders, /setInterval\(schedule,30000\)/);
  assert.match(archive, /setInterval\(autoArchive,6\*60\*60\*1000\)/);
});

test('Ver.362 identifies personal reminder polling as the next time-boundary audit candidate', () => {
  const reminders = read('reminders-v152.js');

  assert.match(reminders, /function notifyDue\(\)/);
  assert.match(reminders, /Number\(item\.at\)>now/);
  assert.match(reminders, /Notification\.permission==='granted'/);
  assert.match(reminders, /function stateLabel\(item\)[\s\S]*?diff<=86400000/);
  assert.match(reminders, /function dueItems\(\)[\s\S]*?end\.setHours\(23,59,59,999\)/);
  assert.match(reminders, /\['workflow-v152-update','workflow-v150-update'\][\s\S]*?addEventListener\(name,schedule\)/);
  assert.match(reminders, /MutationObserver/);
});

test('Ver.362 audit is release-neutral and follows Ver.361 Release 295', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/const VERSION = ['"](\d+)['"]/)?.[1];

  assert.ok(Number(release) >= 295);
  assert.equal(String(responsibilities.baselineRelease), release);
});
