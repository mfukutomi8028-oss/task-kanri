# Ver.296 Mobile Shell Resize Product Gate

## Baseline

- main checkpoint: `7e542d447f8b9034e277ca79a37f9cb1623396e0`
- release / baseline: `269`
- Ver.295 audit proved that ordinary mobile resize and 860/861px boundary transitions can keep the board canonical when the temporary resize target is narrowed from `schedulePatch` to `scheduleBoardTabs`.

## Cross-contract finding

Before promoting that audit directly into production, the existing Ver.294 browser regression was re-checked.

Ver.294 deliberately introduces recoverable drift into all of these states before a rotation-style viewport transition:

- mobile header title
- mobile menu button text / `aria-expanded`
- board active-column state
- status-tab active / `aria-pressed` state

The current production path `resize -> schedulePatch -> patchAll()` repairs all of them.

A `resize -> scheduleBoardTabs` production change would preserve only board/tab repair. It would no longer repair the header title or menu-button drift that Ver.294 already treats as recovery behavior.

## Decision

Do **not** promote the Ver.295 board-only substitution directly into production.

Ver.296 is audit-only. The production runtime remains unchanged:

`resize -> schedulePatch -> patchAll()`

Release and `baselineRelease` remain `269`.

This is not a rollback of the Ver.295 evidence: that evidence is still valid for ordinary canonical resize behavior. The product gate is blocked because it does not yet prove equivalent recovery semantics for every responsibility currently covered by resize recovery.

## Next audit boundary

Ver.297 should audit the five `patchAll()` responsibilities independently under resize:

1. `ensureMobileHeader()`
2. `patchMobileBoardTabs()`
3. `syncMobileHeaderTitle()`
4. `syncMobileMenuButton()`
5. `bindGlobalClicks()`

The goal is to identify the smallest subset that preserves the Ver.294 recovery contract, including synthetic header/menu/board drift, while removing only responsibilities with no independent recovery value.

## Safety

- no production runtime change
- no release/baseline change
- no Firebase or business-data write-path change
- startup `patchAll()`, board observer, conditional loader, navigation sync, and schedule-create retries remain unchanged
