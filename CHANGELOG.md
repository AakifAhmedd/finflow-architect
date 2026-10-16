# FinFlow change summary

## 1.0.1 — 2026-10-16

- Refresh the README: document Reset local data and correct the stale release-line note.

## 1.0.0 — 2026-10-15

- Add an installable manifest, FinFlow app icons, Apple Home Screen metadata, and scoped offline caching.
- Add Settings installation help, offline readiness, update checks, and explicit update/reload with draft warnings.
- Keep working downloads on failure, validate matching release files, preserve financial data/credentials, and isolate cache cleanup from other apps.
- Add recurring income with first dates, month-end handling, catch-up, edit/stop/Undo, and deletion-safe monthly IDs.
- Preserve backup/Gist compatibility through additive monthly income rules; document installation, storage limitations, and device acceptance checks.
- Add HTTP PWA and recurring-income regression suites alongside the existing tracker checks.

## 0.9.1 — 2026-10-15

Removed the obsolete October 2 review report and its five screenshots from the repository; future `dogfood-output/` artifacts are ignored. The application, development dependencies, regression suites, roadmap, and migration code remain needed. Changes since that review of commit `f64e319`:

- The legacy stored-XSS and misleading plan-based metrics were corrected in `74250f6` before the tracker rebuild; current user text is escaped or rendered as text.
- The rebuild replaced Flow Builder, plan/actual Sankey, legacy Analysis, CSV tools, and theme controls; findings specific to those removed screens no longer apply to the active app.
- Amounts now use integer cents and display decimal precision, replacing the old asymmetric whole-rupee rounding.
- Spending uses the selected month's logged expenses, with explicit empty states, named month controls, and text alternatives for the current charts.
- Phone entry now progresses from a large green amount keypad to category and subcategory selection, with live thousands separators and keyboard focus retained alongside cleaner touch feedback.
- Six generic main categories and editable subcategories/icons replaced branded choices; monthly schedules support catch-up, and destructive actions require confirmation.
- Manual Gist sync now validates previews and replacements, keeps remembered credentials outside financial backups, and has dedicated mocked regression coverage; the old review did not exercise sync.
- Received income, separate cash movements, validated JSON imports with deduplication, and local backup/restore were added in 0.9.0; Sankey, installable PWA support, and device SMS ingestion remain future work.
