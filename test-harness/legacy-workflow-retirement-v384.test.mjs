import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflows = path.join(root, '.github', 'workflows');
const retired = [
  'apply-v108-stability.yml',
  'apply-v108-source-stability.yml',
  'apply-v108-source-stability-v2.yml'
];
const read = name => fs.readFileSync(path.join(workflows, name), 'utf8');

test('Ver.384: one-off v108 self-triggered source-mutating workflows are physically retired', () => {
  for (const filename of retired) {
    assert.equal(fs.existsSync(path.join(workflows, filename)), false,
      'historic write-capable migration must not remain triggerable: ' + filename);
  }
});

test('Ver.384: required release and regression workflows remain and do not gain repository write rights', () => {
  const pages = read('pages.yml');
  const checks = read('regression-checks.yml');
  assert.match(pages, /actions\/upload-pages-artifact@v3/);
  assert.match(pages, /path:\s*\.pages-runtime/);
  assert.match(checks, /needs:\s*\[protocol,\s*browser,\s*firebase\]/);
  assert.match(checks, /Confirm all regression suites passed/);
  for (const [filename, code] of [['pages.yml', pages], ['regression-checks.yml', checks]]) {
    assert.doesNotMatch(code, /^\s*contents:\s*write\s*$/m,
      'active CI must not inherit the old v108 workflow write scope: ' + filename);
  }
});
