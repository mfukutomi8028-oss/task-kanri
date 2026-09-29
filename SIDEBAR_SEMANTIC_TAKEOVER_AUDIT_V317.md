# Ver.317 Desktop Sidebar Semantic Takeover Audit

## Baseline

- Base: Ver.316 main `f640558a3155683ca9dd161388576930572c3df0`
- Product release / responsibility baseline: `278`
- Primary target: `desktop-sidebar-v242.js`
- Related dynamic navigation owner: `work-features-v167.js`
- Product runtime is not changed in this audit.

## Purpose

Ver.290 left the preserved V158 core as the sole desktop sidebar state owner. That core still does more than desktop presentation/state: `labelNavigationButtons()` reads navigation text and writes `data-desktop-sidebar-label`, `title`, and `aria-label` onto `.nav-item` elements during startup.

Ver.317 audits whether that semantic decoration is still a real desktop-sidebar responsibility or a historical takeover that can be retired without weakening navigation, accessibility, or the 860/861px desktop/mobile boundary.

## Current ownership

### Static navigation

The base HTML already gives the core navigation buttons visible text such as `今日`, `ToDo`, `タスク`, and `スケジュール`. Native button accessible names therefore exist independently of V158's added `aria-label`.

At desktop-sidebar startup, `labelNavigationButtons()` additionally:

1. copies the current text into `data-desktop-sidebar-label`;
2. sets `title` when one is absent;
3. sets `aria-label` when one is absent.

The active sidebar CSS does not consume `data-desktop-sidebar-label`.

### Dynamic Work Memo navigation

`work-features-v167.js` creates the `業務メモ` navigation button after the canonical schedule button. It supplies visible text and an icon with empty `alt`, but it does not add the V158 dataset/title/ARIA decoration.

That means the current semantic takeover is already partial: the later dynamic navigation item functions without those attributes and obtains its accessible name from its own visible text.

## Browser evidence required

The audit must establish both baseline behavior and a test-only candidate where the startup call to `labelNavigationButtons()` is suppressed while all other V158 behavior is untouched.

1. Baseline static navigation receives the three V158 decorations.
2. The dynamic Work Memo navigation remains undecorated yet exposes the accessible name `業務メモ`.
3. With the semantic startup call suppressed, static buttons expose their existing text names through the accessibility tree without `data-desktop-sidebar-label`, `title`, or `aria-label`.
4. Collapsed desktop state, pointer expansion, keyboard focus expansion, Escape collapse, and navigation remain functional under the candidate.
5. Work Memo remains discoverable by accessible name and still enters the memo view under the candidate.
6. The candidate preserves the 861 -> 860 -> 861 desktop/mobile state boundary.
7. Product `desktop-sidebar-v242.js`, release manifest, Firebase paths, and business-data flows remain unchanged in Ver.317.

## Decision gate

If the test-only suppression preserves all required behavior above, treat the whole `labelNavigationButtons()` startup responsibility as a Ver.318 product-removal candidate rather than moving its generated semantics to another global owner.

This is preferable to duplicating the old takeover elsewhere because:

- native button text already owns the accessible name;
- pointer/focus interaction expands the sidebar and reveals the visible label;
- the dynamic Work Memo button already proves the navigation contract does not require V158 decoration;
- `data-desktop-sidebar-label` has no active CSS consumer.

If suppression breaks an actual user-facing navigation or accessibility path, retain the minimum proven responsibility only. Do not preserve generated attributes solely because older regression tests asserted their existence.

## Preserved boundaries

- `desktop-sidebar-v242.js` is unchanged in Ver.317.
- `work-features-v167.js` is unchanged in Ver.317.
- `release-manifest.js` remains release `278`.
- Firebase, task/ToDo/schedule/memo persistence, and canonical renderers are unchanged.
- Pin persistence, hover/focus/drag behavior, pageshow correction, and mobile handoff remain owned by their current runtime.
