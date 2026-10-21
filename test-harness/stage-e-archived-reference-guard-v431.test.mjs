import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedgerArchivedNames, parseHistoricalArchiveTable, parseHistoricalArchiveIndexes, scanArchivedCodeReferences, auditCurrentCheckout } from './stage-e-archived-reference-guard-v431.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = 'a'.repeat(40);
const old = 'MOBILE_SHELL_BOARD_OBSERVER_AUDIT_V299.md';
const tick = String.fromCharCode(96);

test('Ver.431 parses SHA-pinned archived ledger rows and rejects duplicate/bad entries', () => {
  const row = name => '| ' + tick + name + tick + ' | ' + tick + sha + tick +
    ' | ' + tick + sha + tick + ' | 100 | ' + tick + 'PRODUCT.md' + tick +
    ' | [original](https://github.com/example) |';
  assert.deepEqual(parseLedgerArchivedNames(row(old)), [old]);
  assert.throws(() => parseLedgerArchivedNames(row(old) + '\n' + row(old)), /Duplicate/);
  assert.throws(() => parseLedgerArchivedNames(row('bad/path.md')), /Invalid/);
});

test('Ver.431 catches the old V299 missing-Markdown regression without false suffix hits', () => {
  const entries = [
    { path: 'test-harness/mobile-shell-board-observer-v299.test.mjs' },
    { path: 'README.md' },
    { path: 'test-harness/historical-root-audit-ledger-v430.test.mjs' },
    { path: 'test-harness/another.test.mjs' }
  ];
  const content = {
    [entries[0].path]: "const x = readFileSync('" + old + "', 'utf8');",
    [entries[1].path]: 'Historic: ' + old,
    [entries[2].path]: "const expected = '" + old + "'",
    [entries[3].path]: "'OTHER_" + old + "' and '" + old + ".backup' should not match"
  };
  const report = scanArchivedCodeReferences([old], entries, p => content[p]);
  assert.equal(report.scannedFiles, 2);
  assert.deepEqual(report.hits.map(x => ({ source: x.source, retired: x.retired })),
    [{ source: entries[0].path, retired: old }]);
});

test('Ver.431 refuses to count unreadable tracked code as no references', () => {
  const result = scanArchivedCodeReferences([old], [{ path: 'tests/broken.spec.mjs' }], () => {
    throw new Error('unable to read');
  });
  assert.equal(result.hits.length, 0);
  assert.equal(result.readErrors.length, 1);
});

test('Ver.431 Git checkout has no reintroduced archived docs or active references', t => {
  if (!fs.existsSync(path.join(ROOT, '.git'))) return t.skip('Requires Git checkout');
  const report = auditCurrentCheckout(ROOT);
  assert.ok(report.retiredCount >= 31);
  assert.deepEqual(report.stillTracked, [], 'Retired file returned in tracked root');
  assert.deepEqual(report.readErrors, [], 'Unreadable tracked source');
  assert.deepEqual(report.hits, [], 'Active code references retired Markdown');
  console.log('VER431_ARCHIVED_CODE_REFERENCE_AUDIT', JSON.stringify({
    retired: report.retiredCount, codeFiles: report.scannedFiles,
    errors: report.readErrors.length, liveReferences: report.hits.length
  }));
});

