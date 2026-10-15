# FinFlow to-do list

**Current release: 1.0.0 — installable FinFlow with offline reopening and recurring income.**

FinFlow remains a personal, single-user expense and income tracker with spending visualizations, fixed LKR, and the existing personal categories. This is a planning checklist; unchecked items are future work or acceptance checks.

## Completed foundation

- [x] Rebuild FinFlow around Track and Spending.
- [x] Add a large amount keypad and a selector with six main categories, specific subcategories, and direct Other entry.
- [x] Keep the default keypad, category steps, and Save on one screen on common large phones, with generic picker labels.
- [x] Add Settings for category/subcategory editing, removal/restoration, built-in icons, subscription defaults, general behavior, and explicit manual Gist snapshots.
- [x] Add category breakdowns, daily spending charts, and monthly navigation.
- [x] Add recurring monthly income with due dates, month-end handling, catch-up, edit/stop/Undo, and separate schedule management.
- [x] Track received income separately, compare it with monthly expenses, and keep refunds, loans, withdrawals, transfers, savings and rollover in a separate movement ledger.
- [ ] Explore a future Sankey of income and expenditure after validating the cash-flow classifications; Sankey remains deferred after 1.0.0.
- [x] Support expense editing, deletion, and undo.
- [x] Set up named monthly expenses once, catch up due charges, and manage or stop future recurrence.
- [x] Preserve personal defaults and migrate existing logged expenses without changing the original saved data.
- [x] Keep the application self-contained in index.html with no runtime dependencies.
- [x] Add regression checks for persistence, totals, migration, storage failures, accessibility, and responsive layouts.

## Everyday-use acceptance

- [ ] Use the tracker for everyday expenses and record any friction in amount entry, category selection, saving, and editing.
- [ ] Refine phone layouts using actual iPhone and Android devices, including small screens, landscape, safe areas, and the on-screen keyboard.
- [ ] Check desktop spending views with several months of realistic expenses, long notes, and custom categories.
- [ ] Confirm empty months, decimal amounts, month boundaries, and daily-average explanations remain clear.
- [x] Add local JSON backup/restore and additive transaction import with validation, preview, confirmation, deduplication, deletion history, and Undo.

## PWA — required for 1.0.0

- [x] Add a web app manifest with FinFlow's name, app ID, theme colors, and standalone display mode.
- [x] Add app icons, including maskable icons and an Apple touch icon.
- [x] Set the manifest start URL and scope correctly for the existing /finflow-architect/ GitHub Pages path.
- [x] Add a service worker that caches the application for offline reopening after an initial successful load.
- [x] Keep application code in index.html; add only the supporting files needed for installation and offline caching.
- [x] Add a clear update flow and versioned caches so an installed app receives new releases without losing saved expenses.
- [x] Validate manifest, scope, icon dimensions, and Chromium installability with the browser protocol.
- [ ] Complete physical iPhone/Android home-screen installation and desktop OS app-window acceptance; automation does not replace these checks.
- [x] Verify offline reopening after an isolated Chromium browser restart, including expense save/edit/delete/Undo, income, and persistence; repeat from actual installed phone icons below.
- [x] Verify a browser upgrade to the PWA shell preserves same-origin financial data and legacy storage; separately verify any OS-specific installation storage behavior below.
- [x] Verify cache cleanup and updates never delete financial data or show a mixture of old and new application code.

## 1.0.0 release verification

- [x] Implement the PWA shell, installation help, explicit update flow, and recurring income.
- [ ] Complete the everyday-use and physical-device checks above; keep any device-specific issues here.
- [x] Run all thirteen regression suites and review desktop/phone browser layouts; retain the physical-device checks above.
- [x] Document installation, offline behavior, updates, local backup/restore, and browser storage limitations in README.md.
- [x] Update VERSION and matching application/package/service-worker release references to 1.0.0.
- [x] Commit the release implementation and version change together and push after automated verification.
- [ ] Complete actual-device acceptance against GitHub Pages: install, reopen offline, and preserve expenses through an update.


## 2.0.0 — device bank SMS → automatic PWA spending

- [ ] Read bank SMS messages on the device and automatically log matching spending in the PWA.

This is a future milestone, not an implemented permission or current platform promise. Complete 1.0.0 first. Ship 2.0.0 only after the device-to-PWA path is proven on explicitly supported platforms; unsupported devices must keep manual tracking available.

### Platform and browser feasibility — first release gate

