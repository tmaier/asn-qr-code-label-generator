# CLAUDE.md

Guidance for working in this repository.

## Project Overview

Browser-based **Code 128** ASN label generator for Paperless-ngx on Avery L4731 sheets. Single `index.html`, no build step. Fork of tmaier/asn-qr-code-label-generator adapted to a **pair layout** (barcode cell + digit cell).

## Development

Open `index.html` in a browser or serve with any static file server.

CDN dependencies:

- TailwindCSS (forms + typography)
- AlpineJS 3.x
- JsBarcode (Code 128, no external QR API)

Optional PDF:

```bash
npm ci && npx playwright install chromium && npm run generate-pdf
```

## Architecture

Alpine component `asnLabelApp()` in `index.html`:

- `generateLabels()` — 94 pairs (`barcode` + `text`) + 1 `empty` = 189 cells
- `renderBarcode()` — JsBarcode CODE128, `displayValue: false`, SVG stretched to full cell
- Default `leadingZeros: 0` → short payload `ASN1`
- Print via CSS `@page` A4 zero margin (Chrome/Chromium)

## Avery L4731REV-25

| Dimension | Value |
|-----------|-------|
| Label size | 25.4mm × 10mm |
| Grid | 7 × 27 (189 labels) |
| Top/Bottom margin | 13.5mm |
| Left/Right margin | 8.6mm |
| Horizontal gap | 2.5mm |

## Code Style

- 2 spaces, LF, UTF-8
