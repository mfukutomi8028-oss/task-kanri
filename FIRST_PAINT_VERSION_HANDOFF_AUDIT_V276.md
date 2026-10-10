# Ver.276 first-paint version handoff 監査

## 目的

Ver.275 製品化後も初期 version 表示には、`release-manifest.js` の `DOMContentLoaded` text 同期と `config.js` の `start()` 冒頭 `setVersion()` が連続して存在する。

本監査では、first-paint guard により UI が非表示の間に両処理がどのように引き継がれ、manifest 側の text 同期に独立した復旧価値・表示価値があるかを Protocol / 実ブラウザで確認した。

本監査は **audit-only** とし、`release-manifest.js` / `config.js` の製品 runtime、release 値、Firebase、業務データ経路は変更しない。

監査基点:

- main: `d25d9b5a7a887bb3aa099adc35a0ef4f9672c837`
- release / baselineRelease: `260`
- PR: #164
- Regression: #644
- Protocol: 262 pass / 0 fail
- Browser: 192 pass / 55 skip / 0 fail
- Firebase Emulator: success

## 現行 handoff

初期 HTML には rollback / cache 互換用の旧表示が残っている。

- class: `app-version`
- text: `Ver.143`
- title: `現在のバージョン`

script 順序は以下で固定されている。

1. `release-manifest.js`
2. `config.js`
3. application module

`release-manifest.js` は読込直後に `wb-first-paint-v260` を `html` へ付与し、`body` を `visibility:hidden` にする。

その後 `DOMContentLoaded` で以下を実施する。

- 全 `img` の legacy asset 補正
- `.app-version, .workboard-version-display` の text を `Ver.260` へ同期

`config.js` も `DOMContentLoaded` で `start()` を開始し、冒頭の `setVersion()` で以下をまとめて同期する。

- global version
- legacy `app-version` class 除去
- `workboard-version-display` class 付与
- text
- title
- `data-release-version`

さらに asset 読込完了後にも `setVersion()` をもう一度実行する。

first-paint guard の解除は `workboard:assets-ready` 後であり、実際の表示解放は double `requestAnimationFrame` 内で行われる。

## 実測結果

### 1. 通常起動の実行順

`V276_FIRST_PAINT_NORMAL_METRICS` では、`DOMContentLoaded` listener の登録・実行順はともに以下だった。

1. manifest
2. config

manifest handler が開始した時点では:

- text: `Ver.143`
- class: `app-version`
- title: `現在のバージョン`
- `data-release-version`: 空
- first-paint guard: active
- assets-ready: false

manifest はここで text だけを `Ver.260` へ 1 回更新した。

この書込時も:

- first-paint guard: active
- assets-ready: false

であり、ユーザーへ表示される前の処理だった。

その直後に config の `DOMContentLoaded` handler が開始した時点では:

- text: `Ver.260`
- class: `app-version`
- title: `現在のバージョン`
- `data-release-version`: 空
- first-paint guard: active
- assets-ready: false

つまり manifest は version **文字列だけ**を先行補正し、semantic class / title / dataset の同期はまだ完了していない。

config の最初の `setVersion()` が、その残りを current state へ完全同期した。

通常経路では manifest が既に text を current にしているため、config 自身による version text 書込は 0 件だった。

### 2. first-paint reveal 時点

通常起動の reveal snapshot は 1 回で、以下が成立していた。

- text: `Ver.260`
- class: `workboard-version-display`
- legacy `app-version`: なし
- title: `現在のバージョン Ver.260`
- `data-release-version`: `260`
- `WORK_BOARD_RELEASE_VERSION`: `260`
- `WORK_BOARD_VERSION`: `260`
- assets-ready: true
- first-paint guard: inactive

したがって、ユーザーへ表示される時点では config による semantic 同期が完了している。

### 3. manifest version text 書込を抑止した反実仮想

manifest の `DOMContentLoaded` handler自体は残し、version text への 1 回の書込だけをテスト環境で no-op にした。

`V276_FIRST_PAINT_SUPPRESSED_MANIFEST_METRICS` では、config handler 開始時点でも legacy 状態がそのまま残った。

