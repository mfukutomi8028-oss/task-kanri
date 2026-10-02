import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.347 product scopes comment-reactions keydown to fixed detail root', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(['"]keydown['"],\s*event\s*=>/);
  assert.match(source, /bindGlobalEvents\(root\)/);
  assert.match(source, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(source, /\(event\.ctrlKey\s*\|\|\s*event\.metaKey\)\s*&&\s*event\.key\s*===\s*['"]Enter['"]/);
});

test('Ver.347 product keeps click and detail observer ownership after later submit-scope cleanup', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /document\.addEventListener\(["']click["']/);
  assert.match(source, /const\s+root\s*=\s*document\.getElementById\(["']detailBody["']\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
  assert.match(source, /bindGlobalEvents\(root\)/);
});

test('Ver.347 release history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 289);
  assert.equal(String(responsibilities.baselineRelease), release);
  const owner = responsibilities.groups?.find(group => group.id === 'user-and-comments');
  assert.ok(owner, 'user-and-comments responsibility must remain mapped');
  assert.match(String(owner.reason || ''), /Ver\.347製品/);
  assert.match(String(owner.reason || ''), /release 289/);
});
