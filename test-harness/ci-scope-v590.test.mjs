import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaths } from './ci-scope-v590.mjs';

test('CI scope: a Classic-only CSS change needs targeted browser, not Firebase or Auth', () => {
  const result = classifyPaths(['ui-todo-light-v189.css']);
  assert.equal(result.mode, 'targeted');
  assert.deepEqual(result.shards, [1]);
  assert.match(result.targets, /mobile-regression-v187/);
  assert.equal(result.firebase, false);
  assert.equal(result.authorization, false);
});

test('CI scope: Origin and JOURNAL maintain browser contracts after Palette removal', () => {
  const result = classifyPaths(['origin-modern-v372.js', 'journal-display-v367.css']);
  assert.equal(result.mode, 'targeted');
  assert.match(result.targets, /origin-modern-v372/);
  assert.match(result.targets, /journal-display-v367/);
  assert.equal(result.firebase, false);
});

test('CI scope: removing obsolete Palette tests does not schedule deleted spec files', () => {
  const result=classifyPaths(['tests/palette-next-v369.spec.mjs','palette-next-v369.js']);
  assert.doesNotMatch(result.targets,/tests\/palette-next-v369\.spec\.mjs/);
  assert.match(result.targets,/origin-modern-v372/);
  assert.match(result.targets,/journal-display-v367/);
});

test('CI scope: only an isolated JOURNAL change uses test-level browser sharding', () => {
  const journal = classifyPaths(['journal-display-v367.js', 'journal-display-v367.css',
    'tests/journal-display-v367.spec.mjs']);
  assert.equal(journal.mode, 'targeted');
  assert.equal(journal.targets, 'tests/journal-display-v367.spec.mjs');
  assert.equal(journal.journalParallel, true);
  assert.deepEqual(journal.shards, [1, 2]);
  assert.equal(journal.shardCount, 2);
  assert.equal(journal.firebase, false);
  assert.equal(journal.authorization, false);

  const mixed = classifyPaths(['journal-display-v367.js', 'origin-modern-v372.js']);
  assert.equal(mixed.journalParallel, false);
  assert.deepEqual(mixed.shards, [1]);
  assert.equal(mixed.shardCount, 1);

  const origin = classifyPaths(['origin-modern-v372.js']);
  assert.equal(origin.journalParallel, false);
  assert.deepEqual(origin.shards, [1]);
  assert.equal(origin.shardCount, 1);
});

test('CI scope: shared application data code is always full-risk', () => {
  const result = classifyPaths(['app.js']);
  assert.deepEqual(result.shards, [1, 2, 3, 4]);
  assert.equal(result.shardCount, 4);
  assert.equal(result.journalParallel, false);
  assert.equal(result.mode, 'full');
  assert.equal(result.firebase, true);
  assert.equal(result.authorization, true);
});

test('CI scope: write-side shared code protects Firebase and quick browser routes', () => {
  const result = classifyPaths(['workspace-write-v538.js']);
  assert.equal(result.mode, 'targeted');
  assert.equal(result.firebase, true);
  assert.equal(result.authorization, false);
  assert.match(result.targets, /ui-smoke/);
});

test('CI scope: auth rules trigger both security and database emulator checks', () => {
  const result = classifyPaths(['firebase.v568.candidate.json']);
  assert.equal(result.authorization, true);
  assert.equal(result.firebase, true);
});

test('CI scope: release notes and manifests stay fast, with Protocol always enforced by workflow', () => {
  const result = classifyPaths(['release-manifest.js', 'release-notes.md', 'patch-responsibilities.json']);
  assert.equal(result.mode, 'protocol-only');
  assert.equal(result.browser, false);
  assert.equal(result.firebase, false);
});

test('CI scope: changed Playwright spec runs itself, while changed emulator spec runs emulator', () => {
  const browser = classifyPaths(['tests/mobile-regression-v187.spec.mjs']);
  assert.equal(browser.targets, 'tests/mobile-regression-v187.spec.mjs');
  const emulator = classifyPaths(['tests/firebase-emulator-todo.spec.mjs']);
  assert.equal(emulator.firebase, true);
  assert.equal(emulator.browser, false);
});

test('CI scope: CI infrastructure and unknown runtime scripts fail closed to full suites', () => {
  for (const path of ['.github/workflows/regression-checks.yml', 'package-lock.json', 'new-unsafe-module.js']) {
    assert.equal(classifyPaths([path]).mode, 'full', path);
  }
});

test('CI scope: manual and scheduled checks always run all suites independently of changed paths', () => {
  for (const event of ['schedule', 'workflow_dispatch']) {
    const result = classifyPaths([], event);
    assert.equal(result.mode, 'full');
    assert.deepEqual(result.shards, [1, 2, 3, 4]);
    assert.equal(result.shardCount, 4);
    assert.equal(result.firebase, true);
    assert.equal(result.authorization, true);
  }
});

test('CI scope: results are deterministic, sorted and never include arbitrary shell targets', () => {
  const result = classifyPaths(['ui-task-light-v189.css', 'ui-todo-light-v189.css', 'ui-task-light-v189.css']);
  const targets = result.targets.split(' ');
  assert.deepEqual(targets, [...new Set(targets)].sort());
  assert.ok(targets.every(file => /^tests\/[a-z0-9-]+\.spec\.mjs$/.test(file)));
});
