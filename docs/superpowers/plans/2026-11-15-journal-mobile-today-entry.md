# JOURNAL mobile: today's plan shortcut (2026-11-15)

## Goal
On narrow screens, when the selected week contains today and today has appointments, reach today's appointments without scrolling through up to six earlier empty days. Keep the paper-notebook aesthetic and the full chronological week view intact.

## Evidence
Synthetic JOURNAL Ver.597 capture with six tasks and two appointments on Sunday 2026-11-15 showed six earlier empty dates ahead of the appointments in the 390px weekly view. The appointments were accessible but substantially below the first viewport. No horizontal overflow was measured at 320/390/768/1366.

## Scope
- Existing files only: `app.js`, `journal-display-v367.css`, `tests/journal-display-v367.spec.mjs`.
- One conditional read-only prompt on the week's mobile planner. No new record, database field, duplicate appointment list, or save routine.
- If the selected week includes today AND the current filtered records have today's appointments, display the number and one short summary. Otherwise render no shortcut.
- One button switches to the existing day view anchored to today; preserve filters, search, and the existing focus/scroll restoration pathway.
- Keep the original week, month, list and date controls. Do not alter Origin, Classic, Firebase or shared persistence.

## UI decisions
- Compact sage bookmark strip between the datebar and weekly day slips, using existing palette and 44px touch action.
- Distinguish the existing datebar “今日” (return to the current date in the same mode) from “今日の予定を見る” (open daily view).
- Hide the strip on desktop, on noncurrent weeks, in modes other than week, and when today has no appointments.

## Test first, then implement
1. Add Playwright test for 320px / 390px with two synthetic appointments on today: shortcut visible, count/title presented, action opens the existing day view, week-return still works, no horizontal overflow.
2. Add test for empty today and for a noncurrent week, plus desktop hidden state.
3. Verify tests fail on baseline before implementation, then pass after minimal source/CSS change.
4. Run full Protocol, permissions, Firebase Emulator and Playwright regression as a PR. Check the actual run SHA and main merge compatibility.
5. If tests are green, merge the JOURNAL change only. Release with the next available version (Ver.598 unless a parallel PR claims it), and verify GitHub Pages + full postrelease checks.

## Risks
- A common schedule refresh could discard a draft or focus; reuse `refreshJournalNavigationV582` and the one existing mode state.
- The current week may be filtered; derive count and preview from `targetToday` already filtered by the same category and global schedule filters.
- Navigating to earlier weeks must not expose today's shortcut.
