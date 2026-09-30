# Ver.328 Comment Mention Observer Audit

## Scope

Ver.327 productized the mention picker's transient Escape listener lifecycle at Release / responsibility baseline 281. Ver.328 is audit-only: product runtime, release manifest, Firebase paths, and business-data write behavior remain unchanged.

This audit isolates the remaining `comment-mentions-v191.js` `#detailBody` MutationObserver.

## Current behavior

The current observer watches `#detailBody` with `{ childList: true, subtree: true }`. Any added or removed descendant schedules the same requestAnimationFrame-coalesced `patch()` scan, even when the mutation occurs in task content, metadata, checklist, actions, or another detail surface unrelated to comments.

The broad root itself has an important compatibility role: the comment panel/form can be reconstructed below `#detailBody`, so simply switching to a short-lived comment-form root would risk losing adoption when that subtree is replaced.

## Non-product candidate

The audit keeps the existing `#detailBody` observer root and subtree coverage but filters mutation records before scheduling `patch()`.

A mutation schedules mention reconciliation only when an added or removed element is, or contains, one of the semantic mention surfaces:

- `.task-comments-panel-v149`
- `#commentForm`
- `.comment-form`
- `textarea#commentText`

This deliberately reduces unnecessary rAF/querySelector rescans without changing the observer root, comment rendering ownership, mention token semantics, Escape lifecycle, or any persistence path.

## Browser evidence required

The Ver.328 browser audit measures both the current implementation and the injected candidate on the real product page. It verifies:

- unrelated detail descendant churn wakes the current observer and schedules a mention rescan;
- the candidate may receive the broad observer callback but does not schedule or execute `patch()` for unrelated mutations;
- replacing the canonical comment form is still adopted;
- replacing the whole comment panel is still adopted on mobile;
- the mention picker remains openable and Escape-close behavior from Ver.327 remains intact.

## Decision gate

Ver.328 must remain evidence-only. If Protocol, Browser, and Firebase Emulator regression are green and the candidate preserves the tested reconstruction paths, the next work unit is Ver.329 productization of the semantic mutation filter.

A Ver.329 product change must not narrow the `#detailBody` observer root or alter comment/reaction/reply persistence or Firebase write behavior unless a separate audit proves those broader changes safe.

Rollback branch: `backup/ver327-before-comment-mention-observer-audit-v328`.
