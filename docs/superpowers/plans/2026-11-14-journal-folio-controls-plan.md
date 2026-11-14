# JOURNAL Folio Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or the native GitHub connector; test each task before merging.

**Goal:** Deliver a visually calmer, more predictable JOURNAL navigation and control language without changing canonical data flows.
**Architecture:** Keep the original JOURNAL route buttons, canonical selectors and handlers. Refine the source JS only to render the same SVG icons on mobile; replace the existing owner CSS rules in place and centralize motion states in the same stylesheet.
**Tech Stack:** Vanilla JavaScript, CSS, Node Protocol, Playwright, GitHub Actions.
**Spec:** docs/superpowers/specs/2026-11-14-journal-folio-controls-design.md

## Global Constraints
- Only JOURNAL display JS/CSS and its tests; do not change Classic, Origin, Firebase or shared record writers.
- Keep two existing themes Linen / Margin and the five tab routes and tab labels.
- Keep 320/390/768/1366px behavior, keyboard focus, existing form/back behavior and reduced-motion handling.

## Review Focus
1. Narrow 320px dock: all five pages remain independently reachable, no horizontal overflow.
2. 390px phone: selected icon and label are visible and touch targets >=44px.
3. Mouse hover: paper controls provide subtle feedback, with no layout jump / lost active state.
4. Reduced motion: visual state remains clear without animated transform.
5. Preserved filters and controls: Today primary CTA, Atelier controls and Schedule mode/date remain clickable.

## Task 1: Navigation
**Files:** journal-display-v367.js; journal-display-v367.css; test-harness/journal-display-v367.test.mjs; tests/journal-display-v367.spec.mjs
- [ ] Add assertions for mobile SVG in each dock button, active chapter via aria-current, paper design tokens, restrained hover.
- [ ] Verify RED before changing product code.
- [ ] Reuse tabIconV412 for both existing route buttons. Replace original pastel/cutout CSS owner with a quieter chapter design.
- [ ] Verify Protocol and targeted Playwright.

## Task 2: Today/Atelier/Schedule controls
**Files:** journal-display-v367.css; test-harness/journal-display-v367.test.mjs; tests/journal-display-v367.spec.mjs
- [ ] Add checks for min 44px on primary controls and focus-visible, activation on the same canonical selector.
- [ ] Verify RED; refine original CSS owners rather than cloning events or records.
- [ ] Cover hover and reduced-motion, desktop/mobile overflow and state display in Playwright.
- [ ] Verify Protocol and targeted Playwright.

## Task 3: Review and release
- [ ] Review the diff for obsolete styles, JS ownership and regressions.
- [ ] Wait for PR #848 merge; retarget PR on main without losing baseline.
- [ ] Require CI green (Protocol/browser) before merge; verify main SHA.
- [ ] Release the next free version via release contract; require live Pages and post-release regression on the deployed commit.
