# FinFlow Architect

Personal financial flow builder and Sankey visualizer. Single self-contained HTML file (Tailwind, D3, d3-sankey via CDN); state is saved in the browser's `localStorage`.

**Live page:** https://claude.ai/artifact/KsGrWwjtmL9ePcXgFPNfRC

## Usage

Open `index.html` in a browser. No build step.

## Notes

- `index.html` here is the original file. The published page is a variant that loads D3 from cdnjs and inlines the Font Awesome icons, because the hosting page blocks d3js.org and external icon stylesheets.
- Saved data is per browser and per origin, so the local file and the published page keep separate state.
