import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [insights, manifest, responsibilityText, browserRegression] = await Promise.all([
  read('insights-v148.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/insights-polling-audit-v356.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.357 product: insights replaces unconditional polling with one visibility-scoped minute timer', () => {
  assert.doesNotMatch(insights, /setInterval\(schedule,60000\)/);
  assert.match(insights, /let minuteTimerV357=0/);
  assert.match(insights, /const delay=60000-\(Date\.now\(\)%60000\)/);
  assert.match(insights, /setTimeout\(\(\)=>\{minuteTimerV357=0;schedule\(\);armMinuteTimerV357\(\)\},delay\|\|60000\)/);
  assert.match(insights, /document\.addEventListener\('visibilitychange',handleVisibilityV357\)/);
  assert.match(insights, /if\(document\.hidden\)[\s\S]*?clearTimeout\(minuteTimerV357\)/);
  assert.match(insights, /schedule\(\);armMinuteTimerV357\(\)/);
});

test('Ver.357 product: event, observer, coalescing and patch responsibilities stay intact', () => {
  for (const contract of [
    "window.addEventListener('workflow-v148-update',schedule)",
    'new MutationObserver',
    ".observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true})",
    'function patchDetail(map)',
    'function patchStale(map)',
    'function patchDashboard(map)',
    'requestAnimationFrame(()=>{scheduled=false;patch()})'
  ]) {
    assert.ok(insights.includes(contract), `product runtime must preserve ${contract}`);
  }
  assert.match(insights, /function timing\(t\)[\s\S]*?Date\.now\(\)/);
  assert.match(insights, /Math\.floor\(Date\.now\(\)\/60000\)/);
});

test('Ver.357 product: browser regression covers hidden pause, visible catch-up and minute refresh on real source', () => {
  assert.match(browserRegression, /product owns one visible minute timer and no 60-second interval/);
  assert.match(browserRegression, /product pauses minute ownership while hidden and restores one timer when visible/);
  assert.match(browserRegression, /product minute boundary refreshes detail timing and visibility recovery catches up/);
  assert.doesNotMatch(browserRegression, /installCandidate/);
  assert.doesNotMatch(browserRegression, /page\.route\(\/\\\/insights-v148/);
  assert.match(browserRegression, /__v357SetHidden/);
  assert.match(browserRegression, /__v357FireMinuteTimer/);
});

test('Ver.357 product release baseline remains synchronized in later releases', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.ok(Number(release) >= 293, `expected release 293 or later, got ${release}`);
  assert.equal(String(responsibilities.baselineRelease), release);
});
