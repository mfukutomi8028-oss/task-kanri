import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

function listFiles(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, suffix);
    return entry.name.endsWith(suffix) ? [full] : [];
  });
}

test('release manifest points only to existing assets and keeps dynamic assets in inventory', () => {
  const manifest = read('release-manifest.js');
  const required = extractStringArray(manifest, 'requiredAssets');
  const optional = extractStringArray(manifest, 'optionalAssets');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const mobileScripts = extractStringArray(manifest, 'mobileScripts');

  assert.ok(required.length > 20, 'required asset inventory unexpectedly small');
  assert.equal(new Set(required).size, required.length, 'requiredAssets contains duplicates');
  assert.equal(new Set(styles).size, styles.length, 'dynamicStyles contains duplicates');
  assert.equal(new Set(scripts).size, scripts.length, 'dynamicScripts contains duplicates');

  for (const relative of [...required, ...optional]) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `release asset is missing: ${relative}`);
  }

  for (const relative of [...styles, ...scripts]) {
    assert.ok(required.includes(relative), `dynamic asset must also be required: ${relative}`);
  }
  for (const relative of mobileScripts) {
    assert.ok(required.includes(relative) || optional.includes(relative), `mobile asset must be inventoried: ${relative}`);
  }
});

test('Ver.180 keeps the consolidated sidebar layer before task-toolbar refinements', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');
  const legacySidebarStyles = ['ui-v158.css', 'ui-v159.css', 'ui-v160.css', 'ui-v164.css'];

  assert.ok(styles.includes('ui-sidebar-v180.css'), 'consolidated sidebar CSS must stay active');
  assert.ok(required.includes('ui-sidebar-v180.css'), 'consolidated sidebar CSS must stay required');
  assert.ok(styles.indexOf('ui-sidebar-v180.css') < styles.indexOf('ui-task-toolbar-v179.css'),
    'sidebar v180 must load before task-toolbar v179 to preserve the former v160 -> v179 cascade');

  for (const legacy of legacySidebarStyles) {
    assert.ok(!styles.includes(legacy), `legacy sidebar CSS must not remain dynamically active: ${legacy}`);
    assert.ok(!required.includes(legacy), `legacy sidebar CSS must not remain required: ${legacy}`);
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `legacy sidebar CSS is intentionally retained for cache compatibility: ${legacy}`);
  }
});

test('Ver.181 activates one sidebar script while preserving all three legacy bodies in source order', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const consolidatedName = 'desktop-sidebar-v181.js';
  const legacySidebarScripts = [
    'desktop-sidebar-v158.js',
    'desktop-sidebar-compat-v159.js',
    'sidebar-polish-v160.js'
  ];

  assert.ok(scripts.includes(consolidatedName), 'consolidated sidebar JavaScript must stay active');
  assert.ok(required.includes(consolidatedName), 'consolidated sidebar JavaScript must stay required');
  assert.equal(scripts.filter(name => name === consolidatedName).length, 1,
    'consolidated sidebar JavaScript must be loaded exactly once');
  assert.ok(scripts.indexOf(consolidatedName) < scripts.indexOf('stable-fixes-v108.js'),
    'sidebar v181 must remain at the former sidebar-script position before legacy foundation patches');

  const consolidated = read(consolidatedName);
  let previousIndex = -1;
  for (const legacy of legacySidebarScripts) {
    assert.ok(!scripts.includes(legacy), `legacy sidebar JavaScript must not remain dynamically active: ${legacy}`);
    assert.ok(!required.includes(legacy), `legacy sidebar JavaScript must not remain required: ${legacy}`);
    assert.ok(fs.existsSync(path.join(ROOT, legacy)), `legacy sidebar JavaScript is intentionally retained for cache compatibility: ${legacy}`);

    const legacyBody = read(legacy);
    const index = consolidated.indexOf(legacyBody);
    assert.ok(index >= 0, `consolidated sidebar JavaScript must contain the unchanged legacy body: ${legacy}`);
    assert.ok(index > previousIndex, `legacy sidebar JavaScript bodies must keep original execution order: ${legacy}`);
    previousIndex = index;
  }
});

test('Ver.182 splits archive UI and duplicate merge while retaining the legacy source for cache compatibility', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const archive = 'archive-ui-v182.js';
  const duplicate = 'duplicate-merge-v182.js';
  const legacy = 'archive-duplicate-v153.js';

  for (const name of [archive, duplicate]) {
    assert.ok(scripts.includes(name), `${name} must stay dynamically active`);
    assert.ok(required.includes(name), `${name} must stay required`);
    assert.equal(scripts.filter(item => item === name).length, 1, `${name} must load exactly once`);
  }
  assert.ok(scripts.indexOf(archive) < scripts.indexOf(duplicate),
    'archive UI must initialize before duplicate merge so the organize host exists');
  assert.ok(scripts.indexOf(duplicate) < scripts.indexOf('detail-layout-v154.js'),
    'both split v182 modules must run before detail-layout-v154 moves the organize section');

  assert.ok(!scripts.includes(legacy), 'legacy combined archive/duplicate script must not remain dynamically active');
  assert.ok(!required.includes(legacy), 'legacy combined archive/duplicate script must not remain required');
  assert.ok(fs.existsSync(path.join(ROOT, legacy)), 'legacy combined script is intentionally retained for cache compatibility');
});

test('bootstrap order keeps manifest before loader and application module', () => {
  const html = read('index.html');
  const manifestAt = html.indexOf('release-manifest.js');
  const configAt = html.indexOf('config.js');
  const appAt = html.indexOf('app.js');
  assert.ok(manifestAt >= 0 && configAt > manifestAt && appAt > configAt,
    'index.html must load release-manifest.js -> config.js -> app.js in that order');

  const config = read('config.js');
  assert.match(config, /window\.WORK_BOARD_RELEASE\?\.version/,
    'config.js must derive the runtime release from the manifest');
  assert.match(config, /workboard:assets-ready/,
    'asset loader must publish the assets-ready contract');
});

test('all root JavaScript files pass Node syntax parsing', () => {
  const files = fs.readdirSync(ROOT)
    .filter(name => name.endsWith('.js'))
    .sort();
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
    if (result.status !== 0) failures.push(`${file}: ${result.stderr || result.stdout}`);
  }
  assert.deepEqual(failures, []);
});

test('GitHub Pages has one deployment workflow', () => {
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const workflowFiles = [
    ...listFiles(workflowDir, '.yml'),
    ...listFiles(workflowDir, '.yaml')
  ];
  const deployers = workflowFiles.filter(file => fs.readFileSync(file, 'utf8').includes('actions/deploy-pages@'));
  assert.equal(deployers.length, 1,
    `expected exactly one Pages deploy workflow, found: ${deployers.map(file => path.relative(ROOT, file)).join(', ')}`);
});
