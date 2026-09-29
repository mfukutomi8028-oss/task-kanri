# Ver.316 Work Features Long-Lived Responsibility Audit

## Baseline

- Base: Ver.315 main `6ccd26e6fb015c939c7f72de14dc75e92adec7b0`
- Product release / responsibility baseline: `278`
- Target: `work-features-v167.js`
- Product runtime is not changed in this audit.

## Purpose

Ver.315 removed memo-owned self-mutation wakeups from the core work-features observer. The remaining long-lived responsibilities are now small enough to audit individually rather than assuming that every observer or timer is cleanup debt.

This audit measures two remaining owners:

1. `taskDialogObserver`, which watches only the `open` attribute of `#taskDialog` and populates the start-date bridge when the canonical task dialog opens.
2. `scheduleDateBoundaryRefresh()`, which owns one timeout to the next local date boundary and refreshes future/reserved-task visibility when an idle board crosses midnight.

## Current boundaries

### Task dialog observer

The current observer is rooted only at `#taskDialog` and uses:

```js
{ attributes: true, attributeFilter: ['open'] }
```

It does not watch `childList`, `subtree`, or unrelated application DOM. Its callback writes the start-date field only when the dialog is open.

### Date-boundary refresh

The current date-boundary owner:

- clears the previous timeout before re-arming;
- computes the next local day at `00:00:02`;
- uses one `setTimeout`, not an interval or polling loop;
- calls `applyFutureTaskUi()` once at the boundary;
- recursively schedules the next one-shot boundary.

## Browser evidence required

The audit must establish:

1. unrelated `#mainContent` DOM changes do not wake `taskDialogObserver`;
2. the observer reacts to canonical `#taskDialog` open/close transitions only;
3. suppressing its open-time population leaves a seeded task's start-date field stale, proving that no duplicate canonical owner currently fills that bridge on dialog open;
4. restoring the current observer path repopulates the correct start date;
5. the observer target/options remain exactly `#taskDialog` + `attributes/open`;
6. a future task remains hidden if only the synthetic calendar date changes and no work-feature reconciliation runs;
7. invoking the existing date-boundary callback makes that task visible on its start date and updates reserved-task state;
8. the boundary owner re-arms as a one-shot timeout rather than introducing an interval/poll loop.

## Decision gate

This is a responsibility audit, not a deletion target.

- If either long-lived owner has a duplicate canonical replacement and can be removed or narrowed without losing the behavior above, record that candidate for a later productization step.
- If `taskDialogObserver` is already the narrowest reliable bridge for task-dialog open state and the date-boundary timeout is the only owner that updates an idle visible board across midnight, retain them and close this cleanup branch without a product runtime change.

Do not replace a narrow observer/timer with broader global click, focus, visibility, pageshow, or polling listeners merely to reduce the raw count of long-lived primitives.

## Preserved boundaries

- `work-features-v167.js` remains unchanged in Ver.316.
- `release-manifest.js` remains release `278`.
- `patch-responsibilities.json` baseline remains `278` during the audit.
- Firebase paths, task/start-date transactions, memo persistence, canonical task persistence, and orphan cleanup remain unchanged.
- No canonical renderer or navigation owner is replaced.
