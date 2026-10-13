# FinFlow

A personal finance app for quickly logging expenses and understanding where money went. **Track first, visualize second.** Current version: **0.8.1**.

[Open FinFlow](https://aakifahmedd.github.io/finflow-architect/)

See [the to-do list](TODO.md) for the roadmap to **1.0.0**, the full PWA release.

## Use

Open `index.html` directly, or serve it with any static server. The entire app is in one HTML file, with no build step, runtime dependencies, fonts, CDN requests, or network requirement.

- **Tracks:** enter an amount with the large keypad, choose a main category, select its subcategory (including Other), and save. The main Other category is a direct selection; add an optional note and save. Use Back to change the main category. Optionally add a note or change the date. Keyboard entry and decimal amounts are supported. Recent expenses and monthly spending sit alongside the form on desktop. Below 768 px, Tracks starts with only the amount and a spacious keypad. Choose category (or press Enter) replaces the keypad with the main categories, followed by subcategories. The amount stays visible; Edit amount returns to the keypad without clearing the draft. Back returns from subcategories to main categories, or from main categories to the amount. Save stays fixed above navigation during selection and never runs just by advancing from the amount. Review expenses and analytics in Spending; monthly schedule management is there on phones too.
- **Monthly expenses:** expand Add details, enable Repeat monthly, name the expense (Google One or YouTube, for example), and choose its first charge date. FinFlow logs a charge on that day each month, using the last day for shorter months. Future first-charge dates are supported. Manage or stop a schedule from the Monthly expenses card (Tracks on desktop, Spending on phones); changing a schedule affects future charges, and stopping keeps past expenses. Individual logged charges can still be edited/deleted without changing the schedule.
- **Spending:** switch months, compare total spending with the previous full month, view category shares and daily totals, and select a category to filter its expenses. Daily average includes every calendar day in the month, or days elapsed so far for the current month. Selecting a main category also shows its subcategory totals. Each chart has a text alternative; exact expenses remain available below it.
- **Settings:** add, rename, remove, or restore categories/subcategories; choose built-in icons; mark subscription subcategories; configure manual GitHub Gist sync; choose the startup view, remembered main category, reduced motion, and automatic monthly posting. The six defaults use the existing built-in icon set. Subscription choices preselect Repeat monthly on new entry; you can turn it off for an individual purchase. Marking a choice does not create schedules or alter existing expenses.
- **Focused phone entry:** amount, main category, and subcategory each get their own stage. Default choices fit without scrolling on common large-phone viewports; the amount screen uses the app’s dark green, soft green keys, white numbers, and a pale green continue action. The keypad has larger buttons and category labels have more room. Category selection and the other views use the original light palette. Optional details appear once a classification is selected. Expanded details, large text, many custom categories, and very small/short screens can require scrolling. Touch targets remain at least 44 px. Successful phone saves return to the amount stage, clear the draft, and show a three-second confirmation with Undo. Remembered main categories are applied only after advancing from the amount. Editing an expense also starts at the amount and keeps its classification and details.
- **Action warnings:** expense deletion, category/subcategory removal, stopping monthly schedules, disconnecting/changing a Gist connection, replacing either Gist snapshot, and pausing automatic monthly logging all use the same confirmation dialog. Read the impact, then choose Cancel or the named action. Cancel and Escape leave the action unapplied; Cancel receives initial focus. Data changes while a warning is open block the action until you review again.
- Open any expense to edit or delete it. Saved additions, edits, and deletions can be undone with the toast's Undo button or Ctrl/Cmd+Z outside text inputs. Undo covers the most recent change in the current session.

This remains a private, single-user tool. Currency is fixed at **LKR**. Its six main categories are **Transport**, **Food & Dining**, **Fitness & Health**, **Personal**, **Professional & Community**, and **Other**. Pets is a Personal subcategory; use notes for food, litter, or vet details. Housing, gadgets, social outings, and entertainment have no dedicated default choices. Settings can customize the registry.

| Category | Subcategories |
| --- | --- |
| Transport | Fuel, Vehicle Maintenance, Public Transport, Parking, Ride Sharing, Other |
| Food & Dining | Food Delivery, Restaurants, Cafes, Snacks & Drinks, Groceries, Other |
| Fitness & Health | Gym, Supplements, Sports Activities, Sports Gear, Medical Visits, Medicines, Other |
| Personal | Pets, Gifts, Personal Care, Clothing & Accessories, Software & Cloud Services, Other |
| Professional & Community | Work Expenses, Volunteering, Courses, Community Events, Other |
| Other | Direct selection with an optional note |

There are no accounts, sharing, onboarding, generic templates, or currency controls.

## Data

Expenses are stored in this browser's localStorage under `finflow_tracker_v1`. Amounts use integer cents to avoid floating-point aggregation errors. Reloads keep your expenses; different browsers/devices and origins have separate data. Clearing browser site data removes it. Browser storage is local, not encrypted.

Monthly rules live in the same browser storage. Due charges are added on opening/returning to FinFlow, and while the app remains open; missed months are caught up. A closed app does not run background jobs. Each schedule has a deterministic charge ID per month and an atomic posting cursor, so reloads do not duplicate charges and deleted charges are not recreated. Future scheduled amounts are excluded from actual-spending analytics until due. Automatic catch-up clears session Undo to protect newly posted charges.

Category customization is additive in schema 1. Removing a category or subcategory hides it from new-entry choices, retains its past expenses in lists and analytics, and stops its monthly schedules. Restore makes the choice available again; it does not restart stopped schedules. Keep at least one category with one available subcategory. Renaming updates associated classification labels without changing amounts, dates, IDs, notes, or charge cursors. Older brand/shop picker labels migrate to generic labels, retaining original classifications where needed. Repeated migration is idempotent. Changes can be undone in the current session.

Expenses store both `mainCategory` and `subCategory`. The 0.4.0 migration adds `taxonomyVersion: 1` within schema 1 and reorganizes recognized earlier defaults into the six-category registry. Pets becomes Personal → Pets; software/cloud expenses become Personal → Software & Cloud Services. Ambiguous combined labels (fuel/maintenance, public transport/parking, cafes/dining, sports/gear, outings/gifts) use the appropriate category's Other rather than guessing; retained precise original labels can resolve a split. Old housing expenses go to the main Other category. Prior classifications and the complete old registry are retained in `previousClassification`, `classificationHistory`, and `previousCategoryRegistry`; earlier `previousCategories` metadata remains intact. Amounts, IDs, dates, original items, notes, monthly rule names, activation state, and posting cursors stay intact. User-renamed categories and custom subcategory registries stay configured; these can add choices beyond the six defaults. Default IDs/names avoid collisions with those retained categories. Repeated migration is idempotent.

Removed choices are carried over when all contributing choices were removed. Subscription defaults on merged choices transfer only when all available contributing choices were marked recurring, so a broad choice does not unexpectedly make every purchase monthly. Existing monthly schedules continue unchanged. Previous icons/settings remain in the retained registry; unambiguous icon overrides are carried forward. The main Other category stores `Other` for both classification fields but skips its second selection step. Adding more subcategories to it in Settings makes it a normal two-step picker.
On first use at the **same origin** as FinFlow Architect, valid existing logged expenses and their custom categories are imported automatically. Original data in `finflow_architect_model_v2` is left intact. The migration respects previously deleted transactions and runs only when the new storage key is absent. It does not reactivate legacy subscriptions; create monthly schedules explicitly in FinFlow. Income, flow plans, subscriptions, and sync settings remain in the old key, outside the new app. Invalid data or unavailable storage produces a visible warning and pauses saving instead of silently overwriting data. Conflicting writes from another tab also require a reload via Retry.

The earlier Flow Builder, plan/actual Sankey, income analysis, and CSV tools remain outside the active app. FinFlow focuses on actual expenses.

## Cloud sync (optional)

Under Settings → Cloud sync (optional), enter your **GitHub personal access token (needs "gist" scope)**, leave **Gist ID** blank, and choose **Save connection**. FinFlow looks for a secret Gist whose description is exactly **finflow-data**. If none exists, it creates one containing your current backup in `finflow.json` and fills/saves its ID automatically. If one exists, FinFlow validates it and previews it without uploading or replacing either snapshot. Multiple matching Gists require you to enter the intended ID. You can also enter an existing FinFlow Gist ID/link directly, save, then Preview cloud. Use a classic token with gist scope or a fine-grained token with Gists read/write permission.

**Push to cloud** uploads this browser’s snapshot; **Pull from cloud** restores the cloud snapshot to this browser. Both require confirmation before replacing data. New setup uses GitHub’s create endpoint, which creates a separate Gist. A Gist without a validated FinFlow backup is rejected before upload/restore, protecting RACK and other apps. Subsequent pushes update only `finflow.json`; unrelated files and the Gist’s description stay intact. Cloud sync remains manual. HTTPS and access to `api.github.com` are needed for these actions; all other functionality remains local and offline.

Creation runs once per in-progress setup. Discovery scans up to 1,000 Gists and stops without creating if that list is incomplete. After an uncertain network failure, another Save connection may discover a successfully created Gist, but does not blindly repeat creation in the same tab. Check GitHub and enter the returned ID if needed. If creation succeeds but local storage fails, the ID remains visible and the pending connection stays in memory for a safe retry; copy the ID before closing/reloading the tab. Creating a Gist uploads a snapshot at that moment; expenses added while the request is running remain local and can be pushed after reviewing the preview.
The Gist ID and token are remembered in this browser on this device. The token stays masked in its password field after saving and reloading. It is stored in a separate localStorage record, `finflow_gist_connection_v1`, bound to the Gist ID, outside the financial model and every Gist backup. It is never included in uploads or request URLs. Disconnect removes the saved ID and token after confirmation. Different browsers/devices have their own saved connection. Connection writes roll back the credential record if the financial-settings save fails; changed credentials in another tab invalidate the preview. Only secret Gists are accepted, but secret Gists are **not encrypted or access-controlled by their link**. GitHub keeps revision history. Uploading sends expenses, classifications, schedules, general preferences, and retained migration metadata to GitHub, without connection details or credentials. Review the replacement confirmation first.

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
