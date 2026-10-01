# FinFlow Architect

Personal financial flow builder and Sankey visualizer. Single self-contained HTML file (Tailwind, D3, d3-sankey via CDN); state is saved in the browser's `localStorage`.

**Live page:** https://aakifahmedd.github.io/finflow-architect/ (GitHub Pages — enable under repo **Settings → Pages**, source `main` / `/root`, if not already on)

## Usage

Open `index.html` in a browser. No build step.

## Features

- Drag-and-drop flow builder with a live Sankey chart, defaulting to LKR and a Sri Lankan income/expense preset
- CSV import/export, with a downloadable template
- Light / dark mode toggle (header)
- Left-to-right branch-drawing chart animation, with a Settings toggle to turn it off
- Undo (button + Ctrl/Cmd+Z) for deletes, resets, and preset/CSV loads
- Chart export as PNG, JPEG or SVG via the "Share as" button on the chart screen
- Optional cross-device sync via a private GitHub Gist (header cloud button, Settings → Cloud Sync); the token stays in the browser only

## Notes

- Saved data (model, currency, theme, settings) is per browser and per origin.
