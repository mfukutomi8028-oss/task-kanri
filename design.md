# Origin — Design system and quality contract

Scope: Origin only (業務管理ボード). Baseline Ver.667; first improvement wave Ver.669 (initial candidate Ver.668), 2026-11-24. Classic and JOURNAL retain their separate identities and existing interfaces.

## Product direction

Daily work, not a marketing landing page. Prioritize finding the next task, checking a schedule, entering a ToDo and returning to work. Keep the restrained neutral surfaces, indigo accent, Japanese-first typography, existing icon language, dark/custom themes, and distinct paper treatment of personal sticky notes. Do not introduce ornamental dashboards, marketing hero sections, speculative statistics or duplicate workflows.

## Visual and interaction rules

- One Japanese `h1` per workspace; use a short explanation only when useful. Record counts and secondary actions must not compete with the title. Prefer the existing shared `head()` renderer.
- Reuse semantic host-scoped CSS tokens (`--paper`, `--bg`, `--ink`, `--ink-soft`, `--muted`, `--line`, `--accent`, `--on-accent`, `--warn`, `--red`, `--blue`), rather than copying color literals. Preserve the existing theme mechanism. Normal text targets at least 4.5:1 contrast, including state text on its paired background. Keep meaningful text/icon states in addition to color.
- Preserve the existing Japanese font fallbacks. Favor 25–30px page titles, 13px secondary labels and tabular numerals for counts. Keep established body/input sizes and allow long Japanese titles to wrap.
- One solid accent treatment for page-local create actions, with a 44px minimum height. Keep global create, cancel and secondary actions semantically distinct. Ensure visible immediate keyboard focus, disabled affordance, and accessible names.
- Task command hierarchy: search and view switch first, then grouping and sort controls; DOM focus order follows reading order. Preserve mobile progressive disclosure, existing filter state and all action IDs. No new stored preferences or data formats.
- Motion is short feedback, not decoration: no hover lift for local primary actions; prefer opacity/transform, immediately visible focus, honor reduced motion. Sticky drag and resize must follow the pointer; Shift snapping stays unchanged.
- Keep fixed dialogs inside the viewport without causing horizontal overflow; verify 320/390/768/1280/1366/1920px where practical, light/dark, keyboard, long text, empty/full data and 200% zoom. Aim for usable 44px targets on mobile.
- Keep existing route, action, form, focus/scroll recovery and canonical bridge contracts. Never change Firebase, auth, authorization, database schemas or unrelated display modes as part of a visual polish. Directly edit the owning code; remove superseded styles rather than layering overrides.

## Screen-specific depth (first wave)

| Surface | Depth | Decision |
|---|---|---|
| Shared header/navigation | Polish | Simplify headings and actions; preserve all six destinations and memo submenu behavior. |
| Today | Polish | Preserve priority work, schedule, ToDo and date selection; align shared heading. |
| Tasks | Redesign (command region only) | Separate search/view selection from sorting/grouping; preserve list, board, timeline and all controls. |
| ToDo | Polish | Shared heading and layout-independent progress motion. |
| Schedule | Polish | Shared heading, create action and control-state consistency; retain calendars and selected date. |
| Business memo | Polish | Shared heading, create action, semantic paper colors and focus. |
| Personal sticky | Polish | Dialog width/disabled state only; keep canvas, layout, Shift gestures and save behavior. |
| Search, other tools, details, inbox | Polish | Shared heading and specific focus/overflow/disabled fixes; preserve operation paths. |
| Classic / JOURNAL / shared persistence | Audit boundary | No runtime change. |

No whole-screen restyle is justified by the first source pass. Further redesign requires evidence from actual rendered screens and prioritization of real usage friction.

## Verification and limitations

