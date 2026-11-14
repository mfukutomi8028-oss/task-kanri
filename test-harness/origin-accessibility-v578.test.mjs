import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('origin-modern-v372.js', 'utf8');

// Extract only the theme token; this stays independent of Classic and JOURNAL.
const token = (name) => {
  const match = source.match(new RegExp('\\-\\-' + name + ':(#[0-9a-f]{6}|#[0-9a-f]{3})(?![0-9a-f])', 'i'));
  assert.ok(match, 'Missing Origin color token: ' + name);
  return match[1].length === 4 ? '#' + [...match[1].slice(1)].map(char => char + char).join('') : match[1];
};
const luminance = (hex) => {
  const channels = hex.slice(1).match(/.{2}/g).map(part => parseInt(part, 16) / 255);
  const linear = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};
const ratio = (a, b) => {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

test('Origin light theme secondary labels maintain 4.5:1 against paper and page backgrounds', () => {
  for (const background of [token('paper'), token('bg')]) {
    assert.ok(ratio(token('muted'), background) >= 4.5, 'Muted text contrast too low for ' + background);
  }
});

test('Origin global and full search fields show focus on their visible containers', () => {
  assert.match(source, /\.searchbox:focus-within\{[^}]*outline:2px solid var\(--accent\)/);
  assert.match(source, /\.origin-full-search-field:focus-within\{[^}]*outline:2px solid var\(--accent\)/);
  assert.match(source, /button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible/);
});
