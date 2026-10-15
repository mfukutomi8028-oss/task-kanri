import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'docs/HISTORICAL_ROOT_AUDIT_LEDGER_V430.md';
const REPO = 'mfukutomi8028-oss/task-kanri';
const FIRST_BATCH = Object.freeze([
  'PERSONAL_REMINDER_POLLING_AUDIT_V362.md',
  'SCHEDULE_REMINDER_POLLING_AUDIT_V360.md',
  'SCHEDULE_TODAY_POLLING_AUDIT_V358.md',
  'SIDEBAR_COMPATIBILITY_AUDIT_V289.md',
  'SIDEBAR_SEMANTIC_TAKEOVER_AUDIT_V317.md',
  'WORK_FEATURES_OBSERVER_BOUNDARY_AUDIT_V314.md'
]);
const ACTIVE_ENTRYPOINTS = Object.freeze([
  'README.md', 'REGRESSION_TESTS.md', 'PATCH_RESPONSIBILITY_MAP.md',
  'DEVELOPMENT_PLAN_V371.md', 'release-notes.md', 'release-manifest.js',
  'index.html', 'package.json'
]);

function readLedger() {
  const markdown = fs.readFileSync(path.join(ROOT, LEDGER), 'utf8');
  const tick = String.fromCharCode(96);
  const rows = markdown.split('\n')
    .filter(line => line.startsWith('| ' + tick))
    .map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      assert.equal(cells.length, 6, 'ledger row must have six columns: ' + line);
      const unquote = value => {
        assert.ok(value.startsWith(tick) && value.endsWith(tick), 'expected quoted metadata: ' + value);
        return value.slice(1, -1);
      };
      const retired = unquote(cells[0]);
      const sourceCommit = unquote(cells[1]);
      const blobSha = unquote(cells[2]);
      const successor = unquote(cells[4]);
      const bytes = Number(cells[3].replaceAll(',', ''));
      const match = /^\[原本\]\((https:\/\/github\.com\/[^)]+)\)$/.exec(cells[5]);
      assert.ok(match, 'invalid fixed recovery link: ' + retired);
      return { retired, sourceCommit, blobSha, bytes, successor, url: match[1] };
    });
  return { markdown, rows };
}

test('Ver.430 ledger validates all six originals and reusable future rows', () => {
  const { markdown, rows } = readLedger();
  assert.ok(markdown.includes('Issue #292'));
  assert.ok(markdown.includes('Ver.429'));
  assert.ok(markdown.includes('checkpoint'));
  assert.ok(markdown.includes('blob/main/'));
  assert.ok(rows.length >= FIRST_BATCH.length);
  const seen = new Set();
  for (const row of rows) {
    assert.match(row.sourceCommit, /^[0-9a-f]{40}$/);
    assert.match(row.blobSha, /^[0-9a-f]{40}$/);
    assert.ok(row.retired.endsWith('.md') && !row.retired.includes('/'));
    assert.ok(row.successor.endsWith('.md') && !row.successor.includes('/'));
    assert.ok(!seen.has(row.retired), 'duplicate original: ' + row.retired);
    seen.add(row.retired);
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0);
    assert.equal(fs.existsSync(path.join(ROOT, row.retired)), false, 'old root audit still present: ' + row.retired);
    assert.ok(fs.existsSync(path.join(ROOT, row.successor)), 'retained successor missing: ' + row.successor);
    assert.equal(row.url, 'https://github.com/' + REPO + '/blob/' +
      row.sourceCommit + '/' + row.retired, 'recovery URL is not commit pinned');
  }
  for (const old of FIRST_BATCH) assert.ok(seen.has(old), 'Ver.430 audit row missing: ' + old);
});

test('Historical ledger archives do not leave stale paths in current entrypoints', () => {
  const { rows } = readLedger();
  for (const target of ACTIVE_ENTRYPOINTS) {
    const src = fs.readFileSync(path.join(ROOT, target), 'utf8');
    for (const row of rows) {
      assert.equal(src.includes(row.retired), false, target + ' refers to retired ' + row.retired);
    }
  }
});

