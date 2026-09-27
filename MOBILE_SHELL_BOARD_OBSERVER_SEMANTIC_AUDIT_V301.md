# Ver.301 Mobile Shell Board Observer Semantic Audit

## Baseline

- Ver.300 main checkpoint: `e663faa26f1f18e6350901e489b1aff9a69f1bb3`
- release / responsibility baseline: `271`
- main Regression #748: green, including Browser regression smoke tests and Firebase Emulator write tests
- Pages #461: green on the same Ver.300 head
- production runtime remains unchanged during this audit.

## Target

Ver.300 narrowed the mobile board observer to direct child-list changes under `#boardView`:

```js
new MutationObserver(scheduleBoardTabs).observe(boardView, { childList: true });
```

This removes descendant-only noise, but every direct-child mutation still schedules `patchMobileBoardTabs()`. The canonical `app.js` board renderer replaces `#boardView` with `.board-column` children plus the add-column control, so an unrelated direct child can still wake the current observer even when the board-column contract did not change.

Ver.301 measures whether the observer callback can be narrowed again so `scheduleBoardTabs()` runs only when a mutation record adds or removes at least one `.board-column` direct child.

## Candidate semantic boundary

The audit-only candidate keeps `{ childList: true }` on `#boardView`, but gates reconciliation on the semantic identity of added/removed nodes:

```js
const hasBoardColumnChange = records.some(record =>
  [...record.addedNodes, ...record.removedNodes]
    .some(node => node.nodeType === 1 && node.matches?.('.board-column'))
);
if (hasBoardColumnChange) scheduleBoardTabs();
```

This is intentionally narrower than accepting every element or the add-column control. Status-tab labels, counts and active-column state are derived from `.board-column` elements, so the audit tests that boundary against the real application redraw path before any product change is allowed.

## Safety boundary

- Do not change production `mobile-shell-v234.js`.
- Do not change release / `baselineRelease` from 271.
- Do not change `scheduleBoardTabs()` requestAnimationFrame deduplication or `patchMobileBoardTabs()` behavior.
- Do not change resize reconciliation, startup `patchAll()`, conditional loading, navigation synchronization, or `openNewSchedule()` retries.
- Do not change Firebase, persistence, or any business-data write path.
- Apply the semantic predicate only to the Playwright-served audit copy.

## Required evidence

The audit must establish:

1. the current direct-child observer wakes and schedules a patch for an unrelated direct child appended to `#boardView`, while status-tab semantics remain unchanged;
2. the semantic candidate still receives that MutationObserver callback but does not schedule a board-tab patch for the unrelated node;
3. a canonical search-filter redraw still contains `.board-column` removal/addition and therefore schedules reconciliation;
4. status-tab counts remain canonical when the seeded task is filtered from 1 to 0 and restored from 0 to 1;
5. exactly one active mobile board column remains selected after canonical redraws;
6. navigating Tasks -> Today -> Tasks still removes/reconstructs mobile status tabs correctly;
7. the 861px desktop -> 860px mobile boundary still late-loads the shell and reaches a usable header, tabs and active column with the candidate in place;
8. release 271, Firebase behavior and business-data write boundaries remain unchanged.

## CI observations

PR #190 Regression #749 completed successfully on audit head `2bd6148ecce7ccaf668e5e4fd6ba908775f4495b`:

- Protocol and release-contract tests: success
- Browser regression smoke tests: success
- Firebase Emulator write tests: success

The browser suite included the Ver.301 audit instrumentation and candidate predicate. No production runtime file, release value, Firebase implementation, or business-data write path changed in that audited head.

## Findings

The audit established all required boundaries:

- The Ver.300 direct-child observer still wakes for an unrelated element appended directly under `#boardView` and schedules `patchMobileBoardTabs()`, even though status-tab text and active-column semantics do not change.
- With the audit-only semantic predicate, the same unrelated direct-child mutation still reaches the MutationObserver callback but does not schedule board-tab reconciliation because it adds/removes no `.board-column`.
- Canonical search filtering redraws `#boardView` through the application render path and adds/removes `.board-column` nodes, so the candidate continues to schedule reconciliation.
- Status-tab counts remained canonical through the tested `1 -> 0 -> 1` filter cycle.
- Exactly one `.work-mobile-active-column` remained selected after canonical redraws.
- Tasks -> Today removed the mobile status tabs and Today -> Tasks reconstructed them with the correct seeded count and active column.
- A desktop cold boot at 861px followed by a resize to 860px still late-loaded the mobile shell and reached a usable mobile header, status tabs, and one active board column.
- The full existing Protocol, Browser and Firebase Emulator suites remained green with release / baselineRelease fixed at 271.

No tested canonical path required reconciliation for a direct-child mutation that lacked `.board-column` addition/removal.

## Decision

The Ver.301 evidence supports a Ver.302 product change that keeps the existing `#boardView` direct-child MutationObserver but gates `scheduleBoardTabs()` on whether the delivered mutation records add or remove at least one `.board-column` direct child.

Ver.302 must preserve:

- `{ childList: true }` direct-child observation of `#boardView`;
- `scheduleBoardTabs()` requestAnimationFrame deduplication;
- `patchMobileBoardTabs()` signature/count and active-column behavior;
- Ver.298 resize reconciliation;
- startup `patchAll()`;
- conditional mobile-shell loading;
- navigation synchronization;
- `openNewSchedule()` 80 / 220 / 500ms retries;
- Firebase and all business-data write paths.

Ver.301 itself remains audit-only at release 271. Product semantic filtering is deferred to Ver.302 so it receives its own release bump and full PR/main/Pages validation.
