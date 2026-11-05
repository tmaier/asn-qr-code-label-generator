# QR Code Label Generator for ASNs in Paperless-ngx

A browser-based generator for QR code labels carrying [Archive Serial Numbers (ASN)](https://docs.paperless-ngx.com/advanced_usage/#archive-serial-number-assignment) for [Paperless-ngx](https://docs.paperless-ngx.com/).
It prints one sheet of 189 labels per run.

Live version: <https://tobiasmaier.info/asn-qr-code-label-generator/>

## Label format

The generator prints on Avery L4731, for example L4731REV-25 ([UK shop](https://www.avery.co.uk/product/mini-multipurpose-labels-l4731rev-25), [DE shop](https://www.avery-zweckform.com/produkt/universal-etiketten-l4731rev-25)).
Every L4731REV-xx pack size shares the same sheet layout.
The geometry comes from Avery's own label designer (see [`tests/fixtures/README.md`](tests/fixtures/README.md)).
It measures across the sheet in inches and down the sheet in millimetres, and [`src/asn.css`](src/asn.css) uses the same units:

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
- One label format (Avery L4731). Contributions for further formats are welcome.

## Design

- **Client-side only:** a static page, no server-side logic. The QR codes are generated in the browser with [uqr](https://github.com/unjs/uqr); no ASN text leaves the browser.
- **Small stack:** [AlpineJS](https://alpinejs.dev) for interactivity and [TailwindCSS](https://tailwindcss.com) for the page around the label sheet.
- **Library first:** the label logic, the sheet geometry and the Alpine component live in `src/` as plain ES modules and CSS, usable without a build (see [Use as a library](#use-as-a-library)).
  The standalone page `index.html` is built from the same modules into `dist/` with esbuild and the Tailwind CLI; it loads nothing from a CDN.

```sh
mise run build   # writes dist/: index.html, app.js, app.css, asn.css
```

Open `dist/index.html` in a browser or serve `dist/` with any static file server.

## Use as a library

Install the package from Git; it needs no build step:

```sh
npm install github:tmaier/asn-qr-code-label-generator#v2.0.0
```

| Import | Contents |
|--------|----------|
| `asn-qr-code-label-generator` | `asnLabels(options)` (Alpine component) and the label logic: `labelText`, `displayText`, `parseCount`, `sheet`, `nextSheetStart`, `qrSvg`, `qrDataUri`, `fromQuery`, `toQuery`, `DEFAULTS`, `COLUMNS`, `ROWS`, `PER_SHEET` |
| `asn-qr-code-label-generator/asn.css` | Sheet geometry and print rules (`@page` A4 with no margin) |

The component does not import Alpine; register it with your own:

```js
import Alpine from "alpinejs";
import { asnLabels } from "asn-qr-code-label-generator";
import "asn-qr-code-label-generator/asn.css"; // or a <link> to src/asn.css

Alpine.data("asnLabels", asnLabels);
// Options: storageKey (default "asn-labels-v1", null keeps nothing in
// localStorage) and syncUrl (default true: keep the fields in the query
// string, which wins over localStorage).
// Alpine.data("asnLabels", () => asnLabels({ storageKey: null }));
Alpine.start();
```

The markup binds to the component and uses the classes from `asn.css`:

```html
<div x-data="asnLabels">
  <form @submit.prevent>
    <input type="number" x-model="startNumber" x-ref="startNumber" :aria-invalid="!valid('startNumber')" />
    <input type="text" x-model="prefix" />
    <input type="number" x-model="leadingZeros" :aria-invalid="!valid('leadingZeros')" />
    <input type="checkbox" x-model="borderToggle" />
    <input type="checkbox" x-model="hidePrefix" />
    <p x-text="startHint"></p>
    <button type="button" @click="nextSheet()">Next sheet</button>
    <button type="button" @click="reset()">Reset</button>
    <button type="button" @click="print()" :disabled="!ok">Print</button>
  </form>

  <div class="asn-sheet" :class="{ 'asn-show-border': borderToggle }">
    <ol class="asn-labels">
      <template x-for="label in labels">
        <li class="asn-label" :style="{ '--col': label.col, '--row': label.row }">
          <img class="asn-label-qr" :src="label.qr" alt="" />
          <div class="asn-label-text"><span x-text="label.text"></span></div>
        </li>
      </template>
    </ol>
  </div>
</div>
```

- Fields: `startNumber`, `leadingZeros` (strings, as the number inputs hold them), `prefix`, `borderToggle`, `hidePrefix` (default `false`: print only the number next to the QR code; the QR code still encodes prefix and number). All of them are kept in the query string and localStorage.
- Getters: `ok` (all fields valid), `labels` (one sheet of `{ code, text, col, row, qr }`: `code` is what the QR code encodes, `text` what is printed, `qr` an SVG data URI of `code`; empty while a field is invalid), `first` (printed text of the first label), `nextStart` (start number of the next sheet, `startNumber` + 189), `startHint`.
- Methods: `valid(field)`, `nextSheet()` (raises `startNumber` by one sheet, which updates the labels and the query string, and focuses `x-ref="startNumber"` if present), `reset()`, `print()`, `fitTexts()`.
- Classes: `.asn-sheet` > `ol.asn-labels` > `li.asn-label` (with `--col` and `--row`) > `img.asn-label-qr` and `.asn-label-text` > `span`. `fitTexts()` shrinks the spans inside the component's root; `.asn-show-border` outlines the labels in `--asn-border-color` and `--asn-border-color-alt`.
- In print, hide everything but `.asn-sheet` and keep the sheet at the top left of the page: `asn.css` sets the page and the sheet, not your site's header, navigation or footer.

## Testing

`mise run test` runs unit tests for `src/`, builds `dist/` and checks what the browser prints from `dist/index.html` against the label format above:

- It reads the print layout of every label and QR code from the browser and compares it with the reference sheet to ±0.01 mm.
- It prints the page to PDF in Chromium, as Chrome's "Save as PDF" does, and compares every printed QR symbol and label text with the reference sheet: one page, 189 labels, positions, sizes, rounded corners, and the right number on each label.
- It renders the sheet, cuts out every label along its die-cut shape and scans each QR code with zxing-cpp, the decoder behind Paperless-ngx's ZXING barcode scanner.
- It checks the reference sheet against Avery's designer export.
- It breaks the left margin in `src/asn.css` by 1 mm and expects the comparison to catch it.

Any deviation beyond the tolerance fails the run with a non-zero exit code. The printed PDF gets ±0.3 mm per edge by default, because Chromium snaps printed content to whole CSS pixels (0.265 mm).

[mise](https://mise.jdx.dev) provides Node.js (see `mise.toml`) and the tasks; each task installs the npm packages and Playwright Chromium first when needed.

```sh
mise install                       # Node.js from mise.toml
mise run build                     # build the standalone page into dist/
mise run test                      # unit tests and dist/index.html of this checkout
ASN_TOLERANCE_MM=0.5 mise run test # other tolerance in mm
mise run test:live                 # live site
mise run pdf                       # print the default sheet to asn-labels.pdf
mise tasks                         # list all tasks
```

| Variable | Effect |
|----------|--------|
| `ASN_TOLERANCE_MM` | Allowed deviation per label edge (default `0.3`) |
| `ASN_TARGET` | HTML file (served with the files next to it) or URL to test (default `dist/index.html`) |

For each case, `test-results/<case>/` holds the printed PDF, an `overlay.pdf` with the reference sheet drawn on top (red = deviating label) and a `report.json` with per-label deviations.

The tests cover the browser output, not your printer.

## Contributions

Contributions are welcome via GitHub at <https://github.com/tmaier/asn-qr-code-label-generator>.

## Acknowledgments

This project is supported and sponsored by [BauCloud GmbH](https://www.baucloud.com).

Thanks to [Marvin Gaube](https://margau.net) for the blog post ["paperless-ngx with qr codes as ASN: My Workflow"](https://margau.net/posts/2023-04-16-paperless-ngx-asn/), which inspired this application.

The CLI tool [paperless-asn-qr-codes](https://git.jcg.re/jcgruenhage/paperless-asn-qr-codes) by [Jan Christian Grünhage](https://jcg.re) pursues the same goal with a different approach.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html).

All rights reserved by [Tobias L. Maier](https://tobiasmaier.info).