- text: `Ver.143`
- class: `app-version`
- title: `現在のバージョン`
- `data-release-version`: 空
- first-paint guard: active
- assets-ready: false

その状態から config の最初の `setVersion()` が自ら text を `Ver.260` へ 1 回更新し、class / title / dataset も current state へ同期した。

config による text 書込時も:

- first-paint guard: active
- assets-ready: false

だった。

reveal snapshot は通常経路と完全に同じ current state へ収束した。

つまり manifest 側の version text 書込がなくても、**ユーザーへ UI が見える前に config 単独で完全同期できる**。

### 4. config lifecycle との整合

同じ Regression で Ver.275 の lifecycle 回帰も green を維持した。

- start direct sync: 2 回
- initial pageshow recovery: 1 回
- 300ms / 1200ms timer: 0
- no-drift focus / pageshow: DOM mutation 0
- synthetic drift: focus / pageshow 単独で完全復旧
- normal navigation: version lifecycle call / mutation 0

したがって、manifest 初期 text 同期を縮小しても post-boot recovery を別途追加する必要はない。

## 結論

### A. manifest の DOMContentLoaded version text 同期に独立した表示価値は確認できない

manifest の text 補正は first-paint guard 中、assets-ready 前にのみ実行される。

実際の UI 表示解放前には config の `setVersion()` が complete semantic state を構築するため、manifest 側の先行 text 補正はユーザーから観測できない。

### B. manifest version text 同期を除いても config が同じ表示契約を成立させる

manifest text 書込だけを抑止した実ブラウザ検証でも、config の最初の `setVersion()` が `Ver.143` から current `Ver.260` へ自ら補正し、reveal 時点は通常経路と同一だった。

このため Ver.277 製品では、manifest `DOMContentLoaded` handler 内の version text loop を撤去する候補とする。

### C. manifest の DOMContentLoaded handler 全体は削除しない

同じ handler は `document.querySelectorAll('img').forEach(upgradeImage)` も所有している。

今回不要性を確認したのは **version text loop だけ**であり、legacy image finalization まで同時に削除してはいけない。

### D. config の start 前後 2 回は今回変更対象にしない

最初の `setVersion()` は、manifest text 補正がない状態から完全な current version 表示を構築できることを実測したため明確な初期化価値がある。

2 回目は asset load boundary 後の回復責務として Ver.275 から保守的に維持しており、本監査では削除判断を行わない。

### E. focus / pageshow recovery は維持する

Ver.275 の実ブラウザ回帰で、双方が synthetic drift を単独復旧し、no-drift 時は mutation 0 を維持している。

初期 handoff の整理とは独立した lifecycle recovery として残す。

## Ver.277 製品 acceptance

次工程では以下を製品条件とする。

1. `release-manifest.js` の `DOMContentLoaded` handler から version text loop だけを撤去する。
2. 同 handler の legacy image final sweep は維持する。
3. first-paint guard / assets-ready reveal / 4秒 safety fallback は維持する。
4. `config.js` の start pre-load / post-load `setVersion()` 2 回は維持する。
5. focus / pageshow recovery は維持する。
6. 通常初期起動で manifest-owned version text write が 0 になることを Browser で固定する。
7. static legacy `Ver.143` から config が first-paint guard 中に current version へ補正し、reveal 前に semantic class / title / dataset / globals がすべて current になることを固定する。
8. Ver.275 lifecycle 回帰（no-drift 0 mutation / drift recovery / navigation 0 call）を維持する。
9. 製品 runtime 変更に伴い release / baselineRelease を `261` へ一致させる。
10. Protocol / Browser / Firebase Emulator / PR CI / main CI / Pages をすべて green にする。

## 非変更

Ver.276 監査では以下を変更しない。

- `release-manifest.js` 製品 runtime
- `config.js` 製品 runtime
- release / baselineRelease `260`
- first-paint guard / reveal lifecycle
- legacy image compatibility
- focus / pageshow recovery
- Firebase 初期化・保存・同期・transaction 境界
- 業務データ構造

Ver.276 は監査結果だけを main へ残し、製品変更は別 Ver.277 PR で行う。
