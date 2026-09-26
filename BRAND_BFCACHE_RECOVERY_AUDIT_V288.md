# Ver.288 Brand BFCache Recovery Audit

## Baseline

- main checkpoint: `8d197236d49f30b8a245d276d360621054e28c6e`
- release: `266`
- production change in Ver.287: `data-brand-version` assignment is idempotent.

## Audit target

`brand-v185.js` keeps one `pageshow` listener and calls the full `apply()` only when `event.persisted === true`.

The remaining recovery pass contains four responsibilities:

1. `.brand-mark img` canonical source recovery
2. favicon 4-link canonical set recovery
3. `window.Notification` wrapper recovery
4. `data-brand-version` canonical marker recovery

All four production writes are already guarded/idempotent. Ver.288 therefore does **not** assume that the BFCache pass is removable. It first measures whether each recovery responsibility has independent value after a real/synthetic persisted restore and whether any sub-responsibility can be narrowed without losing recovery semantics.

## Safety constraints

- Do not change Firebase or business-data write paths.
- Do not remove startup `apply()`.
- Do not remove persisted-only recovery without browser evidence.
- Keep brand mark, favicon, Notification and dataset recovery behavior until evidence proves a narrower safe boundary.
- Ver.288 is audit-only; release stays `266`.

## Planned evidence

Protocol/browser tests should establish:

- non-persisted `pageshow` remains a no-op;
- no-drift persisted recovery produces no DOM/dataset/favicon writes and does not re-wrap an already-current Notification;
- synthetic drift in each responsibility is repaired by persisted recovery;
- repairs are isolated enough to identify whether calling the whole `apply()` has observable unnecessary side effects;
- startup canonicalization remains unchanged.

## Product decision gate

Only promote a Ver.289 product change if the audit demonstrates a strictly smaller recovery boundary with identical externally observable recovery behavior. Otherwise retain the current persisted-only `apply()` as the canonical design.
