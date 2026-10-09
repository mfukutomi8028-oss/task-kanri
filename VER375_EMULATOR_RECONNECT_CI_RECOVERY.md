# Ver.375 main CI: Firebase reaction reconnect audit recovery

Date: 2026-10-09. Tracks Issue #285 and merged product PR #286.

## Grounded failure evidence

- Formal Ver.375 candidate is merged on main `86298be310592be4f094be616d606c79d51f752f`, Release/baseline 302/302.
- PR run `37894906158` passed Protocol, Browser, Firebase Emulator on head `c1b3569c86ab09473711f881e1d46064f9f5ea13`.
- Post-merge run `37896479512` **attempts 1 and 2 failed in the same unrelated existing test** `tests/firebase-emulator-reaction-reconnect-audit-v254.spec.mjs` after Protocol and Browser both passed. Both retry cases expected the stale-reaction conflict toast but read the earlier offline toast.
- Examining the actual CI Playwright trace artifact (artifact `11601742639`) reveals the remote-winner observer refresh rebuilt the comment row with a pressed reaction chip and “＋ リアクション” picker button. The picker options were no longer shown. The test's `page.evaluate` had an optional `if (node instanceof HTMLButtonElement)` branch, did not assert a click was attempted, and therefore could skip it silently.
- The failing toast was the previously asserted offline rejection, not evidence that a transaction was attempted and mishandled. Do not claim Firebase transaction correctness was tested by the failing attempts.
- This failure is in a pre-existing Ver.254 E2E fixture; Ver.375 product changes only Today sidebar filtering and don't change the Firebase writer.

## Exact fix and preserved assertions

In this test only, before the stale click:

1. Check whether the reaction choice is visible. If remote refresh closed the picker, reopen the existing reaction picker and await a visible choice.
2. In the same synchronous page evaluation, set the mock connection pill to online and inject `data-comment-reaction-expected-pressed=false` for the stale user intent.
3. Reject the test explicitly when the choice is missing or disabled. Assert that the click actually executed.
4. **Preserve** the original conflict-toast assertion, immutable remote membership, revision 11, notification-count idempotency, cached record convergence, and production-network isolation.

Do not change the application, realtime render, event listeners, Firebase transaction, inbox notification path, emulator rules, CI workflow, snapshot baselines, test timeouts, or any release/version inventory. The goal is to make the existing strict browser test exercise its intended transaction instead of silently skipping the click.

Local `node --check` succeeded. `npm run test:protocol`: **497 pass / 0 fail / 0 skipped**. Local full browser remains managed-network restricted; PR CI must verify the fixed E2E case.

## Formal release gate

Test-only PR full Protocol/Browser/Firebase Emulator CI must pass; exact-head merge into the current main, then the same-main-sha Regression and Pages build/deploy must pass. Verify Release/baseline remain **302/302**. Only then create `backup/ver375-checkpoint` matching main and close Issue #285. Until then, checkpoint `backup/ver374-checkpoint` remains the last formally accepted rollback.

## CI refinement: distinguish picker choice from reaction chip

PR #288 initial head `45cdf55c56e4b0c9391e001a11a44aaa5d178236`, CI `37901298666`: Protocol and Browser passed; emulator test failed explicitly at the new `toBeVisible` check because the original shared data selector matched **two elements** after remote winner refresh: the pressed reaction chip and the picker choice. This was a strict locator ambiguity, not a transaction failure. The previous silent test-skip is now surfaced and identified.

The follow-up confines both `staleChoice` locator and the synchronous click target to `.comment-reaction-choice-v165[data-comment-reaction-id][data-comment-reaction-emoji]`. The picker is reopened when the **choice** is not visible, preventing the pressed chip from satisfying the check or receiving the stale click. Neither server state, production writer, assertion expectations, nor emulator configuration is altered. Local Node syntax passes and the full 497 Protocol tests remain passing. New CI will determine the actual conflict transaction outcome.
