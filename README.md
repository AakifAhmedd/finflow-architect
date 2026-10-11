# FinFlow

A personal finance app for quickly logging expenses and understanding where money went. **Track first, visualize second.** Current version: **0.3.1**.

[Open FinFlow](https://aakifahmedd.github.io/finflow-architect/)

See [the to-do list](TODO.md) for the roadmap to **1.0.0**, the full PWA release.

## Use

Open `index.html` directly, or serve it with any static server. The entire app is in one HTML file, with no build step, runtime dependencies, fonts, CDN requests, or network requirement.

- **Tracks:** enter an amount with the large keypad, choose a main category, select its subcategory (including Other), and save. Use Back to change the main category. Optionally add a note or change the date. Keyboard entry and decimal amounts are supported. Recent expenses and monthly spending sit alongside the form on desktop and below it on mobile.
- **Monthly expenses:** expand Add details, enable Repeat monthly, name the expense (Google One or YouTube, for example), and choose its first charge date. FinFlow logs a charge on that day each month, using the last day for shorter months. Future first-charge dates are supported. Manage or stop a schedule from the Monthly expenses card; changing a schedule affects future charges, and stopping keeps past expenses. Individual logged charges can still be edited/deleted without changing the schedule.
- **Spending:** switch months, compare total spending with the previous full month, view category shares and daily totals, and select a category to filter its expenses. Daily average includes every calendar day in the month, or days elapsed so far for the current month. Selecting a main category also shows its subcategory totals. Each chart has a text alternative; exact expenses remain available below it.
- **Settings:** add, rename, remove, or restore categories/subcategories; choose built-in icons; mark subscription subcategories; configure manual GitHub Gist sync; choose the startup view, remembered main category, reduced motion, and automatic monthly posting. The eight original main categories and their icons remain the defaults. Subscription choices preselect Repeat monthly on new entry; you can turn it off for an individual purchase. Marking a choice does not create schedules or alter existing expenses.
- **Compact phone entry:** the default eight-category picker, keypad, collapsed details, and Save fit without scrolling on common large-phone viewports. Expanded optional details, the software keyboard, large text, many custom categories, and very small/short screens can require scrolling. Touch targets remain at least 44 px. Both category steps stay compact.
- **Action warnings:** expense deletion, category/subcategory removal, stopping monthly schedules, disconnecting/changing a Gist connection, replacing either Gist snapshot, and pausing automatic monthly logging all use the same confirmation dialog. Read the impact, then choose Cancel or the named action. Cancel and Escape leave the action unapplied; Cancel receives initial focus. Data changes while a warning is open block the action until you review again.
- Open any expense to edit or delete it. Saved additions, edits, and deletions can be undone with the toast's Undo button or Ctrl/Cmd+Z outside text inputs. Undo covers the most recent change in the current session.

This remains a private, single-user tool. Currency is fixed at **LKR**. Its eight personal main categories are Transport & Vehicles, Food & Dining, Fitness & Health, Pets, Housing & Living, Tech & Subscriptions, Lifestyle & Social, and Professional & Community. The defaults retain three specific subcategories and Other, using generic picker labels. Settings can customize these choices. There are no accounts, sharing, onboarding, generic templates, or currency controls.

## Data

Expenses are stored in this browser's localStorage under `finflow_tracker_v1`. Amounts use integer cents to avoid floating-point aggregation errors. Reloads keep your expenses; different browsers/devices and origins have separate data. Clearing browser site data removes it. Browser storage is local, not encrypted.

Monthly rules live in the same browser storage. Due charges are added on opening/returning to FinFlow, and while the app remains open; missed months are caught up. A closed app does not run background jobs. Each schedule has a deterministic charge ID per month and an atomic posting cursor, so reloads do not duplicate charges and deleted charges are not recreated. Future scheduled amounts are excluded from actual-spending analytics until due. Automatic catch-up clears session Undo to protect newly posted charges.

Category customization is additive in schema 1. Removing a category or subcategory hides it from new-entry choices, retains its past expenses in lists and analytics, and stops its monthly schedules. Restore makes the choice available again; it does not restart stopped schedules. Keep at least one category with one available subcategory. Renaming updates associated classification labels without changing amounts, dates, IDs, notes, or charge cursors. Older brand/shop picker labels migrate to generic labels, retaining original classifications where needed. Repeated migration is idempotent. Changes can be undone in the current session.

Expenses store both `mainCategory` and `subCategory`. An additive, idempotent migration groups existing expenses into the new eight-category hierarchy, retaining their original labels in `previousClassification` and the previous registry in `previousCategories`. Known items (such as RayZR Fuel and Cat Food) map to their corresponding subcategories. Broader old categories use Other; unfamiliar custom labels use Lifestyle & Social → Other, with the original label shown alongside the expense. Amounts, IDs, dates, and notes are preserved.

On first use at the **same origin** as FinFlow Architect, valid existing logged expenses and their custom categories are imported automatically. Original data in `finflow_architect_model_v2` is left intact. The migration respects previously deleted transactions and runs only when the new storage key is absent. It does not reactivate legacy subscriptions; create monthly schedules explicitly in FinFlow. Income, flow plans, subscriptions, and sync settings remain in the old key, outside the new app. Invalid data or unavailable storage produces a visible warning and pauses saving instead of silently overwriting data. Conflicting writes from another tab also require a reload via Retry.

The earlier Flow Builder, plan/actual Sankey, income analysis, and CSV tools remain outside the active app. FinFlow focuses on actual expenses.

## Optional Gist connection

Under Settings, enter an existing **secret** GitHub Gist ID/link and a token with Gists read/write permission (classic gist scope or fine-grained Gists permission). Save the connection, then Preview Gist. Choose a direction and confirm the whole-snapshot replacement. FinFlow reads/writes only `finflow.json`; other files are left intact. No account, sharing flow, automatic network sync, or Gist creation is added. HTTPS and network access to `api.github.com` are needed for these actions. All other functionality remains local and offline.

The ID is saved locally. The token stays in memory for this tab, is cleared from its input after connection, and disappears on reload/disconnect. It never enters localStorage, backups, or request URLs. Only secret Gists are accepted, but secret Gists are **not encrypted or access-controlled by their link**. GitHub keeps revision history. Uploading sends expenses, classifications, schedules, general preferences, and retained migration metadata to GitHub, without connection details or credentials. Review the replacement confirmation first.

Remote data is validated before restore; public, malformed, and truncated files are rejected. Preview compares expense counts. A second read prevents overwriting a snapshot changed since preview, and local storage conflicts block restoration. Gist sync is manual snapshot replacement, not merging: avoid simultaneous writes from multiple devices, as GitHub's update endpoint does not provide an atomic compare-and-swap guarantee here. A network error after an upload may mean GitHub accepted it; preview again before retrying. Restore can be undone in this session. Due monthly charges are processed after restore only when automatic posting is enabled.

## Roadmap

**1.0.0** remains the full PWA release. **2.0.0** targets reading bank SMS on the device and automatically logging matching spending in the PWA. This feature is not implemented and requires a proven supported device integration: browser WebOTP is for domain-bound verification codes, not bank-inbox access. See [TODO.md](TODO.md) for the platform decision, explicit consent, permission handling, matching/deduplication rules, privacy, and test gates. The current version stays on the compatible 0.x release line.

## Development and verification

The app needs no installation. Dev-only browser checks use `puppeteer-core` and a local Chrome:

```sh
npm install
npm test
```

Set `CHROME` to your Chrome executable if it is not at the default macOS path. Tests resolve index.html relative to the repository and use isolated browser profiles. See [tests/README.md](tests/README.md) for coverage and manual desktop/phone checks.

All changes must follow [VERSIONING.md](VERSIONING.md). The owner-authorized rebuild resets the release baseline to 0.0.0; the local storage schema is independent of release versions.
