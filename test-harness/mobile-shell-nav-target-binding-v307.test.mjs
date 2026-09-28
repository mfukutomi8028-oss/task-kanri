import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobile = readFileSync('mobile-shell-v234.js', 'utf8');
const app = readFileSync('app.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const workFeatures = readFileSync('work-features-v167.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const responsibilities = JSON.parse(readFileSync('patch-responsibilities.json', 'utf8'));
const audit = readFileSync('MOBILE_SHELL_NAV_TARGET_BINDING_AUDIT_V307.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.307 evidence remains anchored at release 274 while later product may advance', () => {
  assert.ok(release >= 274);
  assert.equal(String(responsibilities.baselineRelease), String(release));
  if (release === 274) {
    assert.match(mobile, /document\.addEventListener\("click", event => \{/);
    assert.doesNotMatch(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener/);
  } else {
    assert.match(mobile, /document\.querySelector\("\.nav"\)\?\.addEventListener\("click", event => \{/);
    const block = mobile.match(/function bindGlobalClicks\(\) \{[\s\S]*?\n  \}/)?.[0] || '';
    assert.doesNotMatch(block, /document\.addEventListener\("click"/);
  }
});

test('Ver.307 records why direct binding to the seven initial nav buttons is incomplete', () => {
  const navItems = [...html.matchAll(/<button class="[^"]*nav-item[^"]*"[^>]*>/g)];
  assert.equal(navItems.length, 7);
  assert.match(workFeatures, /function createMemoNav\(\)/);
  assert.match(workFeatures, /button\.className = 'nav-item work-memo-nav-v167'/);
  assert.match(workFeatures, /schedule\.insertAdjacentElement\('afterend', button\)/);
  assert.match(audit, /eight `.nav-item` elements, not seven/);
  assert.match(audit, /initial direct-target proposal is rejected/);
});

test('Ver.307 preserves canonical navigation ownership before scoped mobile reconciliation', () => {
  const navBlock = app.match(/elements\.navItems\.forEach\(button => \{[\s\S]*?\n  \}\);/)?.[0] || '';
  assert.ok(navBlock, 'canonical nav click block must exist');
  assert.match(navBlock, /button\.addEventListener\("click", \(\) => \{/);
  assert.match(navBlock, /state\.layout = button\.dataset\.layout/);
  assert.match(navBlock, /syncNavigationUi\(\);\s*render\(\);/);
  assert.doesNotMatch(navBlock, /stopPropagation\(|stopImmediatePropagation\(/);
});

test('Ver.307 refined candidate keeps delegation and becomes Ver.308 product at release 275', () => {
  assert.match(mobile, /if \(window\.__workBoardMobileFixClicksV101\) return;/);
  assert.match(mobile, /window\.__workBoardMobileFixClicksV101 = true;/);
  assert.match(audit, /container-scoped delegation/);
  assert.match(audit, /stable sidebar navigation container `.nav`/);
  assert.ok(audit.includes("event.target?.closest?.('.nav-item')"));
  assert.match(audit, /861px -> 860px/);
  assert.match(audit, /Schedule create handoff remains intact/);
  if (release >= 275) {
    const group = responsibilities.groups?.find(item => item.id === 'responsive-sidebar-toolbar');
    assert.match(group?.reason || '', /Ver\.307監査/);
    assert.match(group?.reason || '', /Ver\.308製品/);
    assert.match(group?.reason || '', /release 275/);
  }
});

test('Ver.307 historic product gate remains documented without owning the current cleanup candidate', () => {
  assert.match(audit, /Ver\.308/);
  assert.match(audit, /container-scoped delegation/);
  assert.match(audit, /release 275/);
});
