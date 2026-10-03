# Ver.359 Schedule Today day-boundary lifecycle productization

## Base
- Ver.358 formal checkpoint: c1841b6c6fcdbbc75f9f2ab55a873543a2eafd12
- Release / baseline: 293

## Product change
- Retire app.js Schedule Today 60-second polling.
- While visible, own exactly one timeout aimed at the next local 00:00 boundary.
- Clear the owned timeout while hidden.
- On visible recovery, focus, and pageshow: reconcile Today immediately and idempotently re-arm one boundary timeout.
- When the boundary timeout fires: reconcile the Today anchor and arm the next local day boundary.

## Preserved behavior
- app.js remains the exclusive Schedule Today anchor owner.
- Today prev/next movement lock remains unchanged.
- schedule rendering, schedule reminder watcher, Firebase/write paths, and schedule data semantics are unchanged.

## Release
- Release / baseline 293 -> 294.
- Ver.358 route-only audit regression is promoted to direct product regression.
