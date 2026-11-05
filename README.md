# QR Code Label Generator for ASNs in Paperless-ngx

A browser-based generator for QR code labels carrying [Archive Serial Numbers (ASN)](https://docs.paperless-ngx.com/advanced_usage/#archive-serial-number-assignment) for [Paperless-ngx](https://docs.paperless-ngx.com/).
It prints one sheet of 189 labels per run.

Live version: <https://tobiasmaier.info/asn-qr-code-label-generator/>

## Label format

The generator prints on Avery L4731REV-25 ([UK shop](https://www.avery.co.uk/product/mini-multipurpose-labels-l4731rev-25), [DE shop](https://www.avery-zweckform.com/produkt/universal-etiketten-l4731rev-25)).
The geometry comes from Avery's own label designer (see [`tests/fixtures/README.md`](tests/fixtures/README.md)).
It measures across the sheet in inches and down the sheet in millimetres, and `index.html` uses the same units:

| Dimension | Value |
|-----------|-------|
| Page | A4, 210 mm × 297 mm |
| Grid | 7 columns × 27 rows (189 labels) |
| Label size | 1 in (25.4 mm) × 10 mm, 2 mm corner radius |
| Top/bottom margin | 13.5 mm |
| Left/right margin | 1/3 in (8.467 mm) |
| Horizontal gap / pitch | 0.1 in (2.54 mm) / 1.1 in (27.94 mm) |
| Vertical gap / pitch | 0 mm (labels touch) / 10 mm |

On each label, the QR symbol's corners sit exactly on the label's rounded corner arcs: 0.586 mm in from the edges, 8.828 mm square.
The white space the QR code standard asks for around the symbol extends into the rounded corners and the paper around the label.
The ASN text fills the space to the right of the QR code and shrinks to fit long numbers or prefixes.

## Printing

- Use Google Chrome or another Chromium-based browser, such as Microsoft Edge. Firefox works partially.
  The page sets size and margins with the [CSS `@page` rule](https://developer.mozilla.org/en-US/docs/Web/CSS/@page).
- Print at 100 % scale.
- Do a test print on plain paper with "Show Border" switched on and hold it against a label sheet before printing many sheets.

## Limitations

- English only.
- One label format (Avery L4731REV-25). Contributions for further formats are welcome.
- The QR codes come from [api.qrserver.com](https://goqr.me/api/), so the browser sends each ASN text to that service.

## Design

- **Client-side only:** a single static `index.html`, no server-side logic, no build step.
- **Small stack:** [TailwindCSS](https://tailwindcss.com) for styling and [AlpineJS](https://alpinejs.dev) for interactivity, both loaded from a CDN.

## Testing

`mise run test` checks what the browser prints against the label format above:

- It reads the print layout of every label and QR code from the browser and compares it with the reference sheet to ±0.01 mm.
- It prints the page to PDF in Chromium, as Chrome's "Save as PDF" does, and compares every printed QR symbol and label text with the reference sheet: one page, 189 labels, positions, sizes, rounded corners, and the right number on each label.
- It renders the sheet, cuts out every label along its die-cut shape and scans each QR code with zxing-cpp, the decoder behind Paperless-ngx's ZXING barcode scanner.
- It checks the reference sheet against Avery's designer export.

Any deviation beyond the tolerance fails the run with a non-zero exit code. The printed PDF gets ±0.3 mm per edge by default, because Chromium snaps printed content to whole CSS pixels (0.265 mm).

[mise](https://mise.jdx.dev) provides Node.js (see `mise.toml`) and the tasks; each task installs the npm packages and Playwright Chromium first when needed.

```sh
mise install                       # Node.js from mise.toml
mise run test                      # index.html of this checkout
ASN_TOLERANCE_MM=0.5 mise run test # other tolerance in mm
mise run test:live                 # live site with the real QR code API
mise run pdf                       # print the default sheet to asn-labels.pdf
mise tasks                         # list all tasks
```

| Variable | Effect |
|----------|--------|
| `ASN_TOLERANCE_MM` | Allowed deviation per label edge (default `0.3`) |
| `ASN_TARGET` | HTML file or URL to test (default `index.html`) |
| `ASN_LIVE_QR=1` | Use api.qrserver.com instead of the offline generator with the same SVG output |

For each case, `test-results/<case>/` holds the printed PDF, an `overlay.pdf` with the reference sheet drawn on top (red = deviating label) and a `report.json` with per-label deviations.

The tests cover the browser output, not your printer.

## Contributions

Contributions are welcome via GitHub at <https://github.com/tmaier/asn-qr-code-label-generator>.

## Container Image

The application can be served as a static container image.
The `Publish container image` GitHub Action can be started manually and publishes the image to GitHub Container Registry.

Run the published image with Docker Compose:

```sh
IMAGE_REPOSITORY=ghcr.io/tmaier/asn-qr-code-label-generator IMAGE_TAG=latest docker compose up -d
```

The app is then available at <http://localhost:8080>.
Set `APP_PORT` to use a different host port.

## Acknowledgments

This project is supported and sponsored by [BauCloud GmbH](https://www.baucloud.com).

Thanks to [Marvin Gaube](https://margau.net) for the blog post ["paperless-ngx with qr codes as ASN: My Workflow"](https://margau.net/posts/2023-04-16-paperless-ngx-asn/), which inspired this application.

The CLI tool [paperless-asn-qr-codes](https://git.jcg.re/jcgruenhage/paperless-asn-qr-codes) by [Jan Christian Grünhage](https://jcg.re) pursues the same goal with a different approach.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html).

All rights reserved by [Tobias L. Maier](https://tobiasmaier.info).
