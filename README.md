# FinFlow Architect

Personal financial flow builder, transaction tracker, and Sankey visualizer. Single self-contained HTML file (Tailwind, D3, d3-sankey via CDN); state is saved in the browser's `localStorage`.

**Live page:** https://aakifahmedd.github.io/finflow-architect/ (GitHub Pages — enable under repo **Settings → Pages**, source `main` / `/root`, if not already on)

## Usage

Open `index.html` in a browser, or use the live page above. No build step — but it loads Tailwind, D3, d3-sankey and Font Awesome from CDNs, so the first load needs a network connection.

## The four views

Switch views from the header tabs.

- **Tracker** — the daily driver. Log income and expenses, browse transactions by month, and manage recurring subscriptions.
- **Visualization** — the Sankey chart, with a **Plan / Actual** toggle. *Plan* renders the values you entered in the Flow Builder; *Actual* renders real logged transactions for the selected month, using the same node topology.
- **Analysis** — savings rate, income diversity, net surplus, and per-category income/expense breakdowns for the selected month. All figures come from logged transactions, not the plan.
- **Flow Builder** — the structural editor: four tier columns (Income Sources → Cash Flow Hub → Allocations → Expenses & Assets) plus a connections matrix table. This is where the chart's node structure and plan amounts are defined.

## Features

### Building a model

- Four-tier flow structure with a live balance indicator (surplus or deficit) as you edit amounts
- Edit flow amounts inline on a node card or in the connections matrix
- Per-node rename and delete, plus add-node and add-connection modals
- Automatic tier assignment inferred from each node's incoming and outgoing edges, with manual tier overrides
- Ships with a blank personal-spending model (income → total cash flow → spending verticals → items)

### Tracking actuals

- Log transactions with type, category, amount, date, and an optional note
- Monthly view with actual income / spend / net totals
- **Monthly subscriptions** post an expense automatically on their chosen day each month (short months use the last day). Removing one stops future charges and keeps past ones.
- **Auto-category from note** — map a keyword to a category in Settings; while you type a note, the category fills itself in. Longest matching keyword wins. A manual category choice always wins over the keyword map.
- Create new categories inline from the tracker

### Visualizing

- D3 Sankey with hover tooltips showing inflow, outflow, and a link's share of its source node; hovering dims unrelated links
- Drag Sankey nodes to reorder them visually
- Left-to-right branch-drawing animation, tier by tier, with a Settings toggle to turn it off
- Four palettes (Emerald Finance, Cyber Neon, Warm Sunset, Classic Monokai)
- Alternative colour modes: **Monotone** (shaded levels from one base colour) and **Duotone** (gradient across tiers from colour A to colour B)
- Advanced styling controls: node width, node padding, flow-ribbon opacity, and horizontal alignment
- Light / dark mode toggle in the header

### Data

- CSV import and export, plus a downloadable template
- Undo for deletes, resets, node creation, and CSV loads — via **Ctrl/Cmd+Z**, and via the **Undo** button that appears in the confirmation toast for a few seconds after the action
- Optional cross-device sync via a private GitHub Gist (header cloud button, Settings → Cloud Sync); the token stays in this browser only. When both devices changed, the app merges them instead of prompting.

## Notes

- Saved data (model, transactions, subscriptions, currency, theme, settings) is per browser and per origin. Clearing site data clears the model.
- Values are formatted for LKR by default. The formatter also handles ₹, €, £ and ¥, but there is currently no UI to switch currency — it is not yet a user setting.
- Plan values start at zero. The Analysis view and the Actual chart stay empty until you log transactions.
