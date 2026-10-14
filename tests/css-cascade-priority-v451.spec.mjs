import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const current = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const ORIGINAL_GIT_BLOB = 'dd210b34000eff6703b24f0d32dd69a54e0675b9';
const CURRENT_GIT_BLOB = '4f2465e7f3367518ba71e931e60af2ea06bd52fd';
const priorityStart = '.priority-card {\n  border-left-width: 5px !important;\n  border-left-style: solid !important;\n}\n\n';
const earlyAnchor = '.priority-row {\n  border-left: 5px solid transparent;\n}';
const afterCanonical = '/* 今日までのタスクは、左端の橙ラインを廃止してバッジと薄い枠で表現 */';

function blobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

function originalBeforeDedupe() {
  const start = current.indexOf(priorityStart);
  const end = current.indexOf(afterCanonical, start);
  expect(start, 'retained canonical priority group must exist').toBeGreaterThan(-1);
  expect(end, 'canonical group boundary must exist').toBeGreaterThan(start);
  const canonical = current.slice(start, end);
  expect(current.split(priorityStart)).toHaveLength(2);
  expect(current.split(earlyAnchor)).toHaveLength(2);
  expect(canonical).toContain('.priority-row.priority-緊急');
  expect(canonical).toContain('.priority-row.priority-低');
  expect(canonical.endsWith('\n\n')).toBe(true);
  return current.replace(earlyAnchor, canonical + earlyAnchor);
}

const variants = [
  'task-card priority-card priority-緊急',
  'task-card priority-card priority-高',
  'task-card priority-card priority-中',
  'task-card priority-card priority-低',
  'priority-row priority-緊急',
  'priority-row priority-高',
  'priority-row priority-中',
  'priority-row priority-低',
  'task-card priority-card priority-緊急 due-today',
  'task-card priority-card priority-高 overdue',
  'task-card priority-card priority-低 pinned',
  'task-card priority-card priority-中 stale'
];
const fields = [
  'border-left-color', 'border-left-style', 'border-left-width',
  'border-color', 'border-style', 'border-width', 'box-shadow', 'background-color',
  'background-image', 'color', 'display', 'box-sizing', 'padding-left', 'margin-left',
  'outline-color', 'outline-style', 'outline-width'
];

async function computedStyles(page, source) {
  const element = await page.addStyleTag({ content: source });
  try {
    return await page.evaluate(props => [...document.querySelectorAll('[data-css-v451]')].map(node => {
      const style = getComputedStyle(node);
      return Object.fromEntries(props.map(property => [property, style.getPropertyValue(property)]));
    }), fields);
  } finally {
    await element.evaluate(node => node.remove());
  }
}

test('Ver.451: deleting only earlier duplicate priority declarations preserves Chromium cascade', async ({ page }) => {
  const original = originalBeforeDedupe();
  expect(blobSha(original), 'the restored old stylesheet must exactly match Git Ver.450').toBe(ORIGINAL_GIT_BLOB);
  expect(blobSha(current), 'only the verified Ver.451 cleanup changed style.css').toBe(CURRENT_GIT_BLOB);
  expect(Buffer.byteLength(original) - Buffer.byteLength(current)).toBe(506);

  await page.setContent('<!doctype html><html><body><main class="app-shell"><section class="today-mode">' +
    variants.map((classes, index) => '<div data-css-v451="' + index + '" class="' + classes + '">Fixture</div>').join('') +
    '</section></main></body></html>');

  for (const width of [390, 860, 861, 980, 1366, 1450, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await computedStyles(page, original);
    const after = await computedStyles(page, current);
    expect(after, 'computed CSS differs from immutable pre-Ver.451 stylesheet at width ' + width).toEqual(before);
  }
});
