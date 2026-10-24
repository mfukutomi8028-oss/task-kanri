import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const css = read('ui-motion-v533.css');
const manifest = read('release-manifest.js');
const html = read('index.html');

function inventory(name) {
  const match = manifest.match(new RegExp(name + ':\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})'));
  assert.ok(match, name + ' inventory is missing');
  return [...match[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

test('Ver.533 motion is released once, as the final dynamic stylesheet', () => {
  const required = inventory('requiredAssets');
  const styles = inventory('dynamicStyles');
  assert.equal(required.filter(f => f === 'ui-motion-v533.css').length, 1);
  assert.equal(styles.filter(f => f === 'ui-motion-v533.css').length, 1);
  assert.equal(styles.at(-1), 'ui-motion-v533.css');
  assert.doesNotMatch(html, /<link[^>]+href="ui-motion-v533\.css/);
  assert.match(read('config.js'), /STYLES\.map\(\(\[href, marker\]\) => loadStylesheet/);
});

test('Ver.533 motion is short-lived and avoids altering layout and drag geometry', () => {
  assert.match(css, /--wm-motion-press-v533:\s*100ms/);
  assert.match(css, /--wm-motion-interact-v533:\s*140ms/);
  assert.match(css, /--wm-motion-dialog-v533:\s*210ms/);
  assert.doesNotMatch(css, /transition:\s*all\b/);
  assert.doesNotMatch(css, /animation[^;]*infinite/i);
  assert.doesNotMatch(css, /transition[^;]*\b(?:width|height|grid-template-columns|top|left)\b/i);
  const dialogRule = css.match(/dialog\[open\]\s*\{([^}]+)\}/);
  assert.ok(dialogRule, 'native dialog entrance is missing');
  assert.doesNotMatch(dialogRule[1], /\btransform\b/);
  assert.match(css, /\.task-card\[draggable="true"\]/);
});

test('Ver.533 limits view motion to active views and respects reduced motion', () => {
  assert.match(css, /body\.today-mode #todayView:not\(\[hidden\]\)/);
  assert.match(css, /body\.todo-mode #todoView:not\(\[hidden\]\)/);
  assert.match(css, /body\.work-memo-mode-v167 #workMemoViewV167/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /#todoView,[\s\S]*#workMemoViewV167\s*\{[\s\S]*animation:\s*none !important/);
});