test('Stage E guard parses every accepted historical archive index', () => {
  const ref = '0123456789abcdef0123456789abcdef01234567';
  const blob = 'fedcba9876543210fedcba9876543210fedcba98';
  const row = name => '| `' + name + '` | `' + blob + '` | 42 | [source](https://github.com/example/task/blob/' + ref + '/' + name + ') |';
  const names = parseHistoricalArchiveIndexes(p =>
    p.endsWith('V430.md')
      ? '| `FOUR.md` | `' + ref + '` | `' + blob + '` | 42 | `SUCCESSOR.md` | [source](https://github.com/example) |'
      : row(p.includes('V427') ? 'ONE.md' : p.includes('V428') ? 'TWO.md' : p.includes('V429') ? 'THREE.md' : p.includes('V436') ? 'FIVE.md' : p.includes('V437') ? 'SIX.md' : p.includes('V447') ? 'EIGHT.md' : p.includes('V448') ? 'NINE.md' : p.includes('V510') ? 'TEN.md' : p.includes('V511') ? 'ELEVEN.md' : 'SEVEN.md'));
  assert.deepEqual(names, ['ONE.md', 'TWO.md', 'THREE.md', 'FOUR.md', 'FIVE.md', 'SIX.md', 'SEVEN.md', 'EIGHT.md', 'NINE.md', 'TEN.md', 'ELEVEN.md']);
  assert.throws(() => parseHistoricalArchiveIndexes(() => row('DUPLICATE.md')), /Duplicate/);
  assert.throws(() => parseHistoricalArchiveTable(row('VALID.md').replace(blob, 'bad'), 'fixture'), /Malformed/);
  assert.throws(() => parseHistoricalArchiveTable(row('VALID.md').replace('/blob/', '/tree/'), 'fixture'), /Missing immutable/);
  assert.throws(() => parseHistoricalArchiveIndexes(() => { throw new Error('missing index'); }), /missing index/);
});

test('Ver.436 preserves three superseded audit originals at immutable SHA and retires root copies', () => {
  const source = 'bd843e4eb27775fa9ad4e9b50362ae636b6f6209';
  const archive = 'docs/HISTORICAL_SUPERSEDED_AUDITS_V436.md';
  const text = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const expected = Object.freeze({
    'BRAND_BOOTSTRAP_AUDIT_V280.md': 'fd47dd9c21b17a85f9d17532a4e2560fa1f4d313',
    'INSIGHTS_POLLING_SCOPE_AUDIT_V356.md': 'c3f215bfc0c8967bdb8d04a808951025ef56331c',
    'REGRESSION_PARALLEL_V381.md': '72f1bfed98b6499a592d0ffa365fec77f9cf95ac'
  });
  const parsed = parseHistoricalArchiveTable(text, archive);
  assert.deepEqual(parsed.slice().sort(), Object.keys(expected).sort());
  for (const [oldName, blob] of Object.entries(expected)) {
    assert.equal(fs.existsSync(path.join(ROOT, oldName)), false, 'retired audit returned: ' + oldName);
    assert.ok(text.includes('`' + blob + '`'), 'source blob hash not pinned: ' + oldName);
    assert.ok(text.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      source + '/' + oldName + ')'), 'immutable recovery URL missing: ' + oldName);
  }
  assert.ok(text.includes('11,683'), 'byte count of historical originals changed');
  assert.ok(text.includes('Issue #292'));
  assert.ok(text.includes('blob/main/'), 'external cached link risk not documented');
});

test('Ver.437 retains four historical proposals as immutable originals, not live root dependencies', () => {
  const source = 'f71e43928d54d41a8a01484f86e8b638063d049a';
  const index = 'docs/HISTORICAL_IMPLEMENTATION_NOTES_V437.md';
  const content = fs.readFileSync(path.join(ROOT, index), 'utf8');
  const expected = Object.freeze({
    'PAGES_RUNTIME_ARTIFACT_V382.md': '387f6595dc392548187a5bbf8b71aede6c711c40',
    'PAGES_PACKAGED_BROWSER_V383.md': 'f4c95806c2c609263a1449e46a1903a9c41fddfa',
    'RELEASE_CHECK_BRIDGE_V386.md': '1cf73ff838e02989ed38c8d650b30237ee93d886',
    'ZERO_RESULTS_UX_V374.md': 'c0c7788fafd83f2879d3f4ace217c7bde07800ee'
  });
  assert.deepEqual(parseHistoricalArchiveTable(content, index).slice().sort(),
    [...Object.keys(expected), 'ZERO_RESULTS_UX_V374_PRODUCT.md'].sort(),
    'the four Ver.437 originals and the additional Ver.488 original must be covered');
  for (const [filename, blobSha] of Object.entries(expected)) {
    assert.equal(fs.existsSync(path.join(ROOT, filename)), false, 'historical proposal returned: ' + filename);
    assert.ok(content.includes('`' + blobSha + '`'), 'original blob SHA missing: ' + filename);
    assert.ok(content.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      source + '/' + filename + ')'), 'fixed recovery URL missing: ' + filename);
  }
  assert.ok(content.includes('9,679'), 'original byte total changed');
  assert.ok(content.includes('Issue #292'), 'archive provenance missing');
  assert.ok(content.includes('blob/main/'), 'external-link risk omitted');
});

