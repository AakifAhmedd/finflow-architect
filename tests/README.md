# FinFlow regression checks

The ground-up 0.0.0 rebuild replaces the previous flow-builder and subscription checks with tests of the active expense tracker and spending views. The existing dev-only dependency, `puppeteer-core`, is unchanged.

## Running

```sh
npm install
npm test
```

This runs `node tests/regression.js`, `node tests/regression-a11y-colour.js`, `node tests/categories.js`, and `node tests/monthly.js`. All four resolve `index.html` relative to the repository, open it using `file://`, and use isolated Chrome browser contexts. No server, network access, backend, build, or real financial data is needed.

The default Chrome path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Set the `CHROME` environment variable for a different executable. Browser dates use Asia/Colombo.

## Coverage

- Baseline version consistency; default categories and honest empty states.
- Exactly eight main categories and all 32 specified subcategory choices, Back navigation, selection highlight, Save gating, and both classification fields in storage.
- Large keypad, keyboard entry, decimal precision, input validation, optional notes/date, and historical expenses.
- Save/reload persistence, integer-cent totals, category filtering, monthly navigation, editing, deletion, and undo.
- Legacy migration, migration from the flat tracker registry, retained prior classifications, deletion tombstones, idempotence, original-data preservation, and unreadable data.
- Stored XSS protection in notes/categories; browser storage failures and conflicting writes in another tab.
- Monthly setup, future start dates, leap/non-leap short months, missed-month catch-up, deduplication, edit/stop/undo, individual charge deletion, atomic storage recovery, inert names, older-data migration, and phone management layouts.
- Offline operation, named controls, chart text alternatives, dialog keyboard behavior, reduced motion, and touch targets.
- Tracker and spending layouts at 320, 360, 390, 760, 768, 1024, and 1440 px, including overflow checks and Save visibility after subcategory selection on a 390 × 844 phone.

Tests also write populated desktop and phone review screenshots to `/tmp/finflow-{desktop,phone}-{track,spending}.png`. Category checks also capture both selection steps in `/tmp/finflow-phone-{categories,subcategories}.png`. Fixtures are isolated from your actual browser profile and are never shipped in the app.

## Manual release checks

1. On a phone-sized screen, add an expense with the keypad, a main category, and a subcategory. Try Back and change the category; Save should stay disabled until a subcategory is chosen. Add a decimal amount with an optional note. Confirm the saved total and cleared form. Scroll to recent expenses and switch views using the bottom navigation.
2. On desktop, open Spending. Compare category amounts and daily bar totals with the expense list. Select a main category, verify its subcategory totals, and clear the filter. Switch to an empty month and back.
3. Open an expense, edit it, delete it, and undo. Close the dialog with Escape. Check keyboard focus and narrow-screen wrapping.
4. Reload and verify persistence. Disconnect the network; all features should still work. Inspect rendered desktop and phone screenshots for clipped text, awkward spacing, or controls covered by navigation.
5. Set up a named monthly expense from Add details, choose its first charge date, and verify its next date in Monthly expenses. Open a posted charge, then manage its schedule. Change the amount/day, stop it, and undo; past charges should remain intact.
6. Run `git diff --check` and confirm all release version references agree before committing/pushing.
