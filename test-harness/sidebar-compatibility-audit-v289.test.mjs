import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const audit = readFileSync('SIDEBAR_COMPATIBILITY_AUDIT_V289.md', 'utf8');
const retirement = readFileSync('SIDEBAR_COMPATIBILITY_RETIREMENT_V290.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.290 promotes the sidebar compatibility retirement on release 267', () => {
  assert.equal(release, 267);
});

test('Ver.290 leaves V158 as the only active 860/861 desktop-state owner', () => {
  assert.match(sidebar, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(sidebar, /function applyState\(\)[\s\S]*if \(!media\.matches\)[\s\S]*classList\.remove\(BODY_BASE_CLASS, BODY_EXPANDED_CLASS, BODY_PINNED_CLASS\)[\s\S]*removeAttribute\("data-desktop-sidebar-state"\)/);
  assert.match(sidebar, /media\.addEventListener\("change", onMediaChange\)/);
  assert.match(sidebar, /window\.addEventListener\("pageshow", applyState\)/);

  assert.doesNotMatch(sidebar, /installDesktopSidebarCompatibilityV159/);
  assert.doesNotMatch(sidebar, /const mobile = window\.matchMedia\("\(max-width: 860px\)"\)/);
  assert.doesNotMatch(sidebar, /window\.addEventListener\("resize", \(\) => setTimeout\(apply, 0\)\)/);
  assert.doesNotMatch(sidebar, /window\.addEventListener\("orientationchange", \(\) => setTimeout\(apply, 0\)\)/);
});

test('Ver.290 product contract preserves the Ver.289 evidence and rollback boundary', () => {
  assert.match(audit, /861px desktop cold boot still reaches canonical collapsed state/);
  assert.match(audit, /861 → 860 removes desktop runtime classes/);
  assert.match(audit, /A real pinned preference survives 861 → 860 → 861/);
  assert.match(audit, /Promote removal of the V159 compatibility IIFE only if the audit proves all boundary and pin-persistence behavior without it/);

  assert.match(retirement, /only runtime removal is the preserved `desktop-sidebar-compat-v159` compatibility IIFE/);
  assert.match(retirement, /active source must no longer contain or install V159 compatibility listeners/);
  assert.match(retirement, /desktop-sidebar-compat-v159\.js/);
  assert.match(retirement, /Release manifest and responsibility baseline advance from 266 to 267/);
  assert.match(retirement, /No Firebase, task persistence, notification, workflow, or other business-data write path is changed/);
});
