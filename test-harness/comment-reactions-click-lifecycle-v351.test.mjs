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

test('Ver.352 product advances release and responsibility baseline to 291', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '291');
  assert.equal(String(responsibilities.baselineRelease), '291');
  assert.match(manifest, /installFirstPaintGuardV291/);
  assert.match(manifest, /const\s+VERSION\s*=\s*['"]291['"]/);
  assert.match(manifest, /wb-first-paint-v291/);
  assert.match(manifest, /__WB_LEGACY_ICON_OBSERVER_V291__/);
});

test('Ver.352 product records the next comment-reactions observer audit', () => {
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const candidate = responsibilities.priorityCandidates?.[0];
  assert.deepEqual(candidate?.scope, ['comment-reactions-v191.js']);
  assert.match(String(candidate?.goal || ''), /Ver\.353/);
  assert.match(String(candidate?.goal || ''), /MutationObserver semantic filter監査/);

  const source = read('comment-reactions-v191.js');
  assert.match(source, /new\s+MutationObserver\(mutations\s*=>/);
  assert.match(source, /mutations\.some\(item\s*=>\s*item\.addedNodes\.length\s*\|\|\s*item\.removedNodes\.length\)/);
});
