# JOURNAL Canva文具素材・実装対応表（2026-11-06）

## 目的
JOURNALの画面を、Classicと無関係な手帳型UIとして高品質に見せる。装飾で作業領域を圧迫せず、各ページに固有の文具を配置する。

## Canva原本
- デザイン：JOURNAL文具素材集（6ページ、Canvaで新規制作済み）
- デザインID：`DAHaG15tRWI`
- 編集URL：https://www.canva.com/d/1UaN3QwdBDP9mAn

| Canvaページ | 目的 | Canva内のメディアID（候補） | Webの表示領域 |
| --- | --- | --- | --- |
| 1 万年筆 | タスク一覧の末尾にのみ配置 | `MAHaGw0cwJo` | `#listView .j425-list-props` |
| 2 定規・チェック印 | ToDoの紙面内 | `MAHaGyDajwI`, `MAHaG0f-cJw` | `#todoView .j425-todo-props` |
| 3 押し花 | 予定の紙面端 | `MAHaG_jobz0`, `MAHaGz3Psmk` | `#scheduleView .j425-schedule-props` |
| 4 クリップ類 | メモごとに異なる留め具 | `MAHaGwOLTaI`, `MAHaG6wdsNY`, `MAHaG3GTyZY` | `#workMemoViewV167 .j425-memo-fastener` |
| 5 紙タグ・紙片 | タスク机上の下部 | `MAHaGyb562E`, `MAHaG51zqao` | `#boardView .j420-atelier-stationery` |
| 6 紙しおり | 今日のワークノート | `MAHaG9PL-1k`, `MAHaG0LkBvw` | `#todayView .j425-today-stationery` |

## 現時点の状態と取り込み条件
- Canva原本の各ページとメディア要素は確認済み。
- 現接続の画像取得結果はサムネイル・**期限付きの署名URL**。恒久的なローカルPNG・WebP・SVGの書き出しには至っていない。
- 期限付きURL、Canvaの認可トークン、サムネイルURLを製品CSSやHTMLへ記述しない。リンク切れや公開範囲の問題が生じる。
- 実画像を組み込む際は、画像を正規に書き出して背景・ライセンス・解像度を確認した後、`assets/` に恒久ファイルとして保存する。透過画像かどうかは未検証なので前提にしない。
- 画像取得までの間、従来のローカルSVG/CSSをフォールバックとし、レイアウトを破綻させない。既存の共有保存・Firebase・権限・タスク/ToDo/予定/メモ操作は変更しない。
- メモの留め具は各メモIDから種類と微細な角度・位置を決め、並び替えや色替えでむやみに動かさない。同じテープを全メモに重ねる装飾は廃止。

## 画像差し替え時の受入条件
1. 320px、390px、1366px、広いPC幅で、テキスト・ボタン・スクロールを塞がない。
2. 画像はレイアウトの専用余白に入り、`pointer-events:none` と適切な`aria-hidden`を使う。
3. ページ固有の小物を別画面へ機械的に重複させない。
4. 小物のネットワーク要求はバージョン付きの同一サイト相対パス。Canvaの有効期限付きリンクを参照しない。
5. JOURNALからClassic・Origin・Paletteへ切り替えても装飾用ノードやスタイルが残らない。
6. 既存のProtocol/ブラウザ回帰に加え、表示・実操作とメモ並び替え/色変更/画面切替を確認する。
