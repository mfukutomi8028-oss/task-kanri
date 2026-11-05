import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../journal-display-v367.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../journal-display-v367.css', import.meta.url), 'utf8');
const selector = readFileSync(new URL('../modern-display-v356.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../release-manifest.js', import.meta.url), 'utf8');
const responsibilities = JSON.parse(readFileSync(new URL('../patch-responsibilities.json', import.meta.url), 'utf8'));

test('Journal remains a presentation without a second store or write controller', () => {
  assert.doesNotMatch(js, /\b(?:initializeApp|getDatabase|runTransaction|onValue|setDatabase|updateDatabase|removeDatabase)\s*\(/);
  assert.doesNotMatch(js, /iframe|contentWindow|cloneNode|document\.write/);
  assert.match(js, /target\.click\(\)/);
  assert.match(js, /data-journal-create/);
  assert.match(js, /data-journal-sheet/);
  assert.match(js, /workBoardJournalThemeV367:/);
  assert.match(js, /systemTaskUser/);
  assert.match(selector, /new Set\(\['classic', 'modern', 'palette', 'journal'\]\)/);
  assert.match(selector, /\['journal', 'Journal'/);
});
test('Linen and Margin use different notebook layouts, gated by the display', () => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((stripped.match(/\{/g) || []).length, (stripped.match(/\}/g) || []).length);
  assert.match(css, /data-wb-display="journal"/);
  assert.match(css, /data-wb-journal-theme="linen"/);
  assert.match(css, /data-wb-journal-theme="margin"/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.32fr\) minmax\(0,\.78fr\)/);
  assert.match(css, /radial-gradient\(circle,#849785/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /#todayView > \.today-grid/);
  assert.match(css, /#todayView > \.today-todo-preview/);
});
test('Journal CSS and JS are published and owned once', () => {
  for (const name of ['journal-display-v367.js', 'journal-display-v367.css']) {
    assert.match(manifest, new RegExp(name.replaceAll('.', '\\.')));
    const owners = responsibilities.groups.filter(item => item.assets.includes(name));
    assert.equal(owners.length, 1);
    assert.equal(owners[0].id, 'journal-display');
  }
  assert.equal(responsibilities.baselineRelease, '368');
});
