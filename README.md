# FinFlow

Personal, single-user expense and income tracker. Fixed LKR, offline-first PWA, no build step or dependencies. Current version: **1.1.0**.

[Open FinFlow](https://aakifahmedd.github.io/finflow-architect/)

## Features

- **Tracks:** fast expense entry: type an amount on desktop, choose a category and subcategory, then save. Desktop pairs a compact form and monthly schedules with the spending overview and recent expenses. Phones keep the keypad and separate entry stages. Optional note, date, and Repeat monthly.
- **Spending:** monthly totals and transactions first, section shortcuts, category shares, and an interactive daily chart. Filter by category or day using touch, the day picker, or keyboard navigation.
- **Income:** log income by source in the selected month; compare with spending. Salary-style income can repeat monthly.
- **Other cash movements:** refunds, loans, withdrawals, transfers, savings, rollover. Kept separate from income and spending.
- **Monthly schedules:** recurring expenses and income post on their day each month (last day for shorter months) and catch up when the app opens.
- **Settings:** edit categories and icons, startup view, Gist sync, backup/import, install and updates, Reset local data.
- Calendars and dropdowns use in-app controls on desktop and phone; income sources support suggestions or custom text.
- Deletes and replacements ask for confirmation; recent changes can be undone (toast or Ctrl/Cmd+Z).

Default categories: Transport, Food & Dining, Fitness & Health, Personal, Professional & Community, Other.

## Data

Everything lives in this browser's localStorage (`finflow_tracker_v1`), stored as integer cents. Each browser, device, and installed copy has its own data, and storage is not encrypted. Clearing site data erases it, so download a backup first.

- **Backup:** Settings → Import & backup saves and restores a JSON snapshot (Gist credentials excluded). Validated `finflow-import` files can be added with preview and deduplication.
- **Cloud sync (optional, manual):** Settings → Cloud sync with a GitHub token (gist scope). Push and Pull replace a whole snapshot in a secret Gist named `finflow-data`; they do not merge. Secret Gists are not encrypted. The token stays in this browser only.

## Install and offline

Open the hosted app, wait for **Ready to open offline** in Settings → Install & updates, then add it to the home screen (iOS: Safari → Share → Add to Home Screen). Updates download fully before an **Update and reload** button appears; saved data is never touched. Closed apps cannot post schedules in the background; they catch up on next open.

## Roadmap

Sankey view is deferred. **2.0.0** targets automatic spending from bank SMS, which is not implemented and needs a proven device integration. See [TODO.md](TODO.md).

## Development

```sh
npm install
npm test
```

Tests use `puppeteer-core` and a local Chrome (set `CHROME` if needed); see [tests/README.md](tests/README.md). Every change must follow [VERSIONING.md](VERSIONING.md). See [CHANGELOG.md](CHANGELOG.md) for release notes.
