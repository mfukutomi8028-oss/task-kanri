# Palette UI/UX Design v1
Updated: 2026-11-04. Design-only artifact for independent Palette display mode.

## Goal
A playful but efficient UI, distinct from Classic and Modern. Compact, readable, quick everyday operations. Do not alter data schema, Firebase security rules, existing Classic/Modern behavior, or production deployment in the design phase.

## Current repository observations
- At inspection, release-manifest.js version=356 and patch-responsibilities.json baselineRelease=356.
- modern-display-v356.js uses Classic DOM as the single source of actions/data and offers classic/modern, persisted by room and user.
- index.html contains Today, ToDo, task board/list/timeline, schedule, detail and dashboard.
- Existing color-themes-v329.js provides Classic theme options.
- README warns that sensitive personal/medical data must not be stored under currently documented permissions.

## Desktop layout
- Persistent compact left navigation: Today, ToDo, Tasks, Schedule, Memos, My tasks, Star, Completed.
- Top bar: search, notifications, quick create, account.
- Today page: concise header and compact summary strip; task priority list and ToDo; sidebar with daily schedule, announcements, memos.
- Task page: list default, optional board/timeline, filters/sorting and bulk operations.
- Detail editing: reuse existing task/calendar dialogs or introduce a non-destructive detail drawer after verifying lifecycle.

## Mobile layout
- Bottom five tabs: Today / ToDo / Tasks / Schedule / More.
- Visible add action above tab bar. Other features via More/contextual links.
- Cards stack vertically. Filters are collapsible. Avoid horizontal scrolling and oversized cards.

## Design tokens
- Light: background #F6F5FA, surface #FFFFFF, text #2C2A3F, border #E9E6EF.
- Lavender accent #7355CD, soft #F0EAFF; optional mint/peach accent variants.
- Dark: background #191A26, surface #242636, text #F3F0FA, border #3B3D50.
- Severity state colors remain semantic and independent of chosen accent.
- Prefer 14-16px readable content; adequate focus indicators and touch targets.
- Theme switches must affect all decorative surfaces, not only headers.

## Functional preservation
| Existing feature | Palette entry | Contract |
| --- | --- | --- |
| Today/summary | Today | Same aggregation/filter semantics |
| Personal ToDo/history | Today, ToDo | Same completion/history/sync |
| Tasks | Task list/board/timeline | Same create/edit/delete/state/assignee/category/dates/star/pin/bulk |
| Schedule | Schedule | Preserve repetition/copy/reminder/task links |
| Work memos | Today preview, Memos | Preserve categories, scrollable detail, edit |
| Announcements/notifications | Today sidebar, bell | Preserve read state, comments, mentions, reactions |
| Identity/room/preferences | Settings | Room/user-level preference and synchronization remain |
| Offline/conflict behavior | All | Reuse existing write paths, never a second Firebase writer |

## Recommended implementation
1. Develop in separate feature branch from a freshly reviewed main head, not this design-only branch if the baseline has moved.
2. Introduce Palette as a third setting to existing display selector, maintaining saved choices and safe fallback.
3. Implement Palette CSS tokens and isolated shell; ensure Classic and Modern remain unchanged.
4. Wire Today, ToDo, Tasks, Schedule, Memos, Notifications sequentially to existing actions and data.
5. Verify desktop 1366x768 and mobile 390px, light/dark, long text, modal/focus, sync/competition, offline, regression.
6. PR and controlled merge only after coordination with simultaneous Modern development.

## Prototype artifact
A standalone HTML demo is provided in this conversation as Palette_UI_Prototype_v1.html, with fictitious sample data only. It is not a production frontend; its create/complete/search/theme interactions are temporary and not persisted.

## Progress
Design plan committed only. No change to main, production Firebase, or published application.
