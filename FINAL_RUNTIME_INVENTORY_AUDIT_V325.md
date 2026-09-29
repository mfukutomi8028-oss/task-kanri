# Ver.325 Final Active Runtime Inventory Audit

## Scope

Ver.324 completed the audited desktop-sidebar document-listener lifecycle and established Release / responsibility baseline 280. Ver.325 is audit-only: it does not change product runtime, Firebase paths, or business-data write behavior.

The audit enumerates the active JavaScript runtime from:

- `app.js`
- `config.js`
- every `release-manifest.js` `dynamicScripts` entry
- every conditional `mobileScripts` entry

The protocol inventory records, per active asset, static ownership counts for MutationObserver, document/window/media listeners, intervals, timeouts, and requestAnimationFrame. The existing responsibility inventory remains the source of truth for dynamic asset ownership.

## Previously resolved long-lived ownership

The cleanup track already has dedicated evidence for the largest recurring/global owners, including:

- first-paint legacy icon observer lifetime;
- icon-system finite polling retirement;
- version refresh timer retirement and idempotent recovery;
- ToDo / Today observer narrowing and history date-boundary one-shot refresh;
- mobile-shell startup repatches, orientation listener, resize responsibility, board observer, Schedule retries, navigation delegation, create-menu outside click, and transient Escape ownership;
- work-feature observer scope and date-boundary one-shot refresh;
- desktop-sidebar semantic takeover and transient document Escape / drag cleanup lifecycle.

Those owners should not be reopened merely because the final static inventory still counts their deliberately retained event hooks.

## Remaining concrete candidate

Source review of the remaining active runtime identifies `comment-mentions-v191.js` as the next small, isolated lifecycle candidate.

The mention picker is created lazily and has explicit `openPicker()` / `closePicker()` state through `shell.hidden`, but it still installs a permanent document-level Escape listener at startup:

```js
document.addEventListener('keydown', event=>{
  if(event.key==='Escape'&&shell&&!shell.hidden)closePicker();
});
```

When the mention picker is closed, unrelated keydown events still wake that callback even though it can do no work. This is analogous to the already-productized transient Escape ownership in the mobile shell, but the mention picker is independent and therefore requires its own audit before any product change.

The same file's MutationObserver is not selected at this checkpoint: it is already scoped to `#detailBody`, reacts only to child-list changes, and participates in adopting dynamically rerendered comment UI. Narrowing it further without browser evidence would mix a higher-risk DOM adoption change into an otherwise simple listener-lifecycle cleanup.

## Decision

If the Ver.325 PR remains green through Protocol, Browser, and Firebase Emulator regression, Ver.325 should merge as evidence only at Release 280.

The next work unit is **Ver.326 comment mention Escape listener audit**:

1. instrument the current permanent document keydown callback;
2. prove closed-picker key events wake the current owner;
3. inject a non-product candidate that binds Escape only while the mention picker is open;
4. verify open, cancel/backdrop, apply, Escape close, task-dialog top-layer mounting, reopen cycles, and mobile/desktop behavior;
5. productize only in a later checkpoint if the audit is green.

This keeps the final cleanup phase evidence-driven and avoids broad changes to the high-risk comment/reaction/Firebase write paths.
