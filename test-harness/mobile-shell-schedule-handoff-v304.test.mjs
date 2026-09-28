import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_SCHEDULE_RETRY_AUDIT_V303.md', 'utf8');
const product = readFileSync('MOBILE_SHELL_SCHEDULE_HANDOFF_V304.md', 'utf8');
const release = Number(manifest.match(/const VERSION = ["'](\d+)["']/)?.[1] || 0);

test('Ver.304+ keeps release and responsibility baseline aligned after 273', () => {
  assert.ok(release >= 273);
  assert.equal(String(responsibilities.baselineRelease), String(release));
});

test('Ver.304 keeps direct open and canonical navigation but retires fixed schedule-create retries', () => {
  assert.match(mobile, /function openNewSchedule\(\)/);
  assert.match(mobile, /if \(tryOpen\(\)\) return;/);
  assert.match(mobile, /document\.querySelector\("\.nav-item\[data-layout='schedule'\], \[data-layout='schedule'\]"\)\?\.click\(\);\s*tryOpen\(\);/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 80\)/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 220\)/);
  assert.doesNotMatch(mobile, /setTimeout\(tryOpen, 500\)/);
});

test('Ver.304 remains coupled to the canonical synchronous schedule render contract', () => {
  assert.match(app, /state\.layout = button\.dataset\.layout[\s\S]*?syncNavigationUi\(\);\s*render\(\);/);
  assert.match(app, /data-new-schedule>＋ 新しい予定<\/button>/);
  assert.match(app, /querySelector\("\[data-new-schedule\]"\)\?\.addEventListener\("click", \(\) => openScheduleDialog\(\)\)/);
});

test('Ver.303 evidence is promoted without widening Ver.304 product scope', () => {
  assert.match(audit, /same JavaScript task/i);
  assert.match(audit, /80\/220\/500ms/);
  assert.match(product, /removes only the three fixed schedule-create callbacks/i);
  assert.match(product, /860\/861px conditional mobile-shell loading boundary/);
  assert.match(product, /Firebase, task persistence, workflow, notifications, and every business-data write path/);
});

test('Ver.304 history remains durable as later navigation cleanup advances', () => {
  const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
  assert.ok(group);
  assert.match(group.reason, /Ver\.303監査/);
  assert.match(group.reason, /Ver\.304製品/);
  assert.match(group.reason, /release 273/);
  assert.match(group.reason, /Ver\.305監査/);
  if (release >= 274) {
    assert.match(group.reason, /Ver\.306製品/);
    assert.match(group.reason, /release 274/);
  }
  if (release >= 275) {
    assert.match(group.reason, /Ver\.307監査/);
    assert.match(group.reason, /Ver\.308製品/);
    assert.match(group.reason, /release 275/);
  }
});
