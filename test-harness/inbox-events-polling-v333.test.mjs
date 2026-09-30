import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [inboxEvents, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('inbox-events-v183.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/inbox-events-polling-audit-v333.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.333 audit: local-only inbox generation still owns the 1500ms snapshot poll', () => {
  assert.match(inboxEvents, /pollTimer=setInterval\(\(\)=>\{[\s\S]*?W\.taskMap\(\)[\s\S]*?processSnapshot\(map\)[\s\S]*?\},1500\)/);
  assert.match(inboxEvents, /r\.onValue\(ref,s=>\{remoteReady=true;processSnapshot\(s\.val\(\)\|\|\{\}\)\}/);
  assert.doesNotMatch(inboxEvents, /addEventListener\(['"]workflow-v1(?:48|49|50|52)-update/);
});

test('Ver.333 audit: browser test suppresses only the inbox-owned timer and manually proves its detection role', () => {
  assert.match(browserAudit, /Number\(delay\) === 1500 && stack\.includes\('inbox-events-v183\.js'\)/);
  assert.match(browserAudit, /callbacks: 0, suppressed: true/);
  assert.match(browserAudit, /data-quick-task-status/);
  assert.match(browserAudit, /work-board-inbox-pending-v254/);
  assert.match(browserAudit, /record\.callback\(\)/);
  assert.doesNotMatch(browserAudit, /page\.route\([^\n]*inbox-events-v183\.js/);
});

test('Ver.333 audit: release evidence remains valid after later product releases', () => {
  const release = manifest.match(/version:\s*"(\d+)"/)?.[1];
  assert.ok(Number(release) >= 283);
  assert.equal(responsibilities.baselineRelease, release);
});
