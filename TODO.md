# FinFlow to-do list

**Release goal: 1.0.0 — the full FinFlow PWA release.**

Until that milestone is ready, use 0.x.x versions for incremental improvements. FinFlow remains a personal, single-user expense tracker with desktop spending visualizations, fixed LKR, and the existing personal categories. This is a planning checklist; the unchecked items are not implemented yet.

## Completed foundation

- [x] Rebuild FinFlow around Track and Spending.
- [x] Add a large amount keypad and quick category selection.
- [x] Keep the primary phone expense flow visible on the first screen.
- [x] Add category breakdowns, daily spending charts, and monthly navigation.
- [x] Support expense editing, deletion, and undo.
- [x] Preserve personal defaults and migrate existing logged expenses without changing the original saved data.
- [x] Keep the application self-contained in index.html with no runtime dependencies.
- [x] Add regression checks for persistence, totals, migration, storage failures, accessibility, and responsive layouts.

## Before the full release

- [ ] Use the tracker for everyday expenses and record any friction in amount entry, category selection, saving, and editing.
- [ ] Refine phone layouts using actual iPhone and Android devices, including small screens, landscape, safe areas, and the on-screen keyboard.
- [ ] Check desktop spending views with several months of realistic expenses, long notes, and custom categories.
- [ ] Confirm empty months, decimal amounts, month boundaries, and daily-average explanations remain clear.
- [ ] Add a simple local expense backup and restore flow, with validation and protection against accidental replacement of saved expenses.

## PWA — required for 1.0.0

- [ ] Add a web app manifest with FinFlow's name, app ID, theme colors, and standalone display mode.
- [ ] Add app icons, including maskable icons and an Apple touch icon.
- [ ] Set the manifest start URL and scope correctly for the existing /finflow-architect/ GitHub Pages path.
- [ ] Add a service worker that caches the application for offline reopening after an initial successful load.
- [ ] Keep application code in index.html; add only the supporting files needed for installation and offline caching.
- [ ] Add a clear update flow and versioned caches so an installed app receives new releases without losing saved expenses.
- [ ] Verify installation and standalone launch on iPhone, Android, and a supported desktop browser.
- [ ] Verify offline launch after closing and reopening the installed app, plus expense save/edit/delete and persistence while offline.
- [ ] Verify an upgrade from the existing website to the installed PWA keeps same-origin expense data and legacy migration working.
- [ ] Verify cache cleanup and updates never delete financial data or show a mixture of old and new application code.

## 1.0.0 release checklist

- [ ] Complete the tracker polish and PWA requirements above.
- [ ] Run the documented regression suite and manual desktop/phone checks; resolve release-blocking issues.
- [ ] Document installation, offline behavior, updates, local backup/restore, and browser storage limitations in README.md.
- [ ] Update VERSION and all documented release references to 1.0.0, together with any PWA cache version references added during implementation.
- [ ] Commit the release implementation and version change together, then push after verification.
- [ ] Confirm the deployed GitHub Pages app installs, launches offline, and preserves expenses through an update.
