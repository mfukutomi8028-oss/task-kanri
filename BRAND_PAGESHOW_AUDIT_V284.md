# Ver.284 Brand pageshow audit

## Scope

Ver.283で `brand-v185.js` のstartup brand / favicon / Notification初期化を `apply()` 1回へ集約した後、cold bootでもnative `pageshow` が発火して同じ `apply()` が再実行される。Ver.284では、このnon-persisted初回pageshowの独立価値と、BFCache / resume用persisted pageshow recoveryを分離して実測した。

監査のみのため、製品runtime、`release-manifest.js`、release 264、Firebase書込・同期境界、業務データ経路は変更していない。

## Measurements

### 1. Normal cold boot

通常cold bootでは `apply()` が2回実行された。

1. startup apply
2. `persisted === false` の初回pageshow apply

startup applyはlegacy状態からcurrent状態へ実際に収束させた。

- favicon: 4 add / 3 remove
- brand mark: 1 write
- Notification wrapper: 1 write
- `data-brand-version`: `"" -> "185"`

その後の初回pageshow開始時点では、favicon、brand mark、Notification、`data-brand-version` はすでにすべてcurrentだった。2回目のapplyによる実変更は以下だった。

- favicon add: 0
- favicon remove: 0
- brand mark write: 0
- Notification wrapper write: 0
- `data-brand-version`: `"185" -> "185"` の同値代入

MutationObserverでは、この同値代入も1件のattribute mutationとして観測された。

### 2. Suppressed non-persisted initial pageshow

監査用instrumentationで `persisted === false` の初回pageshowからだけ `apply()` を呼ばない対照ケースを実行した。

- startup applyのみ1回
- first-paint guard解放後のbrand markはcurrent
- Notification brandはcurrent
- faviconはcanonical 4-link set
- releaseは264
- `data-brand-version`は185

通常cold bootとの差はなく、2回目のapplyと同値 `data-brand-version` mutationだけが消えた。

### 3. Persisted pageshow recovery

non-persisted初回pageshowを抑止した状態で、brand mark、favicon、Notificationにsynthetic driftを作り、`persisted === true` のpageshowを発火させた。

persisted pageshowは以下をcurrentへ復旧した。

- favicon: 4 add / 4 remove
- brand mark: 1 write
- Notification wrapper: 1 write

したがってBFCache / resume用pageshow recoveryには独立した復旧価値がある。

## Conclusion

1. cold bootのnon-persisted初回pageshowは、Ver.283後のstartup状態を追加で正す役割を持たない。
2. favicon / brand mark / Notificationはすべてno-opだが、`data-brand-version = VERSION` の同値代入だけが実DOM mutationとして残る。
3. non-persisted初回pageshowを抑止してもfirst-paint後の最終状態は完全に一致する。
4. `persisted === true` のpageshowはsynthetic driftを復旧できるため維持する必要がある。

よって次の製品工程では、cold bootのnon-persisted初回pageshowだけを退役し、persisted pageshow recoveryを残すのが最小かつ安全な縮小単位である。

## Ver.285 acceptance

- startup `apply()` は維持する。
- cold bootの `persisted === false` pageshowでは `apply()` を再実行しない。
- `persisted === true` pageshowでは `apply()` を実行し、brand mark / favicon / Notification driftを復旧する。
- canonical 4-link favicon setとbrand / Notification current状態を維持する。
- cold bootの同値 `data-brand-version` mutationを撤去する。
- release / baselineを265へ更新する。
- Firebase・業務データ経路は変更しない。
- Protocol / Browser / Firebase Emulator / PR CI / main Regression / Pagesをすべてgreenにする。
