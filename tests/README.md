# FinFlow regression checks

The ground-up 0.0.0 rebuild replaces the previous flow-builder and subscription checks with tests of the active expense tracker and spending views. The existing dev-only dependency, `puppeteer-core`, is unchanged.

## Running

```sh
npm install
npm test
```

This runs `node tests/regression.js`, `node tests/regression-a11y-colour.js`, `node tests/categories.js`, `node tests/monthly.js`, `node tests/settings.js`, `node tests/confirmations.js`, `node tests/mobile-tracking.js`, `node tests/taxonomy.js`, `node tests/gist-setup.js`, and `node tests/gist-credentials.js`. All ten resolve `index.html` relative to the repository, open it using `file://`, and use isolated Chrome browser contexts. No server, network access, backend, build, or real financial data is needed.

The default Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set the `CHROME` environment variable for a different executable. Browser dates use Asia/Colombo.

## Coverage

- Baseline version consistency; default categories and honest empty states.
- The default six main categories and all 31 stored classification choices, Back navigation, selection highlight, Save gating, and both classification fields in storage.
- Large keypad, keyboard entry, decimal precision, input validation, optional notes/date, and historical expenses.
- Save/reload persistence, integer-cent totals, category filtering, monthly navigation, editing, deletion, and undo.
- Six-category migration: precise/ambiguous splits, Personal merging, custom registries/collisions, old removals/icons/subscription defaults, active/stopped monthly schedules, full prior metadata, Gist round-trip, idempotence, invalid input, and failed saves. Direct Other supports notes, editing, switching categories, reset, remembered-category behavior, and customized subcategories.
- Legacy migration, migration from the flat tracker registry, retained prior classifications, deletion tombstones, idempotence, original-data preservation, and unreadable data.
- Stored XSS protection in notes/categories; browser storage failures and conflicting writes in another tab.
- Monthly setup, future start dates, leap/non-leap short months, missed-month catch-up, deduplication, edit/stop/undo, individual charge deletion, atomic storage recovery, inert names, older-data migration, and phone management layouts.
- Settings navigation, category/subcategory add/rename/remove/restore, custom names/icons, subscription defaults, behavior persistence, startup view, category memory, and reduced motion.
- Previous branded hierarchy and monthly-rule migration; malformed custom settings remain protected.
- First-time Gist setup: token-only secret creation named finflow-data; RACK isolation; paginated discovery/reconnection; duplicate/incomplete/invalid matches; single in-progress execution; concurrent expense preservation; permissions/network failures; uncertain creation recovery; storage failure/ID recovery; stale snapshots; Unicode size limits; phone/desktop layouts. All API calls are mocked.
- Remembered device credentials: reload/new-tab authentication, masked input, independent browser profiles, backup/restore/Undo exclusion, confirmed disconnect and RACK key preservation, ID binding, token replacement, failed writes/rollback/removal/retry, malformed records, and cross-tab preview invalidation. Review `/tmp/finflow-{phone,desktop}-remembered-token.png`; credentials are synthetic.
- Mocked Gist origin validation, device-only credential persistence, read-only preview, confirmation/cancel, validated restore/Undo, upload whitelisting, unrelated-file preservation, public/truncated/malformed payload rejection, changed local/remote snapshots, disconnect, and network failure. Tests make no real GitHub requests.
- The amount keypad and default six-category entry stay above navigation in each separate stage at 390 × 740/844, 393 × 852, 412 × 823, 414 × 896, 430 × 932, and 360 × 800, without scrolling and with larger keypad targets, plus a simulated 34 px bottom safe area at 390 × 740.
- Shared destructive warnings: deletion, stopping/removal, Gist disconnect/change/replacement, and monthly-posting pause. Cancel/Enter/Escape preservation, nested-dialog focus, single execution, async busy state, stored XSS, phone/desktop sizing, failed saves, and stale-tab protection.
- Staged phone Tracks: amount-only first screen, validation and Enter progression without saving, category/subcategory selection, Edit amount/Back draft preservation, larger controls, sticky actions and changing safe areas, the 768 px boundary, responsive monthly-card placement, reset/brief toast/next entry, focus return, remembered categories, Spending review/edit/cancel, and small-screen/expanded-details scrolling.
- Offline operation, named controls, chart text alternatives, dialog keyboard behavior, reduced motion, and touch targets. The green phone amount palette checks text contrast (at least 4.5:1) and restores the light palette/theme color on category selection, other views, and desktop widths.
- Tracker and spending layouts at 320, 360, 390, 760, 768, 1024, and 1440 px, including overflow checks and Save visibility after subcategory selection on a 390 × 844 phone.

