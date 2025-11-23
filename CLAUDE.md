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

- **`qrCodeApp()`** (line 255): AlpineJS component containing all application state and logic
  - `generateLabels()`: Creates label data array with QR code URLs via external API (api.qrserver.com)
  - `printLabels()`: Triggers browser print dialog
  - Generates 189 labels per sheet (7 columns × 27 rows)

- **Print styling**: Uses CSS `@page` rule for A4 paper with zero margins (requires Chrome/Chromium)

- **Label format**: Hardcoded for Avery L4731REV-25 labels (see specifications below)

## Avery L4731REV-25 Label Specifications

Page: A4 (210mm × 297mm)

| Dimension | Value |
|-----------|-------|
| Label size | 25.4mm × 10mm |
| Grid | 7 columns × 27 rows (189 labels) |
| Top/Bottom margin | 13.5mm |
| Left/Right margin | 8.6mm |
| Horizontal gap | 2.5mm |
| Vertical gap | 0mm (labels touch) |
| Horizontal pitch | 27.9mm |
| Vertical pitch | 10mm |

## Code Style

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding
