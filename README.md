# Code 128 ASN Label Generator (L4731 pair layout)

Fork of [tmaier/asn-qr-code-label-generator](https://github.com/tmaier/asn-qr-code-label-generator), adapted for local Paperless-ngx use on Avery **L4731** sheets.

## What changed vs upstream

| Upstream | This fork |
|----------|-----------|
| QR via `api.qrserver.com` | **Code 128** via [JsBarcode](https://github.com/lindell/JsBarcode) (CDN, offline after cache) |
| QR + text in **one** 25.4×10 mm cell | **Pair layout**: barcode label → digit label |
| 189 ASNs / sheet | **94 ASNs / sheet** (94 pairs + 1 empty trailing label) |
| Default padded `ASN00001` | Default **short** payload `ASN1` (leading zeros = 0) |

Scan validation (zxing in `dok-paperless` path, 300 DPI, no upscale): **94 / 94** on the paired Code 128 sheet.

## Usage

Open `index.html` in Chrome/Chromium (or any static file server). Set start number / prefix / leading zeros, then **Print Labels** at 1:1 scale (no “fit to page”).

Next sheet start = current start + **94**.

Paperless knobs to keep in sync:

- `PAPERLESS_CONSUMER_ENABLE_ASN_BARCODE=true`
- `PAPERLESS_CONSUMER_ENABLE_BARCODES=true` (needed for ASN split)
- `PAPERLESS_CONSUMER_ASN_BARCODE_PREFIX` = same as the UI prefix (default `ASN`)

## Label geometry (Avery L4731REV-25)

| Dimension | Value |
|-----------|-------|
| Page | A4 |
| Label | 25.4 mm × 10 mm |
| Grid | 7 × 27 = 189 cells |
| Margins | top/bottom 13.5 mm, left/right 8.6 mm |
| Horizontal gap | 2.5 mm |

Cell order left→right, top→bottom: `barcode(ASN n)`, `text(n)`, …, last cell empty.

## CLI PDF (optional)

```bash
npm ci
npx playwright install chromium
npm run generate-pdf   # writes asn-labels.pdf
```

## License

AGPL-3.0 — see [LICENSE](./LICENSE). Upstream © Tobias L. Maier.
