import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function replaceOnce(source, before, after, label) {
  assert.ok(source.includes(before), `Ver.351 candidate anchor missing: ${label}`);
  const next = source.replace(before, after);
  assert.notEqual(next, source, `Ver.351 candidate replacement failed: ${label}`);
  return next;
}

function candidateSource() {
  let source = read('comment-reactions-v191.js');
  source = replaceOnce(
    source,
    '  let replyTarget = null;\n',
    '  let replyTarget = null;\n  let pickerOutsideClickBound = false;\n',
    'picker outside-click lifecycle state'
  );

  const oldClose = `  function closePickers(except = null) {\n    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {\n      if (picker === except) return;\n      picker.hidden = true;\n      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");\n    });\n  }\n\n  function bindGlobalEvents(root) {`;
  const nextClose = `  function closePickers(except = null) {\n    document.querySelectorAll(".comment-reaction-picker-v165:not([hidden])").forEach(picker => {\n      if (picker === except) return;\n      picker.hidden = true;\n      picker.parentElement?.querySelector("[data-comment-reaction-picker]")?.setAttribute("aria-expanded", "false");\n    });\n    setPickerOutsideClick(Boolean(document.querySelector(".comment-reaction-picker-v165:not([hidden])")));\n  }\n\n  function handlePickerOutsideClick(event) {\n    if (!document.querySelector(".comment-reaction-picker-v165:not([hidden])")) {\n      setPickerOutsideClick(false);\n      return;\n    }\n    if (!event.target.closest?.(".comment-reactions-v165")) closePickers();\n  }\n\n  function setPickerOutsideClick(active) {\n    const next = Boolean(active);\n    if (next === pickerOutsideClickBound) return;\n    pickerOutsideClickBound = next;\n    if (next) document.addEventListener("click", handlePickerOutsideClick, true);\n    else document.removeEventListener("click", handlePickerOutsideClick, true);\n  }\n\n  function bindGlobalEvents(root) {`;
  source = replaceOnce(source, oldClose, nextClose, 'closePickers lifecycle split');

  source = replaceOnce(
    source,
    '    document.addEventListener("click", event => {',
    '    root.addEventListener("click", event => {',
    'local click delegation root'
  );

  source = replaceOnce(
    source,
    '        pickerButton.setAttribute("aria-expanded", opening ? "true" : "false");\n        return;',
    '        pickerButton.setAttribute("aria-expanded", opening ? "true" : "false");\n        setPickerOutsideClick(opening);\n        return;',
    'picker open/close lifecycle sync'
  );

  return source;
}

test('Ver.351 audit isolates local click handling from picker outside-dismiss ownership', () => {
  const source = read('comment-reactions-v191.js');
  assert.match(source, /function\s+bindGlobalEvents\s*\(root\)/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
});

test('Ver.351 candidate keeps local operations on #detailBody and makes document click lifecycle-bound', () => {
  const source = candidateSource();
  assert.match(source, /root\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.doesNotMatch(source, /document\.addEventListener\(\s*["']click["']\s*,\s*event\s*=>/);
  assert.match(source, /let\s+pickerOutsideClickBound\s*=\s*false/);
  assert.match(source, /document\.addEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /document\.removeEventListener\(\s*["']click["']\s*,\s*handlePickerOutsideClick\s*,\s*true\s*\)/);
  assert.match(source, /if\s*\(next\s*===\s*pickerOutsideClickBound\)\s*return/);
  assert.match(source, /setPickerOutsideClick\(opening\)/);
  assert.match(source, /setPickerOutsideClick\(Boolean\(document\.querySelector\(["']\.comment-reaction-picker-v165:not\(\[hidden\]\)["']\)\)\)/);
});

test('Ver.351 candidate preserves reply/reaction click semantics and root submit/keydown ownership', () => {
  const source = candidateSource();
  assert.match(source, /event\.target\.closest\(['"]\[data-comment-reply-target\]['"]\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-picker\]["']\)/);
  assert.match(source, /event\.target\.closest\(["']\[data-comment-reaction-id\]\[data-comment-reaction-emoji\]["']\)/);
  assert.match(source, /if\s*\(!event\.target\.closest\(["']\.comment-reactions-v165["']\)\)\s*closePickers\(\)/);
  assert.match(source, /root\.addEventListener\(\s*['"]submit['"]/);
  assert.match(source, /root\.addEventListener\(\s*['"]keydown['"]/);
  assert.match(source, /if\s*\(event\.key\s*===\s*['"]Escape['"]\)/);
});

test('Ver.351 audit keeps product runtime and release 290 unchanged', () => {
  const manifest = read('release-manifest.js');
  const responsibilities = JSON.parse(read('patch-responsibilities.json'));
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '290');
  assert.equal(String(responsibilities.baselineRelease), '290');
});
