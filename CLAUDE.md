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

- **`qrCodeApp()`** (line 259): AlpineJS component containing all application state and logic
  - `generateLabels()`: Creates label data array with QR code URLs via external API (api.qrserver.com)
  - `printLabels()`: Triggers browser print dialog
  - Generates 80 labels per sheet (4 columns × 20 rows)

- **Print styling**: Uses CSS `@page` rule for US Letter paper with zero margins (requires Chrome/Chromium)

- **Label format**: Hardcoded for Avery 8167 labels (see specifications below)

## Avery 8167 Label Specifications

Page: US Letter (8.5" × 11" / 215.9mm × 279.4mm)

| Dimension | Value |
|-----------|-------|
| Label size | 1.75" × 0.5" (44.45mm × 12.7mm) |
| Grid | 4 columns × 20 rows (80 labels) |
| Top/Bottom margin | 0.5" (12.7mm) |
| Left/Right margin | 0.3" (7.62mm) |
| Horizontal gap | 0.3" (7.62mm) |
| Vertical gap | 0" (labels touch) |
| Horizontal pitch | 2.05" (52.07mm) |
| Vertical pitch | 0.5" (12.7mm) |

## Code Style

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding
