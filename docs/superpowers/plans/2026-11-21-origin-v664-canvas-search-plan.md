# Origin Ver.664 — UI Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement seven requested Origin sticky and search UI adjustments.
**Architecture:** Preserve sticky note model and storage contract except removing unused arrangement command; fix shadow-root UI regeneration and stage sizing in Origin panel, and adjust only the embedded Origin search panel CSS.
**Tech Stack:** ES modules, Firebase Realtime Database, Playwright, Node test runner.
**Spec:** `docs/superpowers/specs/2026-11-21-origin-v664-canvas-and-search.md`

## Global Constraints
- Do not migrate/overwrite existing note records.
- Default drag remains free; Shift is an opt-in 28px grid mode.
- Keep 1400x900 logical board and 760x720 maximum note size.
- No changes to Classic or JOURNAL.

## Review Focus
- Preserve original window/board scroll on color, resize, front/back, content autosave, fold and remote sync.
- The fitted full-board frame must be centered without feedback loops from ResizeObserver.
- The modal must be centered in the viewport and not inside a zoomed scroll frame.
- Shift drag must not exceed board edges or alter default drag.
- Search kind tabs must remain fully visible at 320/390/1366/1920px.

### Task 1: Reproduce and test UI bugs
- [ ] Add failing browser tests for modal center, board-frame center/size, scroll persistence and modifier grid.
- [ ] Add search tab visibility test.
- [ ] Run PR checks and verify the expected failures before implementation.

### Task 2: Fix Origin canvas and scrolling
- [ ] Update `origin-personal-sticky-v659.js` stage-scale calculation from stable parent width/viewport height.
- [ ] Center actual display frame and modal without changing data/board coordinate system.
- [ ] Capture and restore scroll/focus around same-page reactive redraws.
- [ ] Add Shift snap and UX hint. Verify targeted tests.

### Task 3: Remove obsolete auto-arrange
- [ ] Remove UI button/handler/style/flag, core planner, store command/transaction and only arrangement-specific tests.
- [ ] Preserve unrelated mobile list rearrangement.
- [ ] Remove unnecessary disclosure paragraph only from the sticky UI.
- [ ] Confirm no residual `sticky.arrange` references.

### Task 4: Cross-search width and release
- [ ] Resize global search popup and wrap kind tabs in `origin-modern-v372.js`.
- [ ] Bump cache tags and manifest to Ver.664 without changing shared functionality.
- [ ] Run Protocol/authorization/Firebase/Playwright; review diff, merge and verify public Pages.
