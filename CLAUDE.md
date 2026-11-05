# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For what the project does, the label format and how to run the tests, see [README.md](README.md).

## Layout

- `src/`: the package, plain ES modules and CSS that other sites install as a git dependency (`github:tmaier/asn-qr-code-label-generator#v2.x.y`) and import without a build. `package.json` `exports` and `files` define what they get; `uqr` is the only runtime dependency. No `prepare`/`postinstall` script: installing from git must not need a build.
  - `labels.js`: pure label logic, no DOM: `labelText` (the QR content), `displayText` (the printed text, without the prefix if `hidePrefix`), `parseCount`, `sheet` (189 labels, row by row, each `{ code, text, col, row }`), `nextSheetStart`, `qrSvg`/`qrDataUri` (QR symbol via uqr, error correction L, viewBox exactly the symbol without quiet zone, so the CSS size of the `<img>` is the symbol size), `fromQuery`/`toQuery`, `DEFAULTS`, `COLUMNS`/`ROWS`/`PER_SHEET`.
  - `asn.css`: sheet geometry and print rules (`@page { size: A4; margin: 0 }`). Only rules every consumer needs; nothing that hides a particular site's chrome.
  - `component.js`: `asnLabels(options)`, the Alpine data object (does not import Alpine). Number fields are strings; `labels` is a getter; the query string wins over localStorage (`storageKey`, default `asn-labels-v1`, `null` disables it). `fitTexts()` shrinks label texts that are too wide, within `this.$root`.
  - `index.js`: re-exports both.
  - `standalone.js` / `standalone.css`: entry points of the standalone page only (Alpine from npm, Tailwind v4 with forms and typography).
- `index.html`: the standalone page. It loads only `app.css`, `asn.css` and `app.js`, which exist in `dist/` after `mise run build` (`scripts/build.js`: esbuild + Tailwind CLI; `src/asn.css` is copied unchanged). `dist/` is git-ignored. README.md documents the markup contract that `index.html` and other sites follow.
- **Print styling**: the labels have fixed positions, so the sheet does not depend on the page width the browser reports (Chromium prints A4 as 209.89 × 297.01 mm). The sheet has no bottom padding in print, so it fits on one page.

## Label geometry

The Avery L4731 geometry (shared by every L4731REV-xx pack size) exists in three places. Change them together:

1. `src/asn.css`: CSS custom properties on `:root` (`--sheet-margin-left`, `--label-gap-x`, `--label-radius`, …). `--qr-inset` and `--qr-size` derive from the radius: inset `r·(1 − 1/√2)`, size `label height − 2·inset`. `COLUMNS`/`ROWS` in `src/labels.js` match `--columns`/`--rows`.
2. `tests/lib/avery-l4731rev-25.mjs`: the reference sheet the tests compare against.
3. The table in README.md.

`tests/fixtures/avery-designer-l4731.pdf` (Avery's own designer export) is the source of truth. `mise run test` fails if the reference sheet drifts from it, and if the printed page drifts from the reference sheet.

## Testing

Tool versions and tasks live in `mise.toml` (see README.md); CI runs the same tasks (`build`, then `test`) via `jdx/mise-action`. `mise run test` builds `dist/` first. The tests live in `tests/`: unit tests for `src/` (`labels.test.mjs`, `component.test.mjs`), a test of the standalone page's controls (`standalone.test.mjs`) and print tests against `dist/index.html`, which `tests/lib/print.mjs` serves together with the files next to it. Artifacts land in `test-results/` (git-ignored). The negative control in `tests/print-geometry.test.mjs` edits `--sheet-margin-left` in `src/asn.css` and serves that in place of `dist/asn.css`; update it when that declaration changes.

## Code Style

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding
