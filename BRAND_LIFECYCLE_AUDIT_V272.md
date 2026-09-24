# Ver.272 Brand lifecycle 再適用境界監査

## 目的
Ver.269でfirst-paint legacy icon observerをassets-readyで終了し、Ver.271でicon-systemのfinite pollingをsingle-pass化した後も、`brand-v185.js` が持つ起動時favicon再適用と `pageshow` 全applyが必要かを実ブラウザで確認する。

監査対象は `brand-v185.js` の favicon / brand mark / Notification の3責務。製品runtime・ブランド資産・release値は変更しない。

## 前提
- base main: `3d08c93cc1a7a3f7e53ddfd431104d25af98d8d4`
- release / baselineRelease: 258
- Ver.271 icon-system single-pass化済み
- `release-manifest.js` first-paint compatibilityは参照のみ

## CI
Regression #628 は Protocol / Browser / Firebase Emulator を含めて success。

- Protocol: 252 pass / 0 fail
- Browser: 185 pass / 55 skip / 0 fail
- Firebase Emulator: success

## 実測結果

### 1. 通常起動
`V272_BRAND_STARTUP_METRICS`

- brand-owned favicon link追加: 12回
  - 即時 `patchBrowserIcons()` で4件
  - `apply()` 系で4件×2回
- favicon link削除: legacy 4件 + current 4件×2回
- brand mark write: 1回
- pageshow listener: 1件
- startup中 pageshow callback: 1回
- 最終favicon: current 4件
- 最終brand mark: `assets/brand-v184.svg?v=185`
- Notification wrapper brand version: 185

通常起動だけで同じcurrent favicon setを複数回remove/addしており、起動時favicon補正には明確な重複がある。

### 2. no-drift pageshow
`V272_BRAND_PAGESHOW_NODRIFT_METRICS`

- icon remove: 4
- icon add: 4
- brand mark write: 0
- pageshow callback: 1
- Notification constructor identity: unchanged

brand markとNotificationは既にidempotentだが、faviconはcurrent状態でも毎回remove/addされる。

### 3. synthetic drift後の pageshow
`V272_BRAND_PAGESHOW_DRIFT_METRICS`

`pageshow` は以下をすべてcurrentへ復元した。

- favicon: current 4件へ復元
- brand mark: current SVGへ復元
- Notification wrapper: brand version 185へ再wrap

したがって `pageshow` recovery自体には実際の修復価値がある。

### 4. 通常navigation
`V272_BRAND_NAVIGATION_METRICS`

Today / Task等の通常navigationでは、

- favicon add/remove: 0
- brand mark write: 0
- pageshow callback: 0
- favicon / brand mark / Notification: current状態維持

通常navigationはbrand driftを生成しない。

## 結論

1. `pageshow` recoveryは維持する。
   - syntheticなfavicon / brand mark / Notification driftを全て修復できるため、BFCache復帰や外部書換えへの安全網として価値がある。
2. 起動時のfavicon再適用は縮小できる。
   - 現行は即時 `patchBrowserIcons()` に加えて `apply()` とstartup `pageshow` が同じfavicon setを再構築するため重複している。
3. brand markとNotificationは現状でもidempotent。
   - no-drift `pageshow` では追加write / rewrapが発生しない。
4. Ver.273製品ではstartup重複だけを除去し、`pageshow` recoveryは残すのが最小安全変更。

## Ver.273 製品候補

`brand-v185.js` を対象に、以下を満たす最小変更を行う。

- 起動時のcurrent favicon構築を1回へ縮小
- DOMContentLoaded時に必要なbrand mark / Notification初期化は維持
- `pageshow` はdrift recoveryとして維持
- no-drift `pageshow` のfavicon remove/addも、可能ならcurrent set判定でidempotent化
- synthetic drift後の `pageshow` ではfavicon / brand mark / Notificationを全復旧
- 通常navigationには新しいlistener / observer / pollingを追加しない
- release-manifest first-paint compatibilityは変更しない

## 非変更
- Firebase保存・同期経路
- ToDo / task / scheduleデータ
- `icon-system-v169.js`
- `release-manifest.js` first-paint legacy compatibility
- ブランド画像資産
- release / baselineRelease（監査段階では258を維持）
