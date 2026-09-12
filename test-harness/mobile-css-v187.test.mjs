import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function extractStringArray(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]\\s*(?:,|\\n\\s*\\})`));
  assert.ok(match, `${name} must exist in release-manifest.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

test('Ver.187+ keeps mixed ui-v157 retired while preserving each mobile correction in its owning CSS', () => {
  const manifest = read('release-manifest.js');
  const release = Number(manifest.match(/version:\s*"(\d+)"/)?.[1] || 0);
  assert.ok(release >= 187, `mobile ownership contract requires release 187 or later, got ${release}`);

  const required = extractStringArray(manifest, 'requiredAssets');
  const styles = extractStringArray(manifest, 'dynamicStyles');
  assert.equal(styles.length, 23, 'Ver.187+ should keep the reduced dynamic stylesheet count');
  assert.ok(!required.includes('ui-v157.css'), 'ui-v157.css must no longer be a required runtime asset');
  assert.ok(!styles.includes('ui-v157.css'), 'ui-v157.css must no longer be dynamically loaded');
  assert.ok(fs.existsSync(path.join(ROOT, 'ui-v157.css')), 'legacy ui-v157.css must remain physically available for cached old manifests');

  const v148 = read('ui-v148.css');
  assert.match(v148, /\.task-table td:nth-child\(3\) \.workflow-time-inline-v148\{margin-left:10px;vertical-align:middle\}/);
  assert.match(v148, /@media\(max-width:420px\)\{\.task-table td:nth-child\(3\) \.workflow-time-inline-v148\{margin-left:8px\}\}/);

  const v149 = read('ui-v149.css');
  assert.match(v149, /\.task-detail-tab-v149,[\s\S]*\.detail-actions-v2 \.main-actions>button,[\s\S]*\.detail-actions-v2 \.sub-actions>button\{min-height:44px!important\}/);

  const v156 = read('ui-v156.css');
  assert.match(v156, /\.workflow-mention-shell-v156\{z-index:1440!important\}/);
  assert.match(v156, /\.workflow-mention-users-v156\{-webkit-overflow-scrolling:touch;overscroll-behavior:contain\}/);

  const inboxArchive = read('ui-inbox-archive-v186.css');
  for (const snippet of [
    '.workflow-inbox-shell-v152,.workflow-inbox-shell-v153{z-index:1420!important}',
    '.workflow-archive-shell-v153{z-index:1430!important}',
    '#toast.toast{z-index:1500!important}',
    '.workflow-drawer-v152{height:100dvh!important;max-height:100dvh!important}',
    '#todayView .activity-actions>[data-open-personal-inbox-v153]{grid-column:1/-1!important}',
    '.workflow-inbox-read-v152{min-height:44px!important;padding:8px 12px!important}',
    '.workflow-inbox-list-v152,.workflow-archive-list-v153{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
    '.workflow-inbox-shell-v153 .workflow-drawer-v152{width:100vw!important;max-width:100vw!important}'
  ]) {
    assert.ok(inboxArchive.includes(snippet), `missing migrated inbox/archive rule: ${snippet}`);
  }
});