// Ver.478: Ver.427-429 fixed historical-document checks are data-driven here.
// All nine original test cases remain active; only their old standalone wrappers retire.
const HISTORICAL_ARCHIVE_CHECKS = Object.freeze([
  {
    "version": 427,
    "index": "docs/HISTORICAL_ROOT_AUDITS_V427.md",
    "originalCommit": "dda377253979b6975d5148bad1028beab0d38394",
    "size": "14,168",
    "required": [
      "Issue #292",
      "GitHub Pages",
      "blob/main/",
      "checkpoint"
    ],
    "names": {
      "BRAND_BFCACHE_RECOVERY_AUDIT_V288.md": "ce01999e7c07d6f914a15901eefe49dc283f1847",
      "BRAND_DATASET_IDEMPOTENCY_AUDIT_V286.md": "c03f52471fcad7534b8e2cc31fcc0e938fbec13d",
      "MOBILE_SHELL_BOARD_OBSERVER_SEMANTIC_AUDIT_V301.md": "c7d53cee9b8038146b11d58b6dd28c9d7bf20dad",
      "COMMENT_MENTION_ESCAPE_AUDIT_V326.md": "cd9faafce1ad028c65f717d081852340b81310b9",
      "FAVORITE_OBSERVER_REFINED_AUDIT_V368.md": "cf6520a5c23036694d4a31b8647227ab26e16fab"
    }
  },
  {
    "version": 428,
    "index": "docs/HISTORICAL_FAVORITE_OBSERVER_AUDITS_V428.md",
    "originalCommit": "92b309e75ef58d29c0ed4a6578060df3133147b7",
    "size": "5,789",
    "required": [
      "Issue #292",
      "GitHub Pages",
      "expected-head",
      "checkpoint",
      "blob/main/"
    ],
    "names": {
      "FAVORITE_OBSERVER_SEMANTIC_AUDIT_V366.md": "f444b4a0467036700d69edf3c3b0699786cfd4db",
      "FAVORITE_OBSERVER_BROWSER_AUDIT_V367.md": "a00a5c6d9a385719118e475f3ac46f2ec9e82905",
      "FAVORITE_OBSERVER_TARGET_AUDIT_V370.md": "919e0134b190889c2e6a2ac1ca89f96acde9c56c"
    }
  },
  {
    "version": 429,
    "index": "docs/HISTORICAL_RUNTIME_INVENTORIES_V429.md",
    "originalCommit": "92b309e75ef58d29c0ed4a6578060df3133147b7",
    "size": "13,467",
    "required": [
      "Issue #292",
      "GitHub Pages",
      "blob/main/",
      "checkpoint",
      "Release304"
    ],
    "names": {
      "FINAL_RUNTIME_INVENTORY_AUDIT_V325.md": "88cb27f9c6d23736e7c9779bfae4b86e574b2cb8",
      "FINAL_RUNTIME_INVENTORY_AUDIT_V345.md": "138e3a858d5bc9e0773b1ab8b9932bed1041e443",
      "FINAL_RUNTIME_WAKEUP_INVENTORY_AUDIT_V355.md": "662fb34be2f6fce68bc5c39925e11636a0ecd26e"
    }
  }
]);
for (const bundle of HISTORICAL_ARCHIVE_CHECKS) {
  test('Ver.' + bundle.version + ' retained historical archive checks fixed recovery sources', () => {
    const content = fs.readFileSync(path.join(ROOT, bundle.index), 'utf8');
    const originals = Object.entries(bundle.names);
    assert.equal(originals.length, bundle.version === 427 ? 5 : 3);
    assert.ok(content.includes(bundle.originalCommit), 'original source SHA missing: Ver.' + bundle.version);
    assert.ok(content.includes(bundle.size), 'historical byte total missing: Ver.' + bundle.version);
    for (const [name, blob] of originals) {
      assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired root document returned: ' + name);
      assert.ok(content.includes(blob), 'source Git blob hash missing: ' + name);
      assert.ok(content.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
        bundle.originalCommit + '/' + name), 'immutable recovery URL missing: ' + name);
    }
  });

  test('Ver.' + bundle.version + ' retired document names stay absent from active entrypoints', () => {
    for (const entrypoint of ACTIVE_ENTRYPOINTS) {
      const current = fs.readFileSync(path.join(ROOT, entrypoint), 'utf8');
      for (const name of Object.keys(bundle.names)) {
        assert.equal(current.includes(name), false,
          entrypoint + ' still references old Ver.' + bundle.version + ' document: ' + name);
      }
    }
  });

  test('Ver.' + bundle.version + ' index retains acceptance and external-link risk notes', () => {
    const content = fs.readFileSync(path.join(ROOT, bundle.index), 'utf8');
    for (const detail of bundle.required) {
      assert.ok(content.includes(detail), 'missing Ver.' + bundle.version + ' contract: ' + detail);
    }
  });
}