test('Ver.438 triages all eighteen zero-owner notes, preserves sixteen, and pins two archived originals', () => {
  const source = '63d561e87a61ef3fdabb094efd41ea174ca2d4fa';
  const archive = 'docs/STAGE_E_ROOT_MARKDOWN_TRIAGE_V438.md';
  const contents = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const retired = Object.freeze({
    'MOBILE_SHELL_KEYDOWN_LIFECYCLE_AUDIT_V311.md': '55797d283c0a5e3e8ddcf2b34a3fa8fb55c99aa3',
    'TIMELINE_COMPLETION_V377.md': '795ce44a51acdde26d0b27cf758445dfc7c28bcb'
  });
  // Classify named notes through the historical document, without making this test an owner.
  const retained = [...contents.matchAll(/^- \x60([A-Za-z0-9][A-Za-z0-9_.-]*\.md)\x60：/gm)]
    .map(match => match[1]);
  assert.equal(retained.length, 16);
  assert.equal(new Set(retained).size, 16);
  assert.deepEqual(parseHistoricalArchiveTable(contents, archive).slice().sort(),
    Object.keys(retired).sort(), 'only the two approved plans are retired');
  for (const [name, blob] of Object.entries(retired)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired audit returned: ' + name);
    assert.ok(contents.includes('`' + blob + '`'), 'immutable blob missing: ' + name);
    assert.ok(contents.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      source + '/' + name + ')'), 'immutable original URL missing: ' + name);
  }
  for (const retainedName of retained) {
    assert.ok(contents.includes('`' + retainedName + '`'), 'triage reason missing: ' + retainedName);
    assert.ok(!Object.hasOwn(retired, retainedName), 'retained and retired sets overlap: ' + retainedName);
  }
  assert.ok(contents.includes('4,863 bytes / 2件'));
  assert.ok(contents.includes('Issue #292'));
  assert.ok(contents.includes('blob/main/'), 'external link risk must not be omitted');
});

test('Ver.447 retires only two superseded root plans with fixed hash/size originals and live successors', () => {
  const sourceCommit = '6f65a7ef70f4dbbad2ce7f26e16cdba2fb5d3576';
  const archive = 'docs/HISTORICAL_FILE_RETIREMENT_NOTES_V447.md';
  const note = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const retired = Object.freeze({
    'ASSET_RETIREMENT_AUDIT_V379.md': { sha: '3961c738b8652b2d9a89147a3316c71da2bbbf0b', bytes: 3121 },
    'FILE_RETIREMENT_V378.md': { sha: '9422fac3893cab42fda0dabcaeb026a65b53ba74', bytes: 4215 }
  });
  assert.deepEqual(parseHistoricalArchiveTable(note, archive).sort(), Object.keys(retired).sort());
  for (const [name, expected] of Object.entries(retired)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired historical plan returned: ' + name);
    assert.ok(note.includes('`' + expected.sha + '`'), 'source blob hash missing: ' + name);
    assert.ok(note.includes('| ' + expected.bytes.toLocaleString('en-US') + ' |'), 'source byte size missing: ' + name);
    const original = 'https://github.com/mfukutomi8028-oss/task-kanri/blob/' + sourceCommit + '/' + name;
    assert.ok(note.includes(original + ')'), 'immutable original link missing: ' + name);
  }
  assert.ok(note.includes('7,336 bytes'), 'retired source byte total changed');
  assert.ok(note.includes('blob/main/'), 'external historical link risk not recorded');
  assert.ok(note.includes('Issue #292'), 'cleanup provenance missing');
  for (const current of [
    'README.md',
    'release-manifest.js',
    'test-harness/asset-retirement-inventory-v379.mjs',
    'test-harness/asset-retirement-inventory-v379.test.mjs',
    'test-harness/build-pages-runtime-v382.mjs',
    'docs/STAGE_E_ROOT_MARKDOWN_TRIAGE_V438.md'
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, current)), true, 'required successor removed: ' + current);
  }
});

