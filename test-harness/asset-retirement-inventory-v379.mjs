// Ver.379: read-only asset inventory. "candidate" never authorizes deletion.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_RUNTIME_ALIASES } from './build-pages-runtime-v382.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATE_EXTENSIONS = new Set(['.js', '.css', '.png', '.svg']);
const READABLE_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.json', '.yml', '.yaml', '.ps1', '.svg', '.md']);
// Deliberately retained for local setup but never deployed as web runtime.
const SOURCE_ONLY_DEVELOPER_ASSETS = new Set(['config.example.js']);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.pages-runtime', '.firebase', 'playwright-report', 'test-results', 'coverage']);
const normalize = value => value.split(path.sep).join('/');

function walk(root, current = root) {
  if (!fs.existsSync(current)) return [];
  return fs.readdirSync(current, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) return EXCLUDED_DIRS.has(entry.name) ? [] : walk(root, full);
    return entry.isFile() ? [{ relative: normalize(path.relative(root, full)), full }] : [];
  });
}

function assetList(root) {
  const top = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && ['.js', '.css'].includes(path.extname(entry.name)))
    .map(entry => ({ relative: entry.name, full: path.join(root, entry.name) }));
  const images = walk(root, path.join(root, 'assets'))
    .filter(item => ['.png', '.svg'].includes(path.extname(item.relative)));
  return [...top, ...images].sort((a, b) => a.relative.localeCompare(b.relative));
}

function manifestAssets(source) {
  const names = ['requiredAssets', 'optionalAssets', 'dynamicStyles', 'dynamicScripts', 'mobileScripts'];
  const result = {};
  for (const name of names) {
    const match = source.match(new RegExp(name + ':\\s*\\[([\\s\\S]*?)\\]'));
    if (!match) throw new Error('Manifest array missing: ' + name);
    result[name] = [...match[1].matchAll(/"([^"]+)"/g)].map(entry => entry[1]);
  }
  return result;
}

function isMentioned(text, relative) {
  const base = path.posix.basename(relative);
  // Textual matches are only a conservative heuristic, never proof of execution.
  return text.includes(relative) || text.includes('"' + base + '"')
    || text.includes("'" + base + "'") || text.includes('/' + base);
}
function references(sources, relative) {
  return sources.filter(source => source.relative !== relative
    && isMentioned(source.text, relative)).map(source => source.relative);
}

export function inventory(root = DEFAULT_ROOT) {
  const manifestFile = path.join(root, 'release-manifest.js');
  if (!fs.existsSync(manifestFile)) throw new Error('release-manifest.js missing');
  const manifestText = fs.readFileSync(manifestFile, 'utf8');
  const manifest = manifestAssets(manifestText);
  // Every manifest loading category is an active declaration. Excluding the dynamic
  // lists falsely labels deferred assets as manual deletion candidates.
  const declared = new Set(Object.values(manifest).flat());
  // A cached Pages URL may depend on a source absent from today's manifest.
  const aliasesByTarget = new Map();
  for (const [legacyUrl, physicalTarget] of Object.entries(LEGACY_RUNTIME_ALIASES)) {
    const urls = aliasesByTarget.get(physicalTarget) || [];
    urls.push(legacyUrl);
    aliasesByTarget.set(physicalTarget, urls);
  }
  const all = walk(root);
  const sources = all.filter(item => READABLE_EXTENSIONS.has(path.extname(item.relative)))
    .map(item => ({ relative: item.relative, text: fs.readFileSync(item.full, 'utf8') }));
  const runtimeSourcePaths = new Set([
    'index.html', 'app.js', 'config.js', 'release-manifest.js', ...declared
  ]);
  const runtimeSources = sources.filter(item => runtimeSourcePaths.has(item.relative));
  const testSources = sources.filter(item => item.relative.startsWith('test-harness/')
    || item.relative.startsWith('tests/')
    || item.relative.startsWith('.github/workflows/'));
  const docs = sources.filter(item => item.relative.endsWith('.md'));
  const rows = assetList(root).map(file => {
    const activeDeclaration = declared.has(file.relative);
    const legacyAliasUrls = (aliasesByTarget.get(file.relative) || []).slice().sort();
    const liveReferences = references(runtimeSources, file.relative);
    const testReferences = references(testSources, file.relative);
    const historyReferences = references(docs, file.relative);
    const classification = activeDeclaration ? 'declared-active'
      : SOURCE_ONLY_DEVELOPER_ASSETS.has(file.relative) ? 'source-only-developer-config'
      : legacyAliasUrls.length ? 'published-alias-target'
      : liveReferences.length ? 'runtime-reference'
      : testReferences.length ? 'test-contract-or-reference'
      : 'candidate-manual-review';
    return {
      path: file.relative,
      ext: path.extname(file.relative),
      bytes: fs.statSync(file.full).size,
      classification,
      declared: activeDeclaration,
      legacyAliasUrls,
      runtimeRefs: liveReferences,
      testRefs: testReferences,
      documentationRefs: historyReferences.length
    };
  });
  const summary = {
    total: rows.length,
    bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    byClass: Object.fromEntries(['declared-active', 'source-only-developer-config', 'published-alias-target', 'runtime-reference',
      'test-contract-or-reference', 'candidate-manual-review'].map(kind =>
      [kind, rows.filter(row => row.classification === kind).length])),
    byExtension: Object.fromEntries([...CANDIDATE_EXTENSIONS].map(ext =>
      [ext, rows.filter(row => row.ext === ext).length])),
    candidatesBytes: rows.filter(row => row.classification === 'candidate-manual-review')
      .reduce((sum, row) => sum + row.bytes, 0),
    declaredMissing: [...declared].filter(file => !fs.existsSync(path.join(root, file))
      && !(LEGACY_RUNTIME_ALIASES[file] && fs.existsSync(path.join(root, LEGACY_RUNTIME_ALIASES[file]))))
  };
  return { summary, rows };
}

export function markdown(report) {
  const { summary, rows } = report;
  const output = [
    '# Physical asset inventory (read-only; deletion not authorized)',
    '',
    '| Classification | Count |',
    '|---|---:|',
    ...Object.entries(summary.byClass).map(([label, value]) => '| ' + label + ' | ' + value + ' |'),
    '',
    'Total asset candidates examined: ' + summary.total + '; raw bytes: ' + summary.bytes + '.',
    'Manual-review candidates: ' + summary.byClass['candidate-manual-review']
      + ' (' + summary.candidatesBytes + ' bytes).',
    '',
    'A lack of literal references is not proof of safety: dynamic path generation,',
    'legacy cached HTML/manifests, archived releases, and rollback may still need a file.',
    'published-alias-target protects physical sources of historical Pages URLs.',
    'source-only-developer-config keeps local setup examples outside Pages assets.',
    'This tool **does not delete or modify** any file.',
    '',
    '| File | Bytes | Classification | Legacy alias URLs | Runtime refs | Test refs |',
    '|---|---:|---|---:|---:|---:|',
    ...rows.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).map(row =>
      '| ' + row.path + ' | ' + row.bytes + ' | ' + row.classification
      + ' | ' + row.legacyAliasUrls.length + ' | ' + row.runtimeRefs.length
      + ' | ' + row.testRefs.length + ' |')
  ];
  return output.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = inventory();
  process.stdout.write(process.argv.includes('--json')
    ? JSON.stringify(report, null, 2) + '\n'
    : markdown(report));
}
