import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = fs.readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.232 version display CSS loads after date controls and before feature presentation layers', () => {
  const styles = extractStringArray(manifest, 'dynamicStyles');
  const display = styles.indexOf('ui-version-display-v232.css');
  const date = styles.indexOf('ui-date-segment-controls-v230.css');
  const todo = styles.indexOf('ui-todo-light-v189.css');

  assert.ok(display >= 0, 'version display CSS must be active');
  assert.ok(date >= 0 && date < display, 'date control presentation must keep its prior place before version display');
  assert.ok(todo > display, 'version display CSS must remain before feature presentation layers');
});
