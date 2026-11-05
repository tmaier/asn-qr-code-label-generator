# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For what the project does, the label format and how to run the tests, see [README.md](README.md).

## Development

The application is the single file `index.html`: no build step. Open it in a browser or serve it with any static file server. TailwindCSS (forms and typography plugins) and AlpineJS 3.x load from CDNs.

## Architecture

- **`qrCodeApp()`**: AlpineJS component holding all state and logic.
  - `readUrlParams()` / `updateUrl()`: keep the form fields in the URL query string.
  - `generateLabels()`: builds the 189 labels (7 × 27), each with an api.qrserver.com URL for an SVG QR code. The SVG's viewBox is exactly the symbol, without quiet zone, so the CSS size of the `<img>` is the symbol size.
  - `fitTexts()`: shrinks a label text that is too wide for the space next to the QR code.
  - `printLabels()`: opens the browser print dialog.
- **Print styling**: `@page { size: A4; margin: 0 }`. The grid has fixed label-width tracks, so it does not depend on the page width the browser reports (Chromium prints A4 as 209.89 × 297.01 mm). The sheet has no bottom padding in print, so it fits on one page.

## Label geometry

The Avery L4731REV-25 geometry exists in three places. Change them together:

1. `index.html`: CSS custom properties in the `<style>` block (`--sheet-margin-left`, `--label-gap-x`, `--label-radius`, …). `--qr-inset` and `--qr-size` derive from the radius: inset `r·(1 − 1/√2)`, size `label height − 2·inset`.
2. `tests/lib/avery-l4731rev-25.mjs`: the reference sheet the tests compare against.
3. The table in README.md.

`tests/fixtures/avery-designer-l4731.pdf` (Avery's own designer export) is the source of truth. `mise run test` fails if the reference sheet drifts from it, and if the printed page drifts from the reference sheet.

## Testing

Tool versions and tasks live in `mise.toml` (see README.md); CI runs the same tasks via `jdx/mise-action`. The tests live in `tests/`, and artifacts land in `test-results/` (git-ignored). The negative control in `tests/print-geometry.test.mjs` edits `--sheet-margin-left` in `index.html`; update it when that declaration changes.

## Code Style

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding
