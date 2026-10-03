import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [insights, manifest, responsibilityText, browserRegression, auditDoc] = await Promise.all([
  read('insights-v148.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/insights-polling-audit-v356.spec.mjs'),
  read('INSIGHTS_POLLING_SCOPE_AUDIT_V356.md')
]);
const responsibilities = JSON.parse(responsibilityText);

test('Ver.356 audit lineage records the former unconditional interval and approved candidate', () => {
  assert.match(auditDoc, /setInterval\(schedule,60000\)/);
  assert.match(auditDoc, /one-shot `setTimeout`/);
  assert.match(auditDoc, /document\.hidden === true/);
  assert.match(auditDoc, /visibilitychange/);
  assert.match(auditDoc, /製品化時は復旧branchを作成し、release\/baseline更新/);
});

test('Ver.357 product: insights owns one visible-only minute-boundary timeout lifecycle', () => {
  assert.doesNotMatch(insights, /setInterval\(schedule,60000\)/);
  assert.match(insights, /let minuteTimerV356=0/);
  assert.match(insights, /const delay=60000-\(Date\.now\(\)%60000\)/);
  assert.match(insights, /setTimeout\(\(\)=>\{minuteTimerV356=0;schedule\(\);armMinuteTimerV356\(\)\},delay\|\|60000\)/);
  assert.match(insights, /if\(document\.hidden\)return/);
  assert.match(insights, /clearTimeout\(minuteTimerV356\)/);
  assert.match(insights, /document\.addEventListener\('visibilitychange',handleVisibilityV356\)/);
  assert.match(insights, /function handleVisibilityV356\(\)[\s\S]*?schedule\(\);armMinuteTimerV356\(\)/);
});

test('Ver.357 product preserves workflow, observer, patch and rAF reconciliation contracts', () => {
  for (const contract of [
    "window.addEventListener('workflow-v148-update',schedule)",
    'new MutationObserver',
    ".observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true})",
    'function patchDetail(map)',
    'function patchStale(map)',
    'function patchDashboard(map)',
    'requestAnimationFrame(()=>{scheduled=false;patch()})',
    'armMinuteTimerV356();patch();'
  ]) {
    assert.ok(insights.includes(contract), `product must preserve ${contract}`);
  }
});

test('Ver.357 browser regression covers hidden pause, visible recovery and minute refresh on product source', () => {
  assert.match(browserRegression, /product owns no 60-second interval and exactly one visible minute timer/);
  assert.match(browserRegression, /product pauses minute ownership while hidden and restores one timer when visible/);
  assert.match(browserRegression, /product minute boundary refreshes detail timing and visibility recovery catches up/);
  assert.match(browserRegression, /__v356SetHidden/);
  assert.match(browserRegression, /__v356FireMinuteTimer/);
});

test('Ver.357 product advances Release and responsibility baseline to 293', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '293');
  assert.equal(String(responsibilities.baselineRelease), '293');
  assert.match(JSON.stringify(responsibilities), /Ver\.357/);
});
