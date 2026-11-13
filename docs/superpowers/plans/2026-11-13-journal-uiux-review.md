# JOURNAL UI/UX review implementation plan

**Goal:** Implement the eight findings in the approved JOURNAL_UIUX_Review_20261113.pdf while retaining Linen/Margin paper styling and canonical business operations.
**Architecture:** Edit the existing JOURNAL renderer, composition layer and styles. Presentation-only disclosure state stays local; no new data store, business writer, asset or dependency.
**Spec:** Approved six-page design evaluation supplied in this conversation (Ver.575 baseline); current main Ver.576 also retires Palette and must remain intact.

## Constraints and choices
- Hide the legacy task toolbar outside task pages, preserving the original controls for Classic/Origin.
- One visible primary search. Retain shared keyword semantics between tabs; explicitly label the current target and keyword carryover. Memo index-only and task list-only searches are distinct optional refinements inside disclosures, preserving their existing independent filter semantics.
- Mobile ToDo and memo index use accessible native disclosures with active-condition counts and clear actions outside the closed content. Keep disclosure state across rerendering, and open the full index on desktop.
- Use existing ink/muted color tokens for operational metadata, 12px minimum secondary text, 13px dates and readable mini-calendar dates. Preserve decorative labels separately.
- Task details keep Edit/Complete prominent and group secondary commands on PC as already done on phones. Preserve live buttons and mode restoration.
- Keep the task preview, label it as an overview and make the full-record/comment entry explicit. Do not introduce an unrequested direct-open preference.
- Today shows three prioritized tasks, with the other existing tasks available by expansion; keep schedules available and avoid stretching the adjacent page to match task height. All business data remain available.
- Mobile dock contains the five main pages. Record shelf and settings remain reachable from the existing header.

## Tasks and verification
- [x] Add browser regressions for visible actions/search, phone disclosure/clear/state restoration, metadata, detail controls and five-page navigation; observe failures before implementation.
- [x] Edit app.js and journal-display-v367.js/.css directly; remove superseded CSS and avoid replacement patch files.
- [x] Update release inventory, notes and HTML cache keys together for the next available release.
- [ ] Run new browser cases at 320/390/1366px, existing JOURNAL cases, Protocol, and the repository required CI checks. Report environmental limits or unrelated failures explicitly.
- [ ] Review final diff and restoration to Classic/Origin; publish a PR and merge only after required checks succeed, then verify Pages.

## Review focus
- Japanese IME composition, search text retained across page changes and cleared without clearing independent sort/category state.
- Disclosure state and keyboard focus survive filter rerender; filtered empty states still allow clearing.
- Long titles and large counts at 320px do not overflow or conceal actions behind the dock.
- Secondary detail actions remain operable and return to original DOM on mode exit; comments/status updates still work.
- Memo color, sort, index refinement and canonical category filters retain their independent semantics.
