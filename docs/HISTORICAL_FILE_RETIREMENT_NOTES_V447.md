# Ver.447 — Immutable archive of superseded asset-retirement plans

**Issue #292 / Stage D–E.** Baseline: formally accepted Ver.446 main `6f65a7ef70f4dbbad2ce7f26e16cdba2fb5d3576` (same-SHA Regression #38341734227 and Pages #38341734216 succeeded; checkpoint `backup/ver446-date-dialog-reopen-reflow-validated-checkpoint`). This document records a proposed removal from the current Git root, not deletion of Git history.

## Why these two are historical rather than current runbooks

- Ver.378's file-retirement note says that PR #291 is an unmerged draft on Release302 and proposes first-batch files that have already been retired and verified. Its initial file counts and v143 startup assumptions are historical evidence, **not** current deletion instructions. The current authority is the actual `release-manifest.js`, Pages packaging and the Issue #292 acceptance history.
- Ver.379's asset-inventory note describes the original read-only candidate classifier before Ver.439 dynamic manifest coverage and Ver.440 legacy Pages alias protection. The **active tooling** remains `test-harness/asset-retirement-inventory-v379.mjs` with `test-harness/asset-retirement-inventory-v379.test.mjs`, and `test-harness/build-pages-runtime-v382.mjs` preserves original legacy URL bytes. No audit code is being retired.
- Both files were explicitly held for *additional review* in the Ver.438 snapshot (`docs/STAGE_E_ROOT_MARKDOWN_TRIAGE_V438.md`), rather than treated as permanently protected. This review selects only the outdated **root text copies**. Current safety, archived previous decisions, and the protected image/URL compatibility contracts remain intact.
- The GitHub code-search check returned no exact filename matches for either document. This is merely a preliminary hint: indexing gaps, dynamically generated file names, external bookmarks and historical URLs are not ruled out. CI's Stage E executable-source guard and regression checks are required independently.

## Two original documents — fixed commit and exact Git blob

| Retired root Markdown | Original Git blob SHA-1 | Bytes | Immutable original |
| --- | --- | ---: | --- |
| `ASSET_RETIREMENT_AUDIT_V379.md` | `3961c738b8652b2d9a89147a3316c71da2bbbf0b` | 3,121 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/6f65a7ef70f4dbbad2ce7f26e16cdba2fb5d3576/ASSET_RETIREMENT_AUDIT_V379.md) |
| `FILE_RETIREMENT_V378.md` | `9422fac3893cab42fda0dabcaeb026a65b53ba74` | 4,215 | [原本](https://github.com/mfukutomi8028-oss/task-kanri/blob/6f65a7ef70f4dbbad2ce7f26e16cdba2fb5d3576/FILE_RETIREMENT_V378.md) |

**Original source total: 2 files / 7,336 bytes.** The previous files' exact original content is recoverable from the immutable source SHA. Two removals plus this one index yield one fewer tracked file, while changes to existing guard/tests change the net byte count. Git history size does not shrink.

## Current authoritative instructions and retained boundary

- For the current app and deployment, consult `README.md`, `release-manifest.js`, `patch-responsibilities.json`, and `test-harness/build-pages-runtime-v382.mjs`; for historical cleanup decisions, use Issue #292 and accepted immutable archival indexes under `docs/`.
- Read-only asset evidence: `node test-harness/asset-retirement-inventory-v379.mjs --json`. Its `candidate-manual-review` classification is **not automatic permission** to remove a file. The five manifest lists and reverse legacy alias targets are accounted for by current tests.
- The old large PNG files, old cached URLs, all active JS/CSS, startup HTML, dynamically constructed image paths, sample config, snapshot baselines, operational CI/recovery notes, Firebase/Auth/Rules and user data are **not** changed.
- Existing Ver.438 classification remains an honest snapshot of 16 *then-retained* notes. Ver.447 subsequently archives precisely two of its manual-review notes. The other 14 are **retained**; this does not reclassify or silently remove them.

## Risk, restoration and acceptance

Old `blob/main/ASSET_RETIREMENT_AUDIT_V379.md` and `blob/main/FILE_RETIREMENT_V378.md` links, or root-relative references in external tickets/bookmarks, may become 404 after merge. This is an accepted documentation-link risk **only for these two named files**; immutable original links above remain available. Pages does not publish root Markdown documents, so the current web runtime payload should not change. If a hidden dependency surfaces, restore each original at its historical path from the fixed commit, then rerun Protocol/Browser/Firebase and Pages validation.

Add this immutable index to the fail-closed Stage E archived-reference guard and keep original blob/hash/size/URL assertions in its existing test. No new standalone test file or CI workflow modification. Verify exact PR head Protocol, both Browser shards, Firebase, final Regression → expected-head merge → same-SHA main Regression and Pages success → dedicated checkpoint readback before declaring acceptance.
