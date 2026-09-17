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
  assert.ok(required.length > 20);
  assert.equal(new Set(required).size, required.length);
  assert.equal(new Set(styles).size, styles.length);
  assert.equal(new Set(scripts).size, scripts.length);
  for (const relative of [...required, ...optional]) assert.ok(fs.existsSync(path.join(ROOT, relative)), `release asset is missing: ${relative}`);
  for (const relative of [...styles, ...scripts]) assert.ok(required.includes(relative), `dynamic asset must also be required: ${relative}`);
  for (const relative of mobileScripts) assert.ok(required.includes(relative) || optional.includes(relative), `mobile asset must be inventoried: ${relative}`);
});

test('Ver.180 keeps the consolidated sidebar layer before task-toolbar refinements', () => {
  const manifest = read('release-manifest.js');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const required = extractStringArray(manifest, 'requiredAssets');
  const legacy = ['ui-v158.css', 'ui-v159.css', 'ui-v160.css', 'ui-v164.css'];
  assert.ok(styles.includes('ui-sidebar-v180.css'));
  assert.ok(required.includes('ui-sidebar-v180.css'));
  assert.ok(styles.indexOf('ui-sidebar-v180.css') < styles.indexOf('ui-task-toolbar-v179.css'));
  for (const name of legacy) {
    assert.ok(!styles.includes(name));
    assert.ok(!required.includes(name));
    assert.ok(fs.existsSync(path.join(ROOT, name)));
  }
});

test('Ver.220 keeps one consolidated sidebar script before the remaining active foundation patches', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  const consolidatedName = 'desktop-sidebar-v181.js';
  const legacy = ['desktop-sidebar-v158.js','desktop-sidebar-compat-v159.js','sidebar-polish-v160.js'];
  assert.equal(scripts.filter(name => name === consolidatedName).length, 1);
  assert.ok(required.includes(consolidatedName));
  assert.ok(scripts.indexOf(consolidatedName) < scripts.indexOf('date-keyboard-fix-v127.js'));
  assert.ok(!scripts.includes('stable-fixes-v108.js'));
  assert.ok(!required.includes('stable-fixes-v108.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'stable-fixes-v108.js')));

  const consolidated = read(consolidatedName);
  let previousIndex = -1;
  for (const name of legacy) {
    assert.ok(!scripts.includes(name));
    assert.ok(!required.includes(name));
    assert.ok(fs.existsSync(path.join(ROOT, name)));
    const index = consolidated.indexOf(read(name));
    assert.ok(index >= 0 && index > previousIndex);
    previousIndex = index;
  }
});

test('Ver.182 split archive UI and duplicate merge remain active', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  for (const name of ['archive-ui-v182.js','duplicate-merge-v182.js']) {
    assert.equal(scripts.filter(item => item === name).length, 1);
    assert.ok(required.includes(name));
  }
  assert.ok(scripts.indexOf('archive-ui-v182.js') < scripts.indexOf('duplicate-merge-v182.js'));
  assert.ok(scripts.indexOf('duplicate-merge-v182.js') < scripts.indexOf('detail-layout-v154.js'));
  assert.ok(!scripts.includes('archive-duplicate-v153.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'archive-duplicate-v153.js')));
});

test('Ver.183 split inbox presentation and event generation remain active', () => {
  const manifest = read('release-manifest.js');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  for (const name of ['inbox-ui-v183.js','inbox-events-v183.js']) {
    assert.equal(scripts.filter(item => item === name).length, 1);
    assert.ok(required.includes(name));
  }
  assert.ok(scripts.indexOf('inbox-ui-v183.js') < scripts.indexOf('inbox-events-v183.js'));
  assert.ok(scripts.indexOf('inbox-events-v183.js') < scripts.indexOf('archive-ui-v182.js'));
  assert.ok(!scripts.includes('inbox-v153.js'));
  assert.ok(fs.existsSync(path.join(ROOT, 'inbox-v153.js')));
});

test('Ver.189 feature-owned lightweight CSS remains active in later releases', () => {
  const manifest = read('release-manifest.js');
  const version = manifest.match(/version:\s*"(\d+)"/)?.[1];
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const scripts = extractStringArray(manifest, 'dynamicScripts');
  const required = extractStringArray(manifest, 'requiredAssets');
  assert.ok(Number(version) >= 189);
  for (const name of ['ui-todo-light-v189.css','ui-task-light-v189.css','ui-schedule-mobile-v189.css']) {
    assert.equal(styles.filter(item => item === name).length, 1);
    assert.ok(required.includes(name));
  }
  for (const name of ['ui-v144.css','ui-v145.css','ui-v146.css','ui-v147.css']) {
    assert.ok(!styles.includes(name));
    assert.ok(!required.includes(name));
    assert.ok(fs.existsSync(path.join(ROOT, name)));
  }
  for (const name of ['todo-controls-v144.js','todo-tools-v145.js','todo-history-v146.js','task-ux-v146.js','todo-preview-v147.js']) {
    assert.equal(scripts.filter(item => item === name).length, 1);
    assert.ok(required.includes(name));
  }
});

test('bootstrap order keeps manifest before loader and application module', () => {
  const html = read('index.html');
  const manifestAt = html.indexOf('release-manifest.js');
  const configAt = html.indexOf('config.js');
  const appAt = html.indexOf('app.js');
  assert.ok(manifestAt >= 0 && configAt > manifestAt && appAt > configAt);
  const config = read('config.js');
  assert.match(config, /window\.WORK_BOARD_RELEASE\?\.version/);
  assert.match(config, /workboard:assets-ready/);
});

test('all root JavaScript files pass Node syntax parsing', () => {
  const files = fs.readdirSync(ROOT).filter(name => name.endsWith('.js')).sort();
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
    if (result.status !== 0) failures.push(`${file}: ${result.stderr || result.stdout}`);
  }
  assert.deepEqual(failures, []);
});

test('GitHub Pages has one deployment workflow', () => {
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const workflowFiles = [...listFiles(workflowDir, '.yml'), ...listFiles(workflowDir, '.yaml')];
  const deployers = workflowFiles.filter(file => fs.readFileSync(file, 'utf8').includes('actions/deploy-pages@'));
  assert.equal(deployers.length, 1);
});
