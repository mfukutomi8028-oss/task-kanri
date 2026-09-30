# Ver.329 Comment Mention Observer Productization

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

- mention token generation and insertion semantics are unchanged.
- textarea focus guard is unchanged.
- Ver.327 transient Escape-listener lifecycle is unchanged.
- `workflow-v152-update` remains an explicit reconciliation trigger.
- comment, reply, reaction, Firebase and business-data write behavior are unchanged.

Release and responsibility baseline advance from 281 to 282.

Rollback branch: `backup/ver328-before-comment-mention-observer-product-v329`.

## Regression contract

The product regression verifies that unrelated detail churn does not re-enter the mention scan, canonical comment-form replacement is adopted, whole comment-panel replacement remains adopted on mobile, and the picker/Escape lifecycle remains usable.