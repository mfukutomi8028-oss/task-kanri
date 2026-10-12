# Ver.432 Stage E — 過去の退役監査文書を横断する参照漏れ検出

Issue #292 / Stage E。Ver.431正式main `ab017d3b885ff8ea425493438d9b15436ab0b908` のチェックポイントを起点とする独立候補。

## 背景

Ver.431の静的実行参照ガードはVer.430の共通台帳6件のみを対象としており、Ver.427、428、429で退役した11件のroot Markdownには同じ横断検査が及んでいなかった。歴史的索引の個別Protocolテストは残るが、現役コード・テストへの将来の参照再導入を一括で発見できない。

## 実装と境界

- Ver.427の固定コミット索引5件、Ver.428のObserver索引3件、Ver.429のランタイム棚卸し索引3件、Ver.430の共通台帳6件、合計**17件**を既存のStage Eガードへ集約。
- 旧文書名・40桁blob SHA・固定コミット復元リンクの形式を確認し、索引欠損、重複登録、不正な原本リンクがあればfail-closed。
- 既存のGit管理ソース横断スキャン、退役root再登録防止、読み込み失敗防止を17件へ拡張。従来のfixture検証・既存の履歴Protocolテストは維持し、既存の単一test:protocol登録を使用。
- 現役HTML/JS/CSS、release-manifest、Pagesランタイム、Firebase/Rules、認証、保存データ、Release304を変更しない。旧PNGや互換URLは削除しない。

**限界**：本ガードは静的な完全一致ファイル名参照のみ。動的path生成、テキストに表れない外部ブックマーク、キャッシュHTMLによるHTTP要求は別途実機検証が必要。結果がゼロでも自動削除は承認しない。

## 受入条件

専用Draft PRに対する独立exact-head Protocol/Browser/Firebase/Regression全成功、expected-head main merge、main同SHA Regression/Pages全成功、専用復旧checkpoint確認の順。既存のVer.431ガードとテストを拡張するため、同じ機構の重複実装やpackage.json登録増加は避ける。