The app is generated in a Shadow DOM. The Hallmark static comparison extracts embedded stylesheet strings via the TypeScript AST, with app scope; this is not a full page audit. Before: 216 FAIL / 838 REFLEX / 17 WARN. After: 176 / 825 / 17. Gate 48 includes host-scoped tokens the scanner does not recognize, and app-specific spacing findings require review. Do not interpret the counts as an accessibility score or waive every remaining issue. Native rendered Hallmark checks are incomplete; synthetic Playwright comparisons and a representative manual visual review are now available (see audit report). Use synthetic offline rooms for Playwright and never capture production information. See docs/ORIGIN_HALLMARK_AUDIT_V668.md for evidence, test status and next gate.

## Integration follow-up

PR #1005 was merged first as Ver.668. The Hallmark candidate is therefore Ver.669, reconciled against that main commit. Preserve create-menu keyboard disclosure, search-all focus restoration, accurate current/selected-week counts, and their original regression tests. Progress fill uses `transition:none!important` in reduced-motion mode because the pre-existing universal rule sets a 0.01ms duration with `!important`. Keep the original browser assertion; no weakening of the accessibility gate.

## Interaction continuity (PR #1007)

- Escape dismisses the desktop memo chooser even when opened by hover; keyboard entry and pointer re-entry remain available.
- Re-rendering restores the exact date control and notification identity, not merely a common action or task ID. Search Enter respects the explicit completed-history opt-in.
- Today and Schedule use the same current-week helper. The explicit all-tasks shortcut clears search/status restrictions while ordinary navigation restores them; focus the task heading and keep the layout preference.
- Integrate these behaviors into the existing owner functions. Do not change persistence or duplicate navigation handlers. Retain the original six tests and Hallmark assertions.

## Direct note editing (Ver.672)

- Business memo and personal sticky notes use the same direct rich-text editor. Selected text changes in place; never show a second preview or hide formatting when typing. Keep all seven existing formatting commands (bold, italic, underline, strike, color, size, clear) and 44px controls. Keep the complete toolbar in the sticky expanded editor; the compact card remains editable and transfers its current selection when expanded.
- Canonical plain text and validated range metadata remain the storage and search contract. The backing textarea is a hidden form/constraint owner only; visible contenteditable has an accessible multiline textbox name and invalid-state/focus mapping. Never persist or render arbitrary HTML. Clipboard text is plain, input limits and IME composition boundaries are preserved, undo/redo restores text and formatting, and the caret remains visible in a scrolling field.
- Preserve per-note revision checks, pending-save handling and all canvas layout operations. Test formatting and typing in the same field, selection, reload, conflict, clipboard, mobile controls, and existing views before release.

## Note formatting visibility and selection (Ver.673)

- Origin may disable synthetic faces for its interface typography, but Japanese italic must remain visible in note text. Scope synthetic style/weight to explicit italic marks in the editable note, memo preview card and reader; specify underline and strike decorations on their semantic marks. Check the rendered CSS and the persisted metadata, not just element presence.
- Keep the text range when opening a toolbar control, even if the native selection collapses during focus transfer. Mouse button activation should not blur the editor; native select and keyboard activation remain available. Restore the saved range after focus events have settled. Genuine new text selection must supersede the toolbar snapshot. Keep the single shared editor and all existing storage contracts.

## Origin note formatting discoverability and heading sizes (planned Ver.674)

- Keep one shared direct editor. Label the centered expanded-edit action "書式" without losing its original icon, keyboard operation, or selection transfer; avoid inserting a permanent full toolbar in every small sticky card.
- Preserve existing size keys and multipliers and add xlarge (150%), xxlarge (175%), huge (200%), display (250%); the metadata stays bounded. Users see explicit percentages. Older cached builds may not understand new keys, so synchronize the release identifier and retain the established plain-text fallback.
- Do not include non-selectable field-title options. Put "文字色" and "文字サイズ" outside the native selects; reflect uniform selected styles, with no selected option and an external mixed-state indication for mixed ranges.
- Group common commands and choices on the same toolbar. Integrate the toolbar into the sticky paper surface with a subtle divider rather than a detached floating white panel; use Origin tokens in memo context and readable light-paper colors in sticky context even in dark mode. Keep 44px controls, focus, selection, and autosave. Verify real selected ranges, mixed/default styles, persisted heading size and colors, 320/1366px geometry and existing regressions.