test('Ver.448 pins three retired handoff originals and retains active runtime/test owners', () => {
  const commit = '09fb36d413fdc72fcf1476c6ed99fc1828dd0b0b';
  const index = 'docs/HISTORICAL_PRODUCT_HANDOFF_NOTES_V448.md';
  const note = fs.readFileSync(path.join(ROOT, index), 'utf8');
  const archived = {
    'BOOTSTRAP_CURRENT_ICONS_V380.md': ['7459c4a214f30e34e241e0ce0043763b526fd74d', 3036],
    'COMMENT_MENTION_ESCAPE_PRODUCT_V327.md': ['e0d21d90493b32685e51bbf3965b14733bb42499', 1678],
    'FAVORITE_OBSERVER_PRODUCT_V369.md': ['c304621bf4b462945a598dc5815093fc7e50b3bc', 1144]
  };
  assert.deepEqual(parseHistoricalArchiveTable(note, index).sort(), Object.keys(archived).sort());
  for (const [name, [blob, bytes]] of Object.entries(archived)) {
    assert.ok(!fs.existsSync(path.join(ROOT, name)), 'retired root note still exists: ' + name);
    assert.ok(note.includes('`' + blob + '`'), 'original blob SHA absent: ' + name);
    assert.ok(note.includes('| ' + bytes.toLocaleString('en-US') + ' |'), 'size missing: ' + name);
    assert.ok(note.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
      commit + '/' + name + ')'), 'immutable original missing: ' + name);
  }
  assert.ok(note.includes('5,858 bytes') && note.includes('Issue #292'));
  assert.ok(note.includes('blob/main/'), 'broken external-link risk omitted');
  for (const owner of [
    'index.html', 'release-manifest.js', 'comment-mentions-v191.js', 'favorite-ui-v237.js',
    'test-harness/bootstrap-current-icons-v380.test.mjs',
    'tests/bootstrap-current-icons-v380.spec.mjs',
    'tests/comment-mention-escape-lifecycle-v327.spec.mjs',
    'test-harness/comment-mention-observer-v329.test.mjs',
    'test-harness/favorite-observer-product-v369.test.mjs',
    'tests/favorite-observer-product-v369.spec.mjs',
    'tests/favorite-observer-target-v370.spec.mjs'
  ]) assert.ok(fs.existsSync(path.join(ROOT, owner)), 'active owner absent: ' + owner);
});


test('Ver.488 archives the old zero-results product candidate with immutable byte and live-owner evidence', () => {
  const retired = 'ZERO_RESULTS_UX_V374_PRODUCT.md';
  const index = 'docs/HISTORICAL_IMPLEMENTATION_NOTES_V437.md';
  const note = fs.readFileSync(path.join(ROOT, index), 'utf8');
  const baseline = '83aee80c59d58411fe4fd231a11a8c5fb981b679';
  assert.equal(fs.existsSync(path.join(ROOT, retired)), false, 'obsolete root product note reappeared');
  assert.ok(note.includes('| `' + retired + '` | `435860040a9542e306be90b52a79aa22bb6cda25` | 4,897 |'),
    'original Git blob SHA and exact byte count must remain pinned');
  assert.ok(note.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' +
    baseline + '/' + retired + ')'), 'fixed SHA original URL missing');
  for (const owner of [
    'app.js',
    'test-harness/task-zero-guidance-v374.test.mjs',
    'tests/task-zero-guidance-v374.spec.mjs'
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, owner)), 'active zero-results owner missing: ' + owner);
  }
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const protocol = fs.readFileSync(path.join(ROOT, 'test-harness/task-zero-guidance-v374.test.mjs'), 'utf8');
  const browser = fs.readFileSync(path.join(ROOT, 'tests/task-zero-guidance-v374.spec.mjs'), 'utf8');
  assert.match(app, /function renderTaskZeroGuideV374\(/);
  assert.match(app, /function bindTaskZeroActionsV374\(/);
  assert.match(protocol, /Ver\.374 initial empty data is clearly different from a filtered empty result/);
  assert.match(browser, /Ver\.374 board\/list show active search and reuse reset without saving/);
  assert.ok(note.includes('Issue #292') && note.includes('blob/main/'),
    'deletion rationale and external bookmark risk must remain documented');
});

