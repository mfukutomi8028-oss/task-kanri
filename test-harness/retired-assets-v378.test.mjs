import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const retired = [
  'assets/nav-star-v87.png',
  'assets/nav-todo-v139.svg'
];
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replaceAll(path.sep, '/');
const checkedExt = new Set(['.js', '.mjs', '.css', '.html', '.json', '.yml', '.yaml', '.ps1']);
const skipDirs = new Set(['.git', 'node_modules', 'playwright-report', 'test-results']);
function sourceFiles(directory = ROOT) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return skipDirs.has(entry.name) ? [] : sourceFiles(full);
    const relative = path.relative(ROOT, full).replaceAll(path.sep, '/');
    if (relative === SELF || !checkedExt.has(path.extname(entry.name).toLowerCase())) return [];
    return [relative];
  });
}
test('retired unreferenced image assets are absent and not called from app or test sources', () => {
  const files = sourceFiles();
  const manifest = read('release-manifest.js');
  const html = read('index.html');
  for (const name of retired) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired file should be deleted: ' + name);
    assert.equal(manifest.includes(name), false, 'active manifest must not reference ' + name);
    assert.equal(html.includes(name), false, 'bootstrap HTML must not reference ' + name);
    const basename = path.posix.basename(name);
    const references = files.filter(file => read(file).includes(basename));
    assert.deepEqual(references, [], 'retired file still referenced by source: ' + name);
  }
});
test('obsolete one-byte root placeholder has been removed', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'github')), false);
});
test('legacy memo icon used at boot is deliberately retained until its source is migrated', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/nav-memo-v167.svg')), true);
  assert.match(read('work-features-v167.js'), /nav-memo-v167\.svg/);
  assert.match(read('icon-system-v169.js'), /nav-memo-v168\.svg/);
});
