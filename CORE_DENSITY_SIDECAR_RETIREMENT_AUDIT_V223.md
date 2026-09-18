# Core density sidecar退役監査（Ver.223）

## 目的

Ver.223で `core-view-density-v188.js` はToday/ScheduleのDOM後処理とMutationObserverをすべて退役し、`patchAll()` と公開observer契約だけを残すno-op互換shellになりました。

次の製品releaseでこのsidecar自体をactive manifestから安全に外せるかを、製品コードを変更せずに確認します。

## 現在の責務境界

- Todayの意味論・操作列・予定通知sidebarは `app.js` が正本。
- Schedule toolbar / 日付 / 検索proxy / focus・caret復元 / range・mode再描画は `app.js` が正本。
- `ui-core-density-v188.css` はToday/Scheduleの表示スタイルを引き続き担当。
- `core-view-density-v188.js` はVer.223ではDOM変更・Observer・保存処理を持たない。

## 監査方法

Browserテスト `tests/core-density-sidecar-retirement-audit-v223.spec.mjs` で、配信される `release-manifest.js` をテスト内だけ仮想変更します。

`core-view-density-v188.js` を次の両方から除外します。

- `requiredAssets`
- `dynamicScripts`

その状態で以下を確認します。

1. `core-view-density-v188.js` へのHTTP requestが0件。
2. `window.__WB_CORE_VIEW_DENSITY_V188__` が未定義でも起動が完了する。
3. Todayの完成形操作列と予定通知sidebarが成立する。
4. Scheduleのtoolbar / 日付 / 検索UIが完成形で成立する。
5. Schedule検索proxyが既存 `#searchInput` と同期し、実際の予定絞り込みへ反映される。
6. 検索後のfocus / caretが維持される。
7. 表示期間を7日間へ変更してもtoolbar・検索値・絞り込みを維持する。
8. calendar表示へ切り替えてもtoolbar・検索値を維持する。
9. 390pxモバイルでも横overflowせず、検索欄とSchedule表示を利用できる。

## 今回変更しないもの

- `release-manifest.js` 本体
- `app.js`
- `core-view-density-v188.js`
- `ui-core-density-v188.css`
- Firebase / revision / transaction / 保存処理
- active CSS / JS本数

## 判定

この監査PRがProtocol / Browser / Firebase Emulatorすべてgreenになり、mainへの監査merge後もRegression / Pagesがgreenであれば、次の製品Ver.224で `core-view-density-v188.js` を `requiredAssets` / `dynamicScripts` から正式退役する根拠とします。

物理ファイルは旧キャッシュmanifest・ロールバック互換のため削除せず保持します。

## 復旧地点

- Ver.223正式main: `d524ecf13a137e97da2721c136fe80a234fe16dc`
- 監査前backup: `backup/ver223-before-core-density-sidecar-retirement-audit`
