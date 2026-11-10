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
- 画像取得までの間、ローカルSVG/CSSをフォールバックとし、レイアウトを破綻させない。Ver.440では「今日」のみ恒久ファイル `assets/journal-bookmark-seal-v440.svg` を配置し、旧CSSの擬似封蝋/しおりを置換した。このSVGはCanvaの書き出し画像ではなく、Canva作品の配置方針に合わせた独立したWeb用素材。既存の共有保存・Firebase・権限・タスク/ToDo/予定/メモ操作は変更しない。
- メモの留め具は各メモIDから種類と微細な角度・位置を決め、並び替えや色替えでむやみに動かさない。同じテープを全メモに重ねる装飾は廃止。

## 画像差し替え時の受入条件
1. 320px、390px、1366px、広いPC幅で、テキスト・ボタン・スクロールを塞がない。
2. 画像はレイアウトの専用余白に入り、`pointer-events:none` と適切な`aria-hidden`を使う。
3. ページ固有の小物を別画面へ機械的に重複させない。
4. 小物のネットワーク要求はバージョン付きの同一サイト相対パス。Canvaの有効期限付きリンクを参照しない。
5. JOURNALからClassic・Origin・Paletteへ切り替えても装飾用ノードやスタイルが残らない。
6. 既存のProtocol/ブラウザ回帰に加え、表示・実操作とメモ並び替え/色変更/画面切替を確認する。

## 2026-11-10：大人向けエディトリアル文具画への改修

以前のCanva原本（上記デザインID）は参考資料であり、現行アプリが直接読み込んでいる画像ではない。現在のJOURNALには恒久的な同一サイト内SVGが配置されている。期限付きCanva URLを使用しない方針は維持する。

### 今回実際に使用されている8素材（既存ファイルを直接改修）
| 画面 | SVG | 改修 |
| --- | --- | --- |
| 今日 | `assets/journal-bookmark-seal-v440.svg` | 彩度を抑えた封蝋と和紙・布しおり |
| タスク机上 | `assets/journal-atelier-cards-v441.svg` | 生成り・オリーブ・クラフト紙の重なり |
| タスク一覧 | `assets/journal-pen-v425.svg` | マットな深緑のペンと古美真鍮の細線 |
| タスク一覧 | `assets/journal-plant-v425.svg` | 植物図鑑風の細い茎・葉脈 |
| ToDo | `assets/journal-todo-stationery-v442.svg` | 落ち着いた木製スタンプ・真鍮色定規 |
| 予定 | `assets/journal-schedule-botanical-v442.svg` | 押し花標本と目立たない日付紙片 |
| メモ | `assets/journal-memo-linen-v442.svg` | 麻織り・柔らかな布リボン |
| タスク・メモ | `assets/journal-fasteners-v425.svg` | 8種類の留め具の金属光沢・和紙彩度を抑制 |

旧素材 `journal-date-stamp-v425.svg`、`journal-herbarium-v425.svg`、`journal-ruler-v425.svg`、`journal-stamp-v425.svg` は現行のJOURNAL実画面から参照されていないため、再表示や新規組込みはしない。現在利用中の8素材の既存パス・サイズ・外部SVGシンボルIDは変えず、画面レイアウト・Firebase・操作処理を維持する。

### 品質と確認
- ページ固有の小物を使い回しせず、細い線、低彩度の草色・深緑、生成り、古美真鍮、薄い実物感のある陰影に統一。
- ブラウザ幅320px/390px/1366px、既存の画像枠、`pointer-events:none`、`aria-hidden` を保持する。
- 全SVGは外部画像・CanvaサムネイルURL・フォントファイルなし。メモ留め具の8つの`<symbol>` IDも維持。
- 画像ファイルの増殖は避け、Git履歴を残したうえで現存ファイルを直接改修。
