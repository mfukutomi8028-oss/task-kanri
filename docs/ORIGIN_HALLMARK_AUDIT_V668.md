# Origin Hallmark audit — Ver.668 first improvement wave

## Baseline and scope

Ver.667, main `100fad61fab24bcfb8a6a0b368cab5a1eef3e3fa`, supplied ZIP. Origin's existing Japanese workbench and personal sticky design remain the foundation. Previous audit: `docs/ORIGIN_UIUX_REAUDIT_20261114.md`. Main source: `origin-modern-v372.js` and `origin-personal-sticky-v659.js`. No change to shared Firebase/data/auth contracts or Classic/JOURNAL runtime.

## Findings and response

| Priority | Source evidence | Response |
|---|---|---|
| High | `head()` duplicates a decorative English kicker and Japanese title on eight screens. | One meaningful heading, optional description, consistent counts and local create actions. |
| High | `renderTasks()` places sort/grouping within search tools while later CSS reorders controls. | Move the existing sort group after search/view controls; retain all actions and IDs; remove replaced rules. |
| High | Default light warning/danger/info tokens do not all reach normal-text 4.5:1 on their paired backgrounds. | Warning 3.95→5.48, danger 4.48→5.67, info 3.78→4.91. Computed from token pairs; not whole-app WCAG certification. |
| Medium | `.progress-fill` animates width, and focus styles transition the ring. | Transform progress with reduced-motion fallback; immediate focus. |
| Medium | Fixed dialogs use `100vw`; some disabled controls lack distinct affordance. | Use containing width; improve disabled presentation without changing handlers. |
| Medium | Fonts and memo paper colors are duplicated in embedded styles. | Introduce host-scoped tokens and retain existing paper colors and Japanese fallback stack. |
| Follow-up | Large single-file renderer and duplicated styles, other literal colors, nested controls, narrow viewports. | Audit by actual screenshots and computed styles before additional restructuring; do not blindly apply landing-page rules. |

## Skills and evidence

Hallmark: app-scope audit and quality gates; actual `sloplint.mjs` before/after runs over two extracted embedded stylesheets. UI/UX Pro Max: local search and design guidance. Impeccable, Frontend Design and Apple Design: manual hierarchy, restraint, and interaction assessment; Impeccable native engine unavailable. Web Interface Guidelines: reviewed official rules, especially labels, focus, motion and long content. Webapp Testing: local Playwright attempt plus new offline Playwright cases. No production database access or real user records.

Hallmark extracted CSS comparison: FAIL 216→176; REFLEX 838→825; WARN 17→17. Gate 48: 191→171, gate 67: 8→0, gate 39a: 7→2, gate 34: 6→1, gate 10a and 15: 1→0 each. Remaining findings are not waived: `:host` token detection is incomplete, spacing is heuristic, and real color/typography/viewport issues need follow-up. No full rendered Hallmark pass is claimed.

## Verification gate

Three new source-level regression tests failed before the changes and passed after. Added browser tests at 320/390/1366/1920px and reduced-motion verification, using offline fixture rooms. Existing regression suite must run before merge. Local Chromium launched but navigating to localhost was blocked by administrator policy; full screenshot comparison, real browser operation, screen-reader/physical device, zoom and comprehensive dark-mode verification remain open. Static Hallmark render is not complete (missing renderer dependency). No independently dispatched reviewer is available in this session. Verify exact diff and required CI before formal release. Release approval is conditional on regression checks, not the static Hallmark count.

Next: inspect CI, capture real screens with synthetic data where permitted, compare dense tasks, schedule/reader and memo layouts, then address remaining verified findings in isolated waves. The design contract is `design.md`.

## Integration follow-up (2026-11-24)

Initial candidate CI #45321003509: Protocol succeeded; browser 118 passed, 1 failed (expected progress transition duration `0s`, received `1e-05s`). Root cause: an existing universal reduced-motion `!important` override. Apply the component-local `transition:none!important`; keep the exact assertion. Local integrated source Protocol: 1,117 passed, 2 Git-dependent skips, 0 failures. PR #1005 merged first as Ver.668, so the Hallmark release candidate is Ver.669. All 16 overlapping Origin hunks were reconciled against the exact main source and local/remote blob identity was verified. Integrated browser verification remains required. The historical filenames retain V668 to identify the original audit and test batch.

## Actual visual evidence and parallel PR integration (2026-11-24)

- Hallmark candidate `b99d5fccde566244bb1c934db7a960961db41b2a`: CI run 45322094536 success, four browser shards 253 + 321 + 320 + 320 = 1,214 passed; Protocol, authorization and Firebase jobs succeeded. Reduced-motion assertion passed. This result predates PR #1007 integration.
- Dot candidate `c0b0409272f74f7f406fd30d2c61d79cfaeed01b`: CI run 45324768654 success, browser 109 passed including its six added tests. The base was the published Ver.668.
- Visual run 45322094680: 120 captures (60 pairs) from six width/theme combinations, 320/390/1366/1920px; all 120 had 0 document-level horizontal overflow and no recorded page errors. Artifact 14887627489 includes compare.html and metrics.json. Representative PC/mobile light/dark captures were inspected. At 390px in light mode, Today heading height 58.75→31.046875px; tasks 110.75→83.046875px; notes 170.75→143.046875px. At 1366px the main headings with descriptions measure 87.203125→65.09375px. Japanese-first headings are more direct and the primary create action is clearer. Preserve this direction. These are viewport measurements, not a whole-app accessibility certification.
- Remaining observed issues: mobile task command/filter regions consume substantial height, so the first board card is low on the initial viewport; mobile business memo controls are stacked above the content; a synthetic schedule reminder toast obscures bottom controls of the detail view in both versions. Investigate the notification owner and modal interaction separately, not by disabling real notifications. Set a fixed safe morning clock only in the comparison fixture, to compare the resting layout reproducibly. Keep the existing reminder tests intact. Dark theme surfaces and sticky paper treatment are retained; further density/detail and control-state improvement should be evaluated against real screenshots. Native Hallmark rendered verification, complete accessibility review, 200% zoom and physical-device checks remain outstanding.
- Integration: all 16 Dot runtime hunks reconstruct the exact Dot source on its original base. Apply those hunks to the Hallmark branch with one context adaptation (Today uses the new `head()` signature); reversing the adapted hunks restores the exact original Hallmark source. Keep the Dot test file byte-identical. Both candidates' CI results above are historical; a fresh integrated CI and visual run are required before publication.
