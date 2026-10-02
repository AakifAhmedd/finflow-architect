# Regression tests

Headless checks for the bugs found in QA (`../dogfood-output/report.md`) and for the
behaviour that QA got *wrong* about, so those are not re-reported as bugs.

## Running

```bash
npm install puppeteer-core@23
node tests/regression.js
node tests/regression-a11y-colour.js
```

Both load `file://../index.html` in headless Chrome, so there is no server to start and
nothing to deploy. Each exits non-zero on failure.

Requires a local Chrome at `/Applications/Google Chrome.app` — adjust `CHROME` at the
top of each file for other platforms.

## What is covered

**`regression.js`** (25 checks)
- `formatCurrency` rounding is symmetric and never prints `Rs. -0`
- stored XSS: a node named `<img src=x onerror=…>` persists to localStorage but does not
  execute in Analysis, Flow Builder, or the connections matrix, and survives a reload
- Plan and Actual charts each show an empty-state message
- header badges, Tracker totals and Analysis figures agree with logged transactions
- Analysis shows a deficit message, correct `1 Stream` grammar, and an explicit
  empty-month message

**`regression-a11y-colour.js`** (15 checks)
- net/surplus figures switch rose/teal by sign on all three surfaces
- chart month-nav buttons carry `aria-label`; no visible button is unnamed
- Sankey has `role="img"` and a mode-aware `aria-label`
- subscriptions, delete + undo, and duplicate-node rejection still behave correctly

The last group exists because QA wrongly reported duplicate node creation and note
auto-categorisation as broken. Both work. These assertions pin the correct behaviour so
a future change that breaks them is caught rather than misdiagnosed.