# Ver.445 — Real user pointer/Tab focusout on impossible dates (Issue #355)

## Baseline and question

Start from formally accepted Ver.444 main \`a7d5e07c93fc066c95afe15cf7dd1a32fb4008b8\`, its successful same-SHA Regression run #38337539706 and Pages run #38337539702, and checkpoint \`backup/ver444-date-deferred-selection-focus-validated-checkpoint\`.

The historical Ver.436 single Browser-shard retry had empty native date source and a dirty wrapper, but was missing \`is-invalid\` after a programmatic \`.focus()\` call intended to leave the segment. Ver.444 guarded stale \`requestAnimationFrame\` selection and independent/main 20-cycle checks both measured title focus 20/20 after invalid and corrected dates. That demonstrates the fix for delayed selection stealing focus, **not** proven causation for the original missing error indicator.

## Change, intentionally test-only

Extend the existing \`tests/date-keyboard-boundary-v230.spec.mjs\` with two separately reported Playwright cases (Chromium 1366x900) exercising:

1. Pointer click into the year segment; **real keyboard input** of 2026 → 09 → 30 with automatic focus advancing to month/day, validating canonical native \`2026-09-30\` and no error.
2. Click the day segment, select using ControlOrMeta+A and type impossible \`31\` with the keyboard. Verify dirty=true and empty native source while focus remains inside; do not expect an error class until focus leaves.
3. **Mouse scenario:** click the visible task title. **Tab scenario:** press Tab to the calendar button inside the same date wrapper, then press Tab again to move outside. Verify the actual active target is outside the wrapper. The native value stays empty and \`is-invalid\` appears.
4. Click day, correct to \`30\` using keyboard input and exit via the same pointer or Tab sequence. Verify native \`2026-09-30\`, cleared \`is-invalid\`, and focus outside the date wrapper.
5. Attach passive wrapper focusout/native source invalid event listeners. Require an actual wrapper-to-outside focusout in both invalid/corrected phases. Log phase exit counts; on failure attach JSON with active element, day/native values, dirty/class and events. Do **not** synthesize blur, call controller functions, add sleeps, change retries or relax existing assertions.

The test intentionally exercises the date-due field in the task dialog. A passing Chromium test does not establish behavior for every mobile OS, accessibility technology, input method editor or real-user history.

## Scope / exclusions

Only one existing Playwright test file and this investigation note are changed. Production controller, HTML/CSS, Release304/manifest, Pages builder/legacy aliases/PNG, old recovery records, workflows, Firebase/Rules/Auth and user data remain unchanged. No test writes to a real Firebase backend: the existing suite disables Firebase config and blocks remote Firebase requests.

Keep Issue #355 **open** until the historic rare missing-\`is-invalid\` case is causally explained and sufficient regression evidence exists. If user-like focusout fails, diagnose the measured active element and event order rather than hiding the outcome.

## Required acceptance

Exact PR head Protocol + Browser both shards + Firebase + final Regression all success; then verify main has not advanced, merge with the expected head SHA, require same-SHA main Regression + Pages success, and create and read back a dedicated same-SHA recovery checkpoint. Do not treat the candidate as accepted before those gates.
