import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Ver.352 product keeps comment click operations on fixed detail root and outside dismissal lifecycle-bound', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /let\s+pickerOutsideClickBound\s*=\s*false/);
  assert.match(source, /function\s+handlePickerOutsideClick\s*\(event\)/);
  assert.match(source, /function\s+setPickerOutsideClick\s*\(active\)/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /document\.removeEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /if\s*\(next\s*===\s*pickerOutsideClickBound\)\s*return/);
  assert.match(source, /setPickerOutsideClick\(opening\)/);
  assert.match(source, /setPickerOutsideClick\(Boolean\(document\.querySelector\(["']\.comment-reaction-picker-v165:not\(\[hidden\]\)["']\)\)\)/);
});

test('Ver.352 product preserves reply/reaction semantics and existing detail submit/keydown ownership', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /event\.target\.closest\(['"]\[data-comment-reply-target\]['"]\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-picker\]["']\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]["']\)/);
  assert.match(source, /if\s*\(!event\.target\.closest\(["']\.comment-reactions-v165["']\)\)\s*closePickers\(\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
  assert.match(source, /if\s*\(event\.key\s*===\s*['"]Escape['"]\)/);
  assert.match(source, /\.observe\(root,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/);
});

test('Ver.352 release-291 product history remains durable in later aligned releases', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);
  assert.ok(release >= 291);
  assert.equal(Number(responsibilities.baselineRelease), release);

  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.352製品/);
  assert.match(reason, /常設document capture clickを撤去/);
  assert.match(reason, /release 291へ更新/);
});

test('Ver.352 handoff to the observer audit remains recorded after later observer productization', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const group = responsibilities.groups.find(item => item.id === 'user-and-comments');
  const reason = String(group?.reason || '');
  assert.match(reason, /Ver\.353監査/);
  assert.match(reason, /#detailBody subtree childList observer/);
  assert.match(reason, /semantic candidate/);
  assert.match(reason, /Ver\.354製品/);

  const source = read('comment-reactions-v191.js');
  assert.match(source, /new\s+MutationObserver\(mutations\s*=>/);
  assert.match(source, /mutationTouchesCommentSurfaceV354/);
  assert.doesNotMatch(source, /mutations\.some\(item\s*=>\s*item\.addedNodes\.length\s*\|\|\s*item\.removedNodes\.length\)/);
});

// Ver.492: preserve all three original Ver.347 tests and their 15 assertions verbatim.
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

test('Ver.492 keeps the retired Ver.347 standalone keydown suite absent', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'test-harness', 'comment-reactions-keydown-scope-v346.test.mjs')),
    false, 'former Ver.347 entrypoint must remain retired');
});
