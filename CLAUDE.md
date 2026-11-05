# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based QR code label generator for Paperless-ngx Archive Serial Numbers (ASN). The entire application is a single `index.html` file with no build process.

## Development

**No build tools required** - Open `index.html` directly in a browser or serve it with any static file server.

The application uses CDN-hosted dependencies:
- TailwindCSS (with forms and typography plugins)
- AlpineJS 3.x

## Architecture

Single-page application using AlpineJS for reactivity. Key structure in `index.html`:

- **`qrCodeApp()`**: AlpineJS component containing all application state and logic
  - `generateLabels()`: Creates label data array with QR code URLs via external API (api.qrserver.com)
  - `fitTexts()`: Shrinks label texts that don't fit next to the QR code
  - `printLabels()`: Triggers browser print dialog
  - Generates 189 labels per sheet (7 columns × 27 rows)

- **Print styling**: Uses CSS `@page` rule for A4 paper with zero margins (requires Chrome/Chromium)

- **Label format**: Hardcoded for Avery L4731REV-25 labels (see specifications below)

## Testing

`npm test` (Node ≥ 22.13, Playwright Chromium) prints the page to PDF and compares the printed QR codes and texts with the reference sheet in `tests/lib/avery-l4731rev-25.mjs`. Keep that file in sync with the table below. Env vars: `ASN_TOLERANCE_MM` (default 0.3), `ASN_TARGET` (file or URL), `ASN_LIVE_QR=1`. Artifacts land in `test-results/`.

## Avery L4731REV-25 Label Specifications

Source: Avery's label designer export in `tests/fixtures/avery-designer-l4731.pdf` (see `tests/fixtures/README.md`). Avery uses an inch grid for this sheet.

Page: A4 (210mm × 297mm)

| Dimension | Value |
|-----------|-------|
| Label size | 25.4mm × 10mm (1 in wide), 2mm corner radius |
| Grid | 7 columns × 27 rows (189 labels) |
| Top/Bottom margin | 13.5mm |
| Left/Right margin | 8.47mm (1/3 in) |
| Horizontal gap | 2.54mm (0.1 in) |
| Vertical gap | 0mm (labels touch) |
| Horizontal pitch | 27.94mm (1.1 in) |
| Vertical pitch | 10mm |

In `index.html` these live as CSS custom properties in the `<style>` block (`--sheet-margin-left`, `--label-gap-x`, …). The QR symbol's corners sit exactly on the 2mm corner arcs: inset `r·(1 − 1/√2)` ≈ 0.586mm, size ≈ 8.828mm. The QR codes are requested as SVG (no quiet zone in the image), so the CSS size is the symbol size.

## Code Style

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding
