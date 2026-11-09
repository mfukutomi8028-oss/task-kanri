// Classify a single commit's changed paths into a fast required CI gate.
// Full integration runs are always available manually and run nightly.
// Conservative fallback: unknown JavaScript and CI infrastructure run every suite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE_SMOKE = ['tests/ui-smoke.spec.mjs', 'tests/user-reported-stability-v319.spec.mjs'];
const CLASSIC_MOBILE = ['tests/mobile-regression-v187.spec.mjs'];
const TASK = ['tests/task-dialog-ui-v320.spec.mjs', 'tests/mobile-regression-v187.spec.mjs'];
const TODO = ['tests/mobile-regression-v187.spec.mjs', 'tests/todo-history-boundary-audit-v266.spec.mjs'];
const SCHEDULE = ['tests/mobile-schedule-label-v203.spec.mjs', 'tests/mobile-regression-v187.spec.mjs'];
const THEME = ['tests/classic-dark-themes-v330.spec.mjs', 'tests/classic-color-theme-v329.spec.mjs'];
const ORIGIN = ['tests/origin-modern-v372.spec.mjs'];
const PALETTE = ['tests/palette-next-v369.spec.mjs'];
const JOURNAL = ['tests/journal-display-v367.spec.mjs'];

function isFullInfrastructure(file) {
  return file.startsWith('.github/workflows/')
    || /^(package(-lock)?\.json|playwright\.config\.mjs|firebase\.json)$/.test(file)
    || /^(test-harness\/(run-protocol|static-server|run-firebase-browser|run-firebase-grep-audits-v480|run-firebase-audit-suites-v479)\.mjs)$/.test(file);
}

export function classifyPaths(changedFiles, eventName = 'pull_request') {
  if (!Array.isArray(changedFiles)) throw new TypeError('changedFiles must be an array');
  const files = [...new Set(changedFiles.map(p => String(p).trim()).filter(Boolean))];
  const forceFull = eventName === 'schedule' || eventName === 'workflow_dispatch';
  const targets = new Set();
  let fullBrowser = forceFull;
  let firebase = forceFull;
  let authorization = forceFull;
  const add = (...items) => items.forEach(item => targets.add(item));
  for (const file of files) {
    if (isFullInfrastructure(file) || file === 'app.js' || file === 'config.js') {
      fullBrowser = true; firebase = true; authorization = true;
      continue;
    }
    if (/^(firebase\..*\.json|database\.rules.*|.*\.rules\.json)$/.test(file)) {
      firebase = true; authorization = true; add(...CORE_SMOKE); continue;
    }
    if (/^(tests\/firebase-|tests\/firebase-emulator-)/.test(file)) {
      firebase = true; continue;
    }
    if (/^(tests\/staged-auth-|test-harness\/(security-rules|firebase-admin-staging|staged-auth|migration-roundtrip|synthetic-room|legacy-migration))/.test(file)) {
      authorization = true; continue;
    }
    if (file.startsWith('test-harness/')) {
      // Protocol discovers *.test.mjs automatically. Helpers are reviewed
      // through Protocol; unknown executable helpers fail closed.
      if (!file.endsWith('.test.mjs') && !/^test-harness\/(ci-scope-v590|ci-failure-digest|pages-|build-pages-runtime|root-markdown-reference|asset-retirement-inventory|stage-e-archived-reference-guard|legacy-ownership|legacy-retirement-evidence|legacy-png-contract)/.test(file)) {
        fullBrowser = true; firebase = true; authorization = true;
      }
      continue;
    }
    if (file.startsWith('tests/') && file.endsWith('.spec.mjs')) {
      add(file); continue;
    }
    if (/^(origin-|modern-)/.test(file) || file.startsWith('ui-origin-')) {
      add(...ORIGIN); continue;
    }
    if (/^palette-/.test(file) || file.startsWith('ui-palette-')) {
      add(...PALETTE); continue;
    }
    if (/^journal-/.test(file) || file.startsWith('ui-journal-')) {
      add(...JOURNAL); continue;
    }
    if (/^(ui-todo-|todo-ui-|todo-controls-|todo-tools-|todo-preview-|todo-history-)/.test(file)) {
      add(...TODO);
      if (file.endsWith('.js')) firebase = true;
      continue;
    }
    if (/^(ui-task-|task-toolbar-|task-dialog-|task-ux-)/.test(file)) {
      add(...TASK);
      if (file.endsWith('.js')) firebase = true;
      continue;
    }
    if (/^(ui-schedule-|schedule-|recurrence-)/.test(file)) {
      add(...SCHEDULE);
      if (file.endsWith('.js')) firebase = true;
      continue;
    }
    if (/^(color-themes-|ui-pure-solid-|ui-pastel-)/.test(file)) {
      add(...THEME); continue;
    }
    if (/^(ui-mobile-|mobile-shell-)/.test(file)) {
      add(...CLASSIC_MOBILE); continue;
    }
    if (/^(workspace-|todo-sync-|task-delete-|comment-|workflow-|dependencies-|reminders-|relationships-|inbox-|archive-|user-registration-)/.test(file) && file.endsWith('.js')) {
      add(...CORE_SMOKE); firebase = true;
      if (/user-registration|auth|permission|rule/.test(file)) authorization = true;
      continue;
    }
    if (/^(index\.html|ui-.*\.css|style\.css|.*\.css|assets\/)/.test(file)) {
      add(...CORE_SMOKE); continue;
    }
    if (/^(tests\/.*-snapshots\/|release-|patch-responsibilities\.json|README\.md|docs\/|.*\.md$)/.test(file)) {
      // Deployment and release contracts remain covered by Protocol and
      // the separate Pages preflight/verification workflow.
      continue;
    }
    if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.html') || file.endsWith('.json')) {
      fullBrowser = true; firebase = true; authorization = true;
    }
  }
  if (fullBrowser) {
    firebase = true;
    authorization = true;
  }
  const runBrowser = fullBrowser || targets.size > 0;
  const sortedTargets = [...targets].sort();
  // JOURNAL's ~90 independent Playwright scenarios live in one spec file.
  // With fullyParallel:false, regular file-level sharding cannot split them.
  // Isolated JOURNAL PRs use two test-level shards; full suites use four
  // disjoint file-level shards so retry-heavy runs finish within the job limit.
  // Every test still runs with unchanged retries and failure thresholds.
  const journalParallel = !fullBrowser && sortedTargets.length === 1
    && sortedTargets[0] === JOURNAL[0];
  const shards = fullBrowser ? [1, 2, 3, 4] : journalParallel ? [1, 2] : runBrowser ? [1] : [];
  return Object.freeze({
    mode: fullBrowser ? 'full' : runBrowser ? 'targeted' : 'protocol-only',
    browser: runBrowser,
    firebase,
    authorization,
    fullBrowser,
    journalParallel,
    shardCount: shards.length,
    shards,
    targets: fullBrowser ? '' : sortedTargets.join(' ')
  });
}

function main() {
  const [filesPath, event] = process.argv.slice(2);
  if (!filesPath || !event) throw new Error('usage: ci-scope-v590.mjs changed-files.txt event');
  const files = fs.readFileSync(filesPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const result = classifyPaths(files, event);
  const values = {
    mode: result.mode,
    browser: String(result.browser),
    firebase: String(result.firebase),
    authorization: String(result.authorization),
    full_browser: String(result.fullBrowser),
    journal_parallel: String(result.journalParallel),
    shard_count: String(result.shardCount),
    shards: JSON.stringify(result.shards),
    targets: result.targets
  };
  for (const [name, value] of Object.entries(values)) console.log(name + '=' + value);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
