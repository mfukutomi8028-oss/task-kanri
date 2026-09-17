# Ver.216 コメント入力UI修正

## 原因
Ver.215で追加した `.comment-submit-hint-v215` が `grid-column: 2 / 4` を指定していたため、`ui-task-detail-responsive-v192.css` が所有する1列コメントフォームに暗黙の追加列が生成され、詳細パネル内の種別・本文・追加ボタンが細く潰れて表示された。

## 修正
- ショートカットヒントを `grid-column: 1` に固定。
- 既存の1列コメントフォーム所有権は `ui-task-detail-responsive-v192.css` のまま維持。
- 1440pxデスクトップ幅で、種別・本文・追加ボタンがフォーム全幅を維持し、暗黙列や横スクロールが発生しないBrowser回帰を追加。
- Ver.216へ更新し、動的CSSのキャッシュキーを更新。

## 非変更
- コメント返信保存仕様
- replyTo / revision transaction
- local-only互換marker
- 返信通知
- リアクション
- Today / mobile / schedule / date / version-lock以外の基盤責務
