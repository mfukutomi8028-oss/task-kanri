// Temporary read-only diagnostic. Remove before the final Ver.490 merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'test-harness');
const self = 'protocol-duplicate-diagnostic-v490.test.mjs';

test('Ver.490 one-shot diagnostic identifies genuinely repeated protocol assertions', () => {
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.test.mjs') && name !== self).sort();
  assert.equal(files.length, 117, 'unexpected baseline Protocol file count');
  const clauses = new Map();
  const titles = new Map();
  let totalAssertions = 0;
  for (const name of files) {
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // One complete statement on one line: do not mistake multiline or nested expressions
      // for identical tests. This diagnostic is deliberately conservative.
      if (/^assert\.(?:match|doesNotMatch|ok|equal|strictEqual|deepEqual|notEqual|notStrictEqual)\(.*\);(?:\s*\/\/.*)?$/.test(line)) {
        totalAssertions++;
        const key = line.replace(/\s+\/\/.*$/, '').replace(/\s+/g, ' ');
        if (!clauses.has(key)) clauses.set(key, []);
        clauses.get(key).push({ file: name, line: i + 1 });
      }
      const title = line.match(/^test\(\s*['"]([^'"]+)['"]/);
      if (title) {
        if (!titles.has(title[1])) titles.set(title[1], []);
        titles.get(title[1]).push({ file: name, line: i + 1 });
      }
    }
  }
  const repeated = [...clauses.entries()].map(([statement, hits]) => ({
    statement, hits, files: [...new Set(hits.map(h => h.file))]
  })).filter(x => x.files.length > 1)
    .sort((a, b) => b.files.length - a.files.length || b.hits.length - a.hits.length || a.statement.localeCompare(b.statement));
  const pairs = new Map();
  for (const group of repeated) {
    const names = group.files.sort();
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const key = names[i] + ' <=> ' + names[j];
      const current = pairs.get(key) || { pair: key, count: 0, samples: [] };
      current.count++;
      if (current.samples.length < 9) current.samples.push(group.statement.slice(0, 250));
      pairs.set(key, current);
    }
  }
  const duplicateTitles = [...titles.entries()].filter(([, rows]) => new Set(rows.map(x => x.file)).size > 1);
  console.log('VER490_DIAGNOSTIC_SUMMARY', JSON.stringify({
    suites: files.length, oneLineAssertions: totalAssertions, groups: repeated.length,
    overlappingPairs: pairs.size, sameTitleAcrossFiles: duplicateTitles.length
  }));
  console.log('VER490_TOP_PAIRS', JSON.stringify([...pairs.values()].sort((a, b) => b.count - a.count).slice(0, 65)));
  console.log('VER490_DUPLICATE_GROUPS', JSON.stringify(repeated.slice(0, 95).map(x => ({
    statement: x.statement.slice(0, 450), hits: x.hits
  }))));
  console.log('VER490_DUPLICATE_TITLES', JSON.stringify(duplicateTitles.slice(0, 40)));
  assert.ok(totalAssertions >= 150, 'diagnostic failed to find baseline assertions');
});
