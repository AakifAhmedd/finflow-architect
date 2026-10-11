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
