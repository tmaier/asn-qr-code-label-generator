// Archive serial number labels for Paperless-ngx, without DOM access.
import { encode } from "uqr";

// Avery L4731: 7 × 27 labels on A4. The geometry lives in asn.css; only the
// counts are needed here (they match --columns and --rows there).
export const COLUMNS = 7;
export const ROWS = 27;
export const PER_SHEET = COLUMNS * ROWS;

export const DEFAULTS = Object.freeze({
  startNumber: 1,
  prefix: "ASN",
  leadingZeros: 3,
  borderToggle: false,
  hidePrefix: false,
});

// "ASN" + 7 with 3 leading zeros is "ASN0007": the zeros pad a one-digit
// number, so the width is leadingZeros + 1.
export function labelText(number, prefix, leadingZeros) {
  return prefix + String(number).padStart(leadingZeros + 1, "0");
}

// Whole numbers only, at least `min`; anything else is NaN.
export function parseCount(value, min) {
  const s = String(value ?? "").trim();
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n >= min ? n : NaN;
}

// The text printed next to the QR code. With hidePrefix it is the padded
// number alone; the QR code still carries prefix and number (labelText),
// which is what Paperless-ngx reads.
export function displayText(number, prefix, leadingZeros, hidePrefix = false) {
  return labelText(number, hidePrefix ? "" : prefix, leadingZeros);
}

// Start number of the sheet after the one starting at startNumber.
export const nextSheetStart = (startNumber) => startNumber + PER_SHEET;

// One sheet of labels, numbered row by row from the top left: `code` is
// what the QR code encodes, `text` what is printed next to it.
export function sheet(startNumber, prefix, leadingZeros, { hidePrefix = false } = {}) {
  return Array.from({ length: PER_SHEET }, (_, i) => ({
    code: labelText(startNumber + i, prefix, leadingZeros),
    text: displayText(startNumber + i, prefix, leadingZeros, hidePrefix),
    col: i % COLUMNS,
    row: Math.floor(i / COLUMNS),
  }));
}

// QR symbol as SVG markup. The viewBox is exactly the symbol, without quiet
// zone, so the CSS size of the image is the size of the symbol; the white
// space around it is the label's margin. Error correction L: fewer modules,
// so each is larger on a 9 mm code.
export function qrSvg(text) {
  const { size, data } = encode(text, { ecc: "L", border: 0 });
  let path = "";
  data.forEach((line, y) => {
    let x = 0;
    while (x < size) {
      if (!line[x]) {
        x++;
        continue;
      }
      const from = x;
      while (x < size && line[x]) x++;
      path += `M${from} ${y}h${x - from}v1h${from - x}z`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${path}"/></svg>`;
}

export const qrDataUri = (text) =>
  "data:image/svg+xml," + encodeURIComponent(qrSvg(text));

// Form state from a query string such as "?startNumber=190&prefix=ASN",
// so a link reproduces a sheet. Invalid values are left out.
export function fromQuery(search) {
  const params = new URLSearchParams(search);
  const state = {};
  const start = parseCount(params.get("startNumber"), 1);
  if (!isNaN(start)) state.startNumber = start;
  if (params.has("prefix")) state.prefix = params.get("prefix");
  const zeros = parseCount(params.get("leadingZeros"), 0);
  if (!isNaN(zeros)) state.leadingZeros = zeros;
  if (params.has("borderToggle"))
    state.borderToggle = params.get("borderToggle") === "true";
  if (params.has("hidePrefix"))
    state.hidePrefix = params.get("hidePrefix") === "true";
  return state;
}

export function toQuery({ startNumber, prefix, leadingZeros, borderToggle, hidePrefix = false }) {
  return new URLSearchParams({
    startNumber,
    prefix,
    leadingZeros,
    borderToggle,
    hidePrefix,
  }).toString();
}