Tests also write populated desktop and phone review screenshots to `/tmp/finflow-{desktop,phone}-{track,spending}.png`. Category checks also capture both selection steps in `/tmp/finflow-phone-{categories,subcategories}.png`. Fixtures are isolated from your actual browser profile and are never shipped in the app.

## Manual release checks

1. On a phone-sized screen, enter an amount with the keypad. Only the keypad and Choose category should appear. Choose category or Enter advances without saving and replaces the keypad with main categories. Select a main category and subcategory; Save stays disabled until classification is complete. Use Back to change the category, and Edit amount to adjust the amount; notes, date, and selection must survive amount edits. Save a decimal amount with an optional note; confirm the total, cleared form, and return to the amount screen. Tracks shows only entry below 768 px, with actions fixed above navigation and no scrolling at common phone sizes. Review in Spending; edit an expense through the amount stage and verify its prior details/classification remain selected. Desktop Tracks keeps simultaneous entry, summary, and recent list.
2. On desktop, open Spending. Compare category amounts and daily bar totals with the expense list. Select a main category, verify its subcategory totals, and clear the filter. Switch to an empty month and back.
3. Open an expense, edit it, delete it after confirming the warning, and undo. Close the dialog with Escape. Check keyboard focus and narrow-screen wrapping.
4. Reload and verify persistence. Disconnect the network; tracking, spending, categories, and behavior settings should still work. Gist actions require a connection. Inspect rendered desktop and phone screenshots for clipped text, awkward spacing, or controls covered by navigation.
5. Set up a named monthly expense from Add details, choose its first charge date, and verify its next date in Monthly expenses (Spending on phones, Tracks on desktop). Open a posted charge, then manage its schedule. Change the amount/day, stop it after confirming the warning, and undo; past charges should remain intact.
6. Open Settings on phone and desktop. Rename/add/remove/restore a category and subcategory, check the picker and past analytics, and verify affected monthly rules stop. Set a subscription default and save a named monthly rule; turn Repeat monthly off for a one-off expense. Change startup view, remember-category, reduced-motion, and monthly-posting preferences; reload and confirm behavior. Try long labels and built-in icon overrides.
7. Review amount, category, and subcategory stages at the common large-phone sizes above. Verify each visible set of controls sits above navigation with scrollY = 0, including a selected subcategory and collapsed details. Review `/tmp/finflow-phone-staged-{amount,categories,subcategories}.png`. The amount stage should fill the screen in dark green with soft green keys, white numbers, and a pale green continue action; category/subcategory selection, Spending, Settings, and desktop should retain their light palette. Check disabled actions, errors, focus outlines, and browser theme color. Very small/short screens, large accessibility text, extra custom choices and expanded details may scroll. Verify actual-device safe areas and keyboard behavior before 1.0.0.
8. Gist tests use a local mock, not personal data or credentials. For an optional live release smoke check, use a disposable secret Gist and synthetic expenses: leave the ID blank to discover/create finflow-data, verify its ID and separate RACK data, preview, cancel/confirm upload, preview/restore/Undo, disconnect, then remove the disposable remote data yourself. Confirm the token stays masked after save/reload, lives only in the separate device credential record, and is absent from financial storage/backups. Disconnect must remove that credential record. No live creation or upload is part of the automated suite. Creation review screenshots are `/tmp/finflow-{phone,desktop}-gist-setup.png`.
9. Try every destructive action. Verify a consistent warning appears before a change; Cancel and Escape must preserve data and return focus. Confirm the action, check its stated effect and Undo where available. Gist warnings require the local mock or a disposable connection. Inspect `/tmp/finflow-{phone,desktop}-confirmation.png`.
10. Run `git diff --check` and confirm all release version references agree before committing/pushing.

Settings review screenshots are written to `/tmp/finflow-{desktop,phone}-settings.png`; the compact first screen is `/tmp/finflow-phone-entry-0.3.png`. SMS ingestion remains roadmap-only and has no permission or parsing code in this release.
