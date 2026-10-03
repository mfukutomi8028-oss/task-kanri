import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [insights, manifest, responsibilityText, browserAudit] = await Promise.all([
  read('insights-v148.js'),
  read('release-manifest.js'),
  read('patch-responsibilities.json'),
  read('tests/insights-polling-audit-v356.spec.mjs')
]);
const responsibilities = JSON.parse(responsibilityText);

const currentTimer = 'setInterval(schedule,60000);patch();';
const candidateTimer = `let minuteTimerV356=0;function armMinuteTimerV356(){if(minuteTimerV356){clearTimeout(minuteTimerV356);minuteTimerV356=0}if(document.hidden)return;const delay=60000-(Date.now()%60000);minuteTimerV356=setTimeout(()=>{minuteTimerV356=0;schedule();armMinuteTimerV356()},delay||60000)}function handleVisibilityV356(){if(document.hidden){if(minuteTimerV356){clearTimeout(minuteTimerV356);minuteTimerV356=0}return}schedule();armMinuteTimerV356()}document.addEventListener('visibilitychange',handleVisibilityV356);armMinuteTimerV356();patch();`;

function candidateSource() {
  assert.equal(insights.split(currentTimer).length - 1, 1, 'active insights timer contract must occur exactly once');
  return insights.replace(currentTimer, candidateTimer);
}

test('Ver.356 audit: baseline insights owns one unconditional 60-second interval', () => {
  assert.equal((insights.match(/setInterval\(schedule,60000\)/g) || []).length, 1);
  assert.match(insights, /function timing\(t\)[\s\S]*?Date\.now\(\)/);
  assert.match(insights, /Math\.floor\(Date\.now\(\)\/60000\)/);
  assert.match(insights, /function patchStale\(map\)/);
  assert.match(insights, /function patchDashboard\(map\)/);
});

test('Ver.356 audit: visibility-scoped minute-boundary candidate changes only timer ownership', () => {
  const candidate = candidateSource();
  assert.doesNotMatch(candidate, /setInterval\(schedule,60000\)/);
  assert.match(candidate, /setTimeout\(\(\)=>\{minuteTimerV356=0;schedule\(\);armMinuteTimerV356\(\)\},delay\|\|60000\)/);
  assert.match(candidate, /document\.addEventListener\('visibilitychange',handleVisibilityV356\)/);
  assert.match(candidate, /if\(document\.hidden\)[\s\S]*?clearTimeout\(minuteTimerV356\)/);
  assert.match(candidate, /schedule\(\);armMinuteTimerV356\(\)/);

  for (const contract of [
    "window.addEventListener('workflow-v148-update',schedule)",
    "new MutationObserver",
    ".observe(document.getElementById('mainContent')||document.body,{childList:true,subtree:true})",
    'function patchDetail(map)',
    'function patchStale(map)',
    'function patchDashboard(map)',
    'requestAnimationFrame(()=>{scheduled=false;patch()})'
  ]) {
    assert.ok(candidate.includes(contract), `candidate must preserve ${contract}`);
  }
});

test('Ver.356 audit: browser proof covers baseline owner, hidden pause, visible recovery and minute refresh', () => {
  assert.match(browserAudit, /baseline registers the current insights 60-second interval/);
  assert.match(browserAudit, /candidate pauses minute ownership while hidden and restores one timer when visible/);
  assert.match(browserAudit, /candidate minute boundary refreshes detail timing and visibility recovery catches up/);
  assert.match(browserAudit, /__v356SetHidden/);
  assert.match(browserAudit, /__v356FireMinuteTimer/);
});

test('Ver.356 audit remains audit-only at Release 292', () => {
  const release = manifest.match(/version:\s*["'](\d+)["']/)?.[1];
  assert.equal(release, '292');
  assert.equal(String(responsibilities.baselineRelease), '292');
  assert.match(insights, /setInterval\(schedule,60000\)/, 'product runtime must remain unchanged during audit');
});
