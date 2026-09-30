# Ver.329 Comment Mention Observer Productization

> Status: implementation checkpoint only. The audited runtime change has not yet been applied, tested, opened as a product PR, or merged. Ver.328 remains the current product checkpoint.

## Scope

Ver.328 proved that `comment-mentions-v191.js` does not need to schedule a full mention helper rescan for every descendant `childList` mutation under `#detailBody`.

Ver.329 is intended to promote only that audited semantic filter into the active product runtime. The observer root remains `#detailBody` with `{ childList: true, subtree: true }`; the root is not narrowed because the canonical comment panel and form can be reconstructed below it.

A mutation should schedule `patch()` only when an added or removed element is, or contains, one of these comment surfaces:

- `.task-comments-panel-v149`
- `#commentForm`
- `.comment-form`
- `textarea#commentText`

After implementation, unrelated detail content churn should therefore no longer schedule a mention rescan, while form replacement and whole-panel replacement must remain covered on desktop and mobile.

## Preserved boundaries

- mention token generation and insertion semantics remain unchanged.
- textarea focus guard remains unchanged.
- Ver.327 transient Escape-listener lifecycle remains unchanged.
- `workflow-v152-update` remains an explicit reconciliation trigger.
- comment, reply, reaction, Firebase and business-data write behavior remain unchanged.

The planned release and responsibility baseline advance is 281 to 282, only after product regression is green.

Rollback branch: `backup/ver328-before-comment-mention-observer-product-v329`.

## Regression contract

The product regression must verify that unrelated detail churn does not re-enter the mention scan, canonical comment-form replacement is adopted, whole comment-panel replacement remains adopted on mobile, and the picker/Escape lifecycle remains usable.