import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const current = readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const ORIGINAL_GIT_BLOB = 'dd210b34000eff6703b24f0d32dd69a54e0675b9';
const VER451_GIT_BLOB = '4f2465e7f3367518ba71e931e60af2ea06bd52fd';
const VER455_GIT_BLOB = '19f3b65c6bd098efaf42b9a25d9c774802319539';
const CURRENT_GIT_BLOB = '62ec1fe101f2a6fdcc8351d27bf77fbd92f534e5';
// Exact substrings and offsets in the last verified Ver.455 stylesheet.
const VER456_RETIRED_STYLES = [[47597,".compact-header .hero {\n  min-height: 96px;\n  padding-top: 22px;\n  padding-bottom: 22px;\n}\n\n"],[47689,".compact-header .hero .eyebrow {\n  display: none;\n}\n\n"],[47742,".compact-header .hero h2 {\n  font-size: clamp(30px, 3vw, 46px);\n}\n\n"],[48057,".density-switcher {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  white-space: nowrap;\n  color: #61798d;\n  font-size: 12px;\n  font-weight: 1000;\n}\n\n"],[48220,".density-switcher select {\n  min-height: 48px;\n  border-radius: 16px;\n  border: 1px solid #d9e6ef;\n  padding: 0 12px;\n  font-weight: 1000;\n}\n\n"],[53930,".density-switcher {\n  min-width: 0;\n}\n\n"],[53969,".density-switcher select {\n  width: 120px;\n}\n\n"],[54618,"  .density-switcher {\n    grid-column: 1 / 2;\n  }\n\n"],[58060,".density-switcher {\n  grid-area: density !important;\n  width: 100% !important;\n  justify-self: start !important;\n}\n\n"],[58176,".density-switcher select {\n  width: 180px !important;\n}\n\n"]];
// Reinsert Ver.455's exact deleted block to preserve Ver.451 immutable CSS lineage.
const RETIRED_V455_DECORATION = ".saved-filter-list {\n  display: grid;\n  gap: 8px;\n}\n\n.saved-filter-item {\n  display: grid;\n  grid-template-columns: 1fr auto;\n  gap: 6px;\n}\n\n.saved-filter-item button:first-child {\n  border: 1px solid rgba(255,255,255,.16);\n  background: rgba(255,255,255,.13);\n  color: #fff;\n  border-radius: 14px;\n  padding: 9px 10px;\n  text-align: left;\n  font-weight: 1000;\n  cursor: pointer;\n}\n\n.delete-saved-filter {\n  border: 1px solid rgba(255,255,255,.18);\n  background: rgba(255,255,255,.10);\n  color: #fff;\n  border-radius: 12px;\n  width: 34px;\n  font-weight: 1000;\n  cursor: pointer;\n}\n\n";
const REINSERT_BEFORE = ".today-view {\n  display: grid;\n  gap: 16px;\n}";
const priorityStart = '.priority-card {\n  border-left-width: 5px !important;\n  border-left-style: solid !important;\n}\n\n';
const earlyAnchor = '.priority-row {\n  border-left: 5px solid transparent;\n}';
const afterCanonical = '/* 今日までのタスクは、左端の橙ラインを廃止してバッジと薄い枠で表現 */';

function blobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

function restoredVer455Css() {
  let restored = current;
  for (const [offset, fragment] of VER456_RETIRED_STYLES) {
    restored = restored.slice(0, offset) + fragment + restored.slice(offset);
  }
  expect(blobSha(restored), 'Ver.455 stylesheet restoration must be exact').toBe(VER455_GIT_BLOB);
  return restored;
}

function restoredVer451Css(ver455) {
  const anchorAt = ver455.indexOf(REINSERT_BEFORE);
  expect(ver455.split(REINSERT_BEFORE)).toHaveLength(2);
  expect(anchorAt, 'the Today CSS anchor must be retained').toBeGreaterThan(-1);
  const restored = ver455.slice(0, anchorAt) + RETIRED_V455_DECORATION + ver455.slice(anchorAt);
  expect(blobSha(restored), 'Ver.451 stylesheet restoration must be exact').toBe(VER451_GIT_BLOB);
  return restored;
}

function originalBeforeDedupe(ver451) {
  const start = ver451.indexOf(priorityStart);
  const end = ver451.indexOf(afterCanonical, start);
  expect(start, 'retained canonical priority group must exist').toBeGreaterThan(-1);
  expect(end, 'canonical group boundary must exist').toBeGreaterThan(start);
  const canonical = ver451.slice(start, end);
  expect(ver451.split(priorityStart)).toHaveLength(2);
  expect(ver451.split(earlyAnchor)).toHaveLength(2);
  expect(canonical).toContain('.priority-row.priority-緊急');
  expect(canonical).toContain('.priority-row.priority-低');
  expect(canonical.endsWith('\n\n')).toBe(true);
  return ver451.replace(earlyAnchor, canonical + earlyAnchor);
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
  const ver455 = restoredVer455Css();
  const ver451 = restoredVer451Css(ver455);
  const original = originalBeforeDedupe(ver451);
  expect(blobSha(original), 'the restored old stylesheet must exactly match Git Ver.450').toBe(ORIGINAL_GIT_BLOB);
  expect(blobSha(current), 'Ver.456 current stylesheet must be exact').toBe(CURRENT_GIT_BLOB);
  expect(Buffer.byteLength(original) - Buffer.byteLength(ver451)).toBe(510);
  expect(Buffer.byteLength(ver451) - Buffer.byteLength(ver455)).toBe(582);
  expect(Buffer.byteLength(ver455) - Buffer.byteLength(current)).toBe(826);

  await page.setContent('<!doctype html><html><body><main class="app-shell"><section class="today-mode">' +
    variants.map((classes, index) => '<div data-css-v451="' + index + '" class="' + classes + '">Fixture</div>').join('') +
    '</section></main></body></html>');

  for (const width of [390, 860, 861, 980, 1366, 1450, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await computedStyles(page, original);
    const afterVer451 = await computedStyles(page, ver451);
    const afterVer455 = await computedStyles(page, ver455);
    const afterVer456 = await computedStyles(page, current);
    expect(afterVer451, 'Ver.451 must match immutable Ver.450 at width ' + width).toEqual(before);
    expect(afterVer455, 'Ver.455 must preserve the Ver.451 cascade at width ' + width).toEqual(afterVer451);
    expect(afterVer456, 'Ver.456 must preserve the Ver.455 cascade at width ' + width).toEqual(afterVer455);
  }
});
