# Ver.329 Comment Mention Observer Productization

> Status: product candidate implemented on the Ver.329 work branch. The semantic observer filter, Release / responsibility baseline 282, and product regression contracts are present; Ver.328 remains the official checkpoint until PR CI, exact-head merge, main Regression, and Pages are green.

## Scope

Ver.328 proved that `comment-mentions-v191.js` does not need to schedule a full mention helper rescan for every descendant `childList` mutation under `#detailBody`.

Ver.329 promotes only that audited semantic filter into the active product runtime. The observer root remains `#detailBody` with `{ childList: true, subtree: true }`; the root is not narrowed because the canonical comment panel and form can be reconstructed below it.

A mutation schedules `patch()` only when an added or removed element is, or contains, one of these comment surfaces:

- `.task-comments-panel-v149`
- `#commentForm`
- `.comment-form`
- `textarea#commentText`

Unrelated detail content churn therefore no longer schedules a mention rescan, while form replacement and whole-panel replacement remain covered on desktop and mobile.

## Preserved boundaries

- mention token generation and insertion semantics remain unchanged.
- textarea focus guard remains unchanged.
- Ver.327 transient Escape-listener lifecycle remains unchanged.
- `workflow-v152-update` remains an explicit reconciliation trigger.
- comment, reply, reaction, Firebase and business-data write behavior remain unchanged.

Release and responsibility baseline advance from 281 to 282.

Rollback branch: `backup/ver328-before-comment-mention-observer-product-v329`.

## Regression contract

The product regression verifies the active runtime directly, without injecting the former audit candidate:

- after the installed mention helper is removed, unrelated detail churn does not recreate it;
- canonical comment-form replacement is adopted and recreates the helper;
- whole comment-panel replacement remains adopted on mobile;
- the picker and Ver.327 Escape-close lifecycle remain usable after semantic adoption.

The superseded injected Ver.328 browser audit spec is retired after product promotion; `COMMENT_MENTION_OBSERVER_AUDIT_V328.md` remains as the evidence record.
