import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync('desktop-sidebar-v242.js', 'utf8');
const manifest = readFileSync('release-manifest.js', 'utf8');
const audit = readFileSync('SIDEBAR_COMPATIBILITY_AUDIT_V289.md', 'utf8');
const release = Number(manifest.match(/version:\s*["'](\d+)["']/)?.[1] || 0);

test('Ver.289 audit remains on release 266 with no production promotion', () => {
  assert.equal(release, 266);
});

test('Ver.289 audit identifies overlapping V158 core and V159 compatibility boundaries', () => {
  assert.match(sidebar, /const DESKTOP_QUERY = "\(min-width: 861px\)"/);
  assert.match(sidebar, /function applyState\(\)[\s\S]*if \(!media\.matches\)[\s\S]*classList\.remove\(BODY_BASE_CLASS, BODY_EXPANDED_CLASS, BODY_PINNED_CLASS\)[\s\S]*removeAttribute\("data-desktop-sidebar-state"\)/);
  assert.match(sidebar, /media\.addEventListener\("change", onMediaChange\)/);
  assert.match(sidebar, /window\.addEventListener\("pageshow", applyState\)/);

  assert.match(sidebar, /installDesktopSidebarCompatibilityV159/);
  assert.match(sidebar, /const mobile = window\.matchMedia\("\(max-width: 860px\)"\)/);
  assert.match(sidebar, /mobile\.addEventListener\("change", \(\) => setTimeout\(apply, 0\)\)/);
  assert.match(sidebar, /window\.addEventListener\("resize", \(\) => setTimeout\(apply, 0\)\)/);
  assert.match(sidebar, /window\.addEventListener\("orientationchange", \(\) => setTimeout\(apply, 0\)\)/);
  assert.match(sidebar, /window\.addEventListener\("pageshow", apply\)/);
});

test('Ver.289 decision gate requires exact-boundary and pin-persistence browser evidence', () => {
  assert.match(audit, /861px desktop cold boot still reaches canonical collapsed state/);
  assert.match(audit, /861 → 860 removes desktop runtime classes/);
  assert.match(audit, /A real pinned preference survives 861 → 860 → 861/);
  assert.match(audit, /Promote removal of the V159 compatibility IIFE only if the audit proves all boundary and pin-persistence behavior without it/);
});
