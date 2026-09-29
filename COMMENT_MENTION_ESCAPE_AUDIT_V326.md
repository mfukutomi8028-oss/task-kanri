# Ver.326 Comment Mention Escape Listener Audit

## Scope

Ver.325 selected `comment-mentions-v191.js` as the next isolated cleanup candidate. Ver.326 is audit-only: production runtime, Release 280, responsibility baseline 280, Firebase paths, and business-data writes remain unchanged.

## Current ownership

The mention picker installs one permanent `document` `keydown` listener during startup. The callback exits unless Escape is pressed while the mention shell exists and is visible, but it still wakes for unrelated key events while the picker is closed.

## Candidate

The non-product browser candidate binds the Escape listener only after the mention picker becomes visible and removes it from every canonical `closePicker()` path. Because cancel, backdrop, apply, and Escape already converge through `closePicker()`, this narrows listener lifetime without changing comment persistence or mention token semantics.

## Browser evidence required

- Current runtime: closed picker still receives document keydown callbacks on desktop and mobile.
- Candidate idle state: zero listener ownership and zero wake-ups while closed.
- Open state: exactly one listener is owned while visible.
- Escape: closes the picker, retains task-dialog top-layer mounting, and releases ownership.
- Reopen/cancel cycles: no listener accumulation.
- Backdrop and apply: both release ownership.
- Mobile and desktop behavior remain intact.

## Product gate

If Protocol, Browser, and Firebase Emulator CI remain green and the candidate proves the above lifecycle, promote the same narrowly scoped behavior in Ver.327. Do not alter the `#detailBody` MutationObserver in this work unit; it remains responsible for adopting rerendered comment UI and requires separate evidence before any scope change.
