# Origin — Design system and quality contract

Scope: Origin only (業務管理ボード). Baseline Ver.667; first improvement wave Ver.668, 2026-11-24. Classic and JOURNAL retain their separate identities and existing interfaces.

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

The app is generated in a Shadow DOM. The Hallmark static comparison extracts embedded stylesheet strings via the TypeScript AST, with app scope; this is not a full page audit. Before: 216 FAIL / 838 REFLEX / 17 WARN. After: 176 / 825 / 17. Gate 48 includes host-scoped tokens the scanner does not recognize, and app-specific spacing findings require review. Do not interpret the counts as an accessibility score or waive every remaining issue. Native rendered Hallmark checks and real-screen visual review are not complete. Use synthetic offline rooms for Playwright and never capture production information. See docs/ORIGIN_HALLMARK_AUDIT_V668.md for evidence, test status and next gate.
