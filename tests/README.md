# FinFlow regression checks

The ground-up 0.0.0 rebuild replaces the previous flow-builder and subscription checks with tests of the active expense tracker and spending views. The existing dev-only dependency, `puppeteer-core`, is unchanged.

## Running

```sh
npm install
npm test
```

This runs `node tests/regression.js`, `node tests/regression-a11y-colour.js`, `node tests/categories.js`, `node tests/monthly.js`, `node tests/settings.js`, and `node tests/confirmations.js`. All six resolve `index.html` relative to the repository, open it using `file://`, and use isolated Chrome browser contexts. No server, network access, backend, build, or real financial data is needed.

The default Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set the `CHROME` environment variable for a different executable. Browser dates use Asia/Colombo.

## Coverage

- Baseline version consistency; default categories and honest empty states.
- The default eight main categories and all 32 generic subcategory choices, Back navigation, selection highlight, Save gating, and both classification fields in storage.
- Large keypad, keyboard entry, decimal precision, input validation, optional notes/date, and historical expenses.
- Save/reload persistence, integer-cent totals, category filtering, monthly navigation, editing, deletion, and undo.
- Legacy migration, migration from the flat tracker registry, retained prior classifications, deletion tombstones, idempotence, original-data preservation, and unreadable data.
- Stored XSS protection in notes/categories; browser storage failures and conflicting writes in another tab.
- Monthly setup, future start dates, leap/non-leap short months, missed-month catch-up, deduplication, edit/stop/undo, individual charge deletion, atomic storage recovery, inert names, older-data migration, and phone management layouts.
- Settings navigation, category/subcategory add/rename/remove/restore, custom names/icons, subscription defaults, behavior persistence, startup view, category memory, and reduced motion.
- Previous branded hierarchy and monthly-rule migration; malformed custom settings remain protected.
- Mocked Gist origin validation, tab-only credentials, read-only preview, confirmation/cancel, validated restore/Undo, upload whitelisting, unrelated-file preservation, public/truncated/malformed payload rejection, changed local/remote snapshots, disconnect, and network failure. Tests make no real GitHub requests.
- Default entry stays above navigation in both picker steps at 390 × 740/844, 393 × 852, 412 × 823, 414 × 896, 430 × 932, and 360 × 800, without scrolling and with 44 px keypad targets, plus a simulated 34 px bottom safe area at 390 × 740.
- Shared destructive warnings: deletion, stopping/removal, Gist disconnect/change/replacement, and monthly-posting pause. Cancel/Enter/Escape preservation, nested-dialog focus, single execution, async busy state, stored XSS, phone/desktop sizing, failed saves, and stale-tab protection.
- Offline operation, named controls, chart text alternatives, dialog keyboard behavior, reduced motion, and touch targets.
- Tracker and spending layouts at 320, 360, 390, 760, 768, 1024, and 1440 px, including overflow checks and Save visibility after subcategory selection on a 390 × 844 phone.

Tests also write populated desktop and phone review screenshots to `/tmp/finflow-{desktop,phone}-{track,spending}.png`. Category checks also capture both selection steps in `/tmp/finflow-phone-{categories,subcategories}.png`. Fixtures are isolated from your actual browser profile and are never shipped in the app.

## Manual release checks

1. On a phone-sized screen, add an expense with the keypad, a main category, and a subcategory. Try Back and change the category; Save should stay disabled until a subcategory is chosen. Add a decimal amount with an optional note. Confirm the saved total and cleared form. Scroll to recent expenses and switch views using the bottom navigation.
2. On desktop, open Spending. Compare category amounts and daily bar totals with the expense list. Select a main category, verify its subcategory totals, and clear the filter. Switch to an empty month and back.
3. Open an expense, edit it, delete it after confirming the warning, and undo. Close the dialog with Escape. Check keyboard focus and narrow-screen wrapping.
4. Reload and verify persistence. Disconnect the network; tracking, spending, categories, and behavior settings should still work. Gist actions require a connection. Inspect rendered desktop and phone screenshots for clipped text, awkward spacing, or controls covered by navigation.
5. Set up a named monthly expense from Add details, choose its first charge date, and verify its next date in Monthly expenses. Open a posted charge, then manage its schedule. Change the amount/day, stop it after confirming the warning, and undo; past charges should remain intact.
6. Open Settings on phone and desktop. Rename/add/remove/restore a category and subcategory, check the picker and past analytics, and verify affected monthly rules stop. Set a subscription default and save a named monthly rule; turn Repeat monthly off for a one-off expense. Change startup view, remember-category, reduced-motion, and monthly-posting preferences; reload and confirm behavior. Try long labels and built-in icon overrides.
7. Review the entry form at the common large-phone sizes above, both main and subcategory steps. Verify the full keypad, choices, details summary and Save sit above navigation with scrollY = 0. Very small/short screens, large accessibility text, extra custom choices and expanded details may scroll. Verify actual-device safe areas and keyboard behavior before 1.0.0.
8. Gist tests use a local mock, not personal data or credentials. For an optional live release smoke check, use a disposable secret Gist and synthetic expenses: save connection, preview, cancel/confirm upload, preview/restore/Undo, disconnect, then remove the disposable remote data yourself. Confirm token fields are empty after save/reload and secrets are absent from storage/backups. No live upload is part of the automated suite.
9. Try every destructive action. Verify a consistent warning appears before a change; Cancel and Escape must preserve data and return focus. Confirm the action, check its stated effect and Undo where available. Gist warnings require the local mock or a disposable connection. Inspect `/tmp/finflow-{phone,desktop}-confirmation.png`.
10. Run `git diff --check` and confirm all release version references agree before committing/pushing.

Settings review screenshots are written to `/tmp/finflow-{desktop,phone}-settings.png`; the compact first screen is `/tmp/finflow-phone-entry-0.3.png`. SMS ingestion remains roadmap-only and has no permission or parsing code in this release.