test('Ver.510 retires only two archived mobile recovery audits with pinned originals', () => {
  const archive = 'docs/HISTORICAL_MOBILE_RECOVERY_AUDITS_V510.md';
  const text = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const originals = Object.freeze({
    'MOBILE_SHELL_STARTUP_REPATCH_AUDIT_V291.md': { sha: '44c35ecdc24656a393e8599344d210079d131650', bytes: 5469 },
    'MOBILE_SHELL_ORIENTATION_RECOVERY_AUDIT_V293.md': { sha: 'e623bd66cf2a316e4cea85826f26aa73bb7cece0', bytes: 2537 }
  });
  assert.deepEqual(parseHistoricalArchiveTable(text, archive).sort(), Object.keys(originals).sort());
  for (const [name, data] of Object.entries(originals)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired root audit returned: ' + name);
    assert.ok(text.includes('`' + data.sha + '`'), 'original Git blob SHA missing: ' + name);
    assert.ok(text.includes('| ' + data.bytes.toLocaleString('en-US') + ' |'), 'original byte count missing: ' + name);
    assert.ok(text.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/95f008796ecf48a5e42afb1c394a6c352cd36641/' + name + ')'),
      'immutable original link missing: ' + name);
  }
  for (const active of [
    'mobile-shell-v234.js',
    'MOBILE_SHELL_STARTUP_REPATCH_RETIREMENT_V292.md',
    'MOBILE_SHELL_ORIENTATION_RECOVERY_RETIREMENT_V294.md',
    'test-harness/mobile-shell-startup-repatch-v291.test.mjs',
    'test-harness/mobile-shell-orientation-recovery-v293.test.mjs'
  ]) assert.equal(fs.existsSync(path.join(ROOT, active)), true, 'active successor missing: ' + active);
  assert.ok(text.includes('2 files / 8,006 bytes') && text.includes('Issue #292'));
  assert.ok(text.includes('blob/main/'), 'external historical link risk missing');
});

test('Ver.511 pins retired Ver.307/309 mobile interaction audit originals and preserves product owners', () => {
  const archive = 'docs/HISTORICAL_MOBILE_INTERACTION_AUDITS_V511.md';
  const text = fs.readFileSync(path.join(ROOT, archive), 'utf8');
  const base = '531d42495cd36897e3077b5cd441dc97d357d188';
  const originals = Object.freeze({
    'MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md': { sha: '4c56bb9f92ffba154605486023c0ad900bde6590', bytes: 3766 },
    'MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_AUDIT_V309.md': { sha: '199088e48f75d8cb877a2f8611c2462090d0e1ea', bytes: 2841 }
  });
  assert.deepEqual(parseHistoricalArchiveTable(text, archive).sort(), Object.keys(originals).sort());
  for (const [name, expected] of Object.entries(originals)) {
    assert.equal(fs.existsSync(path.join(ROOT, name)), false, 'retired historical audit returned: ' + name);
    assert.ok(text.includes('`' + expected.sha + '`'), 'original SHA-1 missing: ' + name);
    assert.ok(text.includes('| ' + expected.bytes.toLocaleString('en-US') + ' |'), 'original size missing: ' + name);
    assert.ok(text.includes('https://github.com/mfukutomi8028-oss/task-kanri/blob/' + base + '/' + name + ')'),
      'immutable recovery URL missing: ' + name);
  }
  for (const current of [
    'mobile-shell-v234.js', 'MOBILE_SHELL_NAV_SCOPE_V308.md',
    'MOBILE_SHELL_CREATE_MENU_OUTSIDE_CLICK_V310.md',
    'test-harness/mobile-shell-nav-scope-v308.test.mjs',
    'test-harness/mobile-shell-create-menu-outside-click-v310.test.mjs'
  ]) assert.ok(fs.existsSync(path.join(ROOT, current)), 'retained owner missing: ' + current);
  assert.ok(text.includes('2 files / 6,607 bytes'));
  assert.ok(text.includes('blob/main/') && text.includes('Issue #292'));
});
