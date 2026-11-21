# Origin Sticky Focus, Fold and Arrange Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all previously approved high/medium priority improvements for Origin personal sticky notes.
**Architecture:** Keep domain validation/planning in core, atomic layout command and device-only collapse preferences in store, UI controls/dialog in Origin. No rewrite of existing note content or shared schema.
**Tech Stack:** Plain ES modules, Firebase Realtime Database transactions, Node test runner, Playwright Chromium.
**Spec:** `docs/superpowers/specs/2026-11-21-origin-sticky-focus-fold-arrange-design.md`

## Global Constraints
- Legacy notes, 5 pages, text limit 2000, no new authentication, Classic/JOURNAL unchanged.
- Initial dimensions 280x220, minimum 220x160, new maximum 760x720, board 1400x900.
- No silent partial writes when arranging.
- Do not store collapse state in Firebase.
- Use the repo's existing asset versioning for Ver.663.

## Review Focus
- Mouse resize near canvas edge must preserve logical dimensions and fit inside board.
- Modal close with pending Japanese IME/autosave must not lose content.
- View-only collapse must be isolated by selected user and room.
- Concurrent layout writes vs. arrange must be atomic.
- Mobile controls must retain 44px touch targets and avoid horizontal scroll.

### Task 1: Core limits and layout planner
**Files:** `personal-sticky-core-v659.js`, `tests/personal-sticky-core.test.mjs`
- [ ] Write RED tests: 760×720 is valid; 761×720/760×721 invalid; stable page-specific rectangle packing; insufficient space returns null.
- [ ] Observe expected RED and implement exported `planStickyArrangement(notes,page)`.
- [ ] Run core tests; verify no migration of 480px notes.

### Task 2: Atomic persistence and collapse preferences
**Files:** `personal-sticky-store-v659.js`, `tests/personal-sticky-store.test.mjs`
- [ ] Write RED tests: local and remote `sticky.arrange` modifies only x/y for current page; conflicts/overflow abort all; collapsed IDs survive reload but do not touch Firebase.
- [ ] Implement collection transaction with revision preflight; local-only atomic JSON save; `readCollapsedNotes()` and `saveCollapsedNotes(ids)` scoped to owner.
- [ ] Test storage and Firebase Emulator using synthetic room/user.

### Task 3: Origin desktop and mobile controls
**Files:** `origin-personal-sticky-v659.js`, `tests/origin-personal-sticky.spec.mjs`
- [ ] Write RED Playwright scenarios for 760x720 resizing, expanded editor content save+close, fold/unfold, arranging, and no-space.
- [ ] Add accessible header buttons, dialog with existing text autosave delegation, fold class, toolbar arrangement action.
- [ ] Avoid changing sticky schema, existing search filters, toolbars, palette and 5-page behavior.
- [ ] Run Playwright targeted tests and full regression.

### Task 4: Release and verify
**Files:** `release-manifest.js`, `index.html`, `patch-responsibilities.json`, `release-notes.md`
- [ ] Update caches/version to 663.
- [ ] Protocol/authorization/Firebase Emulator/Playwright all pass.
- [ ] Review diff for stale UI code and call sites, merge PR only after green.
- [ ] Confirm GitHub Pages publication and post-merge regression.