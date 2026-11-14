# JOURNAL Workday Focus Implementation Plan

> **For agentic workers:** Implement tasks in sequence and verify each before release.

**Goal:** Turn JOURNAL Today and Task Atelier into a visually distinct, action-first paper workspace.
**Architecture:** Reuse existing local task state, checklistProgress, urgency helpers, and the canonical task-card / recent-log click handlers. Change the original renderer and adjacent CSS in place; introduce no new persistence or parallel event handler.
**Tech Stack:** Vanilla JavaScript, CSS, Node test harness, Playwright.
**Spec:** docs/superpowers/specs/2026-11-14-journal-workday-focus-design.md

## Global Constraints
- Keep all existing task/navigation/canonical save contracts intact.
- Only JOURNAL display and shared renderer branches guarded by JOURNAL.
- Keep reduced-motion compatibility and 320/390/768/1366 responsive behavior.
- Do not resurrect weekly overview or Palette.

### Task 1: Shared work cue and next step
- [ ] Add a failing Protocol test to test-harness/journal-display-v367.test.mjs for a single `journalWorkCueV591` / `journalWorkNextV591` source.
- [ ] Confirm red in Actions Protocol logs.
- [ ] Implement both helpers in app.js beside JOURNAL Today renderer.
- [ ] Confirm Protocol green.

### Task 2: Today reading hierarchy
- [ ] Add failing Playwright assertions to tests/journal-display-v367.spec.mjs for one featured task, next checklist step, two supporting tasks, responsive geometry and opening the existing task detail.
- [ ] Confirm red.
- [ ] Change journalTodayTaskCardV420 and journalTodayV420 to feature one actionable case and group the remaining records without losing records.
- [ ] Style in journal-display-v367.css directly alongside existing Today styles.
- [ ] Confirm all targeted assertions green.

### Task 3: Atelier reading hierarchy
- [ ] Extend the same browser regression to assert the featured task opens the existing case notebook at desktop/mobile widths.
- [ ] Inject a single featured desk section ahead of existing task islands, respecting active filters and no-task states.
- [ ] Reuse data-j420-log-task click handler, no new listeners.
- [ ] Check horizontal overflow and return/focus behavior.

### Task 4: Delivery
- [ ] Review PR files against scope and old code impact.
- [ ] Run Protocol and JOURNAL Playwright split CI; fix every failure.
- [ ] Merge feature PR with verified GitHub merge SHA.
- [ ] Bump next unclaimed release version and cache keys; merge release PR.
- [ ] Confirm GitHub Pages assets and post-release main regression on identical SHA.
