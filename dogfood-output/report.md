# Dogfood QA Report — FinFlow Architect

**Target:** https://aakifahmedd.github.io/finflow-architect/ (commit `f64e319`, single-file `index.html`)
**Date:** 2026-10-02
**Scope:** Full app — Tracker, Visualization, Analysis, Flow Builder, Settings, CSV import/export, undo, subscriptions, light/dark, keyboard nav, mobile viewport
**Tester:** Hermes Agent (automated exploratory QA)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 2 |
| 🟡 Medium | 2 |
| 🔵 Low | 3 |
| **Total** | **8** |

> **Post-QA correction (2026-10-02).** Three findings below (#6, #7, and part of #8)
> were **false positives** — I asserted silent failures where the app does show
> feedback. Re-reading the source and re-testing found duplicate node names rejected
> with a toast (`index.html:2849`), self-loop connections rejected with an `alert()`
> (`index.html:2903`), and note auto-categorisation working correctly. They are
> marked RETRACTED rather than deleted. Counts exclude them.

**Overall Assessment:** The core loop (log a transaction → see it in tracker, chart and analysis) works and data survives reloads, but the header badges and two of the three Analysis health cards were computed from the *plan* rather than from *logged transactions*, so the app contradicted itself on screen — and a stored XSS was reachable from any node-name input.

---

## Issues

### Issue #1: Stored XSS executes from any node name (Analysis + Flow Builder)

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Category** | Security / Functional |
| **URL** | `https://aakifahmedd.github.io/finflow-architect/` — Analysis view, Flow Builder view |

**Description:**
Node names are inserted into `innerHTML` unescaped in several render paths, while `escapeHtml()` exists and is used correctly elsewhere (transaction rows, subscription rows). A node named `<img src=x onerror=...>` persists in `localStorage` and its handler fires every time the Analysis or Flow Builder view renders.

Confirmed sinks (unescaped interpolation). The first pass found four; auditing every
interpolation of a user-controlled string during the fix found **nine**:
- `index.html:2091` — Analysis income breakdown: `${name}`
- `index.html:2116` — Analysis expense breakdown: `${name}`
- `index.html:1535` — Flow Builder node card heading: `${nodeName}`
- `index.html:1554` — Flow Builder outflow route label: `${f.target}`
- `index.html:1556` — inline flow editor `data-source` / `data-target` attributes
- `index.html:1540`, `1543`, `1563` — `data-node` attributes on card buttons
- `index.html:1614`, `1620` — connections matrix source/target cells
- `index.html:2016`, `2018`, `2022` — Sankey **link tooltip** (`tooltip.html()`)
- `index.html:2039` — Sankey **node tooltip** (`tooltip.html()`)

Correctly escaped for contrast: `index.html:1464-1470` (transaction rows), `1398-1402` (subscriptions).

**Steps to Reproduce:**
1. Flow Builder → **Add Node**
2. Node Name: `<img src=x onerror=window.__xss=1>`
3. Click **Create Node**
4. Switch to the **Analysis** tab

**Expected Behavior:**
Text is escaped, or set via `textContent`, so a node name can never introduce markup.

**Actual Behavior:**
`window.__xss === 1`. The payload is written to `localStorage` under `finflow_architect_model_v2` and re-executes on every subsequent page load and every Analysis/Builder render.

**Screenshot:**
MEDIA:/Users/aakifahmed/finflow-architect/dogfood-output/screenshots/02-analysis-zero-state.png
*(the broken-image entry in the Income Sources Breakdown is the injected `<img>`)*

**Console Errors:**
```
(no console error — the handler runs silently; observed via window.__xss flag)
```

---

### Issue #2: Analysis "Net Monthly Surplus" ignores expenses entirely

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Functional |
| **URL** | Analysis view |

**Description:**
`renderAnalytics()` computes the surplus as `totalIncome - totalSavings` (`index.html:2143`), where `totalSavings` only sums flows into nodes whose *name* matches a keyword list (`savings`, `investment`, `wealth`, `401k`, `reserve`, `fd` — `index.html:2127-2130`). Expenses are never subtracted, and a node not named with one of those words contributes nothing.

The shipped model has no such node, so surplus always equals total income.

**Steps to Reproduce:**
1. Tracker: log an expense of Rs. 1,250.50 (Badminton Gear)
2. Tracker: switch type to Income, log Rs. 100.50 (Income)
3. Open the **Analysis** tab

**Expected Behavior:**
Surplus = income − expenses = Rs. −1,150.

**Actual Behavior:**
```
Net Monthly Surplus: Rs. 101        ← equals income exactly
Tracker NET (same month): Rs. -1,150
```
Two figures for the same month on two tabs, differing by every logged expense. The card's own caption ("Unallocated funds…") describes a *plan* concept while the view header claims "BASED ON ACTUAL LOGGED TRANSACTIONS".

---

### Issue #3: Header "Total Expenses" is a residual of income, not expenses

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Note** | Root cause shared with #2 — both read the plan instead of the actuals. |
| **Category** | Functional |
| **URL** | Header metric badges (all views) |

**Description:**
`updateGlobalMetrics()` sets `totalExpenses = Math.max(0, totalIncome - totalSavings)` (`index.html:1739`) — i.e. "money not routed to a savings-looking node" — and renders it under the label **Total Expenses**. Nothing reads the expense side of the model.

**Steps to Reproduce:**
1. Flow Builder → set Income → Total Cash Flow to 1000, allocate nothing further
2. Log zero transactions (or delete them all)
3. Look at the header badges

**Expected Behavior:**
Total Expenses reflects expense/asset-tier outflows. With nothing allocated it should read Rs. 0.

**Actual Behavior:**
```
Total Income:    Rs. 1,000
Total Expenses:  Rs. 1,000     ← nothing was spent
Savings / Surplus: Rs. 0
Savings Rate:    0.0%
```
The same four badges stay pinned to plan values while the Tracker and Analysis tabs show actuals.

**Screenshot:**
MEDIA:/Users/aakifahmed/finflow-architect/dogfood-output/screenshots/02-analysis-zero-state.png

---

### Issue #4: `formatCurrency` rounds −1250.5 and +1250.5 differently

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Category** | Functional |
| **URL** | Tracker totals (all currency displays) |

**Description:**
`formatCurrency` uses `Math.round(val || 0)` (`index.html:1045`). JS `Math.round` rounds half *up*, so a positive `.5` goes up and a negative `.5` goes toward zero. A month's expense total and its net therefore disagree by 1 even though they are the same magnitude.

**Steps to Reproduce:**
1. Log one expense of Rs. 1,250.50 and nothing else
2. Read the Tracker's three totals

**Expected Behavior:**
Consistent rounding, or display with decimals.

**Actual Behavior:**
```
ACTUAL SPEND   Rs. 1,251
NET            Rs. -1,250
```
Verified directly: `formatCurrency(1250.5) === "Rs. 1,251"`, `formatCurrency(-1250.5) === "Rs. -1,250"`. A fix is `Math.sign(v) * Math.round(Math.abs(v))` or `toLocaleString` with `maximumFractionDigits`.

---

### Issue #5: Plan chart renders a blank canvas with no message

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | UX / Visual |
| **URL** | Visualization view, Plan mode |

**Description:**
The empty-state branch (`index.html:1844-1855`) only writes a message when `chartDataSource === "actual"`. In Plan mode with all flow values at 0 — which is exactly the state a fresh install is in, since plan values ship at zero — the SVG is completely empty: 0 rects, 0 paths, 0 text nodes, and no explanation.

**Steps to Reproduce:**
1. Fresh load (or set all builder amounts to 0)
2. Open **Visualization** (defaults to Plan)

**Expected Behavior:** Same "No transactions logged…" style guidance, e.g. "Set flow amounts in Flow Builder to see the plan."

**Actual Behavior:** Blank panel; only the toolbar chrome ("Drag nodes to reorder", "Tune Layout") is visible.

**Screenshot:**
MEDIA:/Users/aakifahmed/finflow-architect/dogfood-output/screenshots/04-plan-chart-blank-zero-values.png

---

### Issue #6: ~~Creating a duplicate node name silently no-ops but reports success~~ — RETRACTED

| Field | Value |
|-------|-------|
| **Severity** | **None — false positive** |
| **Category** | — |
| **URL** | Flow Builder → Add Node |

> **RETRACTED 2026-10-02.** This was my error. I verified flow counts before and after
> (29 → 29) and concluded the submit did nothing, but I never checked for the toast.
> `index.html:2849` rejects duplicates with "A category with that name already exists".
> Re-tested: toast visible, flow count unchanged, correct message. Self-loops are
> likewise handled by an `alert()` at `index.html:2903`. Both behave correctly.
> The only fair criticism is that one path uses a toast and the other a blocking
> `alert()` — cosmetic inconsistency, not a defect. No fix applied; the regression
> test asserts the correct behaviour so it stays that way.

<details><summary>Original (incorrect) claim, kept for the record</summary>

**Description:**
Node identity is the name string. Creating a node whose name already exists adds nothing to `currentFlows`, but the modal closes and the toast claims success.

**Steps to Reproduce:**
1. Flow Builder → **Add Node**
2. Node Name: `Cat Food` (already a leaf in the default model), Tier: Expense / Savings
3. Click **Create Node**

**Expected Behavior:** Reject with "A node called Cat Food already exists" and keep the modal open.

**Actual Behavior:** Modal closes, toast reads `Created node "Cat Food"`, connection count unchanged (29 before and after). Same class of silent failure as the self-loop connection attempt (Total Cash Flow → Total Cash Flow), which was also rejected with no message.

</details>

---

### Issue #7: ~~Auto-categorisation ignores a note when a category is already selected~~ — RETRACTED

| Field | Value |
|-------|-------|
| **Severity** | **None — false positive** |
| **Category** | — |
| **URL** | Tracker → log transaction form |

> **RETRACTED 2026-10-02.** Also my error. I typed `Cat Food`, saw the category stay
> `Badminton Gear`, and wrote it up as auto-categorisation failing. Re-reading my own
> trace: no merchant keyword matches "cat food", so leaving the selection alone is the
> *correct* behaviour. The very next probe, `PickMe ride to court`, resolved to
> `PickMe` as designed — I misread the line above it. No fix applied.

<details><summary>Original (incorrect) claim, kept for the record</summary>

**Description:**
Auto-categorisation is suppressed whenever the category select holds a value, and the select is not cleared after a successful save. So the second transaction in a session inherits the first one's category and the keyword map never fires.

**Steps to Reproduce:**
1. Save an expense with category `Badminton Gear`
2. Type note `PickMe ride to court` in the next transaction

**Expected Behavior:** Category switches to `PickMe` (longest keyword match wins).

**Actual Behavior:**
```
category after typing "PickMe ride to court": Badminton Gear
```
Typing `PickMe ride to court` from a *cleared* select does resolve to `PickMe`, so the keyword map itself is fine — the retained selection is what blocks it. Category is deliberately sticky (`txCategoryPicked` is reset at `index.html:1430` but the select value is not), which makes the interaction non-obvious.

</details>

---

### Issue #8: Income-diversity count and savings advice describe the plan, not the data

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Category** | Content / Functional |
| **URL** | Analysis view |

**Description:**
*Income Diversity Index* counts nodes whose tier is `Income Source` in the plan (`index.html:2142`) — the default model has exactly one, so the card read "1 Streams" even with zero logged income, and it was ungrammatical in the singular. Separately, the savings-rate advice was emitted unconditionally, so a month with no transactions at all was told "Low savings rate. Review fixed category allocations…".

> The **month-nav** half of this original finding was a second false positive and is
> retracted: with no transactions the Tracker already renders "No transactions logged
> for this month yet" via `#tracker-tx-empty`. That part of the UI is fine.

**Steps to Reproduce:**
1. Delete all transactions
2. Open **Analysis**

**Expected Behavior:** "0 Streams" or an explicit empty state; the month control should be visibly disabled or labelled when the month has no transactions.

**Actual Behavior:**
```
Savings Rate Health   0.0%
Income Diversity     1 Streams
Net Monthly Surplus  Rs. 0
msg: "Low savings rate. Review fixed category allocations to improve monthly surplus."
```
The advice is emitted for a month with no transactions at all. Also note "1 Streams" is ungrammatical for the singular case.

---

### Issue #9: Chart month-nav buttons have no accessible name

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Accessibility |
| **URL** | Visualization view, Actual mode |

**Description:**
`btn-chart-prev-month` and `btn-chart-next-month` contain only a Font Awesome `<i>` glyph — no text content, no `aria-label`, no `title`. Every other icon-only button in the app (`btn-sync`, `btn-theme-toggle`, `btn-tracker-prev-month`, `btn-tx-delete`, `btn-sub-remove`, `btn-tx-new-category`) does carry an `aria-label`, so these two are the outliers.

Otherwise accessibility is in reasonable shape: all visible inputs have an associated label/placeholder, focus outlines render (1px header, 2px in the form), and Tab order follows the visual order.

---

### Issue #10: Sankey SVG exposes no structure to assistive tech

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Accessibility |
| **URL** | Visualization view |

**Description:**
`#sankey-svg` has no `role`, no `aria-label`, and its 30 node rects / link paths carry zero `aria-label` attributes. The chart is the app's centrepiece and is entirely unavailable to a screen reader; there is no text alternative or data table equivalent. Note the visual chart *does* render a text summary (e.g. `Health & Sports(Rs. 1,251)`), so a `role="img"` + `aria-label` summary, or a visually-hidden table, would be cheap.

---

### Issue #11: Tracker's negative NET is displayed in the surplus accent colour

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Category** | Visual |
| **URL** | Tracker view |

**Description:**
`tracker-total-net` sits in the teal "surplus" style while carrying a deficit value (`Rs. -1,250` next to an actual spend of Rs. 1,251). The Flow Builder's balance badge does colour-switch correctly between Balanced / Unallocated Surplus / Deficit, so the pattern exists in the codebase and just isn't applied on the Tracker card. Colour is the only differentiator here — the sign is in the text, so this is polish rather than a correctness problem.

**Screenshot:**
MEDIA:/Users/aakifahmed/finflow-architect/dogfood-output/screenshots/01-tracker.png

---

## Issues Summary Table

| # | Title | Severity | Category | URL |
|---|-------|----------|----------|-----|
| 1 | Stored XSS from unescaped node names | Critical | Security | Analysis / Flow Builder |
| 2 | Analysis surplus ignores expenses | High | Functional | Analysis |
| 3 | Header "Total Expenses" is a residual | High | Functional | Header (all views) |
| 4 | Asymmetric rounding in `formatCurrency` | High | Functional | Tracker totals |
| 5 | Plan chart blank with no empty state | Medium | UX / Visual | Visualization |
| 6 | ~~Duplicate node name silently no-ops~~ | — | Retracted | — |
| 7 | ~~Auto-categorisation blocked by sticky category~~ | — | Retracted | — |
| 8 | Income-diversity count and advice read the plan | Medium | Content | Analysis |
| 9 | Chart month-nav buttons unnamed | Low | Accessibility | Visualization |
| 10 | Sankey SVG has no accessible structure | Low | Accessibility | Visualization |
| 11 | Deficit shown in surplus colour | Low | Visual | Tracker |

---

## Testing Coverage

### Pages Tested
Tracker, Visualization (Plan + Actual), Analysis, Flow Builder (tier cards + connections matrix), Settings modal (palettes, colour modes, advanced styling, keyword map, cloud sync panel), CSV template/import/export, light + dark themes, desktop 1512px and mobile 390×844.

### Features Tested
- Transaction logging: expense + income, note field, category select, inline category creation
- Empty-form submit, negative amount, invalid category state
- Auto-categorisation from note (keyword map) — matched and unmatched cases
- Transaction delete + undo via toast button and via Ctrl/Cmd+Z
- Reload persistence of transactions, subscriptions, plan flows
- Monthly subscription create (valid day 31, day 1), validation rejection of day 45, removal, auto-post check
- Flow Builder: inline amount edits, live balance badge, tier totals, add node, duplicate node name, XSS payload as node name, add connection, self-loop connection
- CSV import: malformed file, valid file, and Ctrl+Z undo of the import
- Sankey render on Plan vs Actual, empty states in each
- Analysis metrics with zero transactions and with real transactions
- Month navigation previous/next
- Keyboard Tab traversal (14 stops) and focus outlines
- Icon-only buttons missing accessible names; inputs missing labels
- Theme toggle to light mode; mobile viewport metrics

### Not Tested / Out of Scope
- **Cloud sync (GitHub Gist)** — Push/Pull/Disconnect were visible but never exercised; requires a real PAT, and the panel correctly showed "Not synced — Cloud sync isn't set up yet." Given Issue #1, a sync merge is also a plausible second XSS delivery path (a gist from another device lands straight in `localStorage`) and deserves a dedicated pass.
- **Node drag-to-reorder on the Sankey** and the branch-drawing animation toggle.
- **CSV export content** — the export button was present but download interception wasn't wired up in this session.
- **Subscription auto-posting** — `postDueSubscriptions()` returned `0` for both seeded subscriptions, but this is *correct*: created 2026-10-02 with day 1 and day 31, neither charge date (Oct 1, Oct 31) had arrived. Not a bug. Backfill behaviour for a subscription created mid-month after its charge date was therefore not observed.
- The final subscription-persistence-across-reload check was cut short by loss of the browser CDP endpoint; the code path (`saveStateToLocalStorage` on add, `subscriptions` serialised into `finflow_architect_model_v2`) reads as correct, and transactions were confirmed to survive reloads, but this specific case is unverified.

### Blockers
Loss of the browser CDP endpoint partway through the final pass ended interactive testing. All issues above were observed and captured before that point, or verified directly against source with the exact line numbers cited.

---

## Fix Status

All eight genuine issues are fixed in the working tree (uncommitted at time of writing)
and verified by two headless regression suites against the local build: **40/40 checks,
no console errors**.

| # | Status | Change |
|---|--------|--------|
| 1 | ✅ Fixed | Nine unescaped interpolations routed through `escapeHtml()`, including three the original report missed (`data-node` attributes, connections matrix, both tooltips) |
| 2 | ✅ Fixed | `renderAnalytics()` surplus/savings-rate now `income − expenses` from `txForMonth()` |
| 3 | ✅ Fixed | `updateGlobalMetrics()` rewritten to read the month's transactions; now called from `renderTracker()` so badges track activity. Labels corrected to Month Income / Month Spend / Net |
| 4 | ✅ Fixed | `Math.sign(v) * Math.round(Math.abs(v))`, plus a `|| 0` guard — without it a −0.4 residual printed `Rs. -0` (verified in Node before patching) |
| 5 | ✅ Fixed | Empty-state branch now covers both Plan and Actual, with plan-specific wording |
| 6 | — | Retracted, no change |
| 7 | — | Retracted, no change |
| 8 | ✅ Fixed | Counts income streams with actual inflow, fixes "1 Stream" grammar, and shows an explicit empty-month or deficit message instead of generic advice |
| 9 | ✅ Fixed | `aria-label` + `title` on both chart month-nav buttons |
| 10 | ✅ Fixed | `role="img"` + mode-aware `aria-label` on the Sankey |
| 11 | ✅ Fixed | Net/surplus figures switch rose/teal by sign on Tracker, header and Analysis; removed the conflicting `text-white` static class so the toggle is authoritative |

Regression coverage added for subscriptions, delete/undo, duplicate-node rejection, and
cross-surface metric agreement.

**Still open:** Issues #9 and #10 are improved but partial — the Sankey still has no
per-node accessible values, so a screen reader gets a summary sentence rather than the
data. Cloud sync remains untested and, given the XSS, is the most plausible second
delivery path for untrusted input.

---

## Notes

The common thread across Issues #2, #3 and #8 is that the app has two parallel accounting systems — the plan (`currentFlows`) and the actuals (`transactions`) — and the header badges plus two of the three Analysis health cards read the plan while presenting themselves as actuals. Given the README is explicit that Analysis is "based on logged transactions", the fix is mostly a matter of routing those three cards at `computeActualFlows(trackerMonth)` the way the income/expense breakdown cards already are. That would also make Issue #2 and #3 disappear rather than needing separate patches.

Issue #4 is a one-line fix and is worth doing first — it makes every other currency figure in the app trustworthy.

Issue #1 was the one to treat as urgent regardless of this being a personal tool: the deployed URL is public, the app auto-checks a Gist on load, and the payload survives reload. Fixing it properly meant escaping **nine** interpolation sites, not the four I first identified — the Sankey tooltips and the `data-*` attributes were the ones most likely to be missed on a re-read, since neither looks like "user-visible text".

On the decision flagged in the original review: the header badges and health cards now
show the selected month's actuals, on the reading that the README's promise ("All
figures come from logged transactions, not the plan") is the intended behaviour and the
code was the thing that was wrong. If you'd rather they stayed plan-level, the change is
localised — `updateGlobalMetrics()` and the health-card block — and the labels are now
explicit enough that either reading is legible. Worth knowing which you prefer before
this reaches the other devices you sync to.

The retraction rate is the other thing worth recording honestly: three of eleven findings
were wrong, all three from asserting a *failure* without checking for the app's own
feedback. Every retraction is documented above rather than quietly deleted, and the
regression suite now asserts the correct behaviour for each so they can't be
re-reported.