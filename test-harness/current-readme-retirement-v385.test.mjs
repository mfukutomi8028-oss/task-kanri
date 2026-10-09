import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

test('Ver.385: obsolete Ver.136-only root operation notes are removed', () => {
  for (const name of ['rollback.md', 'test-report.md', 'manual-checklist.md']) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false,
      'do not present outdated Ver.136 procedures as current: ' + name);
  }
});

test('Ver.385: current README keeps executable routes, test commands, and old history reference', () => {
  for (const pathName of [
    'release-manifest.js', 'config.js', 'app.js',
    'patch-responsibilities.json', 'test-harness/', 'tests/',
    'firebase-rules.json', '.github/workflows/pages.yml',
    '.github/workflows/regression-checks.yml'
  ]) {
    assert.ok(README.includes(pathName), 'README must describe project path: ' + pathName);
  }
  for (const command of ['npm run test:protocol', 'npm run test:ui', 'npm run test:firebase']) {
    assert.ok(README.includes(command), 'active test workflow missing: ' + command);
  }
  assert.ok(README.includes('244fb55479a16789e85c3acdd3e2ada4eae976cb/README.md'),
    'historic README must remain accessible via immutable commit');
  assert.ok(README.includes('Firebase Authentication'),
    'risk-aware guidance for clinical environment must remain');
  assert.ok(README.includes('患者情報'),
    'explicit patient-data restriction must remain');
  assert.ok(README.includes('Issue #292'),
    'file-retirement roadmap link must remain');
});
