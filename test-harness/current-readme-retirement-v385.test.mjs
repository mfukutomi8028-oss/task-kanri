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

const retiredRootNotesV387 = [
  "DATE_CONSTRAINT_OWNERSHIP_AUDIT_V209.md",
  "FOUNDATION_OBSERVER_AUDIT_V206.md",
  "FOUNDATION_OVERLAP_AUDIT_V200.md",
  "MOBILE_AUDIT_V157.md",
  "RELEASE_NOTES_V155.md",
  "RELEASE_NOTES_V156.md",
  "RELEASE_NOTES_V157.md",
  "RELEASE_V152.md",
  "RELEASE_V153.md",
  "RELEASE_V154.md",
  "STABLE_FIXES_AUDIT_V195.md",
  "STABLE_FULL_PASS_AUDIT_V210.md",
  "STABLE_NATIVE_HIDDEN_AUDIT_V214.md",
  "STABLE_OBSERVER_SCOPE_AUDIT_V207.md",
  "STABLE_REMAINING_FULL_PASS_AUDIT_V211.md",
  "STABLE_STYLE_OWNERSHIP_AUDIT_V213.md",
  "STABLE_VERSION_DISPLAY_AUDIT_V212.md",
  "STATUS_DELETE_OWNERSHIP_AUDIT_V197.md",
  "STATUS_TAB_CSS_OVERLAP_AUDIT_V205.md",
  "STATUS_TAB_SCROLL_AUDIT_V204.md",
  "TODO_MARKET_RESEARCH_V145.md",
  "WORKFLOW_FEATURES_V148.md",
  "WORKFLOW_FEATURES_V149.md",
  "WORKFLOW_FEATURES_V150.md",
  "release-notes-v150.md",
  "release-notes-v151.md"
];

test('Ver.387: archived legacy root notes are absent and recoverable by immutable links', () => {
  const archivePath = path.join(ROOT, 'docs/HISTORICAL_NOTES_ARCHIVE_V387.md');
  const archive = fs.readFileSync(archivePath, 'utf8');
  const prefix = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/907ab542eca1934f975465863f68075c3fa8464f/';
  assert.ok(README.includes('docs/HISTORICAL_NOTES_ARCHIVE_V387.md'), 'README must link to the immutable history index');

  for (const name of retiredRootNotesV387) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false,
      'retired historical file must not reappear at repository root: ' + name);
    assert.ok(archive.includes('](' + prefix + name + ')'),
      'historic immutable original is missing from archive index: ' + name);
  }

  // Catch local Markdown hyperlinks to removed documents; immutable Git links remain valid.
  function verifyMarkdownLinks(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (['.git', 'node_modules', '.pages-runtime', 'playwright-report', 'test-results', 'coverage'].includes(entry.name)) continue;
        verifyMarkdownLinks(filePath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const source = fs.readFileSync(filePath, 'utf8');
        for (const name of retiredRootNotesV387) {
          for (const href of [name, './' + name, '../' + name, '../../' + name, '/' + name]) {
            assert.ok(!source.includes('](' + href + ')') && !source.includes('](' + href + '#'),
              path.relative(ROOT, filePath) + ' has an obsolete local link to ' + name);
          }
        }
      }
    }
  }
  verifyMarkdownLinks(ROOT);
});