- [ ] Record a tested support matrix with OS/browser versions, installed versus browser mode, foreground/background operation, and offline delivery. Cover Android Chrome and installed PWA, iPhone Safari/installed PWA, and desktop browsers.
- [ ] Establish that a standard PWA cannot use WebOTP as a general bank SMS reader. WebOTP receives specially formatted, domain-bound verification codes; it does not grant arbitrary inbox/history access. A service worker or installation alone does not add SMS permissions. [Chrome WebOTP documentation](https://developer.chrome.com/docs/identity/web-apis/web-otp).
- [ ] Prototype an explicitly installed Android companion/device integration if automatic reading is required. Determine whether SMS receive/read permissions, a permitted default-handler role or approved policy exception, distribution, and background execution constraints are viable. Do not assume a native wrapper automatically grants access. [Android default-handler permissions](https://developer.android.com/guide/topics/permissions/default-handlers), [Google Play SMS policy](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en).
- [ ] Treat iOS automatic inbox access as unsupported until a permitted integration is demonstrated. Apple's native SMS filtering extension concerns messages from unknown senders and has restricted data use; it is not a PWA inbox API. Evaluate an explicit user-triggered share/paste/automation handoff as a separate fallback, accurately labeled as such. [Apple SMS filtering documentation](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering).
- [ ] Design an authenticated, bounded device-to-PWA handoff that cannot inject transactions from arbitrary websites/apps, lose entries while the PWA is closed, or leak message text. Decide storage ownership, delivery acknowledgments, retry behavior, supported origins, and integration upgrade/revocation. A prototype and actual-device tests are required before committing to the release scope.

### Consent and permissions

- [ ] Keep bank-message access off by default. Explain which messages/data are read, when ingestion runs, where records are stored, and whether any data leaves the device before explicit opt-in.
- [ ] Request only necessary permissions at the moment the feature is enabled; handle denial, restricted OS modes, revocation, disabled integration, and removal of any required handler role. Manual entry must continue to work.
- [ ] Provide pause/disable controls, bank/sender allowlists, optional review before auto-posting, and deletion of stored import metadata. Stop reading immediately when consent/permission is revoked.

### Matching and financial correctness

- [ ] Collect owner-approved, redacted Sri Lankan bank message fixtures; document supported banks, verified sender identifiers, message variants, language, timezone, timestamps, decimal/thousands formats, and LKR interpretation.
- [ ] Define debit purchase rules and confidently distinguish credits, transfers, cash withdrawals, fees, reversals/refunds, balance-only alerts, failed/pending payments, and OTPs. Do not treat account balances as expense amounts; ignore non-LKR messages rather than introducing currency selection.
- [ ] Use strict versioned parsers with required amount/date/reference fields and explicit confidence thresholds. Unknown, ambiguous, malformed, or changed templates go to review instead of silently posting.
- [ ] Define deterministic category/subcategory matching, editable merchant rules, unmatched handling, category removal behavior, corrections, and audit/provenance labels without retaining unnecessary message/account content.

### Duplicate prevention and privacy

- [ ] Persist an import identity from bank/sender, normalized transaction reference, amount, and relevant timestamp; define handling when a reference is absent. Test repeated SMS, reordered delivery, distinct legitimate same-amount purchases, device retries, and multiple alerts for one charge.
- [ ] Write the transaction and deduplication marker atomically. Keep deletion tombstones so removed imports do not reappear. Reconcile manually logged purchases and existing monthly schedules using explicit matching/review rules so a subscription is not logged twice.
- [ ] Design the handoff so raw messages remain on-device; discard them after necessary extraction unless the user separately opts into limited retention. Redact account numbers and references in UI, backups, logs, crash reports, and fixtures; do not capture OTPs or unrelated personal messages.
- [ ] Decide encryption, retention, data deletion/export, device loss, and access controls for the native integration. No telemetry or cloud message processing by default. Explicitly decide whether minimal SMS provenance belongs in optional Gist snapshots; raw messages must never be synced.

### Testing and release gates

- [ ] Test parsers against positive/negative/redacted fixtures, changed bank templates, malicious text, rounding, timezones, month boundaries, and duplicate cases; keep real message data out of Git.
- [ ] Test actual-device permission denial/revocation, foreground/background, closed PWA, offline buffering, restart, OS upgrades, and battery restrictions across the published support matrix.
- [ ] Test atomic storage failure/retry, corrections, deletion tombstones, manual/monthly overlap, multi-device delivery, Gist conflict handling, and schema migration without lost expenses.
- [ ] Conduct privacy/security review of permissions, handoff authentication, data minimization, retention, and backups. Document unsupported platforms and the manual fallback clearly.
- [ ] Run all tracker/Settings/PWA regressions, complete a real-device pilot with consent, resolve release blockers, and update versions/cache references and support documentation together before pushing 2.0.0.
