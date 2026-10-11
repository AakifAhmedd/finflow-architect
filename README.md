# FinFlow

A personal finance app for quickly logging expenses and understanding where money went. **Track first, visualize second.** Current version: **0.1.0**.

[Open FinFlow](https://aakifahmedd.github.io/finflow-architect/)

See [the to-do list](TODO.md) for the roadmap to **1.0.0**, the full PWA release.

## Use

Open `index.html` directly, or serve it with any static server. The entire app is in one HTML file, with no build step, runtime dependencies, fonts, CDN requests, or network requirement.

- **Track:** enter an amount with the large keypad, choose one of eight main categories, select its subcategory (including Other), and save. Use Back to change the main category. Optionally add a note or change the date. Keyboard entry and decimal amounts are supported. Recent expenses and monthly spending sit alongside the form on desktop and below it on mobile.
- **Spending:** switch months, compare total spending with the previous full month, view category shares and daily totals, and select a category to filter its expenses. Daily average includes every calendar day in the month, or days elapsed so far for the current month. Selecting a main category also shows its subcategory totals. Each chart has a text alternative; exact expenses remain available below it.
- Open any expense to edit or delete it. Saved additions, edits, and deletions can be undone with the toast's Undo button or Ctrl/Cmd+Z outside text inputs. Undo covers the most recent change in the current session.

This remains a private, single-user tool. Currency is fixed at **LKR**. Its eight personal main categories are Transport & Vehicles, Food & Dining, Fitness & Health, Pets, Housing & Living, Tech & Subscriptions, Lifestyle & Social, and Professional & Community. Each contains three specific subcategories and Other. There are no accounts, sharing, onboarding, generic templates, or currency controls.

## Data

Expenses are stored in this browser's localStorage under `finflow_tracker_v1`. Amounts use integer cents to avoid floating-point aggregation errors. Reloads keep your expenses; different browsers/devices and origins have separate data. Clearing browser site data removes it. Browser storage is local, not encrypted.

Expenses store both `mainCategory` and `subCategory`. An additive, idempotent migration groups existing expenses into the new eight-category hierarchy, retaining their original labels in `previousClassification` and the previous registry in `previousCategories`. Known items (such as RayZR Fuel and Cat Food) map to their corresponding subcategories. Broader old categories use Other; unfamiliar custom labels use Lifestyle & Social → Other, with the original label shown alongside the expense. Amounts, IDs, dates, and notes are preserved.

On first use at the **same origin** as FinFlow Architect, valid existing logged expenses and their custom categories are imported automatically. Original data in `finflow_architect_model_v2` is left intact. The migration respects previously deleted transactions and runs only when the new storage key is absent. It does not create recurring expenses. Income, flow plans, subscriptions, and sync settings remain in the old key, outside the new app. Invalid data or unavailable storage produces a visible warning and pauses saving instead of silently overwriting data. Conflicting writes from another tab also require a reload via Retry.

The earlier Flow Builder, plan/actual Sankey, income analysis, recurring subscription automation, cloud sync, CSV tools, and styling settings have been removed from the active app. FinFlow focuses on actual expenses.

## Development and verification

The app needs no installation. Dev-only browser checks use `puppeteer-core` and a local Chrome:

```sh
npm install
npm test
```

Set `CHROME` to your Chrome executable if it is not at the default macOS path. Tests resolve index.html relative to the repository and use isolated browser profiles. See [tests/README.md](tests/README.md) for coverage and manual desktop/phone checks.

All changes must follow [VERSIONING.md](VERSIONING.md). The owner-authorized rebuild resets the release baseline to 0.0.0; the local storage schema is independent of release versions.
