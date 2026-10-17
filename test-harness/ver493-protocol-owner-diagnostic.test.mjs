// Ver.493 temporary read-only ownership scan. This file must not be merged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGitIndex } from './root-markdown-reference-v426.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OLD_NAMES = [
  'comment-reactions-submit-scope-v348.test.mjs',
  'comment-reactions-click-scope-v350.test.mjs'
];
const TEXT_EXT = new Set(['.js','.mjs','.cjs','.md','.json','.yaml','.yml','.ts','.tsx','.css','.html','.txt','.ps1','.sh','.svg','.xml']);
test('Ver.493 temporary scan of tracked references to two Protocol suites', () => {
  const raw = execFileSync('git', ['ls-files', '--stage', '-z'],
    {cwd:ROOT, encoding:'utf8', maxBuffer:8*1024*1024});
  const entries = parseGitIndex(raw);
  const sources = entries.filter(e => TEXT_EXT.has(path.extname(e.path).toLowerCase()));
  const reports = OLD_NAMES.map(basename => ({
    name: basename, matches: [], unreadable: []
  }));
  let filesScanned = 0;
  for (const entry of sources) {
    if (entry.path === 'test-harness/ver493-protocol-owner-diagnostic.test.mjs') continue;
    if (OLD_NAMES.some(name => entry.path === 'test-harness/' + name)) continue;
    let content;
    try { content = fs.readFileSync(path.join(ROOT,entry.path),'utf8'); }
    catch (error) {
      reports.forEach(r => r.unreadable.push({path:entry.path,reason:String(error)}));
      continue;
    }
    filesScanned++;
    for (const report of reports) {
      if (!content.includes(report.name)) continue;
      const lines = content.split(/\r?\n/);
      const found = [];
      for (let i=0;i<lines.length;i++) {
        if (lines[i].includes(report.name)) found.push(i+1);
      }
      report.matches.push({path:entry.path,kind:entry.path.startsWith('test-harness/')||entry.path.startsWith('tests/')?'test_or_tool':entry.path.endsWith('.md')?'documentation':'runtime_or_config',lines:found.slice(0,8)});
    }
  }
  for (const r of reports) {
    console.log('VER493_OWNER_SCAN',JSON.stringify({name:r.name,scanned:filesScanned,matches:r.matches,readErrors:r.unreadable}));
    assert.equal(r.unreadable.length,0,'no unreadable tracked text');
  }
});
