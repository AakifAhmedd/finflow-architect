# FinFlow versioning

The tracker-first FinFlow rebuild starts a new release line at **0.0.0**. This reset is explicitly authorized by the repository owner. Earlier FinFlow Architect commits remain in Git history; they had no committed VERSION or VERSIONING.md.

## Full release milestone

**1.0.0** is reserved for the full FinFlow PWA release. Track its implementation and release criteria in [TODO.md](TODO.md). Continue using 0.x.x for work leading up to that milestone; documenting the target does not make the current app a PWA.

## Required for every change

Every user-visible, behavioral, styling, documentation, refactoring, or bug-fix change must update the version. Commit the version update together with its implementation. Never push a change without its corresponding version update.

Use `MAJOR.MINOR.PATCH`, without a prefix:

- Patch: fixes, styling, documentation, and internal refactoring.
- Minor: additive functionality or substantial compatible improvements.
- Major: breaking behavior or data/file-format changes. Obtain explicit owner confirmation before a breaking data or file-format change.

The initial rebuild is the authorized **0.0.0** baseline; subsequent fixes start at **0.0.1**.

## Release checklist

1. Read VERSION, this document, README.md, and the current implementation before editing.
2. Update VERSION, `APP_VERSION`, the `application-version` meta tag, and the initial footer display in index.html to the same release version.
3. Update README.md's baseline version and package.json's dev-test package version when making a release.
4. Run `npm test` and the desktop/phone manual checks in tests/README.md.
5. Check `git diff --check`, then commit the version and implementation together. Push only after checks pass.

The app's CSS, JavaScript, SVG icons, and charts are inline in index.html. There are no external application assets, CDN scripts, service worker, or asset cache-busting tokens to update. GitHub Pages serves index.html using its normal HTTP cache policy.

## Storage compatibility

Release versions and storage schemas are independent. The new app uses `finflow_tracker_v1`, with `schema: 1` and integer LKR cents. It imports existing logged expenses from `finflow_architect_model_v2` once, only when the new storage key is absent. The original key is never modified or deleted. Income, plans, subscriptions, and other removed features remain in that original data; they are not active in FinFlow. Do not discard saved financial data or silently overwrite unreadable storage.

The 0.1.0 categorization update is additive within schema 1. Expenses retain `category` and `item` for compatibility and add `mainCategory` and `subCategory`. Prior classification metadata is retained during migration. `categorizationVersion: 1` marks the eight-category registry; repeated loads do not duplicate expenses or erase prior labels.

The 0.2.0 monthly-expense feature adds `recurringRules` within schema 1. Older tracker data gains an empty rule list without creating schedules. Monthly charges carry a schedule ID and name; posting the charge and advancing its monthly cursor happen in the same save. Legacy subscriptions stay inactive until explicitly set up in FinFlow.


The 0.3.0 Settings update adds `categorySettingsVersion: 1`, removal flags, subscription markers, built-in icon overrides, and general preferences within schema 1. Older registries are validated before generic-label migration. Category removal is non-destructive: historical references stay valid and affected schedules stop. Tokens are tab-only and never part of storage or the Gist snapshot. Gist restore validates the same schema before a single local save. The future 2.0.0 SMS milestone does not authorize breaking data changes or constitute the present release.

The compatible 0.4.0 update adds `taxonomyVersion: 1` and optional `directEntry` category metadata within schema 1. Prior formats remain readable, including Gist backups. Recognized old defaults migrate to the six-category structure once; original registries and classifications are retained. Ambiguous labels are never split by guessing. Customized registries and financial values remain intact, and monthly charge IDs/cursors do not change. New Gist snapshots include the taxonomy marker and retained old registry.

The additive 0.5.0 release supports first-time secret Gist creation/discovery named `finflow-data`. It uses the existing `settings.gistId` and `finflow-backup` format; no schema or credential-storage change is required. Existing validated FinFlow Gists remain compatible. Gists without a FinFlow backup are rejected before writes, protecting other apps’ data. Pending creation/recovery state is tab-only.

The compatible 0.6.0 release remembers credentials per browser/device as explicitly requested by the owner. The separate `finflow_gist_connection_v1` record binds the token to its Gist ID, restores the masked input on reload, and is removed on confirmed disconnect. The token never enters the financial schema, Gist backup, or Undo state. Prior backups stay compatible. Failed connection writes attempt credential rollback; cross-tab credential changes invalidate previews before replacement.

The compatible 0.8.0 release stages phone entry as amount, category, and subcategory selection. Advancing from the amount never saves; Back and Edit amount preserve draft values. Successful saves reset the flow. Desktop entry, storage schema, and backup formats are unchanged.

The compatible 0.9.0 release adds incomes, movements, and importLedger arrays within schema 1. Older snapshots gain empty arrays through idempotent normalization; malformed new fields are rejected before writing. Snapshot backups and Gist sync include the new arrays while excluding device credentials. Import IDs and original signatures survive deletion to prevent re-import resurrection; source changes are rejected for review. No schedules are created from imported historical transactions.
