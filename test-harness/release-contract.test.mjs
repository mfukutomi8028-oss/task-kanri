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
