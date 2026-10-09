import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'test-harness/retired-runtime-assets-v389.test.mjs';
const REMOVED = Object.freeze([
  'date-keyboard-fix-v126.js',
  'todo-ui-v140.css',
  'todo-ui-v141.css'
]);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pages-runtime', 'test-results', 'playwright-report', 'coverage', '.firebase']);
const SOURCE_EXT = /\.(?:js|mjs|cjs|css|html|json|yml|yaml|ps1)$/i;

function walk(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : walk(absolute, relative);
    return entry.isFile() ? [relative] : [];
  });
}

test('Ver.389 removes only superseded old ToDo CSS and native date-keyboard V126', () => {
  for (const name of REMOVED) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'superseded asset must be retired: ' + name);
  }
  const manifest = fs.readFileSync(path.join(ROOT, 'release-manifest.js'), 'utf8');
  for (const successor of ['todo-ui-v142.css', 'date-segment-controls-v230.js', 'ui-date-segment-controls-v230.css']) {
    assert.ok(manifest.includes('"' + successor + '"'), 'active successor must remain declared: ' + successor);
    assert.ok(fs.existsSync(path.join(ROOT, successor)), 'active successor must exist: ' + successor);
  }
});

test('Ver.389 retired filenames have no remaining references in executable, test, or packaging sources', () => {
  const matches = [];
  for (const relative of walk(ROOT)) {
    if (relative === SELF || !SOURCE_EXT.test(relative)) continue;
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    for (const oldName of REMOVED) {
      if (source.includes(oldName)) matches.push(relative + ' -> ' + oldName);
    }
  }
  assert.deepEqual(matches, [], 'review every remaining source reference before retiring old assets');
});
